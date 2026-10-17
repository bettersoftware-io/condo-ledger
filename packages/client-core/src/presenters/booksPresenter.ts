import { type DefaultedStateObservable, state } from "@rx-state/core";
import {
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  type Observable,
  of,
  switchMap,
} from "rxjs";

import {
  type Account,
  type AccountNode,
  type AccountsPort,
  type Building,
  buildAccountTree,
  type Invoice,
  type JournalEntry,
  type JournalPort,
  type Party,
  type WithholdingTax,
} from "@cl/domain";

import type { PeriodSelection } from "./buildingsPresenter.ts";

/** The first and last day of a period, "YYYY-MM-DD", as the building tree has them. */
interface PeriodDates {
  start: string;
  end: string;
}

/** A period's raw books with the tree derived from them, read together so no screen sees a tree of one emission with the entries of another, nor an invoice whose registration the entries do not hold. */
export interface Books {
  periodId: string;
  period: PeriodDates;
  tree: AccountNode;
  accounts: Account[];
  parties: Party[];
  entries: JournalEntry[];
  invoices: Invoice[];
  withholdingTaxes: WithholdingTax[];
}

export interface BooksPresenterPorts {
  accounts: AccountsPort;
  journal: JournalPort;
}

export interface BooksPresenter {
  books$: DefaultedStateObservable<Books | null>;
}

/** The selected period, with its dates from the building tree. */
interface DatedPeriod {
  periodId: string;
  period: PeriodDates;
}

/** The selected period's books, shared by every screen that derives from them; null while the building tree does not hold the period. */
export function createBooksPresenter(
  ports: BooksPresenterPorts,
  selected$: Observable<PeriodSelection | null>,
  tree$: Observable<Building[]>,
): BooksPresenter {
  const dated$ = combineLatest([selected$, tree$]).pipe(
    map(([selection, tree]) => {
      return selection === null ? null : datedOf(tree, selection.periodId);
    }),
    distinctUntilChanged(sameDatedPeriod),
  );

  return {
    books$: state(
      dated$.pipe(
        switchMap((dated): Observable<Books | null> => {
          if (dated === null) {
            return of(null);
          }

          const { periodId, period } = dated;

          return combineLatest([
            ports.accounts.accounts(periodId),
            ports.accounts.parties(periodId),
            ports.accounts.withholdingTaxes(periodId),
            ports.journal.entries(periodId),
            ports.journal.invoices(periodId),
          ]).pipe(
            // The port writes a registration and its invoice one stream after the other: the half-written combination is skipped.
            filter(([, , , entries, invoices]) => {
              return agree(entries, invoices);
            }),
            map(([accounts, parties, withholdingTaxes, entries, invoices]) => {
              return {
                periodId,
                period,
                tree: buildAccountTree(accounts, entries, parties),
                accounts,
                parties,
                entries,
                invoices,
                withholdingTaxes,
              };
            }),
          );
        }),
      ),
      null,
    ),
  };
}

/** Every invoice's registration is among the entries, and every invoice an entry names is among the invoices. */
function agree(entries: JournalEntry[], invoices: Invoice[]): boolean {
  const entryIds = new Set(
    entries.map((entry) => {
      return entry.id;
    }),
  );

  const invoiceIds = new Set(
    invoices.map((invoice) => {
      return invoice.id;
    }),
  );

  return (
    invoices.every((invoice) => {
      return entryIds.has(invoice.entryId);
    }) &&
    entries.every((entry) => {
      return entry.invoiceId === null || invoiceIds.has(entry.invoiceId);
    })
  );
}

function datedOf(tree: Building[], periodId: string): DatedPeriod | null {
  for (const building of tree) {
    for (const period of building.periods) {
      if (period.id === periodId) {
        return { periodId, period: { start: period.start, end: period.end } };
      }
    }
  }

  return null;
}

function sameDatedPeriod(
  a: DatedPeriod | null,
  b: DatedPeriod | null,
): boolean {
  return (
    a?.periodId === b?.periodId &&
    a?.period.start === b?.period.start &&
    a?.period.end === b?.period.end
  );
}
