import type { Account } from "#/entities/account.ts";
import { type Cents, cents } from "#/entities/cents.ts";
import type { OwnerParty } from "#/entities/party.ts";
import type {
  Coefficient,
  LinkUse,
  RoleShares,
  ThousandthTable,
} from "#/entities/table.ts";
import type { Unit } from "#/entities/unit.ts";
import { must } from "#/support/must.ts";

import { daysFromTo, type PeriodDates } from "../schedule.ts";
import { appliedLinksOf } from "./links.ts";

/** Which allocation is worked out: the budget's, or the final balance's. */
export type AllocationMode = "budget" | "finalBalance";

/** One period's books, as much of them as the allocation reads. */
export interface AllocationInput {
  period: PeriodDates;
  accounts: Account[];
  tables: ThousandthTable[];
  coefficients: Coefficient[];
  units: Unit[];
  residents: OwnerParty[];
  /** Each posting account's balance for the period, debit − credit. Ignored in budget mode, which reads the budgets. */
  balances: Map<string, Cents>;
  /** For each `controlUnitResident` account, each resident's sum of its postings. */
  individual: Map<string, Map<string, Cents>>;
}

/** A role column of a link: 1 is PR/NP/LE, 2 US/CF, 3 CO, 4 SC. */
type Priority = keyof RoleShares;

const PRIORITIES: Priority[] = [1, 2, 3, 4];

const PRIORITY_OF_ROLE = new Map<string, Priority>([
  ["PR", 1],
  ["NP", 1],
  ["LE", 1],
  ["US", 2],
  ["CF", 2],
  ["CO", 3],
  ["SC", 4],
]);

/**
 * The legacy's rounding (`MixedUtil.round`): to 12 significant digits first,
 * then half toward +∞, as AS3's `Math.round`.
 */
export function legacyRound(x: number, places: number): number {
  const factor = 10 ** places;

  return Math.round(Number((x * factor).toPrecision(12))) / factor;
}

/**
 * A resident's share of an account, as the legacy app works it out
 * (`UnitResidentVO.getShareByExpenseLedgerAccount`): in euros and in its own
 * floating point, rounded to the cent link by link and child by child.
 */
export function shareOf(
  input: AllocationInput,
  mode: AllocationMode,
  accountId: string,
  residentId: string,
): Cents {
  const account = must(
    input.accounts.find((candidate) => {
      return candidate.id === accountId;
    }),
    `account ${accountId}`,
  );

  const resident = must(
    input.residents.find((candidate) => {
      return candidate.id === residentId;
    }),
    `resident ${residentId}`,
  );

  return cents(Math.round(euroShareOf(input, mode, account, resident) * 100));
}

function euroShareOf(
  input: AllocationInput,
  mode: AllocationMode,
  account: Account,
  resident: OwnerParty,
): number {
  switch (account.type) {
    case "grouping":
      return input.accounts
        .filter((child) => {
          return child.parentId === account.id;
        })
        .reduce((share, child) => {
          return legacyRound(
            share + euroShareOf(input, mode, child, resident),
            2,
          );
        }, 0);
    case "control":
      return 0;
    case "controlUnitResident":
      return mode === "budget"
        ? 0
        : (input.individual.get(account.id)?.get(resident.id) ?? 0) / 100;
    case "regular":
      return regularShareOf(input, mode, account, resident);
  }
}

function regularShareOf(
  input: AllocationInput,
  mode: AllocationMode,
  account: Account,
  resident: OwnerParty,
): number {
  const base = baseOf(input, mode, account) / 100;
  const priority = priorityOf(resident.role);
  const compound = compoundCoefficientOf(input, resident);
  let share = 0;

  for (const link of appliedLinksOf(input.accounts, account.id).links) {
    const tic = serves(link.use, mode)
      ? tableItemCoefficientOf(
          input.coefficients,
          link.tableId,
          resident.unitId,
        )
      : 0;

    if (tic === 0) {
      continue;
    }

    const tc = link.percentage === null ? 1 : link.percentage / 100 / 100;

    for (const column of PRIORITIES) {
      if (
        !link.present[column] ||
        !isElected(input, resident, priority, column)
      ) {
        continue;
      }

      const role = link.roles[column];
      const rc = role === null ? 1 : role / 100 / 100;
      const sub = legacyRound(
        legacyRound(base * tc * rc * tic * compound, 12),
        2,
      );
      share = legacyRound(share + sub, 2);
    }
  }

  return share;
}

/** The budget, or the balance in final-balance mode, in cents. */
function baseOf(
  input: AllocationInput,
  mode: AllocationMode,
  account: Account,
): number {
  return mode === "budget"
    ? (account.budget ?? 0)
    : (input.balances.get(account.id) ?? 0);
}

function serves(use: LinkUse, mode: AllocationMode): boolean {
  return use === "both" || use === mode;
}

/** The unit's coefficient over the table's total, summed as the legacy sums it; 0 without one, or when the total is not above 0. */
function tableItemCoefficientOf(
  coefficients: Coefficient[],
  tableId: string,
  unitId: string,
): number {
  const items = coefficients.filter((coefficient) => {
    return coefficient.tableId === tableId;
  });

  const total = items.reduce((sum, item) => {
    return sum + item.value / 10000;
  }, 0);

  const item = items.find((candidate) => {
    return candidate.unitId === unitId;
  });

  return item === undefined || total <= 0 ? 0 : item.value / 10000 / total;
}

function priorityOf(role: string): Priority {
  const priority = PRIORITY_OF_ROLE.get(role);

  if (priority === undefined) {
    throw new Error(`unknown role: ${role}`);
  }

  return priority;
}

/**
 * Whether a resident of priority p pays the column of priority q: when p = q,
 * or when p < q and no one else in the unit has a priority in (p, q]. At
 * p = q that range is empty, so one test covers both.
 */
function isElected(
  input: AllocationInput,
  resident: OwnerParty,
  priority: Priority,
  column: Priority,
): boolean {
  if (priority > column) {
    return false;
  }

  return !input.residents.some((other) => {
    if (other.unitId !== resident.unitId) {
      return false;
    }

    const theirs = priorityOf(other.role);

    return priority < theirs && theirs <= column;
  });
}

/** The co-ownership factor times the residency factor (`UnitResidentVO.compoundCoefficient`). */
function compoundCoefficientOf(
  input: AllocationInput,
  resident: OwnerParty,
): number {
  return (
    coOwnershipOf(input.residents, resident) * residencyOf(input, resident)
  );
}

/**
 * Over the residents of the unit with the same role: the resident's
 * percentage when theirs do not sum to 0, and 0 for one without; otherwise
 * an equal part among those without one, or among all when every one has 0.
 */
function coOwnershipOf(residents: OwnerParty[], resident: OwnerParty): number {
  const group = residents.filter((other) => {
    return other.unitId === resident.unitId && other.role === resident.role;
  });
  let total = 0;
  let empty = 0;

  for (const other of group) {
    if (other.share === null) {
      empty += 1;
    } else {
      total += other.share / 10000;
    }
  }

  if (total !== 0) {
    return resident.share === null ? 0 : resident.share / 10000 / 100;
  }

  return empty > 0 ? 1 / empty : 1 / group.length;
}

/**
 * The resident's days over the unit's, only for a resident with dates of
 * their own. An open end runs to the unit's, then to the period's. A unit's
 * own dates prorate nobody.
 */
function residencyOf(input: AllocationInput, resident: OwnerParty): number {
  const own = resident.ownRestriction;

  if (own === null) {
    return 1;
  }

  const unit = must(
    input.units.find((candidate) => {
      return candidate.id === resident.unitId;
    }),
    `unit ${resident.unitId}`,
  );
  const start = unit.restriction?.from ?? input.period.start;
  const end = unit.restriction?.to ?? input.period.end;

  return daysFromTo(own.from ?? start, own.to ?? end) / daysFromTo(start, end);
}
