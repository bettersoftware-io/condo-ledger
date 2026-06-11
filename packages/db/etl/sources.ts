// Source-file URLs for the three-tier seed and their tier membership.
//
// Resolution: this module lives at packages/db/etl/, and the legacy dumps live at
// the repo's old/db/ — three directory levels up (etl -> db -> packages -> repo).
const DB = new URL("../../../old/db/", import.meta.url);

export const FILES = {
  // Per-condominium operational dumps — Tier C is derived dynamically from these.
  saturnoOnly: new URL("it-jtime-condominium-saturno-only.data.sql", DB),
  pozzettoOnly: new URL("it-jtime-condominium-pozzetto-only.data.sql", DB),
  // Full 46MB dump — source for Tier B master-data parents.
  full: new URL("it-jtime-condominium.data.sql", DB),
  // Locale/country reference dump — source for Tier A.
  reference: new URL("it-jtime-condominium - data - country, locale, localeI18n.sql", DB),
} as const;

// Tier A — locale/country reference data.
export const TIER_A = new Set(["country", "locale", "localeI18n"]);

// Tier B — master-data parents read from `full`.
export const TIER_B = new Set([
  "studio",
  "masterDataCategory",
  "masterData",
  "person",
  "company",
  "personVariation",
  "companyVariation",
  "masterDataVariation",
  "accessAccount",
  "qualification",
  "unitOwnershipScenario",
  "unitResidentPriority",
  "unitType",
  "withholdingTax",
  "taxRelief",
  "consumptionMeter",
  "unitResidentAccount",
]);

// Tier C is derived dynamically from the operational dumps — do NOT hardcode.
