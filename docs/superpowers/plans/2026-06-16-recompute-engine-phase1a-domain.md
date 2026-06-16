# Recompute Engine — Phase 1a (domain `recomputePeriod` core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pure cascade orchestrator `recomputePeriod(state: PeriodState): PeriodResult` to `@cl/domain`, built on the shipped `buildRiparto`, that derives per-resident installments and unit balances from the riparto matrices — fully unit-tested with a conservation/idempotence invariant battery. No generator or app change in this plan.

**Architecture:** `@cl/domain/riparto` gains `periodTypes.ts` (clean `PeriodState`/`PeriodResult`), two pure stages — `computeInstallments` (per-resident estimate ÷ plan, honouring overrides via the same residual-to-last rule as the app's `redistributeOverride`) and `computeBalances` (preventivo/consuntivo/saldoPrec/versato/totDovuto per resident) — and `recomputePeriod` chaining `buildRiparto` → per-resident totals → both stages. All amounts integer cents; `allocate` is the rounding primitive.

**Tech Stack:** TypeScript (ESM, extensionless relative imports within `@cl/domain`), Vitest, pnpm workspaces (`@cl/domain` resolved via `main: src/index.ts`).

**Spec:** `docs/superpowers/specs/2026-06-16-recompute-engine-design.md` → "Phase 1 — reconciled design" (this plan implements the **domain core**; the generator refactor + app reactive cascade are a follow-up plan, Phase 1b).

---

## Shared conventions (read first)

- **Branch:** `feat/recompute-engine-phase1` (already created; the reconciled spec is committed there). Stay on it.
- **`@cl/domain` is pure** — no imports from `@cl/application`, `apps/web`, or any `Db`/DTO/store type. Extensionless relative imports (`./types`, `./computeRiparto`, `../allocate`). Reuse the shipped `buildRiparto`, `allocate`, `RipartoInput`, `RipartoEngine`, `Mode`.
- **Scope discipline (YAGNI):** the spec's `PeriodResult` lists `postings` (the `estimateDistribution` double-entry). **No UI/DTO consumes postings in Phase 1**, so this plan does NOT implement a postings stage. `PeriodResult` here is `{ riparto, installments, balances }`. (If a posting consumer ever appears, it is a later, additive stage.) This is a deliberate, flagged deviation from the spec's superset.
- **Behaviour alignment with the generator:** the per-resident accumulation here mirrors `apps/web/tools/gen/project/units.ts`'s `sumByMode` (iterate `unitLegacyIds` × `columns`, accumulate `perResidentAmount` by residentId) so that when the generator adopts `recomputePeriod` in Phase 1b, unit balances stay byte-identical.
- **Override semantics** mirror `apps/web/src/recompute/installments.ts` `redistributeOverride`: an override sets one cell and spreads the delta across **later** cells via `allocate`; an override that would drive a later cell negative is **rejected** (that override is ignored and the resident keeps the plain even split).
- **Commit trailer:** end every commit body with a blank line then
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

**Test commands:**
- Domain tests: `pnpm --filter @cl/domain test`
- Domain typecheck: `pnpm --filter @cl/domain exec tsc --noEmit`
- Full web suite (must stay green — this plan does not touch it, but confirm at the end): `pnpm --filter @cl/web test`

**Confirmed current shapes (do not re-derive):**
- `packages/domain/src/riparto/types.ts` exports `Mode = "estimate" | "current"`, `RipartoInput`, `RipartoEngine`, `LinkRef`, `LinkedColumn`, `ResidentInfo`.
- `RipartoEngine` = `{ columns: LinkedColumn[]; perUnitAmount(accountId, mode, legacyUnitId): number; subtree(accountId): {estimateCents, actualCents}; perResidentAmount(accountId, mode, legacyUnitId): Map<string, number>; unitLegacyIds: string[] }`.
- `RipartoInput.residents` = `{ unitId: string; residentId: string; priorityId: string; percentage: number }[]`.
- `buildRiparto(input: RipartoInput): RipartoEngine` and `allocate(totalCents: number, weights: number[]): number[]` are exported from `@cl/domain`.

**File layout (created by this plan):**
```
packages/domain/src/riparto/
  periodTypes.ts          periodTypes is types-only           (Task 1)
  computeInstallments.ts  computeInstallments.test.ts         (Task 2)
  computeBalances.ts      computeBalances.test.ts             (Task 3)
  recomputePeriod.ts      recomputePeriod.test.ts             (Task 4)
  recomputePeriod.invariants.test.ts                          (Task 5)
packages/domain/src/index.ts   (export the new modules — Tasks 1,2,3,4)
docs/domain/README.md          (pointer — Task 6)
```

---

### Task 1: `PeriodState` / `PeriodResult` types

**Files:**
- Create: `packages/domain/src/riparto/periodTypes.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Create the types**

```ts
// packages/domain/src/riparto/periodTypes.ts
import type { RipartoInput, RipartoEngine } from "./types";

/** Ordered installment plan + manual per-resident-per-installment overrides. */
export interface InstallmentPlan {
  /** Installment ids in due order (sorted by expiry upstream). */
  installmentIds: string[];
  /** Manual cell overrides. Each pins one resident's one installment to `cents`. */
  overrides: { residentId: string; installmentId: string; cents: number }[];
}

/** Clean, store/DB-agnostic input to the period cascade. All money is integer cents. */
export interface PeriodState {
  /** The shipped Phase 0 riparto input (drives buildRiparto). */
  riparto: RipartoInput;
  /** Installment plan for this period. */
  plan: InstallmentPlan;
  /** saldoPrec (opening balance) cents, per residentId. */
  opening: Record<string, number>;
  /** versato (paid-in) cents, per residentId. */
  paid: Record<string, number>;
}

/** Per-resident rolled-up balances. */
export interface ResidentBalance {
  residentId: string;
  preventivoCents: number; // Σ estimate share across all columns
  consuntivoCents: number; // Σ current share across all columns
  saldoPrecCents: number; // opening
  versatoCents: number; // paid
  totDovutoCents: number; // preventivo + saldoPrec − versato
}

/** Fully recomputed, conserved period result. */
export interface PeriodResult {
  /** The riparto query object (per-unit / per-resident, per mode). */
  riparto: RipartoEngine;
  /** Per-resident → per-installment cents (honouring valid overrides). */
  installments: Map<string /*residentId*/, Map<string /*installmentId*/, number>>;
  /** Per-resident rolled-up balances. */
  balances: ResidentBalance[];
}
```

- [ ] **Step 2: Export from the barrel**

In `packages/domain/src/index.ts`, append after the existing riparto exports so it reads:

```ts
export * from "./money";
export * from "./allocate";
export * from "./riparto/types";
export * from "./riparto/computeRiparto";
export * from "./riparto/periodTypes";
```

(Preserve the existing lines; add only the `periodTypes` line. The `computeInstallments`/`computeBalances`/`recomputePeriod` exports are added in their own tasks.)

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @cl/domain exec tsc --noEmit`
Expected: exit 0 (types compile; `recomputePeriod` not yet implemented).

- [ ] **Step 4: Commit**

```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
git add packages/domain/src/riparto/periodTypes.ts packages/domain/src/index.ts
git commit -m "$(cat <<'EOF'
feat(domain): PeriodState/PeriodResult types for the recompute cascade

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `computeInstallments` stage

**Files:**
- Create: `packages/domain/src/riparto/computeInstallments.ts`
- Create: `packages/domain/src/riparto/computeInstallments.test.ts`
- Modify: `packages/domain/src/index.ts`

Splits each resident's total estimate (preventivo) across the plan's installments by even
weight, then applies valid overrides (residual-to-last spread; invalid override ignored).

- [ ] **Step 1: Write the failing test first**

```ts
// packages/domain/src/riparto/computeInstallments.test.ts
import { describe, it, expect } from "vitest";
import { computeInstallments } from "./computeInstallments";
import type { InstallmentPlan } from "./periodTypes";

const plan = (overrides: InstallmentPlan["overrides"] = []): InstallmentPlan => ({
  installmentIds: ["i1", "i2", "i3"],
  overrides,
});

describe("computeInstallments", () => {
  it("splits each resident's estimate evenly across installments (residual to last via allocate)", () => {
    const est = new Map<string, number>([["r1", 100]]); // 100 cents / 3 → 34,33,33
    const out = computeInstallments(est, plan());
    const cells = out.get("r1")!;
    expect(cells.get("i1")).toBe(34);
    expect(cells.get("i2")).toBe(33);
    expect(cells.get("i3")).toBe(33);
    expect([...cells.values()].reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("conserves: Σ cells equals the resident estimate for arbitrary totals", () => {
    const est = new Map<string, number>([["r1", 99901], ["r2", 1]]);
    const out = computeInstallments(est, plan());
    for (const [rid, cents] of est) {
      expect([...out.get(rid)!.values()].reduce((a, b) => a + b, 0)).toBe(cents);
    }
  });

  it("applies a valid override and spreads the delta across LATER cells (conserved)", () => {
    const est = new Map<string, number>([["r1", 300]]); // even → 100,100,100
    const out = computeInstallments(est, plan([{ residentId: "r1", installmentId: "i1", cents: 150 }]));
    const cells = out.get("r1")!;
    expect(cells.get("i1")).toBe(150); // pinned
    // delta −50 spread across later cells [i2,i3] via allocate(-50,[1,1]) = [-25,-25]
    expect(cells.get("i2")).toBe(75);
    expect(cells.get("i3")).toBe(75);
    expect([...cells.values()].reduce((a, b) => a + b, 0)).toBe(300);
  });

  it("ignores an override that would drive a later cell negative (keeps even split)", () => {
    const est = new Map<string, number>([["r1", 300]]); // even → 100,100,100
    // override i1 to 350: delta = 100 − 350 = −250; later [100,100] + allocate(−250,[1,1])=[−125,−125]
    // → projected [−25,−25] is negative → REJECT, resident keeps the even split
    const out = computeInstallments(est, plan([{ residentId: "r1", installmentId: "i1", cents: 350 }]));
    const cells = out.get("r1")!;
    expect(cells.get("i1")).toBe(100);
    expect(cells.get("i2")).toBe(100);
    expect(cells.get("i3")).toBe(100);
  });

  it("returns an empty plan map when there are no installments", () => {
    const est = new Map<string, number>([["r1", 100]]);
    const out = computeInstallments(est, { installmentIds: [], overrides: [] });
    expect(out.get("r1")!.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @cl/domain exec vitest run src/riparto/computeInstallments.test.ts`
Expected: FAIL with "computeInstallments is not a function" / module not found.

- [ ] **Step 3: Implement the stage**

```ts
// packages/domain/src/riparto/computeInstallments.ts
import { allocate } from "../allocate";
import type { InstallmentPlan } from "./periodTypes";

/**
 * Split each resident's total estimate across the plan's installments.
 * Even split via largest-remainder `allocate`; then apply valid overrides.
 * An override pins one cell and spreads the delta across LATER cells (residual-to-last,
 * same rule as the app's redistributeOverride). An override that would drive a later cell
 * negative is rejected (ignored) and that resident keeps the even split.
 * Σ cells per resident always equals that resident's estimate.
 */
export function computeInstallments(
  estimateByResident: Map<string, number>,
  plan: InstallmentPlan,
): Map<string, Map<string, number>> {
  const ids = plan.installmentIds;
  const overridesByResident = new Map<string, { installmentId: string; cents: number }[]>();
  for (const o of plan.overrides) {
    (overridesByResident.get(o.residentId) ?? overridesByResident.set(o.residentId, []).get(o.residentId)!)
      .push({ installmentId: o.installmentId, cents: o.cents });
  }

  const out = new Map<string, Map<string, number>>();
  for (const [residentId, totalCents] of estimateByResident) {
    const cells = new Map<string, number>();
    if (ids.length === 0) {
      out.set(residentId, cells);
      continue;
    }
    // even split (residual to last)
    let amounts = allocate(totalCents, ids.map(() => 1));
    // apply overrides in installment order
    const myOverrides = (overridesByResident.get(residentId) ?? [])
      .slice()
      .sort((a, b) => ids.indexOf(a.installmentId) - ids.indexOf(b.installmentId));
    for (const ov of myOverrides) {
      const idx = ids.indexOf(ov.installmentId);
      if (idx < 0) continue;
      amounts = applyOverride(amounts, idx, ov.cents);
    }
    for (let i = 0; i < ids.length; i++) cells.set(ids[i]!, amounts[i]!);
    out.set(residentId, cells);
  }
  return out;
}

/** Pin cell `index` to `newValue`, spreading the delta across later cells.
 *  Rejects (returns the input unchanged) if any later cell would go negative. */
function applyOverride(cells: number[], index: number, newValue: number): number[] {
  if (newValue < 0) return cells;
  const delta = cells[index]! - newValue; // amount to redistribute to later cells
  const later = cells.slice(index + 1);
  if (later.length === 0) return cells; // nothing to absorb the delta
  const spread = allocate(delta, later.map(() => 1));
  const projected = later.map((c, i) => c + spread[i]!);
  if (projected.some((c) => c < 0)) return cells; // reject
  const next = cells.slice();
  next[index] = newValue;
  for (let i = 0; i < projected.length; i++) next[index + 1 + i] = projected[i]!;
  return next;
}
```

- [ ] **Step 4: Run the test (expect PASS)**

Run: `pnpm --filter @cl/domain exec vitest run src/riparto/computeInstallments.test.ts`
Expected: PASS (5 cases). Note the rejection-case arithmetic: `allocate` is called with a negative delta, which it handles symmetrically (`allocate(-150,[1,1]) = [-75,-75]`); for total 300 → even [100,100,100], override i1=350 gives delta −50… recheck: delta = 100 − 350 = −250; later = [100,100]; `allocate(-250,[1,1]) = [-125,-125]`; projected = [−25,−25] → negative → reject. Good.

- [ ] **Step 5: Export from the barrel**

In `packages/domain/src/index.ts` append:

```ts
export * from "./riparto/computeInstallments";
```

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm --filter @cl/domain exec tsc --noEmit` (exit 0).

```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
git add packages/domain/src/riparto/computeInstallments.ts packages/domain/src/riparto/computeInstallments.test.ts packages/domain/src/index.ts
git commit -m "$(cat <<'EOF'
feat(domain): computeInstallments stage (even split + override redistribution)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `computeBalances` stage

**Files:**
- Create: `packages/domain/src/riparto/computeBalances.ts`
- Create: `packages/domain/src/riparto/computeBalances.test.ts`
- Modify: `packages/domain/src/index.ts`

Rolls per-resident preventivo (Σ estimate share) and consuntivo (Σ current share) out of the
engine, then computes saldoPrec/versato/totDovuto. Enumerates residents from the input roster
(so zero-amount residents still appear), matching `units.ts`'s `sumByMode` accumulation.

- [ ] **Step 1: Write the failing test first**

```ts
// packages/domain/src/riparto/computeBalances.test.ts
import { describe, it, expect } from "vitest";
import { computeBalances, perResidentTotals } from "./computeBalances";
import { buildRiparto } from "./computeRiparto";
import type { RipartoInput } from "./types";

// account A linked to table T 100%; units u1/u2 coeff 60/40; estimate 100000, actual 50000.
// one owner resident per unit.
const input: RipartoInput = {
  accounts: [{ id: "A", name: "Spese", order: 1, parentId: null }],
  links: [{ accountId: "A", linkId: "L1", tableId: "T", pct: 100, type: null }],
  estimateCentsByAccount: { A: 100000 },
  actualCentsByAccount: { A: 50000 },
  tableItems: [
    { tableId: "T", unitId: "u1", coefficient: 60 },
    { tableId: "T", unitId: "u2", coefficient: 40 },
  ],
  roles: [],
  residents: [
    { unitId: "u1", residentId: "r1", priorityId: "1", percentage: 100 },
    { unitId: "u2", residentId: "r2", priorityId: "1", percentage: 100 },
  ],
  unitLegacyIds: ["u1", "u2"],
};

describe("perResidentTotals", () => {
  it("accumulates per-resident estimate across units and columns", () => {
    const eng = buildRiparto(input);
    const est = perResidentTotals(eng, "estimate");
    expect(est.get("r1")).toBe(60000);
    expect(est.get("r2")).toBe(40000);
  });
});

describe("computeBalances", () => {
  it("computes preventivo/consuntivo/saldoPrec/versato/totDovuto per resident", () => {
    const eng = buildRiparto(input);
    const balances = computeBalances(
      input.residents,
      eng,
      { r1: 5000 }, // opening (saldoPrec)
      { r2: 2000 }, // paid (versato)
    );
    const r1 = balances.find((b) => b.residentId === "r1")!;
    expect(r1.preventivoCents).toBe(60000);
    expect(r1.consuntivoCents).toBe(30000); // 50000 * 60/100
    expect(r1.saldoPrecCents).toBe(5000);
    expect(r1.versatoCents).toBe(0);
    expect(r1.totDovutoCents).toBe(60000 + 5000 - 0);

    const r2 = balances.find((b) => b.residentId === "r2")!;
    expect(r2.preventivoCents).toBe(40000);
    expect(r2.consuntivoCents).toBe(20000);
    expect(r2.saldoPrecCents).toBe(0);
    expect(r2.versatoCents).toBe(2000);
    expect(r2.totDovutoCents).toBe(40000 + 0 - 2000);
  });

  it("includes a roster resident with zero shares", () => {
    const eng = buildRiparto(input);
    const balances = computeBalances(
      [...input.residents, { unitId: "u3", residentId: "r3", priorityId: "1", percentage: 100 }],
      eng,
      {},
      {},
    );
    const r3 = balances.find((b) => b.residentId === "r3")!;
    expect(r3.preventivoCents).toBe(0);
    expect(r3.consuntivoCents).toBe(0);
    expect(r3.totDovutoCents).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @cl/domain exec vitest run src/riparto/computeBalances.test.ts`
Expected: FAIL (module not found / not a function).

- [ ] **Step 3: Implement the stage**

```ts
// packages/domain/src/riparto/computeBalances.ts
import type { Mode, RipartoEngine } from "./types";
import type { ResidentBalance } from "./periodTypes";

/**
 * Sum each resident's share for a mode across every column and unit.
 * Mirrors apps/web/tools/gen/project/units.ts `sumByMode` so the generator's
 * unit balances stay byte-identical when it adopts recomputePeriod.
 */
export function perResidentTotals(eng: RipartoEngine, mode: Mode): Map<string, number> {
  const out = new Map<string, number>();
  for (const legacyUnitId of eng.unitLegacyIds) {
    for (const col of eng.columns) {
      const split = eng.perResidentAmount(col.legacyAccountId, mode, legacyUnitId);
      for (const [residentId, cents] of split) {
        out.set(residentId, (out.get(residentId) ?? 0) + cents);
      }
    }
  }
  return out;
}

/**
 * Per-resident rolled-up balances. Residents come from `roster` so zero-share
 * residents still appear. totDovuto = preventivo + saldoPrec − versato.
 */
export function computeBalances(
  roster: { residentId: string }[],
  eng: RipartoEngine,
  opening: Record<string, number>,
  paid: Record<string, number>,
): ResidentBalance[] {
  const preventivo = perResidentTotals(eng, "estimate");
  const consuntivo = perResidentTotals(eng, "current");
  const seen = new Set<string>();
  const balances: ResidentBalance[] = [];
  for (const { residentId } of roster) {
    if (seen.has(residentId)) continue;
    seen.add(residentId);
    const preventivoCents = preventivo.get(residentId) ?? 0;
    const consuntivoCents = consuntivo.get(residentId) ?? 0;
    const saldoPrecCents = opening[residentId] ?? 0;
    const versatoCents = paid[residentId] ?? 0;
    balances.push({
      residentId,
      preventivoCents,
      consuntivoCents,
      saldoPrecCents,
      versatoCents,
      totDovutoCents: preventivoCents + saldoPrecCents - versatoCents,
    });
  }
  return balances;
}
```

- [ ] **Step 4: Run the test (expect PASS)**

Run: `pnpm --filter @cl/domain exec vitest run src/riparto/computeBalances.test.ts`
Expected: PASS (4 assertions across 3 cases).

- [ ] **Step 5: Export from the barrel**

In `packages/domain/src/index.ts` append:

```ts
export * from "./riparto/computeBalances";
```

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm --filter @cl/domain exec tsc --noEmit` (exit 0).

```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
git add packages/domain/src/riparto/computeBalances.ts packages/domain/src/riparto/computeBalances.test.ts packages/domain/src/index.ts
git commit -m "$(cat <<'EOF'
feat(domain): computeBalances stage (per-resident preventivo/consuntivo/totDovuto)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `recomputePeriod` orchestrator

**Files:**
- Create: `packages/domain/src/riparto/recomputePeriod.ts`
- Create: `packages/domain/src/riparto/recomputePeriod.test.ts`
- Modify: `packages/domain/src/index.ts`

Chains `buildRiparto` → per-resident estimate totals → `computeInstallments` + `computeBalances`.

- [ ] **Step 1: Write the failing test first**

```ts
// packages/domain/src/riparto/recomputePeriod.test.ts
import { describe, it, expect } from "vitest";
import { recomputePeriod } from "./recomputePeriod";
import type { PeriodState } from "./periodTypes";

const state: PeriodState = {
  riparto: {
    accounts: [{ id: "A", name: "Spese", order: 1, parentId: null }],
    links: [{ accountId: "A", linkId: "L1", tableId: "T", pct: 100, type: null }],
    estimateCentsByAccount: { A: 100000 },
    actualCentsByAccount: { A: 0 },
    tableItems: [
      { tableId: "T", unitId: "u1", coefficient: 60 },
      { tableId: "T", unitId: "u2", coefficient: 40 },
    ],
    roles: [],
    residents: [
      { unitId: "u1", residentId: "r1", priorityId: "1", percentage: 100 },
      { unitId: "u2", residentId: "r2", priorityId: "1", percentage: 100 },
    ],
    unitLegacyIds: ["u1", "u2"],
  },
  plan: { installmentIds: ["i1", "i2"], overrides: [] },
  opening: { r1: 1000 },
  paid: {},
};

describe("recomputePeriod", () => {
  it("returns riparto engine, installments, and balances", () => {
    const r = recomputePeriod(state);
    expect(r.riparto.unitLegacyIds).toEqual(["u1", "u2"]);
    expect(r.balances.find((b) => b.residentId === "r1")!.preventivoCents).toBe(60000);
    // installments: r1 preventivo 60000 over 2 → 30000,30000
    const r1cells = r.installments.get("r1")!;
    expect(r1cells.get("i1")).toBe(30000);
    expect(r1cells.get("i2")).toBe(30000);
  });

  it("installment cells per resident sum to that resident's preventivo", () => {
    const r = recomputePeriod(state);
    for (const b of r.balances) {
      const cells = r.installments.get(b.residentId);
      const sum = cells ? [...cells.values()].reduce((a, c) => a + c, 0) : 0;
      expect(sum).toBe(b.preventivoCents);
    }
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @cl/domain exec vitest run src/riparto/recomputePeriod.test.ts`
Expected: FAIL (module not found / not a function).

- [ ] **Step 3: Implement the orchestrator**

```ts
// packages/domain/src/riparto/recomputePeriod.ts
import { buildRiparto } from "./computeRiparto";
import { perResidentTotals, computeBalances } from "./computeBalances";
import { computeInstallments } from "./computeInstallments";
import type { PeriodState, PeriodResult } from "./periodTypes";

/**
 * Pure period cascade. Depends only on `state`. Integer cents throughout.
 * riparto (buildRiparto) → per-resident estimate totals → installments + balances.
 * Installments derive from the SAME per-resident estimate the balances use, so
 * Σ installment cells == resident preventivo by construction.
 */
export function recomputePeriod(state: PeriodState): PeriodResult {
  const riparto = buildRiparto(state.riparto);
  const estimateByResident = perResidentTotals(riparto, "estimate");
  const installments = computeInstallments(estimateByResident, state.plan);
  const balances = computeBalances(state.riparto.residents, riparto, state.opening, state.paid);
  return { riparto, installments, balances };
}
```

- [ ] **Step 4: Run the test (expect PASS)**

Run: `pnpm --filter @cl/domain exec vitest run src/riparto/recomputePeriod.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Export from the barrel**

In `packages/domain/src/index.ts` append:

```ts
export * from "./riparto/recomputePeriod";
```

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm --filter @cl/domain exec tsc --noEmit` (exit 0).

```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
git add packages/domain/src/riparto/recomputePeriod.ts packages/domain/src/riparto/recomputePeriod.test.ts packages/domain/src/index.ts
git commit -m "$(cat <<'EOF'
feat(domain): recomputePeriod cascade orchestrator (riparto -> installments + balances)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Invariant battery (conservation + idempotence)

**Files:**
- Create: `packages/domain/src/riparto/recomputePeriod.invariants.test.ts`

Property-style checks over crafted multi-column / owner-tenant / rounding-edge fixtures. These
are the post-edit coherence bar from the spec (there is no post-edit oracle).

- [ ] **Step 1: Write the invariant tests**

```ts
// packages/domain/src/riparto/recomputePeriod.invariants.test.ts
import { describe, it, expect } from "vitest";
import { recomputePeriod } from "./recomputePeriod";
import { perResidentTotals } from "./computeBalances";
import type { PeriodState } from "./periodTypes";

// Two linked accounts, two tables, owner/tenant role split on one link, rounding-edge totals.
const state: PeriodState = {
  riparto: {
    accounts: [
      { id: "A", name: "Acqua", order: 1, parentId: null },
      { id: "B", name: "Scale", order: 2, parentId: null },
    ],
    links: [
      { accountId: "A", linkId: "LA", tableId: "T1", pct: 100, type: null },
      { accountId: "B", linkId: "LB", tableId: "T2", pct: 100, type: null },
    ],
    estimateCentsByAccount: { A: 100001, B: 99999 }, // odd totals → rounding stress
    actualCentsByAccount: { A: 33333, B: 66667 },
    tableItems: [
      { tableId: "T1", unitId: "u1", coefficient: 333 },
      { tableId: "T1", unitId: "u2", coefficient: 333 },
      { tableId: "T1", unitId: "u3", coefficient: 334 },
      { tableId: "T2", unitId: "u1", coefficient: 1 },
      { tableId: "T2", unitId: "u2", coefficient: 1 },
      { tableId: "T2", unitId: "u3", coefficient: 1 },
    ],
    roles: [
      { linkId: "LA", priorityId: "1", percentage: 70 },
      { linkId: "LA", priorityId: "3", percentage: 30 },
    ],
    residents: [
      { unitId: "u1", residentId: "o1", priorityId: "1", percentage: 100 },
      { unitId: "u1", residentId: "t1", priorityId: "3", percentage: 100 },
      { unitId: "u2", residentId: "o2", priorityId: "1", percentage: 100 },
      { unitId: "u3", residentId: "o3", priorityId: "1", percentage: 100 },
    ],
    unitLegacyIds: ["u1", "u2", "u3"],
  },
  plan: { installmentIds: ["i1", "i2", "i3"], overrides: [{ residentId: "o2", installmentId: "i1", cents: 1 }] },
  opening: { o1: 500, o2: -200 },
  paid: { o3: 100 },
};

describe("recomputePeriod invariants", () => {
  it("conservation: per-resident estimate Σ equals per-unit estimate Σ (the matrix splits exactly)", () => {
    const r = recomputePeriod(state);
    const perResident = [...perResidentTotals(r.riparto, "estimate").values()].reduce((a, c) => a + c, 0);
    const perUnit = r.riparto.unitLegacyIds.reduce(
      (s, u) => s + r.riparto.columns.reduce((c, col) => c + r.riparto.perUnitAmount(col.legacyAccountId, "estimate", u), 0),
      0,
    );
    expect(perResident).toBe(perUnit);
  });

  it("installment cells Σ equals resident preventivo (conserved, overrides included)", () => {
    const r = recomputePeriod(state);
    for (const b of r.balances) {
      const cells = r.installments.get(b.residentId);
      const sum = cells ? [...cells.values()].reduce((a, c) => a + c, 0) : 0;
      expect(sum).toBe(b.preventivoCents);
    }
  });

  it("balances: totDovuto = preventivo + saldoPrec − versato for every resident", () => {
    const r = recomputePeriod(state);
    for (const b of r.balances) {
      expect(b.totDovutoCents).toBe(b.preventivoCents + b.saldoPrecCents - b.versatoCents);
    }
  });

  it("idempotence/determinism: recompute twice yields identical results", () => {
    const a = recomputePeriod(state);
    const b = recomputePeriod(state);
    const norm = (r: ReturnType<typeof recomputePeriod>) => ({
      balances: r.balances,
      installments: [...r.installments].map(([rid, cells]) => [rid, [...cells.entries()]]),
      estimate: [...perResidentTotals(r.riparto, "estimate").entries()],
    });
    expect(norm(a)).toEqual(norm(b));
  });

  it("owner/tenant split conserves within the unit (o1 + t1 estimate = unit u1 estimate)", () => {
    const r = recomputePeriod(state);
    const est = perResidentTotals(r.riparto, "estimate");
    const u1Total = r.riparto.columns.reduce((c, col) => c + r.riparto.perUnitAmount(col.legacyAccountId, "estimate", "u1"), 0);
    expect((est.get("o1") ?? 0) + (est.get("t1") ?? 0)).toBe(u1Total);
  });
});
```

- [ ] **Step 2: Run the invariant tests (expect PASS)**

Run: `pnpm --filter @cl/domain exec vitest run src/riparto/recomputePeriod.invariants.test.ts`
Expected: PASS (5 cases). If conservation fails, the bug is in `perResidentTotals`/`recomputePeriod`, not the test — investigate the accumulation, do not weaken the assertion.

- [ ] **Step 3: Commit**

```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
git add packages/domain/src/riparto/recomputePeriod.invariants.test.ts
git commit -m "$(cat <<'EOF'
test(domain): recomputePeriod invariant battery (conservation, idempotence, role split)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Docs pointer + whole-repo verification

**Files:**
- Modify: `docs/domain/README.md`
- Test: whole-repo verification

- [ ] **Step 1: Extend the docs pointer**

In `docs/domain/README.md`, find the "Riparto engine" paragraph added in Phase 0 and append a sentence after it:

```markdown
The period cascade `packages/domain/src/riparto/recomputePeriod.ts` builds on it (pure
`recomputePeriod(state) → { riparto, installments, balances }`); Phase 1b wires the generator
and the live app through it.
```

- [ ] **Step 2: Whole-repo verification**

Run, expecting all green:
```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && pnpm --filter @cl/domain exec tsc --noEmit
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && pnpm --filter @cl/domain test
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && pnpm --filter @cl/web test
git status --short
```
Expected: domain tsc clean; domain tests green (money + allocate + computeRiparto + computeInstallments + computeBalances + recomputePeriod + invariants); full web suite **unchanged** (this plan touches only `@cl/domain` + docs, so the 295 web tests stay green); `git status` shows only the staged docs change.

- [ ] **Step 3: Commit**

```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
git add docs/domain/README.md
git commit -m "$(cat <<'EOF'
docs(domain): point at the recomputePeriod cascade (Phase 1a)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review checklist (completed)

**Spec coverage (Phase 1a scope):** `PeriodState`/`PeriodResult` clean types (Task 1) ✓; installments derived from riparto with override redistribution (Task 2) ✓; per-resident balances preventivo/consuntivo/saldoPrec/versato/totDovuto (Task 3) ✓; `recomputePeriod` orchestrator on top of the shipped `buildRiparto` (Task 4) ✓; invariant battery incl. idempotence (Task 5) ✓; docs (Task 6) ✓. **Deliberately deferred:** the `postings` stage (no Phase-1 UI consumer — flagged in Shared conventions); the generator refactor + app reactive cascade (Phase 1b, a separate plan written against this concrete `recomputePeriod` API).

**Placeholder scan:** none — every code step shows complete source; every run step gives the exact command and expected result; the override rejection arithmetic is worked through in Task 2 Step 4.

**Type consistency:** `PeriodState`/`PeriodResult`/`InstallmentPlan`/`ResidentBalance` defined in Task 1 and used unchanged in Tasks 2–5; `perResidentTotals` and `computeBalances` signatures defined in Task 3 and reused in Tasks 4–5; `computeInstallments(estimateByResident, plan)` consistent across Tasks 2/4; `recomputePeriod(state): PeriodResult` consistent across Tasks 4–6. Reuses only the shipped `buildRiparto`/`allocate`/`Mode`/`RipartoEngine`/`RipartoInput` — no new dependencies, `@cl/domain` stays pure.
