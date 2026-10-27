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
  type Allocation,
  type AllocationBooks,
  type AllocationMode,
  type AllocationSource,
  allocationBooksOf,
  allocationOf,
  type Building,
  type Coefficient,
  type CoefficientNode,
  coefficientsTreeOf,
  type Result,
  type ResultOf,
  rejected,
  type TableAdded,
  type TableDraft,
  type TablesPort,
  type ThousandthTable,
  tableTotalsOf,
  type Unit,
  type UnitGroup,
  type UnitsPort,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import { type AmountLocaleSource, parseTenThousandths } from "../amounts.ts";
import type { Books } from "./booksPresenter.ts";
import { periodLabelOf } from "./buildingsPresenter.ts";

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

/** One period's books, its label, and its tables and units, as one value. */
interface PeriodTables {
  books: Books;
  periodLabel: string;
  tables: ThousandthTable[];
  coefficients: Coefficient[];
  units: Unit[];
  groups: UnitGroup[];
}

/** What the tables and units ports hold for a period. */
interface PortTables {
  periodId: string;
  tables: ThousandthTable[];
  coefficients: Coefficient[];
  units: Unit[];
  groups: UnitGroup[];
}

/**
 * The books with the same period's tables and units: a pair of two periods,
 * while the ports catch up with a switch, is skipped. Null with no books, or
 * while the tree does not hold their period.
 */
function periodOf(
  books$: Observable<Books | null>,
  tree$: Observable<Building[]>,
  ports: AllocationPresenterPorts,
): Observable<PeriodTables | null> {
  const portTables$ = books$.pipe(
    map((books) => {
      return books?.periodId ?? null;
    }),
    distinctUntilChanged(),
    switchMap((periodId): Observable<PortTables | null> => {
      return periodId === null ? of(null) : portTablesOf(periodId, ports);
    }),
  );

  return combineLatest([books$, portTables$, tree$]).pipe(
    filter(([books, held]) => {
      return books?.periodId === held?.periodId;
    }),
    map(([books, held, tree]) => {
      const periodLabel =
        books === null ? null : periodLabelOf(tree, books.periodId);

      return books === null || held === null || periodLabel === null
        ? null
        : { ...held, books, periodLabel };
    }),
  );
}

function portTablesOf(
  periodId: string,
  ports: AllocationPresenterPorts,
): Observable<PortTables> {
  return combineLatest([
    ports.tables.tables(periodId),
    ports.tables.coefficients(periodId),
    ports.units.units(periodId),
    ports.units.groups(periodId),
  ]).pipe(
    map(([tables, coefficients, units, groups]) => {
      return { periodId, tables, coefficients, units, groups };
    }),
  );
}

function sourceOf(period: PeriodTables): AllocationSource {
  const { books } = period;

  return {
    periodLabel: period.periodLabel,
    period: books.period,
    accounts: books.accounts,
    parties: books.parties,
    entries: books.entries,
    tables: period.tables,
    coefficients: period.coefficients,
    units: period.units,
    groups: period.groups,
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
