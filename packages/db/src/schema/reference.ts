import {
  pgTable,
  integer,
  varchar,
  char,
  text,
  timestamp,
  primaryKey,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { masterData } from "./masterData.ts";

// ---------------------------------------------------------------------------
// country
// ---------------------------------------------------------------------------
export const country = pgTable("country", {
  iso31661Alpha2: char("iso3166_1_alpha2", { length: 2 }).primaryKey(),
  iso31661Alpha1: char("iso3166_1_alpha1", { length: 3 }).notNull(),
  iso31661Numeric: integer("iso3166_1_numeric").notNull(),
  name: varchar("name", { length: 127 }).notNull(),
  primaryLocaleCode: varchar("primary_locale_code", { length: 10 }).references(
    () => locale.code,
  ),
  secondaryLocaleCode: varchar("secondary_locale_code", {
    length: 10,
  }).references(() => locale.code),
  tertiaryLocaleCode: varchar("tertiary_locale_code", { length: 10 }).references(
    () => locale.code,
  ),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// countryI18n
// ---------------------------------------------------------------------------
export const countryI18n = pgTable(
  "country_i18n",
  {
    countryIso31661A2: char("country_iso3166_1_a2", { length: 2 })
      .notNull()
      .references(() => country.iso31661Alpha2),
    localeCode: varchar("locale_code", { length: 10 })
      .notNull()
      .references(() => locale.code),
    translation: varchar("translation", { length: 127 }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.countryIso31661A2, t.localeCode] }),
  }),
);

// ---------------------------------------------------------------------------
// locale
// ---------------------------------------------------------------------------
export const locale = pgTable("locale", {
  code: varchar("code", { length: 10 }).primaryKey(),
  language: varchar("language", { length: 63 }).notNull(),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// localeI18n
// ---------------------------------------------------------------------------
export const localeI18n = pgTable(
  "locale_i18n",
  {
    localeCodeSrc: varchar("locale_code_src", { length: 10 })
      .notNull()
      .references(() => locale.code),
    localeCodeDst: varchar("locale_code_dst", { length: 10 })
      .notNull()
      .references(() => locale.code),
    translation: varchar("translation", { length: 127 }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.localeCodeSrc, t.localeCodeDst] }),
  }),
);

// ---------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------
export const state = pgTable("state", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  countryIso31661A2: char("country_iso3166_1_a2", { length: 2 })
    .notNull()
    .references(() => country.iso31661Alpha2),
  code: varchar("code", { length: 31 }),
  name: varchar("name", { length: 127 }).notNull(),
  abbreviation: varchar("abbreviation", { length: 15 }),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// stateI18n
// ---------------------------------------------------------------------------
export const stateI18n = pgTable(
  "state_i18n",
  {
    stateId: integer("state_id")
      .notNull()
      .references(() => state.id),
    localeCode: varchar("locale_code", { length: 10 })
      .notNull()
      .references(() => locale.code),
    translation: varchar("translation", { length: 127 }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.stateId, t.localeCode] }),
  }),
);

// ---------------------------------------------------------------------------
// district
// ---------------------------------------------------------------------------
export const district = pgTable("district", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  countryIso31661A2: char("country_iso3166_1_a2", { length: 2 })
    .notNull()
    .references(() => country.iso31661Alpha2),
  stateId: integer("state_id").references(() => state.id),
  code: varchar("code", { length: 31 }),
  name: varchar("name", { length: 127 }).notNull(),
  abbreviation: varchar("abbreviation", { length: 15 }),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// districtI18n
// ---------------------------------------------------------------------------
export const districtI18n = pgTable(
  "district_i18n",
  {
    districtId: integer("district_id")
      .notNull()
      .references(() => district.id),
    localeCode: varchar("locale_code", { length: 10 })
      .notNull()
      .references(() => locale.code),
    translation: varchar("translation", { length: 127 }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.districtId, t.localeCode] }),
  }),
);

// ---------------------------------------------------------------------------
// minorCivilDivision
// ---------------------------------------------------------------------------
export const minorCivilDivision = pgTable("minor_civil_division", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  districtId: integer("district_id")
    .notNull()
    .references(() => district.id),
  code: varchar("code", { length: 31 }),
  name: varchar("name", { length: 127 }).notNull(),
  abbreviation: varchar("abbreviation", { length: 15 }),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// minorCivilDivisionI18n
// ---------------------------------------------------------------------------
export const minorCivilDivisionI18n = pgTable(
  "minor_civil_division_i18n",
  {
    minorCivilDivisionId: integer("minor_civil_division_id")
      .notNull()
      .references(() => minorCivilDivision.id),
    localeCode: varchar("locale_code", { length: 10 })
      .notNull()
      .references(() => locale.code),
    translation: varchar("translation", { length: 127 }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.minorCivilDivisionId, t.localeCode] }),
  }),
);

// ---------------------------------------------------------------------------
// city
// ---------------------------------------------------------------------------
export const city = pgTable("city", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  countryIso31661A2: char("country_iso3166_1_a2", { length: 2 })
    .notNull()
    .references(() => country.iso31661Alpha2),
  stateId: integer("state_id").references(() => state.id),
  districtId: integer("district_id").references(() => district.id),
  minorCivilDivisionId: integer("minor_civil_division_id").references(
    () => minorCivilDivision.id,
  ),
  code: varchar("code", { length: 31 }),
  name: varchar("name", { length: 127 }).notNull(),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// cityI18n
// ---------------------------------------------------------------------------
export const cityI18n = pgTable(
  "city_i18n",
  {
    cityId: integer("city_id")
      .notNull()
      .references(() => city.id),
    localeCode: varchar("locale_code", { length: 10 })
      .notNull()
      .references(() => locale.code),
    translation: varchar("translation", { length: 127 }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.cityId, t.localeCode] }),
  }),
);

// ---------------------------------------------------------------------------
// cityPostCode
// ---------------------------------------------------------------------------
export const cityPostCode = pgTable(
  "city_post_code",
  {
    cityId: integer("city_id")
      .notNull()
      .references(() => city.id),
    postCode: varchar("post_code", { length: 31 })
      .notNull()
      .references(() => postCode.code),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.cityId, t.postCode] }),
  }),
);

// ---------------------------------------------------------------------------
// postCode
// ---------------------------------------------------------------------------
export const postCode = pgTable(
  "post_code",
  {
    code: varchar("code", { length: 31 }).notNull(),
    countryIso31661A2: char("country_iso3166_1_a2", { length: 2 })
      .notNull()
      .references(() => country.iso31661Alpha2),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.code, t.countryIso31661A2] }),
    // cityPostCode.postCode FKs to post_code.code alone. Legacy MySQL allowed
    // this because `code` is the leftmost prefix of the composite PK; Postgres
    // requires the referenced columns to carry their own unique constraint, so
    // we add UNIQUE(code). NOTE: this is slightly stronger than the legacy PK
    // (code,country) — it forbids the same postal code under two countries.
    // Current data is Italy-only so codes are de-facto unique; flagged for
    // schema-owner ratification.
    codeUnique: unique("post_code_code_unique").on(t.code),
  }),
);

// ---------------------------------------------------------------------------
// bank
// ---------------------------------------------------------------------------
export const bank = pgTable("bank", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  countryIso31661A2: char("country_iso3166_1_a2", { length: 2 })
    .notNull()
    .references(() => country.iso31661Alpha2),
  name: varchar("name", { length: 255 }).notNull(),
  nationalBankCode: char("national_bank_code", { length: 8 }),
  swiftPrimaryOffice: char("swift_primary_office", { length: 11 }),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// bankBranch
// ---------------------------------------------------------------------------
export const bankBranch = pgTable("bank_branch", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  bankId: integer("bank_id")
    .notNull()
    .references(() => bank.id),
  name: varchar("name", { length: 255 }).notNull(),
  branchCode: char("branch_code", { length: 6 }),
  swift: char("swift", { length: 11 }),
  address: text("address"),
  masterDataId: integer("master_data_id").references(
    (): AnyPgColumn => masterData.id,
  ),
  cityId: integer("city_id").references(() => city.id),
  districtId: integer("district_id").references(() => district.id),
  stateId: integer("state_id").references(() => state.id),
  countryIso31661A2: char("country_iso3166_1_a2", { length: 2 }).references(
    () => country.iso31661Alpha2,
  ),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});
