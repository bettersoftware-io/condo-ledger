# Full Legacy Dataset → Prototype — Design

**Date:** 2026-06-13
**Status:** Approved (design); spec under review
**Branch:** `feat/full-legacy-data`

## Goal

Replace the prototype's hand-written sample fixtures with the **complete, real**
dataset projected from the legacy MySQL dump `old/db/it-jtime-condominium.all.sql`,
so every Condomini section, the Calendario, and the Anagrafiche module display the
full set of buildings, units, residents, accounts, transactions, distribution
tables, installments and master-data — with the accounting reproduced **faithfully**
and every shipped condominium's books **reconciled**.

## Constraints & context

- **No live Postgres / backend.** The web app reads from an in-memory `MockStore`
  (an adapter behind the `MockDataSource` port). This work stays entirely within
  that architecture: it produces a static seed; it does **not** add a server.
- **Reuse `@cl/db`'s ETL parser.** `packages/db/etl/{parse,ddl,transform}.ts` are
  pure functions that already handle these column-less `mysqldump` extended INSERTs
  (DDL-derived column order + type coercion). No DB connection required.
- **The `.all.sql` file is self-contained** — it holds both the `CREATE TABLE`
  structure and the data, so one file feeds both DDL resolution and rows.
- **A recompute layer already exists** at `apps/web/src/recompute/`
  (`distribution`, `installments`, `balances`, `summary`, `dates`). Generated seed
  data must be consistent with it: the seed is the *initial state*; user mutations
  in the running app recompute from it exactly as they do today.

## Decisions (from brainstorming)

1. **Delivery:** static generated seed feeding `MockStore` (offline, no infra).
2. **Scope/fidelity:** complete lists **and full-fidelity accounting** — ledger
   accounts, installments, and distribution amounts are the core and must be exact.
3. **Fixtures:** the generated data **replaces** the curated sample as the app seed.
4. **Inclusion gate:** a condominium ships **only if all its periods reconcile**;
   test/empty/junk condominiums are excluded.
5. **Output format:** `data.generated.json` + a thin typed loader.

## Legacy accounting model (verified against the dump)

- **Double entry, single signed amount.** `ledgerEntry.amount` is one signed
  decimal; the entries of a transaction net to zero. Per posting account:
  `dare = Σ positive`, `avere = Σ |negative|`, `saldo = Σ signed`. Accounts form a
  tree via `parentLedgerAccountId`; balances roll up the tree. `ledgerAccount.name`
  is on the row (no i18n join needed for accounts).
- **Per-unit amounts live on `ledgerEntry`** via `unitResidentId` + `type`
  (`enum('startingBalance','individualExpense','unitResidentTakings')`). The side
  table `ledgerEntry2URDistribution` is **empty** in this dump and is not used.
  Per unit-resident:
  - `saldoPrec` = Σ entries with `type='startingBalance'`
  - `consuntivo` (actual charged) = Σ `type='individualExpense'`
  - `versato` (paid in) = Σ `type='unitResidentTakings'`
- **Installments are materialized.** `installmentItem.amount` (+ `status`
  `enum('issued','incomplete','settled','neutralized')`) per `unitResidentId` per
  `installment`. Read directly into the Rate view.
- **Distribution tables** = `distributionTable` (name, `restrictionUnitGroupId`) +
  `distributionTableItem` (`unitId`, `coefficient`). Table total = Σ coefficients.
- **Estimate (`preventivo`) distribution is the one computed path:**
  `expenseLedgerAccount.estimate × (coefficient ÷ table-total) × role%`, where
  the table linkage is `expenseLA2Table` (account→table, with `percentage`) and the
  owner/tenant split is `expenseLA2Role` (`unitResidentPriorityId`, `percentage`).
- **Reconciliation:** for each period the trial balance must net to 0
  (`Σ ledgerEntry.amount == 0`), and the distributed totals must tie to expense
  totals. Periods/condominiums that fail are excluded and logged.

## Architecture & components

```
old/db/it-jtime-condominium.all.sql
        │  (reuse @cl/db: parseDdl, parseInserts, makeTransform)
        ▼
apps/web/tools/
  generate-data.ts          ← entry: parse → project → reconcile → emit JSON
  parse/
    rows.ts                 ← thin wrapper over @cl/db parser → typed table maps
    addressVO.ts            ← PHP-serialized AddressVO unserializer
    i18n.ts                 ← it-IT *I18n join helper (categories, unit types)
  project/
    condominiums.ts         ← condominium + accountingPeriod → CondominiumNode[]
    units.ts                ← unit/unitPeriod/unitResident → UnitRow trees (+ money)
    accounting.ts           ← ledgerAccount/Entry/Transaction → accounts tree + txns
    distribution.ts         ← distributionTable(+Item) + expense* → tables + amounts
    installments.ts         ← installment/installmentItem → InstallmentColumn/Row
    anagrafiche.ts          ← masterData/person/company/category → Anagrafica[]
    calendar.ts             ← calendarEvent/calendarLayer → CalendarEvent[]/Layer[]
    f24.ts, suppliers.ts, detail.ts
  reconcile.ts              ← trial-balance + distribution tie-out gate
        ▼
apps/web/src/mock/
  data.generated.json       ← committed seed (numbers as integer cents)
  data.generated.ts         ← thin typed loader: import JSON → MockStoreSeed
  fixtures.ts               ← trimmed to a SMALL deterministic test seed
```

### Wiring seam

`MockStore` currently reads `import * as fx from "./fixtures"` at field
initialization. Change it to accept an injected seed:

- Define `MockStoreSeed` = the bundle of all seed values (`tree`,
  `detailByPeriod`, `unitsByPeriod`, `distributionTablesByPeriod`,
  `distributionByPeriod`, `ledgerAccountsByPeriod`, `ledgerTxnsByPeriod`,
  `installmentsByPeriod`, `f24sByPeriod`, `functionalByPeriod`, `calendarLayers`,
  `calendarEvents`, `anagraficaCategories`, `anagrafiche`).
- `constructor(seed: MockStoreSeed = fixtures)` — every BehaviorSubject seeds from
  `seed.*`. Existing tests that do `new MockStore()` keep working against the
  trimmed fixtures (deterministic, fast). `App`/runtime composition root injects
  `dataGeneratedSeed` so the running app shows the full dataset.

No changes to the `MockDataSource`/`AppRuntime` ports, the runtime streams, the
recompute layer, or any component. Same DTOs, more rows.

### Anagrafiche cross-references (fidelity upgrade)

Today `anagraficaLinks` matches suppliers/condòmini by string. With real data the
generator can emit true links from `condominiumSupplier.masterDataId` and
`unitResident → masterData` FKs. The runtime keeps deriving links, but over data
that now carries real ids, removing the string-match fragility noted in prior work.

## Data flow

1. Read the dump once; `parseDdl` → column order; `parseInserts(resolveColumns)` →
   positional rows; `makeTransform` → typed, renamed row objects keyed by table.
2. Index rows by primary/foreign keys into in-memory maps.
3. Project per condominium → per accounting period into the app DTOs (modules above).
4. Reconcile each period; collect the set of fully-reconciling condominiums.
5. Emit `data.generated.json` for the surviving condominiums (cents as integers),
   plus a generation report (counts, excluded condominiums + reasons) to stdout.

## Error handling

- **Unparseable AddressVO** → fall back to whatever textual parts are present;
  never throw (a bad address must not drop a building).
- **Missing i18n row** → fall back to the base `name`/identifier.
- **Non-reconciling period** → exclude its condominium, log the discrepancy
  (period id, expected 0 vs actual trial-balance sum); never emit imperfect numbers.
- **Generator is fail-loud on structural errors** (e.g. unknown enum value, FK to a
  missing parent) so data drift surfaces at generation time, not in the UI.

## Testing

- **Generator units:** AddressVO parser (representative blobs incl. `streetNumber`,
  null city); signed-amount aggregation (dare/avere/saldo); reconciliation on
  crafted balanced **and** deliberately unbalanced fixtures (gate must reject the
  latter); estimate-distribution math on a small known table.
- **Generator smoke test (against the real dump):** produces ≥1 reconciled
  condominium; every accounting period resolves to a parent condominium; no orphaned
  unit/account/entry references; every anagrafica `categoria` exists in the category
  registry; trial balance is 0 for every emitted period.
- **App tests unchanged:** `MockStore.test`/`runtime.test`/section tests run against
  the **trimmed `fixtures.ts`** seed (default constructor), so counts stay stable.
- **Committed JSON:** `data.generated.json` is committed so build/CI never need the
  48 MB dump. Regeneration is a documented script: `pnpm --filter @cl/web gen:data`.

## Residual risks (accepted)

- **Estimate (`preventivo`) distribution** is the only computed path; legacy
  owner/tenant role-split edge cases (`expenseLA2Role`) are pinned by the
  distribution tie-out in the reconciliation gate — a building whose estimate
  distribution doesn't tie is excluded rather than shown wrong.
- **Address city names** require a `city`/`cityI18n` join; treated as a stretch.
  Street + post code are always available; city name resolved when present in the
  blob, otherwise omitted.
- **Fewer condominiums than the raw count** may ship, by design — only reconciling
  books appear.

## Out of scope

- Any live backend / HTTP adapter / Postgres wiring (separate migration track).
- Reproducing legacy views with no clean source in these tables (e.g. stored
  public/private document lists) — left empty.
- City-name geocoding beyond the optional `cityI18n` join.
