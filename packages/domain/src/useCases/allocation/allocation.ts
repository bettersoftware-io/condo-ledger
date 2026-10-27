import type { Account } from "#/entities/account.ts";
import { type Cents, cents, ZERO_CENTS } from "#/entities/cents.ts";
import type { JournalEntry } from "#/entities/journal.ts";
import type { OwnerParty, Party, Restriction } from "#/entities/party.ts";
import type { Coefficient, ThousandthTable } from "#/entities/table.ts";
import type { Unit, UnitGroup } from "#/entities/unit.ts";
import { must } from "#/support/must.ts";

import { previousBalancesOf } from "../budgetShares.ts";
import { daysOf, type PeriodDates } from "../schedule.ts";
import {
  groupLabelOf,
  levelOf,
  residentsOf,
  restrictionTextOf,
} from "./layout.ts";
import { type AllocationInput, type AllocationMode, shareOf } from "./share.ts";

/** One account column: a top-level cost account, headed by its abbreviation, else its name. */
interface AllocationColumn {
  accountId: string;
  label: string;
}

type AllocationRowKind = "root" | "group" | "unit" | "resident" | "roundings";

/** One row of the allocation. The root, a group and a unit sum their children, column by column. */
export interface AllocationRow {
  key: string;
  kind: AllocationRowKind;
  label: string;
  /** The resident's role abbreviation; blank on every other row. */
  role: string;
  /** The row's own dates, as the schedule writes them; the period's on the root. */
  restriction: string;
  /** "{days}/{period days}" on a row with dates of its own; blank otherwise. */
  days: string;
  /** One per column. */
  amounts: Cents[];
  /** The expenses' share: the sum of the amounts. */
  total: Cents;
  /** Null on Roundings, as Total due and Paid. */
  previousBalance: Cents | null;
  /** Total + previous balance. */
  due: Cents | null;
  /** What the resident's collections paid in the period. */
  paid: Cents | null;
  children: AllocationRow[];
}

export interface Allocation {
  columns: AllocationColumn[];
  root: AllocationRow;
  /** The expense accounts, in account order, with a base that is not 0 and that allocate nothing to anyone. */
  unallocated: string[];
}

/** What the allocation is worked out from: the share's input, the units' groups and the period's entries. */
export interface AllocationBooks {
  input: AllocationInput;
  groups: UnitGroup[];
  entries: JournalEntry[];
  periodLabel: string;
}

/** One period's books, as they come from the ports. */
export interface AllocationSource {
  periodLabel: string;
  period: PeriodDates;
  accounts: Account[];
  parties: Party[];
  entries: JournalEntry[];
  tables: ThousandthTable[];
  coefficients: Coefficient[];
  units: Unit[];
  groups: UnitGroup[];
}

/**
 * The books the allocation reads: the period's owners as its residents, each
 * account's balance (debit − credit over the entries), and each resident's
 * sum on each individual-expense account.
 */
export function allocationBooksOf(source: AllocationSource): AllocationBooks {
  const individualAccounts = new Set(
    source.accounts
      .filter((account) => {
        return account.type === "controlUnitResident";
      })
      .map((account) => {
        return account.id;
      }),
  );
  const balances = new Map<string, Cents>();
  const individual = new Map<string, Map<string, Cents>>();

  for (const entry of source.entries) {
    for (const posting of entry.postings) {
      const net = posting.debit - posting.credit;
      balances.set(
        posting.accountId,
        cents((balances.get(posting.accountId) ?? 0) + net),
      );

      if (
        individualAccounts.has(posting.accountId) &&
        posting.counterpart?.kind === "owner"
      ) {
        const sums =
          individual.get(posting.accountId) ?? new Map<string, Cents>();
        const residentId = posting.counterpart.id;
        sums.set(residentId, cents((sums.get(residentId) ?? 0) + net));
        individual.set(posting.accountId, sums);
      }
    }
  }

  return {
    input: {
      period: source.period,
      accounts: source.accounts,
      tables: source.tables,
      coefficients: source.coefficients,
      units: source.units,
      residents: source.parties.filter((party) => {
        return party.kind === "owner";
      }),
      balances,
      individual,
    },
    groups: source.groups,
    entries: source.entries,
    periodLabel: source.periodLabel,
  };
}

/**
 * The allocation of a period as the legacy app drew it: a column per
 * top-level cost account; the period, its groups, their units and the
 * residents; then Roundings, each account's total less what the residents
 * were given.
 */
export function allocationOf(
  books: AllocationBooks,
  mode: AllocationMode,
): Allocation {
  const { input } = books;
  const columnAccounts = input.accounts
    .filter((account) => {
      return account.nature === "expenses" && account.parentId === null;
    })
    .sort(byOrder);

  const context: RowContext = {
    books,
    mode,
    columnIds: columnAccounts.map((account) => {
      return account.id;
    }),
    previous: previousBalancesOf(
      books.entries,
      input.accounts,
      input.residents,
    ),
    paid: paidOf(books.entries, input.accounts),
    residentRows: [],
  };
  const rows = levelRows(null, context);
  const roundings = roundingsRow(
    columnAccounts.map((account) => {
      return accountTotalOf(input, mode, account);
    }),
    context.residentRows,
  );

  return {
    columns: columnAccounts.map((account) => {
      return {
        accountId: account.id,
        label: account.abbreviation ?? account.name,
      };
    }),
    root: sumRow(
      {
        key: "root",
        kind: "root",
        label: books.periodLabel,
        restriction: restrictionTextOf({
          from: input.period.start,
          to: input.period.end,
        }),
        days: "",
      },
      [...rows, roundings],
      columnAccounts.length,
    ),
    unallocated: unallocatedOf(input, mode),
  };
}

/** What every row is worked out from; the resident rows are gathered as they are built, for Roundings. */
interface RowContext {
  books: AllocationBooks;
  mode: AllocationMode;
  columnIds: string[];
  previous: Map<string, Cents>;
  paid: Map<string, Cents>;
  residentRows: AllocationRow[];
}

/** A summing row's own fields: the rest it takes from its children. */
interface RowHead {
  key: string;
  kind: AllocationRowKind;
  label: string;
  restriction: string;
  days: string;
}

function levelRows(
  groupId: string | null,
  context: RowContext,
): AllocationRow[] {
  const { groups, input } = context.books;
  const level = levelOf(groupId, groups, input.units);

  return [
    ...level.groups.map((group) => {
      return sumRow(
        {
          key: `group:${group.id}`,
          kind: "group",
          label: groupLabelOf(group),
          restriction: "",
          days: "",
        },
        levelRows(group.id, context),
        context.columnIds.length,
      );
    }),
    ...level.units.map((unit) => {
      return unitRow(unit, context);
    }),
  ];
}

/** A unit with one resident is that resident's row; with several, a row over theirs. */
function unitRow(unit: Unit, context: RowContext): AllocationRow {
  const { input } = context.books;
  const residents = residentsOf(input.residents, unit.id);
  const only = residents.length === 1 ? residents[0] : undefined;

  if (only !== undefined) {
    return residentRow(
      only,
      `${unit.code} ${residentLabelOf(only)}`,
      only.restriction,
      context,
    );
  }

  return sumRow(
    {
      key: `unit:${unit.id}`,
      kind: "unit",
      label: unit.code,
      restriction: restrictionTextOf(unit.restriction),
      days: daysOf(unit.restriction, input.period),
    },
    residents.map((resident) => {
      return residentRow(
        resident,
        residentLabelOf(resident),
        resident.ownRestriction,
        context,
      );
    }),
    context.columnIds.length,
  );
}

/** The resident's name, with "({role} {share}%)" when they have a co-ownership percentage. */
function residentLabelOf(resident: OwnerParty): string {
  return resident.share === null
    ? resident.name
    : `${resident.name} (${resident.role} ${resident.share / 10000}%)`;
}

function residentRow(
  resident: OwnerParty,
  label: string,
  restriction: Restriction | null,
  context: RowContext,
): AllocationRow {
  const { input } = context.books;
  const amounts = context.columnIds.map((accountId) => {
    return shareOf(input, context.mode, accountId, resident.id);
  });
  const total = sumOf(amounts);
  const previousBalance = must(
    context.previous.get(resident.id),
    `the previous balance of ${resident.id}`,
  );

  const row: AllocationRow = {
    key: `resident:${resident.id}`,
    kind: "resident",
    label,
    role: resident.role,
    restriction: restrictionTextOf(restriction),
    days: daysOf(restriction, input.period),
    amounts,
    total,
    previousBalance,
    due: cents(total + previousBalance),
    paid: context.paid.get(resident.id) ?? ZERO_CENTS,
    children: [],
  };
  context.residentRows.push(row);

  return row;
}

/** Each column's total less the residents' amounts in it; no previous balance, due or paid. */
function roundingsRow(
  totals: Cents[],
  residentRows: AllocationRow[],
): AllocationRow {
  const amounts = totals.map((total, index) => {
    const given = sumOf(
      residentRows.map((row) => {
        return must(row.amounts[index], `${row.key}'s ${index}`);
      }),
    );

    return cents(total - given);
  });

  return {
    key: "roundings",
    kind: "roundings",
    label: "Roundings",
    role: "",
    restriction: "",
    days: "",
    amounts,
    total: sumOf(amounts),
    previousBalance: null,
    due: null,
    paid: null,
    children: [],
  };
}

/** `width` is the number of columns: a group or a unit with no one under it still has one amount each. */
function sumRow(
  head: RowHead,
  children: AllocationRow[],
  width: number,
): AllocationRow {
  const total = sumOf(
    children.map((child) => {
      return child.total;
    }),
  );

  const previousBalance = sumKnown(
    children.map((child) => {
      return child.previousBalance;
    }),
  );

  return {
    ...head,
    role: "",
    amounts: Array.from({ length: width }, (_, index) => {
      return sumOf(
        children.map((child) => {
          return must(child.amounts[index], `${child.key}'s ${index}`);
        }),
      );
    }),
    total,
    previousBalance,
    due: cents(total + previousBalance),
    paid: sumKnown(
      children.map((child) => {
        return child.paid;
      }),
    ),
    children,
  };
}

/** The account's budget (its children's, for a grouping account), or its balance in final-balance mode. */
function accountTotalOf(
  input: AllocationInput,
  mode: AllocationMode,
  account: Account,
): Cents {
  if (account.type === "grouping") {
    return sumOf(
      input.accounts
        .filter((child) => {
          return child.parentId === account.id;
        })
        .map((child) => {
          return accountTotalOf(input, mode, child);
        }),
    );
  }

  return baseOf(input, mode, account);
}

function baseOf(
  input: AllocationInput,
  mode: AllocationMode,
  account: Account,
): Cents {
  return mode === "budget"
    ? (account.budget ?? ZERO_CENTS)
    : (input.balances.get(account.id) ?? ZERO_CENTS);
}

/** The regular expense accounts with a base that is not 0 and no resident's share of it. */
function unallocatedOf(input: AllocationInput, mode: AllocationMode): string[] {
  return input.accounts
    .filter((account) => {
      return (
        account.nature === "expenses" &&
        account.type === "regular" &&
        baseOf(input, mode, account) !== 0 &&
        input.residents.every((resident) => {
          return shareOf(input, mode, account.id, resident.id) === 0;
        })
      );
    })
    .sort(byOrder)
    .map((account) => {
      return account.id;
    });
}

/** By resident: what the collections credited the owners account for them, less any debit. */
function paidOf(
  entries: JournalEntry[],
  accounts: Account[],
): Map<string, Cents> {
  const owners = new Set(
    accounts
      .filter((account) => {
        return account.role === "owners";
      })
      .map((account) => {
        return account.id;
      }),
  );
  const paid = new Map<string, Cents>();

  for (const entry of entries) {
    if (entry.kind !== "collection") {
      continue;
    }

    for (const posting of entry.postings) {
      if (
        owners.has(posting.accountId) &&
        posting.counterpart?.kind === "owner"
      ) {
        const id = posting.counterpart.id;
        paid.set(
          id,
          cents((paid.get(id) ?? 0) + posting.credit - posting.debit),
        );
      }
    }
  }

  return paid;
}

function byOrder(a: Account, b: Account): number {
  return a.order - b.order;
}

/** The sum of the amounts that are there; 0 when none is. */
function sumKnown(amounts: (Cents | null)[]): Cents {
  return sumOf(
    amounts.filter((amount) => {
      return amount !== null;
    }),
  );
}

function sumOf(amounts: Cents[]): Cents {
  return cents(
    amounts.reduce((total, amount) => {
      return total + amount;
    }, 0),
  );
}
