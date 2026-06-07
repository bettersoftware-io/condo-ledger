# DB Migration (Module 0) — Design / Spec

> **Status:** Design / spec. Derived from [`2026-06-07-migration-overview-design.md`](./2026-06-07-migration-overview-design.md) §8 and §9 (module 0).
> **Date:** 2026-06-07
> **Scope of this document:** Module 0 of the migration — converting the legacy MySQL database
> (`it-jtime-condominium`) to PostgreSQL: schema, named types, identity, triggers, views, and the
> sample data needed to characterize the accounting engine later. This is the first build in the
> sequence (overview §9) and unblocks the real backend.

---

## 1. Goal & boundary

### 1.1 Goal
Produce a migrated **PostgreSQL** database — schema + functions-as-views + data — that is a faithful,
Postgres-idiomatic recreation of the legacy MySQL schema, plus the **tooling** to rebuild it
deterministically from the legacy dumps in `old/db/`, plus **structural verification** that the
migration is complete and consistent.

### 1.2 In scope
- A Drizzle (TypeScript) schema that **is the source of truth** for the target structure.
- drizzle-kit-generated SQL migrations: tables, named enum types, the shared `set_timestamps()`
  trigger, the 6 recreated views, FKs, identity columns, sequences.
- A Node **ETL** (extract/transform/load) that reads the legacy MySQL dumps, transforms values, and
  loads them into Postgres in FK order, then resyncs sequences.
- The `camelCase ↔ snake_case` boundary mapper (so the later API/app speaks camelCase while the DB is
  idiomatic snake_case).
- Structural verification tests (row counts, FK integrity, enum domains, schema round-trip).
- Local-dev Postgres via Docker Compose.

### 1.3 Explicitly OUT of scope for Module 0
- **No backend.** No Fastify/tRPC, no HTTP, no repositories, no auth, no tenant guard. Those are
  Module 1 / the backend spec. Module 0 ends at "a correct Postgres database + the tooling to rebuild
  it."
- **No accounting characterization.** The "reproduce legacy numbers to the cent" suite (overview §7)
  belongs to **Module 4** (the allocation engine), which *consumes* this database. Module 0 only
  guarantees the data is present and internally consistent so Module 4 has trustworthy ground truth.
- **No app-facing ORM models** beyond the schema itself. Mapping rows to domain types is later work.
- The framework-leftover tables (tickets, invoices/products/PO/RFQ/delivery, shopping cart) are
  migrated **structurally** (they exist in the schema) but are **not** required to carry data.

### 1.4 Success criteria
- `pnpm --filter @cl/db migrate` builds the full schema on an empty Postgres 16 with no errors.
- `pnpm --filter @cl/db seed` loads the three data tiers (§4) with **per-table row-count diff = 0**
  for every loaded table.
- All **249 FKs** validate after load (zero orphan rows).
- Every enum column rejects out-of-domain values; every identity sequence is resynced so a fresh
  insert succeeds.
- `drizzle-kit` reports **no drift** between the Drizzle schema and the migrated database.

---

## 2. Source material (verified, in `old/db/`)

The legacy structure was profiled directly from `it-jtime-condominium.structure.sql` (the numbers
below are measured, not estimated):

| Aspect | Count | Migration consequence |
|---|---:|---|
| `CREATE TABLE` | 95 | All recreated in Drizzle. |
| `CREATE VIEW` | 6 | Recreated as plain Postgres views (§3.5). |
| `CREATE FUNCTION` | 3 | **Not** ported to DB — moved to TS (§3.5). |
| Triggers | 188 | Collapsed to one shared `set_timestamps()` (§3.4). |
| `enum(...)` columns | 29 columns, 23 distinct value-sets | Each distinct set → a named Postgres enum type (§3.2). |
| `tinyint(1)` columns | 24 | → `boolean` (§3.2). Includes reserved-word column `default`. |
| `unsigned` int columns | 320 | → `integer`/`bigint` + `CHECK (>= 0)` where meaningful. |
| `decimal(...)` columns | 22 | → `numeric` (money: `numeric(12,2)`). |
| `datetime` columns | 190 | → `timestamptz`. |
| `AUTO_INCREMENT` tables | 90 | → `GENERATED ALWAYS AS IDENTITY` + sequence resync. |
| `FOREIGN KEY` constraints | 249 | Recreated; validated post-load. |

**Authoritative source files:**
- Structure DDL: `old/db/it-jtime-condominium.structure.sql`
- Operational data per condominium (19 tables each, **no** reference/master data):
  `old/db/it-jtime-condominium-saturno-only.data.sql`,
  `old/db/it-jtime-condominium-pozzetto-only.data.sql`
- Full single-studio dump (source of master data / anagrafiche): `old/db/it-jtime-condominium.data.sql`
- Reference data: `old/db/it-jtime-condominium - data - country, locale, localeI18n.sql`,
  `old/db/countryI18n.sql`, `old/db/localeI18n.sql`, `old/db/bank.sql`, `old/db/bankBranch.sql` (44M —
  full Italian registry; load only the FK-closure, §4 Tier A)
- Ground-truth report PDFs (used by **Module 4**, not here): `old/db/it-jtime-condominium.*.pdf`

**Key discovery driving the ETL design (§4):** the `*-only` dumps contain **only the 19 operational
tables** (condominium, unit, unit_group, unit_period, unit_resident, distribution_table(+item),
expense_ledger_account(+2role/+2table), ledger_account, ledger_transaction, ledger_entry,
ledger_invoice, installment(+item), accounting_period(+installment_default_settings),
condominium_supplier). They carry **no** geo/bank/locale reference data and **no** masterData/person/
company. The production DB has exactly **one studio**, so that studio's master data = effectively the
whole masterData/person/company content of the full dump.

---

## 3. Schema transform rules

All transforms are **deterministic and mechanical** — given the legacy DDL, the target schema is a
pure function of it. This is what makes the layer regenerable (overview §3.1).

### 3.1 Identifiers — snake_case rename
- Every table and column: camelCase → snake_case (`studioId` → `studio_id`; `unitResident` →
  `unit_resident`; `ledgerTransaction` → `ledger_transaction`). No identifier is ever quoted in SQL
  or Drizzle.
- The reserved-word column **`default`** (`tinyint(1) unsigned NOT NULL DEFAULT 0`, structure.sql:1936)
  → **`is_default boolean NOT NULL DEFAULT false`**.
- `src/naming.ts` exposes the **deterministic inverse map** (`toCamel`/`toSnake`) so the future API
  layer presents camelCase while the DB stays snake_case. The map is total and table-aware (handles
  acronym edge cases like `i18n`, `f24`, `po` explicitly so the round-trip is lossless).

### 3.2 Types
| Legacy MySQL | Postgres | Notes |
|---|---|---|
| `tinyint(1)` | `boolean` | `0/1` → `false/true`. The `default` column is renamed (§3.1). |
| `int unsigned` / `bigint unsigned` | `integer` / `bigint` | Add `CHECK (col >= 0)` where the unsigned-ness is semantically meaningful (ids, counts, money-cents-like). Pure surrogate keys covered by identity need no extra check. |
| `datetime` | `timestamptz` | Legacy stored naive local time; interpret as the app's single timezone (Europe/Rome) at load. |
| `decimal(10,2)` (money) | `numeric(12,2)` | Wider integral room; scale preserved. Domain code still uses the integer-cents `Money` type (overview §5.4). |
| `enum(...)` | named enum type | See below. |
| `varchar`/`text`/`char` | `varchar`/`text` | Lengths preserved. |

**Enums:** there are **23 distinct** value-sets across the 29 enum columns. Each distinct set becomes
its own named Postgres enum type (e.g. `ledger_account_type AS ENUM ('regular','grouping','control',
'controlUnitResident')`, `distribution_type AS ENUM ('estimate','currentBalance')`). Distinct sets get
distinct types **even when values overlap** — e.g. `('issued','settled','neutralized')` and
`('issued','incomplete','settled','neutralized')` are two separate types. Enum **values stay
camelCase** (they are domain tokens the app matches on, not SQL identifiers).

### 3.3 Identity & sequences
- `AUTO_INCREMENT` primary keys → `GENERATED ALWAYS AS IDENTITY`.
- Because the ETL inserts explicit legacy ids (to preserve FK relationships), load uses
  `OVERRIDING SYSTEM VALUE`, and a **post-load step resyncs every identity sequence** to
  `setval(pg_get_serial_sequence(...), max(id))` so subsequent inserts don't collide.

### 3.4 Triggers — collapse 188 → 1
The 188 legacy triggers are timestamp boilerplate. Replace with **one** shared PLpgSQL function
`set_timestamps()` attached as a `BEFORE INSERT OR UPDATE` trigger on each table that has the
`created`/`updated` convention, preserving legacy semantics:
- `created`: set to `now()` **only if null** on insert; never changed on update (`COALESCE`).
- `updated`: bumped to `now()` on update **unless** the row explicitly set it (`CASE WHEN NEW.updated
  IS DISTINCT FROM OLD.updated THEN NEW.updated ELSE now() END`).
- The `ledger_transaction` variant additionally defaults its `timestamp` column when null.

A small table-config drives which trigger variant attaches where (regular vs the ledger_transaction
variant), so the migration stays declarative.

### 3.5 Functions & views
- **Functions → TS, not DB.** `getNominative`, `getMasterDataNominative`, `getCountryTranslation` are
  display-name/translation resolvers used app-wide. They are **business/display logic**, so per the
  dependency rule (overview §3) they move into pure TS (`@cl/domain` for the name-composition rules,
  `@cl/application` if they need a port for locale lookup) where they are unit-testable and
  DB-independent. They are **not** recreated in PLpgSQL. (Module 0 ports the *logic spec* as test
  fixtures; the actual TS home is finalized when Anagrafiche / display code is built — Module 2. Module
  0's job is only to ensure the underlying columns/tables exist.)
- **Views → plain Postgres views.** The 6 subtype/variation views are recreated as ordinary views,
  dropping MySQL `DEFINER` / `ALGORITHM` / `SQL SECURITY DEFINER` clauses. They are read models, not
  logic, so they stay in the DB.
- **Dropped:** `codeIgniterSession` (legacy PHP session store — irrelevant to the new stack).

---

## 4. Data ETL — the three tiers

"Saturno + Pozzetto only" (the approved data scope) resolves, given the `-only` dumps' contents, to
**three tiers loaded in FK order**:

### Tier A — global reference data (FK-closure only)
Tenant-independent lookups: `country`, `locale`, `locale_i18n`, `country_i18n`, `state`, `state_i18n`,
`city`, `city_i18n`, `post_code`, `city_post_code`, `bank`, and **only the `bank_branch` rows
referenced** by the two condominiums' bank accounts (the full `bankBranch.sql` is 44M — the entire
Italian registry — and must **not** be bulk-loaded). Sources: the dedicated reference dumps
(`… country, locale, localeI18n.sql`, `countryI18n.sql`, `localeI18n.sql`, `bank.sql`) +
FK-filtered extraction from `bankBranch.sql`.

### Tier B — the studio's master data (anagrafiche)
The single studio plus all master data the operational rows depend on: `studio`, `master_data`,
`person`, `company`, `person_variation`, `company_variation`, `master_data_variation`,
`master_data_category` (+i18n), `master_data_contact` (+i18n), `master_data_cross_relation` (+i18n),
`master_data_tax_treatment`, `property_manager`, `qualification`, `access_account` (+grant/+activation),
etc. Source: `it-jtime-condominium.data.sql` (one studio ⇒ load its master-data tables whole).

### Tier C — operational condominium data
The two condominiums' 19 operational tables, from `it-jtime-condominium-saturno-only.data.sql` and
`it-jtime-condominium-pozzetto-only.data.sql`.

### ETL mechanics
1. **Parse** (`etl/parse.ts`): a tolerant reader for MySQL extended multi-row `INSERT` statements →
   `{ table, columns, rows }`. Handles escaped strings, `NULL`, and backtick-quoted identifiers.
2. **Transform** (`etl/transform.ts`): per-column value transforms matching §3.2 — `0/1`→bool for
   `tinyint(1)` columns, `datetime` string → ISO `timestamptz` (Europe/Rome), enum passthrough,
   numeric passthrough. Column names mapped camelCase→snake_case via `naming.ts`.
3. **Load** (`etl/load.ts`): insert in a fixed **FK-respecting table order** (Tier A → B → C; within a
   tier, parents before children), using `OVERRIDING SYSTEM VALUE` to keep legacy ids, inside one
   transaction per tier. Then **resync sequences** (§3.3).
4. **Idempotent**: `seed` truncates (or recreates) before loading so it can be re-run.

---

## 5. Verification (Module 0's bar — structural)

`packages/db/test/` runs against a freshly migrated + seeded Postgres:
- **Row-count parity:** for each loaded table, count in Postgres == count parsed from the source dump.
  Diff must be 0. (Reference tables assert the FK-closure count, not the full-registry count.)
- **FK integrity:** programmatically verify all 249 FKs resolve — no orphan child rows. (A query that,
  for each FK, left-joins child→parent and asserts zero unmatched.)
- **Enum domains:** attempting to insert an out-of-domain enum value fails.
- **Sequence health:** after load, an insert with a server-generated id succeeds on every identity
  table (proves resync).
- **Schema round-trip:** `drizzle-kit` (introspect/diff) reports no drift between the Drizzle schema
  and the migrated DB.

Explicitly **not** here (deferred to Module 4): riparto/bilancio/installment numbers vs the legacy
PDFs.

---

## 6. Package layout & local dev

```
packages/db/
  package.json           name @cl/db; scripts: migrate, seed, test, db:up, db:down
  docker-compose.yml     postgres:16; volume; exposes 5432
  drizzle.config.ts      drizzle-kit config (schema dir, out dir, dialect postgresql)
  src/
    schema/              Drizzle schema split by area: reference.ts, masterData.ts,
                         condominium.ts, accounting.ts, distribution.ts, installment.ts, misc.ts
    enums.ts             the named pg enum types
    naming.ts            camelCase↔snake_case mapper (+ tests)
    views.sql            the 6 recreated views (applied by a migration)
    triggers.sql         set_timestamps() + attach config (applied by a migration)
  drizzle/               generated migrations
  etl/
    parse.ts  transform.ts  load.ts  order.ts (FK load order)  index.ts (the `seed` entry)
  test/
    rowCounts.test.ts  fkIntegrity.test.ts  enums.test.ts  sequences.test.ts
    schemaDrift.test.ts  naming.test.ts
```

Local flow: `pnpm --filter @cl/db db:up` → `… migrate` → `… seed` → `… test`. CI later runs the same
sequence against an ephemeral Postgres.

---

## 7. Risks & open questions

- **`bank_branch` FK-closure (top risk).** Extracting only the referenced branches from the 44M
  registry requires resolving which branch ids the condominiums' bank accounts point to. If clean
  closure proves awkward, the fallback is a one-time full `bank` + referenced-`bank_branch` load (still
  avoiding the full 44M branch set) or, last resort, the full registry load (slow but correct). The
  plan should spike this extraction first.
- **`datetime` → `timestamptz` timezone.** Legacy naive datetimes are interpreted as Europe/Rome.
  Confirm no column stores already-UTC values (none expected for this single-region app).
- **`unsigned` `CHECK` selectivity.** Adding `CHECK (>= 0)` to all 320 unsigned columns is noisy;
  apply it only where the constraint is semantically meaningful. The plan enumerates the include-list.
- **Master-data table closure (Tier B).** The exact set of anagrafiche tables the operational rows FK
  into should be confirmed by walking the FKs from the 19 operational tables; the list in §4 Tier B is
  the expected closure and the plan verifies it.
- **`naming.ts` acronym edge cases.** `i18n`, `f24`, `po`, `URDistribution` (`ledgerEntry2URDistribution`)
  need explicit mapping rules so the round-trip is lossless; covered by `naming.test.ts`.
