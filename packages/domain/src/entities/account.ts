import type { Cents } from "./cents.ts";
import type { TableLink } from "./table.ts";

export type AccountNature =
  | "assets"
  | "liabilities"
  | "assetsOrLiabilities"
  | "income"
  | "expenses";
export type AccountType =
  | "grouping"
  | "regular"
  | "control"
  | "controlUnitResident";
export type AccountRole =
  | "cash"
  | "bank"
  | "suppliers"
  | "owners"
  | "roundings"
  | "tax"
  /** The revenue a budget allocation credits. */
  | "budgetAllocation";

/** One line of a period's chart of accounts. */
export interface Account {
  id: string;
  periodId: string;
  parentId: string | null;
  name: string;
  order: number;
  nature: AccountNature;
  type: AccountType;
  role: AccountRole | null;
  budget: Cents | null;
  /** The short name an allocation column is headed by; null when it has none. */
  abbreviation: string | null;
  /** The account's own links to thousandth tables; a child without any takes its parent's. */
  links: TableLink[];
}
