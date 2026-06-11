// Best-effort parents-first load order over the legacy camelCase table names.
//
// Order is NOT correctness-critical: the load runs under
// `session_replication_role = 'replica'`, which disables FK trigger checks, so
// children can be inserted before parents without error. The ordering exists for
// (a) log readability — "loaded N into X" lines read top-down parent->child — and
// (b) a deterministic per-table sequence resync sweep afterward.
//
// Three tiers, parents first:
//   Tier A — locale/country reference data (no FKs into our data).
//   Tier B — master-data parents referenced by the operational rows.
//   Tier C — the 21 operational tables present in the per-condominium dumps.
export const LOAD_ORDER: string[] = [
  // Tier A
  "country",
  "locale",
  "localeI18n",
  // Tier B
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
  // Tier C
  "condominium",
  "condominiumSupplier",
  "accountingPeriod",
  "accountingPeriodInstallmentDefaultSettings",
  "unitGroup",
  "unit",
  "unitPeriod",
  "unitResident",
  "distributionTable",
  "distributionTableItem",
  "expenseLedgerAccount",
  "expenseLA2Role",
  "expenseLA2Table",
  "ledgerAccount",
  "ledgerTransaction",
  "ledgerEntry",
  "ledgerInvoice",
  "ledgerInvoice2F24",
  "f24",
  "installment",
  "installmentItem",
];
