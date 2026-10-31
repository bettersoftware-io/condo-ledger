import { type DefaultedStateObservable, state } from "@rx-state/core";
import {
  combineLatest,
  distinctUntilChanged,
  map,
  type Observable,
  of,
  switchMap,
} from "rxjs";

import {
  type Building,
  budgetSharesOf,
  type Cents,
  type ClockPort,
  type InstallmentPatch,
  type InstallmentsDraft,
  type InstallmentsPort,
  type Result,
  type Schedule,
  type ScheduleContext,
  scheduleOf,
  type Unit,
  type UnitGroup,
  type UnitsPort,
} from "@cl/domain";

import { todayOf } from "../today.ts";
import type { Books } from "./booksPresenter.ts";
import { periodLabelOf } from "./buildingsPresenter.ts";

export interface InstallmentSchedulePresenter {
  /** Each resident cell says whether its item's amount may be edited (`ScheduleCell.editable`). */
  schedule$: DefaultedStateObservable<Schedule | null>;
  createInstallments: (
    periodId: string,
    draft: InstallmentsDraft,
  ) => Promise<Result>;
  updateInstallment: (id: string, patch: InstallmentPatch) => Promise<Result>;
  deleteInstallment: (id: string) => Promise<Result>;
  setItemAmount: (itemId: string, amount: Cents) => Promise<Result>;
}

/**
 * The Installment Schedule screen: the tree of the selected period's books
 * with today's date from the clock, and the writes. The root row is labelled
 * with the building's and the period's names and the building's address.
 * `books$` is the application's shared books, subscribed for its lifetime.
 */
export function createInstallmentSchedulePresenter(
  books$: DefaultedStateObservable<Books | null>,
  tree$: Observable<Building[]>,
  port: InstallmentsPort,
  clock: ClockPort,
  units: UnitsPort,
): InstallmentSchedulePresenter {
  return {
    schedule$: state(
      combineLatest([books$, tree$, unitsOf(books$, units)]).pipe(
        map(([books, tree, held]) => {
          // books$ derives from tree$, so for a moment the tree can lack the
          // books' period; the units port may still hold the previous period
          // or not have answered: no schedule then, as books$ is about to say.
          if (books === null || held?.periodId !== books.periodId) {
            return null;
          }

          const periodLabel = periodLabelOf(tree, books.periodId);

          return periodLabel === null
            ? null
            : scheduleOf(
                {
                  periodLabel,
                  period: books.period,
                  accounts: books.accounts,
                  parties: books.parties,
                  units: held.units,
                  groups: held.groups,
                  entries: books.entries,
                  installments: books.installments,
                  installmentItems: books.installmentItems,
                },
                todayOf(clock),
              );
        }),
      ),
      null,
    ),
    createInstallments: (
      periodId: string,
      draft: InstallmentsDraft,
    ): Promise<Result> => {
      return port.createInstallments(periodId, draft);
    },
    updateInstallment: (
      id: string,
      patch: InstallmentPatch,
    ): Promise<Result> => {
      return port.updateInstallment(id, patch);
    },
    deleteInstallment: (id: string): Promise<Result> => {
      return port.deleteInstallment(id);
    },
    setItemAmount: (itemId: string, amount: Cents): Promise<Result> => {
      return port.setItemAmount(itemId, amount);
    },
  };
}

/** The units and groups a period holds, with the period they are of. */
interface PeriodUnits {
  periodId: string;
  units: Unit[];
  groups: UnitGroup[];
}

/** The units port's answer for the books' period; null with no books. */
function unitsOf(
  books$: Observable<Books | null>,
  port: UnitsPort,
): Observable<PeriodUnits | null> {
  return books$.pipe(
    map((books) => {
      return books?.periodId ?? null;
    }),
    distinctUntilChanged(),
    switchMap((periodId): Observable<PeriodUnits | null> => {
      return periodId === null
        ? of(null)
        : combineLatest([port.units(periodId), port.groups(periodId)]).pipe(
            map(([units, groups]) => {
              return { periodId, units, groups };
            }),
          );
    }),
  );
}

/** What a schedule write in the books' period is judged against. */
export function scheduleContextOf(books: Books): ScheduleContext {
  return {
    installments: books.installments,
    items: books.installmentItems,
    entries: books.entries,
    budgetFound: budgetSharesOf(books.entries, books.accounts).found,
  };
}
