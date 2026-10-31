import { type DefaultedStateObservable, state } from "@rx-state/core";
import { map, type Observable } from "rxjs";

import {
  type Allocation,
  type AllocationBooks,
  type AllocationMode,
  allocationBooksOf,
  allocationOf,
  type Building,
  type CoefficientNode,
  coefficientsTreeOf,
  findNode,
  pathOf,
  type Result,
  type ResultOf,
  rejected,
  type TableAdded,
  type TableDraft,
  type TablesPort,
  type ThousandthTable,
  tableTotalsOf,
  type UnitsPort,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import { type AmountLocaleSource, parseTenThousandths } from "../amounts.ts";
import type { Books } from "./booksPresenter.ts";
import { type PeriodTables, periodOf, sourceOf } from "./periodTables.ts";

/** A row of the Thousandth Tables panel. */
export interface TableView {
  table: ThousandthTable;
  /** The sum of its coefficients, in ten-thousandths. */
  total: number;
  /** The name of the group the coefficients tree is limited to; blank for none. */
  restriction: string;
}

export interface AllocationPresenter {
  /** The selected period's tables, in order. */
  tables$: DefaultedStateObservable<TableView[]>;
  /** The selected period's allocation in the mode; one stream per mode. Null while there is no period. */
  allocation$: (
    mode: AllocationMode,
  ) => DefaultedStateObservable<Allocation | null>;
  /** The table's coefficients tree in the selected period; one stream per table. Empty for no table, or one the period does not hold. */
  coefficients$: (
    tableId: string | null,
  ) => DefaultedStateObservable<CoefficientNode[]>;
  /** Adds a table to the selected period. Throws with no period. */
  addTable: (draft: TableDraft) => Promise<ResultOf<TableAdded>>;
  editTable: (id: string, draft: TableDraft) => Promise<Result>;
  deleteTable: (id: string) => Promise<Result>;
  /** The account's path in the selected period's books, as a refusal names it ("Total › … › name"); its id when the books do not hold it. */
  accountPath: (accountId: string) => string;
  /** Reads the text in the session's locale; text that does not read is refused `not-a-coefficient` without a write. */
  setCoefficient: (
    tableId: string,
    unitId: string,
    text: string,
  ) => Promise<Result>;
}

export interface AllocationPresenterPorts {
  tables: TablesPort;
  units: UnitsPort;
}

/**
 * The Thousandth Tables & Allocation screen: the selected period's tables,
 * their coefficients and the allocation, and the writes. The books and the
 * period's tables and units are read together: no emission mixes one
 * period's tables with another period's books. A saved coefficient re-emits
 * through the port, so the totals, the trees and the allocation follow.
 */
export function createAllocationPresenter(
  books$: DefaultedStateObservable<Books | null>,
  tree$: Observable<Building[]>,
  ports: AllocationPresenterPorts,
  locale$: AmountLocaleSource,
): AllocationPresenter {
  const period$ = state(periodOf(books$, tree$, ports), null);
  const allocationBooks$ = state(
    period$.pipe(
      map((period) => {
        return period === null ? null : allocationBooksOf(sourceOf(period));
      }),
    ),
    null,
  );

  const allocations = new Map<
    AllocationMode,
    DefaultedStateObservable<Allocation | null>
  >();

  const trees = new Map<
    string | null,
    DefaultedStateObservable<CoefficientNode[]>
  >();

  return {
    tables$: state(
      period$.pipe(
        map((period) => {
          return period === null ? [] : tableViewsOf(period);
        }),
      ),
      [],
    ),
    allocation$: (
      mode: AllocationMode,
    ): DefaultedStateObservable<Allocation | null> => {
      return memoized(allocations, mode, () => {
        return state(allocationOfMode(allocationBooks$, mode), null);
      });
    },
    coefficients$: (
      tableId: string | null,
    ): DefaultedStateObservable<CoefficientNode[]> => {
      return memoized(trees, tableId, () => {
        return state(treeOfTable(period$, tableId), []);
      });
    },
    addTable: (draft: TableDraft): Promise<ResultOf<TableAdded>> => {
      const books = must(books$.getValue(), "the period of the new table");

      return ports.tables.addTable(books.periodId, draft);
    },
    editTable: (id: string, draft: TableDraft): Promise<Result> => {
      return ports.tables.editTable(id, draft);
    },
    deleteTable: (id: string): Promise<Result> => {
      return ports.tables.deleteTable(id);
    },
    accountPath: (accountId: string): string => {
      const tree = books$.getValue()?.tree;

      return tree === undefined || findNode(tree, accountId) === undefined
        ? accountId
        : pathOf(tree, accountId);
    },
    setCoefficient: (
      tableId: string,
      unitId: string,
      text: string,
    ): Promise<Result> => {
      const value = parseTenThousandths(text, locale$.getValue());

      return value === null
        ? Promise.resolve(rejected("not-a-coefficient"))
        : ports.tables.setCoefficient(tableId, unitId, value);
    },
  };
}

function tableViewsOf(period: PeriodTables): TableView[] {
  const totals = tableTotalsOf(period.coefficients, period.tables);

  return period.tables.map((table) => {
    return {
      table,
      total: totals.get(table.id) ?? 0,
      restriction:
        period.groups.find((group) => {
          return group.id === table.restrictionGroupId;
        })?.name ?? "",
    };
  });
}

function allocationOfMode(
  books$: Observable<AllocationBooks | null>,
  mode: AllocationMode,
): Observable<Allocation | null> {
  return books$.pipe(
    map((books) => {
      return books === null ? null : allocationOf(books, mode);
    }),
  );
}

function treeOfTable(
  period$: Observable<PeriodTables | null>,
  tableId: string | null,
): Observable<CoefficientNode[]> {
  return period$.pipe(
    map((period) => {
      const table = period?.tables.find((candidate) => {
        return candidate.id === tableId;
      });

      return period === null || table === undefined
        ? []
        : coefficientsTreeOf(
            table,
            period.units,
            period.groups,
            period.coefficients,
            period.books.parties.filter((party) => {
              return party.kind === "owner";
            }),
          );
    }),
  );
}

/** The value kept for the key, made the first time the key is asked for. */
function memoized<TKey, TValue>(
  cache: Map<TKey, TValue>,
  key: TKey,
  make: () => TValue,
): TValue {
  const known = cache.get(key);

  if (known !== undefined) {
    return known;
  }

  const made = make();

  cache.set(key, made);

  return made;
}
