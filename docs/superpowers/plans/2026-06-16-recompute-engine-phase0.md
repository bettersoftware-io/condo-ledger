# Recompute Engine — Phase 0 (pure riparto core extraction) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the faithful riparto math out of the legacy-`Db`-coupled `apps/web/tools/gen/project/riparto.ts` into a pure, store/DB-agnostic engine in `@cl/domain`, consumed by the generator through a thin adapter — with byte-identical generator output (parity specs are the gate).

**Architecture:** A pure `buildRiparto(input: RipartoInput): RipartoEngine` in `@cl/domain` containing the 5-stage math unchanged; a generator-side adapter `dbToRipartoInput(db, periodId)` that does exactly today's `Db` reads; the three current call sites re-pointed to `buildRiparto(dbToRipartoInput(...))`. The shared `allocate` rounding primitive also moves to `@cl/domain`. No app behaviour change; no new dependencies.

**Tech Stack:** TypeScript (ESM, `.ts` import extensions in `apps/web`; extensionless within `@cl/domain`), Vitest, pnpm workspaces (`@cl/domain` resolved via `main: src/index.ts`).

**Spec:** `docs/superpowers/specs/2026-06-16-recompute-engine-design.md` (this plan implements **Phase 0** only).

---

## Shared conventions (read first)

- **Branch:** `feat/recompute-engine` (already created; the spec is committed there). Stay on it.
- **`@cl/domain` is pure** — it must NOT import from `@cl/application`, `apps/web`, or any `Db`/DTO type. Its files use **extensionless** relative imports (`./money`), matching the existing `packages/domain/src/index.ts` (`export * from "./money"`). `Money` is `{ cents: number }`.
- **`apps/web` uses explicit `.ts`** import extensions and imports `@cl/domain` by package name (e.g. `import { money } from "@cl/domain"`), as `apps/web/tools/gen/amounts.ts` already does.
- **Behaviour-preserving:** the engine math is moved unchanged. The ONLY transformation is swapping the data source from `Db` reads (`db.rows/group/by`, `eur`, `str`, `num`) to fields already present on a clean `RipartoInput`. The adapter performs those exact reads/conversions instead.
- **The gate:** after re-pointing, `apps/web/src/mock/data.generated.json` must be **byte-identical** and the parity specs + full `@cl/web` suite stay green. This is the equivalence proof for the extraction.
- **Commit trailer:** end every commit body with a blank line then
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

**Test commands:**
- Domain: `pnpm --filter @cl/domain test` and `pnpm --filter @cl/domain exec tsc --noEmit`.
- Web unit/gen: `cd apps/web && pnpm exec vitest run <path>`; tools typecheck `cd apps/web && pnpm exec tsc -p tools/tsconfig.json --noEmit`.
- Parity specs: `cd apps/web && pnpm exec vitest run tools/gen/specs/specs.test.ts`.
- Full web suite: `pnpm --filter @cl/web test`.
- Regenerate seed: `pnpm --filter @cl/web gen` (writes `apps/web/src/mock/data.generated.json`); confirm `git diff --stat apps/web/src/mock/data.generated.json` shows **no change**. (If the script name differs, find it: `node --run` of the `gen` script in `apps/web/package.json`; the entry is `apps/web/tools/gen/generate-data.ts`.)

**Confirmed current shapes (do not re-derive):**
- `apps/web/tools/gen/project/riparto.ts` exports `buildRiparto(db, periodId): RipartoEngine`, and types `Mode`, `LinkRef`, `LinkedColumn`, `RipartoEngine`. Internal `ResidentInfo = { id, priorityId, percentage }`.
- Importers of `./riparto.ts`: `apps/web/tools/gen/project/distribution.ts:9`, `apps/web/tools/gen/project/units.ts:5`, `apps/web/tools/gen/specs/steps.ts:8`. All call `buildRiparto(db, periodId)`.
- `apps/web/src/recompute/allocate.ts` exports `allocate(totalCents, weights): number[]`. Importers: `apps/web/src/recompute/distribution.ts:3`, `apps/web/src/recompute/installments.ts:1`, `apps/web/src/recompute/allocate.test.ts:2`.
- `apps/web/tools/gen/amounts.ts` exports `eur(s): Money`.

**File layout (created by this plan):**
```
packages/domain/src/
  allocate.ts              allocate.test.ts        (Task 1 — moved)
  riparto/
    types.ts               (Task 2)
    computeRiparto.ts      computeRiparto.test.ts  (Task 3)
  index.ts                 (export the new modules)
apps/web/tools/gen/project/
  ripartoInput.ts          ripartoInput.test.ts    (Task 4 — adapter)
  distribution.ts  units.ts  (Task 5 — re-pointed)
  riparto.ts               (Task 5 — DELETED)
apps/web/tools/gen/specs/steps.ts  (Task 5 — re-pointed)
```

---

### Task 1: Move `allocate` into `@cl/domain`

**Files:**
- Create: `packages/domain/src/allocate.ts`
- Create: `packages/domain/src/allocate.test.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `apps/web/src/recompute/distribution.ts:3`, `apps/web/src/recompute/installments.ts:1`
- Delete: `apps/web/src/recompute/allocate.ts`, `apps/web/src/recompute/allocate.test.ts`

- [ ] **Step 1: Create the domain module (verbatim copy of the current implementation)**

```ts
// packages/domain/src/allocate.ts
/** Split an integer cents total across weights using largest-remainder rounding.
 * Invariant: result sums exactly to totalCents. Ties go to the lower index. */
export function allocate(totalCents: number, weights: number[]): number[] {
  if (!Number.isInteger(totalCents)) throw new Error("totalCents must be an integer");
  if (totalCents < 0) return allocate(-totalCents, weights).map((v) => -v);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (totalCents * w) / totalWeight);
  const out = raw.map(Math.floor);
  let remainder = totalCents - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ frac: r - Math.floor(r), i }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) {
    const entry = order[k]!;
    out[entry.i] = out[entry.i]! + 1;
  }
  return out;
}
```

- [ ] **Step 2: Create the domain test (copy of the current test, extensionless import)**

```ts
// packages/domain/src/allocate.test.ts
import { describe, it, expect } from "vitest";
import { allocate } from "./allocate";

describe("allocate", () => {
  it("sums exactly to the total (largest-remainder)", () => {
    expect(allocate(100, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(100);
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
  });
  it("returns zeros when weights are all zero", () => {
    expect(allocate(100, [0, 0])).toEqual([0, 0]);
  });
  it("handles negative totals symmetrically", () => {
    expect(allocate(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
  });
});
```

- [ ] **Step 3: Export from the domain barrel**

In `packages/domain/src/index.ts`, append a line so it reads:

```ts
export * from "./money";
export * from "./allocate";
```

- [ ] **Step 4: Run the domain test (expect PASS)**

Run: `pnpm --filter @cl/domain test`
Expected: PASS — `allocate` suite green (3 assertions) alongside existing money tests. Also `pnpm --filter @cl/domain exec tsc --noEmit` exits 0.

- [ ] **Step 5: Re-point the two app importers**

In `apps/web/src/recompute/distribution.ts` change line 3 from `import { allocate } from "./allocate";` to:

```ts
import { allocate } from "@cl/domain";
```

In `apps/web/src/recompute/installments.ts` change line 1 from `import { allocate } from "./allocate";` to:

```ts
import { allocate } from "@cl/domain";
```

- [ ] **Step 6: Delete the old app module + its test**

```bash
git rm apps/web/src/recompute/allocate.ts apps/web/src/recompute/allocate.test.ts
```

- [ ] **Step 7: Verify the full web suite is unaffected**

Run: `pnpm --filter @cl/web test`
Expected: PASS — same count as before minus the 3 moved `allocate` assertions (they now run under `@cl/domain`). No failures. `cd apps/web && pnpm exec tsc -p tools/tsconfig.json --noEmit` exits 0; also run `pnpm --filter @cl/web exec tsc --noEmit` (app build config) exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/domain/src/allocate.ts packages/domain/src/allocate.test.ts packages/domain/src/index.ts apps/web/src/recompute/distribution.ts apps/web/src/recompute/installments.ts
git commit -m "refactor(domain): move allocate (largest-remainder) into @cl/domain"
```

---

### Task 2: Clean domain I/O types for the engine

**Files:**
- Create: `packages/domain/src/riparto/types.ts`

These are neutral domain types — no `Db`, no DTO. They carry exactly what the math needs. Numbers are already-parsed (coefficients/percentages as `number`, money as integer `cents`).

- [ ] **Step 1: Create the types**

```ts
// packages/domain/src/riparto/types.ts

export type Mode = "estimate" | "current";

/** One link of an expense account to a distribution table. pct already resolved (null→100). */
export interface LinkRef {
  linkId: string;
  tableId: string;
  pct: number;
  type: "estimate" | "currentBalance" | null;
}

export interface LinkedColumn {
  legacyAccountId: string;
  name: string;
  links: LinkRef[];
  /** Primary table for display (estimate-side first, else first link). */
  displayTableId: string;
}

export interface ResidentInfo {
  id: string;
  priorityId: string;
  percentage: number;
}

/** Clean, store/DB-agnostic input to the riparto engine. All money is integer cents. */
export interface RipartoInput {
  /** Accounts in the period. `order` already numeric; `parentId` null at the root. */
  accounts: { id: string; name: string; order: number; parentId: string | null }[];
  /** Expense-account → table links (pct resolved, type normalised). */
  links: { accountId: string; linkId: string; tableId: string; pct: number; type: "estimate" | "currentBalance" | null }[];
  /** Own (not rolled-up) estimate cents per account id. */
  estimateCentsByAccount: Record<string, number>;
  /** Own (not rolled-up) signed actual cents per posting account id, this period. */
  actualCentsByAccount: Record<string, number>;
  /** Distribution-table coefficients. */
  tableItems: { tableId: string; unitId: string; coefficient: number }[];
  /** Owner/tenant role split rows, keyed by link id. */
  roles: { linkId: string; priorityId: string; percentage: number }[];
  /** Residents grouped per legacy unit id (via residentId/priority/percentage). */
  residents: { unitId: string; residentId: string; priorityId: string; percentage: number }[];
  /** Legacy unit ids present this period, already sorted by code. */
  unitLegacyIds: string[];
}

export interface RipartoEngine {
  columns: LinkedColumn[];
  /** per-unit amount in cents for an account+mode+legacy unit id. */
  perUnitAmount(accountId: string, mode: Mode, legacyUnitId: string): number;
  /** subtree totals (cents) for a linked account. */
  subtree(accountId: string): { estimateCents: number; actualCents: number };
  /** split a unit's per-unit amount among its residents. Map<unitResidentId, cents>. */
  perResidentAmount(accountId: string, mode: Mode, legacyUnitId: string): Map<string, number>;
  /** legacy unit ids present this period (sorted by code). */
  unitLegacyIds: string[];
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @cl/domain exec tsc --noEmit`
Expected: exit 0 (types compile; nothing imports them yet).

- [ ] **Step 3: Commit**

```bash
git add packages/domain/src/riparto/types.ts
git commit -m "feat(domain): clean riparto engine I/O types (RipartoInput, RipartoEngine)"
```

---

### Task 3: The pure engine `computeRiparto` in `@cl/domain`

**Files:**
- Create: `packages/domain/src/riparto/computeRiparto.ts`
- Create: `packages/domain/src/riparto/computeRiparto.test.ts`
- Modify: `packages/domain/src/index.ts`

The body below is the math from `apps/web/tools/gen/project/riparto.ts` **unchanged**, with only the data-source prologue replaced by reads from `RipartoInput` (and `num()`/`eur()`/`str()` dropped because the input is already clean). Compare against the original to confirm the algorithm is identical.

- [ ] **Step 1: Create the engine**

```ts
// packages/domain/src/riparto/computeRiparto.ts
import type { RipartoInput, RipartoEngine, LinkRef, LinkedColumn, Mode, ResidentInfo } from "./types";

/**
 * Build the riparto engine for one accounting period from a clean input.
 * Pure: depends only on `input`. All amounts are integer cents.
 * Algorithm is identical to the legacy generator engine; only the data source differs.
 */
export function buildRiparto(input: RipartoInput): RipartoEngine {
  // --- accounts ----------------------------------------------------------
  const acctById = new Map(input.accounts.map((a) => [a.id, a]));
  const childrenOf = new Map<string, string[]>();
  for (const a of input.accounts) {
    const parent = a.parentId;
    if (parent && acctById.has(parent)) {
      (childrenOf.get(parent) ?? childrenOf.set(parent, []).get(parent)!).push(a.id);
    }
  }

  // --- links keyed by account -------------------------------------------
  const linksByAccount = new Map<string, LinkRef[]>();
  for (const l of input.links) {
    const ref: LinkRef = { linkId: l.linkId, tableId: l.tableId, pct: l.pct, type: l.type };
    (linksByAccount.get(l.accountId) ?? linksByAccount.set(l.accountId, []).get(l.accountId)!).push(ref);
  }
  const isLinkedAccount = (id: string): boolean => (linksByAccount.get(id)?.length ?? 0) > 0;

  // --- own estimate / actual cents --------------------------------------
  const ownEstimateCents = (id: string): number => input.estimateCentsByAccount[id] ?? 0;
  const ownActualCents = (id: string): number => input.actualCentsByAccount[id] ?? 0;

  /**
   * Roll up estimate + actual over an account + descendants, EXCLUDING any
   * descendant that is itself a linked account (it owns its own subtree).
   * The root account itself is always included even though it is linked.
   */
  function subtreeFor(rootId: string): { estimateCents: number; actualCents: number } {
    let estimateCents = 0;
    let actualCents = 0;
    const visit = (id: string, isRoot: boolean): void => {
      if (!isRoot && isLinkedAccount(id)) return;
      estimateCents += ownEstimateCents(id);
      actualCents += ownActualCents(id);
      for (const k of childrenOf.get(id) ?? []) visit(k, false);
    };
    visit(rootId, true);
    return { estimateCents, actualCents };
  }
  const subtreeCache = new Map<string, { estimateCents: number; actualCents: number }>();
  const subtree = (accountId: string): { estimateCents: number; actualCents: number } => {
    let v = subtreeCache.get(accountId);
    if (!v) {
      v = subtreeFor(accountId);
      subtreeCache.set(accountId, v);
    }
    return v;
  };

  // --- distribution table coefficients -----------------------------------
  const itemsByTable = new Map<string, { unitId: string; coefficient: number }[]>();
  for (const it of input.tableItems) {
    (itemsByTable.get(it.tableId) ?? itemsByTable.set(it.tableId, []).get(it.tableId)!)
      .push({ unitId: it.unitId, coefficient: it.coefficient });
  }
  const tableTotalCache = new Map<string, number>();
  const tableTotal = (tableId: string): number => {
    let t = tableTotalCache.get(tableId);
    if (t === undefined) {
      t = (itemsByTable.get(tableId) ?? []).reduce((s, i) => s + i.coefficient, 0);
      tableTotalCache.set(tableId, t);
    }
    return t;
  };
  const coeff = (tableId: string, legacyUnitId: string): number => {
    const items = itemsByTable.get(tableId) ?? [];
    const mine = items.find((i) => i.unitId === legacyUnitId);
    return mine ? mine.coefficient : 0;
  };

  // --- role rows keyed by LINK id ----------------------------------------
  const rolesByLink = new Map<string, { priorityId: string; percentage: number }[]>();
  for (const r of input.roles) {
    (rolesByLink.get(r.linkId) ?? rolesByLink.set(r.linkId, []).get(r.linkId)!)
      .push({ priorityId: r.priorityId, percentage: r.percentage });
  }

  // --- residents keyed by legacy unit id ---------------------------------
  const residentsByUnit = new Map<string, ResidentInfo[]>();
  for (const r of input.residents) {
    const info: ResidentInfo = { id: r.residentId, priorityId: r.priorityId, percentage: r.percentage };
    (residentsByUnit.get(r.unitId) ?? residentsByUnit.set(r.unitId, []).get(r.unitId)!).push(info);
  }

  // --- columns: one per distinct linked account, ordered by account.order -
  const columns: LinkedColumn[] = [];
  for (const a of input.accounts.slice().sort((x, y) => x.order - y.order)) {
    const raw = linksByAccount.get(a.id);
    if (!raw || raw.length === 0) continue;
    const estimateSide = raw.find((l) => l.type === "estimate") ?? raw[0]!;
    columns.push({ legacyAccountId: a.id, name: a.name, links: raw, displayTableId: estimateSide.tableId });
  }
  const colByAccount = new Map(columns.map((c) => [c.legacyAccountId, c]));

  /** Pick the links relevant to a mode. */
  const chosenLinks = (col: LinkedColumn, mode: Mode): LinkRef[] => {
    if (mode === "estimate") {
      const est = col.links.filter((l) => l.type === "estimate");
      if (est.length > 0) return est;
      return col.links.filter((l) => l.type === null);
    }
    const cur = col.links.filter((l) => l.type === "currentBalance");
    if (cur.length > 0) return cur;
    return col.links.filter((l) => l.type === null);
  };

  /** per-unit amount, per chosen link, as a list (used by resident split). */
  function perUnitByLink(
    accountId: string,
    mode: Mode,
    legacyUnitId: string,
  ): { link: LinkRef; cents: number }[] {
    const col = colByAccount.get(accountId);
    if (!col) return [];
    const totals = subtree(accountId);
    const base = mode === "estimate" ? totals.estimateCents : totals.actualCents;
    const out: { link: LinkRef; cents: number }[] = [];
    for (const link of chosenLinks(col, mode)) {
      const tot = tableTotal(link.tableId);
      if (tot === 0) continue;
      const c = coeff(link.tableId, legacyUnitId);
      const cents = Math.round((base * link.pct) / 100 * (c / tot));
      out.push({ link, cents });
    }
    return out;
  }

  const perUnitAmount = (accountId: string, mode: Mode, legacyUnitId: string): number =>
    perUnitByLink(accountId, mode, legacyUnitId).reduce((s, x) => s + x.cents, 0);

  /** Split one link's per-unit amount among the unit's residents. */
  function splitLinkAmount(
    link: LinkRef,
    cents: number,
    residents: ResidentInfo[],
    out: Map<string, number>,
  ): void {
    if (cents === 0 || residents.length === 0) return;
    const owners = residents.filter((r) => r.priorityId === "1");
    const ownerFallback = owners.length > 0 ? owners : residents;

    const addTo = (group: ResidentInfo[], amount: number): void => {
      if (amount === 0) return;
      const totalPct = group.reduce((s, r) => s + r.percentage, 0);
      if (group.length === 1) {
        const only = group[0]!;
        out.set(only.id, (out.get(only.id) ?? 0) + amount);
        return;
      }
      if (totalPct > 0) {
        let allocated = 0;
        for (let i = 0; i < group.length; i++) {
          const r = group[i]!;
          const share =
            i === group.length - 1 ? amount - allocated : Math.round((amount * r.percentage) / totalPct);
          allocated += share;
          out.set(r.id, (out.get(r.id) ?? 0) + share);
        }
      } else {
        let allocated = 0;
        for (let i = 0; i < group.length; i++) {
          const r = group[i]!;
          const share = i === group.length - 1 ? amount - allocated : Math.round(amount / group.length);
          allocated += share;
          out.set(r.id, (out.get(r.id) ?? 0) + share);
        }
      }
    };

    const roles = rolesByLink.get(link.linkId) ?? [];
    if (roles.length === 0) {
      addTo(ownerFallback, cents);
      return;
    }

    let allocated = 0;
    for (let i = 0; i < roles.length; i++) {
      const role = roles[i]!;
      const rolePct = role.percentage;
      const share = i === roles.length - 1 ? cents - allocated : Math.round((cents * rolePct) / 100);
      allocated += share;
      const priorityId = role.priorityId;
      const group = residents.filter((r) => r.priorityId === priorityId);
      addTo(group.length > 0 ? group : ownerFallback, share);
    }
  }

  function perResidentAmount(accountId: string, mode: Mode, legacyUnitId: string): Map<string, number> {
    const out = new Map<string, number>();
    const residents = residentsByUnit.get(legacyUnitId) ?? [];
    for (const { link, cents } of perUnitByLink(accountId, mode, legacyUnitId)) {
      splitLinkAmount(link, cents, residents, out);
    }
    return out;
  }

  return { columns, perUnitAmount, subtree, perResidentAmount, unitLegacyIds: input.unitLegacyIds };
}
```

- [ ] **Step 2: Write crafted-fixture unit tests (write BEFORE running)**

```ts
// packages/domain/src/riparto/computeRiparto.test.ts
import { describe, it, expect } from "vitest";
import { buildRiparto } from "./computeRiparto";
import type { RipartoInput } from "./types";

// One expense account A (linked to table T at 100%), two units u1/u2 with coeffs 60/40,
// estimate 1000.00 € = 100000 cents. No role rows → goes to owners.
const base: RipartoInput = {
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
};

describe("computeRiparto", () => {
  it("exposes one column for the linked account", () => {
    const eng = buildRiparto(base);
    expect(eng.columns.map((c) => c.legacyAccountId)).toEqual(["A"]);
    expect(eng.columns[0]!.displayTableId).toBe("T");
  });

  it("splits the estimate per unit by coefficient", () => {
    const eng = buildRiparto(base);
    expect(eng.perUnitAmount("A", "estimate", "u1")).toBe(60000);
    expect(eng.perUnitAmount("A", "estimate", "u2")).toBe(40000);
  });

  it("routes a unit's amount to its single owner resident", () => {
    const eng = buildRiparto(base);
    const r = eng.perResidentAmount("A", "estimate", "u1");
    expect(r.get("r1")).toBe(60000);
    expect([...r.values()].reduce((s, c) => s + c, 0)).toBe(60000);
  });

  it("applies an owner/tenant role split (priority 1 = owner 70%, priority 3 = tenant 30%)", () => {
    const withRoles: RipartoInput = {
      ...base,
      links: [{ accountId: "A", linkId: "L1", tableId: "T", pct: 100, type: null }],
      roles: [
        { linkId: "L1", priorityId: "1", percentage: 70 },
        { linkId: "L1", priorityId: "3", percentage: 30 },
      ],
      residents: [
        { unitId: "u1", residentId: "owner1", priorityId: "1", percentage: 100 },
        { unitId: "u1", residentId: "tenant1", priorityId: "3", percentage: 100 },
        { unitId: "u2", residentId: "r2", priorityId: "1", percentage: 100 },
      ],
    };
    const eng = buildRiparto(withRoles);
    const r = eng.perResidentAmount("A", "estimate", "u1"); // u1 share = 60000
    expect(r.get("owner1")).toBe(42000); // 70%
    expect(r.get("tenant1")).toBe(18000); // 30% (residual to last role)
    expect([...r.values()].reduce((s, c) => s + c, 0)).toBe(60000);
  });

  it("conserves money: Σ per-unit equals the rolled-up subtree estimate", () => {
    const eng = buildRiparto(base);
    const total = eng.unitLegacyIds.reduce((s, u) => s + eng.perUnitAmount("A", "estimate", u), 0);
    expect(total).toBe(eng.subtree("A").estimateCents);
  });
});
```

- [ ] **Step 3: Export from the domain barrel**

In `packages/domain/src/index.ts`, append so it reads:

```ts
export * from "./money";
export * from "./allocate";
export * from "./riparto/types";
export * from "./riparto/computeRiparto";
```

- [ ] **Step 4: Run the domain tests (expect PASS)**

Run: `pnpm --filter @cl/domain test`
Expected: PASS — `computeRiparto` suite green (5 assertions) + money + allocate. `pnpm --filter @cl/domain exec tsc --noEmit` exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/riparto/computeRiparto.ts packages/domain/src/riparto/computeRiparto.test.ts packages/domain/src/index.ts
git commit -m "feat(domain): pure riparto engine (computeRiparto) — math lifted from the generator"
```

---

### Task 4: Generator adapter `dbToRipartoInput`

**Files:**
- Create: `apps/web/tools/gen/project/ripartoInput.ts`
- Create: `apps/web/tools/gen/project/ripartoInput.test.ts`

The adapter performs **exactly** the `Db` reads/conversions the original `buildRiparto` prologue did (lines 70–166, 317–321 of `riparto.ts`), producing a clean `RipartoInput`. Global `db.group`/`db.by` lookups are mirrored as-is (only this-period ids are ever queried, so global vs filtered is behaviourally identical).

- [ ] **Step 1: Create the adapter**

```ts
// apps/web/tools/gen/project/ripartoInput.ts
import type { Db } from "../db.ts";
import { eur } from "../amounts.ts";
import type { RipartoInput } from "@cl/domain";

const str = (v: unknown): string | undefined =>
  v === null || v === undefined || String(v).trim() === "" ? undefined : String(v).trim();
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

/** Adapt the legacy Db (one accounting period) into the pure engine's clean input. */
export function dbToRipartoInput(db: Db, periodId: string): RipartoInput {
  // accounts in this period
  const accounts = db
    .rows("ledgerAccount")
    .filter((a) => String(a.accountingPeriodId) === periodId)
    .map((a) => ({
      id: String(a.id),
      name: String(a.name),
      order: num(a.order),
      parentId: str(a.parentLedgerAccountId) ?? null,
    }));

  // links (expenseLA2Table) — pct resolved (null→100), type normalised
  const links: RipartoInput["links"] = [];
  for (const l of db.rows("expenseLA2Table")) {
    links.push({
      accountId: String(l.expenseLedgerAccountId),
      linkId: String(l.id),
      tableId: String(l.distributionTableId),
      pct: l.percentage === null || l.percentage === undefined ? 100 : num(l.percentage),
      type:
        l.type === "estimate" || l.type === "currentBalance"
          ? (l.type as "estimate" | "currentBalance")
          : null,
    });
  }

  // own estimate cents per account (expenseLedgerAccount.estimate)
  const estimateCentsByAccount: Record<string, number> = {};
  for (const e of db.rows("expenseLedgerAccount")) {
    estimateCentsByAccount[String(e.ledgerAccountId)] = eur(str(e.estimate) ?? null).cents;
  }

  // own signed actual cents per posting account, this period
  const txInPeriod = new Set(
    db
      .rows("ledgerTransaction")
      .filter((t) => String(t.accountingPeriodId) === periodId)
      .map((t) => String(t.id)),
  );
  const actualCentsByAccount: Record<string, number> = {};
  for (const e of db.rows("ledgerEntry")) {
    if (!txInPeriod.has(String(e.ledgerTransactionId))) continue;
    const acct = String(e.postingAccountId);
    actualCentsByAccount[acct] = (actualCentsByAccount[acct] ?? 0) + eur(str(e.amount) ?? null).cents;
  }

  // distribution table coefficients
  const tableItems = db.rows("distributionTableItem").map((it) => ({
    tableId: String(it.distributionTableId),
    unitId: String(it.unitId),
    coefficient: num(it.coefficient),
  }));

  // role rows (expenseLA2Role) keyed by LINK id
  const roles = db.rows("expenseLA2Role").map((r) => ({
    linkId: String(r.expenseLA2TableId),
    priorityId: String(r.unitResidentPriorityId),
    percentage: num(r.percentage),
  }));

  // residents of this period, joined to their unit via unitPeriod
  const upById = db.by("unitPeriod", "id");
  const residents: RipartoInput["residents"] = [];
  for (const r of db.rows("unitResident")) {
    const up = upById.get(String(r.unitPeriodId));
    if (!up) continue;
    residents.push({
      unitId: String(up.unitId),
      residentId: String(r.id),
      priorityId: String(r.unitResidentPriorityId),
      percentage: num(r.percentage),
    });
  }

  // unit ids present this period, sorted by code (Italian collation)
  const unitLegacyIds = db
    .rows("unit")
    .filter((u) => String(u.accountingPeriodId) === periodId)
    .sort((a, b) => String(a.code ?? "").localeCompare(String(b.code ?? ""), "it"))
    .map((u) => String(u.id));

  return {
    accounts,
    links,
    estimateCentsByAccount,
    actualCentsByAccount,
    tableItems,
    roles,
    residents,
    unitLegacyIds,
  };
}
```

- [ ] **Step 2: Write the adapter test (real dump; exercises the period that reconciles)**

```ts
// apps/web/tools/gen/project/ripartoInput.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTables } from "../loadRows.ts";
import { buildDb } from "../db.ts";
import { dbToRipartoInput } from "./ripartoInput.ts";
import { buildRiparto } from "@cl/domain";

// cwd = apps/web under Vitest; the dump is read cwd-relative (a known Vitest quirk).
const db = buildDb(parseTables(readFileSync(resolve(process.cwd(), "../../old/db/it-jtime-condominium.all.sql"), "utf8")));

describe("dbToRipartoInput", () => {
  it("produces a non-empty, well-formed input for Pozzetto 2013 (period 36)", () => {
    const input = dbToRipartoInput(db, "36");
    expect(input.accounts.length).toBeGreaterThan(0);
    expect(input.unitLegacyIds.length).toBeGreaterThan(0);
    expect(input.tableItems.length).toBeGreaterThan(0);
  });

  it("feeds the pure engine: matrix ties out to the linked-expense subtree (conservation)", () => {
    const eng = buildRiparto(dbToRipartoInput(db, "36"));
    const matrix = eng.columns.reduce(
      (s, c) => s + eng.unitLegacyIds.reduce((u, id) => u + eng.perUnitAmount(c.legacyAccountId, "estimate", id), 0),
      0,
    );
    const src = eng.columns.reduce((s, c) => s + eng.subtree(c.legacyAccountId).estimateCents, 0);
    // per-cell rounding tolerance (Math.round per column×unit)
    expect(Math.abs(matrix - src)).toBeLessThanOrEqual(eng.columns.length * eng.unitLegacyIds.length);
  });
});
```

- [ ] **Step 3: Run the adapter test (expect PASS)**

Run: `cd apps/web && pnpm exec vitest run tools/gen/project/ripartoInput.test.ts`
Expected: PASS (2 assertions). `cd apps/web && pnpm exec tsc -p tools/tsconfig.json --noEmit` exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/tools/gen/project/ripartoInput.ts apps/web/tools/gen/project/ripartoInput.test.ts
git commit -m "feat(web/gen): dbToRipartoInput adapter (legacy Db -> clean RipartoInput)"
```

---

### Task 5: Re-point the three call sites; delete the old engine; prove byte-identical output

**Files:**
- Modify: `apps/web/tools/gen/project/distribution.ts:9,41`
- Modify: `apps/web/tools/gen/project/units.ts:5,100`
- Modify: `apps/web/tools/gen/specs/steps.ts:8` (+ the `buildRiparto` call site)
- Delete: `apps/web/tools/gen/project/riparto.ts`

- [ ] **Step 1: Re-point `distribution.ts`**

Change line 9 from `import { buildRiparto, type Mode } from "./riparto.ts";` to:

```ts
import { buildRiparto, type Mode } from "@cl/domain";
import { dbToRipartoInput } from "./ripartoInput.ts";
```

Change line 41 from `const eng = buildRiparto(db, periodId);` to:

```ts
  const eng = buildRiparto(dbToRipartoInput(db, periodId));
```

- [ ] **Step 2: Re-point `units.ts`**

Change line 5 from `import { buildRiparto, type Mode } from "./riparto.ts";` to:

```ts
import { buildRiparto, type Mode } from "@cl/domain";
import { dbToRipartoInput } from "./ripartoInput.ts";
```

Change line 100 from `const eng = buildRiparto(db, periodId);` to:

```ts
  const eng = buildRiparto(dbToRipartoInput(db, periodId));
```

- [ ] **Step 3: Re-point the parity spec steps**

In `apps/web/tools/gen/specs/steps.ts` change line 8 from `import { buildRiparto } from "../project/riparto.ts";` to:

```ts
import { buildRiparto } from "@cl/domain";
import { dbToRipartoInput } from "../project/ripartoInput.ts";
```

Then update the two `buildRiparto(w.db, w.legacyPeriodId!)` call sites in `steps.ts` (the riparto tie-out steps and the per-resident-preventivo step) to:

```ts
const eng = buildRiparto(dbToRipartoInput(w.db, w.legacyPeriodId!));
```

(Find each `buildRiparto(w.db, w.legacyPeriodId!)` occurrence and wrap the argument with `dbToRipartoInput(...)`. There are two occurrences.)

- [ ] **Step 4: Delete the old engine**

```bash
git rm apps/web/tools/gen/project/riparto.ts
```

- [ ] **Step 5: Typecheck + run the generator/projection + parity suites**

Run, expecting all green:
```bash
cd apps/web && pnpm exec tsc -p tools/tsconfig.json --noEmit
cd apps/web && pnpm exec vitest run tools/gen/project/distribution.test.ts tools/gen/project/units.test.ts
cd apps/web && pnpm exec vitest run tools/gen/specs/specs.test.ts
```
Expected: tsc exit 0; distribution/units projection tests green (unchanged behaviour); parity specs 13 scenarios green.

- [ ] **Step 6: Regenerate the seed and prove it is byte-identical (the extraction gate)**

```bash
pnpm --filter @cl/web gen
git diff --stat apps/web/src/mock/data.generated.json
```
Expected: **no diff** — `data.generated.json` is unchanged, proving the extracted engine reproduces the legacy numbers exactly. If there IS a diff, the lift was not behaviour-preserving: do NOT commit; diff the values, find where the adapter or engine diverges from the original `riparto.ts`, fix, and re-run until the seed is identical.

- [ ] **Step 7: Full web suite**

Run: `pnpm --filter @cl/web test`
Expected: PASS — full suite green (same count as before this plan, minus the 3 `allocate` assertions that moved to `@cl/domain`).

- [ ] **Step 8: Commit**

```bash
git add apps/web/tools/gen/project/distribution.ts apps/web/tools/gen/project/units.ts apps/web/tools/gen/specs/steps.ts
git commit -m "refactor(web/gen): consume the pure @cl/domain riparto engine; remove duplicate engine

The faithful riparto math now lives once in @cl/domain; the generator adapts the
legacy Db into the engine's clean input. data.generated.json is byte-identical and
the parity specs stay green (the extraction's equivalence gate)."
```

---

### Task 6: Document the engine + final verification

**Files:**
- Modify: `docs/domain/README.md` (point at the engine's new home)
- Test: whole-repo verification

- [ ] **Step 1: Add a short pointer in the domain docs**

In `docs/domain/README.md`, under the "Parity specs" section (or as a new short paragraph after it), add:

```markdown
**Riparto engine** — the faithful distribution math lives once in
`packages/domain/src/riparto/computeRiparto.ts` (pure, store/DB-agnostic). The offline
generator adapts the legacy dump into it via `apps/web/tools/gen/project/ripartoInput.ts`;
`data.generated.json` is byte-identical to the pre-extraction output (the parity specs are
the gate). This is Phase 0 of the recompute-engine work
(`docs/superpowers/specs/2026-06-16-recompute-engine-design.md`); the live-app reactive
cascade is a later phase.
```

- [ ] **Step 2: Whole-repo verification**

Run, expecting all green:
```bash
pnpm --filter @cl/domain exec tsc --noEmit
pnpm --filter @cl/domain test
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && pnpm --filter @cl/web exec tsc -p tools/tsconfig.json --noEmit
pnpm --filter @cl/web test
git status --short
```
Expected: domain tsc/tests green; web tools tsc exit 0; full web suite green; `git status` clean except the staged docs change. Confirm once more `git diff --stat apps/web/src/mock/data.generated.json` shows no change.

- [ ] **Step 3: Commit**

```bash
git add docs/domain/README.md
git commit -m "docs(domain): point at the extracted riparto engine (Phase 0)"
```

---

## Self-review checklist (completed)

**Spec coverage (Phase 0 scope):** pure engine extracted to `@cl/domain` with clean I/O (Tasks 2–3) ✓; `allocate` unified into `@cl/domain` (Task 1) ✓; generator adapts legacy `Db` → clean input (Task 4) ✓; both generator consumers + the parity-spec consumer re-pointed and the duplicate engine deleted (Task 5) ✓; byte-identical `data.generated.json` as the equivalence gate, parity specs green (Task 5 Step 6) ✓; docs pointer (Task 6) ✓. Phase 1 (live-app reactive cascade) and Phase 2 (structural) are explicitly out of this plan — they get their own plans (Phase 1 planned once this engine API is concrete).

**Placeholder scan:** none — every code step shows complete source; every run step shows the exact command and expected result; the one branch ("if the seed diffs") gives a concrete remediation, not a TODO.

**Type consistency:** `RipartoInput`/`RipartoEngine`/`LinkRef`/`LinkedColumn`/`Mode`/`ResidentInfo` are defined in Task 2 and used unchanged in Tasks 3–5; `buildRiparto(input)` (domain) and `dbToRipartoInput(db, periodId)` (generator) signatures match across Tasks 3/4/5; the engine's public method names (`perUnitAmount`, `subtree`, `perResidentAmount`, `unitLegacyIds`, `columns`) match the original so `distribution.ts`/`units.ts`/`steps.ts` need no further change beyond the constructor call; `allocate` import path (`@cl/domain`) is consistent across Task 1's re-points.
