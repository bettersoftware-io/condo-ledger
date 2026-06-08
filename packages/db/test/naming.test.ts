import { describe, it, expect } from "vitest";
import { toSnake, toCamel } from "../src/naming.ts";

// Cases that round-trip losslessly in BOTH directions.
const cases: Array<[camel: string, snake: string]> = [
  ["studioId", "studio_id"],
  ["unitResident", "unit_resident"],
  ["ledgerTransaction", "ledger_transaction"],
  ["accountingPeriodInstallmentDefaultSettings", "accounting_period_installment_default_settings"],
  ["masterDataCategoryI18n", "master_data_category_i18n"],
  ["ledgerInvoice2F24", "ledger_invoice_2_f24"],
  ["bankTransferPO", "bank_transfer_po"],
  ["ledgerEntry2URDistribution", "ledger_entry_2_ur_distribution"],
  ["nextPeriodEstimateBasedOn", "next_period_estimate_based_on"],
  // Pin the tricky tokens so they never regress:
  // LA acronym, junction-2, fused LA2, fused f24, the "770" tax-form token.
  ["expenseLAUnitException", "expense_la_unit_exception"],
  ["expenseLAUnitExceptionItem", "expense_la_unit_exception_item"],
  ["expenseLA2Table", "expense_la2_table"],
  ["withholdingTax2LA", "withholding_tax_2_la"],
  ["f24", "f24"],
  ["f24Id", "f24_id"],
  ["tax770", "tax_770"],
];

// Cases where toSnake must be correct but the pair is NOT round-trippable: the
// legacy camel spelling already contains underscores around digit groups
// (e.g. `countryIso3166_1_a2`), and toCamel cannot reconstruct where those
// underscores went. The ETL only relies on the toSnake direction, so we pin only
// that. (Actual legacy column spellings taken from the DDL.)
const toSnakeOnly: Array<[camel: string, snake: string]> = [
  ["countryIso3166_1_a2", "country_iso3166_1_a2"],
  ["citizenshipIso3166_1_a2", "citizenship_iso3166_1_a2"],
  ["iso3166_1_alpha2", "iso3166_1_alpha2"],
  ["iso3166_1_alpha1", "iso3166_1_alpha1"],
  ["iso3166_1_numeric", "iso3166_1_numeric"],
];

describe("naming", () => {
  it.each(cases)("toSnake(%s) === %s", (camel, snake) => {
    expect(toSnake(camel)).toBe(snake);
  });
  it.each(cases)("toCamel round-trips %s", (camel, snake) => {
    expect(toCamel(snake)).toBe(camel);
  });
  it.each(toSnakeOnly)("toSnake(%s) === %s (toSnake-only; not reversible)", (camel, snake) => {
    expect(toSnake(camel)).toBe(snake);
  });
});
