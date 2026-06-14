# Accounting-Core Parity Specs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build executable Gherkin acceptance specs that prove the new implementation reproduces the legacy app's accounting behaviour, using the legacy DB dump as the oracle.

**Architecture:** A tiny in-repo Gherkin adapter (parser + runner) emits one Vitest test per scenario. Step definitions bind to the existing `@cl/web` generator projections + riparto engine (today's data producer) and assert against independent legacy oracles (legacy-stored ledger postings + raw-row invariants). `.feature` files are tool-neutral and double as readable specs.

**Tech Stack:** TypeScript (ESM, `.ts` import extensions), Vitest (existing runner), the `@cl/web` generator (`apps/web/tools/gen/`).

**Spec:** `docs/superpowers/specs/2026-06-14-accounting-parity-specs-design.md`

---

## Shared conventions (read first)

**Confirmed generator APIs** (the subject under test — do not modify these files):
- `parseTables(sql): Tables` — `apps/web/tools/gen/loadRows.ts`
- `buildDb(tables): Db` — `db.ts`; `Db` has `.rows(name)`, `.by(name,key)`, `.group(name,key)`, `.condominiums`, `.periodsOf(condId)`
- `eur(s): Money` (`{cents}`) — `amounts.ts`
- `reconcilePeriods(db): Record<periodId,{hasBooks,reconciles}>` — `reconcile.ts`
- `projectAccounts(db, periodId): LedgerAccountRow[]`, `projectTransactions(db, periodId): LedgerTxnRow[]` — `project/accounting.ts`
- `projectDistribution(db, periodId): Record<"estimate"|"current",{columns,rows}>` — `project/distribution.ts`
- `projectUnits(db, periodId): UnitRow[]` — `project/units.ts`
- `projectInstallments(db, periodId): {columns,rows}` — `project/installments.ts`
- `projectAnagrafiche(db): Anagrafica[]`, `projectCategories(db): string[]` — `project/anagrafiche.ts`
- `projectTree(db): CondominiumNode[]` — `project/structure.ts`
- `buildRiparto(db, periodId): RipartoEngine` — `project/riparto.ts`, where
  `RipartoEngine = { columns: { legacyAccountId, name, links, displayTableId }[]; perUnitAmount(accountId, mode, legacyUnitId): number; subtree(accountId): {estimateCents, actualCents}; perResidentAmount(accountId, mode, legacyUnitId): Map<unitResidentId, cents>; unitLegacyIds: string[] }` and `mode = "estimate" | "current"`.

**Period mapping (the two periods with books):** Saturno 2011 → legacy `accountingPeriod.id = "1"` (DTO `p1`); Pozzetto 2013 → legacy id `"36"` (DTO `p36`). All `periodId` args to projections are the **legacy** id (`"1"`, `"36"`), NOT the `p`-prefixed DTO id.

**Dump access (Vitest quirk):** read the dump cwd-relative — `readFileSync(resolve(process.cwd(), "../../old/db/it-jtime-condominium.all.sql"), "utf8")`. Do NOT use `new URL(import.meta.url)` (throws under Vitest). cwd is `apps/web` for `pnpm --filter @cl/web test` and `cd apps/web && pnpm exec vitest`.

**Oracle facts (verified):**
- `ledgerEntry.amount` is signed; a period's entries sum to 0 when it reconciles.
- `ledgerTransaction.type='estimateDistribution'` entries post each resident's **preventivo** to the receivable account, keyed by `ledgerEntry.unitResidentId` (this is the legacy app's own riparto output — the headline oracle).
- `ledgerTransaction.type='closingBalance'` entries are the **consuntivo adjustment** (negative); per-resident gross-consuntivo semantics are NOT assumed (Task 7 verifies).
- `unitResident.startingBalance` = legacy opening balance per resident.
- `installmentItem.amount` = legacy per-resident-per-installment amount.
- Reconciling periods: only `"1"` and `"36"`; all other real periods are structure-only.

**Test commands:** `cd apps/web && pnpm exec vitest run <path>`. Typecheck: `pnpm exec tsc -p tools/tsconfig.json --noEmit` (exit 0). Vitest's default include picks up `tools/**/*.test.ts`; `.feature` files are data (read via `readFileSync`), not imported.

**File layout (created by this plan):**
```
apps/web/tools/gen/specs/
  gherkin/parse.ts        gherkin/parse.test.ts
  gherkin/run.ts          gherkin/run.test.ts
  world.ts                world.test.ts
  oracle.ts               oracle.test.ts
  steps.ts                (step definitions; grows per feature)
  features/*.feature      (6 spec files)
  specs.test.ts           (entry: import steps, run features under Vitest)
```

---

### Task 1: Gherkin parser

**Files:**
- Create: `apps/web/tools/gen/specs/gherkin/parse.ts`
- Create: `apps/web/tools/gen/specs/gherkin/parse.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tools/gen/specs/gherkin/parse.test.ts
import { describe, it, expect } from "vitest";
import { parseFeature } from "./parse.ts";

const FEATURE = `
Feature: Demo
  Background:
    Given the legacy data for period "Saturno 2011"
  Scenario: a plain scenario
    When I do a thing
    Then it works
  Scenario Outline: per period
    Then period "<period>" reconciles
    Examples:
      | period        |
      | Saturno 2011  |
      | Pozzetto 2013 |
`;

describe("parseFeature", () => {
  const f = parseFeature(FEATURE);
  it("captures the feature name and background", () => {
    expect(f.name).toBe("Demo");
    expect(f.background.map((s) => s.text)).toEqual([`the legacy data for period "Saturno 2011"`]);
  });
  it("captures a plain scenario's steps (keyword stripped)", () => {
    const plain = f.scenarios.find((s) => s.name.startsWith("a plain scenario"))!;
    expect(plain.steps.map((s) => s.text)).toEqual(["I do a thing", "it works"]);
  });
  it("expands a scenario outline over its examples", () => {
    const expanded = f.scenarios.filter((s) => s.name.startsWith("per period"));
    expect(expanded).toHaveLength(2);
    expect(expanded[0]!.steps[0]!.text).toBe(`period "Saturno 2011" reconciles`);
    expect(expanded[1]!.steps[0]!.text).toBe(`period "Pozzetto 2013" reconciles`);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm exec vitest run tools/gen/specs/gherkin/parse.test.ts`
Expected: FAIL — cannot find `./parse.ts`.

- [ ] **Step 3: Implement**

```ts
// apps/web/tools/gen/specs/gherkin/parse.ts
export interface Step {
  text: string;
}
export interface Scenario {
  name: string;
  steps: Step[];
}
export interface Feature {
  name: string;
  background: Step[];
  scenarios: Scenario[];
}

const STEP = /^(?:Given|When|Then|And|But)\s+(.*)$/;

function substitute(s: string, row: Record<string, string>): string {
  return s.replace(/<([^>]+)>/g, (_, k: string) => row[k] ?? `<${k}>`);
}

/** Minimal Gherkin: Feature, Background, Scenario, Scenario Outline + Examples, steps. */
export function parseFeature(text: string): Feature {
  const feature: Feature = { name: "", background: [], scenarios: [] };
  let mode: "none" | "background" | "scenario" | "outline" | "examples" = "none";
  let scenario: Scenario | null = null;
  let outline: { name: string; steps: Step[] } | null = null;
  let header: string[] | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    let m: RegExpMatchArray | null;

    if ((m = line.match(/^Feature:\s*(.*)$/))) { feature.name = m[1]!.trim(); mode = "none"; continue; }
    if (/^Background:/.test(line)) { mode = "background"; continue; }
    if ((m = line.match(/^Scenario Outline:\s*(.*)$/))) { outline = { name: m[1]!.trim(), steps: [] }; scenario = null; header = null; mode = "outline"; continue; }
    if ((m = line.match(/^Scenario:\s*(.*)$/))) { scenario = { name: m[1]!.trim(), steps: [] }; feature.scenarios.push(scenario); outline = null; mode = "scenario"; continue; }
    if (/^Examples:/.test(line)) { header = null; mode = "examples"; continue; }

    if (mode === "examples" && line.startsWith("|")) {
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (!header) { header = cells; continue; }
      const row: Record<string, string> = {};
      header.forEach((h, i) => { row[h] = cells[i] ?? ""; });
      const label = header.map((h) => `${h}=${row[h]}`).join(", ");
      feature.scenarios.push({
        name: `${outline!.name} — ${label}`,
        steps: outline!.steps.map((s) => ({ text: substitute(s.text, row) })),
      });
      continue;
    }

    if ((m = line.match(STEP))) {
      const step: Step = { text: m[1]!.trim() };
      if (mode === "background") feature.background.push(step);
      else if (mode === "outline") outline!.steps.push(step);
      else if (mode === "scenario") scenario!.steps.push(step);
      continue;
    }
  }
  return feature;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run tools/gen/specs/gherkin/parse.test.ts`
Expected: PASS (3 assertions). Also: `pnpm exec tsc -p tools/tsconfig.json --noEmit` exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tools/gen/specs/gherkin/parse.ts apps/web/tools/gen/specs/gherkin/parse.test.ts
git commit -m "feat(web/specs): minimal Gherkin parser (feature/background/scenario/outline)"
```

---

### Task 2: Gherkin runner + step registry

**Files:**
- Create: `apps/web/tools/gen/specs/gherkin/run.ts`
- Create: `apps/web/tools/gen/specs/gherkin/run.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tools/gen/specs/gherkin/run.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { defineStep, runStep, resetSteps } from "./run.ts";

describe("step registry", () => {
  beforeEach(() => resetSteps());

  it("matches a step by regex and passes captured args + world", async () => {
    const calls: string[] = [];
    defineStep(/^I add (\d+) and (\d+)$/, (world, a, b) => {
      (world as { sum?: number }).sum = Number(a) + Number(b);
      calls.push(`${a}+${b}`);
    });
    const world: Record<string, unknown> = {};
    await runStep(world, { text: "I add 2 and 40" });
    expect(world.sum).toBe(42);
    expect(calls).toEqual(["2+40"]);
  });

  it("throws on an undefined step", async () => {
    await expect(runStep({}, { text: "nothing matches this" })).rejects.toThrow(/Undefined step/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm exec vitest run tools/gen/specs/gherkin/run.test.ts`
Expected: FAIL — cannot find `./run.ts`.

- [ ] **Step 3: Implement**

```ts
// apps/web/tools/gen/specs/gherkin/run.ts
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "vitest";
import { parseFeature, type Step } from "./parse.ts";

export type World = Record<string, unknown>;
type StepFn = (world: World, ...args: string[]) => void | Promise<void>;
interface Binding { re: RegExp; fn: StepFn }

const bindings: Binding[] = [];

/** Register a step. Keyword (Given/When/Then/And) is documentation; matching is by regex. */
export function defineStep(re: RegExp, fn: StepFn): void {
  bindings.push({ re, fn });
}
export const Given = defineStep;
export const When = defineStep;
export const Then = defineStep;
export const And = defineStep;

/** Test seam: clear the registry. */
export function resetSteps(): void {
  bindings.length = 0;
}

export async function runStep(world: World, step: Step): Promise<void> {
  for (const b of bindings) {
    const m = step.text.match(b.re);
    if (m) {
      await b.fn(world, ...m.slice(1));
      return;
    }
  }
  throw new Error(`Undefined step: ${step.text}`);
}

/** Read every .feature in `dir` and emit one Vitest test per scenario. */
export function runFeatureFiles(dir: string, makeWorld: () => World): void {
  const files = readdirSync(dir).filter((f) => f.endsWith(".feature")).sort();
  for (const file of files) {
    const feature = parseFeature(readFileSync(`${dir}/${file}`, "utf8"));
    describe(feature.name || file, () => {
      for (const sc of feature.scenarios) {
        it(sc.name, async () => {
          const world = makeWorld();
          for (const step of [...feature.background, ...sc.steps]) {
            await runStep(world, step);
          }
        });
      }
    });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run tools/gen/specs/gherkin/run.test.ts`
Expected: PASS (2 assertions). tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tools/gen/specs/gherkin/run.ts apps/web/tools/gen/specs/gherkin/run.test.ts
git commit -m "feat(web/specs): Gherkin step registry + Vitest scenario runner"
```

---

### Task 3: World (cached dump + period resolution)

**Files:**
- Create: `apps/web/tools/gen/specs/world.ts`
- Create: `apps/web/tools/gen/specs/world.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tools/gen/specs/world.test.ts
import { describe, it, expect } from "vitest";
import { legacyDb, makeWorld, resolvePeriod, type SpecWorld } from "./world.ts";

describe("spec world", () => {
  it("loads the real dump and selects real condominiums", () => {
    const db = legacyDb();
    expect(db.condominiums.length).toBeGreaterThanOrEqual(6);
  });
  it("resolves a period label to its legacy accountingPeriod id", () => {
    const db = legacyDb();
    expect(resolvePeriod(db, "Saturno 2011")).toBe("1");
    expect(resolvePeriod(db, "Pozzetto 2013")).toBe("36");
  });
  it("makeWorld seeds the db", () => {
    const w: SpecWorld = makeWorld();
    expect(w.db.condominiums.length).toBeGreaterThanOrEqual(6);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm exec vitest run tools/gen/specs/world.test.ts`
Expected: FAIL — cannot find `./world.ts`.

- [ ] **Step 3: Implement**

```ts
// apps/web/tools/gen/specs/world.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTables, type Tables } from "../loadRows.ts";
import { buildDb, type Db } from "../db.ts";

let cachedTables: Tables | null = null;
let cachedDb: Db | null = null;

/** Parse the 48 MB dump once per worker (cwd = apps/web under Vitest). */
export function legacyTables(): Tables {
  if (!cachedTables) {
    const path = resolve(process.cwd(), "../../old/db/it-jtime-condominium.all.sql");
    cachedTables = parseTables(readFileSync(path, "utf8"));
  }
  return cachedTables;
}
export function legacyDb(): Db {
  if (!cachedDb) cachedDb = buildDb(legacyTables());
  return cachedDb;
}

export interface SpecWorld {
  db: Db;
  legacyPeriodId?: string; // e.g. "1"
  result?: unknown;        // last computed value
  [k: string]: unknown;
}

export function makeWorld(): SpecWorld {
  return { db: legacyDb() };
}

/** "Saturno 2011" → legacy accountingPeriod id ("1"). Last token = year, rest = building name. */
export function resolvePeriod(db: Db, label: string): string {
  const parts = label.trim().split(/\s+/);
  const year = parts[parts.length - 1]!;
  const condName = parts.slice(0, -1).join(" ");
  const cond = db.rows("condominium").find((c) => String(c.name) === condName);
  if (!cond) throw new Error(`No condominium named "${condName}"`);
  const period = db.rows("accountingPeriod").find(
    (p) => String(p.condominiumId) === String(cond.id) && String(p.name) === year,
  );
  if (!period) throw new Error(`No period "${year}" for condominium "${condName}"`);
  return String(period.id);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run tools/gen/specs/world.test.ts`
Expected: PASS (3 assertions). tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tools/gen/specs/world.ts apps/web/tools/gen/specs/world.test.ts
git commit -m "feat(web/specs): cached legacy-dump World + period resolution"
```

---

### Task 4: Oracle extractors (independent legacy-stored values)

**Files:**
- Create: `apps/web/tools/gen/specs/oracle.ts`
- Create: `apps/web/tools/gen/specs/oracle.test.ts`

These read raw rows directly (a different code path than the projections) so comparisons are non-circular.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tools/gen/specs/oracle.test.ts
import { describe, it, expect } from "vitest";
import { legacyDb } from "./world.ts";
import {
  rawTrialBalanceCents, entryCount, estimateDistributionByResident, installmentItemTotalCents,
} from "./oracle.ts";

describe("legacy oracles", () => {
  const db = legacyDb();
  it("trial balance nets to zero for the reconciling periods", () => {
    expect(Math.abs(rawTrialBalanceCents(db, "1"))).toBeLessThanOrEqual(1);
    expect(Math.abs(rawTrialBalanceCents(db, "36"))).toBeLessThanOrEqual(1);
  });
  it("the reconciling periods have posted entries", () => {
    expect(entryCount(db, "1")).toBeGreaterThan(0);
    expect(entryCount(db, "36")).toBeGreaterThan(0);
  });
  it("the legacy estimateDistribution postings exist per resident", () => {
    const m = estimateDistributionByResident(db, "36");
    expect(m.size).toBeGreaterThan(0);
    const total = [...m.values()].reduce((s, c) => s + c, 0);
    expect(total).toBeGreaterThan(0);
  });
  it("installment items total to a positive amount", () => {
    expect(installmentItemTotalCents(db, "36")).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm exec vitest run tools/gen/specs/oracle.test.ts`
Expected: FAIL — cannot find `./oracle.ts`.

- [ ] **Step 3: Implement**

```ts
// apps/web/tools/gen/specs/oracle.ts
import type { Db } from "../db.ts";
import { eur } from "../amounts.ts";

const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

function txIdsInPeriod(db: Db, periodId: string, type?: string): Set<string> {
  return new Set(
    db.rows("ledgerTransaction")
      .filter((t) => String(t.accountingPeriodId) === periodId && (type === undefined || String(t.type) === type))
      .map((t) => String(t.id)),
  );
}

/** Σ signed entry cents over the period's transactions (raw trial balance). */
export function rawTrialBalanceCents(db: Db, periodId: string): number {
  const tx = txIdsInPeriod(db, periodId);
  let sum = 0;
  for (const e of db.rows("ledgerEntry")) if (tx.has(String(e.ledgerTransactionId))) sum += eur(str(e.amount)).cents;
  return sum;
}

/** Count of posted entries in the period. */
export function entryCount(db: Db, periodId: string): number {
  const tx = txIdsInPeriod(db, periodId);
  let n = 0;
  for (const e of db.rows("ledgerEntry")) if (tx.has(String(e.ledgerTransactionId))) n++;
  return n;
}

/** Per-resident preventivo as the LEGACY posted it (estimateDistribution entries). Map<unitResidentId, cents>. */
export function estimateDistributionByResident(db: Db, periodId: string): Map<string, number> {
  const tx = txIdsInPeriod(db, periodId, "estimateDistribution");
  const m = new Map<string, number>();
  for (const e of db.rows("ledgerEntry")) {
    if (!tx.has(String(e.ledgerTransactionId))) continue;
    const ur = str(e.unitResidentId);
    if (!ur) continue;
    m.set(ur, (m.get(ur) ?? 0) + eur(str(e.amount)).cents);
  }
  return m;
}

/** unitResident.startingBalance per resident (legacy stored), for residents in this period. */
export function startingBalanceByResident(db: Db, periodId: string): Map<string, number> {
  const unitIds = new Set(db.rows("unit").filter((u) => String(u.accountingPeriodId) === periodId).map((u) => String(u.id)));
  const upIds = new Set(db.rows("unitPeriod").filter((up) => unitIds.has(String(up.unitId))).map((up) => String(up.id)));
  const m = new Map<string, number>();
  for (const r of db.rows("unitResident")) {
    if (!upIds.has(String(r.unitPeriodId))) continue;
    m.set(String(r.id), eur(str(r.startingBalance)).cents);
  }
  return m;
}

/** Σ installmentItem.amount cents for the period's installments. */
export function installmentItemTotalCents(db: Db, periodId: string): number {
  const instIds = new Set(db.rows("installment").filter((i) => String(i.accountingPeriodId) === periodId).map((i) => String(i.id)));
  let sum = 0;
  for (const it of db.rows("installmentItem")) if (instIds.has(String(it.installmentId))) sum += eur(str(it.amount)).cents;
  return sum;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run tools/gen/specs/oracle.test.ts`
Expected: PASS (4 assertions). tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tools/gen/specs/oracle.ts apps/web/tools/gen/specs/oracle.test.ts
git commit -m "feat(web/specs): independent legacy oracles (raw rows, estimateDistribution)"
```

---

### Task 5: Entry wiring + first feature (reconciliation) — end-to-end

**Files:**
- Create: `apps/web/tools/gen/specs/steps.ts`
- Create: `apps/web/tools/gen/specs/features/reconciliation.feature`
- Create: `apps/web/tools/gen/specs/specs.test.ts`

This proves the whole pipeline (parser → runner → world → oracle → projections) green end-to-end.

- [ ] **Step 1: Write the feature (the spec)**

```gherkin
# apps/web/tools/gen/specs/features/reconciliation.feature
Feature: Reconciliation gate

  Scenario Outline: a period with books reconciles to zero
    Given the legacy data for period "<period>"
    Then the period has posted books
    And the trial balance nets to zero
    And the new reconciliation gate marks the period reconciled

    Examples:
      | period        |
      | Saturno 2011  |
      | Pozzetto 2013 |
```

- [ ] **Step 2: Write the step definitions used so far**

```ts
// apps/web/tools/gen/specs/steps.ts
import { expect } from "vitest";
import { Given, Then } from "./gherkin/run.ts";
import { resolvePeriod, type SpecWorld } from "./world.ts";
import { rawTrialBalanceCents, entryCount } from "./oracle.ts";
import { reconcilePeriods } from "../reconcile.ts";

Given(/^the legacy data for period "([^"]+)"$/, (world, label) => {
  const w = world as SpecWorld;
  w.legacyPeriodId = resolvePeriod(w.db, label);
});

Then(/^the period has posted books$/, (world) => {
  const w = world as SpecWorld;
  expect(entryCount(w.db, w.legacyPeriodId!)).toBeGreaterThan(0);
});

Then(/^the trial balance nets to zero$/, (world) => {
  const w = world as SpecWorld;
  expect(Math.abs(rawTrialBalanceCents(w.db, w.legacyPeriodId!))).toBeLessThanOrEqual(1);
});

Then(/^the new reconciliation gate marks the period reconciled$/, (world) => {
  const w = world as SpecWorld;
  const status = reconcilePeriods(w.db)[w.legacyPeriodId!]!;
  expect(status).toEqual({ hasBooks: true, reconciles: true });
});
```

- [ ] **Step 3: Write the entry test**

```ts
// apps/web/tools/gen/specs/specs.test.ts
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import "./steps.ts"; // registers all step definitions (side effect)
import { runFeatureFiles } from "./gherkin/run.ts";
import { makeWorld } from "./world.ts";

// __dirname is NOT a URL read of the dump, so import.meta.url is fine here for locating features.
const featuresDir = resolve(dirname(fileURLToPath(import.meta.url)), "features");
runFeatureFiles(featuresDir, makeWorld);
```

Note: `import.meta.url` is used here only to locate the co-located `features/` directory (a normal path join), not to `readFileSync` the dump — so the Vitest file-scheme quirk does not apply. If it nonetheless errors under this Vitest version, replace with `resolve(process.cwd(), "tools/gen/specs/features")`.

- [ ] **Step 4: Run to verify the suite is green**

Run: `cd apps/web && pnpm exec vitest run tools/gen/specs/specs.test.ts`
Expected: PASS — 2 scenarios (Saturno 2011, Pozzetto 2013), all steps green. tsc exit 0.

If `import.meta.url` throws, switch `featuresDir` to `resolve(process.cwd(), "tools/gen/specs/features")` and re-run.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tools/gen/specs/steps.ts apps/web/tools/gen/specs/features/reconciliation.feature apps/web/tools/gen/specs/specs.test.ts
git commit -m "feat(web/specs): reconciliation feature + entry wiring (end-to-end green)"
```

---

### Task 6: Double-entry feature

**Files:**
- Create: `apps/web/tools/gen/specs/features/double-entry.feature`
- Modify: `apps/web/tools/gen/specs/steps.ts` (append the new steps)

- [ ] **Step 1: Write the feature**

```gherkin
# apps/web/tools/gen/specs/features/double-entry.feature
Feature: Double-entry ledger parity

  Scenario Outline: every transaction balances and the tree ties to the flat sum
    Given the legacy data for period "<period>"
    When the new app projects the ledger
    Then every projected transaction balances (dare equals avere)
    And the account tree root saldo is zero
    And the account tree saldo equals the raw sum of entries

    Examples:
      | period        |
      | Saturno 2011  |
      | Pozzetto 2013 |
```

- [ ] **Step 2: Append step definitions to `steps.ts`**

```ts
// append to apps/web/tools/gen/specs/steps.ts
import { When } from "./gherkin/run.ts";
import { projectAccounts, projectTransactions } from "../project/accounting.ts";
import type { LedgerAccountRow, LedgerTxnRow } from "@cl/application";

When(/^the new app projects the ledger$/, (world) => {
  const w = world as SpecWorld;
  w.accounts = projectAccounts(w.db, w.legacyPeriodId!);
  w.txns = projectTransactions(w.db, w.legacyPeriodId!);
});

Then(/^every projected transaction balances \(dare equals avere\)$/, (world) => {
  const txns = (world as SpecWorld).txns as LedgerTxnRow[];
  for (const t of txns) expect(t.dare.cents).toBe(t.avere.cents);
});

Then(/^the account tree root saldo is zero$/, (world) => {
  const accounts = (world as SpecWorld).accounts as LedgerAccountRow[];
  const rootSaldo = accounts.reduce((s, a) => s + a.saldo.cents, 0);
  expect(Math.abs(rootSaldo)).toBeLessThanOrEqual(1);
});

Then(/^the account tree saldo equals the raw sum of entries$/, (world) => {
  const w = world as SpecWorld;
  const accounts = w.accounts as LedgerAccountRow[];
  const treeSaldo = accounts.reduce((s, a) => s + a.saldo.cents, 0);
  expect(treeSaldo).toBe(rawTrialBalanceCents(w.db, w.legacyPeriodId!));
});
```

(Hoist all `import` lines to the top of `steps.ts` — TypeScript requires imports at module top level; appending is logical, not literal mid-file.)

- [ ] **Step 3: Run to verify green**

Run: `cd apps/web && pnpm exec vitest run tools/gen/specs/specs.test.ts`
Expected: PASS — double-entry scenarios green for both periods. tsc exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/tools/gen/specs/features/double-entry.feature apps/web/tools/gen/specs/steps.ts
git commit -m "feat(web/specs): double-entry parity feature (balanced txns, tree ties to raw sum)"
```

---

### Task 7: Riparto feature (headline parity)

**Files:**
- Create: `apps/web/tools/gen/specs/features/riparto.feature`
- Modify: `apps/web/tools/gen/specs/steps.ts`

**Headline:** the new riparto engine's per-resident **preventivo** equals the legacy
`estimateDistribution` postings per resident. Plus the tie-out invariant.

- [ ] **Step 1: Empirically verify the headline oracle on real data (probe), then write the feature**

Before asserting strict equality, confirm engine-estimate ≈ legacy estimateDistribution per resident. Write a THROWAWAY vitest test (delete after) that, for period "36", builds the engine, sums `perResidentAmount(col.legacyAccountId, "estimate", unitId)` across columns and units into a Map<residentId, cents>, and compares to `estimateDistributionByResident(db,"36")`. Report: number of residents, total gap, max per-resident gap.
- If the per-resident totals match within rounding (a few cents each), the feature asserts equality with a documented tolerance.
- If they diverge materially, DO NOT assert equality: keep the tie-out invariant (Σ engine estimate == Σ estimateDistribution within rounding) as the parity claim, add a `# NOTE:` comment in the feature recording the divergence, and report it for follow-up (the spec flagged this as a risk).
Delete the probe; record the finding in the commit message.

Feature (assumes the per-resident match holds; if not, replace the per-resident scenario with the Σ-only one per the probe):

```gherkin
# apps/web/tools/gen/specs/features/riparto.feature
Feature: Riparto (distribution) parity

  Scenario Outline: estimate distribution conserves the expense total (tie-out)
    Given the legacy data for period "<period>"
    When the new app computes the riparto matrices
    Then the estimate matrix total equals the sum of linked expense estimates
    And the current matrix total equals the sum of linked expense actuals

    Examples:
      | period        |
      | Saturno 2011  |
      | Pozzetto 2013 |

  Scenario: per-resident preventivo matches the legacy estimateDistribution postings
    Given the legacy data for period "Pozzetto 2013"
    When the new app computes per-resident preventivo from the riparto engine
    Then it equals the legacy estimateDistribution posting for each resident
```

- [ ] **Step 2: Append step definitions**

```ts
// append to steps.ts (imports hoisted to top)
import { projectDistribution } from "../project/distribution.ts";
import { buildRiparto } from "../project/riparto.ts";
import { estimateDistributionByResident } from "./oracle.ts";

function sumMatrix(rows: { total: { cents: number } }[]): number {
  // group row is rows[0]; its total is the matrix total
  return rows.length ? rows[0]!.total.cents : 0;
}

When(/^the new app computes the riparto matrices$/, (world) => {
  const w = world as SpecWorld;
  w.dist = projectDistribution(w.db, w.legacyPeriodId!);
});

Then(/^the estimate matrix total equals the sum of linked expense estimates$/, (world) => {
  const w = world as SpecWorld;
  const dist = w.dist as ReturnType<typeof projectDistribution>;
  const eng = buildRiparto(w.db, w.legacyPeriodId!);
  const src = eng.columns.reduce((s, c) => s + eng.subtree(c.legacyAccountId).estimateCents, 0);
  const matrix = sumMatrix(dist.estimate.rows);
  expect(Math.abs(matrix - src)).toBeLessThanOrEqual(eng.columns.length * eng.unitLegacyIds.length);
});

Then(/^the current matrix total equals the sum of linked expense actuals$/, (world) => {
  const w = world as SpecWorld;
  const dist = w.dist as ReturnType<typeof projectDistribution>;
  const eng = buildRiparto(w.db, w.legacyPeriodId!);
  const src = eng.columns.reduce((s, c) => s + eng.subtree(c.legacyAccountId).actualCents, 0);
  const matrix = sumMatrix(dist.current.rows);
  expect(Math.abs(matrix - src)).toBeLessThanOrEqual(eng.columns.length * eng.unitLegacyIds.length);
});

When(/^the new app computes per-resident preventivo from the riparto engine$/, (world) => {
  const w = world as SpecWorld;
  const eng = buildRiparto(w.db, w.legacyPeriodId!);
  const byResident = new Map<string, number>();
  for (const unitId of eng.unitLegacyIds) {
    for (const col of eng.columns) {
      for (const [ur, cents] of eng.perResidentAmount(col.legacyAccountId, "estimate", unitId)) {
        byResident.set(ur, (byResident.get(ur) ?? 0) + cents);
      }
    }
  }
  w.enginePreventivo = byResident;
});

Then(/^it equals the legacy estimateDistribution posting for each resident$/, (world) => {
  const w = world as SpecWorld;
  const engine = w.enginePreventivo as Map<string, number>;
  const legacy = estimateDistributionByResident(w.db, w.legacyPeriodId!);
  // Compare on the union of resident ids; tolerate per-resident cent rounding.
  const ids = new Set<string>([...engine.keys(), ...legacy.keys()]);
  for (const id of ids) {
    expect(Math.abs((engine.get(id) ?? 0) - (legacy.get(id) ?? 0))).toBeLessThanOrEqual(2);
  }
});
```

Add to `SpecWorld` usage: the world carries `dist` and `enginePreventivo` (they are `[k: string]: unknown`, so no type change needed — cast at the use site as shown).

- [ ] **Step 3: Run to verify green (or fall back to Σ-only per the probe)**

Run: `cd apps/web && pnpm exec vitest run tools/gen/specs/specs.test.ts`
Expected: PASS. If the per-resident scenario fails because of `closingBalance`/estimateDistribution semantics discovered in Step 1, replace it with a Σ-total scenario (`Σ engine estimate == Σ legacy estimateDistribution within rounding`) and note the divergence in the feature + commit message.

- [ ] **Step 4: Commit**

```bash
git add apps/web/tools/gen/specs/features/riparto.feature apps/web/tools/gen/specs/steps.ts
git commit -m "feat(web/specs): riparto parity — tie-out + per-resident preventivo vs legacy estimateDistribution"
```

---

### Task 8: Installments feature

**Files:**
- Create: `apps/web/tools/gen/specs/features/installments.feature`
- Modify: `apps/web/tools/gen/specs/steps.ts`

- [ ] **Step 1: Write the feature**

```gherkin
# apps/web/tools/gen/specs/features/installments.feature
Feature: Installments parity

  Scenario Outline: the installment plan reproduces the legacy installmentItem amounts
    Given the legacy data for period "<period>"
    When the new app projects the installments
    Then the installments group total equals the sum of legacy installmentItem amounts

    Examples:
      | period        |
      | Saturno 2011  |
      | Pozzetto 2013 |
```

- [ ] **Step 2: Append step definitions**

```ts
// append to steps.ts (imports hoisted)
import { projectInstallments } from "../project/installments.ts";
import { installmentItemTotalCents } from "./oracle.ts";
import type { InstallmentRow } from "@cl/application";

When(/^the new app projects the installments$/, (world) => {
  const w = world as SpecWorld;
  w.installments = projectInstallments(w.db, w.legacyPeriodId!);
});

Then(/^the installments group total equals the sum of legacy installmentItem amounts$/, (world) => {
  const w = world as SpecWorld;
  const inst = w.installments as ReturnType<typeof projectInstallments>;
  const group = inst.rows[0] as InstallmentRow | undefined;
  const projected = group ? group.totPreventivo.cents : 0;
  expect(projected).toBe(installmentItemTotalCents(w.db, w.legacyPeriodId!));
});
```

- [ ] **Step 3: Run to verify green**

Run: `cd apps/web && pnpm exec vitest run tools/gen/specs/specs.test.ts`
Expected: PASS — group `totPreventivo` equals Σ `installmentItem.amount` for both periods. tsc exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/tools/gen/specs/features/installments.feature apps/web/tools/gen/specs/steps.ts
git commit -m "feat(web/specs): installments parity (group total vs legacy installmentItem sum)"
```

---

### Task 9: Units-money feature

**Files:**
- Create: `apps/web/tools/gen/specs/features/units-money.feature`
- Modify: `apps/web/tools/gen/specs/steps.ts`

- [ ] **Step 1: Write the feature**

```gherkin
# apps/web/tools/gen/specs/features/units-money.feature
Feature: Per-resident units money parity

  Scenario Outline: resident saldoPrec reproduces the legacy startingBalance
    Given the legacy data for period "<period>"
    When the new app projects the units tree
    Then each resident saldoPrec equals the legacy unitResident startingBalance
    And the group saldoPrec equals the sum of resident saldoPrec

    Examples:
      | period        |
      | Saturno 2011  |
      | Pozzetto 2013 |
```

- [ ] **Step 2: Append step definitions**

```ts
// append to steps.ts (imports hoisted)
import { projectUnits } from "../project/units.ts";
import { startingBalanceByResident } from "./oracle.ts";
import type { UnitRow } from "@cl/application";

When(/^the new app projects the units tree$/, (world) => {
  const w = world as SpecWorld;
  w.units = projectUnits(w.db, w.legacyPeriodId!);
});

// resident rows have id `r<legacyUnitResidentId>`; map back to compare with the oracle.
function residentRows(rows: UnitRow[]): UnitRow[] {
  const out: UnitRow[] = [];
  const walk = (r: UnitRow) => { if (r.kind === "resident") out.push(r); (r.children ?? []).forEach(walk); };
  rows.forEach(walk);
  return out;
}

Then(/^each resident saldoPrec equals the legacy unitResident startingBalance$/, (world) => {
  const w = world as SpecWorld;
  const residents = residentRows(w.units as UnitRow[]);
  const legacy = startingBalanceByResident(w.db, w.legacyPeriodId!);
  expect(residents.length).toBeGreaterThan(0);
  for (const r of residents) {
    const legacyId = r.id.replace(/^r/, "");
    expect(r.saldoPrec.cents).toBe(legacy.get(legacyId) ?? 0);
  }
});

Then(/^the group saldoPrec equals the sum of resident saldoPrec$/, (world) => {
  const rows = (world as SpecWorld).units as UnitRow[];
  const group = rows[0]!;
  const sum = residentRows(rows).reduce((s, r) => s + r.saldoPrec.cents, 0);
  expect(group.saldoPrec.cents).toBe(sum);
});
```

- [ ] **Step 3: Run to verify green**

Run: `cd apps/web && pnpm exec vitest run tools/gen/specs/specs.test.ts`
Expected: PASS. (If a resident-row `id` prefix differs from `r<id>`, adjust the `replace` to match `projectUnits`' actual id scheme — confirm by reading `project/units.ts`.) tsc exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/tools/gen/specs/features/units-money.feature apps/web/tools/gen/specs/steps.ts
git commit -m "feat(web/specs): units-money parity (saldoPrec vs legacy startingBalance + rollup)"
```

---

### Task 10: Anagrafiche & structure feature

**Files:**
- Create: `apps/web/tools/gen/specs/features/anagrafiche-structure.feature`
- Modify: `apps/web/tools/gen/specs/steps.ts`

- [ ] **Step 1: Write the feature**

```gherkin
# apps/web/tools/gen/specs/features/anagrafiche-structure.feature
Feature: Anagrafiche and structure projection parity

  Scenario: the registry projects every categorised party with a known category
    Given the legacy data
    When the new app projects the anagrafiche
    Then every anagrafica has a category present in the category registry
    And the registry has at least 100 parties

  Scenario: the building tree contains exactly the real condominiums
    Given the legacy data
    When the new app projects the condominium tree
    Then the tree contains the building "Pozzetto" with a null legacy code rendered blank
    And the tree contains the super-condominium "Sole"
    And the tree excludes any building whose name contains "test"
```

- [ ] **Step 2: Append step definitions**

```ts
// append to steps.ts (imports hoisted)
import { projectAnagrafiche, projectCategories } from "../project/anagrafiche.ts";
import { projectTree } from "../project/structure.ts";
import type { Anagrafica, CondominiumNode } from "@cl/application";

Given(/^the legacy data$/, () => {
  // no-op: world already holds the db; periodId not needed for studio-wide projections
});

When(/^the new app projects the anagrafiche$/, (world) => {
  const w = world as SpecWorld;
  w.anagrafiche = projectAnagrafiche(w.db);
  w.categories = projectCategories(w.db);
});

Then(/^every anagrafica has a category present in the category registry$/, (world) => {
  const w = world as SpecWorld;
  const cats = new Set(w.categories as string[]);
  for (const a of w.anagrafiche as Anagrafica[]) expect(cats.has(a.categoria)).toBe(true);
});

Then(/^the registry has at least (\d+) parties$/, (world, n) => {
  expect((world as SpecWorld).anagrafiche as Anagrafica[]).toHaveProperty("length");
  expect(((world as SpecWorld).anagrafiche as Anagrafica[]).length).toBeGreaterThanOrEqual(Number(n));
});

When(/^the new app projects the condominium tree$/, (world) => {
  const w = world as SpecWorld;
  w.tree = projectTree(w.db);
});

Then(/^the tree contains the building "([^"]+)" with a null legacy code rendered blank$/, (world, name) => {
  const tree = (world as SpecWorld).tree as CondominiumNode[];
  const node = tree.find((c) => c.name === name);
  expect(node).toBeDefined();
  expect(node!.code).toBe("");
});

Then(/^the tree contains the super-condominium "([^"]+)"$/, (world, name) => {
  const tree = (world as SpecWorld).tree as CondominiumNode[];
  const node = tree.find((c) => c.name === name);
  expect(node).toBeDefined();
  expect(node!.type).toBe("super");
});

Then(/^the tree excludes any building whose name contains "([^"]+)"$/, (world, needle) => {
  const tree = (world as SpecWorld).tree as CondominiumNode[];
  expect(tree.some((c) => c.name.toLowerCase().includes(needle.toLowerCase()))).toBe(false);
});
```

- [ ] **Step 3: Run to verify green**

Run: `cd apps/web && pnpm exec vitest run tools/gen/specs/specs.test.ts`
Expected: PASS — registry ≥100 (113) all categorised; tree has Pozzetto (code ""), Sole (super), no "test" building. tsc exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/tools/gen/specs/features/anagrafiche-structure.feature apps/web/tools/gen/specs/steps.ts
git commit -m "feat(web/specs): anagrafiche + structure projection parity"
```

---

### Task 11: `spec` script, docs, and final whole-suite verification

**Files:**
- Modify: `apps/web/package.json` (add a `spec` script)
- Modify: `docs/domain/README.md` (link the parity specs)
- Test: full suite

- [ ] **Step 1: Add a convenience script**

In `apps/web/package.json` scripts, add:
```json
"spec": "vitest run tools/gen/specs"
```

- [ ] **Step 2: Document the specs**

Append to `docs/domain/README.md` (under Contents or a new "Parity specs" line):
> **Parity specs** — `apps/web/tools/gen/specs/features/*.feature` are executable Gherkin
> acceptance specs proving the new accounting projections reproduce the legacy dump (the
> oracle). Run with `pnpm --filter @cl/web spec`. Design:
> `docs/superpowers/specs/2026-06-14-accounting-parity-specs-design.md`.

- [ ] **Step 3: Full verification**

Run:
```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
pnpm --filter @cl/web exec tsc -p tools/tsconfig.json --noEmit
pnpm --filter @cl/web spec
pnpm --filter @cl/web test
```
Expected: tools tsc exit 0; the spec suite green (all features, both periods); the full web suite still green (the specs are additive, no existing test changed).

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json docs/domain/README.md
git commit -m "chore(web/specs): add spec script + document the parity specs"
```

---

## Self-review checklist (completed)

**Spec coverage:** Gherkin adapter (Tasks 1–2) ✓; dump-as-oracle World + independent oracles (Tasks 3–4) ✓; reconciliation invariants (Task 5) ✓; double-entry tie-to-raw-sum (Task 6) ✓; riparto tie-out + headline per-resident-preventivo-vs-estimateDistribution with the flagged empirical check (Task 7) ✓; installments vs legacy installmentItem (Task 8) ✓; units saldoPrec vs legacy startingBalance (Task 9) ✓; anagrafiche/structure projection incl. the Pozzetto-null-code & Sole-super selection rules (Task 10) ✓; script + docs + additive-suite verification (Task 11) ✓. Vitest-under-existing-runner ✓; `.feature` neutral/swappable ✓.

**Type consistency:** `defineStep`/`Given`/`When`/`Then`/`And`/`resetSteps`/`runStep`/`runFeatureFiles` (run.ts) used consistently; `parseFeature`/`Feature`/`Scenario`/`Step` (parse.ts); `legacyDb`/`makeWorld`/`resolvePeriod`/`SpecWorld` (world.ts); oracle names (`rawTrialBalanceCents`, `entryCount`, `estimateDistributionByResident`, `startingBalanceByResident`, `installmentItemTotalCents`) match across tasks; projection signatures match the confirmed generator APIs; `periodId` is always the legacy id; resident-row id scheme (`r<id>`) is flagged for confirmation in Task 9.

**Known checks during execution (not placeholders — explicit):** the riparto per-resident equivalence (Task 7 Step 1 probe — fall back to Σ-only if `closingBalance`/estimateDistribution semantics diverge); the `import.meta.url` features-dir locate (Task 5 Step 3 — cwd fallback documented); the `projectUnits` resident-row id prefix (Task 9 Step 3 — confirm against source).
