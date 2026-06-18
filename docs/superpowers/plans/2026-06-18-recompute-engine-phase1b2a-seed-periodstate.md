# Recompute Engine — Phase 1b-2a (seed the `PeriodState` for the live app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the build-time generator emit, per accounting period, the pure-cascade input (`PeriodState`) and the per-resident directly-attributed individual-expense map into `data.generated.json`, so the live app can rebuild distribution and per-resident balances at runtime by calling `recomputePeriod` — keeping every existing seed section **byte-identical**.

**Architecture:** Two additive, JSON-serializable sections are appended to the seed: `periodStateByPeriod: Record<Id, PeriodState>` (the Phase-0 `RipartoInput` plus the empty installment plan and `opening`/`paid`, exactly what `dbToPeriodState` already produces) and `individualByPeriod: Record<Id, Record<residentId, cents>>` (the directly-attributed individual expenses `units.ts` folds into `consuntivo`, which `recomputePeriod` does not model). The individual-expense computation is extracted from `units.ts` into a shared `projectIndividual` so the seed and the unit projector use one implementation. Existing sections are untouched, so the byte-identical regeneration gate from Phase 0/1b-1 still holds for them.

**Tech Stack:** TypeScript (the generator uses explicit `.ts` import extensions and `tsx`), Vitest, pnpm workspaces. `@cl/domain` exports `recomputePeriod`, `PeriodState`, `RipartoInput`. `@cl/application` depends on `@cl/domain` (so seed types may reference `PeriodState`).

**Spec:** `docs/superpowers/specs/2026-06-16-recompute-engine-design.md` → "Phase 1 — reconciled design". This is **Phase 1b-2a** — the data foundation for the live-app reactive cascade. The reactive store rewiring (source/derived restructure, the three edit triggers, un-freezing balances, the on-load equivalence gate, the invariant battery, retiring `recomputeDistribution`) is **Phase 1b-2b**, a follow-up plan written against the seed this plan produces.

---

## Shared conventions (read first)

- **Branch:** create and stay on `feat/recompute-engine-phase1b2a-seed` (off `main`).
- **Decisions locked in brainstorming (do not revisit):**
  - The live app obtains its riparto source by reading a **seeded `PeriodState`** (this plan emits it); it does NOT reverse-engineer it from the projected DTOs.
  - Installments stay a command-patched source in the app (Phase 1b-2b); they are **not** derived. This plan does not touch installments — `projectInstallments` is unchanged and the empty `plan` inside each seeded `PeriodState` is intentional (the generator already produces it via `dbToPeriodState`).
  - `consuntivo = riparto current share + directly-attributed individual expenses`; `recomputePeriod`'s balances carry only the riparto share, so the individual addend must be seeded separately (`individualByPeriod`) for the app to reproduce `consuntivo` exactly in 1b-2b.
- **Byte-identical is the gate (for EXISTING sections).** After regenerating, `git diff` of `apps/web/src/mock/data.generated.json` must show **only additions** of the two new top-level keys (`periodStateByPeriod`, `individualByPeriod`); no existing section's values may change. Inspect the diff to confirm. If any existing value changes, the extraction was not behaviour-preserving — fix it, do not accept the diff.
- **Generator import style:** explicit `.ts` extensions on relative imports (`../db.ts`, `./ripartoInput.ts`); package imports from `@cl/domain` / `@cl/application` have no extension.
- **Commit trailer:** end every commit body with a blank line then
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Commit via CLI** (the user's GUI git client breaks on accented filenames, and `data.generated.json` contains accented strings).

**Commands:**
- Regenerate seed: `cd apps/web && pnpm gen:data` (script: `tsx tools/gen/generate-data.ts`)
- Web tests (incl. parity specs + the new generator tests): `pnpm --filter @cl/web test`
- Web typecheck: `pnpm --filter @cl/web exec tsc --noEmit`
- Domain tests: `pnpm --filter @cl/domain test`

**Confirmed current shapes (do not re-derive):**
- `apps/web/tools/gen/project/units.ts` computes, in one `for (const e of db.rows("ledgerEntry"))` loop, the per-resident directly-attributed individual expenses: for entries in this period (`txInPeriod`), non-`unitResidentTakings`, whose `postingAccountId` resolves to a ledger account of `kind === "expenses"` and which carry a `unitResidentId`, it sums `eur(amount).cents` keyed by `String(unitResidentId)`. This is the value to extract as `projectIndividual`.
- `apps/web/tools/gen/project/periodState.ts` exports `dbToPeriodState(db: Db, periodId: string): PeriodState`. `PeriodState = { riparto: RipartoInput; plan: { installmentIds: string[]; overrides: {residentId,installmentId,cents}[] }; opening: Record<string,number>; paid: Record<string,number> }`. `RipartoInput` (from `@cl/domain`) is fully JSON-serializable — only arrays and `Record<string, number>` of primitives, no `Map`s.
- `apps/web/tools/gen/assemble.ts` builds the `Seed`. It populates `ledgerAccountsByPeriod`/`distributionByPeriod`/`installmentsByPeriod` ONLY for periods where `status[lp]?.hasBooks && status[lp]?.reconciles`; structure-only periods get empty values. The new sections follow the SAME gate.
- `apps/web/tools/gen/db.ts` exports `buildDb(parseTables(...))`; `db.rows(table)`, `db.by(table,key).get(k)`, `db.group(table,key).get(k)`, `db.condominiums`, `db.periodsOf(condId)`. The period id used inside projectors is the raw legacy id (`lp`), and the seed key is `pid = \`p${lp}\``.
- `apps/web/src/mock/seed.ts` `MockStoreSeed` and `apps/web/tools/gen/assemble.ts` `Seed` are two interfaces kept structurally identical; the generated JSON is loaded via `apps/web/src/mock/data.generated.ts` as `raw as unknown as MockStoreSeed`. `fixtureSeed` (`apps/web/src/mock/fixtures.ts`) also implements `MockStoreSeed`; to avoid forcing fixture edits, the new `MockStoreSeed` fields are **optional**.

**File layout (this plan):**
```
apps/web/tools/gen/project/
  individual.ts          projectIndividual (extracted)         (Task 1, new)
  individual.test.ts     focused unit test                     (Task 1, new)
  units.ts               use projectIndividual (byte-identical) (Task 1, modify)
apps/web/tools/gen/
  assemble.ts            emit periodStateByPeriod + individualByPeriod (Task 2, modify)
  assemble.periodState.test.ts  serialization-fidelity test     (Task 2, new)
apps/web/src/mock/
  seed.ts                add the two optional seed fields        (Task 2, modify)
docs/domain/README.md    pointer                                 (Task 3, modify)
```

---

### Task 1: Extract `projectIndividual` (DRY) and re-point `units.ts`

**Files:**
- Create: `apps/web/tools/gen/project/individual.ts`
- Create: `apps/web/tools/gen/project/individual.test.ts`
- Modify: `apps/web/tools/gen/project/units.ts`

The directly-attributed individual-expense map is currently computed inline in `units.ts`. Extract it verbatim so both `units.ts` and the new seed section (Task 2) use one implementation. The `units.ts` output must stay byte-identical (regeneration gate in Task 2 confirms).

- [ ] **Step 1: Write the failing test first**

```ts
// apps/web/tools/gen/project/individual.test.ts
import { describe, it, expect } from "vitest";
import { projectIndividual } from "./individual.ts";
import type { Db } from "../db.ts";

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
  ledgerTransaction: [
    { id: "t1", accountingPeriodId: "p1" },
    { id: "t2", accountingPeriodId: "other" }, // out of period → ignored
  ],
  ledgerAccount: [
    { id: "ea", kind: "expenses" },
    { id: "rev", kind: "revenues" },
  ],
  ledgerEntry: [
    // counted: in-period, non-takings, expenses-kind posting account, has unitResidentId
    { ledgerTransactionId: "t1", type: "expense", postingAccountId: "ea", unitResidentId: "166", amount: "12,00" },
    { ledgerTransactionId: "t1", type: "expense", postingAccountId: "ea", unitResidentId: "166", amount: "3,00" },
    // ignored: takings
    { ledgerTransactionId: "t1", type: "unitResidentTakings", postingAccountId: "ea", unitResidentId: "166", amount: "-99,00" },
    // ignored: posting account is not expenses-kind
    { ledgerTransactionId: "t1", type: "expense", postingAccountId: "rev", unitResidentId: "166", amount: "5,00" },
    // ignored: no unitResidentId
    { ledgerTransactionId: "t1", type: "expense", postingAccountId: "ea", amount: "7,00" },
    // ignored: transaction not in this period
    { ledgerTransactionId: "t2", type: "expense", postingAccountId: "ea", unitResidentId: "166", amount: "100,00" },
  ],
});

describe("projectIndividual", () => {
  it("sums directly-attributed individual expenses per resident, filtering by period/type/kind/unitResidentId", () => {
    expect(projectIndividual(db, "p1")).toEqual({ "166": 1500 }); // 12,00 + 3,00 = 1500 cents
  });

  it("returns an empty record when nothing qualifies", () => {
    expect(projectIndividual(db, "no-such-period")).toEqual({});
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/apps/web && pnpm exec vitest run tools/gen/project/individual.test.ts`
Expected: FAIL (module not found / `projectIndividual` is not a function).

- [ ] **Step 3: Implement `projectIndividual`**

```ts
// apps/web/tools/gen/project/individual.ts
import type { Db } from "../db.ts";
import { eur } from "../amounts.ts";

const str = (v: unknown): string | undefined =>
  v === null || v === undefined || String(v).trim() === "" ? undefined : String(v).trim();

/**
 * Per-resident directly-attributed individual expenses for a period, keyed by legacy
 * unitResidentId. These are expenses-kind ledger entries carrying a unitResidentId
 * (e.g. postal/reminder fees charged to specific residents) — NOT part of any riparto
 * linked subtree, so the generator folds them into consuntivo on top of the riparto share.
 * `recomputePeriod` does not model them, so they are seeded separately for the live app.
 */
export function projectIndividual(db: Db, periodId: string): Record<string, number> {
  const txInPeriod = new Set(
    db
      .rows("ledgerTransaction")
      .filter((t) => String(t.accountingPeriodId) === periodId)
      .map((t) => String(t.id)),
  );
  const accountKindById = new Map<string, string>(
    db.rows("ledgerAccount").map((a) => [String(a.id), String(a.kind ?? "")]),
  );
  const out: Record<string, number> = {};
  for (const e of db.rows("ledgerEntry")) {
    if (!txInPeriod.has(String(e.ledgerTransactionId))) continue;
    if (String(e.type) === "unitResidentTakings") continue;
    const ur = str(e.unitResidentId);
    if (!ur) continue;
    if (accountKindById.get(String(e.postingAccountId)) !== "expenses") continue;
    out[ur] = (out[ur] ?? 0) + eur(str(e.amount)).cents;
  }
  return out;
}
```

- [ ] **Step 4: Run the test (expect PASS)**

Run: `cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/apps/web && pnpm exec vitest run tools/gen/project/individual.test.ts`
Expected: PASS (2 cases).

- [ ] **Step 5: Re-point `units.ts` to use `projectIndividual`**

In `apps/web/tools/gen/project/units.ts`:

(a) Add the import after the existing `dbToPeriodState` import line (`import { dbToPeriodState } from "./periodState.ts";`):
```ts
import { projectIndividual } from "./individual.ts";
```

(b) Replace the individual-expense extraction block:
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
with:
```ts
  // Directly-attributed individual expenses per resident (expenses-kind entries carrying a
  // unitResidentId). Shared with the seed's individualByPeriod via projectIndividual.
  const individualByResident = projectIndividual(db, periodId);
```

(c) `individualByResident` is now a `Record<string, number>`, not a `Map`. Update its one read site. Find:
```ts
        (bal?.consuntivoCents ?? 0) + (individualByResident.get(String(r.id)) ?? 0);
```
and replace with:
```ts
        (bal?.consuntivoCents ?? 0) + (individualByResident[String(r.id)] ?? 0);
```

(d) After this change, `txInPeriod` and `accountKindById` may be unused in `units.ts` (they were only used by the extracted block — confirm by reading the file; the `eur`/`str` helpers are still used elsewhere). Remove any local that is now unused to satisfy strict `noUnusedLocals`:
- If `txInPeriod` (the `const txInPeriod = new Set(...)` block) is no longer referenced, remove it.
- If `accountKindById` (the `const accountKindById = new Map(...)` block) is no longer referenced, remove it.
- Do NOT remove anything still referenced. The typecheck in Step 6 is the arbiter: if tsc reports an unused local, remove exactly that one; if tsc is clean, leave the file as-is.

- [ ] **Step 6: Typecheck + run the focused unit suites**

Run, expecting all green:
```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && pnpm --filter @cl/web exec tsc --noEmit
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/apps/web && pnpm exec vitest run tools/gen/project/individual.test.ts tools/gen/project/units.test.ts
```
Expected: tsc exit 0 (no unused-locals errors); both test files pass.

- [ ] **Step 7: Regenerate the seed and assert byte-identity (this refactor must not move output)**

Run:
```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/apps/web && pnpm gen:data
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && git diff --stat apps/web/src/mock/data.generated.json
```
Expected: `git diff --stat` prints **nothing** — Task 1 is a pure refactor and must not change a byte of the seed (the new sections are added in Task 2, not here). If it changed, `projectIndividual` diverged from the inline computation — fix it; do not accept the diff.

- [ ] **Step 8: Commit**

```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
git add apps/web/tools/gen/project/individual.ts apps/web/tools/gen/project/individual.test.ts apps/web/tools/gen/project/units.ts
git commit -m "$(cat <<'EOF'
refactor(gen): extract projectIndividual from units.ts (byte-identical)

Per-resident directly-attributed individual expenses, shared by units.ts and the
forthcoming seed section. Output unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Emit `periodStateByPeriod` + `individualByPeriod` into the seed

**Files:**
- Modify: `apps/web/tools/gen/assemble.ts`
- Modify: `apps/web/src/mock/seed.ts`
- Create: `apps/web/tools/gen/assemble.periodState.test.ts`

Append two JSON-serializable sections to the seed, populated for book-reconciling periods (same gate as distribution). Add the matching optional fields to `MockStoreSeed` so 1b-2b can consume them type-safely without forcing `fixtureSeed` to provide them.

- [ ] **Step 1: Add the optional seed fields to `MockStoreSeed`**

In `apps/web/src/mock/seed.ts`:

(a) Extend the type-only import from `@cl/application` is NOT needed; add a new import line for `PeriodState` from `@cl/domain` at the top (after the existing `@cl/application` import block):
```ts
import type { PeriodState } from "@cl/domain";
```

(b) Add these two fields to the `MockStoreSeed` interface, immediately after the `installmentsByPeriod` line:
```ts
  /** Phase 1b-2: pure-cascade input per period (book-reconciling periods only).
   * The live app derives distribution + balances by calling recomputePeriod on this. */
  periodStateByPeriod?: Record<Id, PeriodState>;
  /** Phase 1b-2: per-resident directly-attributed individual expenses (legacy
   * unitResidentId → cents) folded into consuntivo on top of the riparto share. */
  individualByPeriod?: Record<Id, Record<string, number>>;
```

- [ ] **Step 2: Wire the two sections into `assemble.ts`**

In `apps/web/tools/gen/assemble.ts`:

(a) Add to the `@cl/domain` imports. There is currently no `@cl/domain` import in this file; add one after the `@cl/application` type import block:
```ts
import type { PeriodState } from "@cl/domain";
```

(b) Add to the project-function imports (after `import { projectDistributionTables, projectDistribution } from "./project/distribution.ts";`):
```ts
import { dbToPeriodState } from "./project/periodState.ts";
import { projectIndividual } from "./project/individual.ts";
```

(c) Add the two fields to the `Seed` interface, immediately after the `installmentsByPeriod` line:
```ts
  periodStateByPeriod: Record<Id, PeriodState>;
  individualByPeriod: Record<Id, Record<string, number>>;
```
(Required here — the generator always produces them, even if empty for structure-only periods.)

(d) Add the two accumulators next to the other `const ...ByPeriod` declarations inside `assemble` (after `const installmentsByPeriod: Record<Id, Installments> = {};`):
```ts
  const periodStateByPeriod: Record<Id, PeriodState> = {};
  const individualByPeriod: Record<Id, Record<string, number>> = {};
```

(e) Inside the `if (st?.hasBooks && st?.reconciles) { ... }` branch, after the `installmentsByPeriod[pid] = projectInstallments(db, lp);` line, add:
```ts
        periodStateByPeriod[pid] = dbToPeriodState(db, lp);
        individualByPeriod[pid] = projectIndividual(db, lp);
```
In the `else { ... }` branch, after `installmentsByPeriod[pid] = emptyInst;`, add:
```ts
        periodStateByPeriod[pid] = {
          riparto: {
            accounts: [], links: [], estimateCentsByAccount: {}, actualCentsByAccount: {},
            tableItems: [], roles: [], residents: [], unitLegacyIds: [],
          },
          plan: { installmentIds: [], overrides: [] },
          opening: {}, paid: {},
        };
        individualByPeriod[pid] = {};
```

(f) Add the two fields to the returned object (after `installmentsByPeriod,`):
```ts
    periodStateByPeriod,
    individualByPeriod,
```

- [ ] **Step 3: Write the serialization-fidelity test**

This is the test that earns this plan its keep: it proves the seeded `PeriodState` survives a JSON round-trip with no lost data (no `Map`s) and is a faithful substitute for the live `db` when driving `recomputePeriod` — exactly what 1b-2b relies on.

```ts
// apps/web/tools/gen/assemble.periodState.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseTables } from "./loadRows.ts";
import { buildDb } from "./db.ts";
import { assemble } from "./assemble.ts";
import { recomputePeriod, type ResidentBalance } from "@cl/domain";

const DUMP_URL = new URL("../../../old/db/it-jtime-condominium.all.sql", import.meta.url);

function loadSeed() {
  const db = buildDb(parseTables(readFileSync(DUMP_URL, "utf8")));
  return assemble(db);
}

function balancesById(bs: ResidentBalance[]): Map<string, ResidentBalance> {
  return new Map(bs.map((b) => [b.residentId, b]));
}

describe("assemble: periodStateByPeriod / individualByPeriod", () => {
  const seed = loadSeed();

  it("emits a PeriodState for every period (matching the distribution gate)", () => {
    const dist = seed.distributionByPeriod;
    const ps = seed.periodStateByPeriod;
    // every period present in the seed has a PeriodState entry
    expect(Object.keys(ps).sort()).toEqual(Object.keys(seed.unitsByPeriod).sort());
    // at least one period actually has books (non-empty riparto)
    const withBooks = Object.keys(dist).filter((pid) => seed.distributionByPeriod[pid]!.estimate.rows.length > 0);
    expect(withBooks.length).toBeGreaterThan(0);
    for (const pid of withBooks) {
      expect(ps[pid]!.riparto.unitLegacyIds.length).toBeGreaterThan(0);
    }
  });

  it("survives a JSON round-trip and reproduces recomputePeriod balances byte-for-byte", () => {
    const withBooks = Object.keys(seed.periodStateByPeriod).filter(
      (pid) => seed.periodStateByPeriod[pid]!.riparto.unitLegacyIds.length > 0,
    );
    for (const pid of withBooks) {
      const original = seed.periodStateByPeriod[pid]!;
      const roundTripped = JSON.parse(JSON.stringify(original)) as typeof original;
      // round-trip must not lose data (no Maps hidden in RipartoInput)
      expect(roundTripped).toEqual(original);
      // and the cascade output is identical before/after serialization
      const a = balancesById(recomputePeriod(original).balances);
      const b = balancesById(recomputePeriod(roundTripped).balances);
      expect(b.size).toBe(a.size);
      for (const [rid, bal] of a) expect(b.get(rid)).toEqual(bal);
    }
  });

  it("individualByPeriod is keyed by residentIds present in the period roster", () => {
    const withBooks = Object.keys(seed.periodStateByPeriod).filter(
      (pid) => seed.periodStateByPeriod[pid]!.riparto.unitLegacyIds.length > 0,
    );
    for (const pid of withBooks) {
      const roster = new Set(seed.periodStateByPeriod[pid]!.riparto.residents.map((r) => r.residentId));
      for (const rid of Object.keys(seed.individualByPeriod[pid] ?? {})) {
        expect(roster.has(rid)).toBe(true);
      }
    }
  });
});
```

NOTE on the dump path: `assemble.periodState.test.ts` lives in `apps/web/tools/gen/`, and the dump is at `old/db/it-jtime-condominium.all.sql` (repo root). From `apps/web/tools/gen/`, that is `../../../old/db/...` (three `..`: `gen`→`tools`, `tools`→`web`, `web`→`apps`... ⇒ verify against `generate-data.ts`, which uses `../../../../old/db/...` from the same directory via `import.meta.url`). **Use the SAME relative depth as `generate-data.ts`** (`../../../../old/db/it-jtime-condominium.all.sql`) — if the test cannot read the dump, fix the path to match `generate-data.ts` exactly, do not change `generate-data.ts`.

- [ ] **Step 4: Run the new test (expect PASS)**

Run: `cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/apps/web && pnpm exec vitest run tools/gen/assemble.periodState.test.ts`
Expected: PASS (3 cases). If it fails on the dump path, correct the `DUMP_URL` to match `generate-data.ts`'s depth and re-run.

- [ ] **Step 5: Regenerate the seed and assert EXISTING sections are byte-identical**

Run:
```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/apps/web && pnpm gen:data
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && git --no-pager diff apps/web/src/mock/data.generated.json | head -40
```
Expected: `pnpm gen:data` succeeds. The diff shows ONLY additions introducing the two new top-level keys `"periodStateByPeriod"` and `"individualByPeriod"` (and their contents); NO line inside any pre-existing section (`unitsByPeriod`, `distributionByPeriod`, `installmentsByPeriod`, etc.) changes. Confirm by scanning the diff. If a pre-existing value changed, investigate before continuing — Task 1's refactor or this wiring altered output.

Verification that the new keys are present and populated:
```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
grep -c '"periodStateByPeriod"' apps/web/src/mock/data.generated.json   # expect 1
grep -c '"individualByPeriod"' apps/web/src/mock/data.generated.json    # expect 1
```

- [ ] **Step 6: Typecheck + full web suite**

Run, expecting all green:
```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && pnpm --filter @cl/web exec tsc --noEmit
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && pnpm --filter @cl/web test
```
Expected: tsc exit 0; web suite green. Pass count is the prior 296 plus the new tests added in this plan: `individual.test.ts` (2) and `assemble.periodState.test.ts` (3) ⇒ **301**. Confirm the exact number and that the parity specs are among the passing.

- [ ] **Step 7: Commit (the JSON change is intentional and additive)**

```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
git add apps/web/tools/gen/assemble.ts apps/web/src/mock/seed.ts apps/web/tools/gen/assemble.periodState.test.ts apps/web/src/mock/data.generated.json
git commit -m "$(cat <<'EOF'
feat(gen): seed periodStateByPeriod + individualByPeriod for the live app

Additive seed sections (book-reconciling periods only): the pure-cascade input
(PeriodState) the app will run recomputePeriod on, and the per-resident individual
expenses folded into consuntivo. Existing seed sections are byte-identical; a
serialization-fidelity test pins that the seeded PeriodState round-trips losslessly.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Docs pointer + whole-repo verification

**Files:**
- Modify: `docs/domain/README.md`
- Verify: whole repo

- [ ] **Step 1: Final verification**

Run, expecting all green:
```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/apps/web && pnpm gen:data
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && git status --short
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && pnpm --filter @cl/domain test
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && pnpm --filter @cl/web exec tsc --noEmit
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger && pnpm --filter @cl/web test
```
Expected: `git status --short` shows NO change to `apps/web/src/mock/data.generated.json` (it regenerates identically to the committed version); `@cl/domain` 34 tests green; web tsc clean; web suite green (301).

- [ ] **Step 2: Extend the docs pointer**

In `docs/domain/README.md`, find the paragraph added in Phase 1b-1 that ends:
```markdown
remain on their legacy `installmentItem` source. The live-app reactive cascade is Phase 1b-2.
```
and replace that final sentence with:
```markdown
remain on their legacy `installmentItem` source. For the live app, the generator also seeds
`periodStateByPeriod` (the pure-cascade input) and `individualByPeriod` (per-resident individual
expenses) into `data.generated.json`, so the app can rebuild distribution + balances by calling
`recomputePeriod` at runtime. Wiring that into the reactive store is Phase 1b-2b.
```

- [ ] **Step 3: Commit**

```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
git add docs/domain/README.md
git commit -m "$(cat <<'EOF'
docs(domain): note the seed now carries periodState + individual for the live app

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review checklist (completed)

**Spec coverage (Phase 1b-2a scope):** the live app's riparto source is delivered as a seeded `PeriodState` (Task 2) — the "Seed PeriodState; store carries it" decision; the `consuntivo` individual-expense addend `recomputePeriod` does not model is seeded as `individualByPeriod` (Task 2), extracted DRY from `units.ts` (Task 1); installments are untouched (the empty `plan` is intentional, matching the "installments stay source" decision); existing seed sections stay byte-identical (Tasks 1, 2, 3 gates); serialization fidelity of the seeded `PeriodState` is pinned (Task 2 Step 3); docs updated (Task 3). **Deliberately out of scope (→ Phase 1b-2b):** the store source/derived restructure, the three edit triggers, un-freezing balances, retiring `recomputeDistribution`, the on-load equivalence gate (derived DTOs == seeded DTOs), and the post-edit invariant battery.

**Placeholder scan:** none — every edit shows exact before/after text; every run step gives the command and the expected result (byte-identity = empty/additive diff; test counts stated: 296 → 301).

**Type consistency:** `projectIndividual(db, periodId): Record<string, number>` defined in Task 1 and consumed in `units.ts` (Task 1, where the read site changes from `Map.get` to `Record` index) and in `assemble.ts` (Task 2). `dbToPeriodState(db, periodId): PeriodState` (shipped in 1b-1) is consumed unchanged in Task 2. `PeriodState`/`RipartoInput` are imported from `@cl/domain`; `MockStoreSeed`'s new fields are optional (`?`) to spare `fixtureSeed`, while the generator `Seed`'s are required. The structure-only `PeriodState` literal in Task 2 Step 2(e) matches the `RipartoInput` shape (`accounts`/`links`/`estimateCentsByAccount`/`actualCentsByAccount`/`tableItems`/`roles`/`residents`/`unitLegacyIds`) plus `plan`/`opening`/`paid`.

**Byte-identity reasoning:** Task 1 only relocates the individual-expense computation (same filter, same arithmetic) and switches one read from `Map.get(k)` to `record[k]` — output unchanged (Step 7 gate). Task 2 only APPENDS two new top-level keys; no existing projector is altered, so all pre-existing sections regenerate identically (Step 5 gate). The seeded `PeriodState` equals `dbToPeriodState(db, lp)`, which the generator's `projectDistribution`/`projectUnits` already consume — so the seed is a faithful substitute by construction, and Task 2 Step 3 additionally proves it round-trips through JSON losslessly.
