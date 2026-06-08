import {
  pgTable,
  integer,
  varchar,
  char,
  text,
  boolean,
  timestamp,
  date,
  numeric,
  real,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  ledgerAccountType,
  ledgerAccountKind,
  ledgerEntryType,
  ledgerEntry2UrDistributionType,
  ledgerTransactionType,
  expenseLa2TableType,
  costAttributionOnHandover,
  nextPeriodEstimateBasedOn,
} from "../enums.ts";
import { studio, masterData } from "./masterData.ts";
import { locale } from "./reference.ts";
import { country } from "./reference.ts";
import { accountingPeriod } from "./installment.ts";
import { installmentItem } from "./installment.ts";
import { condominium, unit, unitGroup, unitResident } from "./condominium.ts";
import { unitResidentPriority } from "./condominium.ts";
import { distributionTable } from "./distribution.ts";

// ---------------------------------------------------------------------------
// ledgerAccount
// ---------------------------------------------------------------------------
export const ledgerAccount = pgTable("ledger_account", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => studio.id),
  accountingPeriodId: integer("accounting_period_id")
    .notNull()
    .references((): AnyPgColumn => accountingPeriod.id),
  name: varchar("name", { length: 255 }).notNull(),
  abbreviation: varchar("abbreviation", { length: 63 }),
  description: text("description"),
  type: ledgerAccountType("type").notNull(),
  order: integer("order"),
  parentLedgerAccountId: integer("parent_ledger_account_id").references(
    (): AnyPgColumn => ledgerAccount.id,
  ),
  defaultCounterAccountId: integer("default_counter_account_id").references(
    (): AnyPgColumn => ledgerAccount.id,
  ),
  defaultCounterAccountMasterDataId: integer(
    "default_counter_account_master_data_id",
  ).references(() => masterData.id),
  kind: ledgerAccountKind("kind").notNull(),
  periodRestrictionStartDate: date("period_restriction_start_date"),
  periodRestrictionEndDate: date("period_restriction_end_date"),
  balanceHardLowerLimit: numeric("balance_hard_lower_limit", {
    precision: 10,
    scale: 2,
  }),
  balanceHardUpperLimit: numeric("balance_hard_upper_limit", {
    precision: 10,
    scale: 2,
  }),
  balanceSoftLowerLimit: numeric("balance_soft_lower_limit", {
    precision: 10,
    scale: 2,
  }),
  balanceSoftUpperLimit: numeric("balance_soft_upper_limit", {
    precision: 10,
    scale: 2,
  }),
  notes: text("notes"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// ledgerAccountI18n
// ---------------------------------------------------------------------------
export const ledgerAccountI18n = pgTable(
  "ledger_account_i18n",
  {
    ledgerAccountId: integer("ledger_account_id")
      .notNull()
      .references(() => ledgerAccount.id),
    localeCode: varchar("locale_code", { length: 10 })
      .notNull()
      .references(() => locale.code),
    studioId: integer("studio_id")
      .notNull()
      .references(() => studio.id),
    nameTranslation: varchar("name_translation", { length: 255 }).notNull(),
    abbreviationTranslation: varchar("abbreviation_translation", {
      length: 63,
    }),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.ledgerAccountId, t.localeCode] }),
  }),
);

// ---------------------------------------------------------------------------
// ledgerEntry
// ---------------------------------------------------------------------------
export const ledgerEntry = pgTable("ledger_entry", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => studio.id),
  ledgerTransactionId: integer("ledger_transaction_id")
    .notNull()
    .references((): AnyPgColumn => ledgerTransaction.id),
  postingAccountId: integer("posting_account_id")
    .notNull()
    .references((): AnyPgColumn => ledgerAccount.id),
  masterDataId: integer("master_data_id").references(() => masterData.id),
  unitResidentId: integer("unit_resident_id").references(() => unitResident.id),
  installmentItemId: integer("installment_item_id").references(
    () => installmentItem.id,
  ),
  ledgerInvoiceId: integer("ledger_invoice_id").references(
    () => ledgerInvoice.id,
  ),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  order: integer("order").notNull(),
  type: ledgerEntryType("type"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// ledgerEntry2URDistribution
// ---------------------------------------------------------------------------
export const ledgerEntry2UrDistribution = pgTable(
  "ledger_entry_2_ur_distribution",
  {
    ledgerEntryId: integer("ledger_entry_id")
      .notNull()
      .references(() => ledgerEntry.id),
    unitResidentId: integer("unit_resident_id")
      .notNull()
      .references(() => unitResident.id),
    studioId: integer("studio_id")
      .notNull()
      .references(() => studio.id),
    type: ledgerEntry2UrDistributionType("type"),
    amount: numeric("amount", { precision: 10, scale: 2 }),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.ledgerEntryId, t.unitResidentId] }),
  }),
);

// ---------------------------------------------------------------------------
// ledgerInvoice
// ---------------------------------------------------------------------------
export const ledgerInvoice = pgTable("ledger_invoice", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => studio.id),
  accountingPeriodId: integer("accounting_period_id")
    .notNull()
    .references(() => accountingPeriod.id),
  masterDataId: integer("master_data_id")
    .notNull()
    .references(() => masterData.id),
  number: varchar("number", { length: 15 }).notNull(),
  description: varchar("description", { length: 127 }),
  date: date("date").notNull(),
  expiryDate: date("expiry_date"),
  settlementDate: date("settlement_date"),
  taxableBase: numeric("taxable_base", { precision: 10, scale: 2 }).notNull(),
  totalTaxFreeAmount: numeric("total_tax_free_amount", {
    precision: 10,
    scale: 2,
  }),
  welfareTaxPercentage: numeric("welfare_tax_percentage", {
    precision: 5,
    scale: 2,
  }),
  vatPercentage: numeric("vat_percentage", { precision: 5, scale: 2 }),
  mixedVatAmount: numeric("mixed_vat_amount", { precision: 10, scale: 2 }),
  withholdingTaxId: integer("withholding_tax_id").references(
    () => withholdingTax.id,
  ),
  applyWithholdingTaxOnWelfareTax: integer(
    "apply_withholding_tax_on_welfare_tax",
  ).notNull(),
  quadroAc: integer("quadro_ac").notNull(),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// ledgerInvoice2F24
// ---------------------------------------------------------------------------
export const ledgerInvoice2F24 = pgTable(
  "ledger_invoice_2_f24",
  {
    f24Id: integer("f24_id")
      .notNull()
      .references(() => f24.id),
    ledgerInvoiceId: integer("ledger_invoice_id")
      .notNull()
      .references(() => ledgerInvoice.id),
    studioId: integer("studio_id")
      .notNull()
      .references(() => studio.id),
    ledgerEntryId: integer("ledger_entry_id").references(() => ledgerEntry.id),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.f24Id, t.ledgerInvoiceId] }),
  }),
);

// ---------------------------------------------------------------------------
// ledgerTransaction
// ---------------------------------------------------------------------------
export const ledgerTransaction = pgTable("ledger_transaction", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => studio.id),
  accountingPeriodId: integer("accounting_period_id")
    .notNull()
    .references(() => accountingPeriod.id),
  code: integer("code").notNull(),
  type: ledgerTransactionType("type"),
  ledgerInvoiceId: integer("ledger_invoice_id").references(
    () => ledgerInvoice.id,
  ),
  timestamp: timestamp("timestamp", { withTimezone: true }),
  description: varchar("description", { length: 255 }).notNull(),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// expenseLedgerAccount
// ---------------------------------------------------------------------------
export const expenseLedgerAccount = pgTable("expense_ledger_account", {
  ledgerAccountId: integer("ledger_account_id")
    .primaryKey()
    .references(() => ledgerAccount.id),
  restrictionUnitGroupId: integer("restriction_unit_group_id").references(
    () => unitGroup.id,
  ),
  estimate: numeric("estimate", { precision: 10, scale: 2 }),
  useDistinctTablesForEstimate: boolean("use_distinct_tables_for_estimate"),
  costAttributionOnHandover: costAttributionOnHandover(
    "cost_attribution_on_handover",
  ),
  nextPeriodEstimateBasedOn: nextPeriodEstimateBasedOn(
    "next_period_estimate_based_on",
  ),
  nextPeriodEstimateIncreasePercentage: real(
    "next_period_estimate_increase_percentage",
  ),
  nextPeriodEstimateIncreaseFixedAmount: numeric(
    "next_period_estimate_increase_fixed_amount",
    { precision: 10, scale: 2 },
  ),
  taxReliefId: integer("tax_relief_id").references(() => taxRelief.id),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// expenseLA2Role
// ---------------------------------------------------------------------------
export const expenseLA2Role = pgTable(
  "expense_la2_role",
  {
    expenseLA2TableId: integer("expense_la2_table_id")
      .notNull()
      .references(() => expenseLA2Table.id),
    unitResidentPriorityId: integer("unit_resident_priority_id")
      .notNull()
      .references(() => unitResidentPriority.id),
    studioId: integer("studio_id")
      .notNull()
      .references(() => studio.id),
    percentage: numeric("percentage", { precision: 5, scale: 2 }),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({
      columns: [t.expenseLA2TableId, t.unitResidentPriorityId],
    }),
  }),
);

// ---------------------------------------------------------------------------
// expenseLA2Table
// ---------------------------------------------------------------------------
export const expenseLA2Table = pgTable("expense_la2_table", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => studio.id),
  expenseLedgerAccountId: integer("expense_ledger_account_id")
    .notNull()
    .references(() => expenseLedgerAccount.ledgerAccountId),
  distributionTableId: integer("distribution_table_id")
    .notNull()
    .references(() => distributionTable.id),
  type: expenseLa2TableType("type"),
  percentage: numeric("percentage", { precision: 5, scale: 2 }),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// expenseLAUnitException
// ---------------------------------------------------------------------------
export const expenseLAUnitException = pgTable("expense_la_unit_exception", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => studio.id),
  expenseLedgerAccountId: integer("expense_ledger_account_id")
    .notNull()
    .references(() => expenseLedgerAccount.ledgerAccountId),
  unitId: integer("unit_id")
    .notNull()
    .references(() => unit.id),
  expenseLA2TableId: integer("expense_la2_table_id").references(
    () => expenseLA2Table.id,
  ),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// expenseLAUnitExceptionItem
// ---------------------------------------------------------------------------
export const expenseLAUnitExceptionItem = pgTable(
  "expense_la_unit_exception_item",
  {
    expenseLAUnitExceptionId: integer("expense_la_unit_exception_id")
      .notNull()
      .references(() => expenseLAUnitException.id),
    unitResidentPriorityId: integer("unit_resident_priority_id")
      .notNull()
      .references(() => unitResidentPriority.id),
    studioId: integer("studio_id")
      .notNull()
      .references(() => studio.id),
    percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({
      columns: [t.expenseLAUnitExceptionId, t.unitResidentPriorityId],
    }),
  }),
);

// ---------------------------------------------------------------------------
// withholdingTax
// ---------------------------------------------------------------------------
export const withholdingTax = pgTable("withholding_tax", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  countryIso31661A2: char("country_iso3166_1_a2", { length: 2 })
    .notNull()
    .references(() => country.iso31661Alpha2),
  code: varchar("code", { length: 10 }),
  name: varchar("name", { length: 32 }).notNull(),
  description: varchar("description", { length: 255 }),
  percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
  notes: text("notes"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// withholdingTax2LA
// ---------------------------------------------------------------------------
export const withholdingTax2LA = pgTable(
  "withholding_tax_2_la",
  {
    withholdingTaxId: integer("withholding_tax_id")
      .notNull()
      .references(() => withholdingTax.id),
    ledgerAccountId: integer("ledger_account_id")
      .notNull()
      .references(() => ledgerAccount.id),
    studioId: integer("studio_id")
      .notNull()
      .references(() => studio.id),
    accountingPeriodId: integer("accounting_period_id")
      .notNull()
      .references(() => accountingPeriod.id),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.withholdingTaxId, t.ledgerAccountId] }),
  }),
);

// ---------------------------------------------------------------------------
// taxRelief
// ---------------------------------------------------------------------------
export const taxRelief = pgTable("tax_relief", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  countryIso31661A2: char("country_iso3166_1_a2", { length: 2 })
    .notNull()
    .references(() => country.iso31661Alpha2),
  name: varchar("name", { length: 63 }).notNull(),
  description: text("description"),
  percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// tribute
// ---------------------------------------------------------------------------
export const tribute = pgTable("tribute", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  countryIso31661A2: char("country_iso3166_1_a2", { length: 2 })
    .notNull()
    .references(() => country.iso31661Alpha2),
  code: varchar("code", { length: 15 }).notNull(),
  name: varchar("name", { length: 63 }),
  defaultVat: integer("default_vat"),
  defaultWithholdingTax: integer("default_withholding_tax"),
  defaultWelfareTax: integer("default_welfare_tax"),
  notes: text("notes"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// consumptionMeter
// ---------------------------------------------------------------------------
export const consumptionMeter = pgTable("consumption_meter", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => studio.id),
  name: varchar("name", { length: 63 }).notNull(),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// f24
// ---------------------------------------------------------------------------
export const f24 = pgTable("f24", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => studio.id),
  condominiumId: integer("condominium_id")
    .notNull()
    .references(() => condominium.id),
  referenceDate: date("reference_date"),
  paymentDate: date("payment_date"),
  confirmed: boolean("confirmed").notNull(),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});
