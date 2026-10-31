import {
  combineLatest,
  distinctUntilChanged,
  map,
  type Observable,
  of,
  shareReplay,
  switchMap,
} from "rxjs";

import {
  type AllocationBooks,
  type AllocationSource,
  allocationBooksOf,
  type Building,
  type Coefficient,
  type TablesPort,
  type ThousandthTable,
  type Unit,
  type UnitGroup,
  type UnitsList,
  type UnitsPort,
  unitsListOf,
} from "@cl/domain";

import {
  type Books,
  type BooksPresenterPorts,
  datedBooksOf,
} from "./booksPresenter.ts";
import { periodLabelOf } from "./buildingsPresenter.ts";

/** The ports a period's tables and units are read from. */
interface PeriodTablesPorts {
  tables: TablesPort;
  units: UnitsPort;
}

/** One period's books, its label, and its tables and units, as one value. */
export interface PeriodTables {
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
 * The books with the same period's tables and units. Null while the ports
 * have not answered for the books' period (they may answer late, or still
 * hold the previous one), so no reader keeps the old period's values under
 * the new period. Null too with no books, or while the tree does not hold
 * their period.
 */
export function periodOf(
  books$: Observable<Books | null>,
  tree$: Observable<Building[]>,
  ports: PeriodTablesPorts,
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
    map(([books, held, tree]) => {
      // The ports still hold the previous period, or have not answered yet.
      if (books === null || held?.periodId !== books.periodId) {
        return null;
      }

      const periodLabel = periodLabelOf(tree, books.periodId);

      return periodLabel === null ? null : { ...held, books, periodLabel };
    }),
  );
}

/** The ports one period's books, tables and units are read from. */
export interface PeriodPorts extends BooksPresenterPorts, PeriodTablesPorts {}

/**
 * One period's books with its tables and units, read for that period alone,
 * with its dates and label as the tree has them: what a screen over every
 * period reads for each. Null as `periodOf` is.
 */
export function periodTablesOf(
  ports: PeriodPorts,
  periodId: string,
  tree$: Observable<Building[]>,
): Observable<PeriodTables | null> {
  // periodOf reads the books twice: one read of the ports serves both.
  const books$ = datedBooksOf(ports, of(periodId), tree$).pipe(
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  return periodOf(books$, tree$, ports);
}

function portTablesOf(
  periodId: string,
  ports: PeriodTablesPorts,
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

/** The period as the allocation reads it. */
export function sourceOf(period: PeriodTables): AllocationSource {
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

/** A period's Units grid, with the allocation it was worked out from. */
export interface PeriodUnits {
  allocation: AllocationBooks;
  list: UnitsList;
}

/** The allocation and the schedule both read the books' parties: one snapshot of the residents. */
export function periodUnitsOf(
  period: PeriodTables,
  today: string,
): PeriodUnits {
  const { books, units, groups, periodLabel } = period;
  const allocation = allocationBooksOf(sourceOf(period));

  return {
    allocation,
    list: unitsListOf(
      {
        allocation,
        schedule: {
          periodLabel,
          period: books.period,
          accounts: books.accounts,
          parties: books.parties,
          units,
          groups,
          entries: books.entries,
          installments: books.installments,
          installmentItems: books.installmentItems,
        },
        units,
        groups,
        buildingLabel: periodLabel,
      },
      today,
    ),
  };
}
