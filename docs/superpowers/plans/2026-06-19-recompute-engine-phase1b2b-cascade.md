# Recompute Engine — Phase 1b-2b (live reactive riparto cascade) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the live app derive distribution + per-unit/per-resident balances by running the pure `recomputePeriod` engine over a `PeriodState` assembled from the editable subjects, retiring the bespoke `recomputeDistribution`, so editing a coefficient, a budget, a payment, or posting an invoice cascades correctly everywhere.

**Architecture:** Inputs stay their own rxjs subjects (`tables$`, `accounts$`, new `paid$`). Per period a live `PeriodState` is assembled from them (overriding the seeded engine input from Phase 1b-2a), fed to `recomputePeriod`, and the engine's fresh money cells are overlaid onto the seeded DTO skeletons (`unitsByPeriod`, `distributionByPeriod`). Periods without a seeded `PeriodState` (the hand-built fixture seed; structure-only periods) fall back to the static seeded DTO. Installments stay a command-patched source.

**Tech Stack:** TypeScript (strict; `noUnusedLocals`, `noUncheckedIndexedAccess`; explicit `.ts`-less package imports, no relative `.ts` extensions in `src`), rxjs (`combineLatest`/`map`), Vitest, pnpm workspaces. `@cl/domain` exports `recomputePeriod`, `PeriodState`, `RipartoEngine`, `ResidentBalance`, `Mode`, `Money`. `@cl/application` provides the DTO types.

**Spec:** `docs/superpowers/specs/2026-06-19-recompute-engine-phase1b2b-design.md`.

---

## Shared conventions (read first)

- **Branch:** create and stay on `feat/recompute-engine-phase1b2b-cascade` (off `main`).
- **Commit trailer:** end every commit body with a blank line then
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Commit via CLI** (the user's GUI git client breaks on accented filenames; many files here contain accented Italian strings).
- **`src` import style:** package imports `from "@cl/domain"` / `from "@cl/application"` (no extension); relative imports in `apps/web/src` use **no** file extension (e.g. `from "./cascade"`, `from "../recompute/summary"`) — match the existing files.
- **No seed regeneration.** This phase is app-only. `apps/web/src/mock/data.generated.json` must **not** change; everything the cascade needs was seeded in Phase 1b-2a (`periodStateByPeriod`, `individualByPeriod`). A `git status` check guards this in Task 5.
- **The headline gate** is Task 2: for every book period in the generated seed, assembling a live `PeriodState` from the seed's own subjects, running `recomputePeriod`, and overlaying onto the seeded DTO reproduces the seeded DTO **exactly** (`toEqual`). This proves the assemble+overlay+id-mapping+sign conventions are faithful before any store wiring.

**Commands:**
- Web tests: `pnpm --filter @cl/web test`
- A single test file: `cd apps/web && pnpm exec vitest run <path-relative-to-apps/web>`
- Web typecheck: `pnpm --filter @cl/web exec tsc --noEmit`
- Domain tests: `pnpm --filter @cl/domain test`

**Confirmed facts (do not re-derive):**
- `recomputePeriod(state: PeriodState): { riparto: RipartoEngine; installments; balances: ResidentBalance[] }`.
- `RipartoEngine.perUnitAmount(legacyAccountId, mode: "estimate"|"current", legacyUnitId): number` (cents). `Mode = "estimate" | "current"`; `DistributionType = "estimate" | "current"` (identical string union).
- `ResidentBalance = { residentId; preventivoCents; consuntivoCents; saldoPrecCents; versatoCents; totDovutoCents }`. **Use `saldoPrec + preventivo` for `totDovuto`** in the unit overlay (generator semantics in `units.ts`), NOT `totDovutoCents`.
- `PeriodState = { riparto: RipartoInput; plan; opening: Record<string,number>; paid: Record<string,number> }`. `RipartoInput` holds `tableItems: {tableId,unitId,coefficient}[]`, `estimateCentsByAccount: Record<string,number>`, `actualCentsByAccount: Record<string,number>` keyed by **raw legacy ids**, plus static `accounts/links/roles/residents/unitLegacyIds`.
- **DTO id ↔ legacy id:** distribution column `accountId = la${legacyAccountId}`; account row `id = la${legacyId}`; table `id = dt${legacyId}`, item `unitId = u${legacyId}`; unit/resident row `id = u${legacyId}` / `r${legacyId}`. Strip the prefix to recover the legacy id.
- **Sign/keying (verified in `apps/web/tools/gen/project/accounting.ts`):** a leaf account row's `saldo.cents` equals the generator's `actualCentsByAccount[id]` (both `= ownSigned`); a leaf account's `preventivo.cents` equals `estimateCentsByAccount[id]`. So reading `accounts$` leaf `saldo`/`preventivo` reproduces the engine input exactly — no `txns$` summation needed.
- **Seed sources:** live app = `createGeneratedDataSource()` (`new MockStore(generatedSeed)`); tests/dev = `createMockDataSource()` (`new MockStore()` → `fixtureSeed`, which has **no** `periodStateByPeriod`). `MockStoreSeed.periodStateByPeriod` / `individualByPeriod` are optional.
- `recompute/distribution.ts` exports `recomputeDistribution` (retired here) **and** `roundingByColumn` (KEEP — used by `apps/web/src/sections/tabelle/TabelleSection.tsx`).

**File layout (this plan):**
```
apps/web/src/mock/
  cascade.ts                  liveState + overlayDistribution + overlayUnits     (Task 1, new)
  cascade.test.ts             pure-helper unit tests                             (Task 1, new)
  cascade.equivalence.test.ts on-load equivalence vs generated seed (THE GATE)   (Task 2, new)
  MockStore.ts                derive distribution()/unitsTree(); paid$; rewire triggers (Tasks 3,4, modify)
  MockStore.test.ts           move 2 fixture behaviour tests to generated seed   (Tasks 3,4, modify)
apps/web/src/recompute/
  distribution.ts             remove recomputeDistribution (keep roundingByColumn) (Task 5, modify)
  distribution.test.ts        drop recomputeDistribution cases (keep rounding)    (Task 5, modify)
docs/domain/README.md         pointer                                            (Task 5, modify)
```

---

### Task 1: Pure cascade helpers (`cascade.ts`)

**Files:**
- Create: `apps/web/src/mock/cascade.ts`
- Create: `apps/web/src/mock/cascade.test.ts`

Three pure functions, no rxjs, no store. `liveState` assembles a `PeriodState` from the editable subjects; `overlayDistribution`/`overlayUnits` paint engine money onto a seeded DTO skeleton.

- [ ] **Step 1: Write the failing test first**

```ts
// apps/web/src/mock/cascade.test.ts
import { describe, it, expect } from "vitest";
import type { DistributionColumn, DistributionRow, DistributionTable, LedgerAccountRow, UnitRow } from "@cl/application";
import type { PeriodState, RipartoEngine, ResidentBalance } from "@cl/domain";
import { liveState, overlayDistribution, overlayUnits } from "./cascade";

const m = (cents: number) => ({ cents });

describe("liveState", () => {
  const seeded: PeriodState = {
    riparto: {
      accounts: [{ id: "10", name: "Pulizie", order: 0, parentId: null }],
      links: [], roles: [], residents: [], unitLegacyIds: ["1", "2"],
      tableItems: [{ tableId: "5", unitId: "1", coefficient: 100 }],
      estimateCentsByAccount: { "10": 9999 },
      actualCentsByAccount: { "10": 8888 },
    },
    plan: { installmentIds: [], overrides: [] },
    opening: {}, paid: { "1": 1 },
  };
  const tables: DistributionTable[] = [
    { id: "dt5", name: "Prop", restriction: null, total: 300,
      items: [
        { unitId: "u1", unitLabel: "A1", coefficient: 120, competenza: "intero" },
        { unitId: "u2", unitLabel: "A2", coefficient: 180, competenza: "intero" },
      ] },
  ];
  const accounts: LedgerAccountRow[] = [
    { id: "la10", kind: "regular", label: "Pulizie", dare: m(8888), avere: m(0), saldo: m(8888), preventivo: m(120000) },
  ];

  it("overrides coefficients, estimate, actuals and paid from the live subjects (strip prefixes)", () => {
    const out = liveState(seeded, tables, accounts, { "1": 5000 });
    expect(out.riparto.tableItems).toEqual([
      { tableId: "5", unitId: "1", coefficient: 120 },
      { tableId: "5", unitId: "2", coefficient: 180 },
    ]);
    expect(out.riparto.estimateCentsByAccount).toEqual({ "10": 120000 });
    expect(out.riparto.actualCentsByAccount).toEqual({ "10": 8888 });
    expect(out.paid).toEqual({ "1": 5000 });
    // static parts unchanged
    expect(out.riparto.unitLegacyIds).toEqual(["1", "2"]);
    expect(out.opening).toBe(seeded.opening);
  });

  it("keeps the seeded value when an account key is absent from accounts$", () => {
    const out = liveState(seeded, tables, [], { });
    expect(out.riparto.estimateCentsByAccount).toEqual({ "10": 9999 });
    expect(out.riparto.actualCentsByAccount).toEqual({ "10": 8888 });
  });
});

describe("overlayDistribution", () => {
  const columns: DistributionColumn[] = [{ accountId: "la10", header: "Pulizie", tableId: "dt5" }];
  const skeleton = {
    columns,
    rows: [{
      id: "destimate-g", kind: "group" as const, label: "Totale",
      amounts: { la10: m(0) }, total: m(0),
      children: [
        { id: "destimate-1", kind: "unit" as const, unitId: "u1", label: "A1", amounts: { la10: m(0) }, total: m(0) },
        { id: "destimate-2", kind: "unit" as const, unitId: "u2", label: "A2", amounts: { la10: m(0) }, total: m(0) },
      ],
    } satisfies DistributionRow],
  };
  const engine = {
    perUnitAmount: (acct: string, _mode: string, unit: string) =>
      acct === "10" && unit === "1" ? 50000 : acct === "10" && unit === "2" ? 70000 : 0,
  } as unknown as RipartoEngine;

  it("paints per-unit amounts and re-sums group + unit totals, preserving skeleton labels/ids", () => {
    const out = overlayDistribution(engine, skeleton, "estimate");
    const g = out.rows[0]!;
    expect(g.children!.find((r) => r.unitId === "u1")!.amounts.la10!.cents).toBe(50000);
    expect(g.children!.find((r) => r.unitId === "u2")!.amounts.la10!.cents).toBe(70000);
    expect(g.children!.find((r) => r.unitId === "u1")!.total.cents).toBe(50000);
    expect(g.amounts.la10!.cents).toBe(120000);
    expect(g.total.cents).toBe(120000);
    expect(g.children![0]!.label).toBe("A1"); // skeleton preserved
  });
});

describe("overlayUnits", () => {
  const balances: ResidentBalance[] = [
    { residentId: "1", preventivoCents: 1000, consuntivoCents: 800, saldoPrecCents: 200, versatoCents: 300, totDovutoCents: 900 },
  ];
  const skeleton: UnitRow[] = [{
    id: "g", kind: "group", label: "Totale",
    saldoPrec: m(0), preventivo: m(0), consuntivo: m(0), totDovuto: m(0), versato: m(0),
    children: [{
      id: "u1", kind: "unit", label: "A1",
      saldoPrec: m(0), preventivo: m(0), consuntivo: m(0), totDovuto: m(0), versato: m(0),
      children: [{
        id: "r1", kind: "resident", label: "Rossi",
        saldoPrec: m(0), preventivo: m(0), consuntivo: m(0), totDovuto: m(0), versato: m(0),
      }],
    }],
  }];

  it("sets resident money from balances + individual, uses saldoPrec+preventivo for totDovuto, re-sums ancestors", () => {
    const out = overlayUnits(balances, skeleton, { "1": 50 });
    const res = out[0]!.children![0]!.children![0]!;
    expect(res.saldoPrec.cents).toBe(200);
    expect(res.preventivo.cents).toBe(1000);
    expect(res.consuntivo.cents).toBe(800 + 50); // individual folded in
    expect(res.versato.cents).toBe(300);
    expect(res.totDovuto.cents).toBe(200 + 1000); // saldoPrec + preventivo, NOT totDovutoCents
    expect(out[0]!.consuntivo.cents).toBe(850); // group re-summed
    expect(out[0]!.children![0]!.label).toBe("A1"); // skeleton preserved
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/apps/web && pnpm exec vitest run src/mock/cascade.test.ts`
Expected: FAIL (module `./cascade` not found).

- [ ] **Step 3: Implement `cascade.ts`**

```ts
// apps/web/src/mock/cascade.ts
import type { DistributionColumn, DistributionRow, DistributionTable, LedgerAccountRow, UnitRow } from "@cl/application";
import type { Mode, Money, PeriodState, RipartoEngine, ResidentBalance } from "@cl/domain";

type Dist = { columns: DistributionColumn[]; rows: DistributionRow[] };
const m = (cents: number): Money => ({ cents });

/** Recover a legacy id from a prefixed DTO id (la../dt../u../r..). */
const strip = (prefix: string, id: string): string => (id.startsWith(prefix) ? id.slice(prefix.length) : id);

/** Flatten an account tree to a by-DTO-id map. */
function flattenAccounts(rows: LedgerAccountRow[]): Map<string, LedgerAccountRow> {
  const out = new Map<string, LedgerAccountRow>();
  const walk = (r: LedgerAccountRow): void => {
    out.set(r.id, r);
    (r.children ?? []).forEach(walk);
  };
  rows.forEach(walk);
  return out;
}

/**
 * Assemble a live PeriodState by overriding the seeded engine input with the current
 * editable subjects. Only the editable fields change (coefficients, own estimate, own
 * actuals, paid); the static riparto structure, plan and opening stay seeded.
 * Estimate/actual are overridden per seeded key (the authoritative own-account set), so
 * grouping rows never double-count; a missing account keeps the seeded value.
 */
export function liveState(
  seeded: PeriodState,
  tables: DistributionTable[],
  accounts: LedgerAccountRow[],
  paid: Record<string, number>,
): PeriodState {
  const tableItems = tables.flatMap((t) =>
    t.items.map((it) => ({ tableId: strip("dt", t.id), unitId: strip("u", it.unitId), coefficient: it.coefficient })),
  );
  const byId = flattenAccounts(accounts);
  const estimateCentsByAccount: Record<string, number> = {};
  for (const key of Object.keys(seeded.riparto.estimateCentsByAccount)) {
    estimateCentsByAccount[key] = byId.get(`la${key}`)?.preventivo?.cents ?? seeded.riparto.estimateCentsByAccount[key]!;
  }
  const actualCentsByAccount: Record<string, number> = {};
  for (const key of Object.keys(seeded.riparto.actualCentsByAccount)) {
    actualCentsByAccount[key] = byId.get(`la${key}`)?.saldo.cents ?? seeded.riparto.actualCentsByAccount[key]!;
  }
  return {
    ...seeded,
    riparto: { ...seeded.riparto, tableItems, estimateCentsByAccount, actualCentsByAccount },
    paid,
  };
}

/** Overlay engine per-unit money onto a seeded distribution skeleton for one mode. */
export function overlayDistribution(engine: RipartoEngine, skeleton: Dist, mode: Mode): Dist {
  const overlayUnitRow = (row: DistributionRow): DistributionRow => {
    const amounts: Record<string, Money> = {};
    let total = 0;
    for (const col of skeleton.columns) {
      const cents = engine.perUnitAmount(strip("la", col.accountId), mode, strip("u", row.unitId ?? ""));
      amounts[col.accountId] = m(cents);
      total += cents;
    }
    return { ...row, amounts, total: m(total) };
  };
  const rows = skeleton.rows.map((group) => {
    if (!group.children?.length) return group;
    const children = group.children.map(overlayUnitRow);
    const amounts: Record<string, Money> = {};
    for (const col of skeleton.columns) {
      amounts[col.accountId] = m(children.reduce((s, c) => s + (c.amounts[col.accountId]?.cents ?? 0), 0));
    }
    const total = m(children.reduce((s, c) => s + c.total.cents, 0));
    return { ...group, amounts, total, children };
  });
  return { columns: skeleton.columns, rows };
}

/** Overlay engine balances (+ directly-attributed individual expenses) onto a seeded unit skeleton. */
export function overlayUnits(
  balances: ResidentBalance[],
  skeleton: UnitRow[],
  individual: Record<string, number>,
): UnitRow[] {
  const byResident = new Map(balances.map((b) => [b.residentId, b]));
  const sum = (rows: UnitRow[], k: "saldoPrec" | "preventivo" | "consuntivo" | "totDovuto" | "versato"): Money =>
    m(rows.reduce((a, r) => a + r[k].cents, 0));
  const walk = (r: UnitRow): UnitRow => {
    if (r.kind === "resident") {
      const rid = strip("r", r.id);
      const b = byResident.get(rid);
      const saldoPrec = b?.saldoPrecCents ?? 0;
      const preventivo = b?.preventivoCents ?? 0;
      const consuntivo = (b?.consuntivoCents ?? 0) + (individual[rid] ?? 0);
      const versato = b?.versatoCents ?? 0;
      return {
        ...r,
        saldoPrec: m(saldoPrec), preventivo: m(preventivo), consuntivo: m(consuntivo),
        totDovuto: m(saldoPrec + preventivo), versato: m(versato),
      };
    }
    const children = (r.children ?? []).map(walk);
    return {
      ...r, children,
      saldoPrec: sum(children, "saldoPrec"), preventivo: sum(children, "preventivo"),
      consuntivo: sum(children, "consuntivo"), totDovuto: sum(children, "totDovuto"),
      versato: sum(children, "versato"),
    };
  };
  return skeleton.map(walk);
}
```

- [ ] **Step 4: Run the test (expect PASS)**

Run: `cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/apps/web && pnpm exec vitest run src/mock/cascade.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck**

Run: `cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && pnpm --filter @cl/web exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
git add apps/web/src/mock/cascade.ts apps/web/src/mock/cascade.test.ts
git commit -m "$(cat <<'EOF'
feat(web): pure cascade helpers — liveState + overlayDistribution/overlayUnits

Assemble a live PeriodState from the editable subjects and paint recomputePeriod's
money onto the seeded DTO skeletons (strip la/dt/u/r prefixes; totDovuto = saldoPrec
+ preventivo per generator semantics). Pure, no store/rxjs yet.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: On-load equivalence gate (vs the generated seed)

**Files:**
- Create: `apps/web/src/mock/cascade.equivalence.test.ts`

This is the proof: assembling a live `PeriodState` from the generated seed's **own** subjects and overlaying the engine output must reproduce the seeded DTOs exactly. If it fails, the assemble/overlay/sign/id-mapping is wrong — fix `cascade.ts`, never weaken this test.

- [ ] **Step 1: Write the test**

```ts
// apps/web/src/mock/cascade.equivalence.test.ts
import { describe, it, expect } from "vitest";
import { recomputePeriod, type Mode } from "@cl/domain";
import { generatedSeed } from "./data.generated";
import { liveState, overlayDistribution, overlayUnits } from "./cascade";

const seed = generatedSeed;
const states = seed.periodStateByPeriod ?? {};
const bookPids = Object.keys(states).filter((pid) => states[pid]!.riparto.unitLegacyIds.length > 0);

describe("cascade on-load equivalence (generated seed)", () => {
  it("has book periods to check", () => {
    expect(bookPids.length).toBeGreaterThan(0);
  });

  it("derives distribution equal to the seeded DTO for every book period (both modes)", () => {
    for (const pid of bookPids) {
      const state = liveState(
        states[pid]!,
        seed.distributionTablesByPeriod[pid] ?? [],
        seed.ledgerAccountsByPeriod[pid] ?? [],
        states[pid]!.paid,
      );
      const eng = recomputePeriod(state).riparto;
      for (const mode of ["estimate", "current"] as Mode[]) {
        const got = overlayDistribution(eng, seed.distributionByPeriod[pid]![mode], mode);
        expect(got).toEqual(seed.distributionByPeriod[pid]![mode]);
      }
    }
  });

  it("derives units equal to the seeded DTO for every book period", () => {
    for (const pid of bookPids) {
      const state = liveState(
        states[pid]!,
        seed.distributionTablesByPeriod[pid] ?? [],
        seed.ledgerAccountsByPeriod[pid] ?? [],
        states[pid]!.paid,
      );
      const res = recomputePeriod(state);
      const got = overlayUnits(res.balances, seed.unitsByPeriod[pid] ?? [], seed.individualByPeriod?.[pid] ?? {});
      expect(got).toEqual(seed.unitsByPeriod[pid]);
    }
  });
});
```

- [ ] **Step 2: Run it (expect PASS)**

Run: `cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/apps/web && pnpm exec vitest run src/mock/cascade.equivalence.test.ts`
Expected: PASS. **If a distribution/units case fails:** the assemble or overlay diverged from the generator. Diagnose by comparing one failing period's first differing row. Likely culprits and fixes (fix `cascade.ts`, not the test):
  - amounts off → `perUnitAmount` arg order or a wrong `strip` prefix;
  - `consuntivo` off by the individual addend → confirm `overlayUnits` adds `individual[rid]`;
  - `totDovuto` off → must be `saldoPrec + preventivo`, not `totDovutoCents`;
  - an actuals/estimate value off → an account key present in `actualCentsByAccount`/`estimateCentsByAccount` resolves to a **grouping** row (rolled-up `saldo`/`preventivo`) instead of the own leaf; if discovered, restrict the override to leaf rows (no `children`) and keep the seeded value otherwise.

- [ ] **Step 3: Commit**

```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
git add apps/web/src/mock/cascade.equivalence.test.ts
git commit -m "$(cat <<'EOF'
test(web): on-load equivalence gate — derived == seeded for every book period

Assembling a live PeriodState from the generated seed's own subjects and overlaying
recomputePeriod reproduces the seeded distribution + units DTOs exactly. This pins the
assemble/overlay/sign/id-mapping before the store is rewired.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Derive `distribution()`; retire `recomputeDistribution`; `setCoefficient` patches only `tables$`

**Files:**
- Modify: `apps/web/src/mock/MockStore.ts`
- Modify: `apps/web/src/mock/MockStore.test.ts`

`distribution()` becomes a derived pipeline (with fallback to the seeded skeleton for periods lacking a `PeriodState`). `setCoefficient` drops its local `recomputeDistribution` and just patches `tables$` — the cascade redraws. `setPreventivo` is **unchanged** (it patches `accounts$.preventivo`, which the cascade now reads). The one fixture test that asserted the re-split moves to the generated seed.

- [ ] **Step 1: Add cascade imports + private cascade state to `MockStore.ts`**

(a) Replace the `recomputeDistribution` import line:
```ts
import { recomputeDistribution } from "../recompute/distribution";
```
with:
```ts
import { recomputePeriod, type PeriodState } from "@cl/domain";
import { liveState, overlayDistribution, overlayUnits } from "./cascade";
```
NOTE: `fromCents` is already imported from `@cl/domain` on its own line — leave it. The added `recomputePeriod`/`PeriodState` import is a second `@cl/domain` import line, which is fine.

(b) Add a new `paid$` subject field, after the `installments$` field declaration (`private installments$: ...;`):
```ts
  private paid$: BehaviorSubject<Record<Id, Record<string, number>>>;
```

(c) Add two private readonly cascade-state fields, next to `calendarLayers_`/`anagraficaCategories_`:
```ts
  /** Seeded pure-cascade input + individual expenses (book-reconciling periods only). */
  private readonly periodStates_: Record<Id, PeriodState>;
  private readonly individual_: Record<Id, Record<string, number>>;
```

(d) In the constructor, after `this.installments$ = ...;`, initialise them:
```ts
    const states = seed.periodStateByPeriod ?? {};
    this.periodStates_ = states;
    this.individual_ = seed.individualByPeriod ?? {};
    const paidSeed: Record<Id, Record<string, number>> = {};
    for (const pid of Object.keys(states)) paidSeed[pid] = { ...states[pid]!.paid };
    this.paid$ = new BehaviorSubject<Record<Id, Record<string, number>>>(paidSeed);
```

- [ ] **Step 2: Add a private cascade helper + rewrite `distribution()`**

(a) Add a private method (place it just above the `distribution(...)` method). It computes the engine result for a period from the current subjects, or `null` when the period has no seeded `PeriodState`:
```ts
  /** recomputePeriod over the live subjects for a period; null when not a book period. */
  private engineFor(
    periodId: Id,
    tables: Record<Id, DistributionTable[]>,
    accounts: Record<Id, LedgerAccountRow[]>,
    paid: Record<Id, Record<string, number>>,
  ): ReturnType<typeof recomputePeriod> | null {
    const seeded = this.periodStates_[periodId];
    if (!seeded) return null;
    return recomputePeriod(liveState(seeded, tables[periodId] ?? [], accounts[periodId] ?? [], paid[periodId] ?? {}));
  }
```

(b) Replace the current `distribution(...)` method:
```ts
  distribution(periodId: Id, type: DistributionType): Observable<Dist> {
    return this.distributions$.pipe(map((d) => d[periodId]?.[type] ?? { columns: [], rows: [] }));
  }
```
with:
```ts
  distribution(periodId: Id, type: DistributionType): Observable<Dist> {
    return combineLatest([this.distributions$, this.tables$, this.accounts$, this.paid$]).pipe(
      map(([dists, tables, accounts, paid]) => {
        const skeleton = dists[periodId]?.[type] ?? { columns: [], rows: [] };
        const eng = this.engineFor(periodId, tables, accounts, paid);
        return eng ? overlayDistribution(eng.riparto, skeleton, type) : skeleton;
      }),
    );
  }
```

- [ ] **Step 3: Simplify `setCoefficient` to patch only `tables$`**

Replace the whole `setCoefficient(...)` method body with:
```ts
  setCoefficient(periodId: Id, tableId: Id, unitId: Id, coefficient: number): void {
    this.patch(this.tables$, periodId, [], (tables) =>
      tables.map((t) => t.id !== tableId ? t : ({
        ...t,
        items: t.items.map((it) => (it.unitId === unitId ? { ...it, coefficient } : it)),
      })));
  }
```
(The `coeffByUnit`/`recomputeDistribution`/`distributions$.next` block is removed — the cascade now redraws distribution from `tables$`.)

- [ ] **Step 4: Move the fixture "re-split" test to the generated seed**

In `apps/web/src/mock/MockStore.test.ts`:

(a) Add this import at the top (after `import { MockStore } from "./MockStore";`):
```ts
import { generatedSeed } from "./data.generated";
```

(b) Replace the test `it("setCoefficient re-emits tables AND re-splits the riparto", ...)` (the whole `it(...)` block) with a fixture assertion that tables still re-emit, plus a generated-seed assertion that the cascade re-splits and preserves column totals:
```ts
  it("setCoefficient re-emits the coefficient table (fixture seed)", () => {
    const s = new MockStore();
    s.setCoefficient("sat-2011", "t-prop", "u-a01", 500);
    const table = latest(s.distributionTables("sat-2011")).find((t) => t.id === "t-prop")!;
    expect(table.items.find((i) => i.unitId === "u-a01")!.coefficient).toBe(500);
    expect(table.items.find((i) => i.unitId === "u-a02")!.coefficient).toBe(687.5);
  });

  it("setCoefficient re-splits the riparto via the cascade (generated seed), preserving column totals", () => {
    const seed = generatedSeed;
    const states = seed.periodStateByPeriod ?? {};
    // a book period with a coefficient table carrying >= 2 items
    const pid = Object.keys(states).find((p) =>
      states[p]!.riparto.unitLegacyIds.length > 1 &&
      (seed.distributionTablesByPeriod[p] ?? []).some((t) => t.items.length >= 2))!;
    expect(pid).toBeTruthy();
    const s = new MockStore(seed);
    const table = (seed.distributionTablesByPeriod[pid] ?? []).find((t) => t.items.length >= 2)!;
    const before = latest(s.distribution(pid, "estimate"));
    const col = before.rows[0]!; // group row
    const colTotalsBefore = Object.fromEntries(Object.entries(col.amounts).map(([k, v]) => [k, v.cents]));
    // bump the first item's coefficient
    const first = table.items[0]!;
    s.setCoefficient(pid, table.id, first.unitId, first.coefficient + 100);
    const after = latest(s.distribution(pid, "estimate"));
    const colAfter = after.rows[0]!;
    // group/column totals are conserved (only the per-unit split moved)
    for (const k of Object.keys(colTotalsBefore)) {
      expect(colAfter.amounts[k]!.cents).toBe(colTotalsBefore[k]!);
    }
    // and at least one unit cell actually changed
    expect(JSON.stringify(after.rows)).not.toBe(JSON.stringify(before.rows));
  });
```

- [ ] **Step 5: Typecheck + run the store + cascade suites**

```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && pnpm --filter @cl/web exec tsc --noEmit
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/apps/web && pnpm exec vitest run src/mock/MockStore.test.ts src/mock/cascade.equivalence.test.ts
```
Expected: tsc exit 0; both files pass. (If tsc flags `Mode`/unused imports, adjust — `overlayUnits` is imported now but only used in Task 4; if `noUnusedLocals` complains, add it in Task 4 instead and import it there. To avoid churn, it is acceptable to import `overlayUnits` here and use it in Task 4 within the same branch; if tsc fails on the unused import between tasks, move the `overlayUnits` import to Task 4 Step 1.)

- [ ] **Step 6: Commit**

```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
git add apps/web/src/mock/MockStore.ts apps/web/src/mock/MockStore.test.ts
git commit -m "$(cat <<'EOF'
feat(web): derive distribution() through recomputePeriod; setCoefficient patches tables only

distribution() becomes a cascade (liveState -> recomputePeriod -> overlayDistribution),
falling back to the seeded skeleton for periods without a PeriodState (fixtures). The
bespoke recomputeDistribution call is removed from setCoefficient. The re-split behaviour
test moves to the generated seed (fixtures have no PeriodState).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Derive `unitsTree()`; `recordTaking` → `paid$`; rewire `periodSummaries`

**Files:**
- Modify: `apps/web/src/mock/MockStore.ts`
- Modify: `apps/web/src/mock/MockStore.test.ts`

`unitsTree()` becomes derived (fallback to seeded skeleton). `recordTaking` patches `paid$` instead of bumping `units$.versato`. `periodSummaries` overlays the derived units when a `PeriodState` exists. `addTransaction`/`registerInvoice` are unchanged — consuntivo now reacts because `actualCentsByAccount` reads the live `saldo`.

- [ ] **Step 1: Rewrite `unitsTree()`**

Replace:
```ts
  unitsTree(periodId: Id) { return this.units$.pipe(map((u) => u[periodId] ?? [])); }
```
with:
```ts
  unitsTree(periodId: Id) {
    return combineLatest([this.units$, this.tables$, this.accounts$, this.paid$]).pipe(
      map(([units, tables, accounts, paid]) => {
        const skeleton = units[periodId] ?? [];
        const eng = this.engineFor(periodId, tables, accounts, paid);
        return eng ? overlayUnits(eng.balances, skeleton, this.individual_[periodId] ?? {}) : skeleton;
      }),
    );
  }
```

- [ ] **Step 2: Rewrite `periodSummaries()` to overlay derived units**

Replace the `periodSummaries()` body:
```ts
  periodSummaries(): Observable<Record<Id, PeriodSummary>> {
    return combineLatest([this.accounts$, this.units$]).pipe(map(([accounts, units]) => {
      const ids = new Set([...Object.keys(accounts), ...Object.keys(units)]);
      return Object.fromEntries(
        [...ids].map((id) => [id, periodSummary(accounts[id] ?? [], units[id] ?? [])]),
      );
    }));
  }
```
with:
```ts
  periodSummaries(): Observable<Record<Id, PeriodSummary>> {
    return combineLatest([this.accounts$, this.units$, this.tables$, this.paid$]).pipe(
      map(([accounts, units, tables, paid]) => {
        const ids = new Set([...Object.keys(accounts), ...Object.keys(units)]);
        return Object.fromEntries(
          [...ids].map((id) => {
            const eng = this.engineFor(id, tables, accounts, paid);
            const u = eng ? overlayUnits(eng.balances, units[id] ?? [], this.individual_[id] ?? {}) : (units[id] ?? []);
            return [id, periodSummary(accounts[id] ?? [], u)];
          }),
        );
      }),
    );
  }
```

- [ ] **Step 3: `recordTaking` patches `paid$` instead of `units$.versato`**

In `recordTaking(...)`, replace the trailing block that bumps versato:
```ts
    const addVersato = (rows: UnitRow[]): UnitRow[] => {
      const contains = (r: UnitRow): boolean =>
        r.id === t.residentId || (r.children ?? []).some(contains);
      const walk = (r: UnitRow): UnitRow => contains(r)
        ? { ...r, versato: fromCents(r.versato.cents + total), children: r.children?.map(walk) }
        : r;
      return rows.map(walk);
    };
    this.patch(this.units$, periodId, [], addVersato);
```
with:
```ts
    const rid = t.residentId.startsWith("r") ? t.residentId.slice(1) : t.residentId;
    this.patch(this.paid$, periodId, {}, (cur) => ({ ...cur, [rid]: (cur[rid] ?? 0) + total }));
```
(The resident-exists guard at the top of `recordTaking` and the `addTransaction(...)` posting are unchanged.)

- [ ] **Step 4: Move the fixture "versato" test to the generated seed**

In `apps/web/src/mock/MockStore.test.ts`, replace the test `it("recordTaking posts the incasso and bumps versato on resident + ancestors", ...)` (the whole block) with:
```ts
  it("recordTaking bumps versato via the cascade (generated seed) on resident + ancestors", () => {
    const seed = generatedSeed;
    const states = seed.periodStateByPeriod ?? {};
    const pid = Object.keys(states).find((p) => states[p]!.riparto.unitLegacyIds.length > 0)!;
    expect(pid).toBeTruthy();
    const s = new MockStore(seed);
    // find a resident row + its unit + group in the seeded unit tree
    const groups = seed.unitsByPeriod[pid] ?? [];
    let residentId = "", unitIdx = -1, groupIdx = -1;
    groups.forEach((g, gi) => (g.children ?? []).forEach((u, ui) => (u.children ?? []).forEach((r) => {
      if (!residentId && r.kind === "resident") { residentId = r.id; unitIdx = ui; groupIdx = gi; }
    })));
    expect(residentId).toBeTruthy();
    const before = latest(s.unitsTree(pid));
    const beforeVers = before[groupIdx]!.children![unitIdx]!.children!.find((r) => r.id === residentId)!.versato.cents;
    s.recordTaking(pid, {
      date: "2013-07-01", residentId, residentLabel: "Test",
      liquidAccountId: (seed.ledgerAccountsByPeriod[pid] ?? [])[0]?.id ?? "x",
      liquidAccountLabel: "Banca",
      creditAccountId: (seed.ledgerAccountsByPeriod[pid] ?? [])[0]?.id ?? "x",
      creditAccountLabel: "Crediti",
      settlements: [{ installmentId: "r1", amountCents: 12345 }],
    });
    const after = latest(s.unitsTree(pid));
    const res = after[groupIdx]!.children![unitIdx]!.children!.find((r) => r.id === residentId)!;
    expect(res.versato.cents).toBe(beforeVers + 12345);
    // ancestor rollup reflects the increase
    const unitVers = after[groupIdx]!.children![unitIdx]!.versato.cents;
    const beforeUnitVers = before[groupIdx]!.children![unitIdx]!.versato.cents;
    expect(unitVers).toBe(beforeUnitVers + 12345);
  });
```
NOTE: `recordTaking`'s guard checks the resident exists in `units$` (the seeded skeleton) — `residentId` is taken from `unitsByPeriod`, so the guard passes. The liquid/credit account ids only need to exist in `accounts$`; using the first account row id satisfies the `addTransaction` existence check (both legs reference an existing account). If `addTransaction` rejects same-account dare+avere, pick two distinct existing leaf account ids instead (read two ids from `seed.ledgerAccountsByPeriod[pid]`).

- [ ] **Step 5: Typecheck + full web suite**

```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && pnpm --filter @cl/web exec tsc --noEmit
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && pnpm --filter @cl/web test
```
Expected: tsc exit 0; full suite green. New counts vs the prior 301: `cascade.test.ts` (Task 1), `cascade.equivalence.test.ts` (3, Task 2), and the two rewritten MockStore tests became three (`setCoefficient` split into fixture + generated; `recordTaking` replaced 1:1). Confirm the suite is green and the parity specs still pass; the exact total will be 301 + (cascade.test cases) + 3 + 1.

- [ ] **Step 6: Commit**

```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
git add apps/web/src/mock/MockStore.ts apps/web/src/mock/MockStore.test.ts
git commit -m "$(cat <<'EOF'
feat(web): derive unitsTree() + periodSummaries through recomputePeriod; recordTaking -> paid$

unitsTree() overlays recomputePeriod balances (+ individual expenses) onto the seeded
unit skeleton (fallback to seeded for fixtures). recordTaking patches a new paid$ source
instead of mutating units$.versato. periodSummaries overlays the derived units. With
distribution already derived, setPreventivo and registerInvoice now cascade automatically
(consuntivo reads the live account saldo). The versato behaviour test moves to the
generated seed.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Retire `recomputeDistribution`; docs; whole-repo verification

**Files:**
- Modify: `apps/web/src/recompute/distribution.ts`
- Modify: `apps/web/src/recompute/distribution.test.ts`
- Modify: `docs/domain/README.md`

- [ ] **Step 1: Remove `recomputeDistribution` (keep `roundingByColumn`)**

In `apps/web/src/recompute/distribution.ts`, delete the `recomputeDistribution` function (the export and its body) and keep `roundingByColumn`. After deletion, remove any import now unused **only if tsc flags it** (`allocate`/`fromCents` may still be used by `roundingByColumn` — check: `roundingByColumn` uses neither `allocate` nor `fromCents`, so both imports likely become unused and must be removed; the `DistributionColumn`/`DistributionRow`/`DistributionTable`/`Id` and the local `Dist` type are still used). Let the typecheck in Step 4 confirm exactly which imports to drop.

- [ ] **Step 2: Drop the `recomputeDistribution` cases from its test**

In `apps/web/src/recompute/distribution.test.ts`, remove the `import { recomputeDistribution, roundingByColumn }` → change to `import { roundingByColumn } from "./distribution";`, and delete the `describe("recomputeDistribution", ...)` block (and any helper used only by it). Keep the `roundingByColumn` test(s).

- [ ] **Step 3: Verify `TabelleSection` still compiles against the kept export**

`apps/web/src/sections/tabelle/TabelleSection.tsx` imports `roundingByColumn` — unchanged. No edit needed; the typecheck in Step 4 confirms.

- [ ] **Step 4: Whole-repo verification**

```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
git status --short                                   # data.generated.json MUST NOT appear
pnpm --filter @cl/domain test
pnpm --filter @cl/web exec tsc --noEmit
pnpm --filter @cl/web test
grep -rn "recomputeDistribution" apps/web/src        # expect: no matches
```
Expected: `git status --short` shows only the intended source/docs changes and **no** `data.generated.json`; `@cl/domain` 34 green; web tsc exit 0; web suite green (parity specs included); `grep` for `recomputeDistribution` returns nothing.

- [ ] **Step 5: Extend the docs pointer**

In `docs/domain/README.md`, find the sentence added in Phase 1b-2a that ends:
```markdown
`recomputePeriod` at runtime. Wiring that into the reactive store is Phase 1b-2b.
```
and replace that final sentence with:
```markdown
`recomputePeriod` at runtime. Phase 1b-2b wires that into the live store: `distribution`
and `unitsTree` are derived by assembling a live `PeriodState` from the editable subjects
(`tables$`/`accounts$`/`paid$`) and overlaying `recomputePeriod` onto the seeded DTO
skeletons; the bespoke `recomputeDistribution` is retired. Installments remain a
command-patched source.
```

- [ ] **Step 6: Commit**

```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
git add apps/web/src/recompute/distribution.ts apps/web/src/recompute/distribution.test.ts docs/domain/README.md
git commit -m "$(cat <<'EOF'
refactor(web): retire recomputeDistribution; doc the live cascade

The live store now derives distribution + balances through recomputePeriod, so the
bespoke recomputeDistribution is removed (roundingByColumn stays — TabelleSection uses
it). Docs note the Phase 1b-2b wiring.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review checklist (completed)

**Spec coverage:** inputs-stay-sources assembly (`liveState`, Task 1) + skeleton overlay (`overlayDistribution`/`overlayUnits`, Task 1, "Option i"); all four triggers (Task 3 `setCoefficient`; Task 4 `recordTaking`; `setPreventivo` + `addTransaction`/`registerInvoice` cascade automatically once `distribution`/`unitsTree` read `accounts$` — noted in Tasks 3/4); `recomputeDistribution` retired (Task 5, `roundingByColumn` preserved); on-load equivalence gate (Task 2) + post-edit invariants (Task 3 column-total conservation; Task 4 versato rollup); installments untouched; `data.generated.json` unchanged (Task 5 gate); docs (Task 5). Out of scope (Phase 2 / later): structural edits, client-side reconstruction, engine-derived installments.

**Placeholder scan:** none — every edit gives exact before/after text; every run step states the command and expected result; the equivalence failure modes (Task 2 Step 2) are concrete remedies, not TODOs.

**Type consistency:** `liveState(seeded, tables, accounts, paid): PeriodState`, `overlayDistribution(engine: RipartoEngine, skeleton: Dist, mode: Mode): Dist`, `overlayUnits(balances: ResidentBalance[], skeleton: UnitRow[], individual): UnitRow[]` defined in Task 1 and consumed unchanged in Tasks 3/4. `engineFor(...)` (Task 3) returns `recomputePeriod(...) | null` and is reused by `distribution`/`unitsTree`/`periodSummaries`. `paid$: BehaviorSubject<Record<Id, Record<string, number>>>` declared (Task 3 Step 1b), seeded (Task 3 Step 1d), consumed (Tasks 3/4). DTO id prefixes (`la`/`dt`/`u`/`r`) are stripped consistently in `cascade.ts`. `totDovuto = saldoPrec + preventivo` (generator semantics), guarded by the equivalence gate.

**Risk note carried from the spec:** if the equivalence gate fails on an estimate/actual value because a seeded account key resolves to a grouping row, restrict the override to leaf rows (Task 2 Step 2). The gate makes any such mismatch a hard failure, not silent drift.
