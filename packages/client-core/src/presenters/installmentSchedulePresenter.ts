import { type DefaultedStateObservable, state } from "@rx-state/core";
import { combineLatest, map, type Observable } from "rxjs";

import {
  type Building,
  budgetSharesOf,
  type Cents,
  type ClockPort,
  type InstallmentPatch,
  type InstallmentsPort,
  type Result,
  rejected,
  type Schedule,
  type ScheduleContext,
  scheduleOf,
  validateItemAmount,
} from "@cl/domain";

import { todayOf } from "../today.ts";
import type { Books } from "./booksPresenter.ts";

export interface InstallmentSchedulePresenter {
  schedule$: DefaultedStateObservable<Schedule | null>;
  /** Whether the item's amount may be edited: its current amount judged over the books as they stand. */
  cellEditable: (itemId: string) => Result;
  updateInstallment: (id: string, patch: InstallmentPatch) => Promise<Result>;
  deleteInstallment: (id: string) => Promise<Result>;
  setItemAmount: (itemId: string, amount: Cents) => Promise<Result>;
}

/**
 * The Installment Schedule screen: the tree of the selected period's books
 * with today's date from the clock, and the writes. The root row is labelled
 * with the building's and the period's names, as the breadcrumb shows them.
 * `books$` is the application's shared books, subscribed for its lifetime.
 */
export function createInstallmentSchedulePresenter(
  books$: DefaultedStateObservable<Books | null>,
  tree$: Observable<Building[]>,
  port: InstallmentsPort,
  clock: ClockPort,
): InstallmentSchedulePresenter {
  return {
    schedule$: state(
      combineLatest([books$, tree$]).pipe(
        map(([books, tree]) => {
          // books$ derives from tree$, so for a moment the tree can lack the
          // books' period: no schedule then, as books$ is about to say.
          const periodLabel =
            books === null ? null : labelOf(tree, books.periodId);

          return books === null || periodLabel === null
            ? null
            : scheduleOf(
                {
                  periodLabel,
                  period: books.period,
                  accounts: books.accounts,
                  parties: books.parties,
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
    cellEditable: (itemId: string): Result => {
      const books = books$.getValue();
      const item = books?.installmentItems.find((candidate) => {
        return candidate.id === itemId;
      });

      if (books === null) {
        return rejected("no-books");
      }

      return item === undefined
        ? rejected("unknown-item")
        : validateItemAmount(contextOf(books), itemId, item.amount);
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

function contextOf(books: Books): ScheduleContext {
  return {
    installments: books.installments,
    items: books.installmentItems,
    entries: books.entries,
    budgetFound: budgetSharesOf(books.entries, books.accounts).found,
  };
}

/** "{building} {period}" of the period; null when the tree does not hold it. */
function labelOf(tree: Building[], periodId: string): string | null {
  for (const building of tree) {
    for (const period of building.periods) {
      if (period.id === periodId) {
        return `${building.name} ${period.name}`;
      }
    }
  }

  return null;
}
