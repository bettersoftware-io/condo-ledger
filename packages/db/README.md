# `@cl/db` — Legacy MySQL → PostgreSQL 16 migration (Module 0)

This package migrates the legacy **`it-jtime-condominium`** MySQL database to
**PostgreSQL 16**. It is **Module 0** of the larger condo-ledger project: a
structural migration only — it stands up the schema and loads the two sample
condominiums, with no backend, no auth, and no behavioral logic (those come in
later modules).

How it fits together:

- A **hand-authored Drizzle schema** in `src/schema/` (snake_case) is the
  **single source of truth** for the target shape. We do not reverse-engineer the
  schema from the dumps.
- **`drizzle-kit generate`** turns that schema into SQL migrations in `drizzle/`;
  **`drizzle-kit migrate`** applies them to an empty database.
- A small **Node ETL** (`etl/`) parses the legacy `mysqldump` files in `old/db/`
  and loads the two sample condominiums — **Saturno** and **Pozzetto**.

---

## Prerequisites & setup

- **PostgreSQL 16.** Either start the bundled one with `pnpm db:up` (see the
  shipped `docker-compose.yml` → `postgres:16` on `localhost:5432`), or point at
  an existing Postgres.
- **`.env`** with `DATABASE_URL`. Copy the example and adjust:

  ```sh
  cp .env.example .env
  ```

  `.env.example` uses the host-local value
  `postgres://condo:condo@localhost:5432/condo`. The Docker container in this
  repo's sandbox is a **sibling container**, so there the value is
  `postgres://condo:condo@condo-postgres:5432/condo` instead — same credentials,
  different host. `.env` / `.env.*` are gitignored; never commit them.

---

## Commands

| Script          | What it does                                                            |
| --------------- | ----------------------------------------------------------------------- |
| `pnpm db:up`    | Start the bundled Postgres 16 via Docker Compose.                       |
| `pnpm migrate`  | Apply the generated migrations to the DB (`drizzle-kit migrate`).       |
| `pnpm seed`     | Run the ETL: parse the legacy dumps and load tiers A → B → C.           |
| `pnpm generate` | Regenerate migrations from the authored schema (`drizzle-kit generate`).|
| `pnpm reset`    | Drop `public` + `drizzle` schemas and recreate an empty `public`.       |
| `pnpm rebuild`  | One-shot: `reset && migrate && seed`. **Assumes the DB is already up.** |
| `pnpm test`     | Run the Vitest suite (unit + DB integration).                          |
| `pnpm typecheck`| `tsc --noEmit`.                                                         |

### Typical flow

```sh
pnpm db:up          # start Postgres (host only; skip if you already have one)
pnpm rebuild        # reset → migrate → seed, end to end
pnpm test           # verify the migrated + seeded DB
```

`rebuild` deliberately **does not touch Docker** — it resets via `DATABASE_URL`
and assumes Postgres is already running (`pnpm db:up` on a host, or the sibling
container in the sandbox). The reset drops **both** the `public` schema and the
`drizzle` schema: drizzle keeps its migration journal in the `drizzle` schema, and
leaving it behind would make `migrate` believe everything is already applied and
skip rebuilding the tables.

---

## The three data tiers

The ETL loads in dependency order across three tiers:

- **Tier A — reference data:** `country`, `locale`, `localeI18n`. Loaded from the
  locale/country reference dump.
- **Tier B — master-data parents:** the shared parent rows (studios, people,
  companies, master-data categories, qualifications, unit types, withholding
  taxes, `bankAccount`, etc.), read from the full 46 MB dump.
- **Tier C — operational data:** the **21 tables** of the two condominiums
  (Saturno + Pozzetto), derived **dynamically** from the per-condominium
  `*-only` dumps — the tier membership is whatever those dumps contain, never
  hardcoded.

---

## What the verification proves

The integration suite (Tasks 10/11/17) asserts the migration is faithful, not
merely that it ran:

- **`migrate` builds on an empty DB** (Task 10): produces **94 base tables, 23
  enums, 6 views**, and a `set_timestamps` trigger on every base table.
- **Schema-drift-free:** `drizzle-kit check` reports no pending changes between
  the authored schema and the migrated DB.
- **Row-count parity:** every operational table holds exactly the rows the two
  per-condominium dumps contain — no drops, no dupes (diff = 0).
- **FK integrity:** all **247 foreign keys** validate with **0 orphan rows**
  (re-checked after the load, since the load itself runs with FK triggers off).
- **Enum domains enforced:** out-of-domain enum values are rejected at write time
  (real Postgres enums, not free-text columns).
- **Identity sequences resynced:** after loading legacy rows with their original
  ids, each table's id sequence is advanced past the highest loaded id, so the
  next insert doesn't collide.

Reproduce it all with `pnpm rebuild && pnpm test`.

---

## Key design notes

### snake_case ↔ camelCase mapping (`src/naming.ts`)

The legacy schema is camelCase; the target is snake_case. `naming.ts` does a
lossless, bidirectional mapping, with explicit handling for irregular tokens —
acronyms (`LA` = Ledger Account, `UR`, `PO`, `I18n`), junction `2` ("to", as in
`ledgerEntry2URDistribution` → `ledger_entry_2_ur_distribution`), and
digit-adjacent tokens that stay fused (`iso3166`, `alpha2`, `f24`, `tax770`). The
ETL also applies two **column renames** the plain mapping can't infer:
`lastModified` → `updated` and `default` → `is_default` (the latter avoiding the
SQL reserved word).

### `session_replication_role = 'replica'` during load

The legacy data is cyclic and not topologically ordered, and we load rows with
their **explicit original ids and timestamps**. To make that loadable in one pass,
the ETL sets `session_replication_role = 'replica'` for the duration of the seed,
which **suspends FK enforcement and triggers**. After the load it restores
`origin`, then **resyncs every loaded table's id sequence** past its max loaded
id. FK integrity is then re-verified independently by the test suite — so turning
the checks off during load never weakens the final guarantee.

### Column-less dumps + DDL (`etl/ddl.ts`)

The data dumps are **column-less** (`INSERT INTO t VALUES (...)` with no column
list), so positional values alone are ambiguous. `ddl.ts` parses the legacy
`structure.sql` DDL to recover the authoritative **column names and types**, and
the ETL resolves each row positionally against that.

---

## Reconciliations applied (for transparency / ratification)

A handful of deliberate, documented adjustments were needed to load legacy data
cleanly. None invent data; each is noted here for review:

1. **`studio_id = 1` backfill.** The dumps predate the multi-tenancy `studioId`
   column. Four tables' dumps (`condominiumSupplier`, `f24`, `installmentItem`,
   `ledgerInvoice2F24`) omit the column entirely; `condominium` carries it but as
   `NULL` against a `NOT NULL` target. All this operational data demonstrably
   belongs to **studio 1** (every child table carries `studioId = 1`), so we
   backfill `studio_id = 1` on `condominium` + those 4 tables.
2. **ISO-3166 country codes uppercased.** Legacy master data stores codes
   lowercase (`it`); the `country` reference PK is uppercase (`IT`). We
   canonicalize to uppercase so the country FK resolves — a lossless
   normalization, not a change of meaning.
3. **`post_code.code` UNIQUE constraint.** Postgres can't FK a prefix of a
   composite PK, so to let `city_post_code` reference a single column we add a
   `UNIQUE` on `post_code.code`. This is slightly **stronger** than legacy (it
   forbids the same code under two different countries) but is inert for the
   Italy-only sample data.
4. **`bank` / `bankBranch` registry not loaded.** `bankAccount` is loaded as an FK
   parent (the full dump has it, studio 1, with NULL bank/branch ids). The two
   condos reference **zero** bank branches, so the `bank` / `bankBranch` registry
   tables are intentionally left empty — loading them would add nothing the data
   references.

---

## Module-0 boundary

This module is a **structural migration only** — schema + sample data. No backend,
no auth, no business behavior; behavioral characterization is deferred to
**Module 4**.

**Honest test limitation:** row-count parity is resolver-independent — it counts
rows, not their contents — so a positional **column mis-shift** (values landing in
the wrong columns) would *not* be caught by row counts. It would, however, be
caught by **FK integrity** (mis-shifted FK values would orphan) and by enum-domain
enforcement. Full value-level characterization is a Module-4 concern.
