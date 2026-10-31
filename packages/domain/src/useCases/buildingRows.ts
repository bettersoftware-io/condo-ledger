import type { Account, AccountRole } from "../entities/account.ts";
import { addressTextOf } from "../entities/address.ts";
import type {
  Building,
  BuildingType,
  Period,
  PeriodType,
} from "../entities/building.ts";
import { type Cents, subtractCents, ZERO_CENTS } from "../entities/cents.ts";
import { must } from "../support/must.ts";
import { type AccountNode, findNode } from "./accountTree.ts";
import { restrictionTextOf } from "./allocation/layout.ts";
import type { UnitsList } from "./units/unitsList.ts";

/** One period's money columns on the Building Data grid. */
export interface PeriodFigures {
  /** The Liquidity account's balance, as the Accounts tree has it. */
  liquidity: Cents;
  /** The Funds account's balance, shown as the positive amount set aside. */
  funds: Cents;
  budget: Cents;
  actual: Cents;
  previousBalance: Cents;
  /** Previous balance + actual, as on the Units grid's root. */
  due: Cents;
}

/** One row of the Building Data grid: a building over its periods. */
export interface BuildingRow {
  key: string;
  kind: "building" | "period";
  buildingId: string;
  /** The period's, on a period's row. */
  periodId: string | null;
  code: string;
  label: string;
  type: BuildingType | PeriodType;
  /** Whether the period is closed; null on a building's row. */
  closed: boolean | null;
  /** "dd/mm/yyyy - dd/mm/yyyy" on a period's row; blank on a building's. */
  dates: string;
  /** Null on a building's row, and on a period's whose figures are not worked out yet. */
  figures: PeriodFigures | null;
  children: BuildingRow[];
}

/**
 * A period's figures: Liquidity and Funds from the Accounts tree (Funds with
 * the ledger's sign turned, so money set aside reads positive); Budget,
 * Actual, Prev. bal. and Total due from the Units grid's root.
 */
export function periodFiguresOf(
  list: UnitsList,
  tree: AccountNode,
  accounts: Account[],
): PeriodFigures {
  const { root } = list;

  return {
    liquidity: balanceOfRole(tree, accounts, "liquidity"),
    funds: subtractCents(ZERO_CENTS, balanceOfRole(tree, accounts, "funds")),
    budget: root.budget,
    actual: root.actual,
    previousBalance: must(
      root.previousBalance,
      "the Units root's previous balance",
    ),
    due: root.due,
  };
}

/**
 * The Building Data grid: buildings by name, labelled "{name} ({address})",
 * each over its periods by start, labelled "{name} ({type})".
 */
export function buildingRowsOf(
  buildings: Building[],
  figures: Map<string, PeriodFigures>,
): BuildingRow[] {
  return buildings
    .slice()
    .sort((a, b) => {
      return a.name.localeCompare(b.name, "it");
    })
    .map((building) => {
      return buildingRow(building, figures);
    });
}

function buildingRow(
  building: Building,
  figures: Map<string, PeriodFigures>,
): BuildingRow {
  const periods = building.periods.slice().sort((a, b) => {
    return a.start.localeCompare(b.start);
  });

  return {
    key: building.id,
    kind: "building",
    buildingId: building.id,
    periodId: null,
    code: building.code ?? "",
    label:
      building.address === null
        ? building.name
        : `${building.name} (${addressTextOf(building.address)})`,
    type: building.type,
    closed: null,
    dates: "",
    figures: null,
    children: periods.map((period) => {
      return periodRow(building, period, figures);
    }),
  };
}

function periodRow(
  building: Building,
  period: Period,
  figures: Map<string, PeriodFigures>,
): BuildingRow {
  return {
    key: period.id,
    kind: "period",
    buildingId: building.id,
    periodId: period.id,
    code: "",
    label: `${period.name} (${PERIOD_TYPE_WORDS[period.type]})`,
    type: period.type,
    closed: period.closed,
    dates: restrictionTextOf({ from: period.start, to: period.end }),
    figures: figures.get(period.id) ?? null,
    children: [],
  };
}

const PERIOD_TYPE_WORDS: Record<PeriodType, string> = {
  ordinary: "Ordinary",
  extra: "Extraordinary",
  auxiliary: "Auxiliary",
};

function balanceOfRole(
  tree: AccountNode,
  accounts: Account[],
  role: AccountRole,
): Cents {
  const account = must(
    accounts.find((candidate) => {
      return candidate.role === role;
    }),
    `the ${role} account`,
  );

  return must(findNode(tree, account.id), `the node of ${account.id}`).balance;
}
