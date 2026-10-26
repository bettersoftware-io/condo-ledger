import type { Cents } from "./cents.ts";

/** Who a control account's posting is with: a supplier, or an owner in one residency. */
export interface SupplierParty {
  kind: "supplier";
  id: string;
  name: string;
}

/** One residency, owner or tenant. */
export interface OwnerParty {
  kind: "owner";
  id: string;
  personId: string;
  name: string;
  unitCode: string;
  unitId: string;
  /** What the resident owed at the start of the period; negative when in credit. */
  startingBalance: Cents;
  /** The legacy role abbreviation (the dump's `unitResidentRole`): "PR" owner, "CO" tenant (conduttore), … */
  role: string;
  /** The co-ownership percentage, in ten-thousandths of a percent (100% is 1000000); null when empty. */
  share: number | null;
  /** The part of the period the residency covers: its own, else its unit's; null for the whole period. */
  restriction: Restriction | null;
  /** The residency's own dates, without its unit's; null when it has none. */
  ownRestriction: Restriction | null;
}

/** Part of a period, as "YYYY-MM-DD" dates; an open end runs to the period's start or end. */
export interface Restriction {
  from: string | null;
  to: string | null;
}

export type Party = SupplierParty | OwnerParty;
