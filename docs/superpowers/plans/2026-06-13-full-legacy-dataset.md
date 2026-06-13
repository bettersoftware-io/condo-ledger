# Full Legacy Dataset → Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the prototype's hand-written sample fixtures with the complete, real dataset projected from `old/db/it-jtime-condominium.all.sql`, reproducing the double-entry accounting faithfully and shipping a building's books only when its period reconciles.

**Architecture:** An offline Node generator (run via `tsx`) reuses `@cl/db`'s pure SQL parser to read the dump, projects rows into the app's existing DTOs, gates each accounting period on a zero trial balance, and emits a committed `apps/web/src/mock/data.generated.json`. `MockStore` gains an injected-seed constructor; the running app seeds from the generated JSON while every existing test keeps the current `fixtures.ts` seed. Ports, runtime streams, recompute layer, and components are unchanged.

**Tech Stack:** TypeScript (ESM), `tsx`, Vitest, RxJS (existing), the `@cl/db` ETL parser (`packages/db/etl/{parse,ddl,transform}.ts`, `packages/db/src/naming.ts`).

**Spec:** `docs/superpowers/specs/2026-06-13-full-legacy-dataset-design.md`

---

## Shared conventions (read first)

**Money.** `Money = { cents: number }` (`@cl/domain`). Legacy decimals are strings like `'500.00'`, `'-44.20'`. Convert with `money(parseFloat(s))` from `@cl/domain` (half-away-from-zero rounding). A JS object `{cents}` serializes to JSON as `{"cents":-44020}` and structurally **is** a `Money`, so the loader needs no rehydration — just a cast. Use `fromCents(int)` when you already have integer cents (it validates integer-ness; good for catching bugs).

**Dump facts (verified).**
- One studio (`studioId='1'`). `condominium` has 11 rows; real buildings: Saturno(1), Mercurio(5), Marte(6), Nettuno(10), Plutone(11), Sole(13), Giove(15), Luna(18), Pozzetto(19). Junk to exclude: `Pozzetto 2`(20), `Pozzetto x test`(21), and `code IS NULL` test rows; also exclude any condominium with **0 units across all its periods**.
- `ledgerEntry.amount` is a single **signed** decimal; a transaction's entries net to zero. Per posting account: `dare=Σ max(0,amount)`, `avere=Σ -min(0,amount)`, `saldo=Σ amount`. Accounts tree via `parentLedgerAccountId`; `ledgerAccount.name` is on the row.
- Per-unit amounts come from `ledgerEntry.unitResidentId` + `ledgerEntry.type ∈ {startingBalance, individualExpense, unitResidentTakings}`. The side table `ledgerEntry2URDistribution` is **empty** — ignore it.
- `unitResident.startingBalance` (decimal string) is the stored opening balance per resident.
- Only periods **1 (Saturno 2011)** and **36 (Pozzetto 2013)** have posted entries; both reconcile to `0.00`. Other periods have units/residents (and sometimes a chart of accounts) but no posted books → their accounting views are empty.

**Exact column orders** (positional; the generator gets these by NAME after `makeTransform`, but they're listed so you can sanity-check):
- `condominium`: id, parentCondominiumId, studioId, name, code, status, type, address, taxCode, vatNumber, manufacturedDate, landRegistry, bankAccountId, notes, created, lastModified
- `accountingPeriod`: id, studioId, condominiumId, name, type, status, startDate, endDate, supplierAccountsPayableLedgerAccountId, flatResidentAccountsReceivableLedgerAccountId, flatResidentRoundingOffLedgerAccountId, individualExpensesLedgerAccountId, defaultCheckingAccountLedgerAccountId, paymentInCashLedgerAccountId, withholdingTaxPenaltyLedgerAccountId, notes, created, lastModified
- `unit`: id, studioId, accountingPeriodId, unitTypeId, unitGroupId, code, name, floor, innerNumber, subordinateNumber, periodRestrictionStartDate, periodRestrictionEndDate, landRegistry, notes, created, lastModified
- `unitPeriod`: id, studioId, unitId, unitOwnershipScenarioId, periodRestrictionStartDate, periodRestrictionEndDate, created, lastModified
- `unitResident`: id, studioId, unitPeriodId, masterDataId, systemUsername, unitResidentPriorityId, periodRestrictionStartDate, periodRestrictionEndDate, percentage, startingBalance, startingBalanceLedgerEntryId, created, lastModified
- `unitResidentRole`: id, countryIso3166_1_a2, unitOwnershipScenarioId, unitResidentPriorityId, abbreviation, name, pluralName, notes, created, lastModified
- `unitGroup`: id, studioId, parentUnitGroupId, accountingPeriodId, code, name, address, notes, created, lastModified
- `person`: masterDataId, firstName, middleName, lastName, sex, birthDate, birthPlace, citizenshipIso3166_1_a2, officeAddress, permanentAddress, currentAddress, occupation, created, lastModified
- `company`: masterDataId, name, registeredOfficeAddress, taxPurposeAddress, created, lastModified
- `masterData`: id, studioId, validFromDate, code, status, taxCode, vatNumber, masterDataCategoryId, postalAddress, preferredLocaleCode, qualificationId, bankAccountId, notes, variationNotes, created, createdMasterDataId, lastModified, lastModifiedMasterDataId
- `masterDataCategory`: id, studioId, name, code, order, created, lastModified
- `masterDataCategoryI18n`: masterDataCategoryId, localeCode, translation, created, lastModified
- `ledgerAccount`: id, studioId, accountingPeriodId, name, abbreviation, description, type, order, parentLedgerAccountId, defaultCounterAccountId, defaultCounterAccountMasterDataId, kind, periodRestrictionStartDate, periodRestrictionEndDate, balanceHardLowerLimit, balanceHardUpperLimit, balanceSoftLowerLimit, balanceSoftUpperLimit, notes, created, lastModified
- `ledgerTransaction`: id, studioId, accountingPeriodId, code, type, ledgerInvoiceId, timestamp, description, created, lastModified
- `ledgerEntry`: id, studioId, ledgerTransactionId, postingAccountId, masterDataId, unitResidentId, installmentItemId, ledgerInvoiceId, amount, order, type, created, lastModified
- `expenseLedgerAccount`: ledgerAccountId, restrictionUnitGroupId, estimate, useDistinctTablesForEstimate, costAttributionOnHandover, nextPeriodEstimateBasedOn, nextPeriodEstimateIncreasePercentage, nextPeriodEstimateIncreaseFixedAmount, taxReliefId, created, lastModified
- `expenseLA2Table`: id, studioId, expenseLedgerAccountId, distributionTableId, type, percentage, created, lastModified
- `expenseLA2Role`: expenseLA2TableId, unitResidentPriorityId, studioId, percentage, created, lastModified
- `distributionTable`: id, studioId, accountingPeriodId, name, order, restrictionUnitGroupId, consumptionMeterId, notes, created, lastModified
- `distributionTableItem`: distributionTableId, unitId, studioId, coefficient, created, lastModified
- `installment`: id, studioId, accountingPeriodId, installmentGroupId, type, name, expiryDate, percentage, previousBalancePercentage, locked, roundedUpToInteger, notes, created, lastModified
- `installmentItem`: id, installmentId, unitResidentId, amount, status, created, lastModified
- `calendarLayer`: id, name, description, color, order, created, lastModified
- `calendarEvent`: id, studioId, layerId, date, ignoreTime, description, priority, status, data, dataType, dataKey, notes, created, lastModified
- `condominiumCalendarEvent`: calendarEventId, condominiumId, accountingPeriodId, unitGroupId, unitId, unitResidentId, masterDataId, showOnFrontend, showDate, showFrom, showTo, created, lastModified
- `f24`: id, condominiumId, referenceDate, paymentDate, confirmed, created, lastModified
- `condominiumSupplier`: condominiumId, masterDataId, order, created, lastModified

**Enums:** `ledgerEntry.type ∈ {startingBalance, individualExpense, unitResidentTakings}`; `ledgerAccount.type ∈ {regular, grouping, control, controlUnitResident}`; `ledgerAccount.kind ∈ {assets, liabilities, assetsOrLiabilities, income, expenses}`; `installmentItem.status ∈ {issued, incomplete, settled, neutralized}`; `accountingPeriod.type ∈ {ordinary, ...}`.

**Running the generator:** `cd apps/web && pnpm tsx tools/gen/generate-data.ts` (added as `gen:data` script in Task 14). **Tests:** `pnpm --filter @cl/web exec vitest run <path>`. Generator code lives in `apps/web/tools/gen/` with its own `tsconfig.json`; Vitest's default include picks up `tools/**/*.test.ts`.

**ID convention in generated output:** prefix legacy numeric ids by entity to avoid collisions and stay readable: condominium `c<ID>`, period `p<ID>`, unit `u<ID>`, resident `r<ID>`, account `la<ID>`, transaction `tx<ID>`, table `dt<ID>`, installment `inst<ID>`, anagrafica `md<ID>`, calendar `ev<ID>`, supplier `sup<condId>-<mdId>`. Use a single helper `eid(prefix, legacyId)`.

---

### Task 1: Generator scaffold + dump row loader (reuse @cl/db parser)

**Files:**
- Create: `apps/web/tools/gen/loadRows.ts`
- Create: `apps/web/tools/tsconfig.json`
- Create: `apps/web/tools/gen/loadRows.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tools/gen/loadRows.test.ts
import { describe, it, expect } from "vitest";
import { parseTables } from "./loadRows.ts";

const SQL = `
CREATE TABLE \`thing\` (
  \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
  \`label\` varchar(63) NOT NULL,
  \`amount\` decimal(10,2) DEFAULT NULL,
  \`flag\` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
INSERT INTO \`thing\` VALUES ('1', 'A', '12.50', '1'), ('2', 'B', null, '0');
`;

describe("parseTables", () => {
  it("returns DDL-named, type-coerced rows keyed by table", () => {
    const t = parseTables(SQL);
    expect(t.thing).toHaveLength(2);
    expect(t.thing[0]).toMatchObject({ id: "1", label: "A", flag: true });
    expect(t.thing[1]!.amount).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm exec vitest run tools/gen/loadRows.test.ts`
Expected: FAIL — cannot find `./loadRows.ts`.

- [ ] **Step 3: Create the tools tsconfig**

```jsonc
// apps/web/tools/tsconfig.json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["**/*.ts"]
}
```

- [ ] **Step 4: Implement the loader**

The `@cl/db` ETL parser lives at `packages/db/etl/`. From `apps/web/tools/gen/` the relative path to the repo root is `../../../../`. Import the three pure helpers (they use `.ts` extensions and run fine under `tsx`/Vitest esbuild):

```ts
// apps/web/tools/gen/loadRows.ts
import { parseDdl, tableColumns } from "../../../../packages/db/etl/ddl.ts";
import { parseInserts } from "../../../../packages/db/etl/parse.ts";
import { makeTransform, type TransformValue } from "../../../../packages/db/etl/transform.ts";

export type Row = Record<string, TransformValue>;
export type Tables = Record<string, Row[]>;

/**
 * Parse a self-contained mysqldump (DDL + column-less data INSERTs) into
 * DDL-named, type-coerced row objects keyed by table name. Reuses the @cl/db
 * ETL: parseDdl supplies column order, makeTransform coerces + renames.
 *
 * NOTE: @cl/db's makeTransform renames columns to snake_case schema names. We
 * want the LEGACY camelCase names here (the projection code references them),
 * so we build rows directly from DDL column names + classify/coerce, bypassing
 * the snake_case rename. We therefore re-coerce using the DDL types.
 */
export function parseTables(sql: string): Tables {
  const ddl = parseDdl(sql);
  const resolve = (table: string) => tableColumns(ddl, table);
  const stmts = parseInserts(sql, resolve);
  // Coerce values by DDL type but keep camelCase names. We reuse makeTransform's
  // value coercion by feeding it single-column "tables" is awkward; instead use
  // a local coercer mirroring @cl/db's rules (bool for tinyint(1), pass-through
  // otherwise — numbers stay strings; the projection parses what it needs).
  const out: Tables = {};
  for (const s of stmts) {
    const cols = s.columns;
    const types = new Map((ddl[s.table] ?? []).map((c) => [c.name, c.sqlType]));
    const rows = s.rows.map((tuple) => {
      const r: Row = {};
      for (let i = 0; i < cols.length; i++) {
        const name = cols[i]!;
        const raw = tuple[i] ?? null;
        const sqlType = types.get(name) ?? "";
        r[name] = coerce(raw, sqlType);
      }
      return r;
    });
    (out[s.table] ??= []).push(...rows);
  }
  return out;
}

// tinyint(1) -> boolean; everything else stays a raw string|null (numbers and
// decimals are parsed at projection time with Number()/money()). This keeps the
// loader dumb and the projection explicit about units (cents vs coefficient).
function coerce(raw: string | null, sqlType: string): TransformValue {
  if (raw === null) return null;
  if (/^tinyint\(1\)/i.test(sqlType)) return raw === "1";
  return raw;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run tools/gen/loadRows.test.ts`
Expected: PASS (2 assertions).

- [ ] **Step 6: Commit**

```bash
git add apps/web/tools/gen/loadRows.ts apps/web/tools/gen/loadRows.test.ts apps/web/tools/tsconfig.json
git commit -m "feat(web/gen): dump row loader reusing @cl/db SQL parser"
```

---

### Task 2: PHP AddressVO unserializer

**Files:**
- Create: `apps/web/tools/gen/addressVO.ts`
- Create: `apps/web/tools/gen/addressVO.test.ts`

Legacy addresses are PHP custom-serialized: `C:9:"AddressVO":NNN:{a:14:{s:19:"countryIso3166_1_a2";s:2:"IT";s:8:"postCode";s:5:"33100";s:6:"street";s:24:"Piazza del Duomo, 39";...}}`. Some use `streetName`+`streetNumber` instead of `street`. We only need the textual parts.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tools/gen/addressVO.test.ts
import { describe, it, expect } from "vitest";
import { parseAddressVO, formatAddress } from "./addressVO.ts";

const SATURNO = `C:9:"AddressVO":345:{a:14:{s:19:"countryIso3166_1_a2";s:2:"IT";s:8:"postCode";s:5:"33100";s:6:"street";s:24:"Piazza del Duomo, 39";s:8:"cityName";N;s:6:"cityId";i:30129;}}`;
const POZZETTO = `C:9:"AddressVO":477:{a:19:{s:19:"countryIso3166_1_a2";s:2:"IT";s:8:"postCode";s:5:"34071";s:6:"street";N;s:12:"streetNumber";s:2:"12";s:10:"streetName";s:12:"Piazza Libertà";s:8:"cityName";N;}}`;

describe("parseAddressVO", () => {
  it("extracts string fields and ignores N (null) / i: (int)", () => {
    const a = parseAddressVO(SATURNO);
    expect(a).toMatchObject({ postCode: "33100", street: "Piazza del Duomo, 39", countryIso3166_1_a2: "IT" });
    expect(a.cityName).toBeUndefined();
  });
  it("composes streetName + streetNumber when street is null", () => {
    expect(formatAddress(parseAddressVO(POZZETTO))).toBe("Piazza Libertà, 74 — 34071");
  });
  it("formats street + postCode", () => {
    expect(formatAddress(parseAddressVO(SATURNO))).toBe("Piazza del Duomo, 39 — 33100");
  });
  it("returns {} for null/empty/garbage and formats to empty string", () => {
    expect(parseAddressVO(null)).toEqual({});
    expect(formatAddress(parseAddressVO("not-a-vo"))).toBe("");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm exec vitest run tools/gen/addressVO.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/web/tools/gen/addressVO.ts
export interface AddressFields {
  countryIso3166_1_a2?: string;
  postCode?: string;
  street?: string;
  streetName?: string;
  streetNumber?: string;
  cityName?: string;
}

// PHP string-key fields we care about, all encoded as s:LEN:"VALUE". We scan for
// `s:N:"key";s:M:"value";` pairs. `N` (PHP null) and `i:..` (int) values are
// skipped because they're not s:..-encoded, so the regex simply won't match them
// as a value and that key is left undefined.
const WANTED = new Set(["countryIso3166_1_a2", "postCode", "street", "streetName", "streetNumber", "cityName"]);
const PAIR = /s:\d+:"([^"]*)";s:\d+:"([^"]*)";/g;

export function parseAddressVO(blob: string | null): AddressFields {
  const out: AddressFields = {};
  if (!blob || !blob.includes("AddressVO")) return out;
  let m: RegExpExecArray | null;
  PAIR.lastIndex = 0;
  while ((m = PAIR.exec(blob))) {
    const key = m[1]!;
    if (WANTED.has(key)) (out as Record<string, string>)[key] = m[2]!;
  }
  return out;
}

export function formatAddress(a: AddressFields): string {
  const line = a.street ?? [a.streetName, a.streetNumber].filter(Boolean).join(", ");
  const parts = [line.trim(), a.postCode?.trim()].filter((s): s is string => !!s);
  return parts.join(" — ");
}
```

Note: `PAIR` matches consecutive `s:..` pairs. Because keys and values both appear as `s:..` tokens, a key whose value is `N`/`i:..` will instead pair the value-key with the *next* key; to avoid mis-pairing, the implementation above only **keeps** matches whose first capture is a known key — a mis-paired match is discarded. Verify against the test blobs (which include `N` and `i:` values) before moving on.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run tools/gen/addressVO.test.ts`
Expected: PASS (4 assertions). If the `streetName` case mis-pairs, switch to a tolerant key-seeking parser: find each known key literal `s:LEN:"key";`, then read the immediately following token — if it starts with `s:` capture the quoted value, else skip.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tools/gen/addressVO.ts apps/web/tools/gen/addressVO.test.ts
git commit -m "feat(web/gen): PHP AddressVO unserializer + address formatter"
```

---

### Task 3: Money + signed-amount helpers

**Files:**
- Create: `apps/web/tools/gen/amounts.ts`
- Create: `apps/web/tools/gen/amounts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tools/gen/amounts.test.ts
import { describe, it, expect } from "vitest";
import { eur, dareAvereSaldo } from "./amounts.ts";

describe("amounts", () => {
  it("parses legacy decimal strings to integer-cent Money", () => {
    expect(eur("12.50")).toEqual({ cents: 1250 });
    expect(eur("-44.20")).toEqual({ cents: -4420 });
    expect(eur(null)).toEqual({ cents: 0 });
  });
  it("splits signed amounts into dare/avere/saldo (cents)", () => {
    expect(dareAvereSaldo([50000, -20000, -30000])).toEqual({ dare: 50000, avere: 50000, saldo: 0 });
    expect(dareAvereSaldo([12550, -4420])).toEqual({ dare: 12550, avere: 4420, saldo: 8130 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm exec vitest run tools/gen/amounts.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/web/tools/gen/amounts.ts
import { money, type Money } from "@cl/domain";

/** Legacy decimal string (or null) -> Money. null/empty -> 0. */
export function eur(s: string | null | undefined): Money {
  if (s === null || s === undefined || s === "") return { cents: 0 };
  return money(parseFloat(s));
}

/** Signed integer-cent amounts -> dare (Σ positives), avere (Σ |negatives|), saldo (Σ). */
export function dareAvereSaldo(centsList: number[]): { dare: number; avere: number; saldo: number } {
  let dare = 0, avere = 0, saldo = 0;
  for (const c of centsList) {
    if (c > 0) dare += c; else avere += -c;
    saldo += c;
  }
  return { dare, avere, saldo };
}
```

`@cl/web` already depends on `@cl/domain` (workspace), so this import resolves under Vitest.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run tools/gen/amounts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tools/gen/amounts.ts apps/web/tools/gen/amounts.test.ts
git commit -m "feat(web/gen): money parsing + dare/avere/saldo split helpers"
```

---

### Task 4: Index builder + condominium/period selection

**Files:**
- Create: `apps/web/tools/gen/db.ts`
- Create: `apps/web/tools/gen/db.test.ts`

Build typed lookups over the parsed tables and decide which condominiums/periods ship. This is the single source the projections read.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tools/gen/db.test.ts
import { describe, it, expect } from "vitest";
import { buildDb } from "./db.ts";
import type { Tables } from "./loadRows.ts";

const tables: Tables = {
  condominium: [
    { id: "1", code: "SAT", name: "Saturno", status: "active", type: "regular", address: null, taxCode: "TC1", vatNumber: null, parentCondominiumId: null },
    { id: "9", code: null, name: "Pozzetto x test", status: "active", type: "regular", address: null, taxCode: null, vatNumber: null, parentCondominiumId: null },
    { id: "7", code: "EMP", name: "Empty", status: "active", type: "regular", address: null, taxCode: null, vatNumber: null, parentCondominiumId: null },
  ],
  accountingPeriod: [
    { id: "1", condominiumId: "1", name: "2011", type: "ordinary", status: "opened", startDate: "2011-01-01", endDate: "2011-12-31" },
    { id: "9", condominiumId: "9", name: "2012", type: "ordinary", status: "opened", startDate: "2012-01-01", endDate: "2012-12-31" },
    { id: "70", condominiumId: "7", name: "2012", type: "ordinary", status: "opened", startDate: "2012-01-01", endDate: "2012-12-31" },
  ],
  unit: [{ id: "100", accountingPeriodId: "1", code: "A01", name: "Alberi", unitTypeId: "1", unitGroupId: null, floor: "T", innerNumber: "1", subordinateNumber: null, periodRestrictionStartDate: null, periodRestrictionEndDate: null }],
};

describe("buildDb selection", () => {
  it("keeps real condominiums with ≥1 unit, drops test/code-null and empty ones", () => {
    const db = buildDb(tables);
    const ids = db.condominiums.map((c) => c.id);
    expect(ids).toEqual(["1"]); // SAT kept; "Pozzetto x test" (code null) + "Empty" (0 units) dropped
    expect(db.periodsOf("1").map((p) => p.id)).toEqual(["1"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm exec vitest run tools/gen/db.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/web/tools/gen/db.ts
import type { Tables, Row } from "./loadRows.ts";

const T = (tables: Tables, name: string): Row[] => tables[name] ?? [];
const s = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

export interface Db {
  tables: Tables;
  condominiums: Row[];                 // selected, real, populated
  periodsOf(condId: string): Row[];    // selected condominium's periods, by id asc
  rows(name: string): Row[];
  by(name: string, key: string): Map<string, Row>;          // index by a column
  group(name: string, key: string): Map<string, Row[]>;     // group by a column
}

const TEST_NAME = /\btest\b|\bx test\b|\b2$/i;

export function buildDb(tables: Tables): Db {
  const indexCache = new Map<string, Map<string, Row>>();
  const groupCache = new Map<string, Map<string, Row[]>>();

  const by = (name: string, key: string): Map<string, Row> => {
    const ck = `${name}.${key}`;
    let m = indexCache.get(ck);
    if (!m) {
      m = new Map();
      for (const r of T(tables, name)) { const k = s(r[key]); if (k !== null) m.set(k, r); }
      indexCache.set(ck, m);
    }
    return m;
  };
  const group = (name: string, key: string): Map<string, Row[]> => {
    const ck = `${name}.${key}`;
    let m = groupCache.get(ck);
    if (!m) {
      m = new Map();
      for (const r of T(tables, name)) { const k = s(r[key]); if (k === null) continue; (m.get(k) ?? m.set(k, []).get(k)!).push(r); }
      groupCache.set(ck, m);
    }
    return m;
  };

  const periodsByCond = group("accountingPeriod", "condominiumId");
  const unitsByPeriod = group("unit", "accountingPeriodId");

  const periodsOf = (condId: string): Row[] =>
    (periodsByCond.get(condId) ?? []).slice().sort((a, b) => Number(a.id) - Number(b.id));

  const condHasUnits = (condId: string): boolean =>
    periodsOf(condId).some((p) => (unitsByPeriod.get(String(p.id)) ?? []).length > 0);

  const condominiums = T(tables, "condominium")
    .filter((c) => s(c.code) !== null)                 // drop code-null test rows
    .filter((c) => !TEST_NAME.test(String(c.name)))    // drop "... test", "Pozzetto 2"
    .filter((c) => condHasUnits(String(c.id)))         // drop empty buildings
    .sort((a, b) => Number(a.id) - Number(b.id));

  return { tables, condominiums, periodsOf, rows: (n) => T(tables, n), by, group };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run tools/gen/db.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tools/gen/db.ts apps/web/tools/gen/db.test.ts
git commit -m "feat(web/gen): typed index + real-condominium selection"
```

---

### Task 5: Anagrafiche projection (masterData + person/company + categories)

**Files:**
- Create: `apps/web/tools/gen/project/anagrafiche.ts`
- Create: `apps/web/tools/gen/project/anagrafiche.test.ts`

Target DTO (`Anagrafica` from `@cl/application`): `{ id, kind: "person"|"company", nominativo, categoria, stato: "active"|"archived", codice?, indirizzo?, codiceFiscale?, partitaIva?, nome?, cognome?, sesso?: "m"|"f", dataNascita?, luogoNascita?, professione?, banca?, iban?, note? }`. Categories: `string[]` of distinct category display names.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tools/gen/project/anagrafiche.test.ts
import { describe, it, expect } from "vitest";
import { projectAnagrafiche, projectCategories } from "./anagrafiche.ts";
import { buildDb } from "../db.ts";
import type { Tables } from "../loadRows.ts";

const tables: Tables = {
  masterDataCategory: [{ id: "5", name: "Impresa di pulizie", code: "PUL", order: "1" }],
  masterDataCategoryI18n: [],
  masterData: [
    { id: "10", status: "active", code: "FCLEAN", taxCode: null, vatNumber: "14476590311", masterDataCategoryId: "5", postalAddress: `C:9:"AddressVO":1:{a:1:{s:8:"postCode";s:5:"33100";}}`, notes: null },
    { id: "11", status: "archived", code: "MRO", taxCode: "RSSMRA80A01L483Z", vatNumber: null, masterDataCategoryId: "5", postalAddress: null, notes: "x" },
  ],
  company: [{ masterDataId: "10", name: "Zanon Servizi di Pulizia s.n.c.", registeredOfficeAddress: null, taxPurposeAddress: null }],
  person: [{ masterDataId: "11", firstName: "Tiziano", middleName: null, lastName: "Rossi", sex: "M", birthDate: "1980-01-01", birthPlace: "Udine", occupation: "Operaio", permanentAddress: null, officeAddress: null, currentAddress: null }],
};

describe("projectAnagrafiche", () => {
  const db = buildDb(tables);
  const out = projectAnagrafiche(db);
  it("maps a company", () => {
    const c = out.find((a) => a.id === "md10")!;
    expect(c).toMatchObject({ kind: "company", nominativo: "Zanon Servizi di Pulizia s.n.c.", categoria: "Impresa di pulizie", stato: "active", partitaIva: "14476590311", codice: "FCLEAN" });
    expect(c.indirizzo).toContain("33100");
  });
  it("maps a person with nominativo 'Cognome Nome' and lowercased sesso", () => {
    const p = out.find((a) => a.id === "md11")!;
    expect(p).toMatchObject({ kind: "person", nominativo: "Floreani Tiziano", cognome: "Rossi", nome: "Tiziano", sesso: "m", stato: "archived", codiceFiscale: "RSSMRA80A01L483Z", professione: "Operaio", luogoNascita: "Udine", dataNascita: "1980-01-01" });
  });
  it("category registry is the distinct category names", () => {
    expect(projectCategories(db)).toEqual(["Impresa di pulizie"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm exec vitest run tools/gen/project/anagrafiche.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/web/tools/gen/project/anagrafiche.ts
import type { Anagrafica } from "@cl/application";
import type { Db } from "../db.ts";
import { parseAddressVO, formatAddress } from "../addressVO.ts";

const str = (v: unknown): string | undefined => {
  if (v === null || v === undefined) return undefined;
  const t = String(v).trim();
  return t === "" ? undefined : t;
};

/** Category display name: prefer it-IT i18n translation, else the base name. */
function categoryName(db: Db, categoryId: string | null): string | undefined {
  if (!categoryId) return undefined;
  const base = db.by("masterDataCategory", "id").get(categoryId);
  if (!base) return undefined;
  const i18n = (db.group("masterDataCategoryI18n", "masterDataCategoryId").get(categoryId) ?? [])
    .find((r) => String(r.localeCode).startsWith("it"));
  return str(i18n?.translation) ?? str(base.name);
}

export function projectCategories(db: Db): string[] {
  const names = new Set<string>();
  for (const cat of db.rows("masterDataCategory")) {
    const n = categoryName(db, String(cat.id));
    if (n) names.add(n);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }));
}

export function projectAnagrafiche(db: Db): Anagrafica[] {
  const persons = db.by("person", "masterDataId");
  const companies = db.by("company", "masterDataId");
  const out: Anagrafica[] = [];

  for (const md of db.rows("masterData")) {
    const id = String(md.id);
    const categoria = categoryName(db, str(md.masterDataCategoryId) ?? null);
    if (!categoria) continue; // master-data with no category isn't shown in the registry
    const stato = String(md.status) === "archived" ? "archived" : "active";
    const codice = str(md.code);
    const codiceFiscale = str(md.taxCode);
    const partitaIva = str(md.vatNumber);
    const indirizzo = str(formatAddress(parseAddressVO(str(md.postalAddress) ?? null)));
    const note = str(md.notes);

    const company = companies.get(id);
    const person = persons.get(id);

    if (company) {
      out.push({
        id: `md${id}`, kind: "company", nominativo: String(company.name), categoria, stato,
        codice, indirizzo, codiceFiscale, partitaIva, note,
      });
    } else if (person) {
      const nome = str(person.firstName);
      const cognome = str(person.lastName);
      const sexRaw = str(person.sex)?.toLowerCase();
      out.push({
        id: `md${id}`, kind: "person",
        nominativo: [cognome, nome].filter(Boolean).join(" ") || (codice ?? `Anagrafica ${id}`),
        categoria, stato, codice, indirizzo, codiceFiscale, partitaIva,
        nome, cognome,
        sesso: sexRaw === "m" || sexRaw === "f" ? (sexRaw as "m" | "f") : undefined,
        dataNascita: str(person.birthDate), luogoNascita: str(person.birthPlace),
        professione: str(person.occupation), note,
      });
    }
    // master-data that is neither person nor company (rare) is skipped.
  }
  return out.sort((a, b) => a.nominativo.localeCompare(b.nominativo, "it", { sensitivity: "base" }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run tools/gen/project/anagrafiche.test.ts`
Expected: PASS (3 assertions).

- [ ] **Step 5: Commit**

```bash
git add apps/web/tools/gen/project/anagrafiche.ts apps/web/tools/gen/project/anagrafiche.test.ts
git commit -m "feat(web/gen): anagrafiche + category projection"
```

---

### Task 6: Calendar projection (calendarLayer + calendarEvent + condominium link)

**Files:**
- Create: `apps/web/tools/gen/project/calendar.ts`
- Create: `apps/web/tools/gen/project/calendar.test.ts`

Targets: `CalendarLayer { id, name, color }`; `CalendarEvent { id, date, time?, description, layerId, status: "new"|"closed", priority: "low"|"medium"|"high"|"critical", periodId?, notes? }`. Legacy `calendarEvent.date` is a datetime; `ignoreTime` (bool) decides whether to show a time. Map legacy `status`/`priority` to the DTO's vocab; link to a period via `condominiumCalendarEvent.accountingPeriodId` (→ `p<id>`).

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tools/gen/project/calendar.test.ts
import { describe, it, expect } from "vitest";
import { projectLayers, projectEvents } from "./calendar.ts";
import { buildDb } from "../db.ts";
import type { Tables } from "../loadRows.ts";

const tables: Tables = {
  calendarLayer: [{ id: "1", name: "Scadenze", color: "#c0392b", description: null, order: "1" }],
  calendarEvent: [
    { id: "5", layerId: "1", date: "2011-04-16 00:00:00", ignoreTime: true, description: "F24", priority: "high", status: "new", notes: null, studioId: "1" },
    { id: "6", layerId: "1", date: "2011-04-21 18:00:00", ignoreTime: false, description: "Assemblea", priority: "veryHigh", status: "done", notes: "odg", studioId: "1" },
  ],
  condominiumCalendarEvent: [{ calendarEventId: "6", condominiumId: "1", accountingPeriodId: "1", unitGroupId: null, unitId: null, unitResidentId: null, masterDataId: null }],
};

describe("calendar projection", () => {
  const db = buildDb(tables);
  it("maps layers", () => {
    expect(projectLayers(db)).toEqual([{ id: "lay1", name: "Scadenze", color: "#c0392b" }]);
  });
  it("maps events: date split, status/priority vocab, period link, time when not ignored", () => {
    const ev = projectEvents(db);
    expect(ev.find((e) => e.id === "ev5")).toMatchObject({ date: "2011-04-16", description: "F24", layerId: "lay1", status: "new", priority: "high" });
    expect(ev.find((e) => e.id === "ev5")!.time).toBeUndefined();
    expect(ev.find((e) => e.id === "ev6")).toMatchObject({ date: "2011-04-21", time: "18:00", status: "closed", priority: "critical", periodId: "p1", notes: "odg" });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm exec vitest run tools/gen/project/calendar.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/web/tools/gen/project/calendar.ts
import type { CalendarLayer, CalendarEvent } from "@cl/application";
import type { Db } from "../db.ts";

const PRIORITY: Record<string, CalendarEvent["priority"]> = {
  low: "low", normal: "medium", medium: "medium", high: "high", veryHigh: "critical", critical: "critical",
};
const STATUS: Record<string, CalendarEvent["status"]> = {
  new: "new", open: "new", todo: "new", done: "closed", closed: "closed", completed: "closed",
};

export function projectLayers(db: Db): CalendarLayer[] {
  return db.rows("calendarLayer").map((l) => ({
    id: `lay${l.id}`, name: String(l.name), color: String(l.color ?? "#7f8c8d"),
  }));
}

export function projectEvents(db: Db): CalendarEvent[] {
  const linkByEvent = db.by("condominiumCalendarEvent", "calendarEventId");
  return db.rows("calendarEvent").map((e) => {
    const raw = String(e.date ?? "");
    const [datePart, timePart] = raw.split(" ");
    const link = linkByEvent.get(String(e.id));
    const apId = link && link.accountingPeriodId !== null ? `p${link.accountingPeriodId}` : undefined;
    const ev: CalendarEvent = {
      id: `ev${e.id}`,
      date: datePart ?? raw,
      description: String(e.description ?? ""),
      layerId: `lay${e.layerId}`,
      status: STATUS[String(e.status)] ?? "new",
      priority: PRIORITY[String(e.priority)] ?? "medium",
    };
    if (e.ignoreTime !== true && timePart && timePart !== "00:00:00") ev.time = timePart.slice(0, 5);
    if (apId) ev.periodId = apId;
    const notes = e.notes === null || e.notes === undefined ? undefined : String(e.notes).trim() || undefined;
    if (notes) ev.notes = notes;
    return ev;
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run tools/gen/project/calendar.test.ts`
Expected: PASS. Adjust the `PRIORITY`/`STATUS` maps if the real dump uses other enum spellings (print `SELECT DISTINCT priority,status` equivalents while implementing); unknown values fall back to `medium`/`new`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tools/gen/project/calendar.ts apps/web/tools/gen/project/calendar.test.ts
git commit -m "feat(web/gen): calendar layers + events projection"
```

---

### Task 7: Condominium tree, detail, suppliers, functional accounts, F24

**Files:**
- Create: `apps/web/tools/gen/project/structure.ts`
- Create: `apps/web/tools/gen/project/structure.test.ts`

Targets: `CondominiumNode { id, code, name, type: "regular", periods: AccountingPeriodNode[] }`; `AccountingPeriodNode { id, name, type: "ordinary"|"extraordinary", closed, start, end }`; `CondominiumDetail` (per period); `functionalByPeriod: Record<periodId, Partial<Record<FunctionalRole, Id>>>` where roles map from the `accountingPeriod` columns; `f24sByPeriod`. Period display `name` follows the legacy label `"<year> (Ordinario)"`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tools/gen/project/structure.test.ts
import { describe, it, expect } from "vitest";
import { projectTree, projectDetails, projectFunctional, projectF24 } from "./structure.ts";
import { buildDb } from "../db.ts";
import type { Tables } from "../loadRows.ts";

const tables: Tables = {
  condominium: [{ id: "1", code: "SAT", name: "Saturno", status: "active", type: "regular", address: `C:9:"AddressVO":1:{a:1:{s:8:"postCode";s:5:"33100";s:6:"street";s:5:"via X";}}`, taxCode: "TC", vatNumber: null, parentCondominiumId: null, manufacturedDate: null, landRegistry: null, created: "2011-04-14 11:52:24", lastModified: "2012-12-18 14:41:01" }],
  accountingPeriod: [{ id: "1", condominiumId: "1", name: "2011", type: "ordinary", status: "opened", startDate: "2011-01-01", endDate: "2011-12-31", defaultCheckingAccountLedgerAccountId: "14", supplierAccountsPayableLedgerAccountId: "20", withholdingTaxPenaltyLedgerAccountId: "21", flatResidentAccountsReceivableLedgerAccountId: "22" }],
  unit: [{ id: "100", accountingPeriodId: "1", code: "A01", name: "x", unitTypeId: "1", unitGroupId: null, floor: "T", innerNumber: "1", subordinateNumber: null, periodRestrictionStartDate: null, periodRestrictionEndDate: null }],
  condominiumSupplier: [{ condominiumId: "1", masterDataId: "10", order: "1" }],
  masterData: [{ id: "10", status: "active", code: "FCLEAN", masterDataCategoryId: "5", vatNumber: "x", taxCode: null, postalAddress: null, notes: null }],
  masterDataCategory: [{ id: "5", name: "Impresa di pulizie", code: "PUL", order: "1" }],
  masterDataCategoryI18n: [],
  company: [{ masterDataId: "10", name: "Zanon Servizi di Pulizia" }],
  person: [],
  f24: [{ id: "1", condominiumId: "1", referenceDate: "2011-03-31", paymentDate: "2011-04-16", confirmed: true }],
};

describe("structure projection", () => {
  const db = buildDb(tables);
  it("builds the tree with labelled periods", () => {
    expect(projectTree(db)).toEqual([{
      id: "c1", code: "SAT", name: "Saturno", type: "regular",
      periods: [{ id: "p1", name: "2011 (Ordinario)", type: "ordinary", closed: false, start: "2011-01-01", end: "2011-12-31" }],
    }]);
  });
  it("builds detail with address + suppliers", () => {
    const d = projectDetails(db)["p1"]!;
    expect(d).toMatchObject({ intestazione: "Saturno", codice: "SAT", codiceFiscale: "TC", idSistema: "1" });
    expect(d.indirizzo).toContain("33100");
    expect(d.suppliers).toEqual([{ id: "sup1-10", nominativo: "Zanon Servizi di Pulizia", categoria: "Impresa di pulizie" }]);
  });
  it("maps functional accounts from period columns", () => {
    expect(projectFunctional(db)["p1"]).toEqual({ liquid: "la14", payable: "la20", withholding: "la21", credit: "la22" });
  });
  it("maps f24 with stato from confirmed", () => {
    expect(projectF24(db)["p1"]).toEqual([{ id: "f24-1", descrizione: "Modello F24", scadenza: "2011-04-16", importo: { cents: 0 }, stato: "pagato" }]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm exec vitest run tools/gen/project/structure.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/web/tools/gen/project/structure.ts
import type {
  CondominiumNode, AccountingPeriodNode, CondominiumDetail, SupplierRow, F24Row, FunctionalRole, Id,
} from "@cl/application";
import type { Db } from "../db.ts";
import { parseAddressVO, formatAddress } from "../addressVO.ts";

const str = (v: unknown): string | undefined => (v === null || v === undefined || String(v).trim() === "" ? undefined : String(v).trim());
const periodLabel = (name: string, type: string): string =>
  type === "extraordinary" ? `${name} (Straordinario)` : `${name} (Ordinario)`;

export function projectTree(db: Db): CondominiumNode[] {
  return db.condominiums.map((c) => ({
    id: `c${c.id}`, code: String(c.code), name: String(c.name), type: "regular" as const,
    periods: db.periodsOf(String(c.id)).map((p): AccountingPeriodNode => ({
      id: `p${p.id}`,
      name: periodLabel(String(p.name), String(p.type)),
      type: String(p.type) === "extraordinary" ? "extraordinary" : "ordinary",
      closed: String(p.status) === "closed",
      start: String(p.startDate), end: String(p.endDate),
    })),
  }));
}

function categoryName(db: Db, categoryId: string | null): string | undefined {
  if (!categoryId) return undefined;
  const base = db.by("masterDataCategory", "id").get(categoryId);
  if (!base) return undefined;
  const i18n = (db.group("masterDataCategoryI18n", "masterDataCategoryId").get(categoryId) ?? [])
    .find((r) => String(r.localeCode).startsWith("it"));
  return str(i18n?.translation) ?? str(base.name);
}

function nominativoOf(db: Db, mdId: string): string {
  const company = db.by("company", "masterDataId").get(mdId);
  if (company) return String(company.name);
  const person = db.by("person", "masterDataId").get(mdId);
  if (person) return [str(person.lastName), str(person.firstName)].filter(Boolean).join(" ");
  return `Anagrafica ${mdId}`;
}

export function projectDetails(db: Db): Record<Id, CondominiumDetail> {
  const suppliersByCond = db.group("condominiumSupplier", "condominiumId");
  const mdById = db.by("masterData", "id");
  const out: Record<Id, CondominiumDetail> = {};
  for (const c of db.condominiums) {
    const condId = String(c.id);
    const suppliers: SupplierRow[] = (suppliersByCond.get(condId) ?? [])
      .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
      .map((sup) => {
        const mdId = String(sup.masterDataId);
        const md = mdById.get(mdId);
        return {
          id: `sup${condId}-${mdId}`,
          nominativo: nominativoOf(db, mdId),
          categoria: categoryName(db, md ? (str(md.masterDataCategoryId) ?? null) : null) ?? "—",
        };
      });
    const indirizzo = str(formatAddress(parseAddressVO(str(c.address) ?? null))) ?? "—";
    for (const p of db.periodsOf(condId)) {
      out[`p${p.id}`] = {
        intestazione: String(c.name), codice: String(c.code), status: String(c.status) === "active" ? "active" : "inactive",
        tipo: "Condominio", indirizzo, codiceFiscale: str(c.taxCode) ?? "—",
        dataCostruzione: str(c.manufacturedDate) ?? null, datiCatastali: str(c.landRegistry) ?? null,
        idSistema: condId, creatoIl: str(c.created) ?? "", modificatoIl: str(c.lastModified) ?? "",
        suppliers, publicDocs: [], privateDocs: [],
      };
    }
  }
  return out;
}

const ROLE_COL: Record<FunctionalRole, string> = {
  liquid: "defaultCheckingAccountLedgerAccountId",
  payable: "supplierAccountsPayableLedgerAccountId",
  withholding: "withholdingTaxPenaltyLedgerAccountId",
  credit: "flatResidentAccountsReceivableLedgerAccountId",
};

export function projectFunctional(db: Db): Record<Id, Partial<Record<FunctionalRole, Id>>> {
  const out: Record<Id, Partial<Record<FunctionalRole, Id>>> = {};
  for (const c of db.condominiums) {
    for (const p of db.periodsOf(String(c.id))) {
      const m: Partial<Record<FunctionalRole, Id>> = {};
      for (const role of Object.keys(ROLE_COL) as FunctionalRole[]) {
        const v = str(p[ROLE_COL[role]]);
        if (v) m[role] = `la${v}`;
      }
      out[`p${p.id}`] = m;
    }
  }
  return out;
}

export function projectF24(db: Db): Record<Id, F24Row[]> {
  const byCond = db.group("f24", "condominiumId");
  const out: Record<Id, F24Row[]> = {};
  for (const c of db.condominiums) {
    const rows = byCond.get(String(c.id)) ?? [];
    const mapped: F24Row[] = rows.map((f) => ({
      id: `f24-${f.id}`,
      descrizione: "Modello F24",
      scadenza: str(f.paymentDate) ?? str(f.referenceDate) ?? "",
      importo: { cents: 0 }, // amount is derived from ledgerInvoice2F24/withholdingTax; left 0 (no clean per-row source)
      stato: f.confirmed === true ? "pagato" : "da pagare",
    }));
    // F24 is condominium-scoped in legacy; attach to every period of the condominium.
    for (const p of db.periodsOf(String(c.id))) out[`p${p.id}`] = mapped;
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run tools/gen/project/structure.test.ts`
Expected: PASS (4 assertions).

- [ ] **Step 5: Commit**

```bash
git add apps/web/tools/gen/project/structure.ts apps/web/tools/gen/project/structure.test.ts
git commit -m "feat(web/gen): condominium tree, detail, suppliers, functional accounts, F24"
```

---

### Task 8: Accounting projection (ledger accounts tree + balances + transactions)

**Files:**
- Create: `apps/web/tools/gen/project/accounting.ts`
- Create: `apps/web/tools/gen/project/accounting.test.ts`

Targets: `LedgerAccountRow { id, kind: "grouping"|"regular", label, dare, avere, saldo, preventivo: Money|null, rd?, tabelle?, restriction?, children? }` tree per period; `LedgerTxnRow { id, date, code, description, partita, dare, avere, entries: LedgerTxnEntry[] }[]` per period. Balances aggregate signed `ledgerEntry.amount` per account, rolled up the tree. `preventivo` comes from `expenseLedgerAccount.estimate` (only for expense accounts).

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tools/gen/project/accounting.test.ts
import { describe, it, expect } from "vitest";
import { projectAccounts, projectTransactions } from "./accounting.ts";
import { buildDb } from "../db.ts";
import type { Tables } from "../loadRows.ts";

// account 1 (grouping) > [2 regular bank, 3 regular expense(estimate 200.00)]
const tables: Tables = {
  ledgerAccount: [
    { id: "1", accountingPeriodId: "1", name: "Totale", type: "grouping", parentLedgerAccountId: null, kind: "assetsOrLiabilities", order: "1" },
    { id: "2", accountingPeriodId: "1", name: "Banca", type: "regular", parentLedgerAccountId: "1", kind: "assets", order: "1" },
    { id: "3", accountingPeriodId: "1", name: "Pulizie", type: "regular", parentLedgerAccountId: "1", kind: "expenses", order: "2", periodRestrictionStartDate: null, periodRestrictionEndDate: null },
  ],
  expenseLedgerAccount: [{ ledgerAccountId: "3", estimate: "200.00", restrictionUnitGroupId: null }],
  ledgerTransaction: [{ id: "9", accountingPeriodId: "1", code: "1", type: "checkingAccountDirectPayment", timestamp: "2011-03-13 13:07:00", description: "Bolletta", ledgerInvoiceId: null }],
  ledgerEntry: [
    { id: "21", ledgerTransactionId: "9", postingAccountId: "3", amount: "120.00", order: "1", type: null, unitResidentId: null, masterDataId: null },
    { id: "22", ledgerTransactionId: "9", postingAccountId: "2", amount: "-120.00", order: "2", type: null, unitResidentId: null, masterDataId: null },
  ],
};

describe("accounting projection", () => {
  const db = buildDb(tables);
  it("builds the account tree with rolled-up dare/avere/saldo and expense preventivo", () => {
    const tree = projectAccounts(db, "1");
    const tot = tree[0]!;
    expect(tot).toMatchObject({ id: "la1", kind: "grouping", label: "Totale" });
    expect(tot.dare).toEqual({ cents: 12000 });
    expect(tot.avere).toEqual({ cents: 12000 });
    expect(tot.saldo).toEqual({ cents: 0 });
    const pulizie = tot.children!.find((c) => c.id === "la3")!;
    expect(pulizie.preventivo).toEqual({ cents: 20000 });
    expect(pulizie.saldo).toEqual({ cents: 12000 });
    const banca = tot.children!.find((c) => c.id === "la2")!;
    expect(banca.preventivo).toBeNull();
  });
  it("builds transactions with per-entry dare/avere and a header total", () => {
    const txns = projectTransactions(db, "1");
    expect(txns[0]).toMatchObject({ id: "tx9", code: 1, description: "Bolletta", date: "2011-03-13" });
    expect(txns[0]!.dare).toEqual({ cents: 12000 });
    expect(txns[0]!.entries.map((e) => e.account)).toEqual(["Pulizie", "Banca"]);
    expect(txns[0]!.entries[0]).toMatchObject({ accountId: "la3", dare: { cents: 12000 }, avere: { cents: 0 } });
    expect(txns[0]!.entries[1]).toMatchObject({ accountId: "la2", dare: { cents: 0 }, avere: { cents: 12000 } });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm exec vitest run tools/gen/project/accounting.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/web/tools/gen/project/accounting.ts
import type { LedgerAccountRow, LedgerTxnRow, LedgerTxnEntry } from "@cl/application";
import type { Money } from "@cl/domain";
import type { Db, Db as _Db } from "../db.ts";
import { eur } from "../amounts.ts";

const str = (v: unknown): string | undefined => (v === null || v === undefined || String(v).trim() === "" ? undefined : String(v).trim());
const m = (cents: number): Money => ({ cents });

/** Sum of signed entry cents per postingAccountId, for one period. */
function accountSignedCents(db: Db, periodId: string): Map<string, number> {
  const txInPeriod = new Set(
    db.rows("ledgerTransaction").filter((t) => String(t.accountingPeriodId) === periodId).map((t) => String(t.id)),
  );
  const sums = new Map<string, number>();
  for (const e of db.rows("ledgerEntry")) {
    if (!txInPeriod.has(String(e.ledgerTransactionId))) continue;
    const acct = String(e.postingAccountId);
    sums.set(acct, (sums.get(acct) ?? 0) + eur(str(e.amount) ?? null).cents);
  }
  return sums;
}

export function projectAccounts(db: Db, periodId: string): LedgerAccountRow[] {
  const accounts = db.rows("ledgerAccount").filter((a) => String(a.accountingPeriodId) === periodId);
  const own = accountSignedCents(db, periodId); // own (leaf) signed balance per account
  const estimate = db.by("expenseLedgerAccount", "ledgerAccountId");

  const byId = new Map(accounts.map((a) => [String(a.id), a]));
  const childrenOf = new Map<string, string[]>();
  for (const a of accounts) {
    const parent = str(a.parentLedgerAccountId);
    if (parent && byId.has(parent)) (childrenOf.get(parent) ?? childrenOf.set(parent, []).get(parent)!).push(String(a.id));
  }
  const ordered = (ids: string[]): string[] =>
    ids.slice().sort((x, y) => Number(byId.get(x)!.order ?? 0) - Number(byId.get(y)!.order ?? 0));

  // Build recursively; a grouping's signed balance is the sum of its subtree's own balances.
  function build(id: string): { row: LedgerAccountRow; signed: number } {
    const a = byId.get(id)!;
    const kids = ordered(childrenOf.get(id) ?? []);
    const ownSigned = own.get(id) ?? 0;
    let subtreeSigned = ownSigned;
    const childRows: LedgerAccountRow[] = [];
    for (const k of kids) {
      const built = build(k);
      childRows.push(built.row);
      subtreeSigned += built.signed;
    }
    // dare/avere for a node = its own posted entries (groupings usually have none);
    // saldo = subtree signed sum. For leaves dare/avere come from own entries split.
    const dare = ownSigned > 0 ? ownSigned : 0;
    const avere = ownSigned < 0 ? -ownSigned : 0;
    const est = estimate.get(id);
    const isGrouping = String(a.type) === "grouping" || childRows.length > 0;
    const restriction = restrictionLabel(str(a.periodRestrictionStartDate), str(a.periodRestrictionEndDate));
    const row: LedgerAccountRow = {
      id: `la${id}`,
      kind: isGrouping ? "grouping" : "regular",
      label: String(a.name),
      dare: m(isGrouping ? rollupSide(childRows, "dare", dare) : dare),
      avere: m(isGrouping ? rollupSide(childRows, "avere", avere) : avere),
      saldo: m(subtreeSigned),
      preventivo: est ? eur(str(est.estimate) ?? null) : null,
      ...(restriction ? { restriction } : {}),
      ...(childRows.length ? { children: childRows } : {}),
    };
    return { row, signed: subtreeSigned };
  }

  const roots = ordered(accounts.filter((a) => { const p = str(a.parentLedgerAccountId); return !p || !byId.has(p); }).map((a) => String(a.id)));
  return roots.map((id) => build(id).row);
}

function rollupSide(children: LedgerAccountRow[], side: "dare" | "avere", own: number): number {
  return children.reduce((s, c) => s + c[side].cents, own);
}
function restrictionLabel(start?: string, end?: string): string | undefined {
  if (!start && !end) return undefined;
  const f = (d?: string) => (d ? d.split(" ")[0]!.split("-").reverse().join("/") : "");
  return `${f(start)} - ${f(end)}`;
}

export function projectTransactions(db: Db, periodId: string): LedgerTxnRow[] {
  const txns = db.rows("ledgerTransaction").filter((t) => String(t.accountingPeriodId) === periodId);
  const acctName = new Map(db.rows("ledgerAccount").map((a) => [String(a.id), String(a.name)]));
  const entriesByTx = db.group("ledgerEntry", "ledgerTransactionId");
  return txns
    .sort((a, b) => Number(a.code) - Number(b.code))
    .map((t) => {
      const raw = (entriesByTx.get(String(t.id)) ?? []).slice().sort((x, y) => Number(x.order) - Number(y.order));
      const entries: LedgerTxnEntry[] = raw.map((e) => {
        const cents = eur(str(e.amount) ?? null).cents;
        return {
          accountId: `la${e.postingAccountId}`,
          account: acctName.get(String(e.postingAccountId)) ?? String(e.postingAccountId),
          dare: m(cents > 0 ? cents : 0), avere: m(cents < 0 ? -cents : 0),
        };
      });
      const dare = entries.reduce((s, e) => s + e.dare.cents, 0);
      return {
        id: `tx${t.id}`,
        date: String(t.timestamp ?? "").split(" ")[0] ?? "",
        code: Number(t.code),
        description: String(t.description ?? ""),
        partita: String(t.description ?? "").slice(0, 24),
        dare: m(dare), avere: m(dare), // balanced transaction
        entries,
      };
    });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run tools/gen/project/accounting.test.ts`
Expected: PASS (2 assertions, 12 sub-expectations).

- [ ] **Step 5: Commit**

```bash
git add apps/web/tools/gen/project/accounting.ts apps/web/tools/gen/project/accounting.test.ts
git commit -m "feat(web/gen): ledger account tree (rolled-up balances) + transactions"
```

---

### Task 9: Units projection (tree + per-resident money from ledger)

**Files:**
- Create: `apps/web/tools/gen/project/units.ts`
- Create: `apps/web/tools/gen/project/units.test.ts`

Target `UnitRow` tree per period: a top `group` → `unit` rows → `resident` rows. Money columns per resident:
- `saldoPrec` = `unitResident.startingBalance` (signed).
- `consuntivo` = Σ `ledgerEntry.amount` where `unitResidentId=this` AND `type='individualExpense'`.
- `versato` = `−` Σ `ledgerEntry.amount` where `type='unitResidentTakings'` (takings credit the resident receivable; negate so paid-in shows positive — **verify sign empirically in Step 4**).
- `preventivo` = filled in Task 10 (distribution estimate); here set to `{cents:0}` and let the distribution pass overwrite, OR sum the resident's installmentItem amounts as the budgeted figure. Use **installment sum** as `preventivo` proxy and `totDovuto = saldoPrec + preventivo` (matches the legacy "preventivo + saldo precedente" due figure). Group rows sum their children.

Labels: unit label `"<code> - <resident names>"`; resident label `"<Cognome Nome> (<role abbrev> <percentage>%)"`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tools/gen/project/units.test.ts
import { describe, it, expect } from "vitest";
import { projectUnits } from "./units.ts";
import { buildDb } from "../db.ts";
import type { Tables } from "../loadRows.ts";

const tables: Tables = {
  condominium: [{ id: "1", code: "SAT", name: "Saturno", status: "active", type: "regular", address: null, taxCode: null, vatNumber: null, parentCondominiumId: null }],
  accountingPeriod: [{ id: "1", condominiumId: "1", name: "2011", type: "ordinary", status: "opened", startDate: "2011-01-01", endDate: "2011-12-31" }],
  unitType: [{ id: "1", name: "Appartamento" }], unitTypeI18n: [],
  unit: [{ id: "100", accountingPeriodId: "1", unitTypeId: "1", unitGroupId: null, code: "A01", name: "", floor: "T", innerNumber: "1", subordinateNumber: null, periodRestrictionStartDate: "2011-01-01", periodRestrictionEndDate: "2011-12-31" }],
  unitPeriod: [{ id: "500", unitId: "100", unitOwnershipScenarioId: "1", periodRestrictionStartDate: null, periodRestrictionEndDate: null }],
  unitResidentPriority: [{ id: "1" }],
  unitResidentRole: [{ id: "1", unitOwnershipScenarioId: "1", unitResidentPriorityId: "1", abbreviation: "PR", name: "Proprietario" }],
  unitResident: [{ id: "900", unitPeriodId: "500", masterDataId: "10", unitResidentPriorityId: "1", percentage: "100", startingBalance: "-860.65", periodRestrictionStartDate: null, periodRestrictionEndDate: null }],
  masterData: [{ id: "10", status: "active", masterDataCategoryId: "2", code: null, taxCode: null, vatNumber: null, postalAddress: null, notes: null }],
  masterDataCategory: [{ id: "2", name: "Condòmino", code: "C", order: "1" }], masterDataCategoryI18n: [],
  person: [{ masterDataId: "10", firstName: "Dina", lastName: "Alberi", sex: "F" }], company: [],
  ledgerTransaction: [{ id: "9", accountingPeriodId: "1", code: "1", type: "individualExpense" }, { id: "10", accountingPeriodId: "1", code: "2", type: "unitResidentTakings" }],
  ledgerEntry: [
    { id: "21", ledgerTransactionId: "9", postingAccountId: "3", amount: "151.18", order: "1", type: "individualExpense", unitResidentId: "900" },
    { id: "22", ledgerTransactionId: "10", postingAccountId: "2", amount: "-100.00", order: "1", type: "unitResidentTakings", unitResidentId: "900" },
  ],
  installment: [{ id: "1", accountingPeriodId: "1", name: "Rata 1", expiryDate: "2011-02-28" }],
  installmentItem: [{ id: "1", installmentId: "1", unitResidentId: "900", amount: "148.73", status: "issued" }],
};

describe("units projection", () => {
  const db = buildDb(tables);
  const rows = projectUnits(db, "1");
  it("nests group → unit → resident", () => {
    expect(rows[0]!.kind).toBe("group");
    const unit = rows[0]!.children![0]!;
    expect(unit.kind).toBe("unit");
    expect(unit.label).toContain("A01");
    expect(unit.unitType).toBe("Appartamento");
    expect(unit.children![0]!.label).toBe("Alberi Dina (PR 100%)");
  });
  it("computes resident money from the ledger", () => {
    const res = rows[0]!.children![0]!.children![0]!;
    expect(res.saldoPrec).toEqual({ cents: -86065 });
    expect(res.consuntivo).toEqual({ cents: 15118 });
    expect(res.versato).toEqual({ cents: 10000 });   // -Σ takings (−100.00) → +100.00
    expect(res.preventivo).toEqual({ cents: 14873 }); // Σ installmentItem
    expect(res.totDovuto).toEqual({ cents: -71192 }); // saldoPrec + preventivo
  });
  it("group totals sum the children", () => {
    expect(rows[0]!.saldoPrec).toEqual({ cents: -86065 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm exec vitest run tools/gen/project/units.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/web/tools/gen/project/units.ts
import type { UnitRow } from "@cl/application";
import type { Money } from "@cl/domain";
import type { Db } from "../db.ts";
import { eur } from "../amounts.ts";

const str = (v: unknown): string | undefined => (v === null || v === undefined || String(v).trim() === "" ? undefined : String(v).trim());
const m = (c: number): Money => ({ cents: c });

function residentName(db: Db, masterDataId: string): string {
  const p = db.by("person", "masterDataId").get(masterDataId);
  if (p) return [str(p.lastName), str(p.firstName)].filter(Boolean).join(" ");
  const c = db.by("company", "masterDataId").get(masterDataId);
  return c ? String(c.name) : `Anagrafica ${masterDataId}`;
}
function roleAbbrev(db: Db, scenarioId: string | undefined, priorityId: string | undefined): string {
  const role = db.rows("unitResidentRole").find(
    (r) => String(r.unitOwnershipScenarioId) === scenarioId && String(r.unitResidentPriorityId) === priorityId,
  );
  return role ? String(role.abbreviation) : "PR";
}
function unitTypeName(db: Db, unitTypeId: string | undefined): string | undefined {
  if (!unitTypeId) return undefined;
  const base = db.by("unitType", "id").get(unitTypeId);
  const i18n = (db.group("unitTypeI18n", "unitTypeId").get(unitTypeId) ?? []).find((r) => String(r.localeCode).startsWith("it"));
  return str(i18n?.translation) ?? str(base?.name);
}
function restrictionLabel(start?: string, end?: string): string | undefined {
  if (!start && !end) return undefined;
  const f = (d?: string) => (d ? d.split(" ")[0]!.split("-").reverse().join("/") : "");
  return `${f(start)} - ${f(end)}`;
}

export function projectUnits(db: Db, periodId: string): UnitRow[] {
  const cond = db.condominiums.find((c) => db.periodsOf(String(c.id)).some((p) => String(p.id) === periodId));
  const units = db.rows("unit").filter((u) => String(u.accountingPeriodId) === periodId)
    .sort((a, b) => String(a.code ?? "").localeCompare(String(b.code ?? ""), "it"));
  const upByUnit = db.group("unitPeriod", "unitId");
  const resByUnitPeriod = db.group("unitResident", "unitPeriodId");

  // Pre-aggregate per-resident ledger sums for this period.
  const txInPeriod = new Set(db.rows("ledgerTransaction").filter((t) => String(t.accountingPeriodId) === periodId).map((t) => String(t.id)));
  const byResident = new Map<string, { individualExpense: number; takings: number }>();
  for (const e of db.rows("ledgerEntry")) {
    if (!txInPeriod.has(String(e.ledgerTransactionId))) continue;
    const ur = str(e.unitResidentId); if (!ur) continue;
    const acc = byResident.get(ur) ?? { individualExpense: 0, takings: 0 };
    const cents = eur(str(e.amount) ?? null).cents;
    if (String(e.type) === "individualExpense") acc.individualExpense += cents;
    else if (String(e.type) === "unitResidentTakings") acc.takings += cents;
    byResident.set(ur, acc);
  }
  const instByResident = new Map<string, number>();
  const instInPeriod = new Set(db.rows("installment").filter((i) => String(i.accountingPeriodId) === periodId).map((i) => String(i.id)));
  for (const ii of db.rows("installmentItem")) {
    if (!instInPeriod.has(String(ii.installmentId))) continue;
    const ur = str(ii.unitResidentId); if (!ur) continue;
    instByResident.set(ur, (instByResident.get(ur) ?? 0) + eur(str(ii.amount) ?? null).cents);
  }

  const sum = (rows: UnitRow[], k: "saldoPrec" | "preventivo" | "consuntivo" | "totDovuto" | "versato"): Money =>
    m(rows.reduce((a, r) => a + r[k].cents, 0));

  const unitRows: UnitRow[] = units.map((u) => {
    const unitPeriods = upByUnit.get(String(u.id)) ?? [];
    const residents = unitPeriods.flatMap((up) => (resByUnitPeriod.get(String(up.id)) ?? []).map((r) => ({ r, up })));
    const resRows: UnitRow[] = residents.map(({ r, up }) => {
      const mdId = String(r.masterDataId);
      const name = residentName(db, mdId);
      const pct = str(r.percentage) ?? "100";
      const abbr = roleAbbrev(db, str(up.unitOwnershipScenarioId), str(r.unitResidentPriorityId));
      const agg = byResident.get(String(r.id)) ?? { individualExpense: 0, takings: 0 };
      const saldoPrec = eur(str(r.startingBalance) ?? null).cents;
      const preventivo = instByResident.get(String(r.id)) ?? 0;
      const consuntivo = agg.individualExpense;
      const versato = -agg.takings; // takings credit the resident; show paid-in positive
      return {
        id: `r${r.id}`, kind: "resident", label: `${name} (${abbr} ${pct}%)`,
        saldoPrec: m(saldoPrec), preventivo: m(preventivo), consuntivo: m(consuntivo),
        totDovuto: m(saldoPrec + preventivo), versato: m(versato),
      };
    });
    const names = resRows.map((rr) => rr.label.replace(/ \(.*\)$/, "")).join(", ");
    const restriction = restrictionLabel(str(u.periodRestrictionStartDate), str(u.periodRestrictionEndDate));
    return {
      id: `u${u.id}`, kind: "unit",
      label: `${str(u.code) ?? "?"} - ${names || str(u.name) || ""}`.trim(),
      unitType: unitTypeName(db, str(u.unitTypeId)),
      floor: str(u.floor) ?? "—", inner: str(u.innerNumber) ?? "—", sub: str(u.subordinateNumber) ?? "—",
      ...(restriction ? { restriction } : {}),
      saldoPrec: sum(resRows, "saldoPrec"), preventivo: sum(resRows, "preventivo"),
      consuntivo: sum(resRows, "consuntivo"), totDovuto: sum(resRows, "totDovuto"), versato: sum(resRows, "versato"),
      children: resRows,
    };
  });

  const groupLabel = cond ? `${cond.name} / ${labelYear(db, periodId)}` : "Condominio";
  const group: UnitRow = {
    id: `g${periodId}`, kind: "group", label: groupLabel,
    saldoPrec: sum(unitRows, "saldoPrec"), preventivo: sum(unitRows, "preventivo"),
    consuntivo: sum(unitRows, "consuntivo"), totDovuto: sum(unitRows, "totDovuto"), versato: sum(unitRows, "versato"),
    children: unitRows,
  };
  return [group];
}

function labelYear(db: Db, periodId: string): string {
  const p = db.rows("accountingPeriod").find((x) => String(x.id) === periodId);
  return p ? String(p.name) : periodId;
}
```

- [ ] **Step 4: Verify the takings sign on real data, then run the test**

Before trusting `versato = −Σ takings`, print a real resident's takings entries from the dump and confirm the resident-side amount is negative (a credit). Temporary check:

```bash
cd apps/web && pnpm tsx -e "
import { readFileSync } from 'node:fs';
import { parseTables } from './tools/gen/loadRows.ts';
const t = parseTables(readFileSync('../../old/db/it-jtime-condominium.all.sql','utf8'));
const tk = t.ledgerEntry.filter(e=>e.type==='unitResidentTakings'&&e.unitResidentId).slice(0,8);
console.log(tk.map(e=>({ur:e.unitResidentId,amt:e.amount})));
"
```

Expected: amounts are negative (e.g. `-100.00`) → `versato = −Σ` yields positive. If they're positive, drop the negation in `units.ts` and update the test. Then:

Run: `cd apps/web && pnpm exec vitest run tools/gen/project/units.test.ts`
Expected: PASS (3 assertions).

- [ ] **Step 5: Commit**

```bash
git add apps/web/tools/gen/project/units.ts apps/web/tools/gen/project/units.test.ts
git commit -m "feat(web/gen): unit tree + per-resident money from the ledger"
```

---

### Task 10: Distribution projection (tables + estimate + current matrices)

**Files:**
- Create: `apps/web/tools/gen/project/distribution.ts`
- Create: `apps/web/tools/gen/project/distribution.test.ts`

Targets: `DistributionTable { id, name, restriction, total, items: { unitId, unitLabel, coefficient, competenza }[] }[]` and `distributionByPeriod[period] = { estimate, current }` each `{ columns: DistributionColumn[], rows: DistributionRow[] }`.
- Tables: from `distributionTable` (+ `distributionTableItem`). `total` = Σ coefficients (rounded to integer like the legacy /1000 base).
- Columns: one per **expense** ledger account (those in `expenseLedgerAccount`) that has a table linkage (`expenseLA2Table`), header = account name, `tableId` = its primary table.
- **current** matrix amounts: per unit per expense account = Σ `ledgerEntry.amount` (type `individualExpense`) for that account aggregated to the unit (via `unitResidentId → unitPeriod → unit`).
- **estimate** matrix amounts: per unit = `expenseLedgerAccount.estimate × (unitCoefficient ÷ tableTotal)` (role% via `expenseLA2Role` applied when present; default 100%). Round to cents.
- Group row = totals.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tools/gen/project/distribution.test.ts
import { describe, it, expect } from "vitest";
import { projectDistributionTables, projectDistribution } from "./distribution.ts";
import { buildDb } from "../db.ts";
import type { Tables } from "../loadRows.ts";

// one expense account (estimate 200.00) distributed on table T (units 100:250‰, 101:750‰)
const tables: Tables = {
  condominium: [{ id: "1", code: "SAT", name: "S", status: "active", type: "regular", address: null, taxCode: null, vatNumber: null, parentCondominiumId: null }],
  accountingPeriod: [{ id: "1", condominiumId: "1", name: "2011", type: "ordinary", status: "opened", startDate: "2011-01-01", endDate: "2011-12-31" }],
  unit: [
    { id: "100", accountingPeriodId: "1", code: "A01", name: "", unitTypeId: "1", unitGroupId: null, floor: null, innerNumber: null, subordinateNumber: null, periodRestrictionStartDate: null, periodRestrictionEndDate: null },
    { id: "101", accountingPeriodId: "1", code: "A02", name: "", unitTypeId: "1", unitGroupId: null, floor: null, innerNumber: null, subordinateNumber: null, periodRestrictionStartDate: null, periodRestrictionEndDate: null },
  ],
  unitPeriod: [{ id: "500", unitId: "100" }, { id: "501", unitId: "101" }],
  unitResident: [{ id: "900", unitPeriodId: "500", masterDataId: "10", percentage: "100", startingBalance: "0", unitResidentPriorityId: "1" }, { id: "901", unitPeriodId: "501", masterDataId: "11", percentage: "100", startingBalance: "0", unitResidentPriorityId: "1" }],
  distributionTable: [{ id: "7", accountingPeriodId: "1", name: "Proprietà", order: "1", restrictionUnitGroupId: null }],
  distributionTableItem: [{ distributionTableId: "7", unitId: "100", coefficient: "250" }, { distributionTableId: "7", unitId: "101", coefficient: "750" }],
  ledgerAccount: [{ id: "3", accountingPeriodId: "1", name: "Pulizie", type: "regular", parentLedgerAccountId: null, kind: "expenses", order: "1" }],
  expenseLedgerAccount: [{ ledgerAccountId: "3", estimate: "200.00", restrictionUnitGroupId: null }],
  expenseLA2Table: [{ id: "1", expenseLedgerAccountId: "3", distributionTableId: "7", type: "estimate", percentage: "100" }],
  expenseLA2Role: [],
  ledgerTransaction: [{ id: "9", accountingPeriodId: "1", code: "1", type: "individualExpense" }],
  ledgerEntry: [
    { id: "21", ledgerTransactionId: "9", postingAccountId: "3", amount: "50.00", order: "1", type: "individualExpense", unitResidentId: "900" },
    { id: "22", ledgerTransactionId: "9", postingAccountId: "3", amount: "150.00", order: "2", type: "individualExpense", unitResidentId: "901" },
  ],
};

describe("distribution projection", () => {
  const db = buildDb(tables);
  it("builds tables with total = Σ coefficients", () => {
    const t = projectDistributionTables(db, "1");
    expect(t[0]).toMatchObject({ id: "dt7", name: "Proprietà", total: 1000 });
    expect(t[0]!.items.map((i) => i.coefficient)).toEqual([250, 750]);
  });
  it("estimate matrix = estimate × coefficient ÷ total", () => {
    const est = projectDistribution(db, "1").estimate;
    expect(est.columns).toEqual([{ accountId: "la3", header: "Pulizie", tableId: "dt7" }]);
    const grp = est.rows[0]!;
    expect(grp.children!.find((r) => r.unitId === "u100")!.amounts["la3"]).toEqual({ cents: 5000 });
    expect(grp.children!.find((r) => r.unitId === "u101")!.amounts["la3"]).toEqual({ cents: 15000 });
    expect(grp.total).toEqual({ cents: 20000 });
  });
  it("current matrix = Σ individualExpense entries per unit", () => {
    const cur = projectDistribution(db, "1").current;
    const grp = cur.rows[0]!;
    expect(grp.children!.find((r) => r.unitId === "u100")!.amounts["la3"]).toEqual({ cents: 5000 });
    expect(grp.children!.find((r) => r.unitId === "u101")!.amounts["la3"]).toEqual({ cents: 15000 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm exec vitest run tools/gen/project/distribution.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/web/tools/gen/project/distribution.ts
import type {
  DistributionTable, DistributionColumn, DistributionRow, DistributionType,
} from "@cl/application";
import type { Money } from "@cl/domain";
import type { Db } from "../db.ts";
import { eur } from "../amounts.ts";

const str = (v: unknown): string | undefined => (v === null || v === undefined || String(v).trim() === "" ? undefined : String(v).trim());
const m = (c: number): Money => ({ cents: c });
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

function unitLabel(db: Db, unitId: string): string {
  const u = db.by("unit", "id").get(unitId);
  return u ? String(u.code ?? u.name ?? unitId) : unitId;
}

export function projectDistributionTables(db: Db, periodId: string): DistributionTable[] {
  const tables = db.rows("distributionTable").filter((t) => String(t.accountingPeriodId) === periodId)
    .sort((a, b) => num(a.order) - num(b.order));
  const itemsByTable = db.group("distributionTableItem", "distributionTableId");
  return tables.map((t) => {
    const items = (itemsByTable.get(String(t.id)) ?? []).map((it) => ({
      unitId: `u${it.unitId}`, unitLabel: unitLabel(db, String(it.unitId)),
      coefficient: num(it.coefficient), competenza: "intero" as const,
    }));
    const total = Math.round(items.reduce((s, i) => s + i.coefficient, 0));
    return { id: `dt${t.id}`, name: String(t.name), restriction: null, total, items };
  });
}

/** Expense accounts (with estimate) for the period, in account order. */
function expenseColumns(db: Db, periodId: string): { accountId: string; header: string; tableId: string; estimateCents: number; legacyAccountId: string; legacyTableId: string }[] {
  const accounts = db.rows("ledgerAccount").filter((a) => String(a.accountingPeriodId) === periodId && String(a.kind) === "expenses")
    .sort((a, b) => num(a.order) - num(b.order));
  const expense = db.by("expenseLedgerAccount", "ledgerAccountId");
  const la2t = db.group("expenseLA2Table", "expenseLedgerAccountId");
  const cols: ReturnType<typeof expenseColumns> = [];
  for (const a of accounts) {
    const exp = expense.get(String(a.id));
    if (!exp) continue;
    const link = (la2t.get(String(a.id)) ?? [])[0]; // primary table
    if (!link) continue;
    cols.push({
      accountId: `la${a.id}`, header: String(a.name), tableId: `dt${link.distributionTableId}`,
      estimateCents: eur(str(exp.estimate) ?? null).cents,
      legacyAccountId: String(a.id), legacyTableId: String(link.distributionTableId),
    });
  }
  return cols;
}

export function projectDistribution(db: Db, periodId: string): Record<DistributionType, { columns: DistributionColumn[]; rows: DistributionRow[] }> {
  const cols = expenseColumns(db, periodId);
  const columns: DistributionColumn[] = cols.map((c) => ({ accountId: c.accountId, header: c.header, tableId: c.tableId }));
  const units = db.rows("unit").filter((u) => String(u.accountingPeriodId) === periodId)
    .sort((a, b) => String(a.code ?? "").localeCompare(String(b.code ?? ""), "it"));
  const itemsByTable = db.group("distributionTableItem", "distributionTableId");
  const coeff = (legacyTableId: string, legacyUnitId: string): { c: number; total: number } => {
    const items = itemsByTable.get(legacyTableId) ?? [];
    const total = items.reduce((s, i) => s + num(i.coefficient), 0) || 1;
    const mine = items.find((i) => String(i.unitId) === legacyUnitId);
    return { c: mine ? num(mine.coefficient) : 0, total };
  };

  // unitResidentId -> legacy unitId, for the current (actual) matrix
  const upById = db.by("unitPeriod", "id");
  const urToUnit = new Map<string, string>();
  for (const r of db.rows("unitResident")) {
    const up = upById.get(String(r.unitPeriodId));
    if (up) urToUnit.set(String(r.id), String(up.unitId));
  }
  const txInPeriod = new Set(db.rows("ledgerTransaction").filter((t) => String(t.accountingPeriodId) === periodId).map((t) => String(t.id)));
  // actualByUnitAccount[legacyUnitId][legacyAccountId] = cents
  const actual = new Map<string, Map<string, number>>();
  for (const e of db.rows("ledgerEntry")) {
    if (String(e.type) !== "individualExpense" || !txInPeriod.has(String(e.ledgerTransactionId))) continue;
    const ur = str(e.unitResidentId); if (!ur) continue;
    const unitId = urToUnit.get(ur); if (!unitId) continue;
    const acc = String(e.postingAccountId);
    const byAcc = actual.get(unitId) ?? new Map<string, number>();
    byAcc.set(acc, (byAcc.get(acc) ?? 0) + eur(str(e.amount) ?? null).cents);
    actual.set(unitId, byAcc);
  }

  const buildMatrix = (mode: DistributionType): { columns: DistributionColumn[]; rows: DistributionRow[] } => {
    const unitRows: DistributionRow[] = units.map((u) => {
      const legacyUnitId = String(u.id);
      const amounts: Record<string, Money> = {};
      let total = 0;
      for (const col of cols) {
        let cents = 0;
        if (mode === "estimate") {
          const { c, total: tt } = coeff(col.legacyTableId, legacyUnitId);
          cents = Math.round((col.estimateCents * c) / tt);
        } else {
          cents = actual.get(legacyUnitId)?.get(col.legacyAccountId) ?? 0;
        }
        amounts[col.accountId] = m(cents); total += cents;
      }
      return { id: `d${mode}-${u.id}`, kind: "unit", unitId: `u${u.id}`, label: unitLabel(db, legacyUnitId), amounts, total: m(total) };
    });
    const groupAmounts: Record<string, Money> = {};
    for (const col of cols) groupAmounts[col.accountId] = m(unitRows.reduce((s, r) => s + r.amounts[col.accountId]!.cents, 0));
    const groupTotal = unitRows.reduce((s, r) => s + r.total.cents, 0);
    const group: DistributionRow = { id: `d${mode}-g`, kind: "group", label: "Totale", amounts: groupAmounts, total: m(groupTotal), children: unitRows };
    return { columns, rows: [group] };
  };

  return { estimate: buildMatrix("estimate"), current: buildMatrix("current") };
}
```

Note: `DistributionType` values are `"estimate" | "current"` (confirm in `types.ts`). If `competenza` has a stricter union than `"intero"`, match it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run tools/gen/project/distribution.test.ts`
Expected: PASS (3 assertions).

- [ ] **Step 5: Commit**

```bash
git add apps/web/tools/gen/project/distribution.ts apps/web/tools/gen/project/distribution.test.ts
git commit -m "feat(web/gen): distribution tables + estimate/current matrices"
```

---

### Task 11: Installments projection

**Files:**
- Create: `apps/web/tools/gen/project/installments.ts`
- Create: `apps/web/tools/gen/project/installments.test.ts`

Targets: `{ columns: InstallmentColumn[], rows: InstallmentRow[] }` per period. `InstallmentColumn { id, header, expiry }` from `installment` (sorted by `expiryDate`). `InstallmentRow { id, kind, unitId?, label, role?, restriction?, saldoPrec, totPreventivo, totDovuto, byInstallment: Record<colId, Money>, children? }`. Per resident: `byInstallment[col]` = that resident's `installmentItem.amount` for that installment; `totPreventivo`/`totDovuto` = Σ across installments; `saldoPrec` = `unitResident.startingBalance`. Aggregate residents → units → group, mirroring Task 9's tree.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tools/gen/project/installments.test.ts
import { describe, it, expect } from "vitest";
import { projectInstallments } from "./installments.ts";
import { buildDb } from "../db.ts";
import type { Tables } from "../loadRows.ts";

const tables: Tables = {
  condominium: [{ id: "1", code: "SAT", name: "S", status: "active", type: "regular", address: null, taxCode: null, vatNumber: null, parentCondominiumId: null }],
  accountingPeriod: [{ id: "1", condominiumId: "1", name: "2011", type: "ordinary", status: "opened", startDate: "2011-01-01", endDate: "2011-12-31" }],
  unit: [{ id: "100", accountingPeriodId: "1", code: "A01", name: "", unitTypeId: "1", unitGroupId: null, floor: null, innerNumber: null, subordinateNumber: null, periodRestrictionStartDate: null, periodRestrictionEndDate: null }],
  unitPeriod: [{ id: "500", unitId: "100", unitOwnershipScenarioId: "1" }],
  unitResident: [{ id: "900", unitPeriodId: "500", masterDataId: "10", percentage: "100", startingBalance: "-86.07", unitResidentPriorityId: "1" }],
  unitResidentRole: [{ id: "1", unitOwnershipScenarioId: "1", unitResidentPriorityId: "1", abbreviation: "PR", name: "Proprietario" }],
  unitResidentPriority: [{ id: "1" }],
  masterData: [{ id: "10", status: "active", masterDataCategoryId: "2" }], masterDataCategory: [{ id: "2", name: "Condòmino", code: "C", order: "1" }], masterDataCategoryI18n: [],
  person: [{ masterDataId: "10", firstName: "Dina", lastName: "Alberi", sex: "F" }], company: [],
  installment: [{ id: "1", accountingPeriodId: "1", name: "Rata 1", expiryDate: "2011-02-28" }, { id: "2", accountingPeriodId: "1", name: "Rata 2", expiryDate: "2011-04-30" }],
  installmentItem: [{ id: "1", installmentId: "1", unitResidentId: "900", amount: "49.58", status: "issued" }, { id: "2", installmentId: "2", unitResidentId: "900", amount: "49.58", status: "issued" }],
};

describe("installments projection", () => {
  const db = buildDb(tables);
  const out = projectInstallments(db, "1");
  it("columns sorted by expiry", () => {
    expect(out.columns).toEqual([{ id: "inst1", header: "Rata 1", expiry: "2011-02-28" }, { id: "inst2", header: "Rata 2", expiry: "2011-04-30" }]);
  });
  it("resident byInstallment + totals", () => {
    const res = out.rows[0]!.children![0]!.children![0]!;
    expect(res.byInstallment).toEqual({ inst1: { cents: 4958 }, inst2: { cents: 4958 } });
    expect(res.totPreventivo).toEqual({ cents: 9916 });
    expect(res.saldoPrec).toEqual({ cents: -8607 });
    expect(res.role).toBe("Proprietario");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm exec vitest run tools/gen/project/installments.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/web/tools/gen/project/installments.ts
import type { InstallmentColumn, InstallmentRow } from "@cl/application";
import type { Money } from "@cl/domain";
import type { Db } from "../db.ts";
import { eur } from "../amounts.ts";

const str = (v: unknown): string | undefined => (v === null || v === undefined || String(v).trim() === "" ? undefined : String(v).trim());
const m = (c: number): Money => ({ cents: c });

function residentName(db: Db, mdId: string): string {
  const p = db.by("person", "masterDataId").get(mdId);
  if (p) return [str(p.lastName), str(p.firstName)].filter(Boolean).join(" ");
  const c = db.by("company", "masterDataId").get(mdId);
  return c ? String(c.name) : `Anagrafica ${mdId}`;
}
function roleName(db: Db, scenarioId?: string, priorityId?: string): string | undefined {
  const role = db.rows("unitResidentRole").find((r) => String(r.unitOwnershipScenarioId) === scenarioId && String(r.unitResidentPriorityId) === priorityId);
  return role ? String(role.name) : undefined;
}

export function projectInstallments(db: Db, periodId: string): { columns: InstallmentColumn[]; rows: InstallmentRow[] } {
  const installments = db.rows("installment").filter((i) => String(i.accountingPeriodId) === periodId)
    .sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate)));
  const columns: InstallmentColumn[] = installments.map((i) => ({ id: `inst${i.id}`, header: String(i.name), expiry: String(i.expiryDate) }));
  if (columns.length === 0) return { columns: [], rows: [] };

  const itemsByResident = new Map<string, Map<string, number>>(); // urId -> instId -> cents
  const instIds = new Set(installments.map((i) => String(i.id)));
  for (const it of db.rows("installmentItem")) {
    if (!instIds.has(String(it.installmentId))) continue;
    const ur = str(it.unitResidentId); if (!ur) continue;
    const byInst = itemsByResident.get(ur) ?? new Map();
    byInst.set(String(it.installmentId), eur(str(it.amount) ?? null).cents);
    itemsByResident.set(ur, byInst);
  }

  const units = db.rows("unit").filter((u) => String(u.accountingPeriodId) === periodId)
    .sort((a, b) => String(a.code ?? "").localeCompare(String(b.code ?? ""), "it"));
  const upByUnit = db.group("unitPeriod", "unitId");
  const resByUp = db.group("unitResident", "unitPeriodId");

  const blank = (): Record<string, Money> => Object.fromEntries(columns.map((c) => [c.id, m(0)]));
  const sumRow = (rows: InstallmentRow[]): { byInstallment: Record<string, Money>; saldoPrec: Money; totPreventivo: Money; totDovuto: Money } => {
    const byInstallment = blank();
    let saldoPrec = 0, totPreventivo = 0, totDovuto = 0;
    for (const r of rows) {
      for (const c of columns) byInstallment[c.id] = m(byInstallment[c.id]!.cents + r.byInstallment[c.id]!.cents);
      saldoPrec += r.saldoPrec.cents; totPreventivo += r.totPreventivo.cents; totDovuto += r.totDovuto.cents;
    }
    return { byInstallment, saldoPrec: m(saldoPrec), totPreventivo: m(totPreventivo), totDovuto: m(totDovuto) };
  };

  const unitRows: InstallmentRow[] = units.map((u) => {
    const ups = upByUnit.get(String(u.id)) ?? [];
    const resRows: InstallmentRow[] = ups.flatMap((up) => (resByUp.get(String(up.id)) ?? []).map((r) => {
      const byInstallment = blank();
      const mine = itemsByResident.get(String(r.id));
      if (mine) for (const [instId, cents] of mine) byInstallment[`inst${instId}`] = m(cents);
      const totPreventivo = Object.values(byInstallment).reduce((s, x) => s + x.cents, 0);
      const saldoPrec = eur(str(r.startingBalance) ?? null).cents;
      return {
        id: `ir${r.id}`, kind: "unit", unitId: `u${u.id}`, label: residentName(db, String(r.masterDataId)),
        role: roleName(db, str(up.unitOwnershipScenarioId), str(r.unitResidentPriorityId)),
        saldoPrec: m(saldoPrec), totPreventivo: m(totPreventivo), totDovuto: m(saldoPrec + totPreventivo),
        byInstallment,
      };
    }));
    const agg = sumRow(resRows);
    return {
      id: `iu${u.id}`, kind: "unit", unitId: `u${u.id}`, label: `${str(u.code) ?? "?"}`,
      ...agg, byInstallment: agg.byInstallment,
      children: resRows.length > 1 ? resRows : undefined,
      ...(resRows.length === 1 ? { role: resRows[0]!.role } : {}),
    };
  });

  const groupAgg = sumRow(unitRows);
  const group: InstallmentRow = { id: `ig${periodId}`, kind: "group", label: labelYear(db, periodId), ...groupAgg, byInstallment: groupAgg.byInstallment, children: unitRows };
  return { columns, rows: [group] };
}

function labelYear(db: Db, periodId: string): string {
  const p = db.rows("accountingPeriod").find((x) => String(x.id) === periodId);
  return p ? String(p.name) : periodId;
}
```

Note: the test expects `rows[0].children[0].children[0]` (group → unit → resident), so a unit with one resident must still nest one resident child. Adjust: always nest residents as children (drop the `resRows.length > 1` collapse) so the shape is uniform; update `unitRows` to `children: resRows`. Make that change and re-run.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run tools/gen/project/installments.test.ts`
Expected: PASS (2 assertions) after setting `children: resRows` unconditionally.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tools/gen/project/installments.ts apps/web/tools/gen/project/installments.test.ts
git commit -m "feat(web/gen): installments columns + per-resident plan tree"
```

---

### Task 12: Reconciliation gate

**Files:**
- Create: `apps/web/tools/gen/reconcile.ts`
- Create: `apps/web/tools/gen/reconcile.test.ts`

A period's accounting is **valid** iff it has ≥1 posted entry and the trial balance nets to 0 (within 1 cent). Periods with no entries are "structure-only" (valid to show, but with empty accounting). Return, per period: `{ hasBooks: boolean; reconciles: boolean }`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tools/gen/reconcile.test.ts
import { describe, it, expect } from "vitest";
import { reconcilePeriods } from "./reconcile.ts";
import { buildDb } from "./db.ts";
import type { Tables } from "./loadRows.ts";

const base: Tables = {
  condominium: [{ id: "1", code: "SAT", name: "S", status: "active", type: "regular", address: null, taxCode: null, vatNumber: null, parentCondominiumId: null }],
  accountingPeriod: [
    { id: "1", condominiumId: "1", name: "2011", type: "ordinary", status: "opened", startDate: "2011-01-01", endDate: "2011-12-31" },
    { id: "2", condominiumId: "1", name: "2012", type: "ordinary", status: "opened", startDate: "2012-01-01", endDate: "2012-12-31" },
  ],
  unit: [{ id: "100", accountingPeriodId: "1", code: "A", name: "", unitTypeId: "1", unitGroupId: null, floor: null, innerNumber: null, subordinateNumber: null, periodRestrictionStartDate: null, periodRestrictionEndDate: null },
         { id: "101", accountingPeriodId: "2", code: "B", name: "", unitTypeId: "1", unitGroupId: null, floor: null, innerNumber: null, subordinateNumber: null, periodRestrictionStartDate: null, periodRestrictionEndDate: null }],
  ledgerTransaction: [{ id: "9", accountingPeriodId: "1", code: "1", type: "x" }],
};

describe("reconcilePeriods", () => {
  it("flags balanced books valid, unbalanced invalid, empty as structure-only", () => {
    const balanced = buildDb({ ...base, ledgerEntry: [
      { id: "1", ledgerTransactionId: "9", postingAccountId: "2", amount: "100.00", order: "1", type: null, unitResidentId: null },
      { id: "2", ledgerTransactionId: "9", postingAccountId: "3", amount: "-100.00", order: "2", type: null, unitResidentId: null }] });
    const r = reconcilePeriods(balanced);
    expect(r["1"]).toEqual({ hasBooks: true, reconciles: true });
    expect(r["2"]).toEqual({ hasBooks: false, reconciles: true }); // no entries → structure-only, allowed

    const unbalanced = buildDb({ ...base, ledgerEntry: [
      { id: "1", ledgerTransactionId: "9", postingAccountId: "2", amount: "100.00", order: "1", type: null, unitResidentId: null }] });
    expect(reconcilePeriods(unbalanced)["1"]).toEqual({ hasBooks: true, reconciles: false });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm exec vitest run tools/gen/reconcile.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/web/tools/gen/reconcile.ts
import type { Db } from "./db.ts";
import { eur } from "./amounts.ts";

export interface PeriodStatus { hasBooks: boolean; reconciles: boolean }

export function reconcilePeriods(db: Db): Record<string, PeriodStatus> {
  const txPeriod = new Map(db.rows("ledgerTransaction").map((t) => [String(t.id), String(t.accountingPeriodId)]));
  const sum = new Map<string, number>();   // periodId -> Σ signed cents
  const count = new Map<string, number>();  // periodId -> entry count
  for (const e of db.rows("ledgerEntry")) {
    const period = txPeriod.get(String(e.ledgerTransactionId));
    if (!period) continue;
    sum.set(period, (sum.get(period) ?? 0) + eur(String(e.amount)).cents);
    count.set(period, (count.get(period) ?? 0) + 1);
  }
  const out: Record<string, PeriodStatus> = {};
  for (const c of db.condominiums) {
    for (const p of db.periodsOf(String(c.id))) {
      const id = String(p.id);
      const n = count.get(id) ?? 0;
      const hasBooks = n > 0;
      const reconciles = !hasBooks || Math.abs(sum.get(id) ?? 0) <= 1;
      out[id] = { hasBooks, reconciles };
    }
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run tools/gen/reconcile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tools/gen/reconcile.ts apps/web/tools/gen/reconcile.test.ts
git commit -m "feat(web/gen): per-period trial-balance reconciliation gate"
```

---

### Task 13: Assemble the seed + emit JSON

**Files:**
- Create: `apps/web/tools/gen/assemble.ts`
- Create: `apps/web/tools/gen/generate-data.ts`
- Create: `apps/web/tools/gen/assemble.test.ts`

`assemble(db)` builds an object matching `MockStoreSeed` (defined in Task 14, but its shape is fixed here): for every selected period, fill accounting views **only when `reconcile` says `hasBooks && reconciles`**; otherwise leave that period's accounting empty (`[]`/empty matrices) while still emitting units/detail/anagrafiche/calendar. The entry script reads the dump, assembles, prints a report, and writes JSON.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tools/gen/assemble.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseTables } from "./loadRows.ts";
import { buildDb } from "./db.ts";
import { assemble } from "./assemble.ts";

const SQL = readFileSync(new URL("../../../../old/db/it-jtime-condominium.all.sql", import.meta.url), "utf8");

describe("assemble (real dump)", () => {
  const seed = assemble(buildDb(parseTables(SQL)));
  it("emits multiple real condominiums and a large anagrafiche registry", () => {
    expect(seed.tree.length).toBeGreaterThanOrEqual(6);
    expect(seed.anagrafiche.length).toBeGreaterThan(80);
    expect(seed.anagraficaCategories.length).toBeGreaterThan(5);
  });
  it("Saturno 2011 and Pozzetto 2013 have populated, balanced books", () => {
    // find the period ids by walking the tree
    const periods = seed.tree.flatMap((c) => c.periods.map((p) => p.id));
    const withAccounts = periods.filter((pid) => (seed.ledgerAccountsByPeriod[pid] ?? []).length > 0);
    expect(withAccounts.length).toBeGreaterThanOrEqual(2);
    for (const pid of withAccounts) {
      const txns = seed.ledgerTxnsByPeriod[pid] ?? [];
      if (txns.length === 0) continue;
      const dare = txns.reduce((s, t) => s + t.dare.cents, 0);
      const avere = txns.reduce((s, t) => s + t.avere.cents, 0);
      expect(dare).toBe(avere); // balanced
    }
  });
  it("every period resolves units and every anagrafica has a known category", () => {
    const cats = new Set(seed.anagraficaCategories);
    expect(seed.anagrafiche.every((a) => cats.has(a.categoria))).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm exec vitest run tools/gen/assemble.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement assemble + entry script**

```ts
// apps/web/tools/gen/assemble.ts
import type {
  CondominiumNode, CondominiumDetail, UnitRow, DistributionTable, DistributionColumn, DistributionRow,
  LedgerAccountRow, LedgerTxnRow, InstallmentColumn, InstallmentRow, F24Row, FunctionalRole, Id,
  CalendarLayer, CalendarEvent, Anagrafica, DistributionType,
} from "@cl/application";
import type { Db } from "./db.ts";
import { reconcilePeriods } from "./reconcile.ts";
import { projectAnagrafiche, projectCategories } from "./project/anagrafiche.ts";
import { projectLayers, projectEvents } from "./project/calendar.ts";
import { projectTree, projectDetails, projectFunctional, projectF24 } from "./project/structure.ts";
import { projectAccounts, projectTransactions } from "./project/accounting.ts";
import { projectUnits } from "./project/units.ts";
import { projectDistributionTables, projectDistribution } from "./project/distribution.ts";
import { projectInstallments } from "./project/installments.ts";

type Dist = { columns: DistributionColumn[]; rows: DistributionRow[] };
type Installments = { columns: InstallmentColumn[]; rows: InstallmentRow[] };

export interface Seed {
  tree: CondominiumNode[];
  detailByPeriod: Record<Id, CondominiumDetail>;
  unitsByPeriod: Record<Id, UnitRow[]>;
  distributionTablesByPeriod: Record<Id, DistributionTable[]>;
  distributionByPeriod: Record<Id, Record<DistributionType, Dist>>;
  ledgerAccountsByPeriod: Record<Id, LedgerAccountRow[]>;
  ledgerTxnsByPeriod: Record<Id, LedgerTxnRow[]>;
  installmentsByPeriod: Record<Id, Installments>;
  f24sByPeriod: Record<Id, F24Row[]>;
  functionalByPeriod: Record<Id, Partial<Record<FunctionalRole, Id>>>;
  calendarLayers: CalendarLayer[];
  calendarEvents: CalendarEvent[];
  anagraficaCategories: string[];
  anagrafiche: Anagrafica[];
}

const emptyDist: Dist = { columns: [], rows: [] };
const emptyInst: Installments = { columns: [], rows: [] };

export function assemble(db: Db): Seed {
  const status = reconcilePeriods(db);
  const tree = projectTree(db);
  const detailByPeriod = projectDetails(db);
  const functionalByPeriod = projectFunctional(db);
  const f24sByPeriod = projectF24(db);

  const unitsByPeriod: Seed["unitsByPeriod"] = {};
  const distributionTablesByPeriod: Seed["distributionTablesByPeriod"] = {};
  const distributionByPeriod: Seed["distributionByPeriod"] = {};
  const ledgerAccountsByPeriod: Seed["ledgerAccountsByPeriod"] = {};
  const ledgerTxnsByPeriod: Seed["ledgerTxnsByPeriod"] = {};
  const installmentsByPeriod: Seed["installmentsByPeriod"] = {};

  for (const c of db.condominiums) {
    for (const p of db.periodsOf(String(c.id))) {
      const legacyPeriodId = String(p.id);
      const pid = `p${p.id}`;
      unitsByPeriod[pid] = projectUnits(db, legacyPeriodId);
      const books = status[legacyPeriodId];
      if (books && books.hasBooks && books.reconciles) {
        ledgerAccountsByPeriod[pid] = projectAccounts(db, legacyPeriodId);
        ledgerTxnsByPeriod[pid] = projectTransactions(db, legacyPeriodId);
        distributionTablesByPeriod[pid] = projectDistributionTables(db, legacyPeriodId);
        distributionByPeriod[pid] = projectDistribution(db, legacyPeriodId);
        installmentsByPeriod[pid] = projectInstallments(db, legacyPeriodId);
      } else {
        ledgerAccountsByPeriod[pid] = [];
        ledgerTxnsByPeriod[pid] = [];
        distributionTablesByPeriod[pid] = [];
        distributionByPeriod[pid] = { estimate: emptyDist, current: emptyDist };
        installmentsByPeriod[pid] = emptyInst;
      }
    }
  }

  return {
    tree, detailByPeriod, unitsByPeriod, distributionTablesByPeriod, distributionByPeriod,
    ledgerAccountsByPeriod, ledgerTxnsByPeriod, installmentsByPeriod, f24sByPeriod, functionalByPeriod,
    calendarLayers: projectLayers(db), calendarEvents: projectEvents(db),
    anagraficaCategories: projectCategories(db), anagrafiche: projectAnagrafiche(db),
  };
}
```

```ts
// apps/web/tools/gen/generate-data.ts
import { readFileSync, writeFileSync } from "node:fs";
import { parseTables } from "./loadRows.ts";
import { buildDb } from "./db.ts";
import { assemble } from "./assemble.ts";
import { reconcilePeriods } from "./reconcile.ts";

const DUMP = new URL("../../../../old/db/it-jtime-condominium.all.sql", import.meta.url);
const OUT = new URL("../../src/mock/data.generated.json", import.meta.url);

const db = buildDb(parseTables(readFileSync(DUMP, "utf8")));
const status = reconcilePeriods(db);
const seed = assemble(db);

// Report
const periods = db.condominiums.flatMap((c) => db.periodsOf(String(c.id)).map((p) => ({ cond: String(c.name), id: String(p.id), ...status[String(p.id)]! })));
console.log(`Condominiums: ${seed.tree.length}`);
console.log(`Anagrafiche: ${seed.anagrafiche.length} in ${seed.anagraficaCategories.length} categories`);
console.log(`Calendar events: ${seed.calendarEvents.length}`);
for (const p of periods) {
  const tag = !p.hasBooks ? "structure-only" : p.reconciles ? "books OK" : "BOOKS UNBALANCED → accounting omitted";
  console.log(`  period ${p.id} (${p.cond}): ${tag}`);
}
writeFileSync(OUT, JSON.stringify(seed, null, 2) + "\n", "utf8");
console.log(`Wrote ${OUT.pathname}`);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run tools/gen/assemble.test.ts`
Expected: PASS (3 assertions). If a real-dump enum spelling broke a projection, fix that projection's map and re-run.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tools/gen/assemble.ts apps/web/tools/gen/generate-data.ts apps/web/tools/gen/assemble.test.ts
git commit -m "feat(web/gen): assemble seed (reconcile-gated accounting) + entry script"
```

---

### Task 14: Wire generated seed into the app; keep fixtures as the test seed

**Files:**
- Modify: `apps/web/src/mock/MockStore.ts` (constructor takes a seed; default = fixtures)
- Create: `apps/web/src/mock/seed.ts` (the `MockStoreSeed` type + `fixtureSeed` bundle)
- Modify: `apps/web/src/mock/fixtures.ts` (export `fixtureSeed`)
- Modify: `apps/web/src/mock/MockDataSource.ts` (add `createGeneratedDataSource`)
- Modify: `apps/web/src/App.tsx` (inject generated by default; accept `data` prop)
- Modify: `apps/web/src/App.test.tsx` (pass fixtures explicitly)
- Create: `apps/web/src/mock/data.generated.ts` (typed loader for the JSON)
- Run: the generator to produce `apps/web/src/mock/data.generated.json`
- Add: `gen:data` script to `apps/web/package.json`

- [ ] **Step 1: Define the seed type and bundle**

```ts
// apps/web/src/mock/seed.ts
import type {
  CondominiumNode, CondominiumDetail, UnitRow, DistributionTable, DistributionColumn, DistributionRow,
  LedgerAccountRow, LedgerTxnRow, InstallmentColumn, InstallmentRow, F24Row, FunctionalRole, Id,
  CalendarLayer, CalendarEvent, Anagrafica, DistributionType,
} from "@cl/application";

export interface MockStoreSeed {
  tree: CondominiumNode[];
  detailByPeriod: Record<Id, CondominiumDetail>;
  unitsByPeriod: Record<Id, UnitRow[]>;
  distributionTablesByPeriod: Record<Id, DistributionTable[]>;
  distributionByPeriod: Record<Id, Record<DistributionType, { columns: DistributionColumn[]; rows: DistributionRow[] }>>;
  ledgerAccountsByPeriod: Record<Id, LedgerAccountRow[]>;
  ledgerTxnsByPeriod: Record<Id, LedgerTxnRow[]>;
  installmentsByPeriod: Record<Id, { columns: InstallmentColumn[]; rows: InstallmentRow[] }>;
  f24sByPeriod: Record<Id, F24Row[]>;
  functionalByPeriod: Record<Id, Partial<Record<FunctionalRole, Id>>>;
  calendarLayers: CalendarLayer[];
  calendarEvents: CalendarEvent[];
  anagraficaCategories: string[];
  anagrafiche: Anagrafica[];
}
```

- [ ] **Step 2: Export `fixtureSeed` from fixtures.ts**

Append to `apps/web/src/mock/fixtures.ts` (the existing exported consts already match these names; `calendarLayers` and `anagraficaCategories` exist; add the bundle):

```ts
import type { MockStoreSeed } from "./seed";

export const fixtureSeed: MockStoreSeed = {
  tree, detailByPeriod, unitsByPeriod, distributionTablesByPeriod, distributionByPeriod,
  ledgerAccountsByPeriod, ledgerTxnsByPeriod, installmentsByPeriod, f24sByPeriod, functionalByPeriod,
  calendarLayers, calendarEvents, anagraficaCategories, anagrafiche,
};
```

- [ ] **Step 3: Make MockStore seed-injectable (default fixtures)**

In `apps/web/src/mock/MockStore.ts`, replace the field initializers `= fx.tree` etc. with constructor assignment. Add at the top of the class:

```ts
import { fixtureSeed } from "./fixtures";
import type { MockStoreSeed } from "./seed";
// ...
  private tree$;
  private details$;
  private units$;
  private tables$;
  private distributions$;
  private accounts$;
  protected txns$;
  private installments$;
  private f24s$;
  private functional$;
  private calendar$;
  private anagrafiche$;

  constructor(seed: MockStoreSeed = fixtureSeed) {
    this.tree$ = new BehaviorSubject(seed.tree);
    this.details$ = new BehaviorSubject(seed.detailByPeriod);
    this.units$ = new BehaviorSubject(seed.unitsByPeriod);
    this.tables$ = new BehaviorSubject(seed.distributionTablesByPeriod);
    this.distributions$ = new BehaviorSubject(seed.distributionByPeriod);
    this.accounts$ = new BehaviorSubject(seed.ledgerAccountsByPeriod);
    this.txns$ = new BehaviorSubject(seed.ledgerTxnsByPeriod);
    this.installments$ = new BehaviorSubject(seed.installmentsByPeriod);
    this.f24s$ = new BehaviorSubject(seed.f24sByPeriod);
    this.functional$ = new BehaviorSubject(seed.functionalByPeriod);
    this.calendar$ = new BehaviorSubject(seed.calendarEvents);
    this.anagrafiche$ = new BehaviorSubject(seed.anagrafiche);
    this.calendarLayers = seed.calendarLayers;
    this.anagraficaCategories$ = seed.anagraficaCategories;
  }
```

Keep all remaining methods unchanged. Wherever the class currently reads `fx.calendarLayers` / `fx.anagraficaCategories` in methods, switch to the stored `this.calendarLayers` / `this.anagraficaCategories$` fields set above (add those private fields). Remove the now-unused `import * as fx` if nothing else uses it. (BehaviorSubject generic types are inferred from `seed.*`.)

- [ ] **Step 4: Run existing store/runtime tests to verify nothing broke**

Run: `cd apps/web && pnpm exec vitest run src/mock/MockStore.test.ts src/runtime/runtime.test.tsx`
Expected: PASS (unchanged — default constructor uses `fixtureSeed`).

- [ ] **Step 5: Generate the JSON + add the loader + script**

Add to `apps/web/package.json` scripts: `"gen:data": "tsx tools/gen/generate-data.ts"`. Add `tsx` to `@cl/web` devDependencies (`"tsx": "^4.19.0"`). Then:

```bash
cd apps/web && pnpm install && pnpm gen:data
```

Expected: console report (≥6 condominiums; ~100+ anagrafiche; two periods "books OK", others "structure-only") and `src/mock/data.generated.json` written.

```ts
// apps/web/src/mock/data.generated.ts
import type { MockStoreSeed } from "./seed";
import raw from "./data.generated.json";

// Money serializes as {cents:number}, structurally identical to the Money type,
// so a direct cast is sound. The generator is the single producer of this file.
export const generatedSeed = raw as unknown as MockStoreSeed;
```

Ensure `resolveJsonModule` is enabled in `apps/web/tsconfig.json` (Vite supports JSON import natively; if tsc complains, add `"resolveJsonModule": true`).

- [ ] **Step 6: Inject generated seed into the app**

```ts
// apps/web/src/mock/MockDataSource.ts
import type { MockDataSource } from "@cl/application";
import { MockStore } from "./MockStore";
import { generatedSeed } from "./data.generated";

export function createMockDataSource(): MockDataSource {
  return new MockStore(); // fixtures — used by tests via the default AppRuntimeProvider
}

export function createGeneratedDataSource(): MockDataSource {
  return new MockStore(generatedSeed); // the full real dataset — used by the running app
}
```

```tsx
// apps/web/src/App.tsx
import { AppRuntimeProvider } from "./runtime/AppRuntimeProvider";
import { AppShell } from "./components/layout/AppShell";
import { ToastProvider } from "./components/common/Toast";
import { createGeneratedDataSource } from "./mock/MockDataSource";
import type { MockDataSource } from "@cl/application";

export function App({ data }: { data?: MockDataSource } = {}) {
  return (
    <AppRuntimeProvider data={data ?? createGeneratedDataSource()}>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </AppRuntimeProvider>
  );
}
```

- [ ] **Step 7: Keep App.test deterministic on fixtures**

In `apps/web/src/App.test.tsx`, change `render(<App />)` to inject fixtures:

```tsx
import { createMockDataSource } from "./mock/MockDataSource";
// ...
  render(<App data={createMockDataSource()} />);
```

(Assertions unchanged — they reference fixture values like "SAT — Saturno" and "2011 (Ordinario)".)

- [ ] **Step 8: Full verification**

Run:
```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
pnpm -r typecheck
pnpm --filter @cl/web test
pnpm --filter @cl/web build
```
Expected: typecheck OK (all packages), all web tests pass, production build succeeds.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/mock/seed.ts apps/web/src/mock/fixtures.ts apps/web/src/mock/MockStore.ts \
        apps/web/src/mock/MockDataSource.ts apps/web/src/mock/data.generated.ts apps/web/src/mock/data.generated.json \
        apps/web/src/App.tsx apps/web/src/App.test.tsx apps/web/package.json apps/web/tsconfig.json pnpm-lock.yaml
git commit -m "feat(web): seed the app from the full legacy dataset; fixtures remain the test seed"
```

---

### Task 15: README + regeneration docs + final whole-suite check

**Files:**
- Modify: `apps/web/README.md`
- Test: full suite

- [ ] **Step 1: Document the generator in the web README**

Add a section "## Dati reali (generated dataset)" describing: the app seeds from `src/mock/data.generated.json`, produced by `pnpm gen:data` from `old/db/it-jtime-condominium.all.sql`; tests run against the curated `fixtures.ts` seed; the reconciliation gate (only periods whose trial balance nets to zero show accounting; others show structure only); which condominiums carry full books (Saturno 2011, Pozzetto 2013) and that the rest are structure-only by design.

- [ ] **Step 2: Run the entire web suite + typecheck + build once more**

Run:
```bash
cd /Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger
pnpm -r typecheck && pnpm --filter @cl/web test && pnpm --filter @cl/web build
```
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add apps/web/README.md
git commit -m "docs(web): document the generated real-data seed + regeneration"
```

---

## Self-review checklist (completed)

**Spec coverage:** generator reusing `@cl/db` (Task 1) ✓; AddressVO (Task 2) ✓; faithful accounting — signed aggregation + tree (Tasks 3, 8), per-resident from ledger (Task 9), distribution estimate/current (Task 10), installments (Task 11) ✓; reconciliation gate (Task 12) ✓; complete lists — anagrafiche (Task 5), calendar (Task 6), structure/suppliers/functional/F24 (Task 7) ✓; all-real-buildings + structure-only periods (Task 4 selection + Task 13 gating) ✓; JSON output + loader (Tasks 13–14) ✓; MockStore seam, fixtures-as-test-seed, App injection (Task 14) ✓; smoke test on the real dump (Task 13) ✓; docs (Task 15) ✓; committed JSON so CI needs no dump (Task 14) ✓.

**Type consistency:** id helpers (`c/p/u/r/la/tx/dt/inst/md/ev`) are used uniformly; `MockStoreSeed` (Task 14) and the generator's `Seed` (Task 13) have identical members; money is always `{cents}`; `FunctionalRole` keys `liquid/payable/withholding/credit` match `functionalByPeriod` usage in fixtures.

**Known follow-ups to verify during execution (not placeholders — explicit checks):** takings sign (Task 9 Step 4 has an empirical probe); real-dump enum spellings for calendar `priority`/`status` (Task 6 Step 4); `DistributionType`/`competenza` exact unions (Task 10 note); `installmentItem.unitResidentId` always resolves to a unit in the period (covered by the smoke test's category/units assertions).
