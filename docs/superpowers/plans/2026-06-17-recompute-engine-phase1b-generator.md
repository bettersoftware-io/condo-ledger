# Recompute Engine — Phase 1b-1 (generator adopts `recomputePeriod`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route the build-time seed generator's **distribution** and **per-resident balances** through the Phase 1a `recomputePeriod` cascade (via a new `dbToPeriodState` adapter), keeping output **byte-identical** to today's `data.generated.json`. Installments are intentionally left on their legacy path.

**Architecture:** A new pure adapter `dbToPeriodState(db, periodId): PeriodState` extends the existing `dbToRipartoInput` with `opening` (per-resident `startingBalance`) and `paid` (per-resident `versato` = −takings) and an empty installment `plan` (the generator keeps legacy installments). `distribution.ts` consumes `recomputePeriod(state).riparto` (the same engine `buildRiparto` returns); `units.ts` consumes `recomputePeriod(state).balances` for preventivo/consuntivo/saldoPrec/versato, keeping its existing individual-expense fold and `totDovuto = saldoPrec + preventivo`. The **byte-identical regeneration of `data.generated.json`** is the equivalence gate — exactly as it was for Phase 0.

**Tech Stack:** TypeScript (the generator uses explicit `.ts` import extensions and `tsx`), Vitest, pnpm workspaces. `@cl/domain` exports `recomputePeriod`, `PeriodState`, `buildRiparto`.

**Spec:** `docs/superpowers/specs/2026-06-16-recompute-engine-design.md` → "Phase 1 — reconciled design". This is **Phase 1b-1 (generator)**; the live-app reactive cascade is **Phase 1b-2**, a follow-up plan written against the `dbToPeriodState` adapter this plan creates.

---

## Shared conventions (read first)

- **Branch:** create and stay on `feat/recompute-engine-phase1b-generator` (off `main`).
- **Decisions locked in brainstorming (do not revisit):**
  - Generator adopts `recomputePeriod` for **distribution + balances only**. **Installments stay legacy** — `projectInstallments` (reads `installmentItem`) is UNCHANGED. Empirically, legacy installments are free-form (30 of 37 residents' totals match neither preventivo nor totDovuto), so they are not derivable by `computeInstallments` (which conserves Σ == preventivo).
  - The generator's balance semantics are preserved exactly: `consuntivo = riparto current share + directly-attributed individual expenses`; `versato = −takings`; `totDovuto = saldoPrec + preventivo` (NOT `−versato`). `recomputePeriod`'s own `totDovuto`/`consuntivo` are NOT used for the seed — only its `preventivoCents`/`consuntivoCents`/`saldoPrecCents`/`versatoCents` per resident.
- **Byte-identical is the gate.** After Tasks 2 and 3, regenerate the seed and assert `git diff --stat` shows NO change to `apps/web/src/mock/data.generated.json`. If it changes, the refactor is wrong — fix the adapter/projector, do not accept the diff.
- **Generator import style:** explicit `.ts` extensions on relative imports (`../db.ts`, `./ripartoInput.ts`); package imports from `@cl/domain` have no extension.
- **`dbToRipartoInput` is reused unchanged** — `dbToPeriodState` calls it for the `riparto` field.
- **Commit trailer:** end every commit body with a blank line then
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Commit via CLI** (the user's GUI git client breaks on accented filenames, and `data.generated.json` contains accented strings).

**Commands:**
- Regenerate seed: `cd apps/web && pnpm gen:data` (script: `tsx tools/gen/generate-data.ts`)
- Web tests (incl. parity specs): `pnpm --filter @cl/web test`
- Web typecheck: `pnpm --filter @cl/web exec tsc --noEmit`
- Byte-identity check: `git diff --stat apps/web/src/mock/data.generated.json` (expect empty)

**Confirmed current shapes (do not re-derive):**
- `apps/web/tools/gen/project/ripartoInput.ts` exports `dbToRipartoInput(db: Db, periodId: string): RipartoInput`. Its `residents` enumerate every `unitResident` whose `unitPeriodId` resolves via `db.by("unitPeriod","id")` (NOT filtered by period — harmless supersets, since `buildRiparto` keys off `unitLegacyIds`/tables).
- `units.ts` builds, per period: `txInPeriod` (ledgerTransaction ids for the period), `takingsByResident` (Σ `eur(amount).cents` of `ledgerEntry` with `type==="unitResidentTakings"`, keyed by `unitResidentId`), `individualByResident` (Σ `eur(amount).cents` of non-takings `ledgerEntry` whose posting account `kind==="expenses"` and has a `unitResidentId`). `versato = −takings`; `saldoPrec = eur(unitResident.startingBalance).cents`; `preventivo`/`consuntivo` from `sumByMode("estimate"/"current")`; `consuntivo += individualByResident`; `totDovuto = saldoPrec + preventivo`.
- `PeriodState = { riparto: RipartoInput; plan: { installmentIds: string[]; overrides: {residentId,installmentId,cents}[] }; opening: Record<string,number>; paid: Record<string,number> }`.
- `recomputePeriod(state): { riparto: RipartoEngine; installments: Map<...>; balances: ResidentBalance[] }`, `ResidentBalance = { residentId, preventivoCents, consuntivoCents, saldoPrecCents, versatoCents, totDovutoCents }`.

**File layout (this plan):**
```
apps/web/tools/gen/project/
  periodState.ts          dbToPeriodState adapter        (Task 1, new)
  periodState.test.ts     focused unit test              (Task 1, new)
  distribution.ts         use recomputePeriod(...).riparto (Task 2, modify)
  units.ts                use recomputePeriod(...).balances (Task 3, modify)
docs/domain/README.md     pointer (Task 4, modify)
```

---

### Task 1: `dbToPeriodState` adapter

**Files:**
- Create: `apps/web/tools/gen/project/periodState.ts`
- Create: `apps/web/tools/gen/project/periodState.test.ts`

The adapter extends `dbToRipartoInput` with `opening`/`paid`/`plan`. It reproduces `units.ts`'s takings and startingBalance reads exactly, so `computeBalances` yields identical `saldoPrecCents`/`versatoCents`.

- [ ] **Step 1: Write the failing test first**

```ts
// apps/web/tools/gen/project/periodState.test.ts
import { describe, it, expect } from "vitest";
import { dbToPeriodState } from "./periodState.ts";
import type { Db } from "../db.ts";

// Minimal in-memory Db: only rows() and by() are exercised by the adapter.
function fakeDb(tables: Record<string, Record<string, unknown>[]>): Db {
  const rows = (t: string) => tables[t] ?? [];
  const by = (t: string, key: string) => {
    const map = new Map<string, Record<string, unknown>>();
    for (const r of rows(t)) map.set(String(r[key]), r);
    return { get: (k: string) => map.get(k) };
  };
  const group = (t: string, key: string) => {
    const map = new Map<string, Record<string, unknown>[]>();
    for (const r of rows(t)) {
      const k = String(r[key]);
      (map.get(k) ?? map.set(k, []).get(k)!).push(r);
    }
    return { get: (k: string) => map.get(k) };
  };
  return { rows, by, group } as unknown as Db;
}

const db = fakeDb({
  unit: [{ id: "u1", code: "1", accountingPeriodId: "p1" }],
  unitPeriod: [{ id: "up1", unitId: "u1" }],
  unitResident: [
    { id: "r1", unitPeriodId: "up1", unitResidentPriorityId: "1", percentage: 100, startingBalance: "50,00" },
    { id: "r2", unitPeriodId: "up1", unitResidentPriorityId: "1", percentage: 100, startingBalance: "0,00" },
  ],
  ledgerTransaction: [{ id: "t1", accountingPeriodId: "p1" }],
  ledgerEntry: [
    { ledgerTransactionId: "t1", type: "unitResidentTakings", unitResidentId: "r1", amount: "20,00" },
  ],
  // tables read by dbToRipartoInput but empty here:
  ledgerAccount: [],
  expenseLA2Table: [],
  expenseLedgerAccount: [],
  distributionTableItem: [],
  expenseLA2Role: [],
});

describe("dbToPeriodState", () => {
  it("carries the riparto input, an empty installment plan, opening (startingBalance) and paid (-takings)", () => {
    const state = dbToPeriodState(db, "p1");
    // riparto comes from dbToRipartoInput — residents present, unit in period:
    expect(state.riparto.unitLegacyIds).toEqual(["u1"]);
    expect(state.riparto.residents.map((r) => r.residentId).sort()).toEqual(["r1", "r2"]);
    // installments are kept legacy — empty plan here:
    expect(state.plan).toEqual({ installmentIds: [], overrides: [] });
    // opening = startingBalance cents per resident:
    expect(state.opening).toEqual({ r1: 5000, r2: 0 });
    // paid = -takings (versato); r1 has a 20,00 taking → 2000; r2 none → absent:
    expect(state.paid).toEqual({ r1: 2000 });
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/apps/web && pnpm exec vitest run tools/gen/project/periodState.test.ts`
Expected: FAIL (module not found / `dbToPeriodState` is not a function).

- [ ] **Step 3: Implement the adapter**

```ts
// apps/web/tools/gen/project/periodState.ts
import type { PeriodState } from "@cl/domain";
import type { Db } from "../db.ts";
import { eur } from "../amounts.ts";
import { dbToRipartoInput } from "./ripartoInput.ts";

const str = (v: unknown): string | undefined =>
  v === null || v === undefined || String(v).trim() === "" ? undefined : String(v).trim();

/**
 * Adapt one legacy accounting period into the pure cascade's PeriodState.
 * riparto: reuse dbToRipartoInput. plan: EMPTY — the generator keeps legacy
 * installments (projectInstallments reads installmentItem), so recomputePeriod's
 * derived installments are intentionally unused here. opening: per-resident
 * startingBalance cents. paid: per-resident versato = -(unitResidentTakings),
 * reproducing units.ts exactly so computeBalances yields identical saldoPrec/versato.
 */
export function dbToPeriodState(db: Db, periodId: string): PeriodState {
  const riparto = dbToRipartoInput(db, periodId);

  // opening: startingBalance per resident (same enumeration as dbToRipartoInput.residents)
  const upById = db.by("unitPeriod", "id");
  const opening: Record<string, number> = {};
  for (const r of db.rows("unitResident")) {
    const up = upById.get(String(r.unitPeriodId));
    if (!up) continue;
    opening[String(r.id)] = eur(str(r.startingBalance) ?? null).cents;
  }

  // paid: versato = -(takings) per resident, from this period's ledger entries
  const txInPeriod = new Set(
    db
      .rows("ledgerTransaction")
      .filter((t) => String(t.accountingPeriodId) === periodId)
      .map((t) => String(t.id)),
  );
  const takingsByResident = new Map<string, number>();
  for (const e of db.rows("ledgerEntry")) {
    if (!txInPeriod.has(String(e.ledgerTransactionId))) continue;
    if (String(e.type) !== "unitResidentTakings") continue;
    const ur = str(e.unitResidentId);
    if (!ur) continue;
    takingsByResident.set(ur, (takingsByResident.get(ur) ?? 0) + eur(str(e.amount)).cents);
  }
  const paid: Record<string, number> = {};
  for (const [ur, cents] of takingsByResident) paid[ur] = -cents;

  return { riparto, plan: { installmentIds: [], overrides: [] }, opening, paid };
}
```

- [ ] **Step 4: Run the test (expect PASS)**

Run: `cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/apps/web && pnpm exec vitest run tools/gen/project/periodState.test.ts`
Expected: PASS (1 case).

- [ ] **Step 5: Typecheck + commit**

Run: `cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && pnpm --filter @cl/web exec tsc --noEmit` (exit 0).

```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
git add apps/web/tools/gen/project/periodState.ts apps/web/tools/gen/project/periodState.test.ts
git commit -m "$(cat <<'EOF'
feat(gen): dbToPeriodState adapter (riparto + empty plan + opening/paid)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `distribution.ts` uses `recomputePeriod(...).riparto`

**Files:**
- Modify: `apps/web/tools/gen/project/distribution.ts`

`recomputePeriod(state).riparto` is the exact same engine `buildRiparto(input)` returns, so the distribution matrices are byte-identical. This swaps the call without changing math.

- [ ] **Step 1: Edit the imports and the engine call**

In `apps/web/tools/gen/project/distribution.ts`:

Replace the import line
```ts
import { buildRiparto, type Mode, type Money } from "@cl/domain";
```
with
```ts
import { recomputePeriod, type Mode, type Money } from "@cl/domain";
```

Replace the import line
```ts
import { dbToRipartoInput } from "./ripartoInput.ts";
```
with
```ts
import { dbToPeriodState } from "./periodState.ts";
```

Replace the engine construction (inside `projectDistribution`)
```ts
  const eng = buildRiparto(dbToRipartoInput(db, periodId));
```
with
```ts
  const eng = recomputePeriod(dbToPeriodState(db, periodId)).riparto;
```

Leave everything else (columns, `buildMatrix`, `perUnitAmount` usage) unchanged.

- [ ] **Step 2: Regenerate the seed and assert byte-identity**

Run:
```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/apps/web && pnpm gen:data
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && git diff --stat apps/web/src/mock/data.generated.json
```
Expected: `pnpm gen:data` succeeds; `git diff --stat` prints **nothing** (the JSON is unchanged). If the file changed, the swap altered output — investigate `dbToPeriodState`/`recomputePeriod` rather than accepting the diff.

- [ ] **Step 3: Typecheck + parity specs + web suite**

Run, expecting all green:
```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && pnpm --filter @cl/web exec tsc --noEmit
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && pnpm --filter @cl/web test
```
Expected: tsc clean; web suite green (295 tests), including the Gherkin parity specs.

- [ ] **Step 4: Commit**

```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
git add apps/web/tools/gen/project/distribution.ts
git commit -m "$(cat <<'EOF'
refactor(gen): distribution via recomputePeriod(state).riparto (byte-identical)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `units.ts` uses `recomputePeriod(...).balances`

**Files:**
- Modify: `apps/web/tools/gen/project/units.ts`

Replace the local `sumByMode` preventivo/consuntivo derivation with `recomputePeriod(state).balances`, keyed per resident. Keep the `individualByResident` fold into consuntivo, the `versato`/`saldoPrec` values (now sourced from `balances`), and `totDovuto = saldoPrec + preventivo`. `opening`/`paid` in the state reproduce `startingBalance`/`−takings`, so `b.saldoPrecCents`/`b.versatoCents` equal today's values.

- [ ] **Step 1: Edit the imports**

In `apps/web/tools/gen/project/units.ts`:

Replace
```ts
import { buildRiparto, type Mode, type Money } from "@cl/domain";
```
with
```ts
import { recomputePeriod, type Money } from "@cl/domain";
```
(`Mode` is no longer used here — its only use was inside `sumByMode`, removed below.)

Replace
```ts
import { dbToRipartoInput } from "./ripartoInput.ts";
```
with
```ts
import { dbToPeriodState } from "./periodState.ts";
```

- [ ] **Step 2: Replace the engine + sumByMode block**

Replace this block (the `buildRiparto` call through `consuntivoByResident`):
```ts
  // Riparto engine: per-resident preventivo (estimate) / consuntivo (current),
  // summed across all linked expense accounts via the faithful distribution.
  const eng = buildRiparto(dbToRipartoInput(db, periodId));
  const sumByMode = (mode: Mode): Map<string, number> => {
    const out = new Map<string, number>();
    for (const legacyUnitId of eng.unitLegacyIds) {
      for (const col of eng.columns) {
        const split = eng.perResidentAmount(col.legacyAccountId, mode, legacyUnitId);
        for (const [resId, cents] of split) {
          out.set(resId, (out.get(resId) ?? 0) + cents);
        }
      }
    }
    return out;
  };
  const preventivoByResident = sumByMode("estimate");
  const consuntivoByResident = sumByMode("current");
```
with:
```ts
  // Per-resident balances via the pure cascade. We use only the riparto-derived
  // preventivo/consuntivo/saldoPrec/versato; consuntivo gets the individual-expense
  // fold below and totDovuto stays saldoPrec + preventivo (generator semantics).
  const balancesById = new Map(
    recomputePeriod(dbToPeriodState(db, periodId)).balances.map((b) => [b.residentId, b]),
  );
```

- [ ] **Step 3: Rewire the resident row to read from `balancesById`**

In the resident `.map(...)` (the `resRows` builder), replace these lines:
```ts
      const saldoPrec = eur(str(r.startingBalance)).cents;
      const preventivo = preventivoByResident.get(String(r.id)) ?? 0;
      const consuntivo =
        (consuntivoByResident.get(String(r.id)) ?? 0) +
        (individualByResident.get(String(r.id)) ?? 0);
      // takings credit the resident (negative in the ledger); negate to get paid-in positive
      const versato = -(takingsByResident.get(String(r.id)) ?? 0);
```
with:
```ts
      const bal = balancesById.get(String(r.id));
      const saldoPrec = bal?.saldoPrecCents ?? 0;
      const preventivo = bal?.preventivoCents ?? 0;
      const consuntivo =
        (bal?.consuntivoCents ?? 0) + (individualByResident.get(String(r.id)) ?? 0);
      const versato = bal?.versatoCents ?? 0;
```

Leave the row object (`totDovuto: m(saldoPrec + preventivo)`, etc.) and everything else unchanged. Note `takingsByResident` is still computed (it feeds the adapter's truth indirectly) — but it is no longer read here; KEEP the `takingsByResident`/`individualByResident` extraction block (lines ~79–96) because `individualByResident` is still used. (`takingsByResident` becomes unused after this edit — remove ONLY the `takingsByResident` Map and its population to satisfy `noUnusedLocals`; keep `individualByResident`. See Step 4.)

- [ ] **Step 4: Drop the now-unused `takingsByResident`**

In the `for (const e of db.rows("ledgerEntry"))` loop, remove the `takingsByResident` branch so only `individualByResident` remains:

Replace:
```ts
  const takingsByResident = new Map<string, number>();
  const individualByResident = new Map<string, number>();
  for (const e of db.rows("ledgerEntry")) {
    if (!txInPeriod.has(String(e.ledgerTransactionId))) continue;
    if (String(e.type) === "unitResidentTakings") {
      const ur = str(e.unitResidentId);
      if (!ur) continue;
      takingsByResident.set(ur, (takingsByResident.get(ur) ?? 0) + eur(str(e.amount)).cents);
    } else {
      // Directly-attributed individual expenses: expenses-kind accounts with a
      // unitResidentId set (e.g. postal/reminder fees charged to specific residents).
      // These are NOT in any riparto linked subtree, so adding them is not a double-count.
      const ur = str(e.unitResidentId);
      if (!ur) continue;
      if (accountKindById.get(String(e.postingAccountId)) !== "expenses") continue;
      individualByResident.set(ur, (individualByResident.get(ur) ?? 0) + eur(str(e.amount)).cents);
    }
  }
```
with:
```ts
  // Directly-attributed individual expenses: expenses-kind accounts with a
  // unitResidentId set (e.g. postal/reminder fees charged to specific residents).
  // These are NOT in any riparto linked subtree, so adding them is not a double-count.
  // (Versato/takings now come from recomputePeriod's balances via dbToPeriodState.)
  const individualByResident = new Map<string, number>();
  for (const e of db.rows("ledgerEntry")) {
    if (!txInPeriod.has(String(e.ledgerTransactionId))) continue;
    if (String(e.type) === "unitResidentTakings") continue;
    const ur = str(e.unitResidentId);
    if (!ur) continue;
    if (accountKindById.get(String(e.postingAccountId)) !== "expenses") continue;
    individualByResident.set(ur, (individualByResident.get(ur) ?? 0) + eur(str(e.amount)).cents);
  }
```

(`txInPeriod` and `accountKindById` are still used; keep them.)

- [ ] **Step 5: Regenerate the seed and assert byte-identity**

Run:
```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/apps/web && pnpm gen:data
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && git diff --stat apps/web/src/mock/data.generated.json
```
Expected: `git diff --stat` prints **nothing**. The `units.ts` rewrite must not change a single byte of the unit-balance output. If it does, the most likely cause is a residentId-keying or opening/paid mismatch in `dbToPeriodState` — fix that, do not accept the diff.

- [ ] **Step 6: Typecheck + parity specs + web suite**

Run, expecting all green:
```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && pnpm --filter @cl/web exec tsc --noEmit
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && pnpm --filter @cl/web test
```
Expected: tsc clean (no unused-locals errors); web suite green (295), parity specs green.

- [ ] **Step 7: Commit**

```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
git add apps/web/tools/gen/project/units.ts
git commit -m "$(cat <<'EOF'
refactor(gen): unit balances via recomputePeriod(state).balances (byte-identical)

preventivo/consuntivo/saldoPrec/versato now come from the pure cascade's balances;
the individual-expense fold and totDovuto = saldoPrec + preventivo are preserved.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Whole-repo verification + docs pointer

**Files:**
- Modify: `docs/domain/README.md`
- Verify: whole repo

- [ ] **Step 1: Final byte-identical + full verification**

Run, expecting all green and zero seed diff:
```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/apps/web && pnpm gen:data
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && git status --short
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && pnpm --filter @cl/domain test
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && pnpm --filter @cl/web exec tsc --noEmit
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && pnpm --filter @cl/web test
```
Expected: `git status --short` shows NO modification to `apps/web/src/mock/data.generated.json` (it was regenerated identically); only the docs change (next step) will be pending. `@cl/domain` 34 tests green; web tsc clean; web suite green (296 — the 295 prior + the 1 new `periodState.test.ts`; confirm the exact number and that the parity specs are among the passing).

- [ ] **Step 2: Extend the docs pointer**

In `docs/domain/README.md`, after the sentence added in Phase 1a about `recomputePeriod`, append:

```markdown
The build-time seed generator consumes it via `apps/web/tools/gen/project/periodState.ts`
(`dbToPeriodState`): distribution and per-resident balances are derived from
`recomputePeriod(state)` (byte-identical to the prior `buildRiparto` path); installments
remain on their legacy `installmentItem` source. The live-app reactive cascade is Phase 1b-2.
```

- [ ] **Step 3: Commit**

```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
git add docs/domain/README.md
git commit -m "$(cat <<'EOF'
docs(domain): note the generator now derives distribution+balances via recomputePeriod

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review checklist (completed)

**Spec coverage (Phase 1b-1 scope):** generator distribution via `recomputePeriod(...).riparto` (Task 2) ✓; generator per-resident balances via `recomputePeriod(...).balances` with the generator's individual-expense fold and `totDovuto` formula preserved (Task 3) ✓; shared `dbToPeriodState` adapter built and unit-tested for the app plan to mirror (Task 1) ✓; byte-identical seed gate enforced after each projector swap (Tasks 2, 3, 4) ✓; docs (Task 4) ✓. **Deliberately out of scope:** installments stay legacy (`projectInstallments` untouched) — decided in brainstorming on empirical grounds; the live-app reactive cascade is Phase 1b-2.

**Placeholder scan:** none — every edit shows exact before/after text; every run step gives the command and the expected result (byte-identity = empty diff; test counts stated).

**Type consistency:** `dbToPeriodState(db, periodId): PeriodState` defined in Task 1 and consumed unchanged in Tasks 2–3; reads `recomputePeriod(...).riparto` (Task 2) and `recomputePeriod(...).balances` whose `ResidentBalance` fields (`preventivoCents`/`consuntivoCents`/`saldoPrecCents`/`versatoCents`) are used in Task 3. `Mode` import removed from `units.ts` only after its sole use (`sumByMode`) is deleted; `Money` retained where `m()` is used. `takingsByResident` removed only after its last read is replaced by `bal.versatoCents`.

**Byte-identity reasoning:** `recomputePeriod(state).riparto === buildRiparto(state.riparto)` (orchestrator wraps the same call) → distribution unchanged. `balances` preventivo/consuntivo come from `perResidentTotals` (identical to the deleted `sumByMode`); `saldoPrecCents`/`versatoCents` come from `opening`/`paid` which reproduce `startingBalance`/`−takings` exactly; `totDovuto` and the individual-expense fold stay in `units.ts` → unit balances unchanged.
