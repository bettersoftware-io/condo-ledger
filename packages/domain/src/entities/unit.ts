import type { Address } from "./address.ts";
import type { Restriction } from "./party.ts";

export type UnitType = "apartment" | "shop" | "garage" | "premises";

/** One unit of a period (a flat, a garage), in a group or at the top of the building. */
export interface Unit {
  id: string;
  periodId: string;
  code: string;
  groupId: string | null;
  /** The part of the period the unit exists in; null for the whole period. */
  restriction: Restriction | null;
  name: string | null;
  floor: string | null;
  interior: string | null;
  subUnit: string | null;
  type: UnitType;
  cadastralData: string | null;
  notes: string | null;
}

/** A group of a period's units (a staircase, the garages), in a tree. */
export interface UnitGroup {
  id: string;
  periodId: string;
  code: string;
  name: string;
  parentId: string | null;
  address: Address | null;
  notes: string | null;
}
