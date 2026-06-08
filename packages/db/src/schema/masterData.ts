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
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  recordStatus,
  accessAccountStatus,
  accessAccountRole,
  masterDataContactType,
  personSex,
} from "../enums.ts";
import { country, locale, bank, bankBranch } from "./reference.ts";

// Cross-area tables referenced lazily:
//   - grant (leftovers.ts), qualification (this file), tribute (accounting.ts),
//     masterDataCategory (this file), studio (this file)
import { grant } from "./leftovers.ts";
import { tribute } from "./accounting.ts";

// ---------------------------------------------------------------------------
// studio
// ---------------------------------------------------------------------------
export const studio = pgTable("studio", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  masterDataId: integer("master_data_id").references(
    (): AnyPgColumn => masterData.id,
  ),
  countryIso31661A2: char("country_iso3166_1_a2", { length: 2 }).references(
    () => country.iso31661Alpha2,
  ),
  defaultLocaleCode: varchar("default_locale_code", { length: 10 }).references(
    () => locale.code,
  ),
  headerText: text("header_text"),
  footerText: text("footer_text"),
  notes: text("notes"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// masterData
// ---------------------------------------------------------------------------
export const masterData = pgTable("master_data", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references((): AnyPgColumn => studio.id),
  validFromDate: date("valid_from_date"),
  code: varchar("code", { length: 15 }),
  status: recordStatus("status"),
  taxCode: varchar("tax_code", { length: 31 }),
  vatNumber: varchar("vat_number", { length: 31 }),
  masterDataCategoryId: integer("master_data_category_id").references(
    () => masterDataCategory.id,
  ),
  postalAddress: text("postal_address"),
  preferredLocaleCode: varchar("preferred_locale_code", {
    length: 10,
  }).references(() => locale.code),
  qualificationId: integer("qualification_id").references(
    () => qualification.id,
  ),
  bankAccountId: integer("bank_account_id").references(
    (): AnyPgColumn => bankAccount.id,
  ),
  notes: text("notes"),
  variationNotes: text("variation_notes"),
  created: timestamp("created", { withTimezone: true }),
  createdMasterDataId: integer("created_master_data_id").references(
    (): AnyPgColumn => masterData.id,
  ),
  updated: timestamp("updated", { withTimezone: true }),
  lastModifiedMasterDataId: integer("last_modified_master_data_id").references(
    (): AnyPgColumn => masterData.id,
  ),
});

// ---------------------------------------------------------------------------
// masterDataCategory
// ---------------------------------------------------------------------------
export const masterDataCategory = pgTable("master_data_category", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => studio.id),
  name: varchar("name", { length: 63 }).notNull(),
  code: varchar("code", { length: 15 }),
  order: integer("order"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// masterDataCategoryI18n
// ---------------------------------------------------------------------------
export const masterDataCategoryI18n = pgTable(
  "master_data_category_i18n",
  {
    masterDataCategoryId: integer("master_data_category_id")
      .notNull()
      .references(() => masterDataCategory.id),
    localeCode: varchar("locale_code", { length: 10 })
      .notNull()
      .references(() => locale.code),
    studioId: integer("studio_id").references(() => studio.id),
    translation: varchar("translation", { length: 127 }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.masterDataCategoryId, t.localeCode] }),
  }),
);

// ---------------------------------------------------------------------------
// masterDataContact
// ---------------------------------------------------------------------------
export const masterDataContact = pgTable("master_data_contact", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => studio.id),
  masterDataId: integer("master_data_id").references(() => masterData.id),
  masterDataVariationId: integer("master_data_variation_id").references(
    () => masterDataVariation.id,
  ),
  type: masterDataContactType("type").notNull(),
  label: varchar("label", { length: 31 }).notNull(),
  value: varchar("value", { length: 127 }).notNull(),
  order: integer("order"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// masterDataContactI18n
// ---------------------------------------------------------------------------
export const masterDataContactI18n = pgTable(
  "master_data_contact_i18n",
  {
    masterDataContactId: integer("master_data_contact_id")
      .notNull()
      .references(() => masterDataContact.id),
    localeCode: varchar("locale_code", { length: 10 })
      .notNull()
      .references(() => locale.code),
    studioId: integer("studio_id").references(() => studio.id),
    translation: varchar("translation", { length: 127 }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.masterDataContactId, t.localeCode] }),
  }),
);

// ---------------------------------------------------------------------------
// masterDataCrossRelation
// ---------------------------------------------------------------------------
export const masterDataCrossRelation = pgTable("master_data_cross_relation", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => studio.id),
  fromMasterDataId: integer("from_master_data_id")
    .notNull()
    .references(() => masterData.id),
  toMasterDataId: integer("to_master_data_id")
    .notNull()
    .references(() => masterData.id),
  relation: varchar("relation", { length: 127 }).notNull(),
  order: integer("order"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// masterDataCrossRelationI18n
// ---------------------------------------------------------------------------
export const masterDataCrossRelationI18n = pgTable(
  "master_data_cross_relation_i18n",
  {
    masterDataCrossRelationId: integer("master_data_cross_relation_id")
      .notNull()
      .references(() => masterDataCrossRelation.id),
    localeCode: varchar("locale_code", { length: 10 })
      .notNull()
      .references(() => locale.code),
    studioId: integer("studio_id").references(() => studio.id),
    translation: varchar("translation", { length: 127 }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.masterDataCrossRelationId, t.localeCode] }),
  }),
);

// ---------------------------------------------------------------------------
// masterDataTaxTreatment
// ---------------------------------------------------------------------------
export const masterDataTaxTreatment = pgTable("master_data_tax_treatment", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => studio.id),
  masterDataId: integer("master_data_id")
    .notNull()
    .references(() => masterData.id),
  isDefault: boolean("is_default").notNull().default(false),
  taxAc: boolean("tax_ac").notNull(),
  tax770: boolean("tax_770").notNull(),
  vat: integer("vat"),
  tributeId: integer("tribute_id").references(() => tribute.id),
  withholdingTax: integer("withholding_tax"),
  welfareTax: integer("welfare_tax"),
  applyOnWelfareTax: boolean("apply_on_welfare_tax").notNull(),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// masterDataVariation
// ---------------------------------------------------------------------------
export const masterDataVariation = pgTable("master_data_variation", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => studio.id),
  masterDataId: integer("master_data_id")
    .notNull()
    .references(() => masterData.id),
  validFromDate: date("valid_from_date"),
  validToDate: date("valid_to_date"),
  taxCode: varchar("tax_code", { length: 31 }),
  vatNumber: varchar("vat_number", { length: 31 }),
  postalAddress: text("postal_address"),
  qualificationId: integer("qualification_id").references(
    () => qualification.id,
  ),
  bankAccountId: integer("bank_account_id").references(() => bankAccount.id),
  variationNotes: text("variation_notes"),
  created: timestamp("created", { withTimezone: true }),
  createdMasterDataId: integer("created_master_data_id").references(
    () => masterData.id,
  ),
  updated: timestamp("updated", { withTimezone: true }),
  lastModifiedMasterDataId: integer("last_modified_master_data_id").references(
    () => masterData.id,
  ),
});

// ---------------------------------------------------------------------------
// person
// ---------------------------------------------------------------------------
export const person = pgTable("person", {
  masterDataId: integer("master_data_id")
    .primaryKey()
    .references(() => masterData.id),
  firstName: varchar("first_name", { length: 63 }),
  middleName: varchar("middle_name", { length: 63 }),
  lastName: varchar("last_name", { length: 63 }),
  sex: personSex("sex"),
  birthDate: date("birth_date"),
  birthPlace: text("birth_place"),
  citizenshipIso31661A2: char("citizenship_iso3166_1_a2", {
    length: 2,
  }).references(() => country.iso31661Alpha2),
  officeAddress: text("office_address"),
  permanentAddress: text("permanent_address"),
  currentAddress: text("current_address"),
  occupation: varchar("occupation", { length: 63 }),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// personVariation
// ---------------------------------------------------------------------------
export const personVariation = pgTable("person_variation", {
  masterDataVariationId: integer("master_data_variation_id")
    .primaryKey()
    .references(() => masterDataVariation.id),
  firstName: varchar("first_name", { length: 63 }),
  middleName: varchar("middle_name", { length: 63 }),
  lastName: varchar("last_name", { length: 63 }),
  citizenshipIso31661A2: char("citizenship_iso3166_1_a2", {
    length: 2,
  }).references(() => country.iso31661Alpha2),
  officeAddress: text("office_address"),
  permanentAddress: text("permanent_address"),
  currentAddress: text("current_address"),
  occupation: varchar("occupation", { length: 63 }),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// company
// ---------------------------------------------------------------------------
export const company = pgTable("company", {
  masterDataId: integer("master_data_id")
    .primaryKey()
    .references(() => masterData.id),
  name: varchar("name", { length: 127 }).notNull(),
  registeredOfficeAddress: text("registered_office_address"),
  taxPurposeAddress: text("tax_purpose_address"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// companyVariation
// ---------------------------------------------------------------------------
export const companyVariation = pgTable("company_variation", {
  masterDataVariationId: integer("master_data_variation_id")
    .primaryKey()
    .references(() => masterDataVariation.id),
  name: varchar("name", { length: 127 }).notNull(),
  registeredOfficeAddress: text("registered_office_address"),
  taxPurposeAddress: text("tax_purpose_address"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// accessAccount
// ---------------------------------------------------------------------------
export const accessAccount = pgTable("access_account", {
  username: varchar("username", { length: 63 }).primaryKey(),
  studioId: integer("studio_id").references(() => studio.id),
  password: varchar("password", { length: 63 }),
  masterDataId: integer("master_data_id").references(() => masterData.id),
  status: accessAccountStatus("status").notNull(),
  role: accessAccountRole("role").notNull(),
  grantFlatOwner: boolean("grant_flat_owner").notNull(),
  grantSupplier: boolean("grant_supplier").notNull(),
  grantEmployee: boolean("grant_employee").notNull(),
  grantAdministrator: boolean("grant_administrator").notNull(),
  notes: text("notes"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// accessAccountActivationRequest
// ---------------------------------------------------------------------------
export const accessAccountActivationRequest = pgTable(
  "access_account_activation_request",
  {
    activationCode: varchar("activation_code", { length: 64 }).primaryKey(),
    studioId: integer("studio_id").references(() => studio.id),
    url: varchar("url", { length: 255 }),
    username: varchar("username", { length: 63 }),
    password: varchar("password", { length: 63 }),
    email: varchar("email", { length: 63 }),
    firstName: varchar("first_name", { length: 63 }),
    lastName: varchar("last_name", { length: 63 }),
    companyName: varchar("company_name", { length: 127 }),
    masterDataCategoryId: integer("master_data_category_id"),
    accessAccountRole: varchar("access_account_role", { length: 15 }),
    accessAccountSerialized: text("access_account_serialized"),
    clientSessionId: varchar("client_session_id", { length: 63 }),
    clientIpAddress: varchar("client_ip_address", { length: 15 }),
    clientUserAgent: varchar("client_user_agent", { length: 255 }),
    clientRefererUrl: varchar("client_referer_url", { length: 255 }),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
);

// ---------------------------------------------------------------------------
// accessAccountGrant
// ---------------------------------------------------------------------------
export const accessAccountGrant = pgTable(
  "access_account_grant",
  {
    username: varchar("username", { length: 63 })
      .notNull()
      .references(() => accessAccount.username),
    grantId: integer("grant_id")
      .notNull()
      .references(() => grant.id),
    studioId: integer("studio_id").references(() => studio.id),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.username, t.grantId] }),
  }),
);

// ---------------------------------------------------------------------------
// qualification
// ---------------------------------------------------------------------------
export const qualification = pgTable("qualification", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => studio.id),
  countryIso31661A2: char("country_iso3166_1_a2", { length: 2 })
    .notNull()
    .references(() => country.iso31661Alpha2),
  name: varchar("name", { length: 31 }).notNull(),
  code: varchar("code", { length: 15 }),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// passwordResetRequest
// ---------------------------------------------------------------------------
export const passwordResetRequest = pgTable("password_reset_request", {
  resetCode: varchar("reset_code", { length: 64 }).primaryKey(),
  studioId: integer("studio_id").references(() => studio.id),
  username: varchar("username", { length: 63 }).notNull(),
  email: varchar("email", { length: 63 }).notNull(),
  clientSessionId: varchar("client_session_id", { length: 63 }),
  clientIpAddress: varchar("client_ip_address", { length: 15 }),
  clientUserAgent: varchar("client_user_agent", { length: 255 }),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// bankAccount
// ---------------------------------------------------------------------------
export const bankAccount = pgTable("bank_account", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => studio.id),
  bankId: integer("bank_id").references(() => bank.id),
  countryIso31661A2: char("country_iso3166_1_a2", { length: 2 }).references(
    () => country.iso31661Alpha2,
  ),
  bankName: varchar("bank_name", { length: 255 }),
  nationalBankCode: char("national_bank_code", { length: 8 }),
  bankBranchId: integer("bank_branch_id").references(
    (): AnyPgColumn => bankBranch.id,
  ),
  branchName: varchar("branch_name", { length: 255 }),
  branchCode: char("branch_code", { length: 6 }),
  swift: char("swift", { length: 11 }),
  branchAddress: text("branch_address"),
  iban: varchar("iban", { length: 31 }),
  code: varchar("code", { length: 15 }),
  holder: varchar("holder", { length: 255 }),
  accountNumber: varchar("account_number", { length: 22 }),
  checkDigits: char("check_digits", { length: 2 }),
  checkChar: char("check_char", { length: 1 }),
  nationalCheckDigits: char("national_check_digits", { length: 2 }),
  notes: text("notes"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// bankTransferPO
// ---------------------------------------------------------------------------
export const bankTransferPo = pgTable("bank_transfer_po", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => studio.id),
  bankAccountId: integer("bank_account_id").references(() => bankAccount.id),
  reasonForPayment: varchar("reason_for_payment", { length: 255 }),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});
