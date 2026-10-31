import { addressTextOf } from "#/entities/address.ts";
import { type Cents, cents } from "#/entities/cents.ts";
import type { OwnerParty } from "#/entities/party.ts";
import type { Unit, UnitGroup, UnitType } from "#/entities/unit.ts";
import { must } from "#/support/must.ts";

import {
  type AllocationBooks,
  type AllocationRow,
  allocationOf,
} from "../allocation/allocation.ts";
import {
  groupLabelOf,
  levelOf,
  residentsOf,
  restrictionTextOf,
} from "../allocation/layout.ts";
import { priorityOf } from "../allocation/share.ts";
import { previousBalancesOf } from "../budgetShares.ts";
import {
  type ScheduleInput,
  type ScheduleNode,
  scheduleOf,
} from "../schedule.ts";

type UnitsRowKind = "root" | "group" | "unit" | "resident" | "rounding";

/** One row of the Units grid. The root, a group and a unit with several residents sum their children. */
export interface UnitsRow {
  key: string;
  kind: UnitsRowKind;
  label: string;
  icon: "building" | "group" | UnitType | "owner" | "rounding";
  /** The unit's, on a unit's row and on its residents'. */
  unitId: string | null;
  /** The resident's, on a resident's row and on the row of a unit with one resident. */
  residentId: string | null;
  /** The group's own on a group's row; the unit's group on a unit's and its residents'. */
  groupId: string | null;
  floor: string;
  interior: string;
  subUnit: string;
  type: UnitType | null;
  restriction: string;
  /** Null on the rounding row, as Paid and Overdue. */
  previousBalance: Cents | null;
  budget: Cents;
  actual: Cents;
  /** Previous balance + actual. */
  due: Cents;
  paid: Cents | null;
  /** What the installments due before today still owe. */
  overdue: Cents | null;
  /** Total due − the installments issued: positive asks for more, negative is a refund. */
  adjustment: Cents;
  children: UnitsRow[];
}

export interface UnitsList {
  root: UnitsRow;
  unitCount: number;
}

/** What the Units grid is worked out from: the allocation's books, the schedule's, the units and groups, and the root's label. */
export interface UnitsBooks {
  allocation: AllocationBooks;
  schedule: ScheduleInput;
  units: Unit[];
  groups: UnitGroup[];
  buildingLabel: string;
}

/**
 * The Units grid: the period, its groups, their units and the residents,
 * then the rounding row. A resident's Budget and Actual are their totals in
 * the budget and the final-balance allocations; Overdue and the installments
 * behind Adjustment are the Installment Schedule's, as of `today`.
 */
export function unitsListOf(books: UnitsBooks, today: string): UnitsList {
  const { input } = books.allocation;
  const budget = allocationOf(books.allocation, "budget").root;
  const actual = allocationOf(books.allocation, "finalBalance").root;
  const context: ListContext = {
    books,
    previous: previousBalancesOf(
      books.allocation.entries,
      input.accounts,
      input.residents,
    ),
    budget: residentRowsOf(budget),
    actual: residentRowsOf(actual),
    schedule: scheduleRowsOf(scheduleOf(books.schedule, today).root),
  };

  const rounding = roundingRow(
    roundingsOf(budget).total,
    roundingsOf(actual).total,
  );

  return {
    root: sumRow(
      {
        ...BLANK,
        key: "root",
        kind: "root",
        label: books.buildingLabel,
        icon: "building",
        restriction: restrictionTextOf({
          from: input.period.start,
          to: input.period.end,
        }),
      },
      [...levelRows(null, context), rounding],
    ),
    unitCount: books.units.length,
  };
}

/** What every row is read from: each resident's allocation rows by key, and their schedule row by id. */
interface ListContext {
  books: UnitsBooks;
  previous: Map<string, Cents>;
  budget: Map<string, AllocationRow>;
  actual: Map<string, AllocationRow>;
  schedule: Map<string, ScheduleNode>;
}

/** A row's own fields: the money it takes from its figures or its children. */
type RowHead = Omit<
  UnitsRow,
  | "previousBalance"
  | "budget"
  | "actual"
  | "due"
  | "paid"
  | "overdue"
  | "adjustment"
  | "children"
>;

/** The fields a summing row leaves blank unless it says otherwise. */
const BLANK: RowHead = {
  key: "",
  kind: "root",
  label: "",
  icon: "building",
  unitId: null,
  residentId: null,
  groupId: null,
  floor: "",
  interior: "",
  subUnit: "",
  type: null,
  restriction: "",
};

function levelRows(groupId: string | null, context: ListContext): UnitsRow[] {
  const { books } = context;
  const level = levelOf(groupId, books.groups, books.units);

  return [
    ...level.groups.map((group) => {
      return sumRow(
        {
          ...BLANK,
          key: `group:${group.id}`,
          kind: "group",
          label: groupRowLabelOf(group),
          icon: "group",
          groupId: group.id,
        },
        levelRows(group.id, context),
      );
    }),
    ...level.units.map((unit) => {
      return unitRow(unit, context);
    }),
  ];
}

/** "{code} - {name}", then " ({address})" when the group has one. */
function groupRowLabelOf(group: UnitGroup): string {
  return group.address === null
    ? groupLabelOf(group)
    : `${groupLabelOf(group)} (${addressTextOf(group.address)})`;
}

/** A unit with one resident is one row carrying both; with several, a row over theirs. */
function unitRow(unit: Unit, context: ListContext): UnitsRow {
  const residents = residentsOf(
    context.books.allocation.input.residents,
    unit.id,
  ).sort(byRole);

  const head: RowHead = {
    key: `unit:${unit.id}`,
    kind: "unit",
    label: unitLabelOf(unit, residents),
    icon: unit.type,
    unitId: unit.id,
    residentId: null,
    groupId: unit.groupId,
    floor: unit.floor ?? "",
    interior: unit.interior ?? "",
    subUnit: unit.subUnit ?? "",
    type: unit.type,
    restriction: restrictionTextOf(unit.restriction),
  };
  const only = residents.length === 1 ? residents[0] : undefined;

  if (only !== undefined) {
    return {
      ...head,
      residentId: only.id,
      ...figuresOf(only, context),
      children: [],
    };
  }

  return sumRow(
    head,
    residents.map((resident) => {
      return {
        ...BLANK,
        key: `resident:${resident.id}`,
        kind: "resident",
        label: residentLabelOf(resident),
        icon: "owner",
        unitId: unit.id,
        residentId: resident.id,
        groupId: unit.groupId,
        restriction: restrictionTextOf(resident.ownRestriction),
        ...figuresOf(resident, context),
        children: [],
      };
    }),
  );
}

/** Role priority first (owners before tenants); `residentsOf`'s order within one. */
function byRole(a: OwnerParty, b: OwnerParty): number {
  return priorityOf(a.role) - priorityOf(b.role);
}

/** "{code} - {name}", else "{code} - {residents' names}", then " ({role})" when one person lives there. */
function unitLabelOf(unit: Unit, residents: OwnerParty[]): string {
  const name =
    unit.name ??
    residents
      .map((resident) => {
        return resident.name;
      })
      .join(", ");
  const label = name === "" ? unit.code : `${unit.code} - ${name}`;
  const only = residents.length === 1 ? residents[0] : undefined;

  return only === undefined ? label : `${label} (${only.role})`;
}

/** "{name} ({role})", or "{name} ({role} {share}%)" with a co-ownership percentage. */
function residentLabelOf(resident: OwnerParty): string {
  const share = resident.share === null ? "" : ` ${resident.share / 10000}%`;

  return `${resident.name} (${resident.role}${share})`;
}

/** A row's money. */
type Figures = Pick<
  UnitsRow,
  | "previousBalance"
  | "budget"
  | "actual"
  | "due"
  | "paid"
  | "overdue"
  | "adjustment"
>;

function figuresOf(resident: OwnerParty, context: ListContext): Figures {
  const key = `resident:${resident.id}`;
  const previousBalance = must(
    context.previous.get(resident.id),
    `the previous balance of ${resident.id}`,
  );
  const actual = must(context.actual.get(key), `${key}'s final balance`);
  const scheduled = must(
    context.schedule.get(resident.id),
    `${resident.id}'s installments`,
  );
  const due = cents(previousBalance + actual.total);

  return {
    previousBalance,
    budget: must(context.budget.get(key), `${key}'s budget`).total,
    actual: actual.total,
    due,
    paid: actual.paid,
    overdue: scheduled.overdue,
    adjustment: cents(due - scheduled.totalInstallments),
  };
}

/** The allocations' Roundings: Total due and Adjustment are the actual one, the rest blank. */
function roundingRow(budget: Cents, actual: Cents): UnitsRow {
  return {
    ...BLANK,
    key: "rounding",
    kind: "rounding",
    label: "Rounding error",
    icon: "rounding",
    previousBalance: null,
    budget,
    actual,
    due: actual,
    paid: null,
    overdue: null,
    adjustment: actual,
    children: [],
  };
}

function sumRow(head: RowHead, children: UnitsRow[]): UnitsRow {
  function total(pick: (row: UnitsRow) => Cents | null): Cents {
    return cents(
      children.reduce((sum, row) => {
        return sum + (pick(row) ?? 0);
      }, 0),
    );
  }

  return {
    ...head,
    previousBalance: total((row) => {
      return row.previousBalance;
    }),
    budget: total((row) => {
      return row.budget;
    }),
    actual: total((row) => {
      return row.actual;
    }),
    due: total((row) => {
      return row.due;
    }),
    paid: total((row) => {
      return row.paid;
    }),
    overdue: total((row) => {
      return row.overdue;
    }),
    adjustment: total((row) => {
      return row.adjustment;
    }),
    children,
  };
}

/** The resident rows of an allocation, by key. */
function residentRowsOf(root: AllocationRow): Map<string, AllocationRow> {
  const rows = new Map<string, AllocationRow>();

  function visit(row: AllocationRow): void {
    if (row.kind === "resident") {
      rows.set(row.key, row);
    }

    row.children.forEach(visit);
  }

  visit(root);

  return rows;
}

function roundingsOf(root: AllocationRow): AllocationRow {
  return must(
    root.children.find((row) => {
      return row.kind === "roundings";
    }),
    "the allocation's Roundings",
  );
}

/** The resident rows of the schedule, by resident. */
function scheduleRowsOf(root: ScheduleNode): Map<string, ScheduleNode> {
  const rows = new Map<string, ScheduleNode>();

  function visit(node: ScheduleNode): void {
    if (node.residentId !== null) {
      rows.set(node.residentId, node);
    }

    node.children.forEach(visit);
  }

  visit(root);

  return rows;
}
