import { type DefaultedStateObservable, state } from "@rx-state/core";
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  map,
  type Observable,
  of,
  startWith,
  switchMap,
  take,
} from "rxjs";

import {
  type Building,
  type BuildingDraft,
  type BuildingRow,
  type BuildingsPort,
  buildingRowsOf,
  type ClockPort,
  type Contact,
  type ContactsPort,
  type OwnerParty,
  type Period,
  type PeriodDraft,
  type PeriodFigures,
  periodFiguresOf,
  type Result,
  type Unit,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import { todayOf } from "../today.ts";
import type {
  BuildingsPresenter,
  PeriodSelection,
} from "./buildingsPresenter.ts";
import {
  type PeriodPorts,
  type PeriodTables,
  periodTablesOf,
  periodUnitsOf,
} from "./periodTables.ts";

/** The Building Data & Suppliers screen: the grid, its selected row, and the building the bottom tabs show. */
export interface BuildingDataView {
  rows: BuildingRow[];
  /** The row clicked, until the sidebar's period changes; else the app's period's row. Null with no building. */
  selected: BuildingRow | null;
  /** The selected row's building. */
  building: Building | null;
  /** The building's suppliers, by category, then name. */
  suppliers: Contact[];
  /** The supplier clicked, while the building has it; else its first. */
  supplier: Contact | null;
}

/** What the Edit Management / Period dialog is judged against. */
interface PeriodContext {
  building: Building;
  period: Period;
  units: Unit[];
  residents: OwnerParty[];
}

export interface BuildingDataPresenter {
  view$: DefaultedStateObservable<BuildingDataView>;
  /** Selects a row by its key; a period's row also makes it the app's period. */
  select: (key: string) => void;
  selectSupplier: (contactId: string) => void;
  editBuilding: (buildingId: string, draft: BuildingDraft) => Promise<Result>;
  editPeriod: (periodId: string, draft: PeriodDraft) => Promise<Result>;
  /** The period with its building, units and residents as they stand; throws for a period the tree does not hold. */
  periodContext: (periodId: string) => PeriodContext;
}

export interface BuildingDataPresenterPorts extends PeriodPorts {
  buildings: BuildingsPort;
  contacts: ContactsPort;
}

/**
 * The Building Data & Suppliers screen. Each period's figures are worked
 * out from that period's own books, tables and units, read from the ports
 * as the Units screen reads the selected period's, as of the clock's today;
 * a period's row has none until they are. While the screen is shown, one
 * set of those streams per period stays subscribed. The selection starts on
 * the app's period's row and moves with the sidebar; a row clicked holds
 * until the sidebar's period changes. `buildings` is the application's
 * sidebar, whose tree is subscribed for the application's life.
 */
export function createBuildingDataPresenter(
  ports: BuildingDataPresenterPorts,
  buildings: BuildingsPresenter,
  clock: ClockPort,
): BuildingDataPresenter {
  const { tree$, selected$ } = buildings;
  const chosen$ = new BehaviorSubject<Chosen>({ key: null, count: 0 });
  const chosenSupplier$ = new BehaviorSubject<string | null>(null);
  const rows$ = combineLatest([tree$, figuresOf(ports, tree$, clock)]).pipe(
    map(([tree, figures]) => {
      return buildingRowsOf(tree, figures);
    }),
  );

  // The sidebar's period as the selection last saw it, and how many rows had
  // been chosen then: a row chosen before is the sidebar's to replace.
  let seenPeriodId: string | null = null;
  let chosenBefore = 0;
  const scope$ = state(
    combineLatest([rows$, tree$, selected$, chosen$]).pipe(
      map(([rows, tree, selection, chosen]): Scope => {
        const periodId = selection?.periodId ?? null;

        if (periodId !== seenPeriodId) {
          seenPeriodId = periodId;
          chosenBefore = chosen.count;
        }

        return scopeOf(
          rows,
          tree,
          selection,
          chosen.count > chosenBefore ? chosen.key : null,
        );
      }),
    ),
  );

  // Read again only when the selected row's building changes.
  const suppliers$ = scope$.pipe(
    map((scope) => {
      return scope.building?.id ?? null;
    }),
    distinctUntilChanged(),
    switchMap((buildingId): Observable<HeldSuppliers> => {
      return buildingId === null
        ? of({ buildingId, suppliers: [] })
        : suppliersOf(ports, buildingId).pipe(
            map((suppliers) => {
              return { buildingId, suppliers };
            }),
          );
    }),
  );

  const view$ = combineLatest([scope$, suppliers$, chosenSupplier$]).pipe(
    map(([scope, held, contactId]): BuildingDataView => {
      // Until the new building's suppliers come, it shows none.
      const suppliers =
        held.buildingId === (scope.building?.id ?? null) ? held.suppliers : [];

      return {
        ...scope,
        suppliers,
        supplier:
          suppliers.find((supplier) => {
            return supplier.id === contactId;
          }) ??
          suppliers[0] ??
          null,
      };
    }),
  );

  return {
    view$: state(view$, EMPTY_VIEW),
    select: (key: string): void => {
      chosen$.next({ key, count: chosen$.getValue().count + 1 });

      if (periodOf(tree$.getValue(), key) !== null) {
        buildings.selectPeriod(key);
      }
    },
    selectSupplier: (contactId: string): void => {
      chosenSupplier$.next(contactId);
    },
    editBuilding: (
      buildingId: string,
      draft: BuildingDraft,
    ): Promise<Result> => {
      return ports.buildings.editBuilding(buildingId, draft);
    },
    editPeriod: (periodId: string, draft: PeriodDraft): Promise<Result> => {
      return ports.buildings.editPeriod(periodId, draft);
    },
    periodContext: (periodId: string): PeriodContext => {
      const held = must(
        periodOf(tree$.getValue(), periodId),
        `the period ${periodId}`,
      );

      return {
        ...held,
        units: current(ports.units.units(periodId), `the units of ${periodId}`),
        residents: current(
          ports.units.residents(periodId),
          `the residents of ${periodId}`,
        ),
      };
    },
  };
}

/** The row clicked last, and how many have been clicked. */
interface Chosen {
  key: string | null;
  count: number;
}

/** The view without its suppliers. */
interface Scope {
  rows: BuildingRow[];
  selected: BuildingRow | null;
  building: Building | null;
}

/** A period with its building. */
interface HeldPeriod {
  building: Building;
  period: Period;
}

const EMPTY_VIEW: BuildingDataView = {
  rows: [],
  selected: null,
  building: null,
  suppliers: [],
  supplier: null,
};

/**
 * Every period's figures, by period id, from one set of streams per period
 * of the tree: a period added or removed starts or stops its own. A period
 * is left out until its figures are worked out.
 */
function figuresOf(
  ports: PeriodPorts,
  tree$: Observable<Building[]>,
  clock: ClockPort,
): Observable<Map<string, PeriodFigures>> {
  return tree$.pipe(
    map(periodIdsOf),
    distinctUntilChanged(sameIds),
    switchMap((periodIds): Observable<Map<string, PeriodFigures>> => {
      if (periodIds.length === 0) {
        return of(new Map());
      }

      return combineLatest(
        periodIds.map((periodId) => {
          return periodTablesOf(ports, periodId, tree$).pipe(
            map((period): FiguresEntry => {
              return [
                periodId,
                period === null ? null : periodFigures(period, clock),
              ];
            }),
            startWith<FiguresEntry>([periodId, null]),
          );
        }),
      ).pipe(map(figuresMap));
    }),
  );
}

type FiguresEntry = [string, PeriodFigures | null];

function periodFigures(period: PeriodTables, clock: ClockPort): PeriodFigures {
  const { list } = periodUnitsOf(period, todayOf(clock));

  return periodFiguresOf(list, period.books.tree, period.books.accounts);
}

function figuresMap(entries: FiguresEntry[]): Map<string, PeriodFigures> {
  const figures = new Map<string, PeriodFigures>();

  for (const [periodId, held] of entries) {
    if (held !== null) {
      figures.set(periodId, held);
    }
  }

  return figures;
}

function periodIdsOf(tree: Building[]): string[] {
  return tree.flatMap((building) => {
    return building.periods.map((period) => {
      return period.id;
    });
  });
}

function sameIds(a: string[], b: string[]): boolean {
  return (
    a.length === b.length &&
    a.every((id, index) => {
      return id === b[index];
    })
  );
}

/** The row chosen, while the rows hold it; else the app's period's row. */
function scopeOf(
  rows: BuildingRow[],
  tree: Building[],
  selection: PeriodSelection | null,
  key: string | null,
): Scope {
  const selected =
    (key === null ? undefined : rowKeyed(rows, key)) ??
    (selection === null ? undefined : rowKeyed(rows, selection.periodId)) ??
    null;

  return {
    rows,
    selected,
    building:
      selected === null
        ? null
        : must(
            tree.find((building) => {
              return building.id === selected.buildingId;
            }),
            `the building ${selected.buildingId}`,
          ),
  };
}

function rowKeyed(rows: BuildingRow[], key: string): BuildingRow | undefined {
  for (const row of rows) {
    if (row.key === key) {
      return row;
    }

    const child = rowKeyed(row.children, key);

    if (child !== undefined) {
      return child;
    }
  }

  return undefined;
}

/** A building's suppliers, with the building they were read for. */
interface HeldSuppliers {
  buildingId: string | null;
  suppliers: Contact[];
}

/** The building's supplier contacts, by category (none last), then name. */
function suppliersOf(
  ports: BuildingDataPresenterPorts,
  buildingId: string,
): Observable<Contact[]> {
  return combineLatest([
    ports.buildings.suppliers(buildingId),
    ports.contacts.contacts(),
  ]).pipe(
    map(([contactIds, contacts]) => {
      const ids = new Set(contactIds);

      return contacts
        .filter((contact) => {
          return ids.has(contact.id);
        })
        .sort(byCategoryThenName);
    }),
  );
}

function byCategoryThenName(a: Contact, b: Contact): number {
  if (a.category !== b.category) {
    if (a.category === null) {
      return 1;
    }

    if (b.category === null) {
      return -1;
    }

    return a.category.localeCompare(b.category, "it");
  }

  return a.name.localeCompare(b.name, "it");
}

function periodOf(tree: Building[], periodId: string): HeldPeriod | null {
  for (const building of tree) {
    for (const period of building.periods) {
      if (period.id === periodId) {
        return { building, period };
      }
    }
  }

  return null;
}

/** The value a port holds now: it relies on ports that answer on subscribing, as the simulators do. */
function current<T>(read$: Observable<T>, what: string): T {
  const held: T[] = [];

  read$.pipe(take(1)).subscribe((value) => {
    held.push(value);
  });

  return must(held[0], what);
}
