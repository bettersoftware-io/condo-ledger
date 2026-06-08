import { pgEnum } from "drizzle-orm/pg-core";

// Each distinct legacy value-set becomes one pgEnum. The pg enum SQL type name
// is snake_case; the values stay camelCase (they are domain tokens used by the
// app, so they must round-trip verbatim). Use these directly as column builders
// in schema files, e.g. `condominiumType("type")`.

export const recordStatus = pgEnum("record_status", ["active", "archived"]); // condominium.status, masterData.status
export const ledgerAccountKind = pgEnum("ledger_account_kind", ["assets", "liabilities", "assetsOrLiabilities", "income", "expenses"]);
export const licenseType = pgEnum("license_type", ["demo", "light", "standard", "professional", "enterprise"]);
export const installmentType = pgEnum("installment_type", ["downpayment", "estimate", "compensation"]); // installment.type, installmentGroup.type
export const accessAccountStatus = pgEnum("access_account_status", ["enabled", "disabled"]);
export const expenseLa2TableType = pgEnum("expense_la2_table_type", ["estimate", "currentBalance"]);
export const accessAccountRole = pgEnum("access_account_role", ["guest", "flatowner", "supplier", "employee", "administrator"]);
export const eventPriority = pgEnum("event_priority", ["idle", "low", "medium", "high", "critical"]); // calendarEvent.priority, ticket.priority
export const installmentItemStatus = pgEnum("installment_item_status", ["issued", "incomplete", "settled", "neutralized"]);
export const installmentPaymentSlipStatus = pgEnum("installment_payment_slip_status", ["issued", "settled", "neutralized"]);
export const personSex = pgEnum("person_sex", ["m", "f"]);
export const accountingPeriodStatus = pgEnum("accounting_period_status", ["opened", "closed"]);
export const ticketStatus = pgEnum("ticket_status", ["opened", "processing", "suspended", "cancelled", "closed"]);
export const nextPeriodEstimateBasedOn = pgEnum("next_period_estimate_based_on", ["previousEstimate", "currentBalance"]);
export const accountingPeriodType = pgEnum("accounting_period_type", ["regular", "extra", "auxiliary"]);
export const ledgerAccountType = pgEnum("ledger_account_type", ["regular", "grouping", "control", "controlUnitResident"]);
export const condominiumType = pgEnum("condominium_type", ["regular", "super", "residence"]);
export const openingBalanceDistributionMode = pgEnum("opening_balance_distribution_mode", ["spread", "specificInstallment", "separateInstallment"]);
export const ledgerTransactionType = pgEnum("ledger_transaction_type", ["startingBalance", "directPaymentInCash", "checkingAccountDirectPayment", "ledgerInvoiceRegistration", "ledgerInvoicePayment", "withholdingTaxPayment", "estimateDistribution", "unitResidentTakings", "individualExpense", "closingBalance"]);
export const ledgerEntry2UrDistributionType = pgEnum("ledger_entry_2_ur_distribution_type", ["startingBalance", "individualExpense", "receipts"]);
export const ledgerEntryType = pgEnum("ledger_entry_type", ["startingBalance", "individualExpense", "unitResidentTakings"]);
export const masterDataContactType = pgEnum("master_data_contact_type", ["tel", "mail", "web", "im", "pec"]);
export const costAttributionOnHandover = pgEnum("cost_attribution_on_handover", ["tenureProportionBased", "accrualDateBased"]);
