# Prototype Completion — Plan 1 of 4: Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the read-only mock data layer of `apps/web` into a stateful in-memory store with command methods, recompute functions, and the shared form/editor/wizard primitives that Plans 2–4 (section completions, Calendario, Anagrafiche) build on.

**Architecture:** `MockDataSource` is reimplemented as `MockStore` — one RxJS `BehaviorSubject` per fixture collection; the existing read methods become derivations so every current consumer keeps working. Command methods (inline edits, accounting flows, CRUD) mutate the subjects immutably; pure functions in `apps/web/src/recompute/` derive balances, riparto splits (largest-remainder rounding), and installment distributions. UI primitives (inline money editor, form fields, wizard step machinery, paging/search/toggle/toast) are token-styled and dumb — all state flows through the runtime port.

**Tech Stack:** React 18 + TypeScript strict, RxJS + react-rxjs (`bind` in composition root), Radix Dialog, TanStack Table (already wrapped by `TreeTable`), CSS Modules + tokens, Vitest + React Testing Library. Money is integer-cents (`@cl/domain`).

**Spec:** `docs/superpowers/specs/2026-06-11-prototype-completion-design.md` (§3 Part 1, §5.3 runtime additions).

**Conventions used throughout:**
- Run a single test file: `pnpm --filter @cl/web exec vitest run <path-relative-to-apps/web>`
- Run the whole suite: `pnpm --filter @cl/web test` (currently 28 tests, must stay green)
- Typecheck: `pnpm --filter @cl/web typecheck`
- All money values are **integer cents** (`fromCents` from `@cl/domain`). Never floats.
- Observable test helper (repeated in test files that need it):

```ts
import type { Observable } from "rxjs";
const latest = <T,>(obs: Observable<T>): T => {
  let v!: T;
  obs.subscribe((x) => { v = x; }).unsubscribe();
  return v;
};
```

---

## File structure (locked in by this plan)

```
packages/application/src/types.ts        # + command input types, DistributionRow.unitId
packages/application/src/ports.ts        # + DataCommands, CrudCommands; MockDataSource extends them (Task 11)
apps/web/src/recompute/allocate.ts       # largest-remainder integer allocation (NEW)
apps/web/src/recompute/installments.ts   # estimate distribution + override redistribution (NEW)
apps/web/src/recompute/balances.ts       # entry deltas → account-tree balances (NEW)
apps/web/src/recompute/distribution.ts   # coefficients → riparto re-split (NEW)
apps/web/src/recompute/dates.ts          # addMonths / formatItDate (NEW)
apps/web/src/mock/treeRows.ts            # generic immutable tree-row helpers (NEW)
apps/web/src/mock/MockStore.ts           # the stateful store (NEW)
apps/web/src/mock/MockDataSource.ts      # becomes a one-line factory re-export
apps/web/src/mock/fixtures.ts            # + unitId on distribution unit rows
apps/web/src/runtime/createAppRuntime.ts # + commands passthrough, per-section row selection
apps/web/src/components/forms/parse.ts   # it-IT money string ⇄ cents (NEW)
apps/web/src/components/forms/fields.tsx # TextField/SelectField/DateField/MoneyField/CheckboxField (NEW)
apps/web/src/components/forms/fields.module.css (NEW)
apps/web/src/components/grid/inlineEditors.tsx  # + InlineMoney
apps/web/src/components/common/WizardDialog.tsx # step machinery (REWRITE, call sites shimmed)
apps/web/src/components/common/PagingBar.tsx, SearchBox.tsx, ToolbarToggle.tsx (NEW)
apps/web/src/components/common/Toast.tsx # ToastProvider + useToast (NEW)
```

Plans 2–4 are written after this plan lands, against these real APIs.

---

### Task 1: Feature branch

**Files:** none (git only)

- [ ] **Step 1: Create the branch**

```bash
git checkout -b feat/prototype-complete
```

- [ ] **Step 2: Verify clean state and green suite**

Run: `git status --short && pnpm --filter @cl/web test`
Expected: no modified files; `Test Files 16 passed`, `Tests 28 passed`.

---

### Task 2: `allocate` — largest-remainder integer split

The single rounding primitive everything else uses (riparto, rate, redistributions). Splitting
integer cents by weights must (a) always sum exactly to the input total, (b) hand leftover cents
to the largest fractional shares (this is what the legacy "arrotondamento" screenshots show).

**Files:**
- Create: `apps/web/src/recompute/allocate.ts`
- Test: `apps/web/src/recompute/allocate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/recompute/allocate.test.ts
import { describe, it, expect } from "vitest";
import { allocate } from "./allocate";

describe("allocate (largest remainder)", () => {
  it("splits exactly, handing leftover cents to the largest fractional parts", () => {
    // 1000 cents over equal thirds → 334/333/333 (first index wins the tie)
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333]);
  });
  it("preserves the total for millesimal weights", () => {
    const out = allocate(200000, [312.5, 687.5]);
    expect(out[0] + out[1]).toBe(200000);
    expect(out).toEqual([62500, 137500]);
  });
  it("handles negative totals symmetrically", () => {
    expect(allocate(-1000, [1, 1, 1])).toEqual([-334, -333, -333]);
  });
  it("returns zeros when all weights are zero", () => {
    expect(allocate(500, [0, 0])).toEqual([0, 0]);
  });
  it("rejects non-integer totals", () => {
    expect(() => allocate(10.5, [1])).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cl/web exec vitest run src/recompute/allocate.test.ts`
Expected: FAIL — `Cannot find module './allocate'` (or equivalent resolve error).

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/src/recompute/allocate.ts

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
  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) out[order[k].i] += 1;
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cl/web exec vitest run src/recompute/allocate.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/recompute/allocate.ts apps/web/src/recompute/allocate.test.ts
git commit -m "feat(web): largest-remainder cent allocation (recompute primitive)"
```

---

### Task 3: Installment distribution & override redistribution

**Files:**
- Create: `apps/web/src/recompute/installments.ts`
- Test: `apps/web/src/recompute/installments.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/recompute/installments.test.ts
import { describe, it, expect } from "vitest";
import { distributeInstallments, redistributeOverride } from "./installments";

describe("distributeInstallments", () => {
  it("allocates total by coefficient, then per resident across N rate", () => {
    const out = distributeInstallments(200000, [312.5, 687.5], 3);
    expect(out).toEqual([
      [20834, 20833, 20833],   // 62500 over 3
      [45834, 45833, 45833],   // 137500 over 3
    ]);
    const grand = out.flat().reduce((a, b) => a + b, 0);
    expect(grand).toBe(200000);
  });
});

describe("redistributeOverride", () => {
  it("keeps the row total constant by spreading the delta over later cells", () => {
    expect(redistributeOverride([300, 300, 400], 0, 250)).toEqual([250, 325, 425]);
  });
  it("leaves earlier cells untouched and absorbs into nothing when last cell edited", () => {
    expect(redistributeOverride([300, 300, 400], 2, 350)).toEqual([300, 300, 350]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cl/web exec vitest run src/recompute/installments.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/src/recompute/installments.ts
import { allocate } from "./allocate";

/** amounts[resident][installment]: total → per resident (by coefficient) → equal split per rata. */
export function distributeInstallments(
  totalCents: number, coefficients: number[], count: number,
): number[][] {
  const perResident = allocate(totalCents, coefficients);
  return perResident.map((cents) => allocate(cents, Array(count).fill(1)));
}

/** Manual override of one cell. The difference is spread over the LATER cells
 * (largest remainder), keeping the row total constant — the legacy behavior for
 * rounding adjustments. Editing the last cell simply changes the row total. */
export function redistributeOverride(cells: number[], index: number, newValue: number): number[] {
  const out = [...cells];
  const delta = out[index] - newValue;
  out[index] = newValue;
  const later = out.map((_, i) => i).filter((i) => i > index);
  if (later.length === 0 || delta === 0) return out;
  const split = allocate(delta, later.map(() => 1));
  later.forEach((cellIdx, k) => { out[cellIdx] += split[k]; });
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cl/web exec vitest run src/recompute/installments.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/recompute/installments.ts apps/web/src/recompute/installments.test.ts
git commit -m "feat(web): installment distribution + manual-override redistribution"
```

---

### Task 4: Account-balance derivation from entry deltas

Fixture balances are the baseline; posting a transaction applies deltas to the touched leaf
accounts and re-derives ONLY the ancestors on the changed paths (so untouched fixture rollups
never shift, keeping existing section tests stable).

**Files:**
- Create: `apps/web/src/recompute/balances.ts`
- Test: `apps/web/src/recompute/balances.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/recompute/balances.test.ts
import { describe, it, expect } from "vitest";
import { fromCents } from "@cl/domain";
import type { LedgerAccountRow } from "@cl/application";
import { applyEntryDeltas } from "./balances";

const c = fromCents;
const tree: LedgerAccountRow[] = [
  { id: "tot", kind: "grouping", label: "Totale", dare: c(300), avere: c(100), saldo: c(200), preventivo: null,
    children: [
      { id: "cassa", kind: "regular", label: "Cassa", dare: c(200), avere: c(0), saldo: c(200), preventivo: null },
      { id: "banca", kind: "regular", label: "Banca", dare: c(100), avere: c(100), saldo: c(0), preventivo: null },
    ] },
];

describe("applyEntryDeltas", () => {
  it("updates the touched leaf and re-derives its ancestors", () => {
    const out = applyEntryDeltas(tree, [{ accountId: "cassa", dareCents: 50, avereCents: 0 }]);
    const tot = out[0];
    const cassa = tot.children![0];
    expect(cassa.dare.cents).toBe(250);
    expect(cassa.saldo.cents).toBe(250);
    expect(tot.dare.cents).toBe(350);
    expect(tot.saldo.cents).toBe(250);
  });
  it("leaves untouched subtrees referentially identical", () => {
    const out = applyEntryDeltas(tree, [{ accountId: "cassa", dareCents: 50, avereCents: 0 }]);
    expect(out[0].children![1]).toBe(tree[0].children![1]); // banca untouched
  });
  it("is the identity for unknown accounts", () => {
    expect(applyEntryDeltas(tree, [{ accountId: "nope", dareCents: 1, avereCents: 0 }])[0]).toBe(tree[0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cl/web exec vitest run src/recompute/balances.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/src/recompute/balances.ts
import { fromCents } from "@cl/domain";
import type { Id, LedgerAccountRow } from "@cl/application";

export interface EntryDelta { accountId: Id; dareCents: number; avereCents: number; }

/** Apply deltas to leaf accounts; ancestors of changed leaves absorb the summed
 * child deltas. Unchanged subtrees are returned by reference. */
export function applyEntryDeltas(rows: LedgerAccountRow[], deltas: EntryDelta[]): LedgerAccountRow[] {
  const byAccount = new Map<Id, { dare: number; avere: number }>();
  for (const d of deltas) {
    const cur = byAccount.get(d.accountId) ?? { dare: 0, avere: 0 };
    byAccount.set(d.accountId, { dare: cur.dare + d.dareCents, avere: cur.avere + d.avereCents });
  }
  const walk = (row: LedgerAccountRow): { row: LedgerAccountRow; dareDelta: number; avereDelta: number } => {
    if (row.children?.length) {
      const results = row.children.map(walk);
      const dareDelta = results.reduce((a, r) => a + r.dareDelta, 0);
      const avereDelta = results.reduce((a, r) => a + r.avereDelta, 0);
      if (dareDelta === 0 && avereDelta === 0) return { row, dareDelta: 0, avereDelta: 0 };
      const dare = row.dare.cents + dareDelta;
      const avere = row.avere.cents + avereDelta;
      return {
        row: { ...row, children: results.map((r) => r.row), dare: fromCents(dare), avere: fromCents(avere), saldo: fromCents(dare - avere) },
        dareDelta, avereDelta,
      };
    }
    const d = byAccount.get(row.id);
    if (!d) return { row, dareDelta: 0, avereDelta: 0 };
    const dare = row.dare.cents + d.dare;
    const avere = row.avere.cents + d.avere;
    return {
      row: { ...row, dare: fromCents(dare), avere: fromCents(avere), saldo: fromCents(dare - avere) },
      dareDelta: d.dare, avereDelta: d.avere,
    };
  };
  return rows.map((r) => walk(r).row);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cl/web exec vitest run src/recompute/balances.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/recompute/balances.ts apps/web/src/recompute/balances.test.ts
git commit -m "feat(web): account-balance derivation from ledger entry deltas"
```

---

### Task 5: Generic tree-row helpers

Immutable surgery on `{ id, children? }` trees — used by every CRUD command and the
installment/unit updates.

**Files:**
- Create: `apps/web/src/mock/treeRows.ts`
- Test: `apps/web/src/mock/treeRows.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/mock/treeRows.test.ts
import { describe, it, expect } from "vitest";
import { mapRow, removeRow, insertChild, findRow } from "./treeRows";

type R = { id: string; v?: number; children?: R[] };
const rows: R[] = [{ id: "a", children: [{ id: "a1" }, { id: "a2", children: [{ id: "a2x" }] }] }];

describe("treeRows", () => {
  it("mapRow replaces the matching node, preserving untouched branches by reference", () => {
    const out = mapRow(rows, "a2x", (r) => ({ ...r, v: 7 }));
    expect(findRow(out, "a2x")?.v).toBe(7);
    expect(out[0].children![0]).toBe(rows[0].children![0]); // a1 untouched
  });
  it("removeRow drops the node anywhere in the tree", () => {
    expect(findRow(removeRow(rows, "a2x"), "a2x")).toBeNull();
  });
  it("insertChild appends under the parent (or at the root for null parent)", () => {
    const out = insertChild(rows, "a1", { id: "new" });
    expect(findRow(out, "a1")?.children?.[0].id).toBe("new");
    expect(insertChild(rows, null, { id: "root2" })[1].id).toBe("root2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cl/web exec vitest run src/mock/treeRows.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/src/mock/treeRows.ts
export interface TreeRowLike { id: string; children?: TreeRowLike[] }

export function mapRow<R extends TreeRowLike>(rows: R[], id: string, fn: (r: R) => R): R[] {
  let changed = false;
  const out = rows.map((r): R => {
    if (r.id === id) { changed = true; return fn(r); }
    if (r.children?.length) {
      const children = mapRow(r.children as R[], id, fn);
      if (children !== r.children) { changed = true; return { ...r, children }; }
    }
    return r;
  });
  return changed ? out : rows;
}

export function removeRow<R extends TreeRowLike>(rows: R[], id: string): R[] {
  const filtered = rows.filter((r) => r.id !== id);
  return filtered.map((r): R =>
    r.children?.length ? { ...r, children: removeRow(r.children as R[], id) } : r,
  );
}

export function insertChild<R extends TreeRowLike>(rows: R[], parentId: string | null, child: R): R[] {
  if (parentId === null) return [...rows, child];
  return mapRow(rows, parentId, (p) => ({ ...p, children: [...(p.children ?? []), child] }));
}

export function findRow<R extends TreeRowLike>(rows: R[], id: string): R | null {
  for (const r of rows) {
    if (r.id === id) return r;
    const hit = r.children?.length ? findRow(r.children as R[], id) : null;
    if (hit) return hit;
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cl/web exec vitest run src/mock/treeRows.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/mock/treeRows.ts apps/web/src/mock/treeRows.test.ts
git commit -m "feat(web): immutable tree-row helpers for store commands"
```

---

### Task 6: `MockStore` skeleton — subjects + derived reads

Reads must behave exactly as today (existing 28 tests stay green); the only change is that data
now lives in `BehaviorSubject`s so later commands can re-emit.

**Files:**
- Create: `apps/web/src/mock/MockStore.ts`
- Modify: `apps/web/src/mock/MockDataSource.ts` (becomes factory re-export)
- Test: `apps/web/src/mock/MockStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/mock/MockStore.test.ts
import { describe, it, expect } from "vitest";
import type { Observable } from "rxjs";
import { MockStore } from "./MockStore";

const latest = <T,>(obs: Observable<T>): T => {
  let v!: T;
  obs.subscribe((x) => { v = x; }).unsubscribe();
  return v;
};

describe("MockStore reads", () => {
  it("serves the fixture tree and per-period collections", () => {
    const s = new MockStore();
    expect(latest(s.condominiumTree()).map((n) => n.id)).toEqual(["poz", "sat"]);
    expect(latest(s.unitsTree("sat-2011"))[0].id).toBe("g-sat");
    expect(latest(s.unitsTree("unknown"))).toEqual([]);
    expect(latest(s.condominiumDetail("unknown"))).toBeNull();
    expect(latest(s.installments("poz-2010")).columns).toHaveLength(2);
  });
  it("re-emits on subject change (reactive reads)", () => {
    const s = new MockStore();
    const seen: number[] = [];
    const sub = s.ledgerTransactions("sat-2011").subscribe((t) => seen.push(t.length));
    expect(seen).toEqual([3]);
    sub.unsubscribe();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cl/web exec vitest run src/mock/MockStore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the store skeleton**

```ts
// apps/web/src/mock/MockStore.ts
import { BehaviorSubject, map, type Observable } from "rxjs";
import type {
  MockDataSource, Id, DistributionType, CondominiumNode, CondominiumDetail,
  UnitRow, DistributionTable, DistributionColumn, DistributionRow,
  LedgerAccountRow, LedgerTxnRow, InstallmentColumn, InstallmentRow,
} from "@cl/application";
import * as fx from "./fixtures";

type Dist = { columns: DistributionColumn[]; rows: DistributionRow[] };
type Installments = { columns: InstallmentColumn[]; rows: InstallmentRow[] };

export class MockStore implements MockDataSource {
  private tree$ = new BehaviorSubject<CondominiumNode[]>(fx.tree);
  private details$ = new BehaviorSubject<Record<Id, CondominiumDetail>>(fx.detailByPeriod);
  private units$ = new BehaviorSubject<Record<Id, UnitRow[]>>(fx.unitsByPeriod);
  private tables$ = new BehaviorSubject<Record<Id, DistributionTable[]>>(fx.distributionTablesByPeriod);
  private distributions$ = new BehaviorSubject<Record<Id, Record<DistributionType, Dist>>>(fx.distributionByPeriod);
  private accounts$ = new BehaviorSubject<Record<Id, LedgerAccountRow[]>>(fx.ledgerAccountsByPeriod);
  private txns$ = new BehaviorSubject<Record<Id, LedgerTxnRow[]>>(fx.ledgerTxnsByPeriod);
  private installments$ = new BehaviorSubject<Record<Id, Installments>>(fx.installmentsByPeriod);

  condominiumTree(): Observable<CondominiumNode[]> { return this.tree$.asObservable(); }
  condominiumDetail(periodId: Id) { return this.details$.pipe(map((d) => d[periodId] ?? null)); }
  unitsTree(periodId: Id) { return this.units$.pipe(map((u) => u[periodId] ?? [])); }
  distributionTables(periodId: Id) { return this.tables$.pipe(map((t) => t[periodId] ?? [])); }
  distribution(periodId: Id, type: DistributionType): Observable<Dist> {
    return this.distributions$.pipe(map((d) => d[periodId]?.[type] ?? { columns: [], rows: [] }));
  }
  ledgerAccountsTree(periodId: Id) { return this.accounts$.pipe(map((a) => a[periodId] ?? [])); }
  ledgerTransactions(periodId: Id) { return this.txns$.pipe(map((t) => t[periodId] ?? [])); }
  installments(periodId: Id): Observable<Installments> {
    return this.installments$.pipe(map((i) => i[periodId] ?? { columns: [], rows: [] }));
  }

  /** Immutable per-period patch; commands in later tasks build on this. */
  protected patch<K>(
    subject: BehaviorSubject<Record<Id, K>>, periodId: Id, empty: K, fn: (cur: K) => K,
  ): void {
    const cur = subject.getValue();
    subject.next({ ...cur, [periodId]: fn(cur[periodId] ?? empty) });
  }
}
```

- [ ] **Step 4: Replace the old factory**

```ts
// apps/web/src/mock/MockDataSource.ts  (entire new content)
import type { MockDataSource } from "@cl/application";
import { MockStore } from "./MockStore";

export function createMockDataSource(): MockDataSource {
  return new MockStore();
}
```

- [ ] **Step 5: Run the new test AND the full suite**

Run: `pnpm --filter @cl/web exec vitest run src/mock/MockStore.test.ts && pnpm --filter @cl/web test`
Expected: new file PASS; full suite `Tests 30 passed` (28 existing + 2 new). The old
`MockDataSource.test.ts` must pass unchanged — if it fails, the reads regressed; fix the store,
not the test.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/mock/MockStore.ts apps/web/src/mock/MockStore.test.ts apps/web/src/mock/MockDataSource.ts
git commit -m "refactor(web): MockDataSource → stateful MockStore (reads via BehaviorSubjects)"
```

---

### Task 7: Command port types + inline-edit commands

Adds the command vocabulary to `@cl/application` and implements the three inline-edit commands.
Also adds `unitId` to `DistributionRow` so coefficient edits can re-split the riparto.

**Files:**
- Modify: `packages/application/src/types.ts`
- Modify: `packages/application/src/ports.ts`
- Modify: `apps/web/src/mock/fixtures.ts` (add `unitId` to the 6 riparto unit rows)
- Create: `apps/web/src/recompute/distribution.ts`
- Modify: `apps/web/src/mock/MockStore.ts`
- Test: `apps/web/src/recompute/distribution.test.ts`, extend `apps/web/src/mock/MockStore.test.ts`

- [ ] **Step 1: Add types to `packages/application/src/types.ts`** (append at end; also add `unitId` to `DistributionRow`)

Change `DistributionRow` to:

```ts
export interface DistributionRow {
  id: Id; kind: "group" | "unit"; label: string;
  unitId?: Id;             // set on kind === "unit"; links riparto rows to coefficient items
  amounts: Record<Id /*expenseAccountId*/, Money>;
  total: Money; children?: DistributionRow[];
}
```

Append:

```ts
/** ---- Command inputs (Plan 1 foundations) ---- */
export interface LedgerEntryInput { accountId: Id; label: string; dareCents: number; avereCents: number; }
export interface TransactionInput { date: string; description: string; entries: LedgerEntryInput[]; }
export interface InvoiceInput {
  date: string; supplierName: string; invoiceNumber: string;
  grossCents: number; withholdingCents: number;
  expenseAccountId: Id; expenseAccountLabel: string;
  payableAccountId: Id; payableAccountLabel: string;
  withholdingAccountId: Id; withholdingAccountLabel: string;
}
export interface TakingInput {
  date: string; residentId: Id; residentLabel: string;
  liquidAccountId: Id; liquidAccountLabel: string;
  creditAccountId: Id; creditAccountLabel: string;
  settlements: { installmentId: Id; amountCents: number }[];
}
export interface CreateInstallmentsInput {
  count: number; firstExpiry: string /* ISO date */; cadenceMonths: number;
  totalCents: number; tableId: Id;
}
```

- [ ] **Step 2: Add command interfaces to `packages/application/src/ports.ts`** (append; do NOT extend `MockDataSource` yet — that happens in Task 11 when all methods exist)

```ts
// Extend the existing `import type { ... } from "./types"` at the top of ports.ts with:
//   TransactionInput, InvoiceInput, TakingInput, CreateInstallmentsInput,
//   AccountingPeriodNode, SupplierRow, DistributionTableItem
// (CondominiumNode, UnitRow, DistributionTable, LedgerAccountRow are already imported.)

/** Accounting + inline-edit commands. Synchronous: mock store mutates in memory. */
export interface DataCommands {
  setCoefficient(periodId: Id, tableId: Id, unitId: Id, coefficient: number): void;
  setPreventivo(periodId: Id, accountId: Id, cents: number): void;
  setInstallmentAmount(periodId: Id, rowId: Id, installmentId: Id, cents: number): void;
  addTransaction(periodId: Id, input: TransactionInput): void;
  openBalances(periodId: Id, input: TransactionInput): void;
  registerInvoice(periodId: Id, input: InvoiceInput): void;
  recordTaking(periodId: Id, input: TakingInput): void;
  createInstallments(periodId: Id, input: CreateInstallmentsInput): void;
}

/** Registry CRUD commands (dialogs call these). */
export interface CrudCommands {
  addCondominium(node: CondominiumNode): void;
  editCondominium(id: Id, patch: Partial<CondominiumNode>): void;
  removeCondominium(id: Id): void;
  addPeriod(condominiumId: Id, period: AccountingPeriodNode): void;
  addSupplier(periodId: Id, supplier: SupplierRow): void;
  removeSupplier(periodId: Id, supplierId: Id): void;
  addUnitRow(periodId: Id, parentId: Id | null, row: UnitRow): void;
  editUnitRow(periodId: Id, id: Id, patch: Partial<UnitRow>): void;
  removeUnitRow(periodId: Id, id: Id): void;
  addTable(periodId: Id, table: DistributionTable): void;
  editTable(periodId: Id, id: Id, patch: Partial<DistributionTable>): void;
  removeTable(periodId: Id, id: Id): void;
  addTableItem(periodId: Id, tableId: Id, item: DistributionTableItem): void;
  removeTableItem(periodId: Id, tableId: Id, unitId: Id): void;
  addAccountRow(periodId: Id, parentId: Id | null, row: LedgerAccountRow): void;
  editAccountRow(periodId: Id, id: Id, patch: Partial<LedgerAccountRow>): void;
  removeAccountRow(periodId: Id, id: Id): void;
}
```

(Use the names already imported at the top of `ports.ts` — `CondominiumNode`, `UnitRow`,
`DistributionTable`, `DistributionTableItem`, `AccountingPeriodNode`, `SupplierRow`,
`LedgerAccountRow` — extending the existing import statement instead of duplicating it.)

- [ ] **Step 3: Add `unitId` to the riparto unit rows in `apps/web/src/mock/fixtures.ts`**

In `distributionByPeriod`, every `kind: "unit"` row gains its unit id (6 places):

```ts
// sat-2011 estimate AND current:
{ id: "d-a01", kind: "unit", unitId: "u-a01", label: "A01 - Alberi Dina", /* amounts/total unchanged */ }
{ id: "d-a02", kind: "unit", unitId: "u-a02", label: "A02 - Mauri/Picech", /* unchanged */ }
// poz-2010 estimate AND current:
{ id: "d-p01", kind: "unit", unitId: "u-p01", label: "P01 - Floreani Tiziano", /* unchanged */ }
```

- [ ] **Step 4: Write the failing recompute test**

```ts
// apps/web/src/recompute/distribution.test.ts
import { describe, it, expect } from "vitest";
import { fromCents } from "@cl/domain";
import type { DistributionColumn, DistributionRow } from "@cl/application";
import { recomputeDistribution } from "./distribution";

const c = fromCents;
const columns: DistributionColumn[] = [{ accountId: "e-pul", header: "Pulizie" }];
const rows: DistributionRow[] = [
  { id: "d-g", kind: "group", label: "Totale", amounts: { "e-pul": c(120000) }, total: c(120000),
    children: [
      { id: "d-a01", kind: "unit", unitId: "u-a01", label: "A01", amounts: { "e-pul": c(37500) }, total: c(37500) },
      { id: "d-a02", kind: "unit", unitId: "u-a02", label: "A02", amounts: { "e-pul": c(82500) }, total: c(82500) },
    ] },
];

describe("recomputeDistribution", () => {
  it("re-splits each column total by the new coefficients and re-derives row totals", () => {
    const out = recomputeDistribution({ columns, rows }, new Map([["u-a01", 500], ["u-a02", 500]]));
    const [a01, a02] = out.rows[0].children!;
    expect(a01.amounts["e-pul"].cents).toBe(60000);
    expect(a02.amounts["e-pul"].cents).toBe(60000);
    expect(a01.total.cents).toBe(60000);
    expect(out.rows[0].amounts["e-pul"].cents).toBe(120000); // group total unchanged
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `pnpm --filter @cl/web exec vitest run src/recompute/distribution.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 6: Implement `recomputeDistribution`**

```ts
// apps/web/src/recompute/distribution.ts
import { fromCents } from "@cl/domain";
import type { DistributionColumn, DistributionRow, Id } from "@cl/application";
import { allocate } from "./allocate";

type Dist = { columns: DistributionColumn[]; rows: DistributionRow[] };

/** Re-split every expense column's group total across units by new coefficients.
 * Group rows keep their totals (the expense amounts don't change — their split does). */
export function recomputeDistribution(dist: Dist, coefficientByUnit: Map<Id, number>): Dist {
  const rows = dist.rows.map((group) => {
    if (!group.children?.length) return group;
    const units = group.children;
    const weights = units.map((u) => coefficientByUnit.get(u.unitId ?? "") ?? 0);
    const amounts = units.map((u) => ({ ...u.amounts }));
    for (const col of dist.columns) {
      const total = group.amounts[col.accountId]?.cents ?? 0;
      const split = allocate(total, weights);
      split.forEach((cents, i) => { amounts[i][col.accountId] = fromCents(cents); });
    }
    const children = units.map((u, i) => ({
      ...u,
      amounts: amounts[i],
      total: fromCents(dist.columns.reduce((a, col) => a + (amounts[i][col.accountId]?.cents ?? 0), 0)),
    }));
    return { ...group, children };
  });
  return { columns: dist.columns, rows };
}
```

- [ ] **Step 7: Add the three inline-edit commands to `MockStore`**

Add these imports to `MockStore.ts`:

```ts
import { fromCents } from "@cl/domain";
import { mapRow } from "./treeRows";
import { recomputeDistribution } from "../recompute/distribution";
import { redistributeOverride } from "../recompute/installments";
```

Add these methods to the class:

```ts
setCoefficient(periodId: Id, tableId: Id, unitId: Id, coefficient: number): void {
  this.patch(this.tables$, periodId, [], (tables) =>
    tables.map((t) => t.id !== tableId ? t : ({
      ...t,
      items: t.items.map((it) => (it.unitId === unitId ? { ...it, coefficient } : it)),
    })));
  const table = (this.tables$.getValue()[periodId] ?? []).find((t) => t.id === tableId);
  if (!table) return;
  const coeffByUnit = new Map(table.items.map((i) => [i.unitId, i.coefficient]));
  const cur = this.distributions$.getValue();
  const dist = cur[periodId];
  if (!dist) return;
  this.distributions$.next({
    ...cur,
    [periodId]: {
      estimate: recomputeDistribution(dist.estimate, coeffByUnit),
      current: recomputeDistribution(dist.current, coeffByUnit),
    },
  });
}

setPreventivo(periodId: Id, accountId: Id, cents: number): void {
  this.patch(this.accounts$, periodId, [], (rows) =>
    mapRow(rows, accountId, (r) => ({ ...r, preventivo: fromCents(cents) })));
}

setInstallmentAmount(periodId: Id, rowId: Id, installmentId: Id, cents: number): void {
  this.patch(this.installments$, periodId, { columns: [], rows: [] }, (data) => {
    const order = data.columns.map((c) => c.id);
    const edited = mapRow(data.rows, rowId, (r) => {
      const cells = order.map((id) => r.byInstallment[id]?.cents ?? 0);
      const next = redistributeOverride(cells, order.indexOf(installmentId), cents);
      return { ...r, byInstallment: Object.fromEntries(order.map((id, i) => [id, fromCents(next[i])])) };
    });
    const rows = edited.map((g) => !g.children?.length ? g : ({
      ...g,
      byInstallment: Object.fromEntries(order.map((id) => [
        id,
        fromCents(g.children!.reduce((a, ch) => a + (ch.byInstallment[id]?.cents ?? 0), 0)),
      ])),
    }));
    return { ...data, rows };
  });
}
```

- [ ] **Step 8: Extend `MockStore.test.ts` with command tests**

Append to the existing describe blocks:

```ts
describe("MockStore inline-edit commands", () => {
  it("setCoefficient re-emits tables AND re-splits the riparto", () => {
    const s = new MockStore();
    s.setCoefficient("sat-2011", "t-prop", "u-a01", 500);
    const table = latest(s.distributionTables("sat-2011")).find((t) => t.id === "t-prop")!;
    expect(table.items.find((i) => i.unitId === "u-a01")!.coefficient).toBe(500);
    const dist = latest(s.distribution("sat-2011", "estimate"));
    const a01 = dist.rows[0].children!.find((r) => r.unitId === "u-a01")!;
    expect(a01.amounts["e-pul"].cents).toBe(60000); // 120000 split 500/500
  });
  it("setPreventivo updates the account row", () => {
    const s = new MockStore();
    s.setPreventivo("sat-2011", "cassa", 99900);
    const rows = latest(s.ledgerAccountsTree("sat-2011"));
    const find = (rs: typeof rows, id: string): (typeof rows)[number] | null => {
      for (const r of rs) { if (r.id === id) return r; const hit = r.children ? find(r.children, id) : null; if (hit) return hit; }
      return null;
    };
    expect(find(rows, "cassa")!.preventivo!.cents).toBe(99900);
  });
  it("setInstallmentAmount redistributes later rate and re-derives the group row", () => {
    const s = new MockStore();
    s.setInstallmentAmount("sat-2011", "i-a01", "r1", 40000); // was 49576
    const data = latest(s.installments("sat-2011"));
    const a01 = data.rows[0].children!.find((r) => r.id === "i-a01")!;
    expect(a01.byInstallment.r1.cents).toBe(40000);
    // delta 9576 spread over r2/r3: 4788 each
    expect(a01.byInstallment.r2.cents).toBe(49576 + 4788);
    expect(a01.byInstallment.r3.cents).toBe(49575 + 4788);
    expect(data.rows[0].byInstallment.r1.cents).toBe(40000 + 71608); // group re-derived
  });
  it("two stores do not share state", () => {
    const a = new MockStore();
    const b = new MockStore();
    a.setPreventivo("sat-2011", "cassa", 11111);
    const rows = latest(b.ledgerAccountsTree("sat-2011"));
    expect(JSON.stringify(rows)).not.toContain("11111");
  });
});
```

- [ ] **Step 9: Run tests + full suite + typecheck**

Run: `pnpm --filter @cl/web exec vitest run src/recompute/distribution.test.ts src/mock/MockStore.test.ts && pnpm --filter @cl/web test && pnpm --filter @cl/web typecheck`
Expected: all PASS (suite now 35), typecheck clean.

- [ ] **Step 10: Commit**

```bash
git add packages/application/src apps/web/src/mock apps/web/src/recompute
git commit -m "feat(web): command port types + inline-edit commands (coefficient/preventivo/rata)"
```

---

### Task 8: Transaction commands (scrittura, saldi iniziali, fattura, incasso)

**Files:**
- Modify: `apps/web/src/mock/MockStore.ts`
- Test: extend `apps/web/src/mock/MockStore.test.ts`

- [ ] **Step 1: Write the failing tests** (append to `MockStore.test.ts`)

```ts
describe("MockStore transaction commands", () => {
  it("addTransaction appends a balanced txn and applies balance deltas", () => {
    const s = new MockStore();
    s.addTransaction("sat-2011", {
      date: "2011-05-01", description: "Prova scrittura",
      entries: [
        { accountId: "cassa", label: "Cassa Contanti", dareCents: 1000, avereCents: 0 },
        { accountId: "banca", label: "Banca", dareCents: 0, avereCents: 1000 },
      ],
    });
    const txns = latest(s.ledgerTransactions("sat-2011"));
    expect(txns).toHaveLength(4);
    expect(txns[3].code).toBe(4);
    expect(txns[3].dare.cents).toBe(1000);
    const cassa = JSON.stringify(latest(s.ledgerAccountsTree("sat-2011")));
    expect(cassa).toContain('"cents":' + (13552 + 1000)); // cassa dare bumped
  });
  it("addTransaction rejects unbalanced entries", () => {
    const s = new MockStore();
    expect(() => s.addTransaction("sat-2011", {
      date: "2011-05-01", description: "Sbilanciata",
      entries: [{ accountId: "cassa", label: "Cassa", dareCents: 10, avereCents: 0 }],
    })).toThrow(/bilanciata/);
  });
  it("registerInvoice posts gross to expense, net to payable, ritenuta to its account", () => {
    const s = new MockStore();
    s.registerInvoice("sat-2011", {
      date: "2011-06-01", supplierName: "Acme", invoiceNumber: "F-77",
      grossCents: 50000, withholdingCents: 10000,
      expenseAccountId: "cassa", expenseAccountLabel: "Pulizie",        // fixture leaf ids suffice
      payableAccountId: "banca", payableAccountLabel: "Fornitori",
      withholdingAccountId: "banca", withholdingAccountLabel: "Erario c/ritenute",
    });
    const txns = latest(s.ledgerTransactions("sat-2011"));
    const inv = txns[txns.length - 1];
    expect(inv.description).toContain("F-77");
    expect(inv.entries.map((e) => [e.dare.cents, e.avere.cents])).toEqual([
      [50000, 0], [0, 40000], [0, 10000],
    ]);
  });
  it("recordTaking posts the incasso and bumps versato on resident + ancestors", () => {
    const s = new MockStore();
    s.recordTaking("sat-2011", {
      date: "2011-07-01", residentId: "r-a01-1", residentLabel: "Alberi Dina",
      liquidAccountId: "banca", liquidAccountLabel: "Banca",
      creditAccountId: "cassa", creditAccountLabel: "Condòmini c/rate",
      settlements: [{ installmentId: "r1", amountCents: 49576 }],
    });
    const units = latest(s.unitsTree("sat-2011"));
    expect(units[0].versato.cents).toBe(49576);                       // group rollup
    expect(units[0].children![0].versato.cents).toBe(49576);          // unit u-a01
    expect(units[0].children![0].children![0].versato.cents).toBe(49576); // resident
    expect(units[0].children![1].versato.cents).toBe(0);              // untouched sibling
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/mock/MockStore.test.ts`
Expected: FAIL — `addTransaction is not a function` (and the rest).

- [ ] **Step 3: Implement on `MockStore`**

Add import:

```ts
import { applyEntryDeltas } from "../recompute/balances";
import type { TransactionInput, InvoiceInput, TakingInput, UnitRow } from "@cl/application";
```

Add methods:

```ts
addTransaction(periodId: Id, input: TransactionInput): void {
  const totDare = input.entries.reduce((a, e) => a + e.dareCents, 0);
  const totAvere = input.entries.reduce((a, e) => a + e.avereCents, 0);
  if (totDare !== totAvere) throw new Error("Scrittura non bilanciata: dare ≠ avere");
  const existing = this.txns$.getValue()[periodId] ?? [];
  const code = existing.reduce((m, t) => Math.max(m, t.code), 0) + 1;
  this.patch(this.txns$, periodId, [], (txns) => [...txns, {
    id: `tx-${periodId}-${code}`,
    date: input.date, code, description: input.description,
    dare: fromCents(totDare), avere: fromCents(totAvere),
    entries: input.entries.map((e) => ({ account: e.label, dare: fromCents(e.dareCents), avere: fromCents(e.avereCents) })),
  }]);
  this.patch(this.accounts$, periodId, [], (rows) =>
    applyEntryDeltas(rows, input.entries.map((e) => ({
      accountId: e.accountId, dareCents: e.dareCents, avereCents: e.avereCents,
    }))));
}

openBalances(periodId: Id, input: TransactionInput): void {
  this.addTransaction(periodId, input); // same balanced-posting rule; wizard differs, command doesn't
}

registerInvoice(periodId: Id, inv: InvoiceInput): void {
  const net = inv.grossCents - inv.withholdingCents;
  this.addTransaction(periodId, {
    date: inv.date,
    description: `Registrazione fattura ${inv.invoiceNumber} ${inv.supplierName}`,
    entries: [
      { accountId: inv.expenseAccountId, label: inv.expenseAccountLabel, dareCents: inv.grossCents, avereCents: 0 },
      { accountId: inv.payableAccountId, label: inv.payableAccountLabel, dareCents: 0, avereCents: net },
      ...(inv.withholdingCents > 0
        ? [{ accountId: inv.withholdingAccountId, label: inv.withholdingAccountLabel, dareCents: 0, avereCents: inv.withholdingCents }]
        : []),
    ],
  });
}

recordTaking(periodId: Id, t: TakingInput): void {
  const total = t.settlements.reduce((a, s) => a + s.amountCents, 0);
  this.addTransaction(periodId, {
    date: t.date,
    description: `Incasso ${t.residentLabel}`,
    entries: [
      { accountId: t.liquidAccountId, label: t.liquidAccountLabel, dareCents: total, avereCents: 0 },
      { accountId: t.creditAccountId, label: t.creditAccountLabel, dareCents: 0, avereCents: total },
    ],
  });
  const addVersato = (rows: UnitRow[]): UnitRow[] => {
    const contains = (r: UnitRow): boolean =>
      r.id === t.residentId || (r.children ?? []).some(contains);
    const walk = (r: UnitRow): UnitRow => contains(r)
      ? { ...r, versato: fromCents(r.versato.cents + total), children: r.children?.map(walk) }
      : r;
    return rows.map(walk);
  };
  this.patch(this.units$, periodId, [], addVersato);
}
```

- [ ] **Step 4: Run tests + suite**

Run: `pnpm --filter @cl/web exec vitest run src/mock/MockStore.test.ts && pnpm --filter @cl/web test`
Expected: PASS (suite now 39).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/mock/MockStore.ts apps/web/src/mock/MockStore.test.ts
git commit -m "feat(web): transaction commands — scrittura, saldi iniziali, fattura, incasso"
```

---

### Task 9: `createInstallments` command

**Files:**
- Create: `apps/web/src/recompute/dates.ts`
- Modify: `apps/web/src/mock/MockStore.ts`
- Test: `apps/web/src/recompute/dates.test.ts`, extend `apps/web/src/mock/MockStore.test.ts`

- [ ] **Step 1: Write the failing date-helper test**

```ts
// apps/web/src/recompute/dates.test.ts
import { describe, it, expect } from "vitest";
import { addMonths, formatItDate } from "./dates";

describe("dates", () => {
  it("addMonths advances ISO dates, clamping the day", () => {
    expect(addMonths("2011-01-31", 1)).toBe("2011-02-28");
    expect(addMonths("2011-03-15", 4)).toBe("2011-07-15");
  });
  it("formatItDate renders dd/mm/yyyy", () => {
    expect(formatItDate("2011-07-15")).toBe("15/07/2011");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/recompute/dates.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the date helpers**

```ts
// apps/web/src/recompute/dates.ts

/** Add months to an ISO date (yyyy-mm-dd), clamping the day to the target month's length. */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = (y * 12 + (m - 1)) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  return `${ny}-${String(nm).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

export function formatItDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
```

- [ ] **Step 4: Write the failing store test** (append to `MockStore.test.ts`)

```ts
describe("createInstallments", () => {
  it("builds N rate columns from the coefficient table, totals preserved", () => {
    const s = new MockStore();
    s.createInstallments("sat-2011", {
      count: 4, firstExpiry: "2011-02-01", cadenceMonths: 3, totalCents: 380000, tableId: "t-prop",
    });
    const data = latest(s.installments("sat-2011"));
    expect(data.columns.map((c) => c.header)).toEqual([
      "Rata 1 (01/02/2011)", "Rata 2 (01/05/2011)", "Rata 3 (01/08/2011)", "Rata 4 (01/11/2011)",
    ]);
    const group = data.rows[0];
    const grand = data.columns.reduce((a, c) => a + group.byInstallment[c.id].cents, 0);
    expect(grand).toBe(380000);
    expect(group.children).toHaveLength(2); // one row per coefficient item
  });
  it("throws for an unknown table", () => {
    const s = new MockStore();
    expect(() => s.createInstallments("sat-2011", {
      count: 2, firstExpiry: "2011-01-01", cadenceMonths: 1, totalCents: 100, tableId: "nope",
    })).toThrow(/[Tt]abella/);
  });
});
```

- [ ] **Step 5: Run to verify failure, then implement**

Run: `pnpm --filter @cl/web exec vitest run src/mock/MockStore.test.ts` → FAIL (`createInstallments is not a function`).

Add imports to `MockStore.ts`:

```ts
import { distributeInstallments } from "../recompute/installments";
import { addMonths, formatItDate } from "../recompute/dates";
import type { CreateInstallmentsInput } from "@cl/application";
```

Add method:

```ts
createInstallments(periodId: Id, input: CreateInstallmentsInput): void {
  const table = (this.tables$.getValue()[periodId] ?? []).find((t) => t.id === input.tableId);
  if (!table) throw new Error("Tabella di riparto inesistente");
  const columns: InstallmentColumn[] = Array.from({ length: input.count }, (_, i) => ({
    id: `r${i + 1}`,
    header: `Rata ${i + 1} (${formatItDate(addMonths(input.firstExpiry, i * input.cadenceMonths))})`,
  }));
  const split = distributeInstallments(input.totalCents, table.items.map((it) => it.coefficient), input.count);
  const children: InstallmentRow[] = table.items.map((item, idx) => {
    const totale = split[idx].reduce((a, b) => a + b, 0);
    return {
      id: `i-${item.unitId}`, kind: "unit", label: item.unitLabel, role: "Proprietario",
      saldoPrec: fromCents(0), totPreventivo: fromCents(totale), totDovuto: fromCents(totale),
      byInstallment: Object.fromEntries(columns.map((c, k) => [c.id, fromCents(split[idx][k])])),
    };
  });
  const group: InstallmentRow = {
    id: "i-group", kind: "group", label: "Rate da preventivo",
    saldoPrec: fromCents(0), totPreventivo: fromCents(input.totalCents), totDovuto: fromCents(input.totalCents),
    byInstallment: Object.fromEntries(columns.map((c) => [
      c.id, fromCents(children.reduce((a, ch) => a + ch.byInstallment[c.id].cents, 0)),
    ])),
    children,
  };
  this.patch(this.installments$, periodId, { columns: [], rows: [] }, () => ({ columns, rows: [group] }));
}
```

- [ ] **Step 6: Run tests + suite**

Run: `pnpm --filter @cl/web exec vitest run src/recompute/dates.test.ts src/mock/MockStore.test.ts && pnpm --filter @cl/web test`
Expected: PASS (suite now 43).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/recompute/dates.ts apps/web/src/recompute/dates.test.ts apps/web/src/mock/MockStore.ts apps/web/src/mock/MockStore.test.ts
git commit -m "feat(web): createInstallments command (rate from preventivo via coefficients)"
```

---

### Task 10: Registry CRUD commands

Mechanical immutable updates via the Task 5 helpers. One representative test per collection
family (tree CRUD is identical machinery).

**Files:**
- Modify: `apps/web/src/mock/MockStore.ts`
- Test: extend `apps/web/src/mock/MockStore.test.ts`

- [ ] **Step 1: Write the failing tests** (append)

```ts
describe("MockStore CRUD commands", () => {
  it("condominium add/edit/remove and addPeriod", () => {
    const s = new MockStore();
    s.addCondominium({ id: "new", code: "NEW", name: "Nuovo", type: "regular", periods: [] });
    s.addPeriod("new", { id: "new-2012", name: "2012 (Ordinario)", type: "ordinary", closed: false, start: "2012-01-01", end: "2012-12-31" });
    s.editCondominium("new", { name: "Nuovo Rinominato" });
    let tree = latest(s.condominiumTree());
    const node = tree.find((n) => n.id === "new")!;
    expect(node.name).toBe("Nuovo Rinominato");
    expect(node.periods).toHaveLength(1);
    s.removeCondominium("new");
    tree = latest(s.condominiumTree());
    expect(tree.find((n) => n.id === "new")).toBeUndefined();
  });
  it("supplier add/remove on the period detail", () => {
    const s = new MockStore();
    s.addSupplier("sat-2011", { id: "s9", nominativo: "Idraulica Blu", categoria: "Idraulico" });
    expect(latest(s.condominiumDetail("sat-2011"))!.suppliers.map((x) => x.id)).toContain("s9");
    s.removeSupplier("sat-2011", "s9");
    expect(latest(s.condominiumDetail("sat-2011"))!.suppliers.map((x) => x.id)).not.toContain("s9");
  });
  it("unit-tree add/edit/remove", () => {
    const s = new MockStore();
    const zero = { cents: 0 };
    s.addUnitRow("sat-2011", "u-a01", {
      id: "r-new", kind: "resident", label: "Nuovo Residente (PR 100%)",
      saldoPrec: zero, preventivo: zero, consuntivo: zero, totDovuto: zero, versato: zero,
    });
    expect(JSON.stringify(latest(s.unitsTree("sat-2011")))).toContain("r-new");
    s.editUnitRow("sat-2011", "r-new", { label: "Residente Rinominato" });
    expect(JSON.stringify(latest(s.unitsTree("sat-2011")))).toContain("Residente Rinominato");
    s.removeUnitRow("sat-2011", "r-new");
    expect(JSON.stringify(latest(s.unitsTree("sat-2011")))).not.toContain("r-new");
  });
  it("table + item CRUD and account-tree CRUD", () => {
    const s = new MockStore();
    s.addTable("sat-2011", { id: "t-new", name: "Acqua", restriction: null, total: 1000, items: [] });
    s.addTableItem("sat-2011", "t-new", { unitId: "u-a01", unitLabel: "A01", coefficient: 1000, competenza: "intero" });
    expect(latest(s.distributionTables("sat-2011")).find((t) => t.id === "t-new")!.items).toHaveLength(1);
    s.removeTableItem("sat-2011", "t-new", "u-a01");
    s.editTable("sat-2011", "t-new", { name: "Acqua Fredda" });
    expect(latest(s.distributionTables("sat-2011")).find((t) => t.id === "t-new")!.name).toBe("Acqua Fredda");
    s.removeTable("sat-2011", "t-new");
    expect(latest(s.distributionTables("sat-2011")).find((t) => t.id === "t-new")).toBeUndefined();

    const zero = { cents: 0 };
    s.addAccountRow("sat-2011", "liq", { id: "posta", kind: "regular", label: "C/C Postale", dare: zero, avere: zero, saldo: zero, preventivo: null });
    expect(JSON.stringify(latest(s.ledgerAccountsTree("sat-2011")))).toContain("C/C Postale");
    s.editAccountRow("sat-2011", "posta", { label: "Conto BancoPosta" });
    s.removeAccountRow("sat-2011", "posta");
    expect(JSON.stringify(latest(s.ledgerAccountsTree("sat-2011")))).not.toContain("posta");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/mock/MockStore.test.ts`
Expected: FAIL — `addCondominium is not a function`.

- [ ] **Step 3: Implement** (add imports `removeRow, insertChild` from `./treeRows`; types as needed)

```ts
// --- registry CRUD ---
addCondominium(node: CondominiumNode): void { this.tree$.next([...this.tree$.getValue(), node]); }
editCondominium(id: Id, patchNode: Partial<CondominiumNode>): void {
  this.tree$.next(this.tree$.getValue().map((n) => (n.id === id ? { ...n, ...patchNode } : n)));
}
removeCondominium(id: Id): void { this.tree$.next(this.tree$.getValue().filter((n) => n.id !== id)); }
addPeriod(condominiumId: Id, period: AccountingPeriodNode): void {
  this.tree$.next(this.tree$.getValue().map((n) =>
    n.id === condominiumId ? { ...n, periods: [...n.periods, period] } : n));
}

addSupplier(periodId: Id, supplier: SupplierRow): void {
  const cur = this.details$.getValue();
  const d = cur[periodId];
  if (!d) return;
  this.details$.next({ ...cur, [periodId]: { ...d, suppliers: [...d.suppliers, supplier] } });
}
removeSupplier(periodId: Id, supplierId: Id): void {
  const cur = this.details$.getValue();
  const d = cur[periodId];
  if (!d) return;
  this.details$.next({ ...cur, [periodId]: { ...d, suppliers: d.suppliers.filter((s) => s.id !== supplierId) } });
}

addUnitRow(periodId: Id, parentId: Id | null, row: UnitRow): void {
  this.patch(this.units$, periodId, [], (rows) => insertChild(rows, parentId, row));
}
editUnitRow(periodId: Id, id: Id, patchRow: Partial<UnitRow>): void {
  this.patch(this.units$, periodId, [], (rows) => mapRow(rows, id, (r) => ({ ...r, ...patchRow })));
}
removeUnitRow(periodId: Id, id: Id): void {
  this.patch(this.units$, periodId, [], (rows) => removeRow(rows, id));
}

addTable(periodId: Id, table: DistributionTable): void {
  this.patch(this.tables$, periodId, [], (ts) => [...ts, table]);
}
editTable(periodId: Id, id: Id, patchTable: Partial<DistributionTable>): void {
  this.patch(this.tables$, periodId, [], (ts) => ts.map((t) => (t.id === id ? { ...t, ...patchTable } : t)));
}
removeTable(periodId: Id, id: Id): void {
  this.patch(this.tables$, periodId, [], (ts) => ts.filter((t) => t.id !== id));
}
addTableItem(periodId: Id, tableId: Id, item: DistributionTableItem): void {
  this.patch(this.tables$, periodId, [], (ts) => ts.map((t) =>
    t.id === tableId ? { ...t, items: [...t.items, item] } : t));
}
removeTableItem(periodId: Id, tableId: Id, unitId: Id): void {
  this.patch(this.tables$, periodId, [], (ts) => ts.map((t) =>
    t.id === tableId ? { ...t, items: t.items.filter((i) => i.unitId !== unitId) } : t));
}

addAccountRow(periodId: Id, parentId: Id | null, row: LedgerAccountRow): void {
  this.patch(this.accounts$, periodId, [], (rows) => insertChild(rows, parentId, row));
}
editAccountRow(periodId: Id, id: Id, patchRow: Partial<LedgerAccountRow>): void {
  this.patch(this.accounts$, periodId, [], (rows) => mapRow(rows, id, (r) => ({ ...r, ...patchRow })));
}
removeAccountRow(periodId: Id, id: Id): void {
  this.patch(this.accounts$, periodId, [], (rows) => removeRow(rows, id));
}
```

- [ ] **Step 4: Run tests + suite**

Run: `pnpm --filter @cl/web exec vitest run src/mock/MockStore.test.ts && pnpm --filter @cl/web test`
Expected: PASS (suite now 47).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/mock/MockStore.ts apps/web/src/mock/MockStore.test.ts
git commit -m "feat(web): registry CRUD commands on MockStore"
```

---

### Task 11: Wire commands + per-section row selection into the runtime port

All command methods now exist, so the port can demand them: `MockDataSource` extends the command
interfaces, `AppRuntime` exposes `commands` and the per-section row-selection slice the original
spec (§4) called for.

**Files:**
- Modify: `packages/application/src/ports.ts`
- Modify: `apps/web/src/runtime/createAppRuntime.ts`
- Test: extend `apps/web/src/runtime/runtime.test.tsx`

- [ ] **Step 1: Extend the port interfaces in `ports.ts`**

Change the `MockDataSource` declaration line to:

```ts
export interface MockDataSource extends DataCommands, CrudCommands {
```

(keep the read-method body unchanged; move the `DataCommands`/`CrudCommands` declarations ABOVE
`MockDataSource` in the file so they're declared before use).

Add to `AppRuntime`:

```ts
  /** Store commands, surfaced through the runtime so components never import the store. */
  commands: DataCommands & CrudCommands;
  /** Per-section selected row (grid row id), promoted from section-local state. */
  useSelectedRow(section: CondominiSection): string | null;
  selectRow(section: CondominiSection, id: string | null): void;
```

- [ ] **Step 2: Implement in `createAppRuntime.ts`**

Add after the `selectedTable$` subject:

```ts
const emptyRows: Record<CondominiSection, string | null> =
  { dati: null, unita: null, tabelle: null, conti: null, giornale: null, rate: null };
const selectedRows$ = new BehaviorSubject<Record<CondominiSection, string | null>>(emptyRows);
const [useSelectedRows] = bind(selectedRows$, emptyRows);
```

Add to the returned object:

```ts
commands: data,
useSelectedRow: (section) => useSelectedRows()[section],
selectRow: (section, id) =>
  selectedRows$.next({ ...selectedRows$.getValue(), [section]: id }),
```

- [ ] **Step 3: Write the failing runtime test** (append to `runtime.test.tsx`; follow that file's existing render/harness pattern)

```tsx
it("exposes store commands and per-section row selection", () => {
  const data = createMockDataSource();
  const rt = createAppRuntime({ data });
  expect(typeof rt.commands.addTransaction).toBe("function");

  function Probe() {
    const sel = rt.useSelectedRow("conti");
    return <span data-testid="sel">{sel ?? "none"}</span>;
  }
  render(<Probe />);
  expect(screen.getByTestId("sel").textContent).toBe("none");
  act(() => rt.selectRow("conti", "cassa"));
  expect(screen.getByTestId("sel").textContent).toBe("cassa");
});
```

(import `act` from `@testing-library/react`; `createMockDataSource` from `../mock/MockDataSource`
and `createAppRuntime` from `./createAppRuntime` are already imported in this file.)

- [ ] **Step 4: Run tests + suite + typecheck**

Run: `pnpm --filter @cl/web exec vitest run src/runtime/runtime.test.tsx && pnpm --filter @cl/web test && pnpm --filter @cl/web typecheck`
Expected: PASS (suite now 48); typecheck clean — this is the step that proves `MockStore`
satisfies the full extended port.

- [ ] **Step 5: Commit**

```bash
git add packages/application/src/ports.ts apps/web/src/runtime
git commit -m "feat(web): runtime exposes store commands + per-section row selection"
```

---

### Task 12: it-IT money parsing + form field components

**Files:**
- Create: `apps/web/src/components/forms/parse.ts`
- Create: `apps/web/src/components/forms/fields.tsx`
- Create: `apps/web/src/components/forms/fields.module.css`
- Test: `apps/web/src/components/forms/forms.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// apps/web/src/components/forms/forms.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { parseItMoney } from "./parse";
import { TextField, SelectField, MoneyField, CheckboxField, DateField } from "./fields";

describe("parseItMoney", () => {
  it("parses it-IT formatted strings to cents", () => {
    expect(parseItMoney("1.234,56")).toBe(123456);
    expect(parseItMoney("1234,5")).toBe(123450);
    expect(parseItMoney("-12,00")).toBe(-1200);
    expect(parseItMoney("500")).toBe(50000);
  });
  it("returns null for garbage", () => {
    expect(parseItMoney("abc")).toBeNull();
    expect(parseItMoney("")).toBeNull();
  });
});

describe("fields", () => {
  it("TextField is a labeled controlled input", () => {
    const onChange = vi.fn();
    render(<TextField label="Nome" value="x" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "y" } });
    expect(onChange).toHaveBeenCalledWith("y");
  });
  it("SelectField renders options and emits values", () => {
    const onChange = vi.fn();
    render(<SelectField label="Tipo" value="a" onChange={onChange}
      options={[{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }]} />);
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "b" } });
    expect(onChange).toHaveBeenCalledWith("b");
  });
  it("MoneyField shows formatted cents and commits parsed cents on blur", () => {
    const onChange = vi.fn();
    render(<MoneyField label="Importo" cents={123456} onChange={onChange} />);
    const input = screen.getByLabelText("Importo") as HTMLInputElement;
    expect(input.value).toBe("1.234,56");
    fireEvent.change(input, { target: { value: "2.000,00" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(200000);
  });
  it("MoneyField keeps the previous value on unparseable input", () => {
    const onChange = vi.fn();
    render(<MoneyField label="Importo" cents={100} onChange={onChange} />);
    const input = screen.getByLabelText("Importo");
    fireEvent.change(input, { target: { value: "boh" } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });
  it("CheckboxField and DateField round-trip", () => {
    const onCheck = vi.fn(); const onDate = vi.fn();
    render(<>
      <CheckboxField label="Bloccata" checked={false} onChange={onCheck} />
      <DateField label="Scadenza" value="2011-02-01" onChange={onDate} />
    </>);
    fireEvent.click(screen.getByLabelText("Bloccata"));
    expect(onCheck).toHaveBeenCalledWith(true);
    fireEvent.change(screen.getByLabelText("Scadenza"), { target: { value: "2011-03-01" } });
    expect(onDate).toHaveBeenCalledWith("2011-03-01");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/components/forms/forms.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement parse + fields + css**

```ts
// apps/web/src/components/forms/parse.ts

/** "1.234,56" → 123456 cents; plain integers are euros. Null when unparseable. */
export function parseItMoney(s: string): number | null {
  const cleaned = s.trim().replace(/\./g, "").replace(",", ".");
  if (cleaned === "" || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  const scaled = n * 100;
  return scaled >= 0 ? Math.round(scaled) : -Math.round(-scaled);
}
```

```tsx
// apps/web/src/components/forms/fields.tsx
import { useId, useState } from "react";
import { fromCents, formatEUR } from "@cl/domain";
import { parseItMoney } from "./parse";
import styles from "./fields.module.css";

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export function TextField({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  const id = useId();
  return (
    <Field label={label} id={id}>
      <input id={id} className={styles.input} type={type} value={value}
        onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function DateField(props: { label: string; value: string; onChange: (v: string) => void }) {
  return <TextField {...props} type="date" />;
}

export function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <Field label={label} id={id}>
      <select id={id} className={styles.input} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

export function MoneyField({ label, cents, onChange }: {
  label: string; cents: number; onChange: (cents: number) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(formatEUR(fromCents(cents)));
  const commit = () => {
    const parsed = parseItMoney(draft);
    if (parsed === null) { setDraft(formatEUR(fromCents(cents))); return; }
    setDraft(formatEUR(fromCents(parsed)));
    onChange(parsed);
  };
  return (
    <Field label={label} id={id}>
      <input id={id} className={`${styles.input} ${styles.money}`} inputMode="decimal"
        value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); }} />
    </Field>
  );
}

export function CheckboxField({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label className={styles.checkboxLabel} htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
    </div>
  );
}
```

```css
/* apps/web/src/components/forms/fields.module.css */
.field { display: flex; flex-direction: column; gap: var(--sp-1); margin-bottom: var(--sp-3); }
.label { font-size: var(--fs-xs); color: var(--text-secondary); }
.input {
  font: inherit; font-size: var(--fs-sm); color: var(--text-primary);
  background: var(--surface-panel); border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm); padding: var(--sp-1) var(--sp-2);
}
.input:focus { outline: 1px solid var(--accent); border-color: var(--accent); }
.money { text-align: right; font-variant-numeric: tabular-nums; }
.checkboxLabel { display: inline-flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-sm); }
```

(If a token name above doesn't exist in `src/styles/tokens.css`, use the nearest existing token —
check the file; do NOT hard-code colors.)

- [ ] **Step 4: Run tests + suite**

Run: `pnpm --filter @cl/web exec vitest run src/components/forms/forms.test.tsx && pnpm --filter @cl/web test`
Expected: PASS (suite now 55).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/forms
git commit -m "feat(web): form field primitives + it-IT money parsing"
```

---

### Task 13: `InlineMoney` grid editor

**Files:**
- Modify: `apps/web/src/components/grid/inlineEditors.tsx`
- Test: `apps/web/src/components/grid/inlineEditors.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/grid/inlineEditors.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { fromCents } from "@cl/domain";
import { InlineMoney } from "./inlineEditors";

describe("InlineMoney", () => {
  it("displays formatted money, edits on double-click, commits cents on Enter", () => {
    const onCommit = vi.fn();
    render(<InlineMoney value={fromCents(123456)} onCommit={onCommit} />);
    const display = screen.getByText("1.234,56");
    fireEvent.doubleClick(display);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "2.000,00" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith(200000);
  });
  it("Escape cancels without committing", () => {
    const onCommit = vi.fn();
    render(<InlineMoney value={fromCents(100)} onCommit={onCommit} />);
    fireEvent.doubleClick(screen.getByText("1,00"));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText("1,00")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/components/grid/inlineEditors.test.tsx`
Expected: FAIL — `InlineMoney` not exported.

- [ ] **Step 3: Implement** (append to `inlineEditors.tsx`)

```tsx
import type { Money } from "@cl/domain";
import { formatEUR } from "@cl/domain";
import { parseItMoney } from "../forms/parse";

/** Inline money editor: double-click to edit; Enter/blur commits integer cents; Esc cancels. */
export function InlineMoney({ value, onCommit }: { value: Money; onCommit: (cents: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(formatEUR(value));
  if (!editing) {
    return (
      <span onDoubleClick={() => { setDraft(formatEUR(value)); setEditing(true); }}>
        {formatEUR(value)}
      </span>
    );
  }
  const commit = () => {
    const cents = parseItMoney(draft);
    if (cents !== null) onCommit(cents);
    setEditing(false);
  };
  return (
    <input
      autoFocus className={styles.editInput} value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
    />
  );
}
```

(merge the `Money`/`formatEUR` imports with any existing `@cl/domain` import in the file.)

- [ ] **Step 4: Run tests + suite**

Run: `pnpm --filter @cl/web exec vitest run src/components/grid/inlineEditors.test.tsx && pnpm --filter @cl/web test`
Expected: PASS (suite now 57).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/grid
git commit -m "feat(web): InlineMoney grid editor"
```

---

### Task 14: WizardDialog step machinery

Replaces the static shell with real steps: per-step content + validation, next/back, submit on
the last step. The two existing call sites pass `string[]` today — they're shimmed to the new
`WizardStep[]` shape (real form content arrives in Plan 2).

**Files:**
- Modify: `apps/web/src/components/common/WizardDialog.tsx` (rewrite)
- Modify: `apps/web/src/components/common/WizardDialog.module.css` (add classes)
- Modify: `apps/web/src/sections/giornale/GiornaleSection.tsx` (shim call sites)
- Modify: `apps/web/src/sections/rate/RateSection.tsx` (shim call site)
- Test: `apps/web/src/components/common/WizardDialog.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/common/WizardDialog.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WizardDialog } from "./WizardDialog";

const steps = [
  { title: "Dati", content: <p>passo uno</p>, validate: () => null },
  { title: "Conferma", content: <p>passo due</p> },
];

describe("WizardDialog", () => {
  it("navigates forward/back and submits on the last step", () => {
    const onSubmit = vi.fn(); const onOpenChange = vi.fn();
    render(<WizardDialog open onOpenChange={onOpenChange} title="Procedura" steps={steps} onSubmit={onSubmit} />);
    expect(screen.getByText("passo uno")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Avanti"));
    expect(screen.getByText("passo due")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Indietro"));
    expect(screen.getByText("passo uno")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Avanti"));
    fireEvent.click(screen.getByText("Conferma"));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  it("blocks Avanti when the step's validate returns an error", () => {
    const onSubmit = vi.fn();
    render(<WizardDialog open onOpenChange={() => {}} title="P" onSubmit={onSubmit}
      steps={[{ title: "S1", content: <p>uno</p>, validate: () => "Campo obbligatorio" }, { title: "S2", content: <p>due</p> }]} />);
    fireEvent.click(screen.getByText("Avanti"));
    expect(screen.getByText("Campo obbligatorio")).toBeInTheDocument();
    expect(screen.getByText("uno")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/components/common/WizardDialog.test.tsx`
Expected: FAIL — current component renders only a "Chiudi" button.

- [ ] **Step 3: Rewrite the component**

```tsx
// apps/web/src/components/common/WizardDialog.tsx  (entire new content)
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import styles from "./WizardDialog.module.css";

export interface WizardStep {
  title: string;
  /** step body; omit for a not-yet-built shell step */
  content?: React.ReactNode;
  /** return an error message to block Avanti, or null when valid */
  validate?: () => string | null;
}

export function WizardDialog({
  open, onOpenChange, title, steps, onSubmit, submitLabel = "Conferma",
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string;
  steps: WizardStep[]; onSubmit?: () => void; submitLabel?: string;
}) {
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const close = (o: boolean) => { setIdx(0); setError(null); onOpenChange(o); };
  const step = steps[idx];
  const last = idx === steps.length - 1;
  const forward = () => {
    const err = step.validate?.() ?? null;
    setError(err);
    if (err) return;
    if (last) { onSubmit?.(); close(false); } else setIdx(idx + 1);
  };
  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>{title}</Dialog.Title>
          <div className={styles.steps}>
            {steps.map((s, i) => (
              <span key={i} className={`${styles.step} ${i === idx ? styles.stepActive : ""}`}>
                {i + 1}. {s.title}
              </span>
            ))}
          </div>
          <div className={styles.body}>
            {step.content ?? (
              <Dialog.Description className={styles.note}>
                Prototipo: contenuto del passo non ancora implementato.
              </Dialog.Description>
            )}
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button className={styles.btn} onClick={() => close(false)}>Annulla</button>
            <span className={styles.actionsSpacer} />
            {idx > 0 && (
              <button className={styles.btn} onClick={() => { setError(null); setIdx(idx - 1); }}>
                Indietro
              </button>
            )}
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={forward}>
              {last ? submitLabel : "Avanti"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Shim: lift legacy `string[]` step titles into shell steps (Plan 2 replaces with real forms). */
export const shellSteps = (titles: string[]): WizardStep[] => titles.map((t) => ({ title: t }));
```

Append to `WizardDialog.module.css` (reuse existing token-based values in that file for
colors/spacing — copy the pattern of the existing `.note`/`.btn` rules):

```css
.body { min-height: 80px; padding: var(--sp-3) 0; }
.error { color: var(--negative); font-size: var(--fs-xs); margin: 0 0 var(--sp-2); }
.actionsSpacer { flex: 1; }
.btnPrimary { background: var(--accent); color: var(--surface-panel); }
```

- [ ] **Step 4: Shim the call sites**

In `apps/web/src/sections/giornale/GiornaleSection.tsx` and
`apps/web/src/sections/rate/RateSection.tsx`, every `<WizardDialog ... steps={SOME_STRING_ARRAY}>`
becomes `steps={shellSteps(SOME_STRING_ARRAY)}` (import `shellSteps` from
`"../../components/common/WizardDialog"`). Don't change anything else in those files.

- [ ] **Step 5: Run tests + FULL suite**

Run: `pnpm --filter @cl/web exec vitest run src/components/common/WizardDialog.test.tsx && pnpm --filter @cl/web test`
Expected: PASS (suite now 59). If existing Giornale/Rate tests asserted the old "Chiudi" button
or the old note text, update those assertions to the new equivalents ("Annulla"; the new note
text) — behavior intentionally changed here.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/common apps/web/src/sections/giornale/GiornaleSection.tsx apps/web/src/sections/rate/RateSection.tsx
git commit -m "feat(web): WizardDialog step machinery (validation, back/forward, submit)"
```

---

### Task 15: Paging, search, toggle, toast

**Files:**
- Create: `apps/web/src/components/common/PagingBar.tsx`, `SearchBox.tsx`, `ToolbarToggle.tsx`, `Toast.tsx`
- Create: `apps/web/src/components/common/SmallControls.module.css`
- Modify: `apps/web/src/App.tsx` (mount `ToastProvider` inside existing providers)
- Test: `apps/web/src/components/common/smallControls.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// apps/web/src/components/common/smallControls.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PagingBar } from "./PagingBar";
import { SearchBox } from "./SearchBox";
import { ToolbarToggle } from "./ToolbarToggle";
import { ToastProvider, useToast } from "./Toast";

describe("PagingBar", () => {
  it("shows position and pages within bounds", () => {
    const onPage = vi.fn();
    render(<PagingBar page={2} pageCount={5} onPage={onPage} />);
    expect(screen.getByText("pagina 2 di 5")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Pagina precedente"));
    expect(onPage).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByLabelText("Ultima pagina"));
    expect(onPage).toHaveBeenCalledWith(5);
  });
  it("disables backward buttons on the first page", () => {
    render(<PagingBar page={1} pageCount={3} onPage={() => {}} />);
    expect(screen.getByLabelText("Prima pagina")).toBeDisabled();
    expect(screen.getByLabelText("Pagina precedente")).toBeDisabled();
  });
});

describe("SearchBox / ToolbarToggle", () => {
  it("SearchBox emits text", () => {
    const onChange = vi.fn();
    render(<SearchBox value="" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText("Cerca…"), { target: { value: "banca" } });
    expect(onChange).toHaveBeenCalledWith("banca");
  });
  it("ToolbarToggle toggles", () => {
    const onChange = vi.fn();
    render(<ToolbarToggle label="Nascondi conti vuoti" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Nascondi conti vuoti"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("Toast", () => {
  it("shows a message and auto-dismisses", () => {
    vi.useFakeTimers();
    function Trigger() {
      const toast = useToast();
      return <button onClick={() => toast("Funzione non inclusa nel prototipo")}>go</button>;
    }
    render(<ToastProvider><Trigger /></ToastProvider>);
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByText("Funzione non inclusa nel prototipo")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(3500); });
    expect(screen.queryByText("Funzione non inclusa nel prototipo")).toBeNull();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/components/common/smallControls.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the four components + css**

```tsx
// apps/web/src/components/common/PagingBar.tsx
import styles from "./SmallControls.module.css";

export function PagingBar({ page, pageCount, onPage }: {
  page: number; pageCount: number; onPage: (p: number) => void;
}) {
  const first = page <= 1, last = page >= pageCount;
  return (
    <div className={styles.paging}>
      <button className={styles.pageBtn} aria-label="Prima pagina" disabled={first} onClick={() => onPage(1)}>«</button>
      <button className={styles.pageBtn} aria-label="Pagina precedente" disabled={first} onClick={() => onPage(page - 1)}>‹</button>
      <span className={styles.pageInfo}>pagina {page} di {pageCount}</span>
      <button className={styles.pageBtn} aria-label="Pagina successiva" disabled={last} onClick={() => onPage(page + 1)}>›</button>
      <button className={styles.pageBtn} aria-label="Ultima pagina" disabled={last} onClick={() => onPage(pageCount)}>»</button>
    </div>
  );
}
```

```tsx
// apps/web/src/components/common/SearchBox.tsx
import styles from "./SmallControls.module.css";

export function SearchBox({ value, onChange, placeholder = "Cerca…" }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input className={styles.search} type="search" placeholder={placeholder}
      value={value} onChange={(e) => onChange(e.target.value)} />
  );
}
```

```tsx
// apps/web/src/components/common/ToolbarToggle.tsx
import { useId } from "react";
import styles from "./SmallControls.module.css";

export function ToolbarToggle({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <label className={styles.toggle} htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
```

```tsx
// apps/web/src/components/common/Toast.tsx
import { createContext, useCallback, useContext, useRef, useState } from "react";
import styles from "./SmallControls.module.css";

const ToastContext = createContext<((msg: string) => void) | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3000);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg && <div className={styles.toast} role="status">{msg}</div>}
    </ToastContext.Provider>
  );
}

export function useToast(): (msg: string) => void {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast requires <ToastProvider>");
  return ctx;
}
```

```css
/* apps/web/src/components/common/SmallControls.module.css */
.paging { display: inline-flex; align-items: center; gap: var(--sp-1); }
.pageBtn {
  font: inherit; background: var(--surface-panel); color: var(--text-primary);
  border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);
  padding: 0 var(--sp-2); cursor: pointer;
}
.pageBtn:disabled { opacity: 0.4; cursor: default; }
.pageInfo { font-size: var(--fs-xs); color: var(--text-secondary); padding: 0 var(--sp-2); }
.search {
  font: inherit; font-size: var(--fs-sm); background: var(--surface-panel);
  color: var(--text-primary); border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm); padding: var(--sp-1) var(--sp-2);
}
.toggle { display: inline-flex; align-items: center; gap: var(--sp-1); font-size: var(--fs-xs); }
.toast {
  position: fixed; bottom: var(--sp-5, 24px); left: 50%; transform: translateX(-50%);
  background: var(--text-primary); color: var(--surface-panel);
  padding: var(--sp-2) var(--sp-4); border-radius: var(--radius-md);
  box-shadow: var(--shadow-pop); font-size: var(--fs-sm); z-index: 100;
}
```

(Same token caveat as Task 12: verify names against `src/styles/tokens.css`, substitute the
nearest existing token if a name differs.)

- [ ] **Step 4: Mount `ToastProvider` in `App.tsx`**

Wrap the existing top-level provider tree's children: inside the outermost existing provider in
`App.tsx`, add `<ToastProvider>` around the current shell JSX. (Plan 2 routes Print/PDF/Excel
buttons to `useToast()("Funzione non inclusa nel prototipo")`.)

- [ ] **Step 5: Run tests + suite + typecheck**

Run: `pnpm --filter @cl/web exec vitest run src/components/common/smallControls.test.tsx && pnpm --filter @cl/web test && pnpm --filter @cl/web typecheck`
Expected: PASS (suite now 64); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/common apps/web/src/App.tsx
git commit -m "feat(web): paging/search/toggle controls + toast provider"
```

---

### Task 16: Foundations wrap-up

**Files:**
- Modify: `apps/web/README.md`

- [ ] **Step 1: Update the README architecture note**

In `apps/web/README.md`, replace the line

```
- Data: `src/mock/MockDataSource.ts` (Saturno/Pozzetto fixtures).
```

with

```
- Data: `src/mock/MockStore.ts` — stateful in-memory store (BehaviorSubjects) behind the
  `MockDataSource` port: reads are derivations, commands (inline edits, fattura/incasso/saldi,
  rate creation, registry CRUD) mutate immutably and propagate through the selection cascade.
  Derived values recompute in `src/recompute/` (largest-remainder rounding) — the naive stand-in
  for the future `@cl/domain` engine.
```

- [ ] **Step 2: Full verification**

Run: `pnpm --filter @cl/web test && pnpm --filter @cl/web typecheck && pnpm --filter @cl/web build`
Expected: suite ~64 tests green, typecheck clean, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/README.md
git commit -m "docs(web): document the stateful mock store architecture"
```

- [ ] **Step 4: Report**

Foundations complete. Plan 2 (section completions: Giornale, Conti, Rate, Tabelle, Dati, Unità)
is authored next, against these now-real APIs.

---

## Self-review checklist (done at authoring time)

- **Spec coverage (Part 1 / §3):** store (§3.1 → Tasks 6–10), recompute (§3.2 → Tasks 2–4, 7, 9),
  editors (§3.4 → Tasks 12–13), wizard machinery (§3.4 → Task 14), shared controls + toast +
  toolbar groundwork (§3.4 → Task 15), runtime additions (§5.3 → Task 11). Fixture *enrichment*
  (§3.3) is deliberately Plan 2+ (spec delivery order puts the data pass after sections).
  `payWithholding` from §3.1 is intentionally composed from `addTransaction` (noted in spec §4.5
  as a wizard, not a distinct store operation).
- **Placeholders:** none — every code step is complete, runnable content.
- **Type consistency:** command names match between `ports.ts` (Task 7), `MockStore` (Tasks 7–10),
  and the runtime (Task 11); `WizardStep`/`shellSteps` (Task 14) match Plan 2 usage;
  `parseItMoney` shared by Task 12 fields and Task 13 inline editor.
