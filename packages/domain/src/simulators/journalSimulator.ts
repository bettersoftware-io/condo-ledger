import { BehaviorSubject, type Observable } from "rxjs";

import type { Account } from "#/entities/account.ts";
import type { Invoice, WithholdingTax } from "#/entities/invoice.ts";
import type { EntryDraft, JournalEntry } from "#/entities/journal.ts";
import type { Party } from "#/entities/party.ts";
import {
  accepted,
  type Result,
  type ResultOf,
  rejected,
} from "#/entities/result.ts";
import type { ClockPort } from "#/ports/clockPort.ts";
import type { EntryAdded, JournalPort } from "#/ports/journalPort.ts";
import { must } from "#/support/must.ts";
import { romeTime } from "#/support/romeTime.ts";
import { canDeleteEntry } from "#/useCases/canDeleteEntry.ts";
import { canEditEntry } from "#/useCases/canEditEntry.ts";
import { type EntryContext, validateEntry } from "#/useCases/validateEntry.ts";

import {
  type PeriodSchedule,
  seededSchedule,
} from "./installmentsSimulator.ts";
import { missingPeriod } from "./missingPeriod.ts";
import type { LegacySeed } from "./seed/legacySeed.ts";

/** The port, and what the installments simulator reads of it: a period's entries as they stand now. */
export interface JournalSimulator extends JournalPort {
  /** In number order. Throws "missing: the period <id>" for a period the simulator does not have. */
  current(periodId: string): JournalEntry[];
}

/**
 * A period's journal and invoices, kept in memory (entries in number order),
 * and what a draft is checked against besides: the accounts, the parties and
 * the withholding catalogue.
 */
interface PeriodJournal {
  periodId: string;
  entries$: BehaviorSubject<JournalEntry[]>;
  invoices$: BehaviorSubject<Invoice[]>;
  accounts: Account[];
  parties: Party[];
  withholdingTaxes: WithholdingTax[];
}

/** An entry with the period journal that holds it. */
interface Held {
  journal: PeriodJournal;
  entry: JournalEntry;
}

/**
 * The seed's journal, a period at a time, with what the wizards write kept in
 * memory. Numbers and stamps as the legacy store did: the next number of the
 * period, the clock's moment on the Rome wall clock; a delete moves every later
 * entry down one number. A registration writes its invoice with it, and a
 * delete of one removes it. A collection is judged against the period's
 * installment schedule as `scheduleOf` answers it now; left out, the seed's.
 * Throws on an unknown id: it never answers empty for a wrong key.
 */
export function createJournalSimulator(
  seed: LegacySeed,
  clock: ClockPort,
  scheduleOf: (periodId: string) => PeriodSchedule = (
    periodId: string,
  ): PeriodSchedule => {
    return seededSchedule(seed, periodId);
  },
): JournalSimulator {
  const periods = new Map<string, PeriodJournal>();
  let added = 0;
  let invoicesAdded = 0;

  for (const building of seed.buildings) {
    for (const period of building.periods) {
      periods.set(period.id, {
        periodId: period.id,
        entries$: new BehaviorSubject(
          seed.entries
            .filter((entry) => {
              return entry.periodId === period.id;
            })
            .sort((a, b) => {
              return a.number - b.number;
            }),
        ),
        invoices$: new BehaviorSubject(
          seed.invoices.filter((invoice) => {
            return invoice.periodId === period.id;
          }),
        ),
        accounts: seed.accounts.filter((account) => {
          return account.periodId === period.id;
        }),
        parties:
          seed.parties.find((list) => {
            return list.periodId === period.id;
          })?.parties ?? [],
        withholdingTaxes: seed.withholdingTaxes.filter((tax) => {
          return tax.periodId === period.id;
        }),
      });
    }
  }

  function periodJournalOf(periodId: string): PeriodJournal {
    return must(periods.get(periodId), `the period ${periodId}`);
  }

  /** What a write to the period is judged against, the entry an edit rewrites named. */
  function contextOf(
    journal: PeriodJournal,
    replacing: string | null,
  ): EntryContext {
    const schedule = scheduleOf(journal.periodId);

    return {
      accounts: journal.accounts,
      parties: journal.parties,
      withholdingTaxes: journal.withholdingTaxes,
      invoices: journal.invoices$.getValue(),
      entries: journal.entries$.getValue(),
      installments: schedule.installments,
      installmentItems: schedule.items,
      replacing,
    };
  }

  function heldOf(entryId: string): Held {
    for (const journal of periods.values()) {
      const entry = journal.entries$.getValue().find((candidate) => {
        return candidate.id === entryId;
      });

      if (entry !== undefined) {
        return { journal, entry };
      }
    }

    throw new Error(`missing: the entry ${entryId}`);
  }

  function add(
    periodId: string,
    journal: PeriodJournal,
    draft: EntryDraft,
  ): ResultOf<EntryAdded> {
    const verdict = validateEntry(draft, contextOf(journal, null));

    if (!verdict.ok) {
      return verdict;
    }

    const entries = journal.entries$.getValue();
    added += 1;
    const id = `new${added}`;
    let invoiceId = draft.invoiceId ?? null;

    if (draft.invoice !== undefined) {
      invoicesAdded += 1;
      invoiceId = `newInv${invoicesAdded}`;
      // The invoice lands before its entry, so no reader sees the entry name an invoice it cannot find.
      journal.invoices$.next([
        ...journal.invoices$.getValue(),
        { ...draft.invoice, id: invoiceId, periodId, entryId: id },
      ]);
    }

    journal.entries$.next([
      ...entries,
      {
        id,
        periodId,
        number: nextNumber(entries),
        at: romeTime(clock.now()),
        kind: draft.kind,
        description: draft.description,
        postings: draft.postings,
        invoiceId,
      },
    ]);

    return accepted({ id });
  }

  function replace(held: Held, draft: EntryDraft): Result {
    const { journal, entry } = held;
    const editable = canEditEntry(entry);

    if (!editable.ok) {
      return editable;
    }

    if (draft.kind !== entry.kind) {
      return rejected("kind-changed");
    }

    const verdict = validateEntry(draft, contextOf(journal, entry.id));

    if (!verdict.ok) {
      return verdict;
    }

    const terms = draft.invoice;

    if (terms !== undefined) {
      journal.invoices$.next(
        journal.invoices$.getValue().map((invoice) => {
          return invoice.entryId === entry.id
            ? {
                ...terms,
                id: invoice.id,
                periodId: invoice.periodId,
                entryId: entry.id,
              }
            : invoice;
        }),
      );
    }

    journal.entries$.next(
      journal.entries$.getValue().map((candidate) => {
        return candidate.id === entry.id
          ? {
              ...candidate,
              description: draft.description,
              postings: draft.postings,
              invoiceId: draft.invoiceId ?? candidate.invoiceId,
            }
          : candidate;
      }),
    );

    return verdict;
  }

  function remove(held: Held): Result {
    const { journal, entry } = held;
    const entries = journal.entries$.getValue();
    const verdict = canDeleteEntry(entry, entries);

    if (!verdict.ok) {
      return verdict;
    }

    journal.entries$.next(
      entries
        .filter((candidate) => {
          return candidate.id !== entry.id;
        })
        .map((candidate) => {
          return candidate.number > entry.number
            ? { ...candidate, number: candidate.number - 1 }
            : candidate;
        }),
    );

    if (entry.kind === "invoice") {
      // The entry goes before its invoice, so no reader sees an entry name an invoice that is gone.
      journal.invoices$.next(
        journal.invoices$.getValue().filter((invoice) => {
          return invoice.entryId !== entry.id;
        }),
      );
    }

    return verdict;
  }

  return {
    entries: (periodId: string): Observable<JournalEntry[]> => {
      const journal = periods.get(periodId);

      return journal === undefined
        ? missingPeriod(periodId)
        : journal.entries$.asObservable();
    },
    invoices: (periodId: string): Observable<Invoice[]> => {
      const journal = periods.get(periodId);

      return journal === undefined
        ? missingPeriod(periodId)
        : journal.invoices$.asObservable();
    },
    addEntry: (
      periodId: string,
      draft: EntryDraft,
    ): Promise<ResultOf<EntryAdded>> => {
      // A throw inside the executor is a rejection, as the port promises.
      return new Promise((resolve) => {
        resolve(add(periodId, periodJournalOf(periodId), draft));
      });
    },
    replaceEntry: (entryId: string, draft: EntryDraft): Promise<Result> => {
      return new Promise((resolve) => {
        resolve(replace(heldOf(entryId), draft));
      });
    },
    deleteEntry: (entryId: string): Promise<Result> => {
      return new Promise((resolve) => {
        resolve(remove(heldOf(entryId)));
      });
    },
    current: (periodId: string): JournalEntry[] => {
      return periodJournalOf(periodId).entries$.getValue();
    },
  };
}

/** The legacy rule: MAX(code) + 1 within the period, 1 in an empty one. */
function nextNumber(entries: JournalEntry[]): number {
  return (
    entries.reduce((max, entry) => {
      return Math.max(max, entry.number);
    }, 0) + 1
  );
}
