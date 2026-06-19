# Recompute Engine — Phase 1b-2b (live reactive riparto cascade) Design

**Status:** approved design, ready for implementation planning
**Builds on:** Phase 1b-1 (generator derives distribution + balances via `recomputePeriod`, byte-identical) and Phase 1b-2a (generator seeds `periodStateByPeriod` + `individualByPeriod` into `data.generated.json`).
**Parent spec:** `docs/superpowers/specs/2026-06-16-recompute-engine-design.md` → "Phase 1 — reconciled design".

---

## Goal

Make the live app's riparto screens **recompute through the pure engine** (`recomputePeriod`) instead of being seeded-and-frozen with a bespoke local patcher. After this phase, editing any riparto input — a coefficient, a budget (preventivo), a payment (taking), or posting an invoice — flows correctly through to the distribution tables and the per-unit/per-resident balances, with no drift.

This retires the parallel, hand-written `recomputeDistribution` and unifies the live app on the same engine the generator already uses at build time.

## Context: there is no runtime database

The web app is a **client-side prototype with no live DB**. The pipeline is:

```
legacy MySQL dump → offline generator (build time) → data.generated.json → app loads JSON into rxjs subjects
```

At runtime the only copy of structure/labels/headers is the seeded JSON. `recomputePeriod` is pure math: it takes ids + integer cents and returns ids + integer cents — it carries **no** labels, tree shape, or column headers. So the live derivation must overlay the engine's fresh numbers onto a **skeleton** (tree + labels + headers) taken from the seed. (Decision: "Option (i)" — seed the finished structure and overlay numbers; not "Option (ii)" — ship relational data and rebuild DTOs in-browser.)

## Locked decisions (from brainstorming)

1. **Inputs stay their own sources; outputs derive** ("Option B"). `tables$` (coefficients) and `accounts$` (preventivo + actuals) remain the editable subjects, exactly as today. A live `PeriodState` is **assembled** from them on the fly (inside an rxjs `map`), then `recomputePeriod` derives distribution + balances. We do **not** fold edits into a single `periodState$` source (the more disruptive "Option A").
2. **Skeleton + overlay** ("Option i"). The seeded DTOs (`distributionByPeriod`, `unitsByPeriod`) are the skeleton; the cascade overwrites only the money cells. Structural editing of units is out of scope (Phase 2).
3. **Full slice incl. ledger-actuals.** All four input triggers are wired in this one phase: `setCoefficient`, `setPreventivo`, `recordTaking`, and `addTransaction`/`registerInvoice` (the last feeding consuntivo's actuals so it updates live when invoices are posted). `recomputeDistribution` is retired.
4. **Installments stay a command-patched source.** `createInstallments`/`setInstallmentAmount` are untouched; the engine's installment derivation is intentionally unused (it cannot reproduce the legacy figures). The empty `plan` inside each seeded `PeriodState` is intentional.

## Architecture

### Source subjects (editable truth), per period

- **`tables$`** — distribution-table coefficients. Unchanged.
- **`accounts$`** — `LedgerAccountRow` tree carrying `preventivo` and running `dare`/`avere`/`saldo`. Unchanged; `applyEntryDeltas` already keeps `saldo` current on every posting.
- **`paid$`** — *new* per-period subject `Record<Id, Record<residentId, cents>>`, seeded from each `periodState.paid`. Replaces the `versato`-bump that `recordTaking` currently writes onto `units$`.
- Seeded **`periodStateByPeriod`** (1b-2a) supplies the static parts of the engine input: `accounts`, `links`, `roles`, `residents`, `unitLegacyIds`, `opening`, plus the *initial* `estimateCentsByAccount` / `actualCentsByAccount` / `tableItems` / `paid` (which the live subjects then override).
- Seeded **`individualByPeriod`** (1b-2a) supplies the per-resident directly-attributed individual expenses folded into `consuntivo` (the engine does not model these).

### Derived layer

Per period `pid`:

```
livePeriodState$(pid) = combineLatest([tables$, accounts$, paid$]).pipe(
  map(([tables, accounts, paid]) => assembleState(seeded[pid], tables[pid], accounts[pid], paid[pid]))
)
engine$(pid)        = livePeriodState$(pid).pipe(map(recomputePeriod))   // { riparto, balances }
distribution(pid,t) = combineLatest([engine$(pid), seededDist[pid]]).pipe(map(overlayDistribution))
unitsTree(pid)      = combineLatest([engine$(pid), seededUnits[pid], individual[pid]]).pipe(map(overlayUnits))
```

**`assembleState(seededPeriodState, tables, accounts, paid) → PeriodState`** — start from the seeded `PeriodState`; replace only the editable fields:
- `riparto.tableItems` ← from `tables` (each item: `tableId = strip "dt"`, `unitId = strip "u"`, `coefficient`).
- `riparto.estimateCentsByAccount` ← from `accounts` leaf `preventivo` cents, keyed by `strip "la"`.
- `riparto.actualCentsByAccount` ← from `accounts` leaf `saldo` cents, keyed by `strip "la"`.
- `paid` ← from `paid` (keyed by `strip "r"`).
- everything else (`accounts`, `links`, `roles`, `residents`, `unitLegacyIds`, `opening`, `plan`) ← seeded, unchanged.

**Id mapping.** DTO ids are deterministic prefixed legacy ids — `la${legacy}` (accounts/columns), `dt${legacy}` (tables), `u${legacy}` (units), `r${legacy}` (residents) — confirmed in the generator projectors. The assembly recovers legacy ids by stripping the known prefix; no extra seeded id-map is required. (If a subject's id is ever found not to be a clean prefix transform, seed a small id-map instead — but current evidence says strip-prefix suffices.)

**`overlayDistribution(engine, seededDist) → Dist`** — keep the seeded `columns` and the group/unit tree (ids, labels, headers) as skeleton; for each unit row and each column, replace the amount with `engine.riparto.perUnitAmount(strip-la(col.accountId), mode, strip-u(row.unitId))`; re-derive each unit row `total` and the group row amounts/total by summation. `mode` is `"estimate"` for the estimate table, `"current"` for consuntivo.

**`overlayUnits(engine, seededUnits, individual) → UnitRow[]`** — keep the seeded unit/resident tree (ids, labels, unitType, floor, restriction) as skeleton; for each resident row, read `engine.balances` for `strip-r(row.id)` and set `saldoPrec`/`preventivo`/`versato`, set `consuntivo = balance.consuntivoCents + (individual[residentId] ?? 0)`, and `totDovuto = saldoPrec + preventivo` (generator semantics). Re-sum unit and group rows from their children.

### Triggers (all become "patch a source; the cascade redraws")

- **`setCoefficient`** → patch `tables$` only. **Delete** the bespoke `recomputeDistribution` block.
- **`setPreventivo`** → patch `accounts$.preventivo` only (as today). Today this is a dead-end; now it cascades to the estimate distribution and balances.
- **`recordTaking`** → post the ledger transaction (unchanged) **and** patch `paid$` for the resident. **Remove** the `units$.versato` bump (versato is now derived from `engine.balances`).
- **`addTransaction`/`registerInvoice`** → unchanged. They already update `accounts$.saldo` via `applyEntryDeltas`; consuntivo now reacts because `actualCentsByAccount` reads the live `saldo`.

### Untouched

- **Installments** — `createInstallments`/`setInstallmentAmount` stay as-is (command-patched source).
- **`periodSummaries`** — stays derived; minor rewire so it reads the now-derived `unitsTree` rather than the raw `units$` subject (it already `combineLatest`es accounts + units).
- All registry/structure CRUD (`addTable`, `addAccountRow`, suppliers, anagrafiche, calendar, …) — untouched.

## Testing & gates

- **On-load equivalence (headline).** For every period, the first emission of derived `distribution(pid, type)` and `unitsTree(pid)` must deep-equal the corresponding seeded DTOs (`distributionByPeriod[pid][type]`, `unitsByPeriod[pid]`). This proves the assemble+overlay is faithful, because the generator built those same seeded DTOs from the same `recomputePeriod`. This is the safety net catching any sign/mapping/overlay mistake.
- **Post-edit invariants.**
  - `setCoefficient`: each column's group total is unchanged (only the per-unit split moves); Σ children = group.
  - `setPreventivo`: the estimate column's group total equals the new budget; balances' `preventivo` reflects it.
  - `recordTaking`: the resident's `versato` increases by the taking; group/unit versato re-sums.
  - `registerInvoice`: the consuntivo column reflecting the posted expense account increases accordingly.
  - Structural invariants: group totals = Σ children; `totDovuto = saldoPrec + preventivo`.
- **Existing suite stays green** (web 301 + new tests; domain 34). No change to `data.generated.json` (this phase is app-only; the seed already carries everything from 1b-2a).

## Cleanup

- Retire `apps/web/src/recompute/distribution.ts` (`recomputeDistribution`). **Plan check:** `roundingByColumn` lives in the same file — if any UI still imports it, relocate it (e.g. into a small display helper) rather than deleting; if unused, remove it.
- Keep `apps/web/src/recompute/balances.ts` (`applyEntryDeltas` still backs postings), `summary.ts`, `dates.ts`, `installments.ts`.

## Out of scope (later phases)

- Structural edits to units/accounts/tables flowing through the engine (Phase 2).
- Replacing the seeded skeleton with client-side reconstruction from relational data ("Option ii") — relevant only if/when the real Postgres backend is wired into this app.
- Deriving installments through the engine (intentionally never, given the legacy-figure mismatch).

## Risks

- **Sign/keying mismatch in `actualCentsByAccount`.** The generator sums signed `ledgerEntry.amount`; in-app we read `accounts$.saldo` (= `dare − avere`). The on-load equivalence gate validates these agree for every seeded period; if they don't, fall back to summing `txns$` entries with the generator's sign convention.
- **Prefix assumption.** Strip-prefix id recovery depends on the `la`/`dt`/`u`/`r` conventions holding across all subjects; the equivalence gate catches violations.
- **Performance.** Re-running `recomputePeriod` per input emission, per period. The dataset is small (one studio, 9 condos); acceptable. If needed, memoize per `(pid, inputs)`.
