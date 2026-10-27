// Source-file URLs for the three-tier seed and their tier membership.

import { pathToFileURL } from "node:url";

// Resolution: the legacy dumps live in the folder LEGACY_DUMP_DIR names (a
// worktree has no old/: it is kept in the project's own checkout), or else at the
// repo's old/db/ — three directory levels up (etl -> db -> packages -> repo).
const DB =
  process.env.LEGACY_DUMP_DIR === undefined
    ? new URL("../../../old/db/", import.meta.url)
    : pathToFileURL(`${process.env.LEGACY_DUMP_DIR}/`);

export const FILES = {
  // The legacy DDL — the column names and types of the column-less data dumps.
  structure: new URL("it-jtime-condominium.structure.sql", DB),
  // Per-condominium operational dumps — Tier C is derived dynamically from these.
  saturnoOnly: new URL("it-jtime-condominium-saturno-only.data.sql", DB),
  pozzettoOnly: new URL("it-jtime-condominium-pozzetto-only.data.sql", DB),
  // Full 46MB dump — source for Tier B master-data parents.
  full: new URL("it-jtime-condominium.data.sql", DB),
  // Locale/country reference dump — source for Tier A.
  reference: new URL(
    "it-jtime-condominium - data - country, locale, localeI18n.sql",
    DB,
  ),
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
  // bankAccount: parent of condominium.bankAccountId. Absent from the per-condo
  // operational dumps but present in the full dump (row 7, studio 1, with NULL
  // bankId/bankBranchId), so loading it resolves the FK with no new orphans.
  "bankAccount",
]);

// Tier C is derived dynamically from the operational dumps — do NOT hardcode.

// --- studioId reconciliation (dumps predate the multi-tenancy column) ---
//
// The operational dumps were taken before the `studioId` column existed, and ALL
// of this operational data belongs to studio 1 (evidence: every child table of
// Saturno (condom. 1) and Pozzetto (condom. 19) carries studioId=1; studios 1 and
// 2 both exist but only 1 is referenced here). This surfaces two ways:
//
//   A. Four tables' column-LESS dumps OMIT the `studioId` column entirely. Their
//      tuples are positionally one column short of the DDL, which (left as-is)
//      shifts every value right and throws 22P02 type errors. For these we resolve
//      columns as the DDL list MINUS `studioId`. The `order` column on
//      condominiumSupplier (nullable) is the one that reads NULL in the dump.
export const DROP_STUDIO_ID = new Set([
  "condominiumSupplier",
  "f24",
  "installmentItem",
  "ledgerInvoice2F24",
]);

//   B. `condominium` DOES carry a studioId slot but its value is literally NULL,
//      while the schema column `studio_id` is NOT NULL.
//
// STUDIO_BACKFILL: every table whose loaded rows must get `studio_id = 1` — the 4
// above (where studioId is absent post-resolve) plus `condominium` (NULL -> 1).
// Applied post-transform via `studio_id ??= 1` (snake_case key), so it covers both
// the absent and the NULL-valued cases uniformly.
export const STUDIO_BACKFILL = new Set([
  "condominium",
  "condominiumSupplier",
  "f24",
  "installmentItem",
  "ledgerInvoice2F24",
]);
