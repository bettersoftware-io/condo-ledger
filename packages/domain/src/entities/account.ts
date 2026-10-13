import type { Cents } from "./cents.ts";

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
  | "tax";

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
}
