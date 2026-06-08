# DB Migration (Module 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the legacy MySQL `it-jtime-condominium` database to an idiomatic PostgreSQL 16 database (schema + named enums + one shared timestamp trigger + 6 views), with a deterministic Node ETL that loads the Saturno + Pozzetto sample data, all verified structurally.

**Architecture:** A new `@cl/db` workspace package. A hand-authored **Drizzle schema (snake_case) is the source of truth**; `drizzle-kit` generates SQL migrations. A `naming.ts` mapper provides the lossless `camelCase ↔ snake_case` boundary. A Node ETL parses the legacy MySQL dumps in `old/db/`, transforms values (`tinyint(1)`→bool, `datetime`→`timestamptz`, `default`→`is_default`), and bulk-loads them under `session_replication_role='replica'` (suspends FK + trigger firing — sidesteps the FK cycles and preserves legacy timestamps), then resyncs identity sequences. Verification proves row-count parity, FK integrity, enum domains, sequence health, and schema-drift-free.

**Tech Stack:** Node + TypeScript (ESM), pnpm workspace, Drizzle ORM + drizzle-kit, `pg` driver, PostgreSQL 16 (Docker), Vitest. Pure parsing/transform/naming tested without a DB; load + verification tested against a live Postgres.

**Spec:** `docs/superpowers/specs/2026-06-07-db-migration-design.md`. Read it once for context; this plan is self-contained.

**Reference invariants (measured from `old/db/it-jtime-condominium.structure.sql`):**
- 95 tables, 6 views, 3 functions, 188 triggers, 29 enum columns (**23 distinct value-sets**), 24 `tinyint(1)`, 320 `unsigned`, 22 `decimal`, 190 `datetime`, 90 `AUTO_INCREMENT`, 249 FKs.
- FK closure of the 19 operational tables = **41 tables** (operational + 22 parents). The graph has cycles and self-referential tables.

---

## ⚠️ Plan Corrections (measured from the DDL — these SUPERSEDE any conflicting text or code below)

The original worked examples / test assertions below were drafted from memory. The following were
re-measured directly from `old/db/it-jtime-condominium.structure.sql` and are authoritative. Where the
task bodies below disagree, **these win**.

1. **Timestamp columns.** Every data table has `created` + **`lastModified`** (datetime). **None** has
   `updated`. Decision: **normalize `lastModified` → `updated`** in the new schema (the schema column is
   `updated timestamptz`; the ETL maps the legacy `lastModified` value into it — a column rename, like
   `default`→`is_default`). The `set_timestamps()` trigger in Task 9 (which operates on
   `created`/`updated`) is therefore **correct as written**. Authoring rule #10 stands as written
   (`created`/`updated` in the new schema); just remember the *source* column is `lastModified`.

2. **Self-reference (hierarchy) columns are entity-specific**, not a generic `parentId`:
   - `condominium.parentCondominiumId` → `parent_condominium_id`
   - `ledgerAccount.parentLedgerAccountId` → `parent_ledger_account_id`
   - `unitGroup.parentUnitGroupId` → `parent_unit_group_id`
   Update Task 4/7 test assertions and worked examples accordingly (replace every `parent_id`).

3. **`masterData` has NO hierarchy parent**, and **`qualification` does NOT self-reference.** Instead,
   `masterData` (and ~10 tables total) carry **audit FK columns** `createdMasterDataId` /
   `lastModifiedMasterDataId`, both referencing `masterData(id)`. Keep these **faithful**:
   `created_master_data_id` / `last_modified_master_data_id` (they are FK columns, distinct from the
   `updated` timestamp — do NOT normalize these to `updated`). The Task-5 claim that `masterData`/
   `qualification` self-reference via `parentId` is wrong; drop it. (These audit self-FKs are why those
   tables still count as self-referential for the replica-mode load.)

4. **The `default` reserved-word column is on `masterDataTaxTreatment`** (structure.sql:1936), **not**
   `accountingPeriodInstallmentDefaultSettings`. Decision: **rename `default` → `is_default` boolean on
   `masterDataTaxTreatment`.** Fix the Task-7 assertion (it targets the wrong table) and the Task-13 ETL
   rename map.

5. **`order` is also a reserved word used as a column name (×11).** No rename needed — Drizzle
   double-quotes all identifiers, so `integer("order")` emits a valid `"order"` column. (Same reason a
   rename of `default` is optional, not required; we rename it anyway for ergonomics per #4.)

6. **New authoring rule — `date` type.** 29 columns are `date` (not `datetime`), e.g. `birthDate`,
   `endDate`, `expiryDate`, `paymentDate`, `manufacturedDate`. Translate `date` → drizzle **`date()`**
   (date-only, no timezone). The ETL must NOT apply Europe/Rome→UTC datetime conversion to these — they
   are calendar dates, copied verbatim.

7. **Author every table strictly from the DDL.** For each table run
   `awk '/^CREATE TABLE `<name>`/,/^\) ENGINE/' old/db/it-jtime-condominium.structure.sql` and translate
   **every** column (no omissions) per the authoring rules. The worked examples below are *illustrative
   skeletons*, not complete column lists.

---

## File Structure

```
packages/db/
  package.json            name "@cl/db", type "module"; scripts: db:up db:down migrate seed test typecheck
  tsconfig.json           extends ../../tsconfig.base.json
  vitest.config.ts        two projects: "unit" (no DB) and "integration" (needs DATABASE_URL)
  drizzle.config.ts       drizzle-kit config (dialect postgresql, schema ./src/schema, out ./drizzle)
  docker-compose.yml      postgres:16-alpine on 5432, db "condo", user/pass "condo"
  .env.example            DATABASE_URL=postgres://condo:condo@localhost:5432/condo
  src/
    naming.ts             toSnake/toCamel mapper (+ irregulars)
    enums.ts              23 pgEnum definitions
    schema/
      index.ts            re-exports all tables (drizzle.config points here)
      reference.ts        Tier-A geo/bank/locale tables
      masterData.ts       Tier-B studio + anagrafiche tables
      condominium.ts      condominium, unitGroup, unit, unitPeriod, unitResident, supplier
      accounting.ts       ledgerAccount, ledgerTransaction, ledgerEntry, ledgerInvoice, expense* 
      distribution.ts     distributionTable(+Item), expenseLA2Role/Table, exceptions
      installment.ts      installment(+Item/Group), paymentSlip, accountingPeriod(+settings)
      leftovers.ts        framework-leftover + remaining tables (structural only)
    db.ts                 pg Pool + drizzle() client factory from DATABASE_URL
    sql/
      triggers.sql        set_timestamps() function + attach statements
      views.sql           the 6 recreated views
  drizzle/                generated migrations + 2 hand-added SQL migrations (triggers, views)
  etl/
    parse.ts              MySQL extended-INSERT reader → {table, columns, rows}
    transform.ts          per-column value transforms; column-name → snake_case
    columnTypes.ts        per-table column type map (bool/datetime/numeric) derived from structure
    order.ts              fixed load order (best-effort parents-first; cycles handled by replica mode)
    bankClosure.ts        compute referenced bank/bankBranch ids (Tier-A FK closure)
    load.ts               replica-mode bulk loader + sequence resync
    sources.ts            paths + tier→table→sourcefile mapping
    index.ts              `seed` entry: Tier A → B → C
  test/
    naming.test.ts        (unit) round-trip + irregulars
    enums.test.ts         (unit) value-sets
    parse.test.ts         (unit) parser on fixtures
    transform.test.ts     (unit) value transforms
    rowCounts.test.ts     (integration) per-table parity
    fkIntegrity.test.ts   (integration) all FKs resolve
    enumDomains.test.ts   (integration) out-of-domain rejected
    sequences.test.ts     (integration) insert-after-load works
    schemaDrift.test.ts   (integration) drizzle-kit reports no drift
    fixtures/             tiny hand-made .sql snippets for parser/transform tests
```

---

## Task 1: Scaffold the `@cl/db` package

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/vitest.config.ts`
- Create: `packages/db/docker-compose.yml`
- Create: `packages/db/.env.example`
- Create: `packages/db/src/db.ts`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/test/scaffold.test.ts`
- Modify: none (pnpm-workspace.yaml already globs `packages/*`)

- [ ] **Step 1: Write the scaffold smoke test**

`packages/db/test/scaffold.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("scaffold", () => {
  it("exposes a DATABASE_URL-driven client factory module", async () => {
    const mod = await import("../src/db.ts");
    expect(typeof mod.makeDb).toBe("function");
    expect(typeof mod.makePool).toBe("function");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @cl/db test -- --run test/scaffold.test.ts`
Expected: FAIL — `@cl/db` not found / `src/db.ts` missing.

- [ ] **Step 3: Create package files**

`packages/db/package.json`:
```json
{
  "name": "@cl/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "db:up": "docker compose up -d",
    "db:down": "docker compose down -v",
    "migrate": "drizzle-kit migrate",
    "generate": "drizzle-kit generate",
    "seed": "tsx etl/index.ts",
    "test": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "drizzle-orm": "^0.36.0",
    "pg": "^8.13.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/pg": "^8.11.0",
    "drizzle-kit": "^0.28.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/db/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node", "vitest/globals"], "outDir": "dist" },
  "include": ["src", "etl", "test", "drizzle.config.ts", "vitest.config.ts"]
}
```

`packages/db/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

// Unit tests need no DB. Integration tests require DATABASE_URL and are
// skipped (via test/_integrationGuard) when it is absent.
export default defineConfig({
  test: { globals: true, include: ["test/**/*.test.ts"] },
});
```

`packages/db/docker-compose.yml`:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: condo
      POSTGRES_PASSWORD: condo
      POSTGRES_DB: condo
    ports: ["5432:5432"]
    volumes: ["condo_pg:/var/lib/postgresql/data"]
volumes:
  condo_pg:
```

`packages/db/.env.example`:
```
DATABASE_URL=postgres://condo:condo@localhost:5432/condo
```

`packages/db/src/db.ts`:
```ts
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

export function makePool(url = process.env.DATABASE_URL): pg.Pool {
  if (!url) throw new Error("DATABASE_URL is not set");
  return new pg.Pool({ connectionString: url });
}

export function makeDb(url = process.env.DATABASE_URL) {
  return drizzle(makePool(url));
}
```

`packages/db/drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
```

Create empty `packages/db/src/schema/index.ts` with `export {};` for now (filled in later tasks).

- [ ] **Step 4: Install and run the test**

Run: `pnpm install && pnpm --filter @cl/db test -- --run test/scaffold.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add packages/db pnpm-lock.yaml
git commit -m "feat(db): scaffold @cl/db package (drizzle, pg, docker, vitest)"
```

---

## Task 2: The `naming.ts` boundary mapper

The lossless `camelCase ↔ snake_case` map. Acronyms in the legacy schema need explicit handling so the round-trip is exact: `i18n`, `f24`, `po` (`bankTransferPO`), and `URDistribution` (`ledgerEntry2URDistribution`).

**Files:**
- Create: `packages/db/src/naming.ts`
- Create: `packages/db/test/naming.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/db/test/naming.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toSnake, toCamel } from "../src/naming.ts";

const cases: Array<[camel: string, snake: string]> = [
  ["studioId", "studio_id"],
  ["unitResident", "unit_resident"],
  ["ledgerTransaction", "ledger_transaction"],
  ["accountingPeriodInstallmentDefaultSettings", "accounting_period_installment_default_settings"],
  ["masterDataCategoryI18n", "master_data_category_i18n"],
  ["ledgerInvoice2F24", "ledger_invoice_2_f24"],
  ["bankTransferPO", "bank_transfer_po"],
  ["ledgerEntry2URDistribution", "ledger_entry_2_ur_distribution"],
  ["nextPeriodEstimateBasedOn", "next_period_estimate_based_on"],
];

describe("naming", () => {
  it.each(cases)("toSnake(%s) === %s", (camel, snake) => {
    expect(toSnake(camel)).toBe(snake);
  });
  it.each(cases)("toCamel round-trips %s", (camel, snake) => {
    expect(toCamel(snake)).toBe(camel);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @cl/db test -- --run test/naming.test.ts`
Expected: FAIL — `src/naming.ts` has no `toSnake`/`toCamel`.

- [ ] **Step 3: Implement `naming.ts`**

`packages/db/src/naming.ts`:
```ts
// Irregular tokens that do not follow plain camel boundaries. Map is applied
// in BOTH directions so the transform is lossless. Order matters: longest first.
const IRREGULAR: Array<[camel: string, snake: string]> = [
  ["URDistribution", "_ur_distribution"],
  ["I18n", "_i18n"],
  ["2F24", "_2_f24"],
  ["PO", "_po"],
];

export function toSnake(camel: string): string {
  let s = camel;
  for (const [c, snake] of IRREGULAR) s = s.split(c).join(` ${snake} `);
  s = s
    .split(" ")
    .map((seg) => (seg.startsWith("_") ? seg : seg.replace(/([a-z0-9])([A-Z])/g, "$1_$2")))
    .join("");
  return s.replace(/__+/g, "_").replace(/^_/, "").toLowerCase();
}

export function toCamel(snake: string): string {
  // Reverse via the known irregular snake forms first, then standard.
  const rev: Array<[snake: string, camel: string]> = [
    ["_ur_distribution", "URDistribution"],
    ["_i18n", "I18n"],
    ["_2_f24", "2F24"],
    ["_po", "PO"],
  ];
  let s = snake;
  for (const [sn, c] of rev) s = s.split(sn).join(` ${c} `);
  return s
    .split(" ")
    .map((seg) =>
      seg.includes("_") || /^[a-z0-9]+$/.test(seg)
        ? seg.replace(/_([a-z0-9])/g, (_, ch: string) => ch.toUpperCase())
        : seg,
    )
    .join("");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @cl/db test -- --run test/naming.test.ts`
Expected: PASS (18 assertions). If any acronym case fails, adjust the `IRREGULAR`/`rev` tables until all 9 round-trip both ways — do not change the test expectations.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/naming.ts packages/db/test/naming.test.ts
git commit -m "feat(db): lossless camelCase<->snake_case naming mapper"
```

---

## Task 3: The 23 named enum types

**Files:**
- Create: `packages/db/src/enums.ts`
- Create: `packages/db/test/enums.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/db/test/enums.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import * as enums from "../src/enums.ts";

describe("enums", () => {
  it("ledgerAccountType has the 4 legacy values in order", () => {
    expect(enums.ledgerAccountType.enumValues).toEqual([
      "regular", "grouping", "control", "controlUnitResident",
    ]);
  });
  it("ledgerTransactionType has all 10 legacy values", () => {
    expect(enums.ledgerTransactionType.enumValues).toHaveLength(10);
    expect(enums.ledgerTransactionType.enumValues).toContain("estimateDistribution");
  });
  it("installmentItemStatus and installmentPaymentSlipStatus are DISTINCT types", () => {
    expect(enums.installmentItemStatus.enumValues).toContain("incomplete");
    expect(enums.installmentPaymentSlipStatus.enumValues).not.toContain("incomplete");
  });
  it("defines exactly 23 enum types", () => {
    const pgEnums = Object.values(enums).filter(
      (e: any) => e && typeof e === "object" && Array.isArray(e.enumValues),
    );
    expect(pgEnums).toHaveLength(23);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @cl/db test -- --run test/enums.test.ts`
Expected: FAIL — `src/enums.ts` missing.

- [ ] **Step 3: Implement `enums.ts`**

Each distinct value-set becomes one `pgEnum`. Values stay camelCase (domain tokens). The DB type name is snake_case.

`packages/db/src/enums.ts`:
```ts
import { pgEnum } from "drizzle-orm/pg-core";

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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @cl/db test -- --run test/enums.test.ts`
Expected: PASS (4 tests). The "exactly 23" assertion guards against accidental dupes/omissions.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/enums.ts packages/db/test/enums.test.ts
git commit -m "feat(db): 23 named pg enum types (camelCase values preserved)"
```

---

## Task 4: Schema authoring — pattern + worked example (`condominium.ts`)

The schema is a **mechanical translation** of the legacy DDL. Rather than inline 95 near-identical
table blocks (which would violate DRY), this task establishes the **authoring pattern** with one
fully-worked file that exercises every tricky case: self-reference, enum column, boolean (`tinyint(1)`),
`numeric` money, FK, identity PK, and the `created`/`updated` timestamp convention. Tasks 5–8 apply the
identical pattern to the remaining areas, using the per-table inventory in each task.

**Authoring rules (apply to every table, every task):**
1. Table + column names are the legacy name passed through `toSnake` at authoring time (write the
   literal snake_case string; do not call `toSnake` at runtime in schema files).
2. `int unsigned`/`bigint unsigned` PK with `AUTO_INCREMENT` → `integer/bigint ... generatedAlwaysAsIdentity()`, `.primaryKey()`.
3. Other `int` → `integer()`; `bigint` → `bigint({ mode: "number" })`. (No `CHECK (>=0)` in this module
   except where Task notes call it out — YAGNI; surrogate keys are covered by identity.)
4. `tinyint(1)` → `boolean()`. **The column literally named `default`** → `is_default` boolean.
5. `datetime` → `timestamp({ withTimezone: true })`.
6. `decimal(p,s)` money → `numeric({ precision: 12, scale: 2 })`; other decimals keep legacy precision/scale.
7. `varchar(n)` → `varchar({ length: n })`; `text` → `text()`; `char(n)` → `char({ length: n })`.
8. `enum(...)` → the matching `pgEnum` from `src/enums.ts` (e.g. `condominiumType("type")`).
9. FK → `.references(() => parent.id)`. **Self-references** use a typed forward declaration (see code).
10. Every table with legacy `created`/`updated` columns gets them as
    `timestamp({ withTimezone: true })` (the shared trigger is attached later in SQL, Task 9 — do not
    add `.defaultNow()` here; legacy values are loaded verbatim).
11. `studioId` FK column → `studio_id` referencing `studio.id` (present on the 59 tenant tables).

**Files:**
- Create: `packages/db/src/schema/condominium.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/test/schemaShape.test.ts`

- [ ] **Step 1: Write the failing test** (asserts the worked-example columns exist with right types)

`packages/db/test/schemaShape.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { condominium, unitGroup } from "../src/schema/condominium.ts";
import { getTableConfig } from "drizzle-orm/pg-core";

describe("schema shape — condominium area", () => {
  it("condominium table is named snake_case with identity PK", () => {
    const t = getTableConfig(condominium);
    expect(t.name).toBe("condominium");
    const id = t.columns.find((c) => c.name === "id")!;
    expect(id.primary).toBe(true);
  });
  it("condominium has a self-referential parent_id and an enum type column", () => {
    const t = getTableConfig(condominium);
    const names = t.columns.map((c) => c.name);
    expect(names).toContain("parent_id");
    expect(names).toContain("studio_id");
    const typeCol = t.columns.find((c) => c.name === "type")!;
    expect(typeCol.enumValues).toEqual(["regular", "super", "residence"]);
  });
  it("unitGroup is self-referential too", () => {
    const t = getTableConfig(unitGroup);
    expect(t.columns.map((c) => c.name)).toContain("parent_id");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @cl/db test -- --run test/schemaShape.test.ts`
Expected: FAIL — `schema/condominium.ts` missing.

- [ ] **Step 3: Implement `condominium.ts` (the worked pattern)**

`packages/db/src/schema/condominium.ts`:
```ts
import {
  pgTable, integer, varchar, text, boolean, numeric, timestamp,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { condominiumType, recordStatus } from "../enums.ts";
import { studio } from "./masterData.ts";
import { masterData } from "./masterData.ts";

export const condominium = pgTable("condominium", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => studio.id),
  // self-reference: supercondominio parent. Typed forward ref avoids TS cycle.
  parentId: integer("parent_id").references((): AnyPgColumn => condominium.id),
  type: condominiumType("type").notNull(),
  status: recordStatus("status").notNull(),
  name: varchar("name", { length: 255 }),
  fiscalCode: varchar("fiscal_code", { length: 32 }),
  notes: text("notes"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

export const unitGroup = pgTable("unit_group", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => studio.id),
  condominiumId: integer("condominium_id").references(() => condominium.id),
  parentId: integer("parent_id").references((): AnyPgColumn => unitGroup.id),
  name: varchar("name", { length: 255 }),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

export const unit = pgTable("unit", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => studio.id),
  condominiumId: integer("condominium_id").references(() => condominium.id),
  unitGroupId: integer("unit_group_id").references(() => unitGroup.id),
  name: varchar("name", { length: 255 }),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

export const unitPeriod = pgTable("unit_period", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => studio.id),
  unitId: integer("unit_id").references(() => unit.id),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

export const unitResident = pgTable("unit_resident", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => studio.id),
  unitPeriodId: integer("unit_period_id").references(() => unitPeriod.id),
  masterDataId: integer("master_data_id").references(() => masterData.id),
  share: numeric("share", { precision: 12, scale: 6 }),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

export const condominiumSupplier = pgTable("condominium_supplier", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => studio.id),
  condominiumId: integer("condominium_id").references(() => condominium.id),
  masterDataId: integer("master_data_id").references(() => masterData.id),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});
```

> **Authoring note for the implementer:** the column lists above include every FK and enum column plus
> a representative set of scalar columns. When authoring against the real DDL, **add the remaining
> scalar columns of each table verbatim** (translated per the rules). Cross-check each table's column
> list against `old/db/it-jtime-condominium.structure.sql` so no column is dropped — the row-count and
> drift tests (Tasks 11, 17) will not catch a *missing column*, so this cross-check is the guard. Use:
> `awk '/CREATE TABLE `condominium`/,/;/' old/db/it-jtime-condominium.structure.sql` to view one table.

`packages/db/src/schema/index.ts`:
```ts
export * from "./condominium.ts";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @cl/db test -- --run test/schemaShape.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/condominium.ts packages/db/src/schema/index.ts packages/db/test/schemaShape.test.ts
git commit -m "feat(db): condominium-area schema + authoring pattern (self-ref, enum, fk, identity)"
```

---

## Task 5: Schema — Tier-B `masterData.ts` (studio + anagrafiche)

Apply the Task-4 pattern. Tables (from the FK closure): `studio`, `masterData` (self-ref ×2:
`parentId`, and a category/owner ref), `person`, `company`, `personVariation`, `companyVariation`,
`masterDataVariation`, `masterDataCategory`, `accessAccount`, `qualification`. `masterData.status`
uses `recordStatus`; `person.sex` uses `personSex`; `accessAccount.status`/`.role` use
`accessAccountStatus`/`accessAccountRole`; `masterDataContact.type` (if authored here) uses
`masterDataContactType`.

**Files:**
- Create: `packages/db/src/schema/masterData.ts`
- Modify: `packages/db/src/schema/index.ts` (add `export * from "./masterData.ts";`)
- Modify: `packages/db/test/schemaShape.test.ts` (add masterData assertions)

- [ ] **Step 1: Add failing assertions**

Append to `packages/db/test/schemaShape.test.ts`:
```ts
import { studio, masterData, person, accessAccount } from "../src/schema/masterData.ts";

describe("schema shape — masterData area", () => {
  it("studio has identity PK", () => {
    const t = getTableConfig(studio);
    expect(t.columns.find((c) => c.name === "id")!.primary).toBe(true);
  });
  it("masterData self-references via parent_id", () => {
    expect(getTableConfig(masterData).columns.map((c) => c.name)).toContain("parent_id");
  });
  it("person.sex is the person_sex enum", () => {
    const sex = getTableConfig(person).columns.find((c) => c.name === "sex")!;
    expect(sex.enumValues).toEqual(["m", "f"]);
  });
  it("accessAccount.role uses the access_account_role enum", () => {
    const role = getTableConfig(accessAccount).columns.find((c) => c.name === "role")!;
    expect(role.enumValues).toContain("administrator");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @cl/db test -- --run test/schemaShape.test.ts`
Expected: FAIL — `schema/masterData.ts` missing.

- [ ] **Step 3: Implement `masterData.ts`**

Author every table listed above following the Task-4 rules and cross-checking columns against the DDL.
Worked skeleton for the self-referential + enum cases (extend with all real columns):
```ts
import { pgTable, integer, varchar, text, boolean, timestamp, type AnyPgColumn } from "drizzle-orm/pg-core";
import { recordStatus, personSex, accessAccountStatus, accessAccountRole } from "../enums.ts";

export const studio = pgTable("studio", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  name: varchar("name", { length: 255 }),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

export const masterData = pgTable("master_data", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => studio.id),
  parentId: integer("parent_id").references((): AnyPgColumn => masterData.id),
  status: recordStatus("status").notNull(),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

export const person = pgTable("person", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  masterDataId: integer("master_data_id").references(() => masterData.id),
  sex: personSex("sex"),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

export const company = pgTable("company", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  masterDataId: integer("master_data_id").references(() => masterData.id),
  businessName: varchar("business_name", { length: 255 }),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

export const masterDataCategory = pgTable("master_data_category", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => studio.id),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

export const accessAccount = pgTable("access_account", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => studio.id),
  masterDataId: integer("master_data_id").references(() => masterData.id),
  status: accessAccountStatus("status"),
  role: accessAccountRole("role"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

export const qualification = pgTable("qualification", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  parentId: integer("parent_id").references((): AnyPgColumn => qualification.id),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

export const personVariation = pgTable("person_variation", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  personId: integer("person_id").references(() => person.id),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

export const companyVariation = pgTable("company_variation", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  companyId: integer("company_id").references(() => company.id),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

export const masterDataVariation = pgTable("master_data_variation", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  masterDataId: integer("master_data_id").references(() => masterData.id),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @cl/db test -- --run test/schemaShape.test.ts`
Expected: PASS (7 tests total).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/masterData.ts packages/db/src/schema/index.ts packages/db/test/schemaShape.test.ts
git commit -m "feat(db): masterData-area schema (studio + anagrafiche)"
```

---

## Task 6: Schema — Tier-A `reference.ts` (geo / bank / locale)

Apply the pattern to the tenant-independent reference tables in the FK closure: `country`, `locale`,
`state`, `city`, `district`, `minorCivilDivision`, `bank`, `bankBranch`, plus the i18n companions used
by the closure if FK'd (`countryI18n`, `localeI18n`). No `studioId` on these (global data). No enum
columns here.

**Files:**
- Create: `packages/db/src/schema/reference.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/test/schemaShape.test.ts`

- [ ] **Step 1: Add failing assertions**

Append to `packages/db/test/schemaShape.test.ts`:
```ts
import { country, city, bank, bankBranch } from "../src/schema/reference.ts";

describe("schema shape — reference area", () => {
  it("bankBranch references bank", () => {
    const fkNames = getTableConfig(bankBranch).foreignKeys.map((fk) => fk.reference().foreignTable);
    expect(fkNames.length).toBeGreaterThanOrEqual(1);
  });
  it("city and country exist with identity PKs", () => {
    expect(getTableConfig(city).columns.find((c) => c.name === "id")!.primary).toBe(true);
    expect(getTableConfig(country).columns.find((c) => c.name === "id")!.primary).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @cl/db test -- --run test/schemaShape.test.ts`
Expected: FAIL — `schema/reference.ts` missing.

- [ ] **Step 3: Implement `reference.ts`**

Author all reference tables per the rules (cross-check columns vs DDL). Skeleton:
```ts
import { pgTable, integer, varchar, char, timestamp } from "drizzle-orm/pg-core";

export const country = pgTable("country", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  isoCode: char("iso_code", { length: 2 }),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});
export const locale = pgTable("locale", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  code: varchar("code", { length: 16 }),
});
export const state = pgTable("state", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  countryId: integer("country_id").references(() => country.id),
});
export const district = pgTable("district", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  stateId: integer("state_id").references(() => state.id),
});
export const minorCivilDivision = pgTable("minor_civil_division", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  districtId: integer("district_id").references(() => district.id),
});
export const city = pgTable("city", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  minorCivilDivisionId: integer("minor_civil_division_id").references(() => minorCivilDivision.id),
  name: varchar("name", { length: 255 }),
});
export const bank = pgTable("bank", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  name: varchar("name", { length: 255 }),
});
export const bankBranch = pgTable("bank_branch", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  bankId: integer("bank_id").references(() => bank.id),
  abi: varchar("abi", { length: 16 }),
  cab: varchar("cab", { length: 16 }),
});
```

`index.ts`: add `export * from "./reference.ts";`

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @cl/db test -- --run test/schemaShape.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/reference.ts packages/db/src/schema/index.ts packages/db/test/schemaShape.test.ts
git commit -m "feat(db): reference-area schema (geo/bank/locale)"
```

---

## Task 7: Schema — operational areas `accounting.ts`, `distribution.ts`, `installment.ts`

Apply the pattern to the remaining operational + FK-closure tables, grouped by file:

- **`accounting.ts`:** `ledgerAccount` (self-ref `parentId`; `type`→`ledgerAccountType`, `kind`→`ledgerAccountKind`), `ledgerTransaction` (`type`→`ledgerTransactionType`; has the extra `timestamp` column), `ledgerEntry` (`type`→`ledgerEntryType`), `ledgerInvoice`, `expenseLedgerAccount` (`nextPeriodEstimateBasedOn`→enum, `costAttributionOnHandover`→enum), `withholdingTax`, `taxRelief`, `bankAccount`, `consumptionMeter`.
- **`distribution.ts`:** `distributionTable`, `distributionTableItem`, `expenseLA2Role`, `expenseLA2Table` (`type`→`expenseLa2TableType`), `unitOwnershipScenario`, `unitResidentPriority`, `unitType`, `unitResidentAccount`.
- **`installment.ts`:** `accountingPeriod` (`status`→`accountingPeriodStatus`, `type`→`accountingPeriodType`), `accountingPeriodInstallmentDefaultSettings` (the `default`→`is_default` boolean; two `*DistributionMode`→`openingBalanceDistributionMode`), `installment` (`type`→`installmentType`), `installmentItem` (`status`→`installmentItemStatus`), `installmentGroup` (`type`→`installmentType`; two `*DistributionMode`→enum), `installmentPaymentSlip` (`status`→`installmentPaymentSlipStatus`).

**Files:**
- Create: `packages/db/src/schema/accounting.ts`, `distribution.ts`, `installment.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/test/schemaShape.test.ts`

- [ ] **Step 1: Add failing assertions** (focus on the tricky columns)

Append to `packages/db/test/schemaShape.test.ts`:
```ts
import { ledgerAccount, ledgerTransaction } from "../src/schema/accounting.ts";
import { expenseLA2Table } from "../src/schema/distribution.ts";
import { accountingPeriodInstallmentDefaultSettings as apiDefaults, installmentItem } from "../src/schema/installment.ts";

describe("schema shape — operational areas", () => {
  it("ledgerAccount self-references and has type+kind enums", () => {
    const t = getTableConfig(ledgerAccount);
    const names = t.columns.map((c) => c.name);
    expect(names).toContain("parent_id");
    expect(t.columns.find((c) => c.name === "type")!.enumValues).toContain("controlUnitResident");
    expect(t.columns.find((c) => c.name === "kind")!.enumValues).toContain("assetsOrLiabilities");
  });
  it("ledgerTransaction keeps the extra timestamp column", () => {
    expect(getTableConfig(ledgerTransaction).columns.map((c) => c.name)).toContain("timestamp");
  });
  it("reserved-word column 'default' is renamed is_default", () => {
    const names = getTableConfig(apiDefaults).columns.map((c) => c.name);
    expect(names).toContain("is_default");
    expect(names).not.toContain("default");
  });
  it("installmentItem.status is the 4-value enum", () => {
    expect(getTableConfig(installmentItem).columns.find((c) => c.name === "status")!.enumValues)
      .toEqual(["issued", "incomplete", "settled", "neutralized"]);
  });
  it("expenseLA2Table.type is the estimate/currentBalance enum", () => {
    expect(getTableConfig(expenseLA2Table).columns.find((c) => c.name === "type")!.enumValues)
      .toEqual(["estimate", "currentBalance"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @cl/db test -- --run test/schemaShape.test.ts`
Expected: FAIL — the three new schema files are missing.

- [ ] **Step 3: Implement the three files**

Author each table per the rules. Key worked cases:
```ts
// accounting.ts (excerpt — the self-ref + extra-timestamp + enums)
import { pgTable, integer, varchar, numeric, timestamp, type AnyPgColumn } from "drizzle-orm/pg-core";
import { ledgerAccountType, ledgerAccountKind, ledgerTransactionType, ledgerEntryType,
  nextPeriodEstimateBasedOn, costAttributionOnHandover } from "../enums.ts";
import { studio } from "./masterData.ts";

export const ledgerAccount = pgTable("ledger_account", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => studio.id),
  parentId: integer("parent_id").references((): AnyPgColumn => ledgerAccount.id),
  type: ledgerAccountType("type").notNull(),
  kind: ledgerAccountKind("kind"),
  code: varchar("code", { length: 64 }),
  name: varchar("name", { length: 255 }),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

export const ledgerTransaction = pgTable("ledger_transaction", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => studio.id),
  type: ledgerTransactionType("type").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }), // legacy extra column
  amount: numeric("amount", { precision: 12, scale: 2 }),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});
```
```ts
// installment.ts (excerpt — the reserved-word rename)
import { pgTable, integer, boolean, numeric, timestamp } from "drizzle-orm/pg-core";
import { accountingPeriodStatus, accountingPeriodType, openingBalanceDistributionMode } from "../enums.ts";
import { studio } from "./masterData.ts";

export const accountingPeriodInstallmentDefaultSettings = pgTable(
  "accounting_period_installment_default_settings",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    studioId: integer("studio_id").references(() => studio.id),
    isDefault: boolean("is_default").notNull().default(false), // legacy `default` tinyint(1)
    creditOpeningBalanceDistributionMode: openingBalanceDistributionMode("credit_opening_balance_distribution_mode"),
    debtOpeningBalanceDistributionMode: openingBalanceDistributionMode("debt_opening_balance_distribution_mode"),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
);
```

Author the rest of the tables in each file similarly, cross-checking columns against the DDL.
`index.ts`: add the three `export * from` lines.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @cl/db test -- --run test/schemaShape.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/accounting.ts packages/db/src/schema/distribution.ts packages/db/src/schema/installment.ts packages/db/src/schema/index.ts packages/db/test/schemaShape.test.ts
git commit -m "feat(db): operational-area schema (accounting/distribution/installment)"
```

---

## Task 8: Schema — `leftovers.ts` (remaining tables, structural only)

The remaining tables outside the FK closure must exist so the migration builds the **full** schema
(spec §1.4). These carry no data in Module 0. They include the framework leftovers (tickets,
invoices/products, etc.) and remaining i18n/lookup/calendar/f24 tables. Author each per the rules
(enum columns: `license.type`→`licenseType`; `calendarEvent.priority`/`ticket.priority`→`eventPriority`;
`ticket.status`→`ticketStatus`; `masterDataContact.type`→`masterDataContactType`).

**Files:**
- Create: `packages/db/src/schema/leftovers.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/test/tableCount.test.ts`

- [ ] **Step 1: Write the failing test (total table count = 94 after dropping codeIgniterSession)**

`packages/db/test/tableCount.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import * as schema from "../src/schema/index.ts";
import { getTableConfig } from "drizzle-orm/pg-core";
import { PgTable } from "drizzle-orm/pg-core";

describe("table coverage", () => {
  it("defines 94 tables (95 legacy minus dropped codeIgniterSession)", () => {
    const tables = Object.values(schema).filter((t) => t instanceof PgTable);
    expect(tables).toHaveLength(94);
  });
  it("does not define codeIgniterSession", () => {
    const names = Object.values(schema)
      .filter((t) => t instanceof PgTable)
      .map((t) => getTableConfig(t as PgTable).name);
    expect(names).not.toContain("code_igniter_session");
    expect(new Set(names).size).toBe(names.length); // no dupes
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @cl/db test -- --run test/tableCount.test.ts`
Expected: FAIL — fewer than 94 tables defined.

- [ ] **Step 3: Implement `leftovers.ts`**

Author every legacy table not already defined in Tasks 4–7, except `codeIgniterSession` (dropped).
Use the same rules. Verify the set against the DDL with:
`grep '^CREATE TABLE' old/db/it-jtime-condominium.structure.sql | wc -l` (= 95) and subtract the
tables already authored + `codeIgniterSession`. `index.ts`: add `export * from "./leftovers.ts";`

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @cl/db test -- --run test/tableCount.test.ts`
Expected: PASS (94 tables, no dupes, no `code_igniter_session`).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/leftovers.ts packages/db/src/schema/index.ts packages/db/test/tableCount.test.ts
git commit -m "feat(db): remaining + framework-leftover tables (structural); 94 total"
```

---

## Task 9: The shared `set_timestamps()` trigger

Collapse the 188 legacy timestamp triggers into one PLpgSQL function attached to every table with the
`created`/`updated` convention. Delivered as a hand-authored SQL migration (drizzle-kit does not model
triggers).

**Files:**
- Create: `packages/db/src/sql/triggers.sql`
- Create: `packages/db/test/triggers.test.ts` (integration)

- [ ] **Step 1: Write the failing integration test**

`packages/db/test/triggers.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { makePool } from "../src/db.ts";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip; // skip when no DB configured

d("set_timestamps trigger", () => {
  const pool = makePool(url);
  beforeAll(async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS _t_demo (
      id serial primary key, created timestamptz, updated timestamptz)`);
    await pool.query(`DROP TRIGGER IF EXISTS set_timestamps ON _t_demo`);
    await pool.query(`CREATE TRIGGER set_timestamps BEFORE INSERT OR UPDATE ON _t_demo
      FOR EACH ROW EXECUTE FUNCTION set_timestamps()`);
  });
  afterAll(async () => { await pool.query(`DROP TABLE IF EXISTS _t_demo`); await pool.end(); });

  it("sets created on insert when null, leaves it on update", async () => {
    const ins = await pool.query(`INSERT INTO _t_demo DEFAULT VALUES RETURNING id, created`);
    const { id, created } = ins.rows[0];
    expect(created).not.toBeNull();
    await pool.query(`UPDATE _t_demo SET id = id WHERE id = $1`, [id]);
    const after = await pool.query(`SELECT created FROM _t_demo WHERE id = $1`, [id]);
    expect(new Date(after.rows[0].created).getTime()).toBe(new Date(created).getTime());
  });

  it("preserves an explicitly provided created (COALESCE semantics)", async () => {
    const ts = "2001-02-03T04:05:06Z";
    const ins = await pool.query(
      `INSERT INTO _t_demo (created) VALUES ($1) RETURNING created`, [ts]);
    expect(new Date(ins.rows[0].created).toISOString()).toBe("2001-02-03T04:05:06.000Z");
  });
});
```

- [ ] **Step 2: Bring up the DB and run to verify it fails**

Run: `pnpm --filter @cl/db db:up && DATABASE_URL=postgres://condo:condo@localhost:5432/condo pnpm --filter @cl/db test -- --run test/triggers.test.ts`
Expected: FAIL — `function set_timestamps() does not exist`.

- [ ] **Step 3: Implement `triggers.sql`**

`packages/db/src/sql/triggers.sql`:
```sql
CREATE OR REPLACE FUNCTION set_timestamps() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created := COALESCE(NEW.created, now());
    NEW.updated := COALESCE(NEW.updated, NEW.created);
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.created := OLD.created; -- never changes
    IF NEW.updated IS NOT DISTINCT FROM OLD.updated THEN
      NEW.updated := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Load it for the test (the test's `beforeAll` creates the trigger; the function itself must exist):
prepend a step in the test `beforeAll` that runs the file, OR (simpler) run it manually before the
test. Add to `beforeAll`:
```ts
import { readFileSync } from "node:fs";
// ...inside beforeAll, before CREATE TRIGGER:
await pool.query(readFileSync(new URL("../src/sql/triggers.sql", import.meta.url), "utf8"));
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `DATABASE_URL=postgres://condo:condo@localhost:5432/condo pnpm --filter @cl/db test -- --run test/triggers.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/sql/triggers.sql packages/db/test/triggers.test.ts
git commit -m "feat(db): shared set_timestamps() trigger (COALESCE created / bump updated)"
```

---

## Task 10: Generate migrations + wire trigger & views migrations; prove the schema builds

drizzle-kit generates the table/enum/FK migration from the schema. Two hand-authored SQL migrations
follow: the trigger function + per-table attach, and the 6 views.

**Files:**
- Create: `packages/db/drizzle/0000_*.sql` (generated)
- Create: `packages/db/drizzle/9998_triggers.sql` (function + attach loop)
- Create: `packages/db/drizzle/9999_views.sql` (the 6 views)
- Create: `packages/db/src/sql/views.sql`
- Create: `packages/db/test/migrateBuild.test.ts` (integration)

- [ ] **Step 1: Generate the base migration**

Run: `pnpm --filter @cl/db generate`
Expected: a `drizzle/0000_*.sql` file containing `CREATE TYPE ... AS ENUM` for all 23 enums and
`CREATE TABLE` for all 94 tables + FKs. Inspect it; confirm 94 `CREATE TABLE` and 23 `CREATE TYPE`.

- [ ] **Step 2: Write the failing build test**

`packages/db/test/migrateBuild.test.ts`:
```ts
import { describe, it, expect, afterAll } from "vitest";
import { makePool } from "../src/db.ts";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

d("migrated schema", () => {
  const pool = makePool(url);
  afterAll(() => pool.end());
  it("has 94 base tables", async () => {
    const r = await pool.query(
      `SELECT count(*)::int n FROM information_schema.tables
       WHERE table_schema='public' AND table_type='BASE TABLE'
       AND table_name <> '__drizzle_migrations'`);
    expect(r.rows[0].n).toBe(94);
  });
  it("has 23 enum types", async () => {
    const r = await pool.query(`SELECT count(*)::int n FROM pg_type WHERE typtype='e'`);
    expect(r.rows[0].n).toBe(23);
  });
  it("has 6 views", async () => {
    const r = await pool.query(
      `SELECT count(*)::int n FROM information_schema.views WHERE table_schema='public'`);
    expect(r.rows[0].n).toBe(6);
  });
  it("attached set_timestamps to every table with created/updated", async () => {
    const r = await pool.query(`
      SELECT count(*)::int n FROM information_schema.columns c
      WHERE c.table_schema='public' AND c.column_name='created'
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.triggers tg
        WHERE tg.event_object_table=c.table_name AND tg.trigger_name='set_timestamps')`);
    expect(r.rows[0].n).toBe(0); // zero tables-with-created lacking the trigger
  });
});
```

- [ ] **Step 2b: Run to verify it fails**

Run: `pnpm --filter @cl/db db:down && pnpm --filter @cl/db db:up && DATABASE_URL=... pnpm --filter @cl/db migrate && DATABASE_URL=... pnpm --filter @cl/db test -- --run test/migrateBuild.test.ts`
Expected: FAIL — views/trigger-attach migrations don't exist yet (6 views = 0; trigger-attach n > 0).

- [ ] **Step 3: Author the trigger-attach and views migrations**

`packages/db/src/sql/views.sql`: recreate the 6 legacy views as plain views (drop
`DEFINER`/`ALGORITHM`/`SQL SECURITY`). Get their definitions from the DDL:
`grep -n 'CREATE.*VIEW' old/db/it-jtime-condominium.structure.sql` then translate each `SELECT` to
snake_case column/table names. Place the 6 `CREATE VIEW` statements here.

`packages/db/drizzle/9998_triggers.sql`:
```sql
-- statement-breakpoint
\i is not available; inline the function then attach via DO-block.
CREATE OR REPLACE FUNCTION set_timestamps() RETURNS trigger AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    NEW.created := COALESCE(NEW.created, now());
    NEW.updated := COALESCE(NEW.updated, NEW.created);
  ELSIF TG_OP='UPDATE' THEN
    NEW.created := OLD.created;
    IF NEW.updated IS NOT DISTINCT FROM OLD.updated THEN NEW.updated := now(); END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
-- statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema='public' AND column_name='created'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_timestamps BEFORE INSERT OR UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_timestamps()', r.table_name);
  END LOOP;
END $$;
```

`packages/db/drizzle/9999_views.sql`: `-- statement-breakpoint`-separated `CREATE VIEW` statements
(copy from `src/sql/views.sql`). Ensure drizzle's migration journal includes these files (drizzle-kit
migrate runs files in `drizzle/` in lexical order; the `9998`/`9999` prefixes order them last). If the
journal (`drizzle/meta/_journal.json`) requires explicit registration, add entries; otherwise place
the SQL inside the generated migration's tail. **Verify** by re-running migrate on a clean DB.

- [ ] **Step 4: Re-run migrate + test**

Run: `pnpm --filter @cl/db db:down && pnpm --filter @cl/db db:up && DATABASE_URL=... pnpm --filter @cl/db migrate && DATABASE_URL=... pnpm --filter @cl/db test -- --run test/migrateBuild.test.ts`
Expected: PASS (4 tests: 94 tables, 23 enums, 6 views, 0 missing triggers).

- [ ] **Step 5: Commit**

```bash
git add packages/db/drizzle packages/db/src/sql/views.sql packages/db/test/migrateBuild.test.ts
git commit -m "feat(db): generate migrations; attach set_timestamps to all tables; 6 views"
```

---

## Task 11: Schema-drift guard

Prove the Drizzle schema and the migrated DB agree (spec §1.4), catching any column the migrations
don't reflect.

**Files:**
- Create: `packages/db/test/schemaDrift.test.ts` (integration)

- [ ] **Step 1: Write the failing test**

`packages/db/test/schemaDrift.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

d("schema drift", () => {
  it("drizzle-kit check reports no pending changes vs the migrated DB", () => {
    // `drizzle-kit check` validates migration consistency; `generate` with no
    // schema change must produce no new statements.
    const out = execFileSync("pnpm", ["--filter", "@cl/db", "exec", "drizzle-kit", "check"], {
      encoding: "utf8", env: process.env,
    });
    expect(out.toLowerCase()).not.toContain("conflict");
  });
});
```

- [ ] **Step 2: Run to verify behavior**

Run: `DATABASE_URL=... pnpm --filter @cl/db test -- --run test/schemaDrift.test.ts`
Expected: initially may FAIL if migrations are inconsistent. Resolve by regenerating until
`drizzle-kit check` is clean.

- [ ] **Step 3: Make it pass**

If `check` reports issues, run `pnpm --filter @cl/db generate` to capture any missing schema delta,
re-migrate on a clean DB, and re-run. No code beyond regenerated migration files.

- [ ] **Step 4: Confirm pass**

Run: `DATABASE_URL=... pnpm --filter @cl/db test -- --run test/schemaDrift.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/test/schemaDrift.test.ts packages/db/drizzle
git commit -m "test(db): schema-drift guard (drizzle-kit check clean)"
```

---

## Task 12: ETL parser — read MySQL extended INSERTs

**Files:**
- Create: `packages/db/etl/parse.ts`
- Create: `packages/db/test/fixtures/sample.sql`
- Create: `packages/db/test/parse.test.ts`

- [ ] **Step 1: Write the failing test + fixture**

`packages/db/test/fixtures/sample.sql`:
```sql
INSERT INTO `condominium` (`id`, `name`, `default`, `created`) VALUES
(1,'Saturno',1,'2011-01-01 00:00:00'),
(2,'O\'Brien, Inc.',0,NULL);
INSERT INTO `unit` (`id`,`name`) VALUES (10,'A1');
```

`packages/db/test/parse.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseInserts } from "../etl/parse.ts";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("./fixtures/sample.sql", import.meta.url), "utf8");

describe("parseInserts", () => {
  const stmts = parseInserts(sql);
  it("finds two INSERT statements", () => {
    expect(stmts.map((s) => s.table)).toEqual(["condominium", "unit"]);
  });
  it("captures legacy column names verbatim (incl. reserved `default`)", () => {
    expect(stmts[0].columns).toEqual(["id", "name", "default", "created"]);
  });
  it("parses rows, NULLs, escaped quotes, and numbers", () => {
    expect(stmts[0].rows).toEqual([
      ["1", "Saturno", "1", "2011-01-01 00:00:00"],
      ["2", "O'Brien, Inc.", "0", null],
    ]);
    expect(stmts[1].rows).toEqual([["10", "A1"]]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @cl/db test -- --run test/parse.test.ts`
Expected: FAIL — `etl/parse.ts` missing.

- [ ] **Step 3: Implement `parse.ts`**

`packages/db/etl/parse.ts`:
```ts
export interface InsertStmt {
  table: string;
  columns: string[];
  rows: Array<Array<string | null>>;
}

// Tolerant reader for mysqldump extended INSERTs. Values come back as raw
// strings (or null); type coercion happens in transform.ts.
export function parseInserts(sql: string): InsertStmt[] {
  const out: InsertStmt[] = [];
  const re = /INSERT INTO `(\w+)`\s*\(([^)]*)\)\s*VALUES\s*/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    const table = m[1];
    const columns = m[2].split(",").map((c) => c.trim().replace(/`/g, ""));
    const { rows, end } = readTuples(sql, re.lastIndex);
    out.push({ table, columns, rows });
    re.lastIndex = end;
  }
  return out;
}

function readTuples(s: string, i: number): { rows: Array<Array<string | null>>; end: number } {
  const rows: Array<Array<string | null>> = [];
  const n = s.length;
  while (i < n) {
    while (i < n && /\s/.test(s[i])) i++;
    if (s[i] !== "(") break;
    i++; // past '('
    const row: Array<string | null> = [];
    while (i < n) {
      while (i < n && /\s/.test(s[i])) i++;
      if (s[i] === "'") {
        let v = ""; i++;
        while (i < n) {
          const ch = s[i];
          if (ch === "\\") { v += s[i + 1]; i += 2; continue; }
          if (ch === "'") { i++; break; }
          v += ch; i++;
        }
        row.push(v);
      } else {
        let tok = "";
        while (i < n && s[i] !== "," && s[i] !== ")") { tok += s[i]; i++; }
        tok = tok.trim();
        row.push(tok === "NULL" ? null : tok);
      }
      while (i < n && /\s/.test(s[i])) i++;
      if (s[i] === ",") { i++; continue; }
      if (s[i] === ")") { i++; break; }
    }
    rows.push(row);
    while (i < n && /\s/.test(s[i])) i++;
    if (s[i] === ",") { i++; continue; }
    if (s[i] === ";") { i++; break; }
  }
  return { rows, end: i };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @cl/db test -- --run test/parse.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/db/etl/parse.ts packages/db/test/parse.test.ts packages/db/test/fixtures/sample.sql
git commit -m "feat(db): tolerant MySQL extended-INSERT parser"
```

---

## Task 13: ETL transforms — values + column-name mapping

**Files:**
- Create: `packages/db/etl/columnTypes.ts`
- Create: `packages/db/etl/transform.ts`
- Create: `packages/db/test/transform.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/db/test/transform.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { transformRow } from "../etl/transform.ts";

describe("transformRow", () => {
  it("maps columns to snake_case and renames reserved `default`", () => {
    const r = transformRow("condominium",
      ["id", "name", "default", "created"],
      ["1", "Saturno", "1", "2011-01-01 00:00:00"]);
    expect(Object.keys(r)).toEqual(["id", "name", "is_default", "created"]);
  });
  it("coerces tinyint(1) columns to booleans", () => {
    const r = transformRow("condominium", ["id", "default"], ["1", "0"]);
    expect(r.is_default).toBe(false);
  });
  it("converts datetime to an ISO UTC string (Europe/Rome source)", () => {
    const r = transformRow("condominium", ["id", "created"], ["1", "2011-01-01 00:00:00"]);
    // 2011-01-01 00:00 Europe/Rome (CET, +01:00) === 2010-12-31T23:00:00Z
    expect(r.created).toBe("2010-12-31T23:00:00.000Z");
  });
  it("passes NULL through", () => {
    const r = transformRow("condominium", ["id", "created"], ["1", null]);
    expect(r.created).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @cl/db test -- --run test/transform.test.ts`
Expected: FAIL — `etl/transform.ts` missing.

- [ ] **Step 3: Implement `columnTypes.ts` + `transform.ts`**

`columnTypes.ts` declares which legacy columns are boolean / datetime, keyed by legacy table+column.
Booleans = the 24 `tinyint(1)` columns; datetimes = the 190 `datetime` columns. Derive both lists
mechanically from the DDL once and inline them:
`grep -nE '`\w+` tinyint\(1\)' old/db/it-jtime-condominium.structure.sql` and the `datetime` analogue,
attributing each to its enclosing `CREATE TABLE`. Shape:
```ts
// columnTypes.ts
export const BOOL_COLUMNS: Record<string, Set<string>> = {
  condominium: new Set([/* tinyint(1) cols of condominium */]),
  accountingPeriodInstallmentDefaultSettings: new Set(["default", /* ... */]),
  // ...all tables with tinyint(1) columns
};
export const DATETIME_COLUMNS: Record<string, Set<string>> = {
  condominium: new Set(["created", "updated", /* ... */]),
  // ...all tables with datetime columns
};
```

`transform.ts`:
```ts
import { toSnake } from "../src/naming.ts";
import { BOOL_COLUMNS, DATETIME_COLUMNS } from "./columnTypes.ts";

// 'YYYY-MM-DD HH:MM:SS' interpreted as Europe/Rome -> ISO UTC.
function romeToUtcIso(s: string): string {
  // Europe/Rome offset: CEST (+02:00) late Mar–late Oct, else CET (+01:00).
  const [d, t] = s.split(" ");
  const [Y, Mo, Da] = d.split("-").map(Number);
  const [H, Mi, Se] = t.split(":").map(Number);
  const offsetH = isCEST(Y, Mo, Da, H) ? 2 : 1;
  const ms = Date.UTC(Y, Mo - 1, Da, H - offsetH, Mi, Se);
  return new Date(ms).toISOString();
}
function isCEST(Y: number, Mo: number, Da: number, _H: number): boolean {
  // DST: last Sunday of March 01:00 UTC .. last Sunday of October 01:00 UTC.
  const lastSun = (y: number, m: number) => {
    const d = new Date(Date.UTC(y, m, 0)); // last day of month m (1-based -> day 0 of next)
    return d.getUTCDate() - d.getUTCDay();
  };
  const startDay = lastSun(Y, 3), endDay = lastSun(Y, 10);
  const after = (mo: number, da: number, bMo: number, bDa: number) =>
    mo > bMo || (mo === bMo && da >= bDa);
  return after(Mo, Da, 3, startDay) && !after(Mo, Da, 10, endDay);
}

const renameCol = (table: string, col: string): string =>
  col === "default" ? "is_default" : toSnake(col);

export function transformRow(
  table: string, columns: string[], values: Array<string | null>,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  const bools = BOOL_COLUMNS[table];
  const dates = DATETIME_COLUMNS[table];
  columns.forEach((col, i) => {
    const key = renameCol(table, col);
    const v = values[i];
    if (v === null) { out[key] = null; return; }
    if (bools?.has(col)) { out[key] = v === "1" || v === "true"; return; }
    if (dates?.has(col)) { out[key] = romeToUtcIso(v); return; }
    out[key] = v; // strings/numerics passed as text; pg coerces on insert
  });
  return out;
}
```

> **Note:** the DST window edge-cases (the two ambiguous hours per year) are not worth special-casing
> for migration data; the approximation above is correct except within those two hours. If a fixture
> lands there, document it. (This is acceptable for Module 0; characterization in Module 4 keys off
> dates, not sub-hour times.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @cl/db test -- --run test/transform.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/db/etl/columnTypes.ts packages/db/etl/transform.ts packages/db/test/transform.test.ts
git commit -m "feat(db): ETL value transforms (bool, datetime→UTC, reserved-word rename)"
```

---

## Task 14: Bank FK-closure (avoid the 44M registry)

Compute the **referenced** `bank`/`bankBranch` ids from the two condominiums' bank accounts, so Tier A
loads only those branch rows. This is the spec's top risk (§7) — spike it first.

**Files:**
- Create: `packages/db/etl/bankClosure.ts`
- Create: `packages/db/test/bankClosure.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/db/test/bankClosure.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { referencedBankBranchIds } from "../etl/bankClosure.ts";
import { parseInserts } from "../etl/parse.ts";

// bankAccount rows reference bank_branch via a branch id column.
const fixture = `
INSERT INTO \`bankAccount\` (\`id\`,\`bankBranchId\`) VALUES (1,500),(2,500),(3,777);
`;

describe("referencedBankBranchIds", () => {
  it("returns the distinct branch ids used by bank accounts", () => {
    const stmts = parseInserts(fixture);
    const ids = referencedBankBranchIds(stmts, "bankAccount", "bankBranchId");
    expect([...ids].sort()).toEqual(["500", "777"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @cl/db test -- --run test/bankClosure.test.ts`
Expected: FAIL — `etl/bankClosure.ts` missing.

- [ ] **Step 3: Implement `bankClosure.ts`**

`packages/db/etl/bankClosure.ts`:
```ts
import type { InsertStmt } from "./parse.ts";

/** Distinct non-null values of `fkColumn` across all rows of `table`. */
export function referencedBankBranchIds(
  stmts: InsertStmt[], table: string, fkColumn: string,
): Set<string> {
  const ids = new Set<string>();
  for (const s of stmts) {
    if (s.table !== table) continue;
    const idx = s.columns.indexOf(fkColumn);
    if (idx < 0) continue;
    for (const row of s.rows) {
      const v = row[idx];
      if (v !== null && v !== "0") ids.add(v);
    }
  }
  return ids;
}

/** Filter bankBranch INSERT rows down to the referenced ids (+ their banks). */
export function filterReferenced(
  branchStmts: InsertStmt[], branchIdCol: string, keep: Set<string>,
): InsertStmt[] {
  return branchStmts.map((s) => {
    const idx = s.columns.indexOf(branchIdCol);
    return { ...s, rows: idx < 0 ? s.rows : s.rows.filter((r) => keep.has(r[idx] ?? "")) };
  });
}
```

> **Spike note:** confirm the real FK column name on `bankAccount` (likely `bankBranchId`) via
> `awk '/CREATE TABLE `bankAccount`/,/;/' old/db/it-jtime-condominium.structure.sql`. If the two
> condominiums reference no bank branches at all (possible for a small sample), Tier A skips
> bank/bankBranch entirely and the row-count test asserts 0 — that is a valid outcome, not a failure.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @cl/db test -- --run test/bankClosure.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/etl/bankClosure.ts packages/db/test/bankClosure.test.ts
git commit -m "feat(db): bank/bankBranch FK-closure (avoid 44M registry load)"
```

---

## Task 15: The loader — replica-mode bulk insert + sequence resync

**Files:**
- Create: `packages/db/etl/load.ts`
- Create: `packages/db/test/load.test.ts` (integration)

- [ ] **Step 1: Write the failing integration test**

`packages/db/test/load.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { makePool } from "../src/db.ts";
import { loadTable, resyncSequence } from "../etl/load.ts";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

d("loader", () => {
  const pool = makePool(url);
  beforeAll(async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS _l_demo (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name text, created timestamptz)`);
    await pool.query(`TRUNCATE _l_demo RESTART IDENTITY`);
  });
  afterAll(async () => { await pool.query(`DROP TABLE IF EXISTS _l_demo`); await pool.end(); });

  it("loads explicit ids under replica mode, then resync allows fresh insert", async () => {
    const client = await pool.connect();
    try {
      await client.query(`SET session_replication_role = 'replica'`);
      await loadTable(client, "_l_demo",
        [{ id: 5, name: "five", created: "2001-01-01T00:00:00.000Z" },
         { id: 9, name: "nine", created: null }]);
      await client.query(`SET session_replication_role = 'origin'`);
      await resyncSequence(client, "_l_demo", "id");
    } finally { client.release(); }

    const after = await pool.query(`INSERT INTO _l_demo (name) VALUES ('ten') RETURNING id`);
    expect(after.rows[0].id).toBe(10); // max(9)+1
    const five = await pool.query(`SELECT created FROM _l_demo WHERE id=5`);
    expect(new Date(five.rows[0].created).toISOString()).toBe("2001-01-01T00:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `DATABASE_URL=... pnpm --filter @cl/db test -- --run test/load.test.ts`
Expected: FAIL — `etl/load.ts` missing.

- [ ] **Step 3: Implement `load.ts`**

`packages/db/etl/load.ts`:
```ts
import type { PoolClient } from "pg";

type Row = Record<string, string | number | boolean | null>;

export async function loadTable(client: PoolClient, table: string, rows: Row[]): Promise<void> {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(",");
  // batch in chunks to keep parameter count under pg's 65535 limit
  const perRow = cols.length;
  const maxRows = Math.max(1, Math.floor(60000 / perRow));
  for (let start = 0; start < rows.length; start += maxRows) {
    const chunk = rows.slice(start, start + maxRows);
    const params: Array<string | number | boolean | null> = [];
    const tuples = chunk.map((r) => {
      const ph = cols.map((c) => { params.push(r[c]); return `$${params.length}`; });
      return `(${ph.join(",")})`;
    });
    await client.query(
      `INSERT INTO "${table}" (${colList}) OVERRIDING SYSTEM VALUE VALUES ${tuples.join(",")}`,
      params,
    );
  }
}

export async function resyncSequence(client: PoolClient, table: string, idCol = "id"): Promise<void> {
  await client.query(
    `SELECT setval(
       pg_get_serial_sequence($1, $2),
       COALESCE((SELECT max("${idCol}") FROM "${table}"), 1),
       (SELECT count(*) > 0 FROM "${table}"))`,
    [table, idCol],
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `DATABASE_URL=... pnpm --filter @cl/db test -- --run test/load.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/etl/load.ts packages/db/test/load.test.ts
git commit -m "feat(db): replica-mode bulk loader + sequence resync"
```

---

## Task 16: The seed orchestrator (Tier A → B → C)

Wire parse → transform → load across the three tiers into the `seed` entrypoint.

**Files:**
- Create: `packages/db/etl/sources.ts`
- Create: `packages/db/etl/order.ts`
- Create: `packages/db/etl/index.ts`
- Create: `packages/db/test/order.test.ts`

- [ ] **Step 1: Write the failing test (load order is deterministic + complete)**

`packages/db/test/order.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { LOAD_ORDER } from "../etl/order.ts";

describe("LOAD_ORDER", () => {
  it("places reference parents before operational children", () => {
    expect(LOAD_ORDER.indexOf("studio")).toBeLessThan(LOAD_ORDER.indexOf("masterData"));
    expect(LOAD_ORDER.indexOf("condominium")).toBeLessThan(LOAD_ORDER.indexOf("unit"));
    expect(LOAD_ORDER.indexOf("unit")).toBeLessThan(LOAD_ORDER.indexOf("unitPeriod"));
    expect(LOAD_ORDER.indexOf("unitPeriod")).toBeLessThan(LOAD_ORDER.indexOf("unitResident"));
  });
  it("has no duplicates", () => {
    expect(new Set(LOAD_ORDER).size).toBe(LOAD_ORDER.length);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @cl/db test -- --run test/order.test.ts`
Expected: FAIL — `etl/order.ts` missing.

- [ ] **Step 3: Implement `sources.ts`, `order.ts`, `index.ts`**

`order.ts` — best-effort parents-first order (legacy table names); cycles are tolerated because the
load runs under replica mode (FKs not enforced until the post-load verification):
```ts
export const LOAD_ORDER: string[] = [
  // Tier A (reference)
  "country", "locale", "state", "district", "minorCivilDivision", "city",
  "bank", "bankBranch",
  // Tier B (studio + master data)
  "studio", "masterDataCategory", "masterData", "person", "company",
  "personVariation", "companyVariation", "masterDataVariation", "accessAccount", "qualification",
  // Tier C (operational)
  "condominium", "unitOwnershipScenario", "unitResidentPriority", "unitType",
  "accountingPeriod", "accountingPeriodInstallmentDefaultSettings",
  "unitGroup", "unit", "unitPeriod", "unitResident", "condominiumSupplier",
  "ledgerAccount", "expenseLedgerAccount", "expenseLA2Role", "expenseLA2Table",
  "distributionTable", "distributionTableItem",
  "ledgerTransaction", "ledgerEntry", "ledgerInvoice",
  "installmentGroup", "installment", "installmentItem",
  "withholdingTax", "taxRelief", "bankAccount", "consumptionMeter", "unitResidentAccount",
];
```

`sources.ts` — map each table to the dump file(s) it is read from:
```ts
const DB = new URL("../../../old/db/", import.meta.url); // repo old/db from packages/db/etl
export const FILES = {
  saturnoOnly: new URL("it-jtime-condominium-saturno-only.data.sql", DB),
  pozzettoOnly: new URL("it-jtime-condominium-pozzetto-only.data.sql", DB),
  full: new URL("it-jtime-condominium.data.sql", DB),
  reference: new URL("it-jtime-condominium - data - country, locale, localeI18n.sql", DB),
  bank: new URL("bank.sql", DB),
  bankBranch: new URL("bankBranch.sql", DB),
};
// Which tier each table belongs to → which file(s) to read it from.
export const TIER_A = new Set(["country","locale","state","district","minorCivilDivision","city","bank","bankBranch"]);
export const TIER_C = new Set(["condominium","condominiumSupplier","accountingPeriod","accountingPeriodInstallmentDefaultSettings","unit","unitGroup","unitPeriod","unitResident","distributionTable","distributionTableItem","expenseLedgerAccount","expenseLA2Role","expenseLA2Table","ledgerAccount","ledgerTransaction","ledgerEntry","ledgerInvoice","installment","installmentItem"]);
// everything else in LOAD_ORDER = Tier B (from `full`)
```

`index.ts` — the orchestrator:
```ts
import { readFileSync } from "node:fs";
import { makePool } from "../src/db.ts";
import { parseInserts, type InsertStmt } from "./parse.ts";
import { transformRow } from "./transform.ts";
import { loadTable, resyncSequence } from "./load.ts";
import { referencedBankBranchIds, filterReferenced } from "./bankClosure.ts";
import { LOAD_ORDER } from "./order.ts";
import { FILES, TIER_A, TIER_C } from "./sources.ts";

function read(u: URL): InsertStmt[] { return parseInserts(readFileSync(u, "utf8")); }
const byTable = (s: InsertStmt[], t: string) => s.filter((x) => x.table === t);

async function main() {
  const pool = makePool();
  const client = await pool.connect();

  // Pre-read operational dumps (Tier C) — both condominiums.
  const opStmts = [...read(FILES.saturnoOnly), ...read(FILES.pozzettoOnly)];
  // Bank closure from operational bank accounts.
  const branchIds = referencedBankBranchIds(opStmts, "bankAccount", "bankBranchId");

  try {
    await client.query("BEGIN");
    await client.query("SET session_replication_role = 'replica'");

    for (const table of LOAD_ORDER) {
      let stmts: InsertStmt[];
      if (TIER_C.has(table)) stmts = byTable(opStmts, table);
      else if (table === "bankBranch")
        stmts = filterReferenced(read(FILES.bankBranch), "id", branchIds);
      else if (table === "bank") stmts = read(FILES.bank);
      else if (TIER_A.has(table)) stmts = byTable(read(FILES.reference), table);
      else stmts = byTable(read(FILES.full), table); // Tier B
      const rows = stmts.flatMap((s) => s.rows.map((r) => transformRow(s.table, s.columns, r)));
      if (rows.length) {
        await loadTable(client, /* snake */ require("../src/naming.ts").toSnake(table), rows);
        console.log(`loaded ${rows.length} into ${table}`);
      }
    }

    await client.query("SET session_replication_role = 'origin'");
    for (const table of LOAD_ORDER)
      await resyncSequence(client, (await import("../src/naming.ts")).toSnake(table), "id");
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK"); throw e;
  } finally { client.release(); await pool.end(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
```

> **Fix the `require` mix:** use the ESM import at top — `import { toSnake } from "../src/naming.ts";`
> — and call `toSnake(table)` in both the load and resync loops (the `require(...)` shown above is a
> placeholder to be replaced with the top-level import; do not ship `require` in an ESM module).

- [ ] **Step 4: Run the order test + a dry seed**

Run: `pnpm --filter @cl/db test -- --run test/order.test.ts`
Expected: PASS.
Then full pipeline: `pnpm --filter @cl/db db:down && pnpm --filter @cl/db db:up && DATABASE_URL=... pnpm --filter @cl/db migrate && DATABASE_URL=... pnpm --filter @cl/db seed`
Expected: console logs "loaded N into <table>" with no errors; process exits 0.

- [ ] **Step 5: Commit**

```bash
git add packages/db/etl/sources.ts packages/db/etl/order.ts packages/db/etl/index.ts packages/db/test/order.test.ts
git commit -m "feat(db): seed orchestrator — three-tier ETL (A→B→C) under replica mode"
```

---

## Task 17: Verification suite — row counts, FK integrity, enum domains, sequences

The Module-0 success bar (spec §1.4, §5). Run after migrate + seed.

**Files:**
- Create: `packages/db/etl/expectedCounts.ts`
- Create: `packages/db/test/rowCounts.test.ts` (integration)
- Create: `packages/db/test/fkIntegrity.test.ts` (integration)
- Create: `packages/db/test/enumDomains.test.ts` (integration)

- [ ] **Step 1: Write the failing tests**

`packages/db/etl/expectedCounts.ts` — counts parsed from the source dumps (single source of truth for
"how many rows should exist"):
```ts
import { readFileSync } from "node:fs";
import { parseInserts } from "./parse.ts";
import { FILES } from "./sources.ts";
import { toSnake } from "../src/naming.ts";

// Count rows for an operational (Tier C) table across both condominium dumps.
export function expectedOperationalCounts(): Record<string, number> {
  const stmts = [...parseInserts(readFileSync(FILES.saturnoOnly, "utf8")),
                 ...parseInserts(readFileSync(FILES.pozzettoOnly, "utf8"))];
  const counts: Record<string, number> = {};
  for (const s of stmts) counts[toSnake(s.table)] = (counts[toSnake(s.table)] ?? 0) + s.rows.length;
  return counts;
}
```

`packages/db/test/rowCounts.test.ts`:
```ts
import { describe, it, expect, afterAll } from "vitest";
import { makePool } from "../src/db.ts";
import { expectedOperationalCounts } from "../etl/expectedCounts.ts";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

d("row-count parity (operational tables)", () => {
  const pool = makePool(url);
  afterAll(() => pool.end());
  const expected = expectedOperationalCounts();
  for (const [table, n] of Object.entries(expected)) {
    it(`${table} has ${n} rows`, async () => {
      const r = await pool.query(`SELECT count(*)::int c FROM "${table}"`);
      expect(r.rows[0].c).toBe(n);
    });
  }
});
```

`packages/db/test/fkIntegrity.test.ts`:
```ts
import { describe, it, expect, afterAll } from "vitest";
import { makePool } from "../src/db.ts";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

d("FK integrity", () => {
  const pool = makePool(url);
  afterAll(() => pool.end());
  it("has zero orphan rows across all foreign keys", async () => {
    // For each FK, count child rows whose non-null FK value has no parent.
    const fks = await pool.query(`
      SELECT tc.table_name AS child, kcu.column_name AS col,
             ccu.table_name AS parent, ccu.column_name AS pcol
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name
      WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'`);
    const offenders: string[] = [];
    for (const fk of fks.rows) {
      const q = `SELECT count(*)::int c FROM "${fk.child}" ch
        WHERE ch."${fk.col}" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "${fk.parent}" p WHERE p."${fk.pcol}" = ch."${fk.col}")`;
      const r = await pool.query(q);
      if (r.rows[0].c > 0) offenders.push(`${fk.child}.${fk.col} -> ${fk.parent} (${r.rows[0].c})`);
    }
    expect(offenders).toEqual([]);
  });
});
```

`packages/db/test/enumDomains.test.ts`:
```ts
import { describe, it, expect, afterAll } from "vitest";
import { makePool } from "../src/db.ts";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

d("enum domains", () => {
  const pool = makePool(url);
  afterAll(() => pool.end());
  it("rejects an out-of-domain ledger_account.type", async () => {
    await expect(
      pool.query(`INSERT INTO ledger_account (type) VALUES ('bogus')`),
    ).rejects.toThrow(/invalid input value for enum/i);
  });
});
```

- [ ] **Step 2: Run to verify they fail (pre-seed) / pass (post-seed)**

Run (clean cycle): `pnpm --filter @cl/db db:down && pnpm --filter @cl/db db:up && DATABASE_URL=... pnpm --filter @cl/db migrate && DATABASE_URL=... pnpm --filter @cl/db seed && DATABASE_URL=... pnpm --filter @cl/db test -- --run test/rowCounts.test.ts test/fkIntegrity.test.ts test/enumDomains.test.ts`
Expected at first: row-count or FK failures reveal real bugs (missing columns, wrong load order,
unreferenced branch rows). **Fix the schema/ETL, not the tests.** Iterate the clean cycle until green.

- [ ] **Step 3: (fixes happen in earlier files as needed — no new code here beyond expectedCounts.ts)**

- [ ] **Step 4: Confirm all three suites pass**

Expected: every operational table's count matches; `offenders` is empty (all 249 FKs clean for loaded
data); out-of-domain enum insert is rejected.

- [ ] **Step 5: Commit**

```bash
git add packages/db/etl/expectedCounts.ts packages/db/test/rowCounts.test.ts packages/db/test/fkIntegrity.test.ts packages/db/test/enumDomains.test.ts
git commit -m "test(db): verification — row-count parity, FK integrity, enum domains"
```

---

## Task 18: README + one-command rebuild + full green run

**Files:**
- Create: `packages/db/README.md`
- Modify: `packages/db/package.json` (add a `rebuild` convenience script)

- [ ] **Step 1: Add the rebuild script**

In `packages/db/package.json` scripts, add:
```json
"rebuild": "pnpm db:down && pnpm db:up && sleep 3 && pnpm migrate && pnpm seed"
```

- [ ] **Step 2: Write `README.md`**

`packages/db/README.md` documents: prerequisites (Docker), `.env` setup, the four commands
(`db:up`, `migrate`, `seed`, `test`), the `rebuild` one-shot, the three data tiers, what verification
proves, and the explicit Module-0 boundary (no backend; characterization deferred to Module 4). Include
the snake_case↔camelCase note and the `session_replication_role='replica'` rationale.

- [ ] **Step 3: Full clean run — unit + integration**

Run:
```bash
pnpm --filter @cl/db rebuild
DATABASE_URL=postgres://condo:condo@localhost:5432/condo pnpm --filter @cl/db test -- --run
pnpm --filter @cl/db typecheck
pnpm -r typecheck
```
Expected: all unit + integration tests pass; typecheck clean across the workspace.

- [ ] **Step 4: Confirm the success criteria (spec §1.4)**

- migrate builds on empty DB ✓ (Task 10)
- seed loads with row-count diff 0 ✓ (Task 17)
- all FKs validate ✓ (Task 17)
- enum domains enforced; sequences resynced ✓ (Tasks 17, 15)
- no drift ✓ (Task 11)

- [ ] **Step 5: Commit**

```bash
git add packages/db/README.md packages/db/package.json
git commit -m "docs(db): README + one-command rebuild; Module 0 complete"
```

---

## Plan Self-Review

**Spec coverage:**
- §1.2 Drizzle schema source of truth → Tasks 4–8. drizzle-kit migrations → Task 10. Node ETL → Tasks 12–16. naming mapper → Task 2. Structural verification → Tasks 10, 11, 17. Docker → Task 1. ✓
- §1.3 out of scope (no backend/auth/characterization) → honored; only `@cl/db`. ✓
- §1.4 success criteria → Task 18 Step 4 maps each criterion to a task. ✓
- §3.1 snake_case + inverse map → Task 2. Reserved word `default`→`is_default` → Tasks 4(rule), 7(schema), 13(transform). ✓
- §3.2 types: tinyint→bool, datetime→timestamptz, decimal→numeric, 23 named enums → Tasks 3, 4-rules, 13. ✓
- §3.3 identity + sequence resync → Tasks 4(rule), 15. ✓
- §3.4 188→1 trigger → Tasks 9, 10. ✓
- §3.5 functions→TS (not DB), 6 views as plain views, drop codeIgniterSession → Task 8 (drop), Task 10 (views); functions deferred-to-TS is explicitly noted (no DB function task), matching the spec. ✓
- §4 three-tier ETL + FK-closure for bankBranch → Tasks 14, 16. ✓
- §5 verification → Task 17 (+10, 11). ✓
- §6 layout → matches File Structure. ✓
- §7 risks (bank closure spiked first; datetime tz; unsigned checks dropped per YAGNI; master-data closure; naming acronyms) → Tasks 14, 13, 4-rules, 5, 2. ✓

**Placeholder scan:** One intentional placeholder was introduced and then explicitly corrected in
Task 16 (the `require(...)` → top-level `toSnake` import note). The schema tasks use a documented
"author remaining columns from the DDL" instruction rather than inlining 94 full table bodies — this is
the deliberate DRY pattern (rule set + worked example), with the column cross-check called out as the
guard the automated tests can't provide. No `TBD`/`TODO` remain.

**Type consistency:** `transformRow(table, columns, values)`, `parseInserts → InsertStmt{table,columns,rows}`,
`loadTable(client, table, rows)`, `resyncSequence(client, table, idCol)`, `toSnake/toCamel`,
`referencedBankBranchIds/filterReferenced`, `LOAD_ORDER`, `expectedOperationalCounts` — names are used
consistently across Tasks 12–17. Enum export identifiers in Task 3 match their uses in Tasks 4–8. ✓
