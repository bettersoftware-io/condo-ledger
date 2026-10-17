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
  /** What the resident owed at the start of the period; negative when in credit. */
  startingBalance: Cents;
}

export type Party = SupplierParty | OwnerParty;
