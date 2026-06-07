# Migration Overview — CondoLedger (Stage 1: faithful recreation)

> **Status:** Design / spec (umbrella). Approved direction; per-module specs derive from this.
> **Date:** 2026-06-07
> **Scope of this document:** the *program*. It defines the target architecture, stack, cross-cutting
> concerns, database-migration strategy, and the decomposition into per-module specs. Each module gets
> its own spec → plan → build cycle. The first two derived specs are
> [`2026-06-07-prototype-design.md`](./2026-06-07-prototype-design.md) and (next) the DB-migration spec.

---

## 1. Goal & scope

### 1.1 Stage-1 goal
Recreate the legacy **Adobe Flex + PHP/WebORB + MySQL** condominium-management application
("AMMINISTRAZIONE CONDOMINI" by *Just In Time*) **almost exactly** — same functionality, same
information architecture, same screen layouts and data density — on a new stack: **React + Node +
PostgreSQL**. We reuse the legacy database (schema + data + relations + the business rules encoded in
it) converted to PostgreSQL.

This is a **like-for-like migration**, not a redesign. We modernize the *implementation* and the
*visual styling*, but preserve *behavior* and *layout*. The product will evolve from this baseline in
later stages (see §11).

### 1.2 In scope (the 3 core admin modules the live app shell exposes)
- **Calendario** — month calendar of accounting/condominium events.
- **Condomini** — the core. Per accounting period, six sections:
  1. Dati Condominio & Fornitori (building data + suppliers)
  2. Unità, Condòmini & Bilancio Personale (units, residents, personal balances)
  3. Tabelle Millesimali & Riparto (distribution tables / *millesimi* + expense allocation)
  4. Conti, Mastrini & Bilancio (chart of accounts, sub-ledgers, balance)
  5. Libro Giornale & Prima Nota (general ledger / journal)
  6. Prospetto Rate (installments)
- **Anagrafiche** — master-data registry: people/companies, categories, contacts, cross-relations,
  access accounts, time-versioned variations.
- Cross-cutting: authentication, multi-tenancy (*studio* = accounting firm), Italian-first i18n,
  reports/PDF generation (chart of accounts, balance sheets, distribution, installments, general
  ledger, F24, owner welcome letters).

### 1.3 Explicitly out of scope for Stage 1
- **Framework leftovers** present in the legacy codebase but **not wired into the condominium app**:
  invoices, products, purchase orders, requests-for-quote, delivery notes, tickets, shopping cart.
- **Per-owner self-service portal** (the `unitResidentAccount` flat-owner login surface). The legacy
  data model for it is preserved in the DB migration, but no UI is built in Stage 1.
- **Multi-jurisdiction / country packs / `AllocationKey` generalization / AI-native features** from
  `PROJECT_BRIEF.md`. These are the future direction, deliberately deferred (see §11).

### 1.4 Success criteria
- Each in-scope screen reproduces the legacy screen's data, columns, and interactions.
- The **accounting engine reproduces legacy numbers to the cent** for the migrated sample data
  (Saturno, Pozzetto), verified against legacy report PDFs (see §7).
- Architecture honors the dependency rule (§3): swapping any tech adapter is "make the contract
  tests green again," not a rewrite.

---

## 2. Source system (what we are migrating from)

| Layer | Legacy tech | Notes |
|---|---|---|
| Frontend | Adobe Flex 3 (MXML/ActionScript), Cairngorm MVC | `old/flex/src`. Shell = top nav + breadcrumb + 2-panel sidebar + master-detail. Heavy hierarchical inline-editable data grids. |
| Transport | WebORB / AMF remoting | Each public PHP DAO method = one callable endpoint. No REST layer. |
| Backend | PHP DAOs/services + Zend FW 1 | `old/flex/php`. `studioId` tenant filter injected into every query. Raw SQL over PDO. |
| Database | MySQL (`it-jtime-condominium`) | 95 tables, 6 views, 3 functions, 188 (boilerplate timestamp) triggers, InnoDB, utf8. |

**Authoritative references in the repo:**
- Structure-only DDL: `old/db/it-jtime-condominium.structure.sql`
- Data (sample condominiums Saturno/Pozzetto): `old/db/it-jtime-condominium-saturno*.sql`,
  `old/db/it-jtime-condominium-pozzetto*.sql`
- Legacy report PDFs (ground-truth numbers): `old/db/it-jtime-condominium.*.pdf`
- Italian UI labels: `old/flex/locale/condominium/it_IT/Condominium.properties`
- Screenshots: `old/screenshots/presentazione Vittorio/` (primary), `old/screenshots/beta/`
- Requirements notes (IT): `old/prototype.pdf`; ER/class diagrams: `old/uml/`

---

## 3. Target architecture — the dependency rule

Dependencies point **inward**, toward pure code that knows nothing about React, HTTP, or CSS.

```
┌─ adapters (tech-coupled, but hold NO business decisions) ───────────┐
│  React UI · CSS Modules styling · Radix primitives · TanStack Table │
│  HTTP/tRPC client · react-rxjs runtime · Drizzle/Postgres · Fastify │
│        ▲ implement ports; translate, never reason                    │
├─ application (thin) ────────────────────────────────────────────────┤
│  use-cases / orchestration · PORTS (interfaces)                     │
├─ domain (pure TS, ZERO deps) ───────────────────────────────────────┤
│  Money · millesimi allocation engine · double-entry rules · types  │
└─────────────────────────────────────────────────────────────────────┘
```

**Rules:**
- `domain/` imports nothing tech-specific. It is the part that must never be regenerated.
- `application/` defines **ports** (TS interfaces): repositories, the reactive state slices, the
  report generator, the auth gateway. It depends only on `domain/`.
- **Adapters** may be "thick" (a React component, a Drizzle query, an RxJS stream graph) **as long as
  they hold no domain decisions** — they translate between the outside world and ports.
- Specs name the **role** ("tree-table grid adapter") separately from the **current implementation**
  ("TanStack Table"), so the spec outlives the library.

### 3.1 Replaceability is enforced by contract tests
Each port has **one** behavior test suite written against the *interface*. Any adapter
(Drizzle today / Kysely tomorrow; TanStack Table today / AG Grid tomorrow) must pass the same suite.
"Reliably regenerate a layer with different tech" = "make its contract tests green again." The test
suite *is* the executable spec for that boundary.

### 3.2 Monorepo layout (pnpm workspaces)
```
condo-ledger/
  apps/
    web/        React + Vite SPA (admin app; the prototype lives here first)
    api/        Node backend (later); owns persistence + auth adapters
  packages/
    domain/     pure TS: Money, allocation engine, double-entry rules, entity types + tests
    application/ ports (interfaces) + use-cases; depends only on domain
    db/         Drizzle schema + migrations + data-migration/seed scripts (later)
    ui/         (optional) shared presentational primitives + design tokens
```

---

## 4. Technology stack

All choices are **adapters behind ports**; the contract-test rule (§3.1) keeps them swappable.

### Frontend
| Concern | Choice | Why / port |
|---|---|---|
| Framework | React + Vite + TypeScript (SPA) | Internal data tool; no SSR/SEO need. Vite = lean. |
| Behavior primitives | **Radix UI** (headless) | Accessible dialog/dropdown/tabs/tooltip with zero styling opinion. The vendor-neutral part of the shadcn world; we drop the Tailwind coupling. |
| Styling | **CSS Modules + design tokens** (CSS custom properties) | Readable semantic markup, no framework lock-in, trivially regenerable, themeable. Behind a token contract so the engine is swappable. |
| Data grid | **TanStack Table** (headless) | Hierarchical tree data + inline-editable cells, free, fully styleable. Behind a `TreeTable` adapter port. Alt: AG Grid / MUI X (paid tree/edit). |
| Client state | **react-rxjs for all state**, behind a **context composition root** | See §6.1 — the canonical reactive-state pattern. |
| Routing | React Router | Behind thin route definitions. |

### Backend (detailed in the backend spec, later)
| Concern | Lean | Notes |
|---|---|---|
| Runtime | Node + TypeScript | |
| API | tRPC (lean) or Fastify+REST | tRPC gives end-to-end types in the monorepo; the data-access port returns observables either way. Final call in backend spec. |
| Persistence | **Drizzle ORM** | SQL-first, type-safe, faithful to a hand-tuned legacy schema (Prisma fights quirky schemas). Behind repository ports. |
| Validation | Zod | Shared request/response schemas. |
| Auth | session or JWT + **argon2** | Port legacy role + grant model; see §5.2. |

---

## 5. Cross-cutting concerns

### 5.1 Multi-tenancy (`studioId`)
`studioId` is the tenant key on all 59 operational tables (the *studio* = accounting firm).
- Enforced in the **data-access layer** via a non-bypassable tenant guard: every repository is
  constructed with the caller's `studioId` and injects it into every read and write.
- We are **not** relying on Supabase RLS (custom Node backend), but Postgres RLS may be added later as
  defense-in-depth (the `studioId`-bearing tables are the natural policy boundary).
- Global reference data (countries, locales, banks, etc.) is tenant-independent.

### 5.2 Authentication & authorization
- Legacy: Unix `crypt()` passwords, IP-pinned PHP sessions, role on `accessAccount.role` +
  fine-grained grant codes (`accountingRead`, `accountingWrite`, …).
- Target: re-hash with **argon2/bcrypt**. **Legacy `crypt()` hashes cannot be carried forward**
  (one-way, incompatible) → migrated accounts require a **password reset on first login** (port the
  legacy `passwordResetRequest` flow). Preserve the **role + grant** authorization model as an
  `AuthorizationPolicy` port checked in use-cases.
- Drop IP-pinning; use standard session/JWT expiry.

### 5.3 Internationalization vs domain localization
- **i18n (language/format)** is a presentation concern: all UI labels come from message catalogs,
  Italian-first (seed from `Condominium.properties`), English second.
- **Domain l10n (legal/fiscal rules)** stays out of Stage 1 — there is exactly one jurisdiction
  (Italy) and its rules are hard-coded in the ported engine. The brief's country-pack abstraction is
  deferred (§11), but we keep domain terms in code neutral-where-cheap so the later generalization is
  not blocked.

### 5.4 Money & numeric precision
- Store money as `numeric` in Postgres (legacy used `decimal(10,2)`).
- In code, a pure-TS **`Money` value type backed by integer minor units (cents)** (per the brief),
  with explicit rounding. The grid and the ledger consume the *same* `Money` and rounding rules — no
  drift between display and storage.

### 5.5 The accounting & allocation engine (the crown jewels)
The hardest, highest-risk piece. Lives in `packages/domain` as pure TS:
- **Double-entry rules:** a transaction has ≥2 entries; `sum(debit) === sum(credit)`; per-period
  sequential transaction codes.
- **Millesimi allocation:** faithful port of `UnitResidentVO::getShareByExpenseLedgerAccount` —
  `totalExpense × (table % ) × (role % ) × (coefficient / tableTotal) × compoundCoefficient`, where
  `compoundCoefficient` folds in **time-proration** (mid-year ownership changes / *subentri*) and
  **multi-ownership %** (*multiproprietà* / *coconduzione*).
- **Priority/role election** (owner = *proprietario* vs tenant = *conduttore*).
- **Account-type behavior:** GROUPING (recurse), CONTROL / CONTROL_UNIT_RESIDENT (personal, bypass
  millesimi), REGULAR / SUBSIDIARY (normal allocation).
- **Distribution types:** ESTIMATE (*preventivo*) vs CURRENT_BALANCE (*consuntivo*).
- **Penny-rounding reconciliation:** the rounding-error residual VO + per-level `round(.,2)` on the
  roll-up `UnitResident → UnitPeriod → Unit → UnitGroup → AccountingPeriod`, so column totals balance.

Correctness is proven by **characterization tests** (§7), not by review.

---

## 6. Frontend state architecture (canonical pattern)

### 6.1 react-rxjs behind a context composition root
react-rxjs's default `bind()` creates **module-level singleton** observables — bad for testing, SSR,
and isolation. We avoid that entirely:

1. **Ports first.** `application/` declares the reactive slices as plain hook signatures, e.g.
   `interface AppRuntime { useSelectedPeriod(): AccountingPeriod | null; useUnits(): UnitRow[]; … }`.
   These depend only on `domain/` types.
2. **Composition root = a factory + a provider.** `createAppRuntime(deps)` is called **once** inside
   `<AppRuntimeProvider>`; it builds the RxJS subjects/streams and the react-rxjs bound hooks
   **scoped to that instance**, and returns an `AppRuntime` object.
3. **Context delivers the bound hooks.** The provider memoizes the one runtime instance and supplies
   it via React context. Components call `useAppRuntime().useUnits()` (or thin wrapper hooks) — they
   depend on the **port**, never importing `react-rxjs` or concrete streams.
4. **Result:** no global singletons. Tests/Storybook mount an isolated runtime with mock streams; no
   state leaks between instances; the runtime is the app's dependency-injection seam.

### 6.2 The selection cascade
Selecting a **condominium + accounting period** cascade-hydrates units, distribution tables, ledger
accounts/entries, and installments. Modeled as derived RxJS streams off a `selection$` subject — the
exact "selected period drives everything" reactivity the legacy app implemented imperatively. This is
why react-rxjs is a good fit here.

---

## 7. Correctness & testing strategy

| Level | What | How |
|---|---|---|
| **Characterization** | The accounting/allocation engine reproduces legacy numbers | Feed migrated Saturno/Pozzetto data through `packages/domain`; assert riparto/bilancio/installment outputs match the legacy report PDFs (`old/db/*.pdf`) **to the cent**. Golden-number fixtures. |
| **Contract** | Each port behaves per its interface | One suite per port; every adapter must pass it (§3.1). |
| **Unit** | Pure domain functions (Money, rounding, election) | Fast, exhaustive, edge-cases (mid-year subentri, multiproprietà, rounding residuals). |
| **Component** | Screens render legacy data/columns/interactions | React Testing Library; mock runtime from §6.1. |

**Order of trust:** domain engine first (characterization), then adapters (contract), then UI. We do
not trust the rewrite until the numbers match.

---

## 8. Database migration strategy (summary; full detail in the DB-migration spec)

- **Faithful structure, Postgres-idiomatic identifiers.** Keep every table/column/relationship.
  Rename camelCase → **snake_case** (lossless mechanical transform) to avoid quoting `"studioId"`
  everywhere; map back to camelCase in the TS/API layer. (Alt: byte-identical quoted camelCase.)
- **Triggers:** the 188 timestamp-boilerplate triggers → one shared `set_timestamps()` trigger +
  `created`/`updated` conventions (preserve the "only set if null" / "bump unless explicitly changed"
  semantics via `COALESCE`/`CASE`). One variant on `ledgerTransaction` also defaults `timestamp`.
- **Types:** MySQL `enum` → Postgres enum types (each distinct value-set gets its own named type);
  `int unsigned` → `integer`/`bigint` (+ `CHECK >= 0` where meaningful); `tinyint(1)` → `boolean`
  (note the reserved-word column `default`); `datetime` → `timestamptz`; money `decimal` → `numeric`.
- **Functions/views:** port `getNominative`, `getMasterDataNominative` (display-name resolver used
  app-wide), `getCountryTranslation` to PLpgSQL (or app code). Recreate the 6 subtype/variation views
  as plain views (drop MySQL `DEFINER`/`ALGORITHM`/`SQL SECURITY DEFINER`).
- **Data:** migrate the **real sample data** (Saturno, Pozzetto — the condominiums in the
  screenshots) so the new app can be diffed side-by-side against the old. Drop `codeIgniterSession`.
- **AUTO_INCREMENT** → `GENERATED … AS IDENTITY`. Charset/collation clauses dropped (PG is UTF-8).

---

## 9. Module decomposition & sequencing

Each module is its own spec → plan → build. Sequence (dependencies flow downward):

| # | Module | Depends on | Notes |
|---|---|---|---|
| 0 | **DB migration** | — | Schema + data + functions + triggers → Postgres. Unblocks the real backend. |
| 1 | **App shell + auth/tenancy** | 0 | Top nav, breadcrumb, sidebar, composition root, login, tenant guard. |
| 2 | **Anagrafiche** (master data) | 1 | People/companies, categories, contacts, cross-relations, access accounts, variations. Referenced everywhere. |
| 3 | **Condominio + Units** | 2 | Condominiums, accounting periods, suppliers; units/groups/periods/residents; personal balances. |
| 4 | **Distribution tables / millesimi** | 3 | Tables + coefficients + the allocation engine (riparto preventivo/consuntivo). |
| 5 | **Accounting / Ledger** | 3, 4 | Chart of accounts, sub-ledgers, double-entry journal, invoices, withholding tax, balance sheets. |
| 6 | **Installments (rate)** | 4, 5 | Installment groups/items, estimate-based generation, payment linkage. |
| 7 | **Calendar** | 1 | Month view; events synthesized from accounting (installment due dates, etc.). |
| 8 | **Reports / PDF** | 4–6 | Chart of accounts, balance sheets, distribution, installments, general ledger, F24, welcome letters. |

**Build order in practice:** the **prototype** (next spec) front-loads UI/UX for the whole Condomini
module against mock data, decoupled from 0; the **DB migration** runs in parallel; then the backend
and real wiring proceed module-by-module in the order above.

---

## 10. Glossary (Italian domain terms)

| IT | EN / meaning |
|---|---|
| Studio | The accounting/administration firm (the tenant). |
| Condominio | Building / condominium. *Supercondominio* = parent of multiple buildings. |
| Gestione / Esercizio | Accounting period (financial year). |
| Unità | Real-estate unit. *Gruppo unità* = unit group (e.g. a stairwell). |
| Condòmino / Conduttore | Owner / tenant (resident roles). *Usufruttuario* = usufructuary. |
| Subentro | Mid-period ownership/occupancy change (time-prorated). |
| Multiproprietà / Coconduzione | Multi-ownership / co-occupancy (percentage split). |
| Millesimi | Thousandths — the weighted allocation coefficients (base 1000). |
| Tabella di riparto | Distribution table (a set of unit→coefficient rows). |
| Riparto | The allocation/distribution of expenses across units. |
| Preventivo / Consuntivo | Estimate (budget) / final balance (actuals). |
| Piano dei conti | Chart of accounts. *Mastrino* = sub-ledger/T-account. |
| Libro giornale / Prima nota | General ledger / day-book (journal). |
| Bilancio | Balance sheet. *Conti patrimoniali* = balance-sheet accounts. |
| Rate / Rata | Installments / a single installment (call for funds). |
| Ritenuta d'acconto | Withholding tax. **F24** = Italian tax-payment form. |
| Anagrafica | Master-data record (person/company registry). |

---

## 11. Future direction (deferred, NOT Stage 1)

Per `PROJECT_BRIEF.md`, after the faithful recreation the app evolves toward: market-neutral
canonical entities (`Building`/`Unit`/`Owner`/`AllocationKey`), pluggable **country packs**
(chart-of-accounts templates, allocation defaults, tax rules, governance rules), multi-jurisdiction
support, and AI-native features. **Stage 1 keeps the legacy Italian schema and rules**; the clean
architecture (§3) and the pure-TS domain engine (§5.5) are precisely what make that later
generalization tractable without a rewrite.

---

## 12. Open questions / risks

- **Backend API**: tRPC vs Fastify+REST — finalized in the backend spec; both satisfy the
  observable-returning data-access port.
- **Schema naming**: snake_case rename (recommended) vs byte-identical quoted camelCase — confirm at
  DB-migration spec review.
- **Allocation engine fidelity** is the top risk; mitigated by characterization tests against legacy
  PDFs (§7). Some legacy edge cases (rounding residual placement, priority election) are subtle —
  budget time to match exactly.
- **Sample-data completeness**: confirm the Saturno/Pozzetto dumps contain a full preventivo +
  consuntivo cycle so characterization tests have ground truth.
