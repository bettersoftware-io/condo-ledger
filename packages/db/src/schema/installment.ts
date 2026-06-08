import {
  pgTable,
  integer,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  numeric,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  accountingPeriodType,
  accountingPeriodStatus,
  openingBalanceDistributionMode,
  installmentType,
  installmentItemStatus,
  installmentPaymentSlipStatus,
} from "../enums.ts";
import { studio, masterData } from "./masterData.ts";
import { locale } from "./reference.ts";
import { condominium, unitResident } from "./condominium.ts";
import { ledgerAccount } from "./accounting.ts";

// ---------------------------------------------------------------------------
// accountingPeriod
// ---------------------------------------------------------------------------
export const accountingPeriod = pgTable("accounting_period", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => studio.id),
  condominiumId: integer("condominium_id")
    .notNull()
    .references((): AnyPgColumn => condominium.id),
  name: varchar("name", { length: 31 }).notNull(),
  type: accountingPeriodType("type").notNull(),
  status: accountingPeriodStatus("status").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  supplierAccountsPayableLedgerAccountId: integer(
    "supplier_accounts_payable_ledger_account_id",
  ).references((): AnyPgColumn => ledgerAccount.id),
  flatResidentAccountsReceivableLedgerAccountId: integer(
    "flat_resident_accounts_receivable_ledger_account_id",
  ).references(() => ledgerAccount.id),
  flatResidentRoundingOffLedgerAccountId: integer(
    "flat_resident_rounding_off_ledger_account_id",
  ).references(() => ledgerAccount.id),
  individualExpensesLedgerAccountId: integer(
    "individual_expenses_ledger_account_id",
  ).references(() => ledgerAccount.id),
  defaultCheckingAccountLedgerAccountId: integer(
    "default_checking_account_ledger_account_id",
  ).references(() => ledgerAccount.id),
  paymentInCashLedgerAccountId: integer(
    "payment_in_cash_ledger_account_id",
  ).references(() => ledgerAccount.id),
  withholdingTaxPenaltyLedgerAccountId: integer(
    "withholding_tax_penalty_ledger_account_id",
  ).references(() => ledgerAccount.id),
  notes: text("notes"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// accountingPeriodInstallmentDefaultSettings
// ---------------------------------------------------------------------------
export const accountingPeriodInstallmentDefaultSettings = pgTable(
  "accounting_period_installment_default_settings",
  {
    accountingPeriodId: integer("accounting_period_id")
      .primaryKey()
      .references(() => accountingPeriod.id),
    studioId: integer("studio_id")
      .notNull()
      .references(() => studio.id),
    numberOfInstallments: integer("number_of_installments"),
    firstInstallmentExpiryDate: date("first_installment_expiry_date"),
    periodInMonths: integer("period_in_months"),
    creditOpeningBalanceDistributionMode: openingBalanceDistributionMode(
      "credit_opening_balance_distribution_mode",
    ).notNull(),
    creditOpeningBalanceSpecificInstallment: integer(
      "credit_opening_balance_specific_installment",
    ).notNull(),
    debtOpeningBalanceDistributionMode: openingBalanceDistributionMode(
      "debt_opening_balance_distribution_mode",
    ).notNull(),
    debtOpeningBalanceSpecificInstallment: integer(
      "debt_opening_balance_specific_installment",
    ).notNull(),
    roundOffToInteger: boolean("round_off_to_integer").notNull(),
    deductIssuedInstallments: boolean("deduct_issued_installments").notNull(),
    deductDownpayments: boolean("deduct_downpayments").notNull(),
    lastDownpaymentDateToDeduct: date("last_downpayment_date_to_deduct"),
    redistributeDeduction: boolean("redistribute_deduction").notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
);

// ---------------------------------------------------------------------------
// installment
// ---------------------------------------------------------------------------
export const installment = pgTable("installment", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => studio.id),
  accountingPeriodId: integer("accounting_period_id")
    .notNull()
    .references(() => accountingPeriod.id),
  installmentGroupId: integer("installment_group_id").references(
    () => installmentGroup.id,
  ),
  type: installmentType("type").notNull(),
  name: varchar("name", { length: 63 }).notNull(),
  expiryDate: date("expiry_date").notNull(),
  percentage: integer("percentage"),
  previousBalancePercentage: integer("previous_balance_percentage"),
  locked: boolean("locked").notNull(),
  roundedUpToInteger: boolean("rounded_up_to_integer").notNull(),
  notes: text("notes"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// installmentI18n
// ---------------------------------------------------------------------------
export const installmentI18n = pgTable(
  "installment_i18n",
  {
    installmentId: integer("installment_id")
      .notNull()
      .references(() => installment.id),
    localeCode: varchar("locale_code", { length: 10 })
      .notNull()
      .references(() => locale.code),
    studioId: integer("studio_id")
      .notNull()
      .references(() => studio.id),
    translation: varchar("translation", { length: 63 }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.installmentId, t.localeCode] }),
  }),
);

// ---------------------------------------------------------------------------
// installmentGroup
// ---------------------------------------------------------------------------
export const installmentGroup = pgTable("installment_group", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => studio.id),
  accountingPeriodId: integer("accounting_period_id")
    .notNull()
    .references(() => accountingPeriod.id),
  name: varchar("name", { length: 63 }).notNull(),
  type: installmentType("type").notNull(),
  numberOfInstallments: integer("number_of_installments"),
  firstInstallmentExpiryDate: date("first_installment_expiry_date").notNull(),
  periodInMonths: integer("period_in_months"),
  creditOpeningBalanceDistributionMode: openingBalanceDistributionMode(
    "credit_opening_balance_distribution_mode",
  ).notNull(),
  creditOpeningBalanceSpecificInstallment: integer(
    "credit_opening_balance_specific_installment",
  ).notNull(),
  debtOpeningBalanceDistributionMode: openingBalanceDistributionMode(
    "debt_opening_balance_distribution_mode",
  ).notNull(),
  debtOpeningBalanceSpecificInstallment: integer(
    "debt_opening_balance_specific_installment",
  ).notNull(),
  roundOffToInteger: boolean("round_off_to_integer").notNull(),
  deductIssuedInstallments: boolean("deduct_issued_installments").notNull(),
  deductDownpayments: boolean("deduct_downpayments").notNull(),
  lastDownpaymentDateToDeduct: date("last_downpayment_date_to_deduct"),
  redistributeDeduction: boolean("redistribute_deduction").notNull(),
  notes: text("notes"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// installmentGroupI18n
// ---------------------------------------------------------------------------
export const installmentGroupI18n = pgTable(
  "installment_group_i18n",
  {
    installmentGroupId: integer("installment_group_id")
      .notNull()
      .references(() => installmentGroup.id),
    localeCode: varchar("locale_code", { length: 10 })
      .notNull()
      .references(() => locale.code),
    studioId: integer("studio_id")
      .notNull()
      .references(() => studio.id),
    translation: varchar("translation", { length: 63 }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.installmentGroupId, t.localeCode] }),
  }),
);

// ---------------------------------------------------------------------------
// installmentItem
// ---------------------------------------------------------------------------
export const installmentItem = pgTable("installment_item", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => studio.id),
  installmentId: integer("installment_id")
    .notNull()
    .references(() => installment.id),
  unitResidentId: integer("unit_resident_id")
    .notNull()
    .references((): AnyPgColumn => unitResident.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: installmentItemStatus("status").notNull(),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// installmentPaymentSlip
// ---------------------------------------------------------------------------
export const installmentPaymentSlip = pgTable("installment_payment_slip", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => studio.id),
  code: varchar("code", { length: 63 }),
  masterDataId: integer("master_data_id")
    .notNull()
    .references(() => masterData.id),
  status: installmentPaymentSlipStatus("status").notNull(),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// installmentPaymentSlipItem
// ---------------------------------------------------------------------------
export const installmentPaymentSlipItem = pgTable(
  "installment_payment_slip_item",
  {
    installmentPaymentSlipId: integer("installment_payment_slip_id")
      .notNull()
      .references(() => installmentPaymentSlip.id),
    installmentItemId: integer("installment_item_id")
      .notNull()
      .references(() => installmentItem.id),
    studioId: integer("studio_id")
      .notNull()
      .references(() => studio.id),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({
      columns: [t.installmentPaymentSlipId, t.installmentItemId],
    }),
  }),
);
