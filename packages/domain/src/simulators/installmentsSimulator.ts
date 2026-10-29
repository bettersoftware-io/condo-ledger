import { BehaviorSubject, type Observable } from "rxjs";

import type { Account } from "#/entities/account.ts";
import type { Cents } from "#/entities/cents.ts";
import type { Installment, InstallmentItem } from "#/entities/installment.ts";
import type { JournalEntry } from "#/entities/journal.ts";
import type { Party } from "#/entities/party.ts";
import { ok, type Result } from "#/entities/result.ts";
import type {
  InstallmentsDraft,
  InstallmentsPort,
} from "#/ports/installmentsPort.ts";
import { must } from "#/support/must.ts";
import { budgetSharesOf } from "#/useCases/budgetShares.ts";
import {
  planBudgetInstallments,
  planInputOf,
} from "#/useCases/planInstallments.ts";
import {
  type InstallmentPatch,
  type ScheduleContext,
  validateCreate,
  validateDelete,
  validateItemAmount,
  validateUpdate,
} from "#/useCases/validateSchedule.ts";

import { missingPeriod } from "./missingPeriod.ts";
import type { LegacySeed } from "./seed/legacySeed.ts";

/** A period's installments and the items of those installments. */
export interface PeriodSchedule {
  installments: Installment[];
  items: InstallmentItem[];
}

/** The port, and what the journal simulator reads of it: a period's schedule as it stands now. */
export interface InstallmentsSimulator extends InstallmentsPort {
  /** Throws "missing: the period <id>" for a period the simulator does not have. */
  current(periodId: string): PeriodSchedule;
}

/** A period's schedule, kept in memory, and the books a batch is planned from. */
interface PeriodState {
  periodId: string;
  installments$: BehaviorSubject<Installment[]>;
  items$: BehaviorSubject<InstallmentItem[]>;
  accounts: Account[];
  parties: Party[];
}

/**
 * The seed's installment schedule, a period at a time, with what is written
 * kept in memory. A write is judged against the period's journal as
 * `entriesOf` answers it now; left out, the seed's entries. New installments
 * are `in-new-<n>` and new items `ii-new-<n>`. Throws on an unknown id: it
 * never answers empty for a wrong key.
 */
export function createInstallmentsSimulator(
  seed: LegacySeed,
  entriesOf: (periodId: string) => JournalEntry[] = (
    periodId: string,
  ): JournalEntry[] => {
    return seed.entries.filter((entry) => {
      return entry.periodId === periodId;
    });
  },
): InstallmentsSimulator {
  const periods = new Map<string, PeriodState>();
  let installmentsAdded = 0;
  let itemsAdded = 0;

  for (const building of seed.buildings) {
    for (const period of building.periods) {
      const schedule = seededSchedule(seed, period.id);

      periods.set(period.id, {
        periodId: period.id,
        installments$: new BehaviorSubject(ranked(schedule.installments)),
        items$: new BehaviorSubject(schedule.items),
        accounts: seed.accounts.filter((account) => {
          return account.periodId === period.id;
        }),
        parties:
          seed.parties.find((list) => {
            return list.periodId === period.id;
          })?.parties ?? [],
      });
    }
  }

  function stateOf(periodId: string): PeriodState {
    return must(periods.get(periodId), `the period ${periodId}`);
  }

  function holderOfInstallment(installmentId: string): PeriodState {
    for (const state of periods.values()) {
      if (
        state.installments$.getValue().some((installment) => {
          return installment.id === installmentId;
        })
      ) {
        return state;
      }
    }

    throw new Error(`missing: the installment ${installmentId}`);
  }

  function holderOfItem(itemId: string): PeriodState {
    for (const state of periods.values()) {
      if (
        state.items$.getValue().some((item) => {
          return item.id === itemId;
        })
      ) {
        return state;
      }
    }

    throw new Error(`missing: the installment item ${itemId}`);
  }

  function contextOf(state: PeriodState): ScheduleContext {
    const entries = entriesOf(state.periodId);

    return {
      installments: state.installments$.getValue(),
      items: state.items$.getValue(),
      entries,
      budgetFound: budgetSharesOf(entries, state.accounts).found,
    };
  }

  function create(state: PeriodState, draft: InstallmentsDraft): Result {
    const context = contextOf(state);
    const verdict = validateCreate(context, draft.installments);

    if (!verdict.ok) {
      return verdict;
    }

    const created = draft.installments.map((planned): Installment => {
      installmentsAdded += 1;

      return {
        id: `in-new-${installmentsAdded}`,
        periodId: state.periodId,
        number: 0,
        name: planned.name.trim(),
        dueDate: planned.dueDate,
        locked: false,
      };
    });

    const planned = planBudgetInstallments(
      planInputOf(draft, {
        accounts: state.accounts,
        parties: state.parties,
        entries: context.entries,
        installmentItems: context.items,
      }),
    );

    const items = planned.map((item): InstallmentItem => {
      itemsAdded += 1;

      return {
        id: `ii-new-${itemsAdded}`,
        installmentId: must(
          created[item.installmentIndex],
          `the planned installment ${item.installmentIndex}`,
        ).id,
        residentId: item.residentId,
        amount: item.amount,
      };
    });

    // The installments land before their items, so no reader sees an item name an installment it cannot find.
    state.installments$.next(ranked([...context.installments, ...created]));
    state.items$.next([...context.items, ...items]);

    return ok();
  }

  function update(
    state: PeriodState,
    installmentId: string,
    patch: InstallmentPatch,
  ): Result {
    const verdict = validateUpdate(contextOf(state), installmentId, patch);

    if (!verdict.ok) {
      return verdict;
    }

    state.installments$.next(
      ranked(
        state.installments$.getValue().map((installment) => {
          return installment.id === installmentId
            ? {
                ...installment,
                name: patch.name?.trim() ?? installment.name,
                dueDate: patch.dueDate ?? installment.dueDate,
                locked: patch.locked ?? installment.locked,
              }
            : installment;
        }),
      ),
    );

    return verdict;
  }

  function remove(state: PeriodState, installmentId: string): Result {
    const verdict = validateDelete(contextOf(state), installmentId);

    if (!verdict.ok) {
      return verdict;
    }

    // The items go before their installment, so no reader sees an item name an installment that is gone.
    state.items$.next(
      state.items$.getValue().filter((item) => {
        return item.installmentId !== installmentId;
      }),
    );
    state.installments$.next(
      ranked(
        state.installments$.getValue().filter((installment) => {
          return installment.id !== installmentId;
        }),
      ),
    );

    return verdict;
  }

  function setAmount(
    state: PeriodState,
    itemId: string,
    amount: Cents,
  ): Result {
    const verdict = validateItemAmount(contextOf(state), itemId, amount);

    if (!verdict.ok) {
      return verdict;
    }

    state.items$.next(
      state.items$.getValue().map((item) => {
        return item.id === itemId ? { ...item, amount } : item;
      }),
    );

    return verdict;
  }

  return {
    installments: (periodId: string): Observable<Installment[]> => {
      const state = periods.get(periodId);

      return state === undefined
        ? missingPeriod(periodId)
        : state.installments$.asObservable();
    },
    items: (periodId: string): Observable<InstallmentItem[]> => {
      const state = periods.get(periodId);

      return state === undefined
        ? missingPeriod(periodId)
        : state.items$.asObservable();
    },
    createInstallments: (
      periodId: string,
      draft: InstallmentsDraft,
    ): Promise<Result> => {
      // A throw inside the executor is a rejection, as the port promises.
      return new Promise((resolve) => {
        resolve(create(stateOf(periodId), draft));
      });
    },
    updateInstallment: (
      installmentId: string,
      patch: InstallmentPatch,
    ): Promise<Result> => {
      return new Promise((resolve) => {
        resolve(
          update(holderOfInstallment(installmentId), installmentId, patch),
        );
      });
    },
    deleteInstallment: (installmentId: string): Promise<Result> => {
      return new Promise((resolve) => {
        resolve(remove(holderOfInstallment(installmentId), installmentId));
      });
    },
    setItemAmount: (itemId: string, amount: Cents): Promise<Result> => {
      return new Promise((resolve) => {
        resolve(setAmount(holderOfItem(itemId), itemId, amount));
      });
    },
    current: (periodId: string): PeriodSchedule => {
      const state = stateOf(periodId);

      return {
        installments: state.installments$.getValue(),
        items: state.items$.getValue(),
      };
    },
  };
}

/** The seed's schedule of one period: what each simulator answers from when nothing else is wired in. */
export function seededSchedule(
  seed: LegacySeed,
  periodId: string,
): PeriodSchedule {
  const installments = seed.installments.filter((installment) => {
    return installment.periodId === periodId;
  });

  const ids = new Set(
    installments.map((installment) => {
      return installment.id;
    }),
  );

  return {
    installments,
    items: seed.installmentItems.filter((item) => {
      return ids.has(item.installmentId);
    }),
  };
}

/** In order of due date, then id, each numbered by its place: 1…n. */
function ranked(installments: Installment[]): Installment[] {
  return [...installments]
    .sort((a, b) => {
      return compareText(a.dueDate, b.dueDate) || compareText(a.id, b.id);
    })
    .map((installment, index) => {
      return { ...installment, number: index + 1 };
    });
}

function compareText(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  return a < b ? -1 : 1;
}
