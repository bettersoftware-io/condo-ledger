import {
  pgTable,
  integer,
  varchar,
  text,
  char,
  boolean,
  timestamp,
  date,
  numeric,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { recordStatus, condominiumType } from "../enums.ts";
import {
  studio,
  masterData,
  bankAccount,
  accessAccount,
} from "./masterData.ts";
import { country, locale } from "./reference.ts";
import { accountingPeriod } from "./installment.ts";
import { calendarEvent } from "./leftovers.ts";
import { ledgerEntry } from "./accounting.ts";

// ---------------------------------------------------------------------------
// condominium
// ---------------------------------------------------------------------------
export const condominium = pgTable("condominium", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => studio.id),
  parentCondominiumId: integer("parent_condominium_id").references(
    (): AnyPgColumn => condominium.id,
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
  bankAccountId: integer("bank_account_id").references(() => bankAccount.id),
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
    .references(() => studio.id),
  condominiumId: integer("condominium_id")
    .notNull()
    .references(() => condominium.id),
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
      .references(() => condominiumAttribute.id),
    localeCode: varchar("locale_code", { length: 10 })
      .notNull()
      .references(() => locale.code),
    studioId: integer("studio_id")
      .notNull()
      .references(() => studio.id),
    labelTranslation: varchar("label_translation", { length: 63 }).notNull(),
    valueTranslation: varchar("value_translation", { length: 63 }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.condominiumAttributeId, t.localeCode] }),
  }),
);

// ---------------------------------------------------------------------------
// condominiumCalendarEvent
// ---------------------------------------------------------------------------
export const condominiumCalendarEvent = pgTable("condominium_calendar_event", {
  calendarEventId: integer("calendar_event_id")
    .primaryKey()
    .references(() => calendarEvent.id),
  condominiumId: integer("condominium_id").references(() => condominium.id),
  accountingPeriodId: integer("accounting_period_id").references(
    () => accountingPeriod.id,
  ),
  unitGroupId: integer("unit_group_id").references(() => unitGroup.id),
  unitId: integer("unit_id").references(() => unit.id),
  unitResidentId: integer("unit_resident_id").references(() => unitResident.id),
  masterDataId: integer("master_data_id").references(() => masterData.id),
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
      .references(() => condominium.id),
    masterDataId: integer("master_data_id")
      .notNull()
      .references(() => masterData.id),
    studioId: integer("studio_id")
      .notNull()
      .references(() => studio.id),
    order: integer("order"),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.condominiumId, t.masterDataId] }),
  }),
);

// ---------------------------------------------------------------------------
// unit
// ---------------------------------------------------------------------------
export const unit = pgTable("unit", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => studio.id),
  accountingPeriodId: integer("accounting_period_id")
    .notNull()
    .references(() => accountingPeriod.id),
  unitTypeId: integer("unit_type_id").references(() => unitType.id),
  unitGroupId: integer("unit_group_id").references(() => unitGroup.id),
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
    .references(() => studio.id),
  parentUnitGroupId: integer("parent_unit_group_id").references(
    (): AnyPgColumn => unitGroup.id,
  ),
  accountingPeriodId: integer("accounting_period_id")
    .notNull()
    .references(() => accountingPeriod.id),
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
    .references(() => studio.id),
  unitId: integer("unit_id")
    .notNull()
    .references(() => unit.id),
  unitOwnershipScenarioId: integer("unit_ownership_scenario_id")
    .notNull()
    .references(() => unitOwnershipScenario.id),
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
    .references(() => studio.id),
  unitPeriodId: integer("unit_period_id")
    .notNull()
    .references(() => unitPeriod.id),
  masterDataId: integer("master_data_id")
    .notNull()
    .references(() => masterData.id),
  systemUsername: varchar("system_username", { length: 63 })
    .notNull()
    .references(() => unitResidentAccount.systemUsername),
  unitResidentPriorityId: integer("unit_resident_priority_id")
    .notNull()
    .references(() => unitResidentPriority.id),
  periodRestrictionStartDate: date("period_restriction_start_date"),
  periodRestrictionEndDate: date("period_restriction_end_date"),
  percentage: numeric("percentage", { precision: 10, scale: 6 }),
  startingBalance: numeric("starting_balance", {
    precision: 10,
    scale: 2,
  }).notNull(),
  startingBalanceLedgerEntryId: integer(
    "starting_balance_ledger_entry_id",
  ).references((): AnyPgColumn => ledgerEntry.id),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// unitResidentAccount
// ---------------------------------------------------------------------------
export const unitResidentAccount = pgTable("unit_resident_account", {
  systemUsername: varchar("system_username", { length: 63 })
    .primaryKey()
    .references(() => accessAccount.username),
  studioId: integer("studio_id")
    .notNull()
    .references(() => studio.id),
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
    .references(() => country.iso31661Alpha2),
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
    .references(() => country.iso31661Alpha2),
  unitOwnershipScenarioId: integer("unit_ownership_scenario_id")
    .notNull()
    .references(() => unitOwnershipScenario.id),
  unitResidentPriorityId: integer("unit_resident_priority_id")
    .notNull()
    .references(() => unitResidentPriority.id),
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
      .references(() => unitResidentRole.id),
    localeCode: varchar("locale_code", { length: 10 })
      .notNull()
      .references(() => locale.code),
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
  (t) => ({
    pk: primaryKey({ columns: [t.unitResidentRoleId, t.localeCode] }),
  }),
);

// ---------------------------------------------------------------------------
// unitType
// ---------------------------------------------------------------------------
export const unitType = pgTable("unit_type", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => studio.id),
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
      .references(() => unitType.id),
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
    pk: primaryKey({ columns: [t.unitTypeId, t.localeCode] }),
  }),
);

// ---------------------------------------------------------------------------
// unitOwnershipScenario
// ---------------------------------------------------------------------------
export const unitOwnershipScenario = pgTable("unit_ownership_scenario", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  countryIso31661A2: char("country_iso3166_1_a2", { length: 2 })
    .notNull()
    .references(() => country.iso31661Alpha2),
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
      .references(() => unitOwnershipScenario.id),
    localeCode: varchar("locale_code", { length: 10 })
      .notNull()
      .references(() => locale.code),
    translation: varchar("translation", { length: 63 }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.unitOwnershipScenarioId, t.localeCode] }),
  }),
);
