# Accounting-Core Parity Specs (Gherkin over the legacy dump) — Design

**Date:** 2026-06-14
**Status:** Approved (design); spec under review
**Branch:** `docs/legacy-requirements` (spec + requirements docs); implementation will land on a dedicated feature branch

## Goal

Author **executable acceptance specifications** (Gherkin) that prove the new implementation
reproduces the **legacy app's accounting behaviour**, using the legacy database dump as the
**oracle**. The first slice covers the accounting core and binds to today's subject under test
(the `@cl/web` generator projections + riparto engine); the same `.feature` files are designed
to be re-bound to the full new app (HTTP/UI) later, so the spec outlives the binding.

## Context & constraints

- **The legacy app is not runnable here.** It was a PHP CodeIgniter backend + Adobe Flex front
  end ("Condominium **Flex** Accounting System"). We have only its database dump,
  `old/db/it-jtime-condominium.all.sql` (committed in the repo, ~48 MB).
- **The dump is the legacy app's frozen output** — the books it posted, the riparto it
  computed (stored as ledger entries), the installments it issued. So parity = the new code
  reproduces those numbers and the accounting invariants.
- **Subject under test (today):** the offline generator's pure projections
  (`apps/web/tools/gen/`): `parseTables`→`buildDb`, then `projectAccounts`,
  `projectTransactions`, `reconcilePeriods`, `projectDistribution`, `projectUnits`,
  `projectInstallments`, `projectAnagrafiche`, and the riparto engine (`project/riparto.ts`).
  These produce exactly what the running app shows (`data.generated.json`), so asserting on
  them *is* asserting on what the app displays. See
  [`docs/domain/accounting-and-distribution.md`](../../domain/accounting-and-distribution.md).
- **Tooling already present:** Vitest is the test runner across the monorepo; tests run with
  cwd = `apps/web` (the dump is read cwd-relative — `new URL(import.meta.url)` throws under
  Vitest, a known quirk; use `resolve(process.cwd(), "../../old/db/...")`).
- **Periods with books:** only **Saturno 2011** and **Pozzetto 2013** reconcile; all other
  periods are structure-only. Scenarios pin to these two, plus crafted micro-fixtures for rules
  the dump doesn't exercise.
- **Architecture preference (repo-wide):** vendor-neutral, thin, replaceable layers; the repo
  hand-rolls infrastructure (e.g. its own SQL parser) rather than take heavy deps.

## Decisions (from brainstorming)

1. **Oracle:** the legacy DB dump. Specs assert equivalence to legacy-stored values **and**
   accounting invariants.
2. **Format/runner:** Gherkin `.feature` files executed under the existing **Vitest** via a
   small **in-repo Gherkin adapter** (no new test runner; `.feature` stays standard so the
   adapter is swappable; a tiny third-party lib is the fallback if preferred).
3. **Scope (first slice):** the accounting core — double-entry/reconciliation, riparto
   (estimate + consuntivo, multi-table, owner/tenant roles), installments, per-resident units
   money, anagrafiche/structure projection.

## Oracle tiers (strongest first)

Scenarios privilege independent oracles over snapshots, to avoid circular "test the code with
its own output":

1. **Legacy-stored values** — the legacy app's own computed results, frozen in the dump:
   - **Per-resident preventivo** = the `ledgerTransaction.type='estimateDistribution'` entries,
     which post each resident's computed estimate share onto the receivable account
     ("Crediti/debiti vs condòmini"). Our riparto engine recomputes this from coefficients +
     `expenseLA2Role`; the two must match. **This is the headline parity check.**
   - **Per-resident consuntivo adjustment** = `ledgerTransaction.type='closingBalance'` entries.
     *(Caveat — to verify during implementation: closingBalance is the year-end adjustment, not
     necessarily the gross consuntivo; the exact per-resident semantics must be confirmed before
     asserting strict equivalence. Until confirmed, consuntivo relies on tier-2 invariants.)*
   - **Opening balance** = `unitResident.startingBalance` → our `saldoPrec`.
   - **Installment amounts** = `installmentItem.amount` → our installment cells.
2. **Invariants computed in-step from raw rows** (a different code path than the projection, so
   non-circular):
   - Per reconciling period, `Σ` signed `ledgerEntry.amount` = 0 (trial balance).
   - Each transaction's entries sum to 0 (balanced).
   - `Σ` riparto matrix = `Σ` expense-account subtree totals (distribution conserves money).
   - `Σ` per-resident bills = `Σ` of the distributed expense (nothing created/lost).
   - `Σ installmentItem` for a plan = the plan/group total.
3. **Pinned constants** — only where tiers 1–2 don't apply, **clearly labelled** as captured
   snapshots (e.g. counts: "9 condominiums", "113 anagrafiche"; the verified totals
   €7,400 / €2,455 / €38,000 / €34,398 as regression guards).

## Architecture & components

```
apps/web/tools/gen/specs/
  features/
    double-entry.feature          # signed amounts, balanced transactions, account-tree rollup
    reconciliation.feature        # trial-balance gate; structure-only vs books
    riparto.feature               # estimate=estimateDistribution; multi-table %; role split; tie-out
    installments.feature          # installmentItem sums; per-resident plan
    units-money.feature           # saldoPrec/preventivo/consuntivo/versato per resident
    anagrafiche-structure.feature # registry projection; building/period tree; selection rules
  steps/
    world.ts                      # parses dump once (cached), holds db + computed results
    *.steps.ts                    # Given/When/Then bindings → generator projections + oracle helpers
  oracle.ts                       # legacy-stored extractors (estimateDistribution per resident, etc.)
  gherkin/
    parse.ts                      # minimal Gherkin parser (Feature/Background/Scenario/Outline/Examples/steps)
    run.ts                        # registers steps; emits one Vitest `it()` per scenario
  specs.test.ts                   # entry: discovers .feature files, runs them under Vitest
```

- **`.feature` files** — the durable, tool-neutral specs; double as human-readable documentation
  of the legacy accounting behaviour. Use `Background` for "Given the legacy data for period X"
  and `Scenario Outline` + `Examples` for per-period / per-resident tables.
- **Gherkin adapter (`gherkin/`)** — parses the subset of Gherkin we use and maps each scenario
  to a Vitest test. Small, in-repo, replaceable; `.feature` syntax stays standard so a different
  runner could consume the same files unchanged.
- **Step definitions + World** — the World parses the dump once and memoises `buildDb`; steps
  call the projections/engine and assert against `oracle.ts` extractors or in-step invariants.
- **`oracle.ts`** — independent legacy-value extractors (e.g. "estimateDistribution amount for
  resident R in period P", "Σ raw entry cents for period P"), kept separate from the projection
  code so the comparison is genuinely cross-implementation.

## Data flow

`*.feature` scenario → adapter (`gherkin/run.ts`) → step def → World (parse dump → `buildDb`,
cached) → call projection/engine → compare to `oracle.ts` value or in-step raw-row computation →
Vitest assertion.

## Representative scenarios (per feature)

- **double-entry:** every transaction in Saturno 2011 / Pozzetto 2013 balances (Σ=0); the
  account tree's rolled-up saldo equals the flat sum of entries; root saldo = 0.
- **reconciliation:** Saturno 2011 and Pozzetto 2013 reconcile (trial balance = €0.00); all
  other real periods are structure-only (have units/residents but empty accounting); no period
  ships unbalanced books.
- **riparto (headline):** per-resident preventivo from the engine equals the legacy
  `estimateDistribution` posting per resident; multi-table accounts split by `expenseLA2Table`
  percentage; owner/tenant split honours `expenseLA2Role`; `Σ` matrix = `Σ` expense subtree
  (tie-out).
- **installments:** each resident's plan cells equal `installmentItem.amount`; the group total
  equals `Σ installmentItem`.
- **units-money:** `saldoPrec` = `unitResident.startingBalance`; `versato` = −Σ
  `unitResidentTakings`; consuntivo includes the directly-attributed individual expenses; group
  rows sum children exactly.
- **anagrafiche-structure:** the registry projects every categorised master-data party (113,
  all with a known category); the building/period tree contains exactly the real buildings
  (selection rules: code-NULL Pozzetto kept, super-condo Sole kept, junk excluded).

## Subject-under-test binding (now vs later)

- **Now:** step defs bind to the generator projections (the data producer behind the running
  app). Proving these match the legacy dump proves the app shows legacy-faithful data.
- **Later:** when the full new app exists, the *same* `.feature` files get a second set of step
  bindings (HTTP/UI/store), proving parity at that layer. The features are the contract; only
  the steps change.

## Testing / running

- Runs under the existing Vitest: `pnpm --filter @cl/web test` picks up `specs.test.ts`; add a
  convenience `pnpm --filter @cl/web spec` alias.
- Offline and CI-safe (the dump is committed in `old/db/`); no network, no DB.
- The spec suite is additive — it does not change existing generator/app tests.

## Error handling & edge cases

- **Structure-only periods:** scenarios assert *empty* accounting (parity: legacy had no books
  → new shows none), not failures.
- **Rules absent from the dump** (per-unit attribution exceptions `expenseLAUnitException`;
  consumption meters; some multi-resident role splits): covered by **crafted micro-fixtures** in
  dedicated scenarios, clearly marked as synthetic (not real-dump parity).
- **Rounding:** money is integer cents; tie-out tolerances are per-cell rounding (documented in
  the scenario, e.g. "within N cents over M cells").

## Residual risks (accepted, with mitigations)

- **Circular testing** (asserting our code against its own output) — mitigated by privileging
  oracle tiers 1–2; pinned constants are explicitly labelled regression guards.
- **`closingBalance` per-resident semantics** for consuntivo are not yet confirmed — the plan
  must verify them against the dump before asserting strict equivalence; until then consuntivo
  parity rests on tier-2 invariants + tier-1 startingBalance/installments.
- **Generator-vs-full-app:** this slice proves the generator's parity; the eventual app needs
  its own step bindings (designed for, not built now).
- **Gherkin adapter maintenance** — mitigated by keeping it tiny and standard; a third-party lib
  is a drop-in fallback.

## Out of scope (first slice)

- UI flows (search/filter, dialogs, wizards), the resident frontend, and any non-accounting
  module (calendar beyond structure, tickets, documents, fiscal filings).
- The full new app's own step bindings (future slice).
- Mutating/recompute flows (`apps/web/src/recompute/`) — parity here is about the *initial
  legacy state*, not post-edit recomputation.
