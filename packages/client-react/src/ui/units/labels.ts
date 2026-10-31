import type { ResidencyDraft, UnitType } from "@cl/domain";

// What the Units screen calls its values and its tabs. Its own module, apart
// from the components that draw them: a component file exports components
// only.

/** A unit's type in words (the spec's words for values). */
export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  apartment: "Apartment",
  shop: "Shop",
  garage: "Garage",
  premises: "Premises",
};

/** The bottom panel's tabs, in the design's order. */
export const UNIT_TABS = ["Unit Profile", "Unit Owners"] as const;

/** A residency's role in words, in the design's order. */
export const ROLE_LABELS: Record<ResidencyDraft["role"], string> = {
  PR: "Owner (PR)",
  CO: "Tenant (CO)",
  SC: "Subtenant (SC)",
};
