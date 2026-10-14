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
  type Account,
  type AccountNode,
  type AccountsPort,
  buildAccountTree,
  type JournalEntry,
  type JournalPort,
  type Party,
} from "@cl/domain";

import type { PeriodSelection } from "./buildingsPresenter.ts";

/** A period's raw books with the tree derived from them, read together so no screen sees a tree of one emission with the entries of another. */
export interface Books {
  periodId: string;
  tree: AccountNode;
  accounts: Account[];
  parties: Party[];
  entries: JournalEntry[];
}

export interface BooksPresenterPorts {
  accounts: AccountsPort;
  journal: JournalPort;
}

export interface BooksPresenter {
  books$: DefaultedStateObservable<Books | null>;
}

/** The selected period's books, shared by every screen that derives from them. */
export function createBooksPresenter(
  ports: BooksPresenterPorts,
  selected$: Observable<PeriodSelection | null>,
): BooksPresenter {
  const periodId$ = selected$.pipe(
    map((selection) => {
      return selection?.periodId ?? null;
    }),
    distinctUntilChanged(),
  );

  return {
    books$: state(
      periodId$.pipe(
        switchMap((periodId): Observable<Books | null> => {
          if (periodId === null) {
            return of(null);
          }

          return combineLatest([
            ports.accounts.accounts(periodId),
            ports.accounts.parties(periodId),
            ports.journal.entries(periodId),
          ]).pipe(
            map(([accounts, parties, entries]) => {
              return {
                periodId,
                tree: buildAccountTree(accounts, entries, parties),
                accounts,
                parties,
                entries,
              };
            }),
          );
        }),
      ),
      null,
    ),
  };
}
