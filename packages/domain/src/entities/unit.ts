import type { Restriction } from "./party.ts";

/** One unit of a period (a flat, a garage), in a group or at the top of the building. */
export interface Unit {
  id: string;
  periodId: string;
  code: string;
  groupId: string | null;
  /** The part of the period the unit exists in; null for the whole period. */
  restriction: Restriction | null;
}

/** A group of a period's units (a staircase, the garages), in a tree. */
export interface UnitGroup {
  id: string;
  periodId: string;
  code: string;
  name: string;
  parentId: string | null;
}
