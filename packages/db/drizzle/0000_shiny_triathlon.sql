CREATE TYPE "public"."access_account_role" AS ENUM('guest', 'flatowner', 'supplier', 'employee', 'administrator');--> statement-breakpoint
CREATE TYPE "public"."access_account_status" AS ENUM('enabled', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."accounting_period_status" AS ENUM('opened', 'closed');--> statement-breakpoint
CREATE TYPE "public"."accounting_period_type" AS ENUM('regular', 'extra', 'auxiliary');--> statement-breakpoint
CREATE TYPE "public"."condominium_type" AS ENUM('regular', 'super', 'residence');--> statement-breakpoint
CREATE TYPE "public"."cost_attribution_on_handover" AS ENUM('tenureProportionBased', 'accrualDateBased');--> statement-breakpoint
CREATE TYPE "public"."event_priority" AS ENUM('idle', 'low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."expense_la2_table_type" AS ENUM('estimate', 'currentBalance');--> statement-breakpoint
CREATE TYPE "public"."installment_item_status" AS ENUM('issued', 'incomplete', 'settled', 'neutralized');--> statement-breakpoint
CREATE TYPE "public"."installment_payment_slip_status" AS ENUM('issued', 'settled', 'neutralized');--> statement-breakpoint
CREATE TYPE "public"."installment_type" AS ENUM('downpayment', 'estimate', 'compensation');--> statement-breakpoint
CREATE TYPE "public"."ledger_account_kind" AS ENUM('assets', 'liabilities', 'assetsOrLiabilities', 'income', 'expenses');--> statement-breakpoint
CREATE TYPE "public"."ledger_account_type" AS ENUM('regular', 'grouping', 'control', 'controlUnitResident');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_2_ur_distribution_type" AS ENUM('startingBalance', 'individualExpense', 'receipts');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('startingBalance', 'individualExpense', 'unitResidentTakings');--> statement-breakpoint
CREATE TYPE "public"."ledger_transaction_type" AS ENUM('startingBalance', 'directPaymentInCash', 'checkingAccountDirectPayment', 'ledgerInvoiceRegistration', 'ledgerInvoicePayment', 'withholdingTaxPayment', 'estimateDistribution', 'unitResidentTakings', 'individualExpense', 'closingBalance');--> statement-breakpoint
CREATE TYPE "public"."license_type" AS ENUM('demo', 'light', 'standard', 'professional', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."master_data_contact_type" AS ENUM('tel', 'mail', 'web', 'im', 'pec');--> statement-breakpoint
CREATE TYPE "public"."next_period_estimate_based_on" AS ENUM('previousEstimate', 'currentBalance');--> statement-breakpoint
CREATE TYPE "public"."opening_balance_distribution_mode" AS ENUM('spread', 'specificInstallment', 'separateInstallment');--> statement-breakpoint
CREATE TYPE "public"."person_sex" AS ENUM('m', 'f');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('opened', 'processing', 'suspended', 'cancelled', 'closed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bank" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bank_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"country_iso3166_1_a2" char(2) NOT NULL,
	"name" varchar(255) NOT NULL,
	"national_bank_code" char(8),
	"swift_primary_office" char(11),
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bank_branch" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bank_branch_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bank_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"branch_code" char(6),
	"swift" char(11),
	"address" text,
	"master_data_id" integer,
	"city_id" integer,
	"district_id" integer,
	"state_id" integer,
	"country_iso3166_1_a2" char(2),
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "city" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "city_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"country_iso3166_1_a2" char(2) NOT NULL,
	"state_id" integer,
	"district_id" integer,
	"minor_civil_division_id" integer,
	"code" varchar(31),
	"name" varchar(127) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "city_i18n" (
	"city_id" integer NOT NULL,
	"locale_code" varchar(10) NOT NULL,
	"translation" varchar(127) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "city_i18n_city_id_locale_code_pk" PRIMARY KEY("city_id","locale_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "city_post_code" (
	"city_id" integer NOT NULL,
	"post_code" varchar(31) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "city_post_code_city_id_post_code_pk" PRIMARY KEY("city_id","post_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "country" (
	"iso3166_1_alpha2" char(2) PRIMARY KEY NOT NULL,
	"iso3166_1_alpha1" char(3) NOT NULL,
	"iso3166_1_numeric" integer NOT NULL,
	"name" varchar(127) NOT NULL,
	"primary_locale_code" varchar(10),
	"secondary_locale_code" varchar(10),
	"tertiary_locale_code" varchar(10),
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "country_i18n" (
	"country_iso3166_1_a2" char(2) NOT NULL,
	"locale_code" varchar(10) NOT NULL,
	"translation" varchar(127) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "country_i18n_country_iso3166_1_a2_locale_code_pk" PRIMARY KEY("country_iso3166_1_a2","locale_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "district" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "district_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"country_iso3166_1_a2" char(2) NOT NULL,
	"state_id" integer,
	"code" varchar(31),
	"name" varchar(127) NOT NULL,
	"abbreviation" varchar(15),
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "district_i18n" (
	"district_id" integer NOT NULL,
	"locale_code" varchar(10) NOT NULL,
	"translation" varchar(127) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "district_i18n_district_id_locale_code_pk" PRIMARY KEY("district_id","locale_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "locale" (
	"code" varchar(10) PRIMARY KEY NOT NULL,
	"language" varchar(63) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "locale_i18n" (
	"locale_code_src" varchar(10) NOT NULL,
	"locale_code_dst" varchar(10) NOT NULL,
	"translation" varchar(127) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "locale_i18n_locale_code_src_locale_code_dst_pk" PRIMARY KEY("locale_code_src","locale_code_dst")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "minor_civil_division" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "minor_civil_division_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"district_id" integer NOT NULL,
	"code" varchar(31),
	"name" varchar(127) NOT NULL,
	"abbreviation" varchar(15),
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "minor_civil_division_i18n" (
	"minor_civil_division_id" integer NOT NULL,
	"locale_code" varchar(10) NOT NULL,
	"translation" varchar(127) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "minor_civil_division_i18n_minor_civil_division_id_locale_code_pk" PRIMARY KEY("minor_civil_division_id","locale_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post_code" (
	"code" varchar(31) NOT NULL,
	"country_iso3166_1_a2" char(2) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "post_code_code_country_iso3166_1_a2_pk" PRIMARY KEY("code","country_iso3166_1_a2"),
	CONSTRAINT "post_code_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "state" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "state_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"country_iso3166_1_a2" char(2) NOT NULL,
	"code" varchar(31),
	"name" varchar(127) NOT NULL,
	"abbreviation" varchar(15),
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "state_i18n" (
	"state_id" integer NOT NULL,
	"locale_code" varchar(10) NOT NULL,
	"translation" varchar(127) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "state_i18n_state_id_locale_code_pk" PRIMARY KEY("state_id","locale_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "access_account" (
	"username" varchar(63) PRIMARY KEY NOT NULL,
	"studio_id" integer,
	"password" varchar(63),
	"master_data_id" integer,
	"status" "access_account_status" NOT NULL,
	"role" "access_account_role" NOT NULL,
	"grant_flat_owner" boolean NOT NULL,
	"grant_supplier" boolean NOT NULL,
	"grant_employee" boolean NOT NULL,
	"grant_administrator" boolean NOT NULL,
	"notes" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "access_account_activation_request" (
	"activation_code" varchar(64) PRIMARY KEY NOT NULL,
	"studio_id" integer,
	"url" varchar(255),
	"username" varchar(63),
	"password" varchar(63),
	"email" varchar(63),
	"first_name" varchar(63),
	"last_name" varchar(63),
	"company_name" varchar(127),
	"master_data_category_id" integer,
	"access_account_role" varchar(15),
	"access_account_serialized" text,
	"client_session_id" varchar(63),
	"client_ip_address" varchar(15),
	"client_user_agent" varchar(255),
	"client_referer_url" varchar(255),
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "access_account_grant" (
	"username" varchar(63) NOT NULL,
	"grant_id" integer NOT NULL,
	"studio_id" integer,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "access_account_grant_username_grant_id_pk" PRIMARY KEY("username","grant_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bank_account" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bank_account_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer,
	"bank_id" integer,
	"country_iso3166_1_a2" char(2),
	"bank_name" varchar(255),
	"national_bank_code" char(8),
	"bank_branch_id" integer,
	"branch_name" varchar(255),
	"branch_code" char(6),
	"swift" char(11),
	"branch_address" text,
	"iban" varchar(31),
	"code" varchar(15),
	"holder" varchar(255),
	"account_number" varchar(22),
	"check_digits" char(2),
	"check_char" char(1),
	"national_check_digits" char(2),
	"notes" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bank_transfer_po" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bank_transfer_po_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer,
	"bank_account_id" integer,
	"reason_for_payment" varchar(255),
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company" (
	"master_data_id" integer PRIMARY KEY NOT NULL,
	"name" varchar(127) NOT NULL,
	"registered_office_address" text,
	"tax_purpose_address" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_variation" (
	"master_data_variation_id" integer PRIMARY KEY NOT NULL,
	"name" varchar(127) NOT NULL,
	"registered_office_address" text,
	"tax_purpose_address" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master_data" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_data_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer,
	"valid_from_date" date,
	"code" varchar(15),
	"status" "record_status",
	"tax_code" varchar(31),
	"vat_number" varchar(31),
	"master_data_category_id" integer,
	"postal_address" text,
	"preferred_locale_code" varchar(10),
	"qualification_id" integer,
	"bank_account_id" integer,
	"notes" text,
	"variation_notes" text,
	"created" timestamp with time zone,
	"created_master_data_id" integer,
	"updated" timestamp with time zone,
	"last_modified_master_data_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master_data_category" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_data_category_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer,
	"name" varchar(63) NOT NULL,
	"code" varchar(15),
	"order" integer,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master_data_category_i18n" (
	"master_data_category_id" integer NOT NULL,
	"locale_code" varchar(10) NOT NULL,
	"studio_id" integer,
	"translation" varchar(127) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "master_data_category_i18n_master_data_category_id_locale_code_pk" PRIMARY KEY("master_data_category_id","locale_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master_data_contact" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_data_contact_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer,
	"master_data_id" integer,
	"master_data_variation_id" integer,
	"type" "master_data_contact_type" NOT NULL,
	"label" varchar(31) NOT NULL,
	"value" varchar(127) NOT NULL,
	"order" integer,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master_data_contact_i18n" (
	"master_data_contact_id" integer NOT NULL,
	"locale_code" varchar(10) NOT NULL,
	"studio_id" integer,
	"translation" varchar(127) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "master_data_contact_i18n_master_data_contact_id_locale_code_pk" PRIMARY KEY("master_data_contact_id","locale_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master_data_cross_relation" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_data_cross_relation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer,
	"from_master_data_id" integer NOT NULL,
	"to_master_data_id" integer NOT NULL,
	"relation" varchar(127) NOT NULL,
	"order" integer,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master_data_cross_relation_i18n" (
	"master_data_cross_relation_id" integer NOT NULL,
	"locale_code" varchar(10) NOT NULL,
	"studio_id" integer,
	"translation" varchar(127) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "master_data_cross_relation_i18n_master_data_cross_relation_id_locale_code_pk" PRIMARY KEY("master_data_cross_relation_id","locale_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master_data_tax_treatment" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_data_tax_treatment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer,
	"master_data_id" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"tax_ac" boolean NOT NULL,
	"tax_770" boolean NOT NULL,
	"vat" integer,
	"tribute_id" integer,
	"withholding_tax" integer,
	"welfare_tax" integer,
	"apply_on_welfare_tax" boolean NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master_data_variation" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_data_variation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer,
	"master_data_id" integer NOT NULL,
	"valid_from_date" date,
	"valid_to_date" date,
	"tax_code" varchar(31),
	"vat_number" varchar(31),
	"postal_address" text,
	"qualification_id" integer,
	"bank_account_id" integer,
	"variation_notes" text,
	"created" timestamp with time zone,
	"created_master_data_id" integer,
	"updated" timestamp with time zone,
	"last_modified_master_data_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_reset_request" (
	"reset_code" varchar(64) PRIMARY KEY NOT NULL,
	"studio_id" integer,
	"username" varchar(63) NOT NULL,
	"email" varchar(63) NOT NULL,
	"client_session_id" varchar(63),
	"client_ip_address" varchar(15),
	"client_user_agent" varchar(255),
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "person" (
	"master_data_id" integer PRIMARY KEY NOT NULL,
	"first_name" varchar(63),
	"middle_name" varchar(63),
	"last_name" varchar(63),
	"sex" "person_sex",
	"birth_date" date,
	"birth_place" text,
	"citizenship_iso3166_1_a2" char(2),
	"office_address" text,
	"permanent_address" text,
	"current_address" text,
	"occupation" varchar(63),
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "person_variation" (
	"master_data_variation_id" integer PRIMARY KEY NOT NULL,
	"first_name" varchar(63),
	"middle_name" varchar(63),
	"last_name" varchar(63),
	"citizenship_iso3166_1_a2" char(2),
	"office_address" text,
	"permanent_address" text,
	"current_address" text,
	"occupation" varchar(63),
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "qualification" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "qualification_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer,
	"country_iso3166_1_a2" char(2) NOT NULL,
	"name" varchar(31) NOT NULL,
	"code" varchar(15),
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "studio" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "studio_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"master_data_id" integer,
	"country_iso3166_1_a2" char(2),
	"default_locale_code" varchar(10),
	"header_text" text,
	"footer_text" text,
	"notes" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "condominium" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "condominium_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer NOT NULL,
	"parent_condominium_id" integer,
	"name" varchar(63) NOT NULL,
	"code" varchar(15),
	"status" "record_status",
	"type" "condominium_type" NOT NULL,
	"address" text,
	"tax_code" varchar(31),
	"vat_number" varchar(31),
	"manufactured_date" date,
	"land_registry" varchar(127),
	"bank_account_id" integer,
	"notes" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "condominium_attribute" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "condominium_attribute_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer NOT NULL,
	"condominium_id" integer NOT NULL,
	"label" varchar(31) NOT NULL,
	"value" varchar(31) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "condominium_attribute_i18n" (
	"condominium_attribute_id" integer NOT NULL,
	"locale_code" varchar(10) NOT NULL,
	"studio_id" integer NOT NULL,
	"label_translation" varchar(63) NOT NULL,
	"value_translation" varchar(63) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "condominium_attribute_i18n_condominium_attribute_id_locale_code_pk" PRIMARY KEY("condominium_attribute_id","locale_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "condominium_calendar_event" (
	"calendar_event_id" integer PRIMARY KEY NOT NULL,
	"condominium_id" integer,
	"accounting_period_id" integer,
	"unit_group_id" integer,
	"unit_id" integer,
	"unit_resident_id" integer,
	"master_data_id" integer,
	"show_on_frontend" boolean NOT NULL,
	"show_date" boolean NOT NULL,
	"show_from" date,
	"show_to" date,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "condominium_supplier" (
	"condominium_id" integer NOT NULL,
	"master_data_id" integer NOT NULL,
	"studio_id" integer NOT NULL,
	"order" integer,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "condominium_supplier_condominium_id_master_data_id_pk" PRIMARY KEY("condominium_id","master_data_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unit" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "unit_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer NOT NULL,
	"accounting_period_id" integer NOT NULL,
	"unit_type_id" integer,
	"unit_group_id" integer,
	"code" varchar(15),
	"name" varchar(63),
	"floor" varchar(15),
	"inner_number" varchar(15),
	"subordinate_number" varchar(15),
	"period_restriction_start_date" date,
	"period_restriction_end_date" date,
	"land_registry" varchar(127),
	"notes" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unit_group" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "unit_group_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer NOT NULL,
	"parent_unit_group_id" integer,
	"accounting_period_id" integer NOT NULL,
	"code" varchar(15) NOT NULL,
	"name" varchar(127) NOT NULL,
	"address" text,
	"notes" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unit_ownership_scenario" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "unit_ownership_scenario_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"country_iso3166_1_a2" char(2) NOT NULL,
	"name" varchar(63) NOT NULL,
	"order" integer,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unit_ownership_scenario_i18n" (
	"unit_ownership_scenario_id" integer NOT NULL,
	"locale_code" varchar(10) NOT NULL,
	"translation" varchar(63) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "unit_ownership_scenario_i18n_unit_ownership_scenario_id_locale_code_pk" PRIMARY KEY("unit_ownership_scenario_id","locale_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unit_period" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "unit_period_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer NOT NULL,
	"unit_id" integer NOT NULL,
	"unit_ownership_scenario_id" integer NOT NULL,
	"period_restriction_start_date" date,
	"period_restriction_end_date" date,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unit_resident" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "unit_resident_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer NOT NULL,
	"unit_period_id" integer NOT NULL,
	"master_data_id" integer NOT NULL,
	"system_username" varchar(63) NOT NULL,
	"unit_resident_priority_id" integer NOT NULL,
	"period_restriction_start_date" date,
	"period_restriction_end_date" date,
	"percentage" numeric(10, 6),
	"starting_balance" numeric(10, 2) NOT NULL,
	"starting_balance_ledger_entry_id" integer,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unit_resident_account" (
	"system_username" varchar(63) PRIMARY KEY NOT NULL,
	"studio_id" integer NOT NULL,
	"activation_clear_text_password" varchar(63),
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unit_resident_priority" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "unit_resident_priority_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"country_iso3166_1_a2" char(2) NOT NULL,
	"priority" integer NOT NULL,
	"roles_abbreviation_list" varchar(15),
	"notes" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unit_resident_role" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "unit_resident_role_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"country_iso3166_1_a2" char(2) NOT NULL,
	"unit_ownership_scenario_id" integer NOT NULL,
	"unit_resident_priority_id" integer NOT NULL,
	"abbreviation" varchar(15) NOT NULL,
	"name" varchar(63) NOT NULL,
	"plural_name" varchar(63) NOT NULL,
	"notes" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unit_resident_role_i18n" (
	"unit_resident_role_id" integer NOT NULL,
	"locale_code" varchar(10) NOT NULL,
	"abbreviation_translation" varchar(15) NOT NULL,
	"name_translation" varchar(63) NOT NULL,
	"plural_name_translation" varchar(63) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "unit_resident_role_i18n_unit_resident_role_id_locale_code_pk" PRIMARY KEY("unit_resident_role_id","locale_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unit_type" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "unit_type_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer NOT NULL,
	"name" varchar(63) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unit_type_i18n" (
	"unit_type_id" integer NOT NULL,
	"locale_code" varchar(10) NOT NULL,
	"studio_id" integer NOT NULL,
	"translation" varchar(63) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "unit_type_i18n_unit_type_id_locale_code_pk" PRIMARY KEY("unit_type_id","locale_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consumption_meter" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "consumption_meter_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer NOT NULL,
	"name" varchar(63) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expense_la2_role" (
	"expense_la2_table_id" integer NOT NULL,
	"unit_resident_priority_id" integer NOT NULL,
	"studio_id" integer NOT NULL,
	"percentage" numeric(5, 2),
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "expense_la2_role_expense_la2_table_id_unit_resident_priority_id_pk" PRIMARY KEY("expense_la2_table_id","unit_resident_priority_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expense_la2_table" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_la2_table_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer NOT NULL,
	"expense_ledger_account_id" integer NOT NULL,
	"distribution_table_id" integer NOT NULL,
	"type" "expense_la2_table_type",
	"percentage" numeric(5, 2),
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expense_la_unit_exception" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_la_unit_exception_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer NOT NULL,
	"expense_ledger_account_id" integer NOT NULL,
	"unit_id" integer NOT NULL,
	"expense_la2_table_id" integer,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expense_la_unit_exception_item" (
	"expense_la_unit_exception_id" integer NOT NULL,
	"unit_resident_priority_id" integer NOT NULL,
	"studio_id" integer NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "expense_la_unit_exception_item_expense_la_unit_exception_id_unit_resident_priority_id_pk" PRIMARY KEY("expense_la_unit_exception_id","unit_resident_priority_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expense_ledger_account" (
	"ledger_account_id" integer PRIMARY KEY NOT NULL,
	"restriction_unit_group_id" integer,
	"estimate" numeric(10, 2),
	"use_distinct_tables_for_estimate" boolean,
	"cost_attribution_on_handover" "cost_attribution_on_handover",
	"next_period_estimate_based_on" "next_period_estimate_based_on",
	"next_period_estimate_increase_percentage" real,
	"next_period_estimate_increase_fixed_amount" numeric(10, 2),
	"tax_relief_id" integer,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "f24" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "f24_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer NOT NULL,
	"condominium_id" integer NOT NULL,
	"reference_date" date,
	"payment_date" date,
	"confirmed" boolean NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_account" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ledger_account_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer NOT NULL,
	"accounting_period_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"abbreviation" varchar(63),
	"description" text,
	"type" "ledger_account_type" NOT NULL,
	"order" integer,
	"parent_ledger_account_id" integer,
	"default_counter_account_id" integer,
	"default_counter_account_master_data_id" integer,
	"kind" "ledger_account_kind" NOT NULL,
	"period_restriction_start_date" date,
	"period_restriction_end_date" date,
	"balance_hard_lower_limit" numeric(10, 2),
	"balance_hard_upper_limit" numeric(10, 2),
	"balance_soft_lower_limit" numeric(10, 2),
	"balance_soft_upper_limit" numeric(10, 2),
	"notes" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_account_i18n" (
	"ledger_account_id" integer NOT NULL,
	"locale_code" varchar(10) NOT NULL,
	"studio_id" integer NOT NULL,
	"name_translation" varchar(255) NOT NULL,
	"abbreviation_translation" varchar(63),
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "ledger_account_i18n_ledger_account_id_locale_code_pk" PRIMARY KEY("ledger_account_id","locale_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_entry" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ledger_entry_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer NOT NULL,
	"ledger_transaction_id" integer NOT NULL,
	"posting_account_id" integer NOT NULL,
	"master_data_id" integer,
	"unit_resident_id" integer,
	"installment_item_id" integer,
	"ledger_invoice_id" integer,
	"amount" numeric(10, 2) NOT NULL,
	"order" integer NOT NULL,
	"type" "ledger_entry_type",
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_entry_2_ur_distribution" (
	"ledger_entry_id" integer NOT NULL,
	"unit_resident_id" integer NOT NULL,
	"studio_id" integer NOT NULL,
	"type" "ledger_entry_2_ur_distribution_type",
	"amount" numeric(10, 2),
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "ledger_entry_2_ur_distribution_ledger_entry_id_unit_resident_id_pk" PRIMARY KEY("ledger_entry_id","unit_resident_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_invoice" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ledger_invoice_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer NOT NULL,
	"accounting_period_id" integer NOT NULL,
	"master_data_id" integer NOT NULL,
	"number" varchar(15) NOT NULL,
	"description" varchar(127),
	"date" date NOT NULL,
	"expiry_date" date,
	"settlement_date" date,
	"taxable_base" numeric(10, 2) NOT NULL,
	"total_tax_free_amount" numeric(10, 2),
	"welfare_tax_percentage" numeric(5, 2),
	"vat_percentage" numeric(5, 2),
	"mixed_vat_amount" numeric(10, 2),
	"withholding_tax_id" integer,
	"apply_withholding_tax_on_welfare_tax" integer NOT NULL,
	"quadro_ac" integer NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_invoice_2_f24" (
	"f24_id" integer NOT NULL,
	"ledger_invoice_id" integer NOT NULL,
	"studio_id" integer NOT NULL,
	"ledger_entry_id" integer,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "ledger_invoice_2_f24_f24_id_ledger_invoice_id_pk" PRIMARY KEY("f24_id","ledger_invoice_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_transaction" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ledger_transaction_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer NOT NULL,
	"accounting_period_id" integer NOT NULL,
	"code" integer NOT NULL,
	"type" "ledger_transaction_type",
	"ledger_invoice_id" integer,
	"timestamp" timestamp with time zone,
	"description" varchar(255) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tax_relief" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tax_relief_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"country_iso3166_1_a2" char(2) NOT NULL,
	"name" varchar(63) NOT NULL,
	"description" text,
	"percentage" numeric(5, 2) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tribute" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tribute_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"country_iso3166_1_a2" char(2) NOT NULL,
	"code" varchar(15) NOT NULL,
	"name" varchar(63),
	"default_vat" integer,
	"default_withholding_tax" integer,
	"default_welfare_tax" integer,
	"notes" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "withholding_tax" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "withholding_tax_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"country_iso3166_1_a2" char(2) NOT NULL,
	"code" varchar(10),
	"name" varchar(32) NOT NULL,
	"description" varchar(255),
	"percentage" numeric(5, 2) NOT NULL,
	"notes" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "withholding_tax_2_la" (
	"withholding_tax_id" integer NOT NULL,
	"ledger_account_id" integer NOT NULL,
	"studio_id" integer NOT NULL,
	"accounting_period_id" integer NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "withholding_tax_2_la_withholding_tax_id_ledger_account_id_pk" PRIMARY KEY("withholding_tax_id","ledger_account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "distribution_table" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "distribution_table_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer NOT NULL,
	"accounting_period_id" integer NOT NULL,
	"name" varchar(63) NOT NULL,
	"order" integer,
	"restriction_unit_group_id" integer,
	"consumption_meter_id" integer,
	"notes" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "distribution_table_item" (
	"distribution_table_id" integer NOT NULL,
	"unit_id" integer NOT NULL,
	"studio_id" integer NOT NULL,
	"coefficient" numeric(20, 6) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "distribution_table_item_distribution_table_id_unit_id_pk" PRIMARY KEY("distribution_table_id","unit_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounting_period" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "accounting_period_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer NOT NULL,
	"condominium_id" integer NOT NULL,
	"name" varchar(31) NOT NULL,
	"type" "accounting_period_type" NOT NULL,
	"status" "accounting_period_status" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"supplier_accounts_payable_ledger_account_id" integer,
	"flat_resident_accounts_receivable_ledger_account_id" integer,
	"flat_resident_rounding_off_ledger_account_id" integer,
	"individual_expenses_ledger_account_id" integer,
	"default_checking_account_ledger_account_id" integer,
	"payment_in_cash_ledger_account_id" integer,
	"withholding_tax_penalty_ledger_account_id" integer,
	"notes" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounting_period_installment_default_settings" (
	"accounting_period_id" integer PRIMARY KEY NOT NULL,
	"studio_id" integer NOT NULL,
	"number_of_installments" integer,
	"first_installment_expiry_date" date,
	"period_in_months" integer,
	"credit_opening_balance_distribution_mode" "opening_balance_distribution_mode" NOT NULL,
	"credit_opening_balance_specific_installment" integer NOT NULL,
	"debt_opening_balance_distribution_mode" "opening_balance_distribution_mode" NOT NULL,
	"debt_opening_balance_specific_installment" integer NOT NULL,
	"round_off_to_integer" boolean NOT NULL,
	"deduct_issued_installments" boolean NOT NULL,
	"deduct_downpayments" boolean NOT NULL,
	"last_downpayment_date_to_deduct" date,
	"redistribute_deduction" boolean NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "installment" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "installment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer NOT NULL,
	"accounting_period_id" integer NOT NULL,
	"installment_group_id" integer,
	"type" "installment_type" NOT NULL,
	"name" varchar(63) NOT NULL,
	"expiry_date" date NOT NULL,
	"percentage" integer,
	"previous_balance_percentage" integer,
	"locked" boolean NOT NULL,
	"rounded_up_to_integer" boolean NOT NULL,
	"notes" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "installment_group" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "installment_group_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer NOT NULL,
	"accounting_period_id" integer NOT NULL,
	"name" varchar(63) NOT NULL,
	"type" "installment_type" NOT NULL,
	"number_of_installments" integer,
	"first_installment_expiry_date" date NOT NULL,
	"period_in_months" integer,
	"credit_opening_balance_distribution_mode" "opening_balance_distribution_mode" NOT NULL,
	"credit_opening_balance_specific_installment" integer NOT NULL,
	"debt_opening_balance_distribution_mode" "opening_balance_distribution_mode" NOT NULL,
	"debt_opening_balance_specific_installment" integer NOT NULL,
	"round_off_to_integer" boolean NOT NULL,
	"deduct_issued_installments" boolean NOT NULL,
	"deduct_downpayments" boolean NOT NULL,
	"last_downpayment_date_to_deduct" date,
	"redistribute_deduction" boolean NOT NULL,
	"notes" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "installment_group_i18n" (
	"installment_group_id" integer NOT NULL,
	"locale_code" varchar(10) NOT NULL,
	"studio_id" integer NOT NULL,
	"translation" varchar(63) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "installment_group_i18n_installment_group_id_locale_code_pk" PRIMARY KEY("installment_group_id","locale_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "installment_i18n" (
	"installment_id" integer NOT NULL,
	"locale_code" varchar(10) NOT NULL,
	"studio_id" integer NOT NULL,
	"translation" varchar(63) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "installment_i18n_installment_id_locale_code_pk" PRIMARY KEY("installment_id","locale_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "installment_item" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "installment_item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer NOT NULL,
	"installment_id" integer NOT NULL,
	"unit_resident_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" "installment_item_status" NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "installment_payment_slip" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "installment_payment_slip_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer NOT NULL,
	"code" varchar(63),
	"master_data_id" integer NOT NULL,
	"status" "installment_payment_slip_status" NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "installment_payment_slip_item" (
	"installment_payment_slip_id" integer NOT NULL,
	"installment_item_id" integer NOT NULL,
	"studio_id" integer NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "installment_payment_slip_item_installment_payment_slip_id_installment_item_id_pk" PRIMARY KEY("installment_payment_slip_id","installment_item_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_event" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "calendar_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer,
	"layer_id" integer,
	"date" timestamp with time zone,
	"ignore_time" boolean NOT NULL,
	"description" varchar(255) NOT NULL,
	"priority" "event_priority",
	"status" varchar(31),
	"data" text,
	"data_type" varchar(31),
	"data_key" text,
	"notes" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_layer" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "calendar_layer_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer,
	"name" varchar(31) NOT NULL,
	"description" text,
	"color" integer,
	"order" integer,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grant" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "grant_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer,
	"code" varchar(31) NOT NULL,
	"name" varchar(255) NOT NULL,
	"order" integer,
	"notes" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grant_i18n" (
	"grant_id" integer NOT NULL,
	"locale_code" varchar(10) NOT NULL,
	"studio_id" integer,
	"translation" varchar(127) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "grant_i18n_grant_id_locale_code_pk" PRIMARY KEY("grant_id","locale_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "license" (
	"id" integer PRIMARY KEY NOT NULL,
	"studio_id" integer NOT NULL,
	"type" "license_type" NOT NULL,
	"code" varchar(255),
	"control_code" varchar(255),
	"start_date" date,
	"expiry_date" date,
	"notes" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "property_manager" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "property_manager_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer NOT NULL,
	"master_data_id" integer NOT NULL,
	"signature" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "property_managers_association" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "property_managers_association_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"country_iso3166_1_a2" char(2) NOT NULL,
	"name" varchar(63) NOT NULL,
	"register_number_label" varchar(31) NOT NULL,
	"notes" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "property_managers_association_code" (
	"property_manager_id" integer NOT NULL,
	"property_managers_association_id" integer NOT NULL,
	"code" varchar(127) NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone,
	CONSTRAINT "property_managers_association_code_property_manager_id_property_managers_association_id_pk" PRIMARY KEY("property_manager_id","property_managers_association_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticket" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ticket_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer,
	"ticket_topic_id" integer,
	"context_id" integer,
	"context_type" varchar(31),
	"opened_by_username" varchar(63),
	"opened_by_nominative_cache" varchar(127),
	"status" "ticket_status" NOT NULL,
	"priority" "event_priority",
	"subject" varchar(255) NOT NULL,
	"url" varchar(255),
	"notes" text,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticket_message" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ticket_message_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"ticket_id" integer NOT NULL,
	"author_username" varchar(63),
	"author_nominative_cache" varchar(127),
	"message" text,
	"read_by_ticket_opener" boolean NOT NULL,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticket_topic" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ticket_topic_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"studio_id" integer,
	"name" varchar(63) NOT NULL,
	"code" varchar(15),
	"order" integer,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank" ADD CONSTRAINT "bank_country_iso3166_1_a2_country_iso3166_1_alpha2_fk" FOREIGN KEY ("country_iso3166_1_a2") REFERENCES "public"."country"("iso3166_1_alpha2") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_branch" ADD CONSTRAINT "bank_branch_bank_id_bank_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."bank"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_branch" ADD CONSTRAINT "bank_branch_master_data_id_master_data_id_fk" FOREIGN KEY ("master_data_id") REFERENCES "public"."master_data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_branch" ADD CONSTRAINT "bank_branch_city_id_city_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."city"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_branch" ADD CONSTRAINT "bank_branch_district_id_district_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."district"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_branch" ADD CONSTRAINT "bank_branch_state_id_state_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."state"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_branch" ADD CONSTRAINT "bank_branch_country_iso3166_1_a2_country_iso3166_1_alpha2_fk" FOREIGN KEY ("country_iso3166_1_a2") REFERENCES "public"."country"("iso3166_1_alpha2") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "city" ADD CONSTRAINT "city_country_iso3166_1_a2_country_iso3166_1_alpha2_fk" FOREIGN KEY ("country_iso3166_1_a2") REFERENCES "public"."country"("iso3166_1_alpha2") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "city" ADD CONSTRAINT "city_state_id_state_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."state"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "city" ADD CONSTRAINT "city_district_id_district_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."district"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "city" ADD CONSTRAINT "city_minor_civil_division_id_minor_civil_division_id_fk" FOREIGN KEY ("minor_civil_division_id") REFERENCES "public"."minor_civil_division"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "city_i18n" ADD CONSTRAINT "city_i18n_city_id_city_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."city"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "city_i18n" ADD CONSTRAINT "city_i18n_locale_code_locale_code_fk" FOREIGN KEY ("locale_code") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "city_post_code" ADD CONSTRAINT "city_post_code_city_id_city_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."city"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "city_post_code" ADD CONSTRAINT "city_post_code_post_code_post_code_code_fk" FOREIGN KEY ("post_code") REFERENCES "public"."post_code"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "country" ADD CONSTRAINT "country_primary_locale_code_locale_code_fk" FOREIGN KEY ("primary_locale_code") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "country" ADD CONSTRAINT "country_secondary_locale_code_locale_code_fk" FOREIGN KEY ("secondary_locale_code") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "country" ADD CONSTRAINT "country_tertiary_locale_code_locale_code_fk" FOREIGN KEY ("tertiary_locale_code") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "country_i18n" ADD CONSTRAINT "country_i18n_country_iso3166_1_a2_country_iso3166_1_alpha2_fk" FOREIGN KEY ("country_iso3166_1_a2") REFERENCES "public"."country"("iso3166_1_alpha2") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "country_i18n" ADD CONSTRAINT "country_i18n_locale_code_locale_code_fk" FOREIGN KEY ("locale_code") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "district" ADD CONSTRAINT "district_country_iso3166_1_a2_country_iso3166_1_alpha2_fk" FOREIGN KEY ("country_iso3166_1_a2") REFERENCES "public"."country"("iso3166_1_alpha2") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "district" ADD CONSTRAINT "district_state_id_state_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."state"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "district_i18n" ADD CONSTRAINT "district_i18n_district_id_district_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."district"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "district_i18n" ADD CONSTRAINT "district_i18n_locale_code_locale_code_fk" FOREIGN KEY ("locale_code") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "locale_i18n" ADD CONSTRAINT "locale_i18n_locale_code_src_locale_code_fk" FOREIGN KEY ("locale_code_src") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "locale_i18n" ADD CONSTRAINT "locale_i18n_locale_code_dst_locale_code_fk" FOREIGN KEY ("locale_code_dst") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "minor_civil_division" ADD CONSTRAINT "minor_civil_division_district_id_district_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."district"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "minor_civil_division_i18n" ADD CONSTRAINT "minor_civil_division_i18n_minor_civil_division_id_minor_civil_division_id_fk" FOREIGN KEY ("minor_civil_division_id") REFERENCES "public"."minor_civil_division"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "minor_civil_division_i18n" ADD CONSTRAINT "minor_civil_division_i18n_locale_code_locale_code_fk" FOREIGN KEY ("locale_code") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "post_code" ADD CONSTRAINT "post_code_country_iso3166_1_a2_country_iso3166_1_alpha2_fk" FOREIGN KEY ("country_iso3166_1_a2") REFERENCES "public"."country"("iso3166_1_alpha2") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "state" ADD CONSTRAINT "state_country_iso3166_1_a2_country_iso3166_1_alpha2_fk" FOREIGN KEY ("country_iso3166_1_a2") REFERENCES "public"."country"("iso3166_1_alpha2") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "state_i18n" ADD CONSTRAINT "state_i18n_state_id_state_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."state"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "state_i18n" ADD CONSTRAINT "state_i18n_locale_code_locale_code_fk" FOREIGN KEY ("locale_code") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_account" ADD CONSTRAINT "access_account_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_account" ADD CONSTRAINT "access_account_master_data_id_master_data_id_fk" FOREIGN KEY ("master_data_id") REFERENCES "public"."master_data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_account_activation_request" ADD CONSTRAINT "access_account_activation_request_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_account_grant" ADD CONSTRAINT "access_account_grant_username_access_account_username_fk" FOREIGN KEY ("username") REFERENCES "public"."access_account"("username") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_account_grant" ADD CONSTRAINT "access_account_grant_grant_id_grant_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."grant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_account_grant" ADD CONSTRAINT "access_account_grant_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_account" ADD CONSTRAINT "bank_account_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_account" ADD CONSTRAINT "bank_account_bank_id_bank_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."bank"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_account" ADD CONSTRAINT "bank_account_country_iso3166_1_a2_country_iso3166_1_alpha2_fk" FOREIGN KEY ("country_iso3166_1_a2") REFERENCES "public"."country"("iso3166_1_alpha2") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_account" ADD CONSTRAINT "bank_account_bank_branch_id_bank_branch_id_fk" FOREIGN KEY ("bank_branch_id") REFERENCES "public"."bank_branch"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_transfer_po" ADD CONSTRAINT "bank_transfer_po_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_transfer_po" ADD CONSTRAINT "bank_transfer_po_bank_account_id_bank_account_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company" ADD CONSTRAINT "company_master_data_id_master_data_id_fk" FOREIGN KEY ("master_data_id") REFERENCES "public"."master_data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_variation" ADD CONSTRAINT "company_variation_master_data_variation_id_master_data_variation_id_fk" FOREIGN KEY ("master_data_variation_id") REFERENCES "public"."master_data_variation"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data" ADD CONSTRAINT "master_data_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data" ADD CONSTRAINT "master_data_master_data_category_id_master_data_category_id_fk" FOREIGN KEY ("master_data_category_id") REFERENCES "public"."master_data_category"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data" ADD CONSTRAINT "master_data_preferred_locale_code_locale_code_fk" FOREIGN KEY ("preferred_locale_code") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data" ADD CONSTRAINT "master_data_qualification_id_qualification_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualification"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data" ADD CONSTRAINT "master_data_bank_account_id_bank_account_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data" ADD CONSTRAINT "master_data_created_master_data_id_master_data_id_fk" FOREIGN KEY ("created_master_data_id") REFERENCES "public"."master_data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data" ADD CONSTRAINT "master_data_last_modified_master_data_id_master_data_id_fk" FOREIGN KEY ("last_modified_master_data_id") REFERENCES "public"."master_data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_category" ADD CONSTRAINT "master_data_category_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_category_i18n" ADD CONSTRAINT "master_data_category_i18n_master_data_category_id_master_data_category_id_fk" FOREIGN KEY ("master_data_category_id") REFERENCES "public"."master_data_category"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_category_i18n" ADD CONSTRAINT "master_data_category_i18n_locale_code_locale_code_fk" FOREIGN KEY ("locale_code") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_category_i18n" ADD CONSTRAINT "master_data_category_i18n_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_contact" ADD CONSTRAINT "master_data_contact_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_contact" ADD CONSTRAINT "master_data_contact_master_data_id_master_data_id_fk" FOREIGN KEY ("master_data_id") REFERENCES "public"."master_data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_contact" ADD CONSTRAINT "master_data_contact_master_data_variation_id_master_data_variation_id_fk" FOREIGN KEY ("master_data_variation_id") REFERENCES "public"."master_data_variation"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_contact_i18n" ADD CONSTRAINT "master_data_contact_i18n_master_data_contact_id_master_data_contact_id_fk" FOREIGN KEY ("master_data_contact_id") REFERENCES "public"."master_data_contact"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_contact_i18n" ADD CONSTRAINT "master_data_contact_i18n_locale_code_locale_code_fk" FOREIGN KEY ("locale_code") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_contact_i18n" ADD CONSTRAINT "master_data_contact_i18n_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_cross_relation" ADD CONSTRAINT "master_data_cross_relation_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_cross_relation" ADD CONSTRAINT "master_data_cross_relation_from_master_data_id_master_data_id_fk" FOREIGN KEY ("from_master_data_id") REFERENCES "public"."master_data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_cross_relation" ADD CONSTRAINT "master_data_cross_relation_to_master_data_id_master_data_id_fk" FOREIGN KEY ("to_master_data_id") REFERENCES "public"."master_data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_cross_relation_i18n" ADD CONSTRAINT "master_data_cross_relation_i18n_master_data_cross_relation_id_master_data_cross_relation_id_fk" FOREIGN KEY ("master_data_cross_relation_id") REFERENCES "public"."master_data_cross_relation"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_cross_relation_i18n" ADD CONSTRAINT "master_data_cross_relation_i18n_locale_code_locale_code_fk" FOREIGN KEY ("locale_code") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_cross_relation_i18n" ADD CONSTRAINT "master_data_cross_relation_i18n_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_tax_treatment" ADD CONSTRAINT "master_data_tax_treatment_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_tax_treatment" ADD CONSTRAINT "master_data_tax_treatment_master_data_id_master_data_id_fk" FOREIGN KEY ("master_data_id") REFERENCES "public"."master_data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_tax_treatment" ADD CONSTRAINT "master_data_tax_treatment_tribute_id_tribute_id_fk" FOREIGN KEY ("tribute_id") REFERENCES "public"."tribute"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_variation" ADD CONSTRAINT "master_data_variation_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_variation" ADD CONSTRAINT "master_data_variation_master_data_id_master_data_id_fk" FOREIGN KEY ("master_data_id") REFERENCES "public"."master_data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_variation" ADD CONSTRAINT "master_data_variation_qualification_id_qualification_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."qualification"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_variation" ADD CONSTRAINT "master_data_variation_bank_account_id_bank_account_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_variation" ADD CONSTRAINT "master_data_variation_created_master_data_id_master_data_id_fk" FOREIGN KEY ("created_master_data_id") REFERENCES "public"."master_data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_data_variation" ADD CONSTRAINT "master_data_variation_last_modified_master_data_id_master_data_id_fk" FOREIGN KEY ("last_modified_master_data_id") REFERENCES "public"."master_data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "password_reset_request" ADD CONSTRAINT "password_reset_request_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "person" ADD CONSTRAINT "person_master_data_id_master_data_id_fk" FOREIGN KEY ("master_data_id") REFERENCES "public"."master_data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "person" ADD CONSTRAINT "person_citizenship_iso3166_1_a2_country_iso3166_1_alpha2_fk" FOREIGN KEY ("citizenship_iso3166_1_a2") REFERENCES "public"."country"("iso3166_1_alpha2") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "person_variation" ADD CONSTRAINT "person_variation_master_data_variation_id_master_data_variation_id_fk" FOREIGN KEY ("master_data_variation_id") REFERENCES "public"."master_data_variation"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "person_variation" ADD CONSTRAINT "person_variation_citizenship_iso3166_1_a2_country_iso3166_1_alpha2_fk" FOREIGN KEY ("citizenship_iso3166_1_a2") REFERENCES "public"."country"("iso3166_1_alpha2") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "qualification" ADD CONSTRAINT "qualification_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "qualification" ADD CONSTRAINT "qualification_country_iso3166_1_a2_country_iso3166_1_alpha2_fk" FOREIGN KEY ("country_iso3166_1_a2") REFERENCES "public"."country"("iso3166_1_alpha2") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "studio" ADD CONSTRAINT "studio_master_data_id_master_data_id_fk" FOREIGN KEY ("master_data_id") REFERENCES "public"."master_data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "studio" ADD CONSTRAINT "studio_country_iso3166_1_a2_country_iso3166_1_alpha2_fk" FOREIGN KEY ("country_iso3166_1_a2") REFERENCES "public"."country"("iso3166_1_alpha2") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "studio" ADD CONSTRAINT "studio_default_locale_code_locale_code_fk" FOREIGN KEY ("default_locale_code") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "condominium" ADD CONSTRAINT "condominium_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "condominium" ADD CONSTRAINT "condominium_parent_condominium_id_condominium_id_fk" FOREIGN KEY ("parent_condominium_id") REFERENCES "public"."condominium"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "condominium" ADD CONSTRAINT "condominium_bank_account_id_bank_account_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "condominium_attribute" ADD CONSTRAINT "condominium_attribute_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "condominium_attribute" ADD CONSTRAINT "condominium_attribute_condominium_id_condominium_id_fk" FOREIGN KEY ("condominium_id") REFERENCES "public"."condominium"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "condominium_attribute_i18n" ADD CONSTRAINT "condominium_attribute_i18n_condominium_attribute_id_condominium_attribute_id_fk" FOREIGN KEY ("condominium_attribute_id") REFERENCES "public"."condominium_attribute"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "condominium_attribute_i18n" ADD CONSTRAINT "condominium_attribute_i18n_locale_code_locale_code_fk" FOREIGN KEY ("locale_code") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "condominium_attribute_i18n" ADD CONSTRAINT "condominium_attribute_i18n_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "condominium_calendar_event" ADD CONSTRAINT "condominium_calendar_event_calendar_event_id_calendar_event_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_event"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "condominium_calendar_event" ADD CONSTRAINT "condominium_calendar_event_condominium_id_condominium_id_fk" FOREIGN KEY ("condominium_id") REFERENCES "public"."condominium"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "condominium_calendar_event" ADD CONSTRAINT "condominium_calendar_event_accounting_period_id_accounting_period_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_period"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "condominium_calendar_event" ADD CONSTRAINT "condominium_calendar_event_unit_group_id_unit_group_id_fk" FOREIGN KEY ("unit_group_id") REFERENCES "public"."unit_group"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "condominium_calendar_event" ADD CONSTRAINT "condominium_calendar_event_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "condominium_calendar_event" ADD CONSTRAINT "condominium_calendar_event_unit_resident_id_unit_resident_id_fk" FOREIGN KEY ("unit_resident_id") REFERENCES "public"."unit_resident"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "condominium_calendar_event" ADD CONSTRAINT "condominium_calendar_event_master_data_id_master_data_id_fk" FOREIGN KEY ("master_data_id") REFERENCES "public"."master_data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "condominium_supplier" ADD CONSTRAINT "condominium_supplier_condominium_id_condominium_id_fk" FOREIGN KEY ("condominium_id") REFERENCES "public"."condominium"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "condominium_supplier" ADD CONSTRAINT "condominium_supplier_master_data_id_master_data_id_fk" FOREIGN KEY ("master_data_id") REFERENCES "public"."master_data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "condominium_supplier" ADD CONSTRAINT "condominium_supplier_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit" ADD CONSTRAINT "unit_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit" ADD CONSTRAINT "unit_accounting_period_id_accounting_period_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_period"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit" ADD CONSTRAINT "unit_unit_type_id_unit_type_id_fk" FOREIGN KEY ("unit_type_id") REFERENCES "public"."unit_type"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit" ADD CONSTRAINT "unit_unit_group_id_unit_group_id_fk" FOREIGN KEY ("unit_group_id") REFERENCES "public"."unit_group"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_group" ADD CONSTRAINT "unit_group_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_group" ADD CONSTRAINT "unit_group_parent_unit_group_id_unit_group_id_fk" FOREIGN KEY ("parent_unit_group_id") REFERENCES "public"."unit_group"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_group" ADD CONSTRAINT "unit_group_accounting_period_id_accounting_period_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_period"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_ownership_scenario" ADD CONSTRAINT "unit_ownership_scenario_country_iso3166_1_a2_country_iso3166_1_alpha2_fk" FOREIGN KEY ("country_iso3166_1_a2") REFERENCES "public"."country"("iso3166_1_alpha2") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_ownership_scenario_i18n" ADD CONSTRAINT "unit_ownership_scenario_i18n_unit_ownership_scenario_id_unit_ownership_scenario_id_fk" FOREIGN KEY ("unit_ownership_scenario_id") REFERENCES "public"."unit_ownership_scenario"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_ownership_scenario_i18n" ADD CONSTRAINT "unit_ownership_scenario_i18n_locale_code_locale_code_fk" FOREIGN KEY ("locale_code") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_period" ADD CONSTRAINT "unit_period_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_period" ADD CONSTRAINT "unit_period_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_period" ADD CONSTRAINT "unit_period_unit_ownership_scenario_id_unit_ownership_scenario_id_fk" FOREIGN KEY ("unit_ownership_scenario_id") REFERENCES "public"."unit_ownership_scenario"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_resident" ADD CONSTRAINT "unit_resident_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_resident" ADD CONSTRAINT "unit_resident_unit_period_id_unit_period_id_fk" FOREIGN KEY ("unit_period_id") REFERENCES "public"."unit_period"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_resident" ADD CONSTRAINT "unit_resident_master_data_id_master_data_id_fk" FOREIGN KEY ("master_data_id") REFERENCES "public"."master_data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_resident" ADD CONSTRAINT "unit_resident_system_username_unit_resident_account_system_username_fk" FOREIGN KEY ("system_username") REFERENCES "public"."unit_resident_account"("system_username") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_resident" ADD CONSTRAINT "unit_resident_unit_resident_priority_id_unit_resident_priority_id_fk" FOREIGN KEY ("unit_resident_priority_id") REFERENCES "public"."unit_resident_priority"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_resident" ADD CONSTRAINT "unit_resident_starting_balance_ledger_entry_id_ledger_entry_id_fk" FOREIGN KEY ("starting_balance_ledger_entry_id") REFERENCES "public"."ledger_entry"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_resident_account" ADD CONSTRAINT "unit_resident_account_system_username_access_account_username_fk" FOREIGN KEY ("system_username") REFERENCES "public"."access_account"("username") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_resident_account" ADD CONSTRAINT "unit_resident_account_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_resident_priority" ADD CONSTRAINT "unit_resident_priority_country_iso3166_1_a2_country_iso3166_1_alpha2_fk" FOREIGN KEY ("country_iso3166_1_a2") REFERENCES "public"."country"("iso3166_1_alpha2") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_resident_role" ADD CONSTRAINT "unit_resident_role_country_iso3166_1_a2_country_iso3166_1_alpha2_fk" FOREIGN KEY ("country_iso3166_1_a2") REFERENCES "public"."country"("iso3166_1_alpha2") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_resident_role" ADD CONSTRAINT "unit_resident_role_unit_ownership_scenario_id_unit_ownership_scenario_id_fk" FOREIGN KEY ("unit_ownership_scenario_id") REFERENCES "public"."unit_ownership_scenario"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_resident_role" ADD CONSTRAINT "unit_resident_role_unit_resident_priority_id_unit_resident_priority_id_fk" FOREIGN KEY ("unit_resident_priority_id") REFERENCES "public"."unit_resident_priority"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_resident_role_i18n" ADD CONSTRAINT "unit_resident_role_i18n_unit_resident_role_id_unit_resident_role_id_fk" FOREIGN KEY ("unit_resident_role_id") REFERENCES "public"."unit_resident_role"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_resident_role_i18n" ADD CONSTRAINT "unit_resident_role_i18n_locale_code_locale_code_fk" FOREIGN KEY ("locale_code") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_type" ADD CONSTRAINT "unit_type_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_type_i18n" ADD CONSTRAINT "unit_type_i18n_unit_type_id_unit_type_id_fk" FOREIGN KEY ("unit_type_id") REFERENCES "public"."unit_type"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_type_i18n" ADD CONSTRAINT "unit_type_i18n_locale_code_locale_code_fk" FOREIGN KEY ("locale_code") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_type_i18n" ADD CONSTRAINT "unit_type_i18n_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consumption_meter" ADD CONSTRAINT "consumption_meter_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expense_la2_role" ADD CONSTRAINT "expense_la2_role_expense_la2_table_id_expense_la2_table_id_fk" FOREIGN KEY ("expense_la2_table_id") REFERENCES "public"."expense_la2_table"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expense_la2_role" ADD CONSTRAINT "expense_la2_role_unit_resident_priority_id_unit_resident_priority_id_fk" FOREIGN KEY ("unit_resident_priority_id") REFERENCES "public"."unit_resident_priority"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expense_la2_role" ADD CONSTRAINT "expense_la2_role_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expense_la2_table" ADD CONSTRAINT "expense_la2_table_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expense_la2_table" ADD CONSTRAINT "expense_la2_table_expense_ledger_account_id_expense_ledger_account_ledger_account_id_fk" FOREIGN KEY ("expense_ledger_account_id") REFERENCES "public"."expense_ledger_account"("ledger_account_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expense_la2_table" ADD CONSTRAINT "expense_la2_table_distribution_table_id_distribution_table_id_fk" FOREIGN KEY ("distribution_table_id") REFERENCES "public"."distribution_table"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expense_la_unit_exception" ADD CONSTRAINT "expense_la_unit_exception_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expense_la_unit_exception" ADD CONSTRAINT "expense_la_unit_exception_expense_ledger_account_id_expense_ledger_account_ledger_account_id_fk" FOREIGN KEY ("expense_ledger_account_id") REFERENCES "public"."expense_ledger_account"("ledger_account_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expense_la_unit_exception" ADD CONSTRAINT "expense_la_unit_exception_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expense_la_unit_exception" ADD CONSTRAINT "expense_la_unit_exception_expense_la2_table_id_expense_la2_table_id_fk" FOREIGN KEY ("expense_la2_table_id") REFERENCES "public"."expense_la2_table"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expense_la_unit_exception_item" ADD CONSTRAINT "expense_la_unit_exception_item_expense_la_unit_exception_id_expense_la_unit_exception_id_fk" FOREIGN KEY ("expense_la_unit_exception_id") REFERENCES "public"."expense_la_unit_exception"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expense_la_unit_exception_item" ADD CONSTRAINT "expense_la_unit_exception_item_unit_resident_priority_id_unit_resident_priority_id_fk" FOREIGN KEY ("unit_resident_priority_id") REFERENCES "public"."unit_resident_priority"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expense_la_unit_exception_item" ADD CONSTRAINT "expense_la_unit_exception_item_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expense_ledger_account" ADD CONSTRAINT "expense_ledger_account_ledger_account_id_ledger_account_id_fk" FOREIGN KEY ("ledger_account_id") REFERENCES "public"."ledger_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expense_ledger_account" ADD CONSTRAINT "expense_ledger_account_restriction_unit_group_id_unit_group_id_fk" FOREIGN KEY ("restriction_unit_group_id") REFERENCES "public"."unit_group"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expense_ledger_account" ADD CONSTRAINT "expense_ledger_account_tax_relief_id_tax_relief_id_fk" FOREIGN KEY ("tax_relief_id") REFERENCES "public"."tax_relief"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "f24" ADD CONSTRAINT "f24_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "f24" ADD CONSTRAINT "f24_condominium_id_condominium_id_fk" FOREIGN KEY ("condominium_id") REFERENCES "public"."condominium"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_account" ADD CONSTRAINT "ledger_account_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_account" ADD CONSTRAINT "ledger_account_accounting_period_id_accounting_period_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_period"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_account" ADD CONSTRAINT "ledger_account_parent_ledger_account_id_ledger_account_id_fk" FOREIGN KEY ("parent_ledger_account_id") REFERENCES "public"."ledger_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_account" ADD CONSTRAINT "ledger_account_default_counter_account_id_ledger_account_id_fk" FOREIGN KEY ("default_counter_account_id") REFERENCES "public"."ledger_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_account" ADD CONSTRAINT "ledger_account_default_counter_account_master_data_id_master_data_id_fk" FOREIGN KEY ("default_counter_account_master_data_id") REFERENCES "public"."master_data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_account_i18n" ADD CONSTRAINT "ledger_account_i18n_ledger_account_id_ledger_account_id_fk" FOREIGN KEY ("ledger_account_id") REFERENCES "public"."ledger_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_account_i18n" ADD CONSTRAINT "ledger_account_i18n_locale_code_locale_code_fk" FOREIGN KEY ("locale_code") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_account_i18n" ADD CONSTRAINT "ledger_account_i18n_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_ledger_transaction_id_ledger_transaction_id_fk" FOREIGN KEY ("ledger_transaction_id") REFERENCES "public"."ledger_transaction"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_posting_account_id_ledger_account_id_fk" FOREIGN KEY ("posting_account_id") REFERENCES "public"."ledger_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_master_data_id_master_data_id_fk" FOREIGN KEY ("master_data_id") REFERENCES "public"."master_data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_unit_resident_id_unit_resident_id_fk" FOREIGN KEY ("unit_resident_id") REFERENCES "public"."unit_resident"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_installment_item_id_installment_item_id_fk" FOREIGN KEY ("installment_item_id") REFERENCES "public"."installment_item"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_ledger_invoice_id_ledger_invoice_id_fk" FOREIGN KEY ("ledger_invoice_id") REFERENCES "public"."ledger_invoice"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entry_2_ur_distribution" ADD CONSTRAINT "ledger_entry_2_ur_distribution_ledger_entry_id_ledger_entry_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."ledger_entry"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entry_2_ur_distribution" ADD CONSTRAINT "ledger_entry_2_ur_distribution_unit_resident_id_unit_resident_id_fk" FOREIGN KEY ("unit_resident_id") REFERENCES "public"."unit_resident"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entry_2_ur_distribution" ADD CONSTRAINT "ledger_entry_2_ur_distribution_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_invoice" ADD CONSTRAINT "ledger_invoice_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_invoice" ADD CONSTRAINT "ledger_invoice_accounting_period_id_accounting_period_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_period"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_invoice" ADD CONSTRAINT "ledger_invoice_master_data_id_master_data_id_fk" FOREIGN KEY ("master_data_id") REFERENCES "public"."master_data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_invoice" ADD CONSTRAINT "ledger_invoice_withholding_tax_id_withholding_tax_id_fk" FOREIGN KEY ("withholding_tax_id") REFERENCES "public"."withholding_tax"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_invoice_2_f24" ADD CONSTRAINT "ledger_invoice_2_f24_f24_id_f24_id_fk" FOREIGN KEY ("f24_id") REFERENCES "public"."f24"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_invoice_2_f24" ADD CONSTRAINT "ledger_invoice_2_f24_ledger_invoice_id_ledger_invoice_id_fk" FOREIGN KEY ("ledger_invoice_id") REFERENCES "public"."ledger_invoice"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_invoice_2_f24" ADD CONSTRAINT "ledger_invoice_2_f24_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_invoice_2_f24" ADD CONSTRAINT "ledger_invoice_2_f24_ledger_entry_id_ledger_entry_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."ledger_entry"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_transaction" ADD CONSTRAINT "ledger_transaction_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_transaction" ADD CONSTRAINT "ledger_transaction_accounting_period_id_accounting_period_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_period"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_transaction" ADD CONSTRAINT "ledger_transaction_ledger_invoice_id_ledger_invoice_id_fk" FOREIGN KEY ("ledger_invoice_id") REFERENCES "public"."ledger_invoice"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tax_relief" ADD CONSTRAINT "tax_relief_country_iso3166_1_a2_country_iso3166_1_alpha2_fk" FOREIGN KEY ("country_iso3166_1_a2") REFERENCES "public"."country"("iso3166_1_alpha2") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tribute" ADD CONSTRAINT "tribute_country_iso3166_1_a2_country_iso3166_1_alpha2_fk" FOREIGN KEY ("country_iso3166_1_a2") REFERENCES "public"."country"("iso3166_1_alpha2") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "withholding_tax" ADD CONSTRAINT "withholding_tax_country_iso3166_1_a2_country_iso3166_1_alpha2_fk" FOREIGN KEY ("country_iso3166_1_a2") REFERENCES "public"."country"("iso3166_1_alpha2") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "withholding_tax_2_la" ADD CONSTRAINT "withholding_tax_2_la_withholding_tax_id_withholding_tax_id_fk" FOREIGN KEY ("withholding_tax_id") REFERENCES "public"."withholding_tax"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "withholding_tax_2_la" ADD CONSTRAINT "withholding_tax_2_la_ledger_account_id_ledger_account_id_fk" FOREIGN KEY ("ledger_account_id") REFERENCES "public"."ledger_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "withholding_tax_2_la" ADD CONSTRAINT "withholding_tax_2_la_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "withholding_tax_2_la" ADD CONSTRAINT "withholding_tax_2_la_accounting_period_id_accounting_period_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_period"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "distribution_table" ADD CONSTRAINT "distribution_table_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "distribution_table" ADD CONSTRAINT "distribution_table_accounting_period_id_accounting_period_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_period"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "distribution_table" ADD CONSTRAINT "distribution_table_restriction_unit_group_id_unit_group_id_fk" FOREIGN KEY ("restriction_unit_group_id") REFERENCES "public"."unit_group"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "distribution_table" ADD CONSTRAINT "distribution_table_consumption_meter_id_consumption_meter_id_fk" FOREIGN KEY ("consumption_meter_id") REFERENCES "public"."consumption_meter"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "distribution_table_item" ADD CONSTRAINT "distribution_table_item_distribution_table_id_distribution_table_id_fk" FOREIGN KEY ("distribution_table_id") REFERENCES "public"."distribution_table"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "distribution_table_item" ADD CONSTRAINT "distribution_table_item_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "distribution_table_item" ADD CONSTRAINT "distribution_table_item_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounting_period" ADD CONSTRAINT "accounting_period_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounting_period" ADD CONSTRAINT "accounting_period_condominium_id_condominium_id_fk" FOREIGN KEY ("condominium_id") REFERENCES "public"."condominium"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounting_period" ADD CONSTRAINT "accounting_period_supplier_accounts_payable_ledger_account_id_ledger_account_id_fk" FOREIGN KEY ("supplier_accounts_payable_ledger_account_id") REFERENCES "public"."ledger_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounting_period" ADD CONSTRAINT "accounting_period_flat_resident_accounts_receivable_ledger_account_id_ledger_account_id_fk" FOREIGN KEY ("flat_resident_accounts_receivable_ledger_account_id") REFERENCES "public"."ledger_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounting_period" ADD CONSTRAINT "accounting_period_flat_resident_rounding_off_ledger_account_id_ledger_account_id_fk" FOREIGN KEY ("flat_resident_rounding_off_ledger_account_id") REFERENCES "public"."ledger_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounting_period" ADD CONSTRAINT "accounting_period_individual_expenses_ledger_account_id_ledger_account_id_fk" FOREIGN KEY ("individual_expenses_ledger_account_id") REFERENCES "public"."ledger_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounting_period" ADD CONSTRAINT "accounting_period_default_checking_account_ledger_account_id_ledger_account_id_fk" FOREIGN KEY ("default_checking_account_ledger_account_id") REFERENCES "public"."ledger_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounting_period" ADD CONSTRAINT "accounting_period_payment_in_cash_ledger_account_id_ledger_account_id_fk" FOREIGN KEY ("payment_in_cash_ledger_account_id") REFERENCES "public"."ledger_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounting_period" ADD CONSTRAINT "accounting_period_withholding_tax_penalty_ledger_account_id_ledger_account_id_fk" FOREIGN KEY ("withholding_tax_penalty_ledger_account_id") REFERENCES "public"."ledger_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounting_period_installment_default_settings" ADD CONSTRAINT "accounting_period_installment_default_settings_accounting_period_id_accounting_period_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_period"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounting_period_installment_default_settings" ADD CONSTRAINT "accounting_period_installment_default_settings_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment" ADD CONSTRAINT "installment_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment" ADD CONSTRAINT "installment_accounting_period_id_accounting_period_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_period"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment" ADD CONSTRAINT "installment_installment_group_id_installment_group_id_fk" FOREIGN KEY ("installment_group_id") REFERENCES "public"."installment_group"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment_group" ADD CONSTRAINT "installment_group_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment_group" ADD CONSTRAINT "installment_group_accounting_period_id_accounting_period_id_fk" FOREIGN KEY ("accounting_period_id") REFERENCES "public"."accounting_period"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment_group_i18n" ADD CONSTRAINT "installment_group_i18n_installment_group_id_installment_group_id_fk" FOREIGN KEY ("installment_group_id") REFERENCES "public"."installment_group"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment_group_i18n" ADD CONSTRAINT "installment_group_i18n_locale_code_locale_code_fk" FOREIGN KEY ("locale_code") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment_group_i18n" ADD CONSTRAINT "installment_group_i18n_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment_i18n" ADD CONSTRAINT "installment_i18n_installment_id_installment_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installment"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment_i18n" ADD CONSTRAINT "installment_i18n_locale_code_locale_code_fk" FOREIGN KEY ("locale_code") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment_i18n" ADD CONSTRAINT "installment_i18n_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment_item" ADD CONSTRAINT "installment_item_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment_item" ADD CONSTRAINT "installment_item_installment_id_installment_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installment"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment_item" ADD CONSTRAINT "installment_item_unit_resident_id_unit_resident_id_fk" FOREIGN KEY ("unit_resident_id") REFERENCES "public"."unit_resident"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment_payment_slip" ADD CONSTRAINT "installment_payment_slip_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment_payment_slip" ADD CONSTRAINT "installment_payment_slip_master_data_id_master_data_id_fk" FOREIGN KEY ("master_data_id") REFERENCES "public"."master_data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment_payment_slip_item" ADD CONSTRAINT "installment_payment_slip_item_installment_payment_slip_id_installment_payment_slip_id_fk" FOREIGN KEY ("installment_payment_slip_id") REFERENCES "public"."installment_payment_slip"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment_payment_slip_item" ADD CONSTRAINT "installment_payment_slip_item_installment_item_id_installment_item_id_fk" FOREIGN KEY ("installment_item_id") REFERENCES "public"."installment_item"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installment_payment_slip_item" ADD CONSTRAINT "installment_payment_slip_item_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_layer_id_calendar_layer_id_fk" FOREIGN KEY ("layer_id") REFERENCES "public"."calendar_layer"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_layer" ADD CONSTRAINT "calendar_layer_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "grant" ADD CONSTRAINT "grant_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "grant_i18n" ADD CONSTRAINT "grant_i18n_grant_id_grant_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."grant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "grant_i18n" ADD CONSTRAINT "grant_i18n_locale_code_locale_code_fk" FOREIGN KEY ("locale_code") REFERENCES "public"."locale"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "grant_i18n" ADD CONSTRAINT "grant_i18n_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "license" ADD CONSTRAINT "license_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "property_manager" ADD CONSTRAINT "property_manager_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "property_manager" ADD CONSTRAINT "property_manager_master_data_id_master_data_id_fk" FOREIGN KEY ("master_data_id") REFERENCES "public"."master_data"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "property_managers_association" ADD CONSTRAINT "property_managers_association_country_iso3166_1_a2_country_iso3166_1_alpha2_fk" FOREIGN KEY ("country_iso3166_1_a2") REFERENCES "public"."country"("iso3166_1_alpha2") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "property_managers_association_code" ADD CONSTRAINT "property_managers_association_code_property_manager_id_property_manager_id_fk" FOREIGN KEY ("property_manager_id") REFERENCES "public"."property_manager"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "property_managers_association_code" ADD CONSTRAINT "property_managers_association_code_property_managers_association_id_property_managers_association_id_fk" FOREIGN KEY ("property_managers_association_id") REFERENCES "public"."property_managers_association"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket" ADD CONSTRAINT "ticket_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket" ADD CONSTRAINT "ticket_ticket_topic_id_ticket_topic_id_fk" FOREIGN KEY ("ticket_topic_id") REFERENCES "public"."ticket_topic"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket" ADD CONSTRAINT "ticket_opened_by_username_access_account_username_fk" FOREIGN KEY ("opened_by_username") REFERENCES "public"."access_account"("username") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_message" ADD CONSTRAINT "ticket_message_ticket_id_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."ticket"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_message" ADD CONSTRAINT "ticket_message_author_username_access_account_username_fk" FOREIGN KEY ("author_username") REFERENCES "public"."access_account"("username") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_topic" ADD CONSTRAINT "ticket_topic_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
