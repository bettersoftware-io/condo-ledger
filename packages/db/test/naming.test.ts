import { describe, it, expect } from "vitest";
import { toSnake, toCamel } from "../src/naming.ts";

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
];

describe("naming", () => {
  it.each(cases)("toSnake(%s) === %s", (camel, snake) => {
    expect(toSnake(camel)).toBe(snake);
  });
  it.each(cases)("toCamel round-trips %s", (camel, snake) => {
    expect(toCamel(snake)).toBe(camel);
  });
});
