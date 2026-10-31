import type { BuildingType, PeriodType, RecordStatus } from "@cl/domain";

// What the Building Data screen calls its values and its tabs, and the icons
// it draws them with. Its own module, apart from the components that draw
// them: a component file exports components only.

/** The bottom panel's tabs, in the design's order. */
export const BUILDING_TABS = [
  "Building Profile",
  "Building Suppliers",
] as const;

/** A building's type in words (the spec's words for values). */
export const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  building: "Building",
  superBuilding: "Super-building",
  residence: "Residence",
};

/** A building's type as the Type column and the profile draw it. */
export const BUILDING_TYPE_ICONS: Record<BuildingType, string> = {
  building: "🏢",
  superBuilding: "🏙️",
  residence: "🏘️",
};

/** A period's type as the Type column draws it. */
export const PERIOD_TYPE_ICONS: Record<PeriodType, string> = {
  ordinary: "📁",
  extra: "🗂️",
  auxiliary: "📎",
};

/** A building's or a contact's status in words. */
export const STATUS_LABELS: Record<RecordStatus, string> = {
  active: "Active",
  archived: "Archived",
};

/** What the suppliers' tools say: a supplier is a contact, edited where contacts are. */
export const SUPPLIERS_NOTICE =
  "Suppliers are edited in Contacts, which is not yet available.";
