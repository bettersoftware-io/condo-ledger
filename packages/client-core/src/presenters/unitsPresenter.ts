import { type DefaultedStateObservable, state } from "@rx-state/core";
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  map,
  type Observable,
  take,
} from "rxjs";

import {
  type Added,
  type AllocationBooks,
  allocationBooksOf,
  type Building,
  type ClockPort,
  type Contact,
  type ContactsPort,
  type GroupDraft,
  type OwnerParty,
  type OwnersRow,
  type PeriodDates,
  type ResidencyDraft,
  type Result,
  type ResultOf,
  type TablesPort,
  type Unit,
  type UnitDraft,
  type UnitGroup,
  type UnitsList,
  type UnitsPort,
  type UnitsRow,
  unitOwnersOf,
  unitsListOf,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import { todayOf } from "../today.ts";
import {
  type PeriodTables,
  periodOf,
  sourceOf,
} from "./allocationPresenter.ts";
import type { Books } from "./booksPresenter.ts";

/** The Units screen: the grid, its selected row, and what the bottom tabs show of it. */
export interface UnitsView {
  list: UnitsList;
  /** The row clicked, while the list holds it; else the first unit's row. Null only for a period with no unit. */
  selected: UnitsRow | null;
  /** The selected unit, or the selected resident's; null for the root, a group and the rounding row. */
  unit: Unit | null;
  /** The Unit Owners tab of `unit`; null with no unit. */
  owners: OwnersRow | null;
  /** Whether the period's opening entry is posted: the previous balances are then the journal's. */
  openingPosted: boolean;
}

/** The selected period's units, groups and residents as the Units screen stands, with its selection: what a dialog is built over. */
export interface UnitsSnapshot {
  period: PeriodDates;
  units: Unit[];
  groups: UnitGroup[];
  residents: OwnerParty[];
  selected: UnitsRow | null;
  openingPosted: boolean;
}

export interface UnitsPresenter {
  /** Null while there is no period, or while the units and tables ports have not answered for the books' period. */
  view$: DefaultedStateObservable<UnitsView | null>;
  /** The breadcrumb's last crumb: the selected unit's or resident's unit code, the selected group's code; null for the root and the rounding row. */
  crumb$: DefaultedStateObservable<string | null>;
  /** The contacts an owner can be linked to. */
  contacts$: DefaultedStateObservable<Contact[]>;
  /** The screen as it stands now; null while `view$` is. */
  snapshot: () => UnitsSnapshot | null;
  /** Selects a row of the list by its key. A period switch starts again on the first unit. */
  select: (key: string) => void;
  /** Adds a group to the books' period. Throws with no period. */
  addGroup: (
    parentId: string | null,
    draft: GroupDraft,
  ) => Promise<ResultOf<Added>>;
  editGroup: (groupId: string, draft: GroupDraft) => Promise<Result>;
  deleteGroup: (groupId: string) => Promise<Result>;
  /** Adds a unit to the books' period. Throws with no period. */
  addUnit: (
    groupId: string | null,
    draft: UnitDraft,
  ) => Promise<ResultOf<Added>>;
  editUnit: (unitId: string, draft: UnitDraft) => Promise<Result>;
  deleteUnit: (unitId: string) => Promise<Result>;
  addResident: (
    unitId: string,
    draft: ResidencyDraft,
  ) => Promise<ResultOf<Added>>;
  editResident: (residentId: string, draft: ResidencyDraft) => Promise<Result>;
  deleteResident: (residentId: string) => Promise<Result>;
}

export interface UnitsPresenterPorts {
  units: UnitsPort;
  tables: TablesPort;
  contacts: ContactsPort;
}

/**
 * The Units, Owners & Personal Balance screen: the selected period's Units
 * grid as of the clock's today, the selected row with its unit and owners,
 * and the writes. The books and the period's units and tables are read
 * together, as the allocation presenter reads them, so no emission mixes one
 * period's units with another's books; the residents are the books' parties,
 * so the allocation and the schedule behind the grid see the same ones, and
 * a unit and its residents are matched by the unit's id, never its code.
 * The selection lasts while the period does: another period, or the same
 * one again after another, starts on its first unit. `books$` is the
 * application's shared books, subscribed for its lifetime.
 */
export function createUnitsPresenter(
  books$: DefaultedStateObservable<Books | null>,
  tree$: Observable<Building[]>,
  ports: UnitsPresenterPorts,
  clock: ClockPort,
): UnitsPresenter {
  const chosen$ = new BehaviorSubject<Chosen>({ key: null, count: 0 });
  const listed$ = periodOf(books$, tree$, ports).pipe(
    map((period) => {
      return period === null ? null : listOf(period, todayOf(clock));
    }),
  );
  // The period the list last showed, and how many rows had been chosen when
  // it started showing it: a row chosen before then is another period's, or
  // the same period's before another came between.
  let shownPeriodId: string | null = null;
  let chosenBefore = 0;
  const scope$ = state(
    combineLatest([listed$, chosen$]).pipe(
      map(([listed, chosen]) => {
        if (listed === null) {
          return null;
        }

        const { periodId } = listed.period.books;

        if (periodId !== shownPeriodId) {
          shownPeriodId = periodId;
          chosenBefore = chosen.count;
        }

        return scopeOf(listed, chosen.count > chosenBefore ? chosen.key : null);
      }),
    ),
    null,
  );

  /** The books' period, for a write that adds to it. */
  function periodIdFor(what: string): string {
    return must(books$.getValue(), `the period of ${what}`).periodId;
  }

  return {
    view$: state(
      scope$.pipe(
        map((scope) => {
          return scope?.view ?? null;
        }),
      ),
      null,
    ),
    crumb$: state(
      scope$.pipe(
        map((scope) => {
          return scope?.crumb ?? null;
        }),
        distinctUntilChanged(),
      ),
      null,
    ),
    contacts$: state(ports.contacts.contacts(), []),
    snapshot: (): UnitsSnapshot | null => {
      let held: UnitsSnapshot | null = null;

      // The ports answer at once, so a first value arrives on subscribing.
      scope$.pipe(take(1)).subscribe((scope) => {
        held = scope?.snapshot ?? null;
      });

      return held;
    },
    select: (key: string): void => {
      chosen$.next({ key, count: chosen$.getValue().count + 1 });
    },
    addGroup: (
      parentId: string | null,
      draft: GroupDraft,
    ): Promise<ResultOf<Added>> => {
      return ports.units.addGroup(
        periodIdFor("the new group"),
        parentId,
        draft,
      );
    },
    editGroup: (groupId: string, draft: GroupDraft): Promise<Result> => {
      return ports.units.editGroup(groupId, draft);
    },
    deleteGroup: (groupId: string): Promise<Result> => {
      return ports.units.deleteGroup(groupId);
    },
    addUnit: (
      groupId: string | null,
      draft: UnitDraft,
    ): Promise<ResultOf<Added>> => {
      return ports.units.addUnit(periodIdFor("the new unit"), groupId, draft);
    },
    editUnit: (unitId: string, draft: UnitDraft): Promise<Result> => {
      return ports.units.editUnit(unitId, draft);
    },
    deleteUnit: (unitId: string): Promise<Result> => {
      return ports.units.deleteUnit(unitId);
    },
    addResident: (
      unitId: string,
      draft: ResidencyDraft,
    ): Promise<ResultOf<Added>> => {
      return ports.units.addResident(unitId, draft);
    },
    editResident: (
      residentId: string,
      draft: ResidencyDraft,
    ): Promise<Result> => {
      return ports.units.editResident(residentId, draft);
    },
    deleteResident: (residentId: string): Promise<Result> => {
      return ports.units.deleteResident(residentId);
    },
  };
}

/** The row clicked last, and how many have been clicked. */
interface Chosen {
  key: string | null;
  count: number;
}

/** A period's Units grid, with the allocation it was worked out from. */
interface Listed {
  period: PeriodTables;
  allocation: AllocationBooks;
  list: UnitsList;
}

/** What the screen shows, what a dialog is built over, and the crumb, from one emission. */
interface Scope {
  view: UnitsView;
  snapshot: UnitsSnapshot;
  crumb: string | null;
}

/** The allocation and the schedule both read the books' parties: one snapshot of the residents. */
function listOf(period: PeriodTables, today: string): Listed {
  const { books, units, groups, periodLabel } = period;
  const allocation = allocationBooksOf(sourceOf(period));

  return {
    period,
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

/** With no row chosen, or one the list no longer holds, the first unit is selected. */
function scopeOf(listed: Listed, key: string | null): Scope {
  const { period, allocation, list } = listed;
  const { books, units, groups } = period;
  const selected =
    (key === null ? undefined : findRow(list.root, key)) ??
    firstUnitRow(list.root) ??
    null;
  const unitId = selected?.unitId ?? null;
  const unit =
    unitId === null
      ? null
      : must(
          units.find((candidate) => {
            return candidate.id === unitId;
          }),
          `the unit ${unitId}`,
        );

  const openingPosted = books.entries.some((entry) => {
    return entry.kind === "openingBalances";
  });

  return {
    view: {
      list,
      selected,
      unit,
      owners: unit === null ? null : unitOwnersOf(unit, allocation.input),
      openingPosted,
    },
    snapshot: {
      period: books.period,
      units,
      groups,
      residents: books.parties.filter((party): party is OwnerParty => {
        return party.kind === "owner";
      }),
      selected,
      openingPosted,
    },
    crumb:
      selected?.kind === "group"
        ? (groups.find((group) => {
            return group.id === selected.groupId;
          })?.code ?? null)
        : (unit?.code ?? null),
  };
}

function findRow(row: UnitsRow, key: string): UnitsRow | undefined {
  if (row.key === key) {
    return row;
  }

  for (const child of row.children) {
    const found = findRow(child, key);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

/** The first unit's row, in the order the grid shows the rows. */
function firstUnitRow(row: UnitsRow): UnitsRow | undefined {
  if (row.kind === "unit") {
    return row;
  }

  for (const child of row.children) {
    const found = firstUnitRow(child);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}
