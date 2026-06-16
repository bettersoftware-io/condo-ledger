# Recompute Engine (pure riparto core + reactive cascade) — Design

**Date:** 2026-06-16
**Status:** Approved (design); spec under review
**Branch:** to be created at planning time (feature branch off `main`)

## Goal

Make the prototype's dependent data **recompute correctly when a user edits** — add/edit an
expense, change a distribution coefficient (millesimi), change a budget (preventivo), or make
a structural change — so the riparto distribution, per-resident owner/tenant split,
installments per payer, and unit balances all update and stay coherent. Do this by
extracting a **single pure recompute/riparto engine into `@cl/domain`**, reused by both the
offline generator and the live app, eliminating today's duplicate distribution logic.

## Why now (strategic rationale)

The hard logic splits into two parts with very different lifespans:

- **Accounting rules** (millesimi tables, multi-table % splits, estimate vs consuntivo,
  owner/tenant role split, largest-remainder rounding, double-entry postings) are
  **invariant** — Italian condominium law + the legacy system's behaviour. They do not change
  between prototype and production. ~90% of the difficulty.
- **Plumbing** (in-memory `MockStore` today vs Postgres/`@cl/db` later, I/O shape, persistence,
  reactivity) **will** be rewritten for production.

A **pure** engine — `(coefficients, expense totals, roles, balances) → (allocations,
installments, postings, balances)` with no store and no DB dependency — therefore carries into
production almost untouched; only the thin adapter wiring it to `MockStore` is throwaway. This
also removes an existing smell: there are currently **two** distribution implementations (the
faithful 324-LOC `apps/web/tools/gen/project/riparto.ts` and the thin 51-LOC
`apps/web/src/recompute/distribution.ts`). One pure engine, consumed by both, kills the
duplication.

**Decision:** scoped "Option 2" — build the production-fidelity pure engine and wire the
prototype's cascade through it, but **exclude** the production backend (Postgres, persistence,
auth).

## Context & constraints

- **Stack:** pnpm monorepo. `@cl/domain` (pure, currently only a `Money` value object —
  `{cents}` with `add`/`subtract`/`isNegative`/`formatEUR`; `allocate` lives in the app, not
  the domain, today; no monorepo deps). `@cl/application`
  (DTO/projection types). `@cl/web` (React + Vite + Vitest, react-rxjs, strict TS,
  `noUncheckedIndexedAccess`). The offline generator `apps/web/tools/gen/` projects the legacy
  dump into `data.generated.json`, the app's seed.
- **Architecture preference (repo-wide):** clean/hexagonal, vendor-neutral thin replaceable
  layers; `@cl/domain` depends on nothing and everyone depends on it.
- **The faithful engine today:** `buildRiparto(db, periodId)` reads ~8 legacy tables directly
  (`ledgerAccount`, `expenseLA2Table`, `expenseLedgerAccount`, `ledgerTransaction`/`ledgerEntry`,
  `distributionTableItem`, `expenseLA2Role`, `unitPeriod`/`unitResident`, `unit`) and returns a
  query object with 5 computation stages (subtree rollup excluding nested linked accounts →
  multi-table % weighting → estimate/current link selection → largest-remainder per-unit
  allocation → owner/tenant role split with residual-to-last).
- **The live app today:** `MockStore` holds per-period `BehaviorSubject`s patched directly by
  edit commands; only ONE reactive derivation exists
  (`periodSummaries = combineLatest([accounts$, units$]).pipe(map(periodSummary))`). Thin
  recompute helpers exist (`allocate`, `applyEntryDeltas`, `recomputeDistribution`,
  `distributeInstallments`, `redistributeOverride`, `periodSummary`-stub). There is **no**
  riparto engine in the live path and **no** cascade from an edit to its dependents.
- **No post-edit oracle.** The legacy dump is a frozen snapshot, not a recording of edit
  sequences. We can prove the *initial* state matches legacy (parity specs); we cannot prove
  *post-edit* numbers match the legacy app. See Correctness.

## Decisions (from brainstorming)

1. **Scope/fidelity:** production-fidelity pure engine extracted to `@cl/domain`, consumed by
   both the generator and the live app; production backend excluded.
2. **Trigger edits (all four):** add/edit expense; edit coefficient; edit budget/preventivo;
   structural edits — with structural **phased after** the amounts cascade (it reshapes the
   matrices, not just amounts).
3. **Orchestration:** a **reactive derivation graph** — dependent state becomes derived
   observables whose `map` functions ARE the pure engine. No stale view by construction; math
   still unit-testable in isolation.
4. **Engine I/O contract:** **clean domain types in `@cl/domain`** — neutral to both the legacy
   `Db` shape and the app's view DTOs; generator and app each adapt in/out via thin mappers.

## Architecture & components

```
@cl/domain  (pure, no deps)
  money.ts            (exists)
  allocate.ts         ← MOVED from apps/web/src/recompute (largest-remainder; single copy)
  riparto/
    types.ts          (clean domain I/O — PeriodState, PeriodResult, below)
    computeRiparto.ts (the 5-stage math, lifted behaviour-preserving from buildRiparto)
    recomputePeriod.ts(cascade orchestrator: riparto → installments → postings → balances)
    *.test.ts

apps/web/tools/gen   (offline generator — EXISTING consumer)
  adapter: legacy Db rows → PeriodState → computeRiparto   (replaces Db-coupled buildRiparto internals)

apps/web/src         (live prototype — NEW consumer)
  adapter: store state ⇄ PeriodState / PeriodResult (DTO mappers)
  MockStore restructured: SOURCE state vs DERIVED observables (the reactive graph)
```

**Dependency direction:** `@cl/domain` ← `@cl/application`/`apps/web` and `apps/web/tools/gen`.
The engine never imports a store, a DB, or a DTO.

### The pure engine contract (`@cl/domain/riparto/types.ts`)

```ts
// INPUT — everything the cascade needs, in domain terms
interface PeriodState {
  accounts:   ExpenseAccount[];    // tree (parentId); each { id, budgetCents, actualCents }
  tables:     DistributionTable[]; // { id, coefficients: Map<UnitId, number> }
  links:      ExpenseLink[];       // { expenseAccountId, tableId, mode: "estimate"|"current"|"both", pct }
  units:      UnitId[];
  residents:  Resident[];          // { unitId, residentId, role: "owner"|"tenant", pct }
  roleSplits: RoleSplit[];         // per-link owner/tenant % (the expenseLA2Role rule)
  plan:       InstallmentPlan;     // { count, expiries, overrides: Map<Cell, Cents> }
  opening:    Map<ResidentId, Cents>; // saldoPrec
  paid:       Map<ResidentId, Cents>; // versato
}

// OUTPUT — fully recomputed, conserved
interface PeriodResult {
  riparto:      { estimate: Allocation; current: Allocation }; // per-unit + per-resident, per mode
  postings:     LedgerPosting[];   // estimateDistribution entries riparto implies (balanced)
  installments: InstallmentCells;  // per-resident-per-installment
  balances:     UnitBalance[];     // per resident: preventivo/consuntivo/saldoPrec/versato/totDovuto, rolled up
}
```

Two pure entry points:

- `computeRiparto(input) → { estimate, current }` — the **5 stages lifted verbatim** from
  today's `buildRiparto`, behaviour-preserving so parity numbers stay byte-identical
  (including the known residents-166/167 within-unit quirk — see Risks).
- `recomputePeriod(state) → result` — the cascade orchestrator chaining the DAG below.

### The cascade DAG (what recomputes from what)

```
ledger txns ─► account.actualCents ─┐
budget edit ─► account.budgetCents ─┤
coefficient edit ─► table.coeffs ───┼─► computeRiparto ─► estimate/current matrices
roster/roles ───────────────────────┘         │            (per-unit + per-resident)
                                               ├─► installment cells   (per-resident estimate ÷ plan, honouring overrides)
                                               ├─► estimateDistribution postings (balanced double-entry)
                                               └─► unit balances  preventivo = Σ estimate share
                                                                  consuntivo = Σ current share
                                                                  totDovuto  = preventivo + saldoPrec − versato
                                                                  (rolled up resident → unit → group)
```

Existing thin pieces fold in: `allocate` moves to `@cl/domain` (the engine's rounding
primitive); `distributeInstallments`/`redistributeOverride` become the installment stage;
`applyEntryDeltas` becomes how postings update the account roll-up; the `periodSummary` stub is
derived properly.

### App reactive wiring (`MockStore` source vs derived)

```ts
// SOURCE subjects (user edits write here; commands shrink to "patch one source")
txns$, budget$, tables$ (coefficients), roster$, plan$ (+overrides), opening$, paid$

// DERIVED (NEW — computed, never patched directly)
accounts$      = combineLatest([baseAccounts$, txns$]).pipe(map(applyPostings))
riparto$       = combineLatest([accounts$, tables$, roster$]).pipe(map(computeRiparto))
distributions$ = riparto$.pipe(map(toDistributionDTO))   // replaces today's stored subject
installments$  = combineLatest([riparto$, plan$]).pipe(map(toInstallmentDTO))
units$         = combineLatest([riparto$, opening$, paid$]).pipe(map(toUnitBalances))
```

Existing hooks (`useDistribution`, `useUnitsTree`, `useInstallments`, `periodSummaries`) keep
their signatures; they subscribe to derived observables instead of stored ones. This
generalises the single existing `periodSummaries` derivation to the whole dependent graph. The
DTO mappers (`PeriodState ⇄ DTO`) are the only new app-specific code; the math lives in
`@cl/domain`.

## Data flow

User edit → command patches a **source** subject → the derived `combineLatest` chains re-emit →
`map(pure engine)` recomputes → DTO mappers shape the result → hooks re-render. No imperative
"remember to recompute" step; staleness is structurally impossible.

## Correctness (two bars)

- **Generator / initial state — strong.** The 25 parity specs + 298 web tests are the
  regression harness for the extraction. `data.generated.json` must stay **byte-identical**.
  If parity goes red, the lift was not behaviour-preserving — fix the lift, never the spec.
- **App / post-edit — coherence only (no oracle).** Assert internal invariants after every
  recompute (the same tier-2 invariants the parity suite uses):
  1. every transaction balanced (Σ entries = 0);
  2. riparto matrix ties out to the expense estimate/actual total (conservation);
  3. per-resident Σ = per-unit Σ = column total;
  4. installment cells Σ = plan total;
  5. balances roll up resident → unit → group exactly;
  6. **idempotence:** `recompute(recompute(s)) == recompute(s)`.

## Phasing (each phase independently shippable & green)

- **Phase 0 — Extract & re-point the generator. ✅ DONE (merged to `main`, `79fe67d`,
  2026-06-16).** Moved `allocate`; lifted the 5-stage math into `@cl/domain/riparto`; defined
  clean I/O; adapted the generator via `dbToRipartoInput`. `data.generated.json` byte-identical;
  parity specs + web suite green. **NB:** the shipped contract is narrower than the aspirational
  one drafted above — see "Phase 1 — reconciled design" for the concrete types and how Phase 1
  builds on them.
- **Phase 1 — Amounts cascade.** Restructure `MockStore` into source/derived; wire expense,
  coefficient, and budget edits through the graph. The three amount triggers cascade correctly
  to installments + balances. **Reconciled against the shipped Phase 0 API below.**
- **Phase 2 — Structural cascade.** Add/remove unit or resident, ownership/tenancy role
  changes, opening-balance edits — these reshape the matrices (rows/columns), not just amounts.
  Heavier; lands last. Structural semantics pinned down here (e.g. whether coefficients must
  re-sum, what a new mid-period resident inherits).

## Testing

- **Pure engine (`@cl/domain`):** unit tests with crafted fixtures (multi-table, owner/tenant,
  rounding edges) + the invariant battery as property-style checks over the two real seed
  periods and after randomised edit sequences.
- **Generator:** parity specs + web suite unchanged (the extraction's gate).
- **App:** integration tests that an edit command re-derives the dependent hooks (no stale
  view) for each Phase-1 trigger.

## Error handling & edge cases

- **Rounding:** integer cents throughout; largest-remainder (`allocate`) guarantees Σ-exactness
  (residual to last). The engine never introduces fractional drift.
- **Override interactions:** manual installment overrides (`redistributeOverride`) survive a
  recompute where possible; a recompute that invalidates an override (e.g. total dropped below
  the overridden cells) clears the override and re-derives — pinned precisely in the plan.
- **Empty/degenerate inputs:** no residents, no links, zero coefficient total → engine returns
  zeroed allocations rather than throwing (matches the generator's tolerance today).

## Out of scope

- Production Postgres backend / `@cl/db` integration.
- Persistence across reload (in-memory; reload re-seeds from `data.generated.json`).
- Authentication / multi-user.
- Any claim of **exact** post-edit parity with the legacy app (unprovable — no oracle).

## Residual risks (accepted, with mitigations)

- **Behaviour-preserving lift is delicate** — the faithful engine has legacy-coupled quirks
  (the residents-166/167 within-unit divergence documented in `riparto.feature`'s `# NOTE:`).
  The lift must reproduce these exactly. Mitigation:
  parity specs are the byte-identical gate; Phase 0 lands before any app change.
- **`MockStore` source/derived restructure touches many subjects.** Mitigation: Phase 0/1
  split; derived observables introduced incrementally; hooks keep their signatures.
- **Reactive-graph performance** — recompute on every edit. Mitigation: prototype data sizes
  are small; `combineLatest` + memoised `map` is ample. Revisit only if measured.
- **Structural-edit semantics are genuinely ambiguous.** Deferred to Phase 2, pinned there.

---

## Phase 1 — reconciled design (2026-06-16, post-Phase-0)

Phase 0 shipped a **narrower** engine than the aspirational contract drafted earlier in this
doc. This section is authoritative for Phase 1; where it conflicts with the earlier
"pure engine contract" / "cascade DAG" / "app reactive wiring" sketches, this section wins.

### What Phase 0 actually shipped (the concrete foundation)

```ts
// @cl/domain/riparto/types.ts
buildRiparto(input: RipartoInput): RipartoEngine
// RipartoInput: { accounts[], links[], estimateCentsByAccount, actualCentsByAccount,
//                 tableItems[], roles[], residents[], unitLegacyIds[] }   (all cents are integers)
// RipartoEngine (query object): { columns, perUnitAmount(acct,mode,unit),
//                 subtree(acct), perResidentAmount(acct,mode,unit), unitLegacyIds }
```

The generator already maps this engine → UI DTOs in `apps/web/tools/gen/project/distribution.ts`
(`projectDistribution`) and `units.ts` (`projectUnits`), applying the id prefixes `la{accountId}`,
`u{unitId}`, `dt{tableId}`. Installments are **not** engine-derived today — `projectInstallments`
reads legacy `installment`/`installmentItem` rows directly.

### Decisions taken for Phase 1 (2026-06-16)

1. **Engine home — extend `@cl/domain`.** Add a second pure entry point
   `recomputePeriod(state: PeriodState): PeriodResult` that *uses* the shipped `buildRiparto`
   for the riparto stage, then chains pure installment / posting / balance stages. The shipped
   `buildRiparto`/`RipartoInput`/`RipartoEngine` are unchanged (no Phase 0 regression).
2. **Installments — fully derived from riparto** (see "Installments resolution" below).
3. **Wiring — reactive derived graph.** Source subjects stay command-patched; dependent data
   (`distributions$`, `installments$`, unit-balance `units$`) becomes derived off a single
   `riparto$ = combineLatest([accounts$, tables$, roster$]).pipe(map(recomputePeriod-via-adapter))`.

### The Phase 1 engine contract (concrete)

```ts
// @cl/domain/riparto/recomputePeriod.ts
interface PeriodState {
  riparto: RipartoInput;                 // the shipped Phase 0 input (drives buildRiparto)
  plan: {                                // installment plan
    installmentIds: string[];            // ordered (by expiry)
    overrides: { residentId: string; installmentId: string; cents: number }[];
  };
  opening: Record<string, number>;       // saldoPrec cents, per residentId
  paid: Record<string, number>;          // versato cents, per residentId
}

interface PeriodResult {
  // per-unit + per-resident estimate/current — sourced from the RipartoEngine query object
  riparto: RipartoEngine;
  // per-resident-per-installment cents, honouring overrides; Σ cells = resident preventivo
  installments: { byResident: Map<string /*residentId*/, Map<string /*installmentId*/, number>> };
  // the balanced estimateDistribution double-entry the matrix implies
  postings: { transactionId: string; entries: { accountId: string; cents: number }[] }[];
  // per-resident rollup: preventivo = Σ estimate share; consuntivo = Σ current share;
  // totDovuto = preventivo + saldoPrec − versato
  balances: { residentId: string; preventivoCents: number; consuntivoCents: number;
              saldoPrecCents: number; versatoCents: number; totDovutoCents: number }[];
}
```

`recomputePeriod` is pure (depends only on `state`); all stages use integer cents and the
`allocate` largest-remainder primitive (residual-to-last) for Σ-exactness. The generator and the
live app each keep their own thin adapters mapping their world → `PeriodState` and
`PeriodResult` → their DTOs (the generator's existing `project*` mappers are refactored to read
from `PeriodResult` rather than calling the bare `RipartoEngine`).

### Installments resolution (the seed-vs-derive conflict, resolved)

Deriving installments from riparto changes the **initial** numbers away from the legacy
`installmentItem` amounts. To keep the seed coherent with what the live app derives on load,
**both** the generator (`projectInstallments`) and the live app derive installments from
`recomputePeriod`. Consequences, accepted:

- `data.generated.json` **changes for installments** (riparto-distribution and unit-balance
  outputs stay **byte-identical** — only installments move). This is a deliberate behaviour
  change, not a regression.
- The **installments parity spec is relaxed** from "group total equals Σ legacy
  `installmentItem.amount`, cell-for-cell" to the **Σ-conservation invariant**: the installment
  plan's group total ties to the period's preventivo (Σ per-resident estimate). This mirrors the
  precedent already set for the [[riparto-per-resident-divergence]] (a documented Σ-only
  invariant where the legacy per-cell split can't be reproduced without an oracle).
- Manual overrides (`redistributeOverride`) survive a recompute where still valid; a recompute
  that invalidates an override (total dropped below the overridden cells) clears it and
  re-derives — pinned precisely in the plan.

### App reactive wiring (concrete)

```ts
// SOURCE (command-patched, as today): txns$/accounts$ base, budget (account.preventivo),
//   tables$ (coefficients), roster$ (units+residents), plan$ (+overrides), opening$, paid$
// DERIVED (NEW — never patched directly):
riparto$        = combineLatest([accounts$, tables$, roster$, plan$, opening$, paid$])
                    .pipe(map(state → recomputePeriod(storeToPeriodState(state))))
distributions$  = riparto$.pipe(map(toDistributionDTO))   // replaces the stored subject
installments$   = riparto$.pipe(map(toInstallmentDTO))     // now derived (was stored)
units$ balances = riparto$.pipe(map(toUnitBalances))       // preventivo/consuntivo/totDovuto/versato
```

Hooks (`useDistribution`, `useInstallments`, `useUnitsTree`, `periodSummaries`) keep their
signatures and subscribe to the derived observables. The `storeToPeriodState` /
`PeriodResult → DTO` adapter is the only new app-specific (throwaway) code; it mirrors the
generator's id-prefix mapping so the DTOs are identical in shape.

The three amount triggers and their cascade:
- **Budget edit** (`setPreventivo`) → patches the account's `preventivo` → `accounts$` re-emits →
  riparto estimate, installments, unit preventivo/totDovuto all re-derive.
- **Posted expense** (`addTransaction`/`recordTaking`) → patches `txns$`/`accounts$` actuals (and
  `paid$` for takings) → riparto current, unit consuntivo/versato re-derive.
- **Coefficient edit** (`setCoefficient`) → patches `tables$` → riparto matrices + installments
  + balances all re-derive. (Replaces today's partial `recomputeDistribution`.)

### Correctness & testing (Phase 1)

The invariant battery from "Correctness (two bars)" applies after every `recomputePeriod`,
asserted as property-style checks over the two real seed periods and after randomised edit
sequences — including **idempotence** `recompute(recompute(s)) == recompute(s)`. The generator
regression bar holds for riparto + balances (byte-identical); installments move to the relaxed
Σ-conservation invariant. App integration tests assert each Phase-1 trigger re-derives its
dependent hooks (no stale view).

### Out of scope for Phase 1 (→ Phase 2)

Structural edits (add/remove unit or resident, owner/tenant role changes, opening-balance edits)
reshape the matrices, not just amounts — deferred to Phase 2, where their semantics are pinned.
