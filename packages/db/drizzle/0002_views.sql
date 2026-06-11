-- Custom SQL migration file, put your code below! --
-- The 6 legacy reporting views, recreated as plain Postgres views. Source of
-- truth is src/sql/views.sql; these statements are kept in sync with it. One
-- CREATE VIEW per statement-breakpoint so drizzle-kit runs them individually.
CREATE VIEW company_variation_view AS
SELECT
  mdv.id AS id,
  mdv.studio_id AS studio_id,
  cv.master_data_variation_id AS master_data_variation_id,
  mdv.master_data_id AS master_data_id,
  mdv.valid_from_date AS valid_from_date,
  mdv.valid_to_date AS valid_to_date,
  cv.name AS name,
  cv.registered_office_address AS registered_office_address,
  cv.tax_purpose_address AS tax_purpose_address,
  mdv.tax_code AS tax_code,
  mdv.vat_number AS vat_number,
  mdv.postal_address AS postal_address,
  mdv.qualification_id AS qualification_id,
  mdv.bank_account_id AS bank_account_id,
  mdv.variation_notes AS variation_notes,
  cv.created AS created,
  mdv.created_master_data_id AS created_master_data_id,
  cv.updated AS updated,
  mdv.last_modified_master_data_id AS last_modified_master_data_id
FROM master_data_variation mdv
JOIN company_variation cv ON mdv.id = cv.master_data_variation_id;
--> statement-breakpoint
CREATE VIEW company_view AS
SELECT
  md.id AS id,
  md.studio_id AS studio_id,
  c.master_data_id AS master_data_id,
  md.valid_from_date AS valid_from_date,
  md.code AS code,
  md.status AS status,
  c.name AS name,
  c.registered_office_address AS registered_office_address,
  c.tax_purpose_address AS tax_purpose_address,
  md.tax_code AS tax_code,
  md.vat_number AS vat_number,
  md.master_data_category_id AS master_data_category_id,
  md.postal_address AS postal_address,
  md.preferred_locale_code AS preferred_locale_code,
  md.qualification_id AS qualification_id,
  md.bank_account_id AS bank_account_id,
  md.notes AS notes,
  md.variation_notes AS variation_notes,
  c.created AS created,
  md.created_master_data_id AS created_master_data_id,
  c.updated AS updated,
  md.last_modified_master_data_id AS last_modified_master_data_id
FROM master_data md
JOIN company c ON md.id = c.master_data_id;
--> statement-breakpoint
CREATE VIEW condominium_calendar_event_view AS
SELECT
  ce.id AS id,
  ce.studio_id AS studio_id,
  ce.layer_id AS layer_id,
  ce.date AS date,
  ce.ignore_time AS ignore_time,
  ce.description AS description,
  ce.priority AS priority,
  ce.status AS status,
  ce.data AS data,
  ce.data_type AS data_type,
  ce.data_key AS data_key,
  ce.notes AS notes,
  ce.created AS created,
  ce.updated AS updated,
  cce.calendar_event_id AS calendar_event_id,
  cce.condominium_id AS condominium_id,
  cce.accounting_period_id AS accounting_period_id,
  cce.unit_group_id AS unit_group_id,
  cce.unit_id AS unit_id,
  cce.unit_resident_id AS unit_resident_id,
  cce.master_data_id AS master_data_id,
  cce.show_on_frontend AS show_on_frontend,
  cce.show_from AS show_from,
  cce.show_to AS show_to,
  cce.show_date AS show_date
FROM calendar_event ce
JOIN condominium_calendar_event cce ON ce.id = cce.calendar_event_id;
--> statement-breakpoint
CREATE VIEW expense_ledger_account_view AS
SELECT
  la.id AS id,
  la.studio_id AS studio_id,
  ela.ledger_account_id AS ledger_account_id,
  la.accounting_period_id AS accounting_period_id,
  la.name AS name,
  la.abbreviation AS abbreviation,
  la.description AS description,
  la.type AS type,
  la."order" AS "order",
  la.parent_ledger_account_id AS parent_ledger_account_id,
  la.default_counter_account_id AS default_counter_account_id,
  la.default_counter_account_master_data_id AS default_counter_account_master_data_id,
  la.kind AS kind,
  la.period_restriction_start_date AS period_restriction_start_date,
  la.period_restriction_end_date AS period_restriction_end_date,
  la.notes AS notes,
  ela.restriction_unit_group_id AS restriction_unit_group_id,
  ela.estimate AS estimate,
  ela.use_distinct_tables_for_estimate AS use_distinct_tables_for_estimate,
  ela.cost_attribution_on_handover AS cost_attribution_on_handover,
  ela.next_period_estimate_based_on AS next_period_estimate_based_on,
  ela.next_period_estimate_increase_percentage AS next_period_estimate_increase_percentage,
  ela.next_period_estimate_increase_fixed_amount AS next_period_estimate_increase_fixed_amount,
  ela.tax_relief_id AS tax_relief_id,
  ela.created AS created,
  ela.updated AS updated
FROM expense_ledger_account ela
JOIN ledger_account la ON la.id = ela.ledger_account_id;
--> statement-breakpoint
CREATE VIEW person_variation_view AS
SELECT
  mdv.id AS id,
  mdv.studio_id AS studio_id,
  pv.master_data_variation_id AS master_data_variation_id,
  mdv.master_data_id AS master_data_id,
  mdv.valid_from_date AS valid_from_date,
  mdv.valid_to_date AS valid_to_date,
  pv.first_name AS first_name,
  pv.middle_name AS middle_name,
  pv.last_name AS last_name,
  pv.citizenship_iso3166_1_a2 AS citizenship_iso3166_1_a2,
  pv.office_address AS office_address,
  pv.permanent_address AS permanent_address,
  pv.current_address AS current_address,
  pv.occupation AS occupation,
  mdv.tax_code AS tax_code,
  mdv.vat_number AS vat_number,
  mdv.postal_address AS postal_address,
  mdv.qualification_id AS qualification_id,
  mdv.bank_account_id AS bank_account_id,
  mdv.variation_notes AS variation_notes,
  pv.created AS created,
  mdv.created_master_data_id AS created_master_data_id,
  pv.updated AS updated,
  mdv.last_modified_master_data_id AS last_modified_master_data_id
FROM master_data_variation mdv
JOIN person_variation pv ON mdv.id = pv.master_data_variation_id;
--> statement-breakpoint
CREATE VIEW person_view AS
SELECT
  md.id AS id,
  md.studio_id AS studio_id,
  p.master_data_id AS master_data_id,
  md.valid_from_date AS valid_from_date,
  md.code AS code,
  md.status AS status,
  p.first_name AS first_name,
  p.middle_name AS middle_name,
  p.last_name AS last_name,
  p.sex AS sex,
  p.birth_date AS birth_date,
  p.birth_place AS birth_place,
  p.citizenship_iso3166_1_a2 AS citizenship_iso3166_1_a2,
  p.office_address AS office_address,
  p.permanent_address AS permanent_address,
  p.current_address AS current_address,
  p.occupation AS occupation,
  md.tax_code AS tax_code,
  md.vat_number AS vat_number,
  md.master_data_category_id AS master_data_category_id,
  md.postal_address AS postal_address,
  md.preferred_locale_code AS preferred_locale_code,
  md.qualification_id AS qualification_id,
  md.bank_account_id AS bank_account_id,
  md.notes AS notes,
  md.variation_notes AS variation_notes,
  p.created AS created,
  md.created_master_data_id AS created_master_data_id,
  p.updated AS updated,
  md.last_modified_master_data_id AS last_modified_master_data_id
FROM master_data md
JOIN person p ON md.id = p.master_data_id;
