import type { Account } from "../entities/account.ts";
import { type Cents, cents, ZERO_CENTS } from "../entities/cents.ts";
import type { Installment, InstallmentItem } from "../entities/installment.ts";
import type { JournalEntry } from "../entities/journal.ts";
import type { OwnerParty, Party, Restriction } from "../entities/party.ts";
import { type Result, rejected } from "../entities/result.ts";
import type { Unit, UnitGroup } from "../entities/unit.ts";
import { must } from "../support/must.ts";
import { groupLabelOf, levelOf, residentsOf } from "./allocation/layout.ts";
import {
  type BudgetShares,
  budgetSharesOf,
  previousBalancesOf,
} from "./budgetShares.ts";
import { type ItemBalance, itemBalances } from "./installments.ts";
import { itemAmountVerdict } from "./validateSchedule.ts";

/** A cell's colour: paid in full, paid in part, or not paid at all. */
export type CellStatus = "settled" | "partial" | "unsettled";

/** What a row owes on one installment and what has been paid on it. */
export interface ScheduleCell {
  installmentId: string;
  /** The resident's item; null on a unit, the root, Roundings, or a resident without an item. */
  itemId: string | null;
  /** Null when no item is under the cell: it shows blank. */
  amount: Cents | null;
  paid: Cents;
  /** Null when the amount is 0 or null: no colour. */
  status: CellStatus | null;
  /**
   * Whether the item's amount may be edited, judged on its current amount by
   * the rules a write answers to (`installment-locked`, `item-paid`).
   * `no-item` on a cell with no item under it.
   */
  editable: Result;
}

type ScheduleNodeKind = "root" | "group" | "unit" | "resident" | "roundings";

/** One row of the schedule. A unit and the root sum their children, column by column. */
export interface ScheduleNode {
  key: string;
  kind: ScheduleNodeKind;
  label: string;
  residentId: string | null;
  /** The resident's role abbreviation; blank on every other row. */
  role: string;
  restriction: Restriction | null;
  /** "{covered}/{period days}" for a restricted resident; blank otherwise. */
  days: string;
  previousBalance: Cents;
  budget: Cents;
  /** Previous balance + budget. */
  due: Cents;
  /** One per installment, in number order. */
  cells: ScheduleCell[];
  totalInstallments: Cents;
  paid: Cents;
  /** Total installments − paid. */
  balance: Cents;
  /** What the items due before today still owe. */
  overdue: Cents;
  children: ScheduleNode[];
}

/** The period's first and last day, "YYYY-MM-DD". */
export interface PeriodDates {
  start: string;
  end: string;
}

/** One period's books, as much of them as the schedule reads. */
export interface ScheduleInput {
  periodLabel: string;
  period: PeriodDates;
  accounts: Account[];
  parties: Party[];
  units: Unit[];
  groups: UnitGroup[];
  entries: JournalEntry[];
  installments: Installment[];
  installmentItems: InstallmentItem[];
}

export interface Schedule {
  /** In number order: the order of every row's cells. */
  installments: Installment[];
  root: ScheduleNode;
}

const DAY = 24 * 60 * 60 * 1000;

/** A cell with no item under it: a unit's, the root's, Roundings', a blank one. */
const NO_ITEM: Result = rejected("no-item");

/** The Installment Schedule's tree: the root, the groups by code (nested), the units, then Roundings when the allocation posted any. */
export function scheduleOf(input: ScheduleInput, today: string): Schedule {
  const installments = [...input.installments].sort((a, b) => {
    return a.number - b.number;
  });
  const shares = budgetSharesOf(input.entries, input.accounts);
  const context: ScheduleContext = {
    installments,
    period: input.period,
    today,
    shares,
    previous: previousBalancesOf(input.entries, input.accounts, input.parties),
    balances: itemBalances(input.installmentItems, installments, input.entries),
  };
  const rows = levelRows(null, input, context);

  if (shares.roundings !== 0) {
    rows.push(roundingsRow(shares.roundings, installments));
  }

  return {
    installments,
    root: sumRow(
      { key: "root", kind: "root", label: input.periodLabel },
      rows,
      installments,
    ),
  };
}

/** What every resident row is worked out from. */
interface ScheduleContext {
  installments: Installment[];
  period: PeriodDates;
  today: string;
  shares: BudgetShares;
  previous: Map<string, Cents>;
  balances: ItemBalance[];
}

/** A summing row's own fields: the rest it takes from its children. */
interface RowHead {
  key: string;
  kind: ScheduleNodeKind;
  label: string;
}

/** What sits under a group, or at the top of the building when `groupId` is null: its subgroups, then its units, each by code. */
function levelRows(
  groupId: string | null,
  input: ScheduleInput,
  context: ScheduleContext,
): ScheduleNode[] {
  const level = levelOf(groupId, input.groups, input.units);

  return [
    ...level.groups.map((group) => {
      return sumRow(
        { key: `group:${group.id}`, kind: "group", label: groupLabelOf(group) },
        levelRows(group.id, input, context),
        context.installments,
      );
    }),
    ...level.units.map((unit) => {
      return unitRow(unit, input.parties, context);
    }),
  ];
}

/** A unit with one resident is that resident's row; with several, a row over theirs in residency order. */
function unitRow(
  unit: Unit,
  parties: Party[],
  context: ScheduleContext,
): ScheduleNode {
  const residents = residentsOf(
    parties.filter((party) => {
      return party.kind === "owner";
    }),
    unit.id,
  );
  const only = residents.length === 1 ? residents[0] : undefined;

  if (only !== undefined) {
    return residentRow(only, `${unit.code} ${only.name}`, context);
  }

  return sumRow(
    { key: `unit:${unit.code}`, kind: "unit", label: unit.code },
    residents.map((resident) => {
      return residentRow(resident, resident.name, context);
    }),
    context.installments,
  );
}

function residentRow(
  resident: OwnerParty,
  label: string,
  context: ScheduleContext,
): ScheduleNode {
  const own = context.balances.filter((balance) => {
    return balance.item.residentId === resident.id;
  });

  const previousBalance = must(
    context.previous.get(resident.id),
    `the previous balance of ${resident.id}`,
  );
  const budget = context.shares.shares.get(resident.id) ?? ZERO_CENTS;
  const totalInstallments = sumOf(
    own.map((balance) => {
      return balance.item.amount;
    }),
  );

  const paid = sumOf(
    own.map((balance) => {
      return balance.paid;
    }),
  );

  const overdue = sumOf(
    own
      .filter((balance) => {
        return balance.installment.dueDate < context.today;
      })
      .map((balance) => {
        return balance.remaining;
      }),
  );

  return {
    key: `resident:${resident.id}`,
    kind: "resident",
    label,
    residentId: resident.id,
    role: resident.role,
    restriction: resident.restriction,
    days: daysOf(resident.restriction, context.period),
    previousBalance,
    budget,
    due: cents(previousBalance + budget),
    cells: context.installments.map((installment) => {
      return residentCell(installment, own);
    }),
    totalInstallments,
    paid,
    balance: cents(totalInstallments - paid),
    overdue,
    children: [],
  };
}

function residentCell(
  installment: Installment,
  own: ItemBalance[],
): ScheduleCell {
  const balance = own.find((candidate) => {
    return candidate.installment.id === installment.id;
  });

  if (balance === undefined) {
    return blankCell(installment);
  }

  return {
    installmentId: installment.id,
    itemId: balance.item.id,
    amount: balance.item.amount,
    paid: balance.paid,
    status: statusOf(balance.item.amount, balance.paid),
    editable: itemAmountVerdict(balance, balance.item.amount),
  };
}

function roundingsRow(
  roundings: Cents,
  installments: Installment[],
): ScheduleNode {
  return {
    key: "roundings",
    kind: "roundings",
    label: "Roundings",
    residentId: null,
    role: "",
    restriction: null,
    days: "",
    previousBalance: ZERO_CENTS,
    budget: roundings,
    due: roundings,
    cells: installments.map(blankCell),
    totalInstallments: ZERO_CENTS,
    paid: ZERO_CENTS,
    balance: ZERO_CENTS,
    overdue: ZERO_CENTS,
    children: [],
  };
}

function sumRow(
  head: RowHead,
  children: ScheduleNode[],
  installments: Installment[],
): ScheduleNode {
  function total(pick: (node: ScheduleNode) => Cents): Cents {
    return sumOf(children.map(pick));
  }

  return {
    ...head,
    residentId: null,
    role: "",
    restriction: null,
    days: "",
    previousBalance: total((node) => {
      return node.previousBalance;
    }),
    budget: total((node) => {
      return node.budget;
    }),
    due: total((node) => {
      return node.due;
    }),
    cells: installments.map((installment, index) => {
      return sumCell(installment, children, index);
    }),
    totalInstallments: total((node) => {
      return node.totalInstallments;
    }),
    paid: total((node) => {
      return node.paid;
    }),
    balance: total((node) => {
      return node.balance;
    }),
    overdue: total((node) => {
      return node.overdue;
    }),
    children,
  };
}

function sumCell(
  installment: Installment,
  children: ScheduleNode[],
  index: number,
): ScheduleCell {
  const cells = children.map((child) => {
    return must(child.cells[index], `${child.key}'s cell ${index}`);
  });

  const amounts = cells.flatMap((cell) => {
    return cell.amount === null ? [] : [cell.amount];
  });
  const amount = amounts.length === 0 ? null : sumOf(amounts);
  const paid = sumOf(
    cells.map((cell) => {
      return cell.paid;
    }),
  );

  return {
    installmentId: installment.id,
    itemId: null,
    amount,
    paid,
    status: statusOf(amount, paid),
    editable: NO_ITEM,
  };
}

function blankCell(installment: Installment): ScheduleCell {
  return {
    installmentId: installment.id,
    itemId: null,
    amount: null,
    paid: ZERO_CENTS,
    status: null,
    editable: NO_ITEM,
  };
}

function statusOf(amount: Cents | null, paid: Cents): CellStatus | null {
  if (amount === null || amount === 0) {
    return null;
  }

  if (paid >= amount) {
    return "settled";
  }

  return paid > 0 ? "partial" : "unsettled";
}

/** "{covered}/{period days}", both ends counted; an open end of the restriction runs to the period's. */
export function daysOf(
  restriction: Restriction | null,
  period: PeriodDates,
): string {
  if (restriction === null) {
    return "";
  }

  const covered = daysFromTo(
    restriction.from ?? period.start,
    restriction.to ?? period.end,
  );

  return `${covered}/${daysFromTo(period.start, period.end)}`;
}

/** The dates a restriction covers within `outer`: an open end, or none at all, runs to the outer's. */
export function spanOf(
  restriction: Restriction | null,
  outer: PeriodDates,
): PeriodDates {
  return {
    start: restriction?.from ?? outer.start,
    end: restriction?.to ?? outer.end,
  };
}

/** The days from one "YYYY-MM-DD" date to another, both counted. */
export function daysFromTo(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;
}

function sumOf(amounts: Cents[]): Cents {
  return cents(
    amounts.reduce((total, amount) => {
      return total + amount;
    }, 0),
  );
}
