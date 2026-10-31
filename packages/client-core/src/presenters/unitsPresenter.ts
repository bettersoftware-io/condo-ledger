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
  validateGroupDelete,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import { todayOf } from "../today.ts";
import type { Books } from "./booksPresenter.ts";
import {
  type PeriodTables,
  type PeriodUnits,
  periodOf,
  periodUnitsOf,
} from "./periodTables.ts";

/** The Units screen: the grid, its selected row, and what the bottom tabs show of it. */
export interface UnitsView {
  list: UnitsList;
  /** The row clicked, while the list holds it; else the first unit's row. Null only for a period with no unit. */
  selected: UnitsRow | null;
  /** The selected unit, or the selected resident's; null for the root, a group and the rounding row. */
  unit: Unit | null;
  /** The selected group; null for every other row. */
  group: UnitGroup | null;
  /** Whether the selected group may be deleted (validateGroupDelete): it holds no unit and no group. False for every other row. */
  groupDeletable: boolean;
  /** The selected resident: on their own row, and on the row of a unit they live in alone; null otherwise. */
  resident: OwnerParty | null;
  /** Where `unit` stands: its groups' names, root to leaf, joined by " » "; blank at the top of the building, and with no unit. */
  location: string;
  /** The Unit Owners tab of `unit`; null with no unit. */
  owners: OwnersRow | null;
  /** Whether the period's opening entry is posted: the previous balances are then the journal's. */
  openingPosted: boolean;
  /** The period's dates, which a unit's and a resident's own dates must lie within. */
  period: PeriodDates;
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
  // the same period's before another came between. And the row last
  // selected in it, for a selection whose row the list no longer holds.
  let shownPeriodId: string | null = null;
  let chosenBefore = 0;
  let lastSelected: UnitsRow | null = null;
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
          lastSelected = null;
        }

        const scope = scopeOf(
          listed,
          chosen.count > chosenBefore ? chosen.key : null,
          lastSelected,
        );

        lastSelected = scope.view.selected;

        return scope;
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

      // It relies on ports that answer synchronously, so a first value arrives
      // on subscribing; in the app the grid's subscription keeps them hot.
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

/** A period's Units grid, with the period it was worked out from. */
interface Listed extends PeriodUnits {
  period: PeriodTables;
}

/** What the screen shows, what a dialog is built over, and the crumb, from one emission. */
interface Scope {
  view: UnitsView;
  snapshot: UnitsSnapshot;
  crumb: string | null;
}

function listOf(period: PeriodTables, today: string): Listed {
  return { period, ...periodUnitsOf(period, today) };
}

/**
 * The row chosen, while the list holds it. A resident's row folds into
 * their unit's when the unit is left with them alone, so the row that carries
 * the resident stands in for it. Failing that, the unit, then the group, of
 * the row last selected; with nothing chosen, or none of those, the first
 * unit.
 */
function scopeOf(
  listed: Listed,
  key: string | null,
  last: UnitsRow | null,
): Scope {
  const { period, allocation, list } = listed;
  const { books, units, groups } = period;
  const selected = selectedOf(list.root, key, last);
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

  const residents = books.parties.filter((party): party is OwnerParty => {
    return party.kind === "owner";
  });

  const group =
    selected?.kind === "group"
      ? must(
          groups.find((candidate) => {
            return candidate.id === selected.groupId;
          }),
          `the group ${String(selected.groupId)}`,
        )
      : null;
  const residentId = selected?.residentId ?? null;
  const resident =
    residentId === null
      ? null
      : must(
          residents.find((candidate) => {
            return candidate.id === residentId;
          }),
          `the resident ${residentId}`,
        );

  return {
    view: {
      list,
      selected,
      unit,
      group,
      groupDeletable:
        group !== null && validateGroupDelete(group.id, groups, units).ok,
      resident,
      location: unit === null ? "" : locationOf(unit, groups),
      owners: unit === null ? null : unitOwnersOf(unit, allocation.input),
      openingPosted,
      period: books.period,
    },
    snapshot: {
      period: books.period,
      units,
      groups,
      residents,
      selected,
      openingPosted,
    },
    crumb: group?.code ?? unit?.code ?? null,
  };
}

/** The unit's groups' names, from the top of the building down to its own. */
function locationOf(unit: Unit, groups: UnitGroup[]): string {
  const names: string[] = [];
  let groupId = unit.groupId;

  while (groupId !== null) {
    const id = groupId;
    const group = must(
      groups.find((candidate) => {
        return candidate.id === id;
      }),
      `the group ${id}`,
    );

    names.unshift(group.name);
    groupId = group.parentId;
  }

  return names.join(" » ");
}

function selectedOf(
  root: UnitsRow,
  key: string | null,
  last: UnitsRow | null,
): UnitsRow | null {
  if (key !== null) {
    const kept =
      rowKeyed(root, key) ??
      rowOfResident(root, key) ??
      (last === null ? undefined : rowNear(root, last));

    if (kept !== undefined) {
      return kept;
    }
  }

  return firstRow(root, isUnitRow) ?? null;
}

/** The unit's row of the row last selected, else its group's. */
function rowNear(root: UnitsRow, last: UnitsRow): UnitsRow | undefined {
  const { unitId, groupId } = last;

  return (
    (unitId === null ? undefined : rowKeyed(root, `unit:${unitId}`)) ??
    (groupId === null ? undefined : rowKeyed(root, `group:${groupId}`))
  );
}

/** For a resident's key, the row that carries the resident: theirs, or their unit's once they live there alone. */
function rowOfResident(root: UnitsRow, key: string): UnitsRow | undefined {
  if (!key.startsWith(RESIDENT)) {
    return undefined;
  }

  const residentId = key.slice(RESIDENT.length);

  return firstRow(root, (row) => {
    return row.residentId === residentId;
  });
}

const RESIDENT = "resident:";

function rowKeyed(root: UnitsRow, key: string): UnitsRow | undefined {
  return firstRow(root, (row) => {
    return row.key === key;
  });
}

function isUnitRow(row: UnitsRow): boolean {
  return row.kind === "unit";
}

/** The first row that matches, in the order the grid shows the rows. */
function firstRow(
  row: UnitsRow,
  matches: (row: UnitsRow) => boolean,
): UnitsRow | undefined {
  if (matches(row)) {
    return row;
  }

  for (const child of row.children) {
    const found = firstRow(child, matches);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}
