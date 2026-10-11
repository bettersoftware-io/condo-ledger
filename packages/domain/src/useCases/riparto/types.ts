// packages/domain/src/riparto/types.ts

export type Mode = "estimate" | "current";

/** One link of an expense account to a distribution table. pct already resolved (null→100). */
export interface LinkRef {
  linkId: string;
  tableId: string;
  pct: number;
  type: "estimate" | "currentBalance" | null;
}

export interface LinkedColumn {
  legacyAccountId: string;
  name: string;
  links: LinkRef[];
  /** Primary table for display (estimate-side first, else first link). */
  displayTableId: string;
}

export interface ResidentInfo {
  id: string;
  priorityId: string;
  percentage: number;
}

/** Clean, store/DB-agnostic input to the riparto engine. All money is integer cents. */
export interface RipartoInput {
  /** Accounts in the period. `order` already numeric; `parentId` null at the root. */
  accounts: {
    id: string;
    name: string;
    order: number;
    parentId: string | null;
  }[];
  /** Expense-account → table links (pct resolved, type normalised). */
  links: {
    accountId: string;
    linkId: string;
    tableId: string;
    pct: number;
    type: "estimate" | "currentBalance" | null;
  }[];
  /** Own (not rolled-up) estimate cents per account id. */
  estimateCentsByAccount: Record<string, number>;
  /** Own (not rolled-up) signed actual cents per posting account id, this period. */
  actualCentsByAccount: Record<string, number>;
  /** Distribution-table coefficients. */
  tableItems: { tableId: string; unitId: string; coefficient: number }[];
  /** Owner/tenant role split rows, keyed by link id. */
  roles: { linkId: string; priorityId: string; percentage: number }[];
  /** Residents grouped per legacy unit id (via residentId/priority/percentage). */
  residents: {
    unitId: string;
    residentId: string;
    priorityId: string;
    percentage: number;
  }[];
  /** Legacy unit ids present this period, already sorted by code. */
  unitLegacyIds: string[];
}

/** Estimate and actual totals (cents) of a linked account's subtree. */
export interface SubtreeTotals {
  estimateCents: number;
  actualCents: number;
}

export interface RipartoEngine {
  columns: LinkedColumn[];
  /** per-unit amount in cents for an account+mode+legacy unit id. */
  perUnitAmount(accountId: string, mode: Mode, legacyUnitId: string): number;
  /** subtree totals (cents) for a linked account. */
  subtree(accountId: string): SubtreeTotals;
  /** split a unit's per-unit amount among its residents. Map<unitResidentId, cents>. */
  perResidentAmount(
    accountId: string,
    mode: Mode,
    legacyUnitId: string,
  ): Map<string, number>;
  /** legacy unit ids present this period (sorted by code). */
  unitLegacyIds: string[];
}
