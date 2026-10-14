import { BehaviorSubject, type Observable, throwError } from "rxjs";

import type { Account } from "#/entities/account.ts";
import type { EntryDraft, JournalEntry } from "#/entities/journal.ts";
import { accepted, type Result, type ResultOf } from "#/entities/result.ts";
import type { EntryAdded, JournalPort } from "#/ports/journalPort.ts";
import { type Clock, systemClock } from "#/support/clock.ts";
import { must } from "#/support/must.ts";
import { romeTime } from "#/support/romeTime.ts";
import { canDeleteEntry } from "#/useCases/canDeleteEntry.ts";
import { validateEntry } from "#/useCases/validateEntry.ts";

import type { LegacySeed } from "./seed/legacySeed.ts";

/** A period's journal, kept in memory in number order, and the accounts a draft is checked against. */
interface PeriodJournal {
  entries$: BehaviorSubject<JournalEntry[]>;
  accounts: Account[];
}

/**
 * The seed's journal, a period at a time, with what the wizards write kept in
 * memory. Numbers and stamps as the legacy store did: the next number of the
 * period, the clock's moment on the Rome wall clock; a delete moves every later
 * entry down one number. Throws on an unknown id: it never answers empty for
 * a wrong key.
 */
export function createJournalSimulator(
  seed: LegacySeed,
  clock: Clock = systemClock,
): JournalPort {
  const periods = new Map<string, PeriodJournal>();
  let added = 0;

  for (const building of seed.buildings) {
    for (const period of building.periods) {
      periods.set(period.id, {
        entries$: new BehaviorSubject(
          seed.entries
            .filter((entry) => {
              return entry.periodId === period.id;
            })
            .sort((a, b) => {
              return a.number - b.number;
            }),
        ),
        accounts: seed.accounts.filter((account) => {
          return account.periodId === period.id;
        }),
      });
    }
  }

  function periodJournalOf(periodId: string): PeriodJournal {
    return must(periods.get(periodId), `the period ${periodId}`);
  }

  return {
    entries: (periodId: string): Observable<JournalEntry[]> => {
      const journal = periods.get(periodId);

      return journal === undefined
        ? throwError(() => {
            return new Error(`missing: the period ${periodId}`);
          })
        : journal.entries$.asObservable();
    },
    addEntry: (
      periodId: string,
      draft: EntryDraft,
    ): Promise<ResultOf<EntryAdded>> => {
      // A throw inside the executor is a rejection, as the port promises.
      return new Promise((resolve) => {
        const journal = periodJournalOf(periodId);
        const verdict = validateEntry(draft, journal.accounts);

        if (!verdict.ok) {
          resolve(verdict);

          return;
        }

        const entries = journal.entries$.getValue();
        added += 1;
        const id = `new${added}`;

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
          },
        ]);
        resolve(accepted({ id }));
      });
    },
    deleteEntry: (entryId: string): Promise<Result> => {
      return new Promise((resolve) => {
        const journal = must(
          [...periods.values()].find((candidate) => {
            return candidate.entries$.getValue().some((entry) => {
              return entry.id === entryId;
            });
          }),
          `the entry ${entryId}`,
        );
        const entries = journal.entries$.getValue();
        const entry = must(
          entries.find((candidate) => {
            return candidate.id === entryId;
          }),
          `the entry ${entryId}`,
        );
        const verdict = canDeleteEntry(entry);

        if (verdict.ok) {
          journal.entries$.next(
            entries
              .filter((candidate) => {
                return candidate.id !== entryId;
              })
              .map((candidate) => {
                return candidate.number > entry.number
                  ? { ...candidate, number: candidate.number - 1 }
                  : candidate;
              }),
          );
        }

        resolve(verdict);
      });
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
