/** A thousandth table of a period: how its units share an account's amount. */
export interface ThousandthTable {
  id: string;
  periodId: string;
  name: string;
  order: number;
  notes: string;
  /** The group whose units the coefficients tree shows; it takes no part in the allocation. */
  restrictionGroupId: string | null;
}

/** A unit's coefficient in a table, in ten-thousandths (38 is 380000). */
export interface Coefficient {
  tableId: string;
  unitId: string;
  value: number;
}

/** Which allocation a link serves: the budget's, the final balance's, or both. */
export type LinkUse = "budget" | "finalBalance" | "both";

/** Each role priority's percentage of a link, in hundredths of a percent; null when empty or when there is no row. */
export interface RoleShares {
  1: number | null;
  2: number | null;
  3: number | null;
  4: number | null;
}

/** Whether a link has a row for each role priority: a missing row and an empty percentage are not the same. */
export interface RolePresence {
  1: boolean;
  2: boolean;
  3: boolean;
  4: boolean;
}

/** A cost account allocated through a table: its share of the account, split among the role priorities. */
export interface TableLink {
  id: string;
  accountId: string;
  tableId: string;
  use: LinkUse;
  /** The table's share of the account, in hundredths of a percent; null when empty (all of it). */
  percentage: number | null;
  roles: RoleShares;
  present: RolePresence;
}
