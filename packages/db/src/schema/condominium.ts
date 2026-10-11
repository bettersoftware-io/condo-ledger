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
  recordStatus,
  condominiumType,
  accountingPeriodType,
  accountingPeriodStatus,
  openingBalanceDistributionMode,
  installmentType,
  installmentItemStatus,
  installmentPaymentSlipStatus,
  ledgerAccountType,
  ledgerAccountKind,
  ledgerEntryType,
  ledgerEntry2UrDistributionType,
  ledgerTransactionType,
  expenseLa2TableType,
  costAttributionOnHandover,
  nextPeriodEstimateBasedOn,
} from "../enums.ts";
import {
  studio,
  masterData,
  bankAccount,
  accessAccount,
} from "./masterData.ts";
import { country, locale } from "./reference.ts";
import { calendarEvent } from "./leftovers.ts";

// A condominium's own tables: its units and residents, its accounting periods
// and installments, its ledger and its distribution tables. They reference one
// another in cycles (an accounting period and its ledger account; an
// installment item, a resident and a ledger entry), so they are one module: a
// cycle between modules fails the dependency gate.

// ---------------------------------------------------------------------------
// condominium
// ---------------------------------------------------------------------------
export const condominium = pgTable("condominium", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => {return studio.id}),
  parentCondominiumId: integer("parent_condominium_id").references(
    (): AnyPgColumn => {return condominium.id},
  ),
  name: varchar("name", { length: 63 }).notNull(),
  code: varchar("code", { length: 15 }),
  status: recordStatus("status"),
  type: condominiumType("type").notNull(),
  address: text("address"),
  taxCode: varchar("tax_code", { length: 31 }),
  vatNumber: varchar("vat_number", { length: 31 }),
  manufacturedDate: date("manufactured_date"),
  landRegistry: varchar("land_registry", { length: 127 }),
  bankAccountId: integer("bank_account_id").references(() => {return bankAccount.id}),
  notes: text("notes"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// condominiumAttribute
// ---------------------------------------------------------------------------
export const condominiumAttribute = pgTable("condominium_attribute", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => {return studio.id}),
  condominiumId: integer("condominium_id")
    .notNull()
    .references(() => {return condominium.id}),
  label: varchar("label", { length: 31 }).notNull(),
  value: varchar("value", { length: 31 }).notNull(),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// condominiumAttributeI18n
// ---------------------------------------------------------------------------
export const condominiumAttributeI18n = pgTable(
  "condominium_attribute_i18n",
  {
    condominiumAttributeId: integer("condominium_attribute_id")
      .notNull()
      .references(() => {return condominiumAttribute.id}),
    localeCode: varchar("locale_code", { length: 10 })
      .notNull()
      .references(() => {return locale.code}),
    studioId: integer("studio_id")
      .notNull()
      .references(() => {return studio.id}),
    labelTranslation: varchar("label_translation", { length: 63 }).notNull(),
    valueTranslation: varchar("value_translation", { length: 63 }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => {return {
    pk: primaryKey({ columns: [t.condominiumAttributeId, t.localeCode] }),
  }},
);

// ---------------------------------------------------------------------------
// condominiumCalendarEvent
// ---------------------------------------------------------------------------
export const condominiumCalendarEvent = pgTable("condominium_calendar_event", {
  calendarEventId: integer("calendar_event_id")
    .primaryKey()
    .references(() => {return calendarEvent.id}),
  condominiumId: integer("condominium_id").references(() => {return condominium.id}),
  accountingPeriodId: integer("accounting_period_id").references(
    () => {return accountingPeriod.id},
  ),
  unitGroupId: integer("unit_group_id").references(() => {return unitGroup.id}),
  unitId: integer("unit_id").references(() => {return unit.id}),
  unitResidentId: integer("unit_resident_id").references(() => {return unitResident.id}),
  masterDataId: integer("master_data_id").references(() => {return masterData.id}),
  showOnFrontend: boolean("show_on_frontend").notNull(),
  showDate: boolean("show_date").notNull(),
  showFrom: date("show_from"),
  showTo: date("show_to"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// condominiumSupplier
// ---------------------------------------------------------------------------
export const condominiumSupplier = pgTable(
  "condominium_supplier",
  {
    condominiumId: integer("condominium_id")
      .notNull()
      .references(() => {return condominium.id}),
    masterDataId: integer("master_data_id")
      .notNull()
      .references(() => {return masterData.id}),
    studioId: integer("studio_id")
      .notNull()
      .references(() => {return studio.id}),
    order: integer("order"),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => {return {
    pk: primaryKey({ columns: [t.condominiumId, t.masterDataId] }),
  }},
);

// ---------------------------------------------------------------------------
// unit
// ---------------------------------------------------------------------------
export const unit = pgTable("unit", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => {return studio.id}),
  accountingPeriodId: integer("accounting_period_id")
    .notNull()
    .references(() => {return accountingPeriod.id}),
  unitTypeId: integer("unit_type_id").references(() => {return unitType.id}),
  unitGroupId: integer("unit_group_id").references(() => {return unitGroup.id}),
  code: varchar("code", { length: 15 }),
  name: varchar("name", { length: 63 }),
  floor: varchar("floor", { length: 15 }),
  innerNumber: varchar("inner_number", { length: 15 }),
  subordinateNumber: varchar("subordinate_number", { length: 15 }),
  periodRestrictionStartDate: date("period_restriction_start_date"),
  periodRestrictionEndDate: date("period_restriction_end_date"),
  landRegistry: varchar("land_registry", { length: 127 }),
  notes: text("notes"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// unitGroup
// ---------------------------------------------------------------------------
export const unitGroup = pgTable("unit_group", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => {return studio.id}),
  parentUnitGroupId: integer("parent_unit_group_id").references(
    (): AnyPgColumn => {return unitGroup.id},
  ),
  accountingPeriodId: integer("accounting_period_id")
    .notNull()
    .references(() => {return accountingPeriod.id}),
  code: varchar("code", { length: 15 }).notNull(),
  name: varchar("name", { length: 127 }).notNull(),
  address: text("address"),
  notes: text("notes"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// unitPeriod
// ---------------------------------------------------------------------------
export const unitPeriod = pgTable("unit_period", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => {return studio.id}),
  unitId: integer("unit_id")
    .notNull()
    .references(() => {return unit.id}),
  unitOwnershipScenarioId: integer("unit_ownership_scenario_id")
    .notNull()
    .references(() => {return unitOwnershipScenario.id}),
  periodRestrictionStartDate: date("period_restriction_start_date"),
  periodRestrictionEndDate: date("period_restriction_end_date"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// unitResident
// ---------------------------------------------------------------------------
export const unitResident = pgTable("unit_resident", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => {return studio.id}),
  unitPeriodId: integer("unit_period_id")
    .notNull()
    .references(() => {return unitPeriod.id}),
  masterDataId: integer("master_data_id")
    .notNull()
    .references(() => {return masterData.id}),
  systemUsername: varchar("system_username", { length: 63 })
    .notNull()
    .references(() => {return unitResidentAccount.systemUsername}),
  unitResidentPriorityId: integer("unit_resident_priority_id")
    .notNull()
    .references(() => {return unitResidentPriority.id}),
  periodRestrictionStartDate: date("period_restriction_start_date"),
  periodRestrictionEndDate: date("period_restriction_end_date"),
  percentage: numeric("percentage", { precision: 10, scale: 6 }),
  startingBalance: numeric("starting_balance", {
    precision: 10,
    scale: 2,
  }).notNull(),
  startingBalanceLedgerEntryId: integer(
    "starting_balance_ledger_entry_id",
  ).references((): AnyPgColumn => {return ledgerEntry.id}),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// unitResidentAccount
// ---------------------------------------------------------------------------
export const unitResidentAccount = pgTable("unit_resident_account", {
  systemUsername: varchar("system_username", { length: 63 })
    .primaryKey()
    .references(() => {return accessAccount.username}),
  studioId: integer("studio_id")
    .notNull()
    .references(() => {return studio.id}),
  activationClearTextPassword: varchar("activation_clear_text_password", {
    length: 63,
  }),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// unitResidentPriority
// ---------------------------------------------------------------------------
export const unitResidentPriority = pgTable("unit_resident_priority", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  countryIso31661A2: char("country_iso3166_1_a2", { length: 2 })
    .notNull()
    .references(() => {return country.iso31661Alpha2}),
  priority: integer("priority").notNull(),
  rolesAbbreviationList: varchar("roles_abbreviation_list", { length: 15 }),
  notes: text("notes"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// unitResidentRole
// ---------------------------------------------------------------------------
export const unitResidentRole = pgTable("unit_resident_role", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  countryIso31661A2: char("country_iso3166_1_a2", { length: 2 })
    .notNull()
    .references(() => {return country.iso31661Alpha2}),
  unitOwnershipScenarioId: integer("unit_ownership_scenario_id")
    .notNull()
    .references(() => {return unitOwnershipScenario.id}),
  unitResidentPriorityId: integer("unit_resident_priority_id")
    .notNull()
    .references(() => {return unitResidentPriority.id}),
  abbreviation: varchar("abbreviation", { length: 15 }).notNull(),
  name: varchar("name", { length: 63 }).notNull(),
  pluralName: varchar("plural_name", { length: 63 }).notNull(),
  notes: text("notes"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// unitResidentRoleI18n
// ---------------------------------------------------------------------------
export const unitResidentRoleI18n = pgTable(
  "unit_resident_role_i18n",
  {
    unitResidentRoleId: integer("unit_resident_role_id")
      .notNull()
      .references(() => {return unitResidentRole.id}),
    localeCode: varchar("locale_code", { length: 10 })
      .notNull()
      .references(() => {return locale.code}),
    abbreviationTranslation: varchar("abbreviation_translation", {
      length: 15,
    }).notNull(),
    nameTranslation: varchar("name_translation", { length: 63 }).notNull(),
    pluralNameTranslation: varchar("plural_name_translation", {
      length: 63,
    }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => {return {
    pk: primaryKey({ columns: [t.unitResidentRoleId, t.localeCode] }),
  }},
);

// ---------------------------------------------------------------------------
// unitType
// ---------------------------------------------------------------------------
export const unitType = pgTable("unit_type", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => {return studio.id}),
  name: varchar("name", { length: 63 }).notNull(),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// unitTypeI18n
// ---------------------------------------------------------------------------
export const unitTypeI18n = pgTable(
  "unit_type_i18n",
  {
    unitTypeId: integer("unit_type_id")
      .notNull()
      .references(() => {return unitType.id}),
    localeCode: varchar("locale_code", { length: 10 })
      .notNull()
      .references(() => {return locale.code}),
    studioId: integer("studio_id")
      .notNull()
      .references(() => {return studio.id}),
    translation: varchar("translation", { length: 63 }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => {return {
    pk: primaryKey({ columns: [t.unitTypeId, t.localeCode] }),
  }},
);

// ---------------------------------------------------------------------------
// unitOwnershipScenario
// ---------------------------------------------------------------------------
export const unitOwnershipScenario = pgTable("unit_ownership_scenario", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  countryIso31661A2: char("country_iso3166_1_a2", { length: 2 })
    .notNull()
    .references(() => {return country.iso31661Alpha2}),
  name: varchar("name", { length: 63 }).notNull(),
  order: integer("order"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// unitOwnershipScenarioI18n
// ---------------------------------------------------------------------------
export const unitOwnershipScenarioI18n = pgTable(
  "unit_ownership_scenario_i18n",
  {
    unitOwnershipScenarioId: integer("unit_ownership_scenario_id")
      .notNull()
      .references(() => {return unitOwnershipScenario.id}),
    localeCode: varchar("locale_code", { length: 10 })
      .notNull()
      .references(() => {return locale.code}),
    translation: varchar("translation", { length: 63 }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => {return {
    pk: primaryKey({ columns: [t.unitOwnershipScenarioId, t.localeCode] }),
  }},
);

// ---------------------------------------------------------------------------
// accountingPeriod
// ---------------------------------------------------------------------------
export const accountingPeriod = pgTable("accounting_period", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => {return studio.id}),
  condominiumId: integer("condominium_id")
    .notNull()
    .references((): AnyPgColumn => {return condominium.id}),
  name: varchar("name", { length: 31 }).notNull(),
  type: accountingPeriodType("type").notNull(),
  status: accountingPeriodStatus("status").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  supplierAccountsPayableLedgerAccountId: integer(
    "supplier_accounts_payable_ledger_account_id",
  ).references((): AnyPgColumn => {return ledgerAccount.id}),
  flatResidentAccountsReceivableLedgerAccountId: integer(
    "flat_resident_accounts_receivable_ledger_account_id",
  ).references(() => {return ledgerAccount.id}),
  flatResidentRoundingOffLedgerAccountId: integer(
    "flat_resident_rounding_off_ledger_account_id",
  ).references(() => {return ledgerAccount.id}),
  individualExpensesLedgerAccountId: integer(
    "individual_expenses_ledger_account_id",
  ).references(() => {return ledgerAccount.id}),
  defaultCheckingAccountLedgerAccountId: integer(
    "default_checking_account_ledger_account_id",
  ).references(() => {return ledgerAccount.id}),
  paymentInCashLedgerAccountId: integer(
    "payment_in_cash_ledger_account_id",
  ).references(() => {return ledgerAccount.id}),
  withholdingTaxPenaltyLedgerAccountId: integer(
    "withholding_tax_penalty_ledger_account_id",
  ).references(() => {return ledgerAccount.id}),
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
      .references(() => {return accountingPeriod.id}),
    studioId: integer("studio_id")
      .notNull()
      .references(() => {return studio.id}),
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
    .references(() => {return studio.id}),
  accountingPeriodId: integer("accounting_period_id")
    .notNull()
    .references(() => {return accountingPeriod.id}),
  installmentGroupId: integer("installment_group_id").references(
    () => {return installmentGroup.id},
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
      .references(() => {return installment.id}),
    localeCode: varchar("locale_code", { length: 10 })
      .notNull()
      .references(() => {return locale.code}),
    studioId: integer("studio_id")
      .notNull()
      .references(() => {return studio.id}),
    translation: varchar("translation", { length: 63 }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => {return {
    pk: primaryKey({ columns: [t.installmentId, t.localeCode] }),
  }},
);

// ---------------------------------------------------------------------------
// installmentGroup
// ---------------------------------------------------------------------------
export const installmentGroup = pgTable("installment_group", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => {return studio.id}),
  accountingPeriodId: integer("accounting_period_id")
    .notNull()
    .references(() => {return accountingPeriod.id}),
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
      .references(() => {return installmentGroup.id}),
    localeCode: varchar("locale_code", { length: 10 })
      .notNull()
      .references(() => {return locale.code}),
    studioId: integer("studio_id")
      .notNull()
      .references(() => {return studio.id}),
    translation: varchar("translation", { length: 63 }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => {return {
    pk: primaryKey({ columns: [t.installmentGroupId, t.localeCode] }),
  }},
);

// ---------------------------------------------------------------------------
// installmentItem
// ---------------------------------------------------------------------------
export const installmentItem = pgTable("installment_item", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => {return studio.id}),
  installmentId: integer("installment_id")
    .notNull()
    .references(() => {return installment.id}),
  unitResidentId: integer("unit_resident_id")
    .notNull()
    .references((): AnyPgColumn => {return unitResident.id}),
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
    .references(() => {return studio.id}),
  code: varchar("code", { length: 63 }),
  masterDataId: integer("master_data_id")
    .notNull()
    .references(() => {return masterData.id}),
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
      .references(() => {return installmentPaymentSlip.id}),
    installmentItemId: integer("installment_item_id")
      .notNull()
      .references(() => {return installmentItem.id}),
    studioId: integer("studio_id")
      .notNull()
      .references(() => {return studio.id}),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => {return {
    pk: primaryKey({
      columns: [t.installmentPaymentSlipId, t.installmentItemId],
    }),
  }},
);

// ---------------------------------------------------------------------------
// ledgerAccount
// ---------------------------------------------------------------------------
export const ledgerAccount = pgTable("ledger_account", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => {return studio.id}),
  accountingPeriodId: integer("accounting_period_id")
    .notNull()
    .references((): AnyPgColumn => {return accountingPeriod.id}),
  name: varchar("name", { length: 255 }).notNull(),
  abbreviation: varchar("abbreviation", { length: 63 }),
  description: text("description"),
  type: ledgerAccountType("type").notNull(),
  order: integer("order"),
  parentLedgerAccountId: integer("parent_ledger_account_id").references(
    (): AnyPgColumn => {return ledgerAccount.id},
  ),
  defaultCounterAccountId: integer("default_counter_account_id").references(
    (): AnyPgColumn => {return ledgerAccount.id},
  ),
  defaultCounterAccountMasterDataId: integer(
    "default_counter_account_master_data_id",
  ).references(() => {return masterData.id}),
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
      .references(() => {return ledgerAccount.id}),
    localeCode: varchar("locale_code", { length: 10 })
      .notNull()
      .references(() => {return locale.code}),
    studioId: integer("studio_id")
      .notNull()
      .references(() => {return studio.id}),
    nameTranslation: varchar("name_translation", { length: 255 }).notNull(),
    abbreviationTranslation: varchar("abbreviation_translation", {
      length: 63,
    }),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => {return {
    pk: primaryKey({ columns: [t.ledgerAccountId, t.localeCode] }),
  }},
);

// ---------------------------------------------------------------------------
// ledgerEntry
// ---------------------------------------------------------------------------
export const ledgerEntry = pgTable("ledger_entry", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => {return studio.id}),
  ledgerTransactionId: integer("ledger_transaction_id")
    .notNull()
    .references((): AnyPgColumn => {return ledgerTransaction.id}),
  postingAccountId: integer("posting_account_id")
    .notNull()
    .references((): AnyPgColumn => {return ledgerAccount.id}),
  masterDataId: integer("master_data_id").references(() => {return masterData.id}),
  unitResidentId: integer("unit_resident_id").references(() => {return unitResident.id}),
  installmentItemId: integer("installment_item_id").references(
    () => {return installmentItem.id},
  ),
  ledgerInvoiceId: integer("ledger_invoice_id").references(
    () => {return ledgerInvoice.id},
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
      .references(() => {return ledgerEntry.id}),
    unitResidentId: integer("unit_resident_id")
      .notNull()
      .references(() => {return unitResident.id}),
    studioId: integer("studio_id")
      .notNull()
      .references(() => {return studio.id}),
    type: ledgerEntry2UrDistributionType("type"),
    amount: numeric("amount", { precision: 10, scale: 2 }),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => {return {
    pk: primaryKey({ columns: [t.ledgerEntryId, t.unitResidentId] }),
  }},
);

// ---------------------------------------------------------------------------
// ledgerInvoice
// ---------------------------------------------------------------------------
export const ledgerInvoice = pgTable("ledger_invoice", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => {return studio.id}),
  accountingPeriodId: integer("accounting_period_id")
    .notNull()
    .references(() => {return accountingPeriod.id}),
  masterDataId: integer("master_data_id")
    .notNull()
    .references(() => {return masterData.id}),
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
    () => {return withholdingTax.id},
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
      .references(() => {return f24.id}),
    ledgerInvoiceId: integer("ledger_invoice_id")
      .notNull()
      .references(() => {return ledgerInvoice.id}),
    studioId: integer("studio_id")
      .notNull()
      .references(() => {return studio.id}),
    ledgerEntryId: integer("ledger_entry_id").references(() => {return ledgerEntry.id}),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => {return {
    pk: primaryKey({ columns: [t.f24Id, t.ledgerInvoiceId] }),
  }},
);

// ---------------------------------------------------------------------------
// ledgerTransaction
// ---------------------------------------------------------------------------
export const ledgerTransaction = pgTable("ledger_transaction", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => {return studio.id}),
  accountingPeriodId: integer("accounting_period_id")
    .notNull()
    .references(() => {return accountingPeriod.id}),
  code: integer("code").notNull(),
  type: ledgerTransactionType("type"),
  ledgerInvoiceId: integer("ledger_invoice_id").references(
    () => {return ledgerInvoice.id},
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
    .references(() => {return ledgerAccount.id}),
  restrictionUnitGroupId: integer("restriction_unit_group_id").references(
    () => {return unitGroup.id},
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
  taxReliefId: integer("tax_relief_id").references(() => {return taxRelief.id}),
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
      .references(() => {return expenseLA2Table.id}),
    unitResidentPriorityId: integer("unit_resident_priority_id")
      .notNull()
      .references(() => {return unitResidentPriority.id}),
    studioId: integer("studio_id")
      .notNull()
      .references(() => {return studio.id}),
    percentage: numeric("percentage", { precision: 5, scale: 2 }),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => {return {
    pk: primaryKey({
      columns: [t.expenseLA2TableId, t.unitResidentPriorityId],
    }),
  }},
);

// ---------------------------------------------------------------------------
// expenseLA2Table
// ---------------------------------------------------------------------------
export const expenseLA2Table = pgTable("expense_la2_table", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => {return studio.id}),
  expenseLedgerAccountId: integer("expense_ledger_account_id")
    .notNull()
    .references(() => {return expenseLedgerAccount.ledgerAccountId}),
  distributionTableId: integer("distribution_table_id")
    .notNull()
    .references(() => {return distributionTable.id}),
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
    .references(() => {return studio.id}),
  expenseLedgerAccountId: integer("expense_ledger_account_id")
    .notNull()
    .references(() => {return expenseLedgerAccount.ledgerAccountId}),
  unitId: integer("unit_id")
    .notNull()
    .references(() => {return unit.id}),
  expenseLA2TableId: integer("expense_la2_table_id").references(
    () => {return expenseLA2Table.id},
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
      .references(() => {return expenseLAUnitException.id}),
    unitResidentPriorityId: integer("unit_resident_priority_id")
      .notNull()
      .references(() => {return unitResidentPriority.id}),
    studioId: integer("studio_id")
      .notNull()
      .references(() => {return studio.id}),
    percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => {return {
    pk: primaryKey({
      columns: [t.expenseLAUnitExceptionId, t.unitResidentPriorityId],
    }),
  }},
);

// ---------------------------------------------------------------------------
// withholdingTax
// ---------------------------------------------------------------------------
export const withholdingTax = pgTable("withholding_tax", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  countryIso31661A2: char("country_iso3166_1_a2", { length: 2 })
    .notNull()
    .references(() => {return country.iso31661Alpha2}),
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
      .references(() => {return withholdingTax.id}),
    ledgerAccountId: integer("ledger_account_id")
      .notNull()
      .references(() => {return ledgerAccount.id}),
    studioId: integer("studio_id")
      .notNull()
      .references(() => {return studio.id}),
    accountingPeriodId: integer("accounting_period_id")
      .notNull()
      .references(() => {return accountingPeriod.id}),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => {return {
    pk: primaryKey({ columns: [t.withholdingTaxId, t.ledgerAccountId] }),
  }},
);

// ---------------------------------------------------------------------------
// taxRelief
// ---------------------------------------------------------------------------
export const taxRelief = pgTable("tax_relief", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  countryIso31661A2: char("country_iso3166_1_a2", { length: 2 })
    .notNull()
    .references(() => {return country.iso31661Alpha2}),
  name: varchar("name", { length: 63 }).notNull(),
  description: text("description"),
  percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
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
    .references(() => {return studio.id}),
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
    .references(() => {return studio.id}),
  condominiumId: integer("condominium_id")
    .notNull()
    .references(() => {return condominium.id}),
  referenceDate: date("reference_date"),
  paymentDate: date("payment_date"),
  confirmed: boolean("confirmed").notNull(),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// distributionTable
// ---------------------------------------------------------------------------
export const distributionTable = pgTable("distribution_table", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => {return studio.id}),
  accountingPeriodId: integer("accounting_period_id")
    .notNull()
    .references(() => {return accountingPeriod.id}),
  name: varchar("name", { length: 63 }).notNull(),
  order: integer("order"),
  restrictionUnitGroupId: integer("restriction_unit_group_id").references(
    () => {return unitGroup.id},
  ),
  consumptionMeterId: integer("consumption_meter_id").references(
    () => {return consumptionMeter.id},
  ),
  notes: text("notes"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// distributionTableItem
// ---------------------------------------------------------------------------
export const distributionTableItem = pgTable(
  "distribution_table_item",
  {
    distributionTableId: integer("distribution_table_id")
      .notNull()
      .references(() => {return distributionTable.id}),
    unitId: integer("unit_id")
      .notNull()
      .references(() => {return unit.id}),
    studioId: integer("studio_id")
      .notNull()
      .references(() => {return studio.id}),
    coefficient: numeric("coefficient", {
      precision: 20,
      scale: 6,
    }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => {return {
    pk: primaryKey({ columns: [t.distributionTableId, t.unitId] }),
  }},
);
