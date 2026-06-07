# Condomini Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A frontend-only React prototype, on mock data, that recreates the full **Condomini** module of the legacy app — modernized styling, identical layout/density — as the UI/UX baseline.

**Architecture:** pnpm monorepo with the dependency rule (pure `domain` → `application` ports → tech adapters). Client state is RxJS streams behind a **context composition root** (react-rxjs bound hooks injected via React context — no module singletons). Styling is CSS Modules driven by design tokens; behavior primitives are Radix; the data grid is TanStack Table behind a `TreeTable` adapter. All data comes from a `MockDataSource` modeled on the legacy Saturno/Pozzetto condominiums.

**Tech Stack:** React 18 + Vite + TypeScript (strict), pnpm workspaces, RxJS + @react-rxjs/core, @tanstack/react-table, @radix-ui/react-*, CSS Modules, Vitest + @testing-library/react + jsdom, lucide-react.

**Spec:** `docs/superpowers/specs/2026-06-07-prototype-design.md` (and umbrella `2026-06-07-migration-overview-design.md`).

---

## File structure (decomposition)

```
condo-ledger/
  package.json                 # root, private, workspaces scripts
  pnpm-workspace.yaml
  tsconfig.base.json
  packages/
    domain/                    # pure TS, zero deps
      package.json  tsconfig.json
      src/money.ts             # Money value type (integer cents)
      src/money.test.ts
      src/index.ts
    application/               # ports + DTO types; depends only on domain
      package.json  tsconfig.json
      src/types.ts             # DTOs (CondominiumNode, UnitRow, ... )
      src/ports.ts             # AppRuntime, MockDataSource, TreeTableAdapter interfaces
      src/index.ts
  apps/
    web/
      package.json  tsconfig.json  vite.config.ts  vitest.setup.ts  index.html
      src/main.tsx  src/App.tsx
      src/styles/tokens.css  src/styles/theme-dark.css  src/styles/global.css
      src/styles/tokens.test.ts
      src/format/{Money,Coefficient,NumberCell,StatusChip,DateText}.tsx (+ .module.css)
      src/format/format.test.tsx
      src/mock/fixtures.ts     # Saturno/Pozzetto fixture data
      src/mock/MockDataSource.ts
      src/runtime/createAppRuntime.ts
      src/runtime/AppRuntimeProvider.tsx   # composition root + context
      src/runtime/useAppRuntime.ts
      src/runtime/runtime.test.tsx
      src/components/shell/{TopBar,MainNav,Breadcrumb,AppShell}.tsx (+ .module.css)
      src/components/sidebar/{GestioneTree,SectionMenu,Sidebar}.tsx (+ .module.css)
      src/components/layout/{SplitPane,SectionPanel,DetailPanel,FormCard}.tsx (+ .module.css)
      src/components/grid/{TreeTable,inlineEditors}.tsx (+ .module.css)
      src/components/grid/TreeTable.test.tsx
      src/components/common/{ActionToolbar,IconButton,Legenda,Icon}.tsx (+ .module.css)
      src/sections/dati/DatiCondominioSection.tsx (+ .module.css, + .test.tsx)
      src/sections/unita/UnitaSection.tsx (+ ...)
      src/sections/tabelle/TabelleSection.tsx (+ ...)
      src/sections/conti/ContiSection.tsx (+ ...)
      src/sections/giornale/GiornaleSection.tsx (+ ...)
      src/sections/rate/RateSection.tsx (+ ...)
      src/modules/{Calendario,Anagrafiche}Stub.tsx
```

Convention: every component has a co-located `*.module.css` consuming only token variables. Tests are co-located `*.test.tsx`.

---

## Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- Modify: `.gitignore`

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "condo-ledger",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "pnpm --filter @cl/web dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "^5.5.4"
  },
  "packageManager": "pnpm@9.7.0"
}
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "jsx": "react-jsx"
  }
}
```

- [ ] **Step 4: Append to `.gitignore`**

```
node_modules/
dist/
*.tsbuildinfo
.DS_Store
```

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore
git commit -m "chore: scaffold pnpm monorepo"
```

---

## Task 2: `packages/domain` — Money value type (TDD)

The `Money` type is integer-minor-units (cents) per the spec. Pure, no deps.

**Files:**
- Create: `packages/domain/package.json`, `packages/domain/tsconfig.json`, `packages/domain/src/index.ts`
- Create: `packages/domain/src/money.ts`
- Test: `packages/domain/src/money.test.ts`

- [ ] **Step 1: Create `packages/domain/package.json`**

```json
{
  "name": "@cl/domain",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `packages/domain/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 3: Write the failing test `packages/domain/src/money.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { money, fromCents, add, formatEUR, isNegative } from "./money";

describe("Money", () => {
  it("constructs from a decimal amount as integer cents", () => {
    expect(money(1234.56).cents).toBe(123456);
  });
  it("rounds half away from zero at cent precision", () => {
    expect(money(0.005).cents).toBe(1);
    expect(money(-0.005).cents).toBe(-1);
  });
  it("adds without float drift", () => {
    expect(add(money(0.1), money(0.2)).cents).toBe(30);
  });
  it("formats Italian EUR", () => {
    expect(formatEUR(fromCents(123456))).toBe("1.234,56");
    expect(formatEUR(fromCents(-50))).toBe("-0,50");
  });
  it("detects negative", () => {
    expect(isNegative(fromCents(-1))).toBe(true);
    expect(isNegative(fromCents(0))).toBe(false);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @cl/domain test`
Expected: FAIL (module `./money` has no such exports).

- [ ] **Step 5: Implement `packages/domain/src/money.ts`**

```ts
export interface Money {
  readonly cents: number; // integer minor units
}

export function fromCents(cents: number): Money {
  if (!Number.isInteger(cents)) throw new Error("cents must be an integer");
  return { cents };
}

/** Construct from a decimal amount (e.g. 1234.56) → integer cents, half-away-from-zero. */
export function money(amount: number): Money {
  const scaled = amount * 100;
  const rounded =
    scaled >= 0 ? Math.round(scaled) : -Math.round(-scaled);
  return { cents: rounded };
}

export function add(a: Money, b: Money): Money {
  return { cents: a.cents + b.cents };
}

export function subtract(a: Money, b: Money): Money {
  return { cents: a.cents - b.cents };
}

export function isNegative(m: Money): boolean {
  return m.cents < 0;
}

/** Italian formatting: thousands '.', decimals ',' — no currency symbol (added in UI). */
export function formatEUR(m: Money): string {
  const negative = m.cents < 0;
  const abs = Math.abs(m.cents);
  const whole = Math.floor(abs / 100);
  const frac = (abs % 100).toString().padStart(2, "0");
  const wholeStr = whole.toLocaleString("it-IT");
  return `${negative ? "-" : ""}${wholeStr},${frac}`;
}
```

- [ ] **Step 6: Create `packages/domain/src/index.ts`**

```ts
export * from "./money";
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter @cl/domain test`
Expected: PASS (5 tests).

- [ ] **Step 8: Commit**

```bash
git add packages/domain
git commit -m "feat(domain): Money integer-cents value type"
```

---

## Task 3: `packages/application` — DTO types & ports

Defines the shared DTOs and the port interfaces (`AppRuntime`, `MockDataSource`, `TreeTableAdapter`). Depends only on `@cl/domain`. No runtime logic.

**Files:**
- Create: `packages/application/package.json`, `tsconfig.json`, `src/index.ts`
- Create: `packages/application/src/types.ts`, `packages/application/src/ports.ts`

- [ ] **Step 1: Create `packages/application/package.json`**

```json
{
  "name": "@cl/application",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": { "@cl/domain": "workspace:*", "rxjs": "^7.8.1" }
}
```

- [ ] **Step 2: Create `packages/application/tsconfig.json`**

```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 3: Create `packages/application/src/types.ts`**

```ts
import type { Money } from "@cl/domain";

export type Id = string;
export type Module = "calendario" | "condomini" | "anagrafiche";
export type CondominiSection =
  | "dati" | "unita" | "tabelle" | "conti" | "giornale" | "rate";

export type AccountingPeriodType = "ordinary" | "extra" | "auxiliary";

export interface AccountingPeriodNode {
  id: Id;
  name: string;            // "2010 (Ordinario)"
  type: AccountingPeriodType;
  closed: boolean;
  start: string;           // ISO date
  end: string;             // ISO date
}
export interface CondominiumNode {
  id: Id;
  code: string;            // "SAT"
  name: string;            // "Saturno (Piazza del Duomo, 39, 33100 Udine)"
  type: "regular" | "super" | "residence";
  periods: AccountingPeriodNode[];
}

export interface Selection { condominiumId?: Id; accountingPeriodId?: Id; }

export interface CondominiumDetail {
  intestazione: string;
  codice: string;
  status: "active" | "inactive";
  tipo: string;
  indirizzo: string;
  codiceFiscale: string;
  dataCostruzione: string | null;
  datiCatastali: string | null;
  idSistema: string;
  creatoIl: string;
  modificatoIl: string;
  suppliers: SupplierRow[];
}
export interface SupplierRow { id: Id; nominativo: string; categoria: string; }

export type UnitRowKind = "group" | "unit" | "resident";
export interface UnitRow {
  id: Id;
  kind: UnitRowKind;
  label: string;           // group/unit/resident display
  unitType?: string;       // "Appartamento"
  floor?: string;
  inner?: string;
  sub?: string;
  restriction?: string;    // competenza date range
  saldoPrec: Money;
  preventivo: Money;
  consuntivo: Money;
  totDovuto: Money;
  versato: Money;
  children?: UnitRow[];
}

export interface DistributionTable {
  id: Id; name: string; restriction: string | null; total: number;
  items: DistributionTableItem[];
}
export interface DistributionTableItem { unitId: Id; unitLabel: string; coefficient: number; competenza: string; }

export type DistributionType = "estimate" | "current";
export interface DistributionRow {
  id: Id; kind: "group" | "unit"; label: string;
  amounts: Record<Id /*expenseAccountId*/, Money>;
  total: Money; children?: DistributionRow[];
}
export interface DistributionColumn { accountId: Id; header: string; }

export type LedgerAccountKind = "grouping" | "regular" | "subsidiary" | "control";
export interface LedgerAccountRow {
  id: Id; kind: LedgerAccountKind; label: string;
  dare: Money; avere: Money; saldo: Money; preventivo: Money | null;
  children?: LedgerAccountRow[];
}

export interface LedgerTxnRow {
  id: Id; date: string; code: number; description: string;
  dare: Money; avere: Money;
  entries: { account: string; dare: Money; avere: Money }[];
}

export interface InstallmentColumn { id: Id; header: string; }
export interface InstallmentRow {
  id: Id; kind: "group" | "unit" | "resident"; label: string; role?: string;
  restriction?: string; saldoPrec: Money; totPreventivo: Money; totDovuto: Money;
  byInstallment: Record<Id, Money>; children?: InstallmentRow[];
}
```

- [ ] **Step 4: Create `packages/application/src/ports.ts`**

```ts
import type { Observable } from "rxjs";
import type {
  Module, CondominiSection, Selection, CondominiumNode, CondominiumDetail,
  UnitRow, DistributionTable, DistributionRow, DistributionColumn, DistributionType,
  LedgerAccountRow, LedgerTxnRow, InstallmentRow, InstallmentColumn, Id,
} from "./types";

/** Data port. Mock today; HTTP/tRPC adapter later. Returns observables. */
export interface MockDataSource {
  condominiumTree(): Observable<CondominiumNode[]>;
  condominiumDetail(periodId: Id): Observable<CondominiumDetail | null>;
  unitsTree(periodId: Id): Observable<UnitRow[]>;
  distributionTables(periodId: Id): Observable<DistributionTable[]>;
  distribution(periodId: Id, type: DistributionType):
    Observable<{ columns: DistributionColumn[]; rows: DistributionRow[] }>;
  ledgerAccountsTree(periodId: Id): Observable<LedgerAccountRow[]>;
  ledgerTransactions(periodId: Id): Observable<LedgerTxnRow[]>;
  installments(periodId: Id):
    Observable<{ columns: InstallmentColumn[]; rows: InstallmentRow[] }>;
}

/** The reactive runtime, exposed as bound hooks (DI via context). */
export interface AppRuntime {
  useModule(): Module;
  setModule(m: Module): void;
  useSection(): CondominiSection;
  setSection(s: CondominiSection): void;

  useCondominiumTree(): CondominiumNode[];
  useSelection(): Selection;
  select(sel: Selection): void;

  useCondominiumDetail(): CondominiumDetail | null;
  useUnitsTree(): UnitRow[];
  useDistributionTables(): DistributionTable[];
  useSelectedTableId(): Id | null;
  selectTable(id: Id): void;
  useDistribution(type: DistributionType):
    { columns: DistributionColumn[]; rows: DistributionRow[] };
  useLedgerAccountsTree(): LedgerAccountRow[];
  useLedgerTransactions(): LedgerTxnRow[];
  useInstallments(): { columns: InstallmentColumn[]; rows: InstallmentRow[] };
}

/** Grid adapter contract — independent of TanStack. */
export interface TreeColumn<Row> {
  id: string;
  header: string;
  align?: "left" | "right";
  /** render a cell; receives the row */
  cell: (row: Row) => React.ReactNode;
  /** optional inline editor; when present cell is editable */
  editor?: (row: Row, commit: (next: Row) => void) => React.ReactNode;
}
export interface TreeTableProps<Row extends { id: string; children?: Row[] }> {
  rows: Row[];
  columns: TreeColumn<Row>[];
  getRowKind?: (row: Row) => string; // for group/subtotal styling
  selectedId?: string | null;
  onSelect?: (row: Row) => void;
}
```

- [ ] **Step 5: Create `packages/application/src/index.ts`**

```ts
export * from "./types";
export * from "./ports";
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @cl/application typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/application
git commit -m "feat(application): DTO types and ports (AppRuntime, MockDataSource, TreeTable)"
```

---

## Task 4: `apps/web` — Vite + React + Vitest scaffold

**Files:**
- Create: `apps/web/package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.setup.ts`, `index.html`
- Create: `apps/web/src/main.tsx`, `apps/web/src/App.tsx`
- Test: `apps/web/src/smoke.test.tsx`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@cl/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@cl/application": "workspace:*",
    "@cl/domain": "workspace:*",
    "@react-rxjs/core": "^0.10.7",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-dialog": "^1.1.1",
    "@radix-ui/react-tooltip": "^1.1.2",
    "@radix-ui/react-popover": "^1.1.1",
    "@radix-ui/react-dropdown-menu": "^2.1.1",
    "@tanstack/react-table": "^8.20.5",
    "lucide-react": "^0.439.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^25.0.0",
    "vite": "^5.4.3",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["vitest/globals", "@testing-library/jest-dom"] },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `apps/web/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    css: true,
  },
});
```

- [ ] **Step 4: Create `apps/web/vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Create `apps/web/index.html`**

```html
<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CondoLedger — Amministrazione Condomini</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `apps/web/src/App.tsx`**

```tsx
export function App() {
  return <div>CondoLedger</div>;
}
```

- [ ] **Step 7: Create `apps/web/src/main.tsx`**

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 8: Write smoke test `apps/web/src/smoke.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { App } from "./App";

test("renders app name", () => {
  render(<App />);
  expect(screen.getByText("CondoLedger")).toBeInTheDocument();
});
```

- [ ] **Step 9: Install deps and run the smoke test**

Run: `pnpm install && pnpm --filter @cl/web test`
Expected: PASS (1 test). If install is sandboxed/offline, note it and proceed once deps are available.

- [ ] **Step 10: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "chore(web): Vite + React + Vitest scaffold"
```

---

## Task 5: Design tokens + theme

**Files:**
- Create: `apps/web/src/styles/tokens.css`, `theme-dark.css`, `global.css`
- Test: `apps/web/src/styles/tokens.test.ts`

- [ ] **Step 1: Create `apps/web/src/styles/tokens.css`** (light/default theme; modern-but-dense)

```css
:root {
  /* color — surfaces */
  --surface-app: #f1f3f5;
  --surface-panel: #ffffff;
  --surface-panel-header: #f8f9fa;
  --surface-row: #ffffff;
  --surface-row-alt: #f8f9fb;
  --surface-row-hover: #eef2ff;
  --surface-row-selected: #dbe7ff;
  --surface-header: #1f2a37;       /* dark top bar */
  --surface-group: #eef1f4;        /* group/subtotal rows */
  /* color — borders */
  --border-subtle: #e6e8eb;
  --border-strong: #ced4da;
  /* color — text */
  --text-primary: #1f2937;
  --text-secondary: #4b5563;
  --text-muted: #9ca3af;
  --text-on-header: #e5e7eb;
  /* color — accent + semantic */
  --accent: #2563eb;
  --accent-hover: #1d4ed8;
  --money-positive: #1d4ed8;       /* blue, as legacy */
  --money-negative: #dc2626;       /* red */
  --status-active: #16a34a;
  --status-closed: #9ca3af;
  --warning: #d97706;
  /* typography */
  --font-sans: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-num: "Inter", ui-monospace, "SF Mono", Menlo, monospace;
  --fs-xs: 11px; --fs-sm: 12px; --fs-md: 13px; --fs-lg: 15px; --fs-xl: 18px;
  --fw-regular: 400; --fw-medium: 500; --fw-bold: 700;
  --lh-tight: 1.2; --lh-normal: 1.4;
  /* spacing */
  --sp-1: 2px; --sp-2: 4px; --sp-3: 6px; --sp-4: 8px; --sp-5: 12px; --sp-6: 16px; --sp-7: 24px;
  /* sizing */
  --row-h: 24px; --toolbar-h: 34px; --sidebar-w: 280px; --topbar-h: 40px; --nav-h: 32px;
  /* elevation + radius */
  --radius-sm: 4px; --radius-md: 6px;
  --shadow-pop: 0 4px 16px rgba(0,0,0,0.16);
}
```

- [ ] **Step 2: Create `apps/web/src/styles/theme-dark.css`** (proves token swap)

```css
:root[data-theme="dark"] {
  --surface-app: #0f1115;
  --surface-panel: #161a20;
  --surface-panel-header: #1b2027;
  --surface-row: #161a20;
  --surface-row-alt: #1a1f26;
  --surface-row-hover: #1f2630;
  --surface-row-selected: #243044;
  --surface-header: #0b0d10;
  --surface-group: #1d232b;
  --border-subtle: #262c34;
  --border-strong: #333b45;
  --text-primary: #e5e7eb;
  --text-secondary: #b6bcc4;
  --text-muted: #7b828c;
  --text-on-header: #e5e7eb;
  --accent: #3b82f6;
  --money-positive: #60a5fa;
  --money-negative: #f87171;
}
```

- [ ] **Step 3: Create `apps/web/src/styles/global.css`**

```css
@import "./tokens.css";
@import "./theme-dark.css";

* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body {
  font-family: var(--font-sans);
  font-size: var(--fs-md);
  color: var(--text-primary);
  background: var(--surface-app);
  line-height: var(--lh-normal);
}
```

- [ ] **Step 4: Write token test `apps/web/src/styles/tokens.test.ts`**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("tokens define the required theme variables", () => {
  const css = readFileSync(resolve(__dirname, "tokens.css"), "utf8");
  for (const v of [
    "--surface-header", "--accent", "--money-positive", "--money-negative",
    "--row-h", "--sidebar-w", "--font-sans",
  ]) {
    expect(css).toContain(v);
  }
});

test("dark theme overrides core surfaces", () => {
  const css = readFileSync(resolve(__dirname, "theme-dark.css"), "utf8");
  expect(css).toContain('[data-theme="dark"]');
  expect(css).toContain("--surface-app");
});
```

- [ ] **Step 5: Import global.css in `main.tsx`**

Add as the first import in `apps/web/src/main.tsx`:

```tsx
import "./styles/global.css";
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @cl/web test src/styles/tokens.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/styles apps/web/src/main.tsx
git commit -m "feat(web): design tokens + dark theme + global styles"
```

---

## Task 6: Formatting primitives (TDD)

Money/number/status/date cells consuming tokens + the `Money` type.

**Files:**
- Create: `apps/web/src/format/Money.tsx` (+ `Money.module.css`), `Coefficient.tsx`, `NumberCell.tsx`, `StatusChip.tsx` (+ `.module.css`), `DateText.tsx`, `index.ts`
- Test: `apps/web/src/format/format.test.tsx`

- [ ] **Step 1: Write failing test `apps/web/src/format/format.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { fromCents } from "@cl/domain";
import { MoneyText } from "./Money";
import { Coefficient } from "./Coefficient";
import { StatusChip } from "./StatusChip";

test("positive money is blue and formatted", () => {
  render(<MoneyText value={fromCents(123456)} />);
  const el = screen.getByText("1.234,56");
  expect(el).toHaveClass("positive");
});
test("negative money is red", () => {
  render(<MoneyText value={fromCents(-5000)} />);
  expect(screen.getByText("-50,00")).toHaveClass("negative");
});
test("coefficient shows 4 decimals it-IT", () => {
  render(<Coefficient value={12.5} />);
  expect(screen.getByText("12,5000")).toBeInTheDocument();
});
test("status chip renders label", () => {
  render(<StatusChip status="active" />);
  expect(screen.getByText("Attivo")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cl/web test src/format/format.test.tsx`
Expected: FAIL (modules missing).

- [ ] **Step 3: Create `apps/web/src/format/Money.module.css`**

```css
.cell { font-family: var(--font-num); font-variant-numeric: tabular-nums; text-align: right; }
.positive { color: var(--money-positive); }
.negative { color: var(--money-negative); }
.zero { color: var(--text-muted); }
```

- [ ] **Step 4: Create `apps/web/src/format/Money.tsx`**

```tsx
import type { Money } from "@cl/domain";
import { formatEUR } from "@cl/domain";
import styles from "./Money.module.css";

export function MoneyText({ value }: { value: Money }) {
  const tone = value.cents > 0 ? "positive" : value.cents < 0 ? "negative" : "zero";
  return <span className={`${styles.cell} ${styles[tone]}`}>{formatEUR(value)}</span>;
}
```

- [ ] **Step 5: Create `apps/web/src/format/Coefficient.tsx`**

```tsx
import styles from "./Money.module.css";

export function Coefficient({ value }: { value: number }) {
  return (
    <span className={styles.cell}>
      {value.toLocaleString("it-IT", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
    </span>
  );
}
```

- [ ] **Step 6: Create `apps/web/src/format/NumberCell.tsx`**

```tsx
import styles from "./Money.module.css";
export function NumberCell({ value }: { value: number }) {
  return <span className={styles.cell}>{value.toLocaleString("it-IT")}</span>;
}
```

- [ ] **Step 7: Create `apps/web/src/format/StatusChip.module.css`**

```css
.chip { display: inline-flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-xs); }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.active { background: var(--status-active); }
.closed { background: var(--status-closed); }
```

- [ ] **Step 8: Create `apps/web/src/format/StatusChip.tsx`**

```tsx
import styles from "./StatusChip.module.css";

const LABELS = { active: "Attivo", inactive: "Inattivo", closed: "Chiuso" } as const;
export function StatusChip({ status }: { status: keyof typeof LABELS }) {
  const tone = status === "active" ? "active" : "closed";
  return (
    <span className={styles.chip}>
      <span className={`${styles.dot} ${styles[tone]}`} />
      {LABELS[status]}
    </span>
  );
}
```

- [ ] **Step 9: Create `apps/web/src/format/DateText.tsx`**

```tsx
export function DateText({ iso }: { iso: string | null }) {
  if (!iso) return <span>—</span>;
  const d = new Date(iso);
  return <span>{d.toLocaleDateString("it-IT")}</span>;
}
```

- [ ] **Step 10: Create `apps/web/src/format/index.ts`**

```ts
export { MoneyText } from "./Money";
export { Coefficient } from "./Coefficient";
export { NumberCell } from "./NumberCell";
export { StatusChip } from "./StatusChip";
export { DateText } from "./DateText";
```

> Note: CSS Modules `styles[tone]` returns the hashed name; in tests we assert the *source* class (`positive`). Vitest with `css: true` (Task 4) maps module classes to their names, so `toHaveClass("positive")` works.

- [ ] **Step 11: Run test to verify it passes**

Run: `pnpm --filter @cl/web test src/format/format.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/format
git commit -m "feat(web): formatting primitives (Money/Coefficient/Number/Status/Date)"
```

---

## Task 7: Mock data — fixtures + MockDataSource

Realistic fixtures modeled on Saturno & Pozzetto (from the legacy screenshots), exposed as observables implementing `MockDataSource`.

**Files:**
- Create: `apps/web/src/mock/fixtures.ts`, `apps/web/src/mock/MockDataSource.ts`
- Test: `apps/web/src/mock/MockDataSource.test.ts`

- [ ] **Step 1: Create `apps/web/src/mock/fixtures.ts`**

```ts
import { fromCents } from "@cl/domain";
import type {
  CondominiumNode, CondominiumDetail, UnitRow, DistributionTable,
  DistributionColumn, DistributionRow, LedgerAccountRow, LedgerTxnRow,
  InstallmentColumn, InstallmentRow, Id,
} from "@cl/application";

const c = fromCents;

export const tree: CondominiumNode[] = [
  {
    id: "poz", code: "POZ",
    name: "Pozzetto (34071 Nimis (GO) - Italia)", type: "regular",
    periods: [{ id: "poz-2010", name: "2010 (Ordinario)", type: "ordinary", closed: false, start: "2010-01-01", end: "2010-12-31" }],
  },
  {
    id: "sat", code: "SAT",
    name: "Saturno (Piazza del Duomo, 39, 33100 Udine)", type: "regular",
    periods: [{ id: "sat-2011", name: "2011 (Ordinario)", type: "ordinary", closed: false, start: "2011-01-01", end: "2011-12-31" }],
  },
];

export const detailByPeriod: Record<Id, CondominiumDetail> = {
  "poz-2010": {
    intestazione: "Pozzetto", codice: "POZ", status: "active", tipo: "Condominio",
    indirizzo: "34071 Nimis (GO) - Italia", codiceFiscale: "—",
    dataCostruzione: null, datiCatastali: null, idSistema: "19",
    creatoIl: "2011-03-11T14:55:57", modificatoIl: "2011-03-11T14:55:57",
    suppliers: [
      { id: "s1", nominativo: "Acme Pulizie S.r.l.", categoria: "Pulizie" },
      { id: "s2", nominativo: "Verdi Giardini", categoria: "Giardinaggio" },
    ],
  },
  "sat-2011": {
    intestazione: "Saturno", codice: "SAT", status: "active", tipo: "Condominio",
    indirizzo: "Piazza del Duomo, 39, 33100 Udine", codiceFiscale: "—",
    dataCostruzione: null, datiCatastali: null, idSistema: "20",
    creatoIl: "2011-03-11T14:55:57", modificatoIl: "2011-03-11T14:55:57",
    suppliers: [{ id: "s3", nominativo: "Banca Pop. Emilia Romagna", categoria: "Banca" }],
  },
};

export const unitsByPeriod: Record<Id, UnitRow[]> = {
  "sat-2011": [
    {
      id: "g-sat", kind: "group", label: "Saturno / 2011 (via A. Marangoni, 4, Udine)",
      saldoPrec: c(-625099), preventivo: c(3800000), consuntivo: c(3439865), totDovuto: c(2814766), versato: c(0),
      children: [
        {
          id: "u-a01", kind: "unit", label: "A01 - Alberi Dina (PR)", unitType: "Appartamento",
          floor: "T", inner: "1", sub: "—", restriction: "01/01/2011 - 31/12/2011",
          saldoPrec: c(-86065), preventivo: c(148727), consuntivo: c(151180), totDovuto: c(65115), versato: c(0),
          children: [
            { id: "r-a01-1", kind: "resident", label: "Alberi Dina (PR 100%)",
              saldoPrec: c(-86065), preventivo: c(148727), consuntivo: c(151180), totDovuto: c(65115), versato: c(0) },
          ],
        },
        {
          id: "u-a02", kind: "unit", label: "A02 - Mauri Dina, Picech Giorgio", unitType: "Appartamento",
          floor: "1", inner: "2", sub: "—", restriction: "01/01/2011 - 31/12/2011",
          saldoPrec: c(-43739), preventivo: c(214823), consuntivo: c(193551), totDovuto: c(149814), versato: c(0),
          children: [
            { id: "r-a02-1", kind: "resident", label: "Mauri Dina (PR 100%)",
              saldoPrec: c(-43739), preventivo: c(214823), consuntivo: c(193551), totDovuto: c(149814), versato: c(0) },
            { id: "r-a02-2", kind: "resident", label: "Picech Giorgio (PR)",
              saldoPrec: c(0), preventivo: c(0), consuntivo: c(0), totDovuto: c(0), versato: c(0) },
          ],
        },
      ],
    },
  ],
  "poz-2010": [
    {
      id: "g-poz", kind: "group", label: "Pozzetto / 2010 (Nimis GO)",
      saldoPrec: c(0), preventivo: c(1200000), consuntivo: c(1180000), totDovuto: c(1180000), versato: c(0),
      children: [
        { id: "u-p01", kind: "unit", label: "P01 - Floreani Tiziano", unitType: "Appartamento",
          floor: "T", inner: "1", sub: "—", restriction: "01/01/2010 - 31/12/2010",
          saldoPrec: c(0), preventivo: c(600000), consuntivo: c(590000), totDovuto: c(590000), versato: c(0) },
      ],
    },
  ],
};

export const distributionTablesByPeriod: Record<Id, DistributionTable[]> = {
  "sat-2011": [
    { id: "t-prop", name: "Proprietà", restriction: null, total: 1000,
      items: [
        { unitId: "u-a01", unitLabel: "A01 - Alberi Dina", coefficient: 312.5, competenza: "intero" },
        { unitId: "u-a02", unitLabel: "A02 - Mauri/Picech", coefficient: 687.5, competenza: "intero" },
      ] },
    { id: "t-scale", name: "Scale", restriction: null, total: 1000,
      items: [
        { unitId: "u-a01", unitLabel: "A01 - Alberi Dina", coefficient: 400, competenza: "intero" },
        { unitId: "u-a02", unitLabel: "A02 - Mauri/Picech", coefficient: 600, competenza: "intero" },
      ] },
  ],
  "poz-2010": [
    { id: "t-prop-p", name: "Proprietà", restriction: null, total: 1000,
      items: [{ unitId: "u-p01", unitLabel: "P01 - Floreani Tiziano", coefficient: 1000, competenza: "intero" }] },
  ],
};

export const distributionByPeriod: Record<Id, Record<"estimate" | "current", { columns: DistributionColumn[]; rows: DistributionRow[] }>> = {
  "sat-2011": {
    estimate: {
      columns: [{ accountId: "e-pul", header: "Pulizie" }, { accountId: "e-asc", header: "Ascensore" }],
      rows: [
        { id: "d-g", kind: "group", label: "Totale", amounts: { "e-pul": c(120000), "e-asc": c(80000) }, total: c(200000),
          children: [
            { id: "d-a01", kind: "unit", label: "A01 - Alberi Dina", amounts: { "e-pul": c(37500), "e-asc": c(32000) }, total: c(69500) },
            { id: "d-a02", kind: "unit", label: "A02 - Mauri/Picech", amounts: { "e-pul": c(82500), "e-asc": c(48000) }, total: c(130500) },
          ] },
      ],
    },
    current: {
      columns: [{ accountId: "e-pul", header: "Pulizie" }, { accountId: "e-asc", header: "Ascensore" }],
      rows: [
        { id: "d-g", kind: "group", label: "Totale", amounts: { "e-pul": c(118000), "e-asc": c(81000) }, total: c(199000),
          children: [
            { id: "d-a01", kind: "unit", label: "A01 - Alberi Dina", amounts: { "e-pul": c(36875), "e-asc": c(32400) }, total: c(69275) },
            { id: "d-a02", kind: "unit", label: "A02 - Mauri/Picech", amounts: { "e-pul": c(81125), "e-asc": c(48600) }, total: c(129725) },
          ] },
      ],
    },
  },
  "poz-2010": {
    estimate: { columns: [{ accountId: "e-pul", header: "Pulizie" }],
      rows: [{ id: "d-gp", kind: "group", label: "Totale", amounts: { "e-pul": c(60000) }, total: c(60000),
        children: [{ id: "d-p01", kind: "unit", label: "P01 - Floreani Tiziano", amounts: { "e-pul": c(60000) }, total: c(60000) }] }] },
    current: { columns: [{ accountId: "e-pul", header: "Pulizie" }],
      rows: [{ id: "d-gp", kind: "group", label: "Totale", amounts: { "e-pul": c(59000) }, total: c(59000),
        children: [{ id: "d-p01", kind: "unit", label: "P01 - Floreani Tiziano", amounts: { "e-pul": c(59000) }, total: c(59000) }] }] },
  },
};

export const ledgerAccountsByPeriod: Record<Id, LedgerAccountRow[]> = {
  "sat-2011": [
    { id: "tot", kind: "grouping", label: "Totale", dare: c(1776959), avere: c(1776959), saldo: c(0), preventivo: null,
      children: [
        { id: "patr", kind: "grouping", label: "Patrimoniali", dare: c(1036959), avere: c(1036959), saldo: c(0), preventivo: null,
          children: [
            { id: "att", kind: "grouping", label: "(Attività)", dare: c(1014200), avere: c(772372), saldo: c(241828), preventivo: null,
              children: [
                { id: "liq", kind: "grouping", label: "Liquidità", dare: c(243231), avere: c(175864), saldo: c(67467), preventivo: null,
                  children: [
                    { id: "cassa", kind: "regular", label: "Cassa Contanti", dare: c(13552), avere: c(2350), saldo: c(11202), preventivo: null },
                    { id: "banca", kind: "regular", label: "Banca Pop. Emilia Romagna - C/C 0764.94", dare: c(214189), avere: c(173550), saldo: c(40675), preventivo: null },
                  ] },
              ] },
          ] },
      ] },
  ],
  "poz-2010": [
    { id: "tot-p", kind: "grouping", label: "Totale", dare: c(600000), avere: c(600000), saldo: c(0), preventivo: null,
      children: [
        { id: "liq-p", kind: "regular", label: "Cassa Contanti", dare: c(600000), avere: c(590000), saldo: c(10000), preventivo: null },
      ] },
  ],
};

export const ledgerTxnsByPeriod: Record<Id, LedgerTxnRow[]> = {
  "sat-2011": [
    { id: "tx1", date: "2011-01-01", code: 1, description: "Apertura saldi iniziali", dare: c(625099), avere: c(625099),
      entries: [
        { account: "Saldo condòmini A01", dare: c(86065), avere: c(0) },
        { account: "Patrimonio iniziale", dare: c(0), avere: c(625099) },
      ] },
    { id: "tx2", date: "2011-03-15", code: 2, description: "Registrazione fattura Pulizie Acme", dare: c(120000), avere: c(120000),
      entries: [
        { account: "Pulizie", dare: c(120000), avere: c(0) },
        { account: "Fornitori c/acquisti", dare: c(0), avere: c(120000) },
      ] },
    { id: "tx3", date: "2011-04-02", code: 3, description: "Incasso rata A02 Mauri", dare: c(100000), avere: c(100000),
      entries: [
        { account: "Banca Pop. Emilia Romagna", dare: c(100000), avere: c(0) },
        { account: "Condòmini c/rate A02", dare: c(0), avere: c(100000) },
      ] },
  ],
  "poz-2010": [
    { id: "txp1", date: "2010-02-01", code: 1, description: "Apertura", dare: c(600000), avere: c(600000),
      entries: [{ account: "Cassa", dare: c(600000), avere: c(0) }, { account: "Patrimonio", dare: c(0), avere: c(600000) }] },
  ],
};

export const installmentsByPeriod: Record<Id, { columns: InstallmentColumn[]; rows: InstallmentRow[] }> = {
  "sat-2011": {
    columns: [{ id: "r1", header: "Rata 1" }, { id: "r2", header: "Rata 2" }, { id: "r3", header: "Rata 3" }],
    rows: [
      { id: "i-g", kind: "group", label: "Saturno / 2011", saldoPrec: c(-625099), totPreventivo: c(3800000), totDovuto: c(2814766),
        byInstallment: { r1: c(1266667), r2: c(1266667), r3: c(1266666) },
        children: [
          { id: "i-a01", kind: "unit", label: "A01 - Alberi Dina", role: "Proprietario", restriction: "01/01/2011 - 31/12/2011",
            saldoPrec: c(-86065), totPreventivo: c(148727), totDovuto: c(65115),
            byInstallment: { r1: c(49576), r2: c(49576), r3: c(49575) } },
          { id: "i-a02", kind: "unit", label: "A02 - Mauri/Picech", role: "Proprietario", restriction: "01/01/2011 - 31/12/2011",
            saldoPrec: c(-43739), totPreventivo: c(214823), totDovuto: c(149814),
            byInstallment: { r1: c(71608), r2: c(71608), r3: c(71607) } },
        ] },
    ],
  },
  "poz-2010": {
    columns: [{ id: "r1", header: "Rata 1" }, { id: "r2", header: "Rata 2" }],
    rows: [
      { id: "i-gp", kind: "group", label: "Pozzetto / 2010", saldoPrec: c(0), totPreventivo: c(1200000), totDovuto: c(1180000),
        byInstallment: { r1: c(600000), r2: c(600000) },
        children: [
          { id: "i-p01", kind: "unit", label: "P01 - Floreani Tiziano", role: "Proprietario",
            saldoPrec: c(0), totPreventivo: c(600000), totDovuto: c(590000),
            byInstallment: { r1: c(300000), r2: c(300000) } },
        ] },
    ],
  },
};
```

- [ ] **Step 2: Create `apps/web/src/mock/MockDataSource.ts`**

```ts
import { of, type Observable } from "rxjs";
import type { MockDataSource, Id, DistributionType } from "@cl/application";
import * as fx from "./fixtures";

export function createMockDataSource(): MockDataSource {
  return {
    condominiumTree: () => of(fx.tree),
    condominiumDetail: (periodId: Id) => of(fx.detailByPeriod[periodId] ?? null),
    unitsTree: (periodId: Id) => of(fx.unitsByPeriod[periodId] ?? []),
    distributionTables: (periodId: Id) => of(fx.distributionTablesByPeriod[periodId] ?? []),
    distribution: (periodId: Id, type: DistributionType) =>
      of(fx.distributionByPeriod[periodId]?.[type] ?? { columns: [], rows: [] }),
    ledgerAccountsTree: (periodId: Id) => of(fx.ledgerAccountsByPeriod[periodId] ?? []),
    ledgerTransactions: (periodId: Id) => of(fx.ledgerTxnsByPeriod[periodId] ?? []),
    installments: (periodId: Id) => of(fx.installmentsByPeriod[periodId] ?? { columns: [], rows: [] }),
  } satisfies MockDataSource as unknown as MockDataSource;
}
```

> The `Observable` import keeps the return types explicit; `of(...)` provides synchronous emission so tests are deterministic.

- [ ] **Step 3: Write test `apps/web/src/mock/MockDataSource.test.ts`**

```ts
import { firstValueFrom } from "rxjs";
import { createMockDataSource } from "./MockDataSource";

test("tree has Saturno and Pozzetto", async () => {
  const ds = createMockDataSource();
  const tree = await firstValueFrom(ds.condominiumTree());
  expect(tree.map((c) => c.code).sort()).toEqual(["POZ", "SAT"]);
});
test("units cascade from period id", async () => {
  const ds = createMockDataSource();
  const units = await firstValueFrom(ds.unitsTree("sat-2011"));
  expect(units[0].children?.length).toBeGreaterThan(0);
});
test("unknown period yields empty", async () => {
  const ds = createMockDataSource();
  expect(await firstValueFrom(ds.unitsTree("nope"))).toEqual([]);
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @cl/web test src/mock/MockDataSource.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/mock
git commit -m "feat(web): mock data source + Saturno/Pozzetto fixtures"
```

---

## Task 8: Composition-root runtime (react-rxjs + context DI) — TDD

The canonical pattern: `createAppRuntime(deps)` builds RxJS subjects + scoped bound hooks; `AppRuntimeProvider` calls it once and provides via context; `useAppRuntime()` reads it. Includes the isolation test proving no module singletons.

**Files:**
- Create: `apps/web/src/runtime/createAppRuntime.ts`, `AppRuntimeProvider.tsx`, `useAppRuntime.ts`
- Test: `apps/web/src/runtime/runtime.test.tsx`

- [ ] **Step 1: Create `apps/web/src/runtime/createAppRuntime.ts`**

```ts
import { BehaviorSubject, combineLatest, of, switchMap, map } from "rxjs";
import { bind } from "@react-rxjs/core";
import type {
  AppRuntime, MockDataSource, Module, CondominiSection, Selection,
  DistributionType, Id,
} from "@cl/application";

export function createAppRuntime(deps: { data: MockDataSource }): AppRuntime {
  const { data } = deps;

  const module$ = new BehaviorSubject<Module>("condomini");
  const section$ = new BehaviorSubject<CondominiSection>("dati");
  const selection$ = new BehaviorSubject<Selection>({});
  const selectedTable$ = new BehaviorSubject<Id | null>(null);

  const periodId$ = selection$.pipe(map((s) => s.accountingPeriodId ?? null));

  // bound hooks scoped to THIS factory call (no module singletons)
  const [useModule] = bind(module$);
  const [useSection] = bind(section$);
  const [useSelection] = bind(selection$);
  const [useSelectedTableId] = bind(selectedTable$);

  const [useCondominiumTree] = bind(data.condominiumTree(), []);
  const [useCondominiumDetail] = bind(
    periodId$.pipe(switchMap((id) => (id ? data.condominiumDetail(id) : of(null)))),
    null,
  );
  const [useUnitsTree] = bind(
    periodId$.pipe(switchMap((id) => (id ? data.unitsTree(id) : of([])))),
    [],
  );
  const [useDistributionTables] = bind(
    periodId$.pipe(switchMap((id) => (id ? data.distributionTables(id) : of([])))),
    [],
  );
  const distribution = (type: DistributionType) =>
    bind(
      periodId$.pipe(switchMap((id) => (id ? data.distribution(id, type) : of({ columns: [], rows: [] })))),
      { columns: [], rows: [] },
    );
  const [useEstimate] = distribution("estimate");
  const [useCurrent] = distribution("current");
  const [useLedgerAccountsTree] = bind(
    periodId$.pipe(switchMap((id) => (id ? data.ledgerAccountsTree(id) : of([])))),
    [],
  );
  const [useLedgerTransactions] = bind(
    periodId$.pipe(switchMap((id) => (id ? data.ledgerTransactions(id) : of([])))),
    [],
  );
  const [useInstallments] = bind(
    periodId$.pipe(switchMap((id) => (id ? data.installments(id) : of({ columns: [], rows: [] })))),
    { columns: [], rows: [] },
  );

  return {
    useModule, setModule: (m) => module$.next(m),
    useSection, setSection: (s) => section$.next(s),
    useCondominiumTree,
    useSelection, select: (sel) => selection$.next(sel),
    useCondominiumDetail,
    useUnitsTree,
    useDistributionTables,
    useSelectedTableId, selectTable: (id) => selectedTable$.next(id),
    useDistribution: (type) => (type === "estimate" ? useEstimate() : useCurrent()),
    useLedgerAccountsTree,
    useLedgerTransactions,
    useInstallments,
  };
}
```

> `combineLatest` is imported for future derived streams; if unused at lint time, remove it. The key invariant: every `bind(...)` is created **inside** the factory, so two `createAppRuntime` calls produce fully independent hooks.

- [ ] **Step 2: Create `apps/web/src/runtime/AppRuntimeProvider.tsx`**

```tsx
import { createContext, useRef, type ReactNode } from "react";
import type { AppRuntime, MockDataSource } from "@cl/application";
import { createMockDataSource } from "../mock/MockDataSource";
import { createAppRuntime } from "./createAppRuntime";

export const AppRuntimeContext = createContext<AppRuntime | null>(null);

export function AppRuntimeProvider({
  children,
  data,
}: {
  children: ReactNode;
  data?: MockDataSource;
}) {
  const ref = useRef<AppRuntime | null>(null);
  if (ref.current === null) {
    ref.current = createAppRuntime({ data: data ?? createMockDataSource() });
  }
  return (
    <AppRuntimeContext.Provider value={ref.current}>
      {children}
    </AppRuntimeContext.Provider>
  );
}
```

- [ ] **Step 3: Create `apps/web/src/runtime/useAppRuntime.ts`**

```ts
import { useContext } from "react";
import { AppRuntimeContext } from "./AppRuntimeProvider";
import type { AppRuntime } from "@cl/application";

export function useAppRuntime(): AppRuntime {
  const rt = useContext(AppRuntimeContext);
  if (!rt) throw new Error("useAppRuntime must be used within <AppRuntimeProvider>");
  return rt;
}
```

- [ ] **Step 4: Write test `apps/web/src/runtime/runtime.test.tsx`**

```tsx
import { render, screen, act } from "@testing-library/react";
import { Suspense } from "react";
import { AppRuntimeProvider } from "./AppRuntimeProvider";
import { useAppRuntime } from "./useAppRuntime";

function TreeProbe() {
  const rt = useAppRuntime();
  const tree = rt.useCondominiumTree();
  return <div data-testid="count">{tree.length}</div>;
}
function SelectionProbe() {
  const rt = useAppRuntime();
  const sel = rt.useSelection();
  return (
    <div>
      <button onClick={() => rt.select({ condominiumId: "sat", accountingPeriodId: "sat-2011" })}>pick</button>
      <span data-testid="sel">{sel.accountingPeriodId ?? "none"}</span>
    </div>
  );
}

test("provides condominium tree from mock", () => {
  render(
    <AppRuntimeProvider>
      <Suspense fallback="loading"><TreeProbe /></Suspense>
    </AppRuntimeProvider>,
  );
  expect(screen.getByTestId("count")).toHaveTextContent("2");
});

test("two providers do NOT share state (no singletons)", async () => {
  function App() {
    return (
      <>
        <AppRuntimeProvider><SelectionProbe /></AppRuntimeProvider>
        <AppRuntimeProvider><SelectionProbe /></AppRuntimeProvider>
      </>
    );
  }
  render(<App />);
  const [btnA] = screen.getAllByText("pick");
  await act(async () => { btnA.click(); });
  const sels = screen.getAllByTestId("sel");
  expect(sels[0]).toHaveTextContent("sat-2011");
  expect(sels[1]).toHaveTextContent("none"); // second instance untouched
});
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @cl/web test src/runtime/runtime.test.tsx`
Expected: PASS (2 tests). The second test failing would indicate accidental module-singleton state — the whole point of the pattern.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/runtime
git commit -m "feat(web): composition-root runtime (react-rxjs hooks via context DI)"
```

---

## Task 9: Shell — TopBar, MainNav, Breadcrumb

**Files:**
- Create: `apps/web/src/components/common/Icon.tsx`
- Create: `apps/web/src/components/shell/TopBar.tsx` (+ `.module.css`)
- Create: `apps/web/src/components/shell/MainNav.tsx` (+ `.module.css`)
- Create: `apps/web/src/components/shell/Breadcrumb.tsx` (+ `.module.css`)
- Test: `apps/web/src/components/shell/shell.test.tsx`

- [ ] **Step 1: Create `apps/web/src/components/common/Icon.tsx`** (swappable icon seam)

```tsx
import {
  Home, Plus, Pencil, Trash2, Printer, FileText, Sheet, RefreshCw,
  Search, Calendar, Building2, Users, Info, ChevronRight, ChevronDown,
  LogOut, Globe, type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  home: Home, add: Plus, edit: Pencil, remove: Trash2, print: Printer,
  pdf: FileText, excel: Sheet, refresh: RefreshCw, search: Search,
  calendar: Calendar, building: Building2, users: Users, info: Info,
  chevronRight: ChevronRight, chevronDown: ChevronDown, logout: LogOut, lang: Globe,
};
export function Icon({ name, size = 16 }: { name: keyof typeof MAP | string; size?: number }) {
  const C = MAP[name] ?? Info;
  return <C size={size} aria-hidden />;
}
```

- [ ] **Step 2: Create `apps/web/src/components/shell/TopBar.module.css`**

```css
.bar {
  height: var(--topbar-h); background: var(--surface-header); color: var(--text-on-header);
  display: flex; align-items: center; justify-content: space-between; padding: 0 var(--sp-6);
}
.brand { display: flex; align-items: center; gap: var(--sp-4); font-weight: var(--fw-bold); letter-spacing: 0.5px; }
.subtitle { color: var(--text-muted); font-weight: var(--fw-regular); font-size: var(--fs-sm); }
.right { display: flex; align-items: center; gap: var(--sp-6); font-size: var(--fs-sm); }
.item { display: flex; align-items: center; gap: var(--sp-2); color: var(--text-on-header); }
.label { color: var(--text-muted); }
.logout { display: flex; align-items: center; gap: var(--sp-2); background: none; border: none; color: var(--text-on-header); cursor: pointer; }
```

- [ ] **Step 3: Create `apps/web/src/components/shell/TopBar.tsx`**

```tsx
import { Icon } from "../common/Icon";
import styles from "./TopBar.module.css";

export function TopBar() {
  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        CondoLedger
        <span className={styles.subtitle}>Amministrazione Condomini</span>
      </div>
      <div className={styles.right}>
        <span className={styles.item}><span className={styles.label}>Account:</span> vito</span>
        <span className={styles.item}><span className={styles.label}>Profilo:</span> Amministratore</span>
        <span className={styles.item}><span className={styles.label}>Studio:</span> Studio Bertoli Amministrazioni</span>
        <span className={styles.item}><Icon name="lang" /> IT</span>
        <button className={styles.logout}><Icon name="logout" /> Esci</button>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Create `apps/web/src/components/shell/MainNav.module.css`**

```css
.nav { height: var(--nav-h); background: var(--surface-panel); border-bottom: 1px solid var(--border-strong);
  display: flex; align-items: stretch; padding: 0 var(--sp-6); }
.tab { display: flex; align-items: center; gap: var(--sp-2); padding: 0 var(--sp-5);
  background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer; font-size: var(--fs-md); }
.tab:hover { color: var(--text-primary); }
.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: var(--fw-medium); }
```

- [ ] **Step 5: Create `apps/web/src/components/shell/MainNav.tsx`**

```tsx
import type { Module } from "@cl/application";
import { Icon } from "../common/Icon";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import styles from "./MainNav.module.css";

const TABS: { id: Module; label: string; icon: string }[] = [
  { id: "calendario", label: "Calendario", icon: "calendar" },
  { id: "condomini", label: "Condomini", icon: "building" },
  { id: "anagrafiche", label: "Anagrafiche", icon: "users" },
];

export function MainNav() {
  const rt = useAppRuntime();
  const active = rt.useModule();
  return (
    <nav className={styles.nav}>
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`${styles.tab} ${active === t.id ? styles.active : ""}`}
          onClick={() => rt.setModule(t.id)}
        >
          <Icon name={t.icon} /> {t.label}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 6: Create `apps/web/src/components/shell/Breadcrumb.module.css`**

```css
.bar { display: flex; align-items: center; gap: var(--sp-3); height: var(--nav-h);
  padding: 0 var(--sp-6); background: var(--surface-panel-header); border-bottom: 1px solid var(--border-subtle);
  color: var(--text-secondary); font-size: var(--fs-sm); }
.seg { color: var(--text-secondary); }
.last { color: var(--text-primary); font-weight: var(--fw-medium); }
```

- [ ] **Step 7: Create `apps/web/src/components/shell/Breadcrumb.tsx`**

```tsx
import { Icon } from "../common/Icon";
import styles from "./Breadcrumb.module.css";

export function Breadcrumb({ segments }: { segments: string[] }) {
  return (
    <div className={styles.bar}>
      <Icon name="home" size={14} />
      {segments.map((s, i) => (
        <span key={i} className={i === segments.length - 1 ? styles.last : styles.seg}>
          <Icon name="chevronRight" size={12} /> {s}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Write test `apps/web/src/components/shell/shell.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { TopBar } from "./TopBar";
import { MainNav } from "./MainNav";
import { Breadcrumb } from "./Breadcrumb";

test("topbar shows brand and logout", () => {
  render(<TopBar />);
  expect(screen.getByText("CondoLedger")).toBeInTheDocument();
  expect(screen.getByText("Esci")).toBeInTheDocument();
});
test("nav switches active module", async () => {
  render(<AppRuntimeProvider><MainNav /></AppRuntimeProvider>);
  const anagrafiche = screen.getByText("Anagrafiche");
  await userEvent.click(anagrafiche);
  expect(anagrafiche.closest("button")).toHaveClass("active");
});
test("breadcrumb marks last segment", () => {
  render(<Breadcrumb segments={["Condomini", "Saturno", "Dati"]} />);
  expect(screen.getByText("Dati")).toHaveClass("last");
});
```

- [ ] **Step 9: Run tests**

Run: `pnpm --filter @cl/web test src/components/shell`
Expected: PASS (3 tests).

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/shell apps/web/src/components/common/Icon.tsx
git commit -m "feat(web): shell — TopBar, MainNav, Breadcrumb"
```

---

## Task 10: Sidebar — GestioneTree + SectionMenu

**Files:**
- Create: `apps/web/src/components/sidebar/GestioneTree.tsx` (+ `.module.css`)
- Create: `apps/web/src/components/sidebar/SectionMenu.tsx` (+ `.module.css`)
- Create: `apps/web/src/components/sidebar/Sidebar.tsx` (+ `.module.css`)
- Test: `apps/web/src/components/sidebar/sidebar.test.tsx`

- [ ] **Step 1: Create `apps/web/src/components/sidebar/GestioneTree.module.css`**

```css
.panel { display: flex; flex-direction: column; min-height: 0; }
.title { font-size: var(--fs-sm); font-weight: var(--fw-bold); padding: var(--sp-4) var(--sp-5);
  background: var(--surface-panel-header); border-bottom: 1px solid var(--border-subtle); }
.list { overflow: auto; padding: var(--sp-3); }
.cond { font-weight: var(--fw-medium); padding: var(--sp-2) var(--sp-3); display: flex; align-items: center; gap: var(--sp-2); }
.period { padding: var(--sp-2) var(--sp-3) var(--sp-2) var(--sp-7); cursor: pointer; border-radius: var(--radius-sm); }
.period:hover { background: var(--surface-row-hover); }
.selected { background: var(--surface-row-selected); }
```

- [ ] **Step 2: Create `apps/web/src/components/sidebar/GestioneTree.tsx`**

```tsx
import { Icon } from "../common/Icon";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import styles from "./GestioneTree.module.css";

export function GestioneTree() {
  const rt = useAppRuntime();
  const tree = rt.useCondominiumTree();
  const sel = rt.useSelection();
  return (
    <div className={styles.panel}>
      <div className={styles.title}>Scegli Gestione</div>
      <div className={styles.list}>
        {tree.map((cond) => (
          <div key={cond.id}>
            <div className={styles.cond}><Icon name="building" size={14} /> {cond.code} — {cond.name.split(" (")[0]}</div>
            {cond.periods.map((p) => (
              <div
                key={p.id}
                className={`${styles.period} ${sel.accountingPeriodId === p.id ? styles.selected : ""}`}
                onClick={() => rt.select({ condominiumId: cond.id, accountingPeriodId: p.id })}
              >
                {p.name}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/web/src/components/sidebar/SectionMenu.module.css`**

```css
.panel { border-top: 1px solid var(--border-strong); display: flex; flex-direction: column; }
.title { font-size: var(--fs-sm); font-weight: var(--fw-bold); padding: var(--sp-4) var(--sp-5);
  background: var(--surface-panel-header); border-bottom: 1px solid var(--border-subtle); }
.item { display: flex; align-items: center; justify-content: space-between; padding: var(--sp-4) var(--sp-5);
  background: none; border: none; width: 100%; text-align: left; cursor: pointer; color: var(--text-secondary);
  border-bottom: 1px solid var(--border-subtle); font-size: var(--fs-md); }
.item:hover { background: var(--surface-row-hover); color: var(--text-primary); }
.active { color: var(--accent); font-weight: var(--fw-medium); background: var(--surface-row-selected); }
.disabled { color: var(--text-muted); cursor: not-allowed; }
```

- [ ] **Step 4: Create `apps/web/src/components/sidebar/SectionMenu.tsx`**

```tsx
import type { CondominiSection } from "@cl/application";
import { Icon } from "../common/Icon";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import styles from "./SectionMenu.module.css";

const ITEMS: { id: CondominiSection; label: string }[] = [
  { id: "dati", label: "Dati Condomini e Fornitori" },
  { id: "unita", label: "Unità, Condòmini e Bilancio Personale" },
  { id: "tabelle", label: "Tabelle Millesimali e Riparto" },
  { id: "conti", label: "Conti, Mastrini e Bilancio" },
  { id: "giornale", label: "Libro Giornale e Prima Nota" },
  { id: "rate", label: "Prospetto Rate" },
];

export function SectionMenu() {
  const rt = useAppRuntime();
  const active = rt.useSection();
  const sel = rt.useSelection();
  const enabled = Boolean(sel.accountingPeriodId);
  return (
    <div className={styles.panel}>
      <div className={styles.title}>Menu Gestione</div>
      {ITEMS.map((it) => (
        <button
          key={it.id}
          disabled={!enabled}
          className={`${styles.item} ${active === it.id ? styles.active : ""} ${!enabled ? styles.disabled : ""}`}
          onClick={() => rt.setSection(it.id)}
        >
          {it.label}
          {it.id === "dati" || it.id === "conti" ? <Icon name="chevronRight" size={12} /> : null}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create `apps/web/src/components/sidebar/Sidebar.module.css`**

```css
.sidebar { width: var(--sidebar-w); min-width: var(--sidebar-w); display: flex; flex-direction: column;
  background: var(--surface-panel); border-right: 1px solid var(--border-strong); overflow: hidden; }
.top { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.bottom { flex: 0 0 auto; }
```

- [ ] **Step 6: Create `apps/web/src/components/sidebar/Sidebar.tsx`**

```tsx
import { GestioneTree } from "./GestioneTree";
import { SectionMenu } from "./SectionMenu";
import styles from "./Sidebar.module.css";

export function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.top}><GestioneTree /></div>
      <div className={styles.bottom}><SectionMenu /></div>
    </aside>
  );
}
```

- [ ] **Step 7: Write test `apps/web/src/components/sidebar/sidebar.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { Sidebar } from "./Sidebar";

function wrap() { return render(<AppRuntimeProvider><Sidebar /></AppRuntimeProvider>); }

test("section menu disabled until a period is selected", () => {
  wrap();
  expect(screen.getByText("Tabelle Millesimali e Riparto").closest("button")).toBeDisabled();
});
test("selecting a period enables the menu and selects it", async () => {
  wrap();
  await userEvent.click(screen.getByText("2011 (Ordinario)"));
  const tabelle = screen.getByText("Tabelle Millesimali e Riparto").closest("button")!;
  expect(tabelle).not.toBeDisabled();
  await userEvent.click(tabelle);
  expect(tabelle).toHaveClass("active");
});
```

- [ ] **Step 8: Run tests**

Run: `pnpm --filter @cl/web test src/components/sidebar`
Expected: PASS (2 tests).

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/sidebar
git commit -m "feat(web): sidebar — GestioneTree + SectionMenu"
```

---

## Task 11: Layout — SplitPane, SectionPanel, DetailPanel, FormCard, ActionToolbar, Legenda

**Files:**
- Create: `apps/web/src/components/common/ActionToolbar.tsx` (+ `.module.css`), `IconButton.tsx`, `Legenda.tsx` (+ `.module.css`)
- Create: `apps/web/src/components/layout/SplitPane.tsx` (+ `.module.css`), `SectionPanel.tsx` (+ `.module.css`), `DetailPanel.tsx` (+ `.module.css`), `FormCard.tsx` (+ `.module.css`)
- Test: `apps/web/src/components/layout/layout.test.tsx`

- [ ] **Step 1: Create `apps/web/src/components/common/IconButton.tsx`**

```tsx
import { Icon } from "./Icon";
import styles from "./ActionToolbar.module.css";

export function IconButton({
  icon, label, onClick, disabled, primary,
}: { icon: string; label: string; onClick?: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      className={`${styles.btn} ${primary ? styles.primary : ""}`}
      title={label} aria-label={label} onClick={onClick} disabled={disabled}
    >
      <Icon name={icon} />
    </button>
  );
}
```

- [ ] **Step 2: Create `apps/web/src/components/common/ActionToolbar.module.css`**

```css
.bar { height: var(--toolbar-h); display: flex; align-items: center; gap: var(--sp-2);
  padding: 0 var(--sp-4); border-bottom: 1px solid var(--border-subtle); background: var(--surface-panel-header); }
.btn { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px;
  border: 1px solid transparent; border-radius: var(--radius-sm); background: none; color: var(--text-secondary); cursor: pointer; }
.btn:hover { background: var(--surface-row-hover); color: var(--text-primary); }
.btn:disabled { color: var(--text-muted); cursor: not-allowed; }
.primary { color: var(--status-active); }
.sep { width: 1px; height: 18px; background: var(--border-subtle); margin: 0 var(--sp-2); }
.spacer { flex: 1; }
```

- [ ] **Step 3: Create `apps/web/src/components/common/ActionToolbar.tsx`**

```tsx
import { IconButton } from "./IconButton";
import styles from "./ActionToolbar.module.css";

export interface ToolbarAction { icon: string; label: string; onClick?: () => void; disabled?: boolean; primary?: boolean; sep?: boolean; }

export function ActionToolbar({ actions, right }: { actions: ToolbarAction[]; right?: React.ReactNode }) {
  return (
    <div className={styles.bar}>
      {actions.map((a, i) =>
        a.sep ? <span key={i} className={styles.sep} /> :
        <IconButton key={i} icon={a.icon} label={a.label} onClick={a.onClick} disabled={a.disabled} primary={a.primary} />,
      )}
      <span className={styles.spacer} />
      {right}
    </div>
  );
}

export const STANDARD_ACTIONS: ToolbarAction[] = [
  { icon: "add", label: "Aggiungi", primary: true },
  { icon: "edit", label: "Modifica" },
  { icon: "remove", label: "Rimuovi" },
  { sep: true, icon: "", label: "" },
  { icon: "print", label: "Stampa" },
  { icon: "pdf", label: "PDF" },
  { icon: "excel", label: "Excel" },
  { sep: true, icon: "", label: "" },
  { icon: "refresh", label: "Aggiorna" },
];
```

- [ ] **Step 4: Create `apps/web/src/components/common/Legenda.module.css`**

```css
.trigger { display: inline-flex; align-items: center; gap: var(--sp-2); background: none; border: none;
  color: var(--accent); cursor: pointer; font-size: var(--fs-sm); }
.content { background: var(--surface-panel); border: 1px solid var(--border-strong); border-radius: var(--radius-md);
  box-shadow: var(--shadow-pop); padding: var(--sp-5); font-size: var(--fs-sm); max-width: 280px; }
.count { color: var(--text-secondary); font-size: var(--fs-sm); margin-right: var(--sp-5); }
```

- [ ] **Step 5: Create `apps/web/src/components/common/Legenda.tsx`**

```tsx
import * as Popover from "@radix-ui/react-popover";
import { Icon } from "./Icon";
import styles from "./Legenda.module.css";

export function Legenda({ children }: { children: React.ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger className={styles.trigger}><Icon name="info" size={14} /> Legenda</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.content} sideOffset={4}>{children}</Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function RecordCount({ n, noun }: { n: number; noun: string }) {
  return <span className={styles.count}>{n} {noun}</span>;
}
```

- [ ] **Step 6: Create `apps/web/src/components/layout/SplitPane.module.css`**

```css
.split { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.top { flex: 1 1 60%; min-height: 0; overflow: auto; }
.divider { height: 6px; background: var(--surface-group); border-top: 1px solid var(--border-subtle);
  border-bottom: 1px solid var(--border-subtle); cursor: row-resize; }
.bottom { flex: 1 1 40%; min-height: 0; overflow: auto; }
```

- [ ] **Step 7: Create `apps/web/src/components/layout/SplitPane.tsx`** (simple fixed split; resize is cosmetic for the prototype)

```tsx
import styles from "./SplitPane.module.css";

export function SplitPane({ top, bottom }: { top: React.ReactNode; bottom: React.ReactNode }) {
  return (
    <div className={styles.split}>
      <div className={styles.top}>{top}</div>
      <div className={styles.divider} role="separator" aria-orientation="horizontal" />
      <div className={styles.bottom}>{bottom}</div>
    </div>
  );
}
```

- [ ] **Step 8: Create `apps/web/src/components/layout/SectionPanel.module.css`**

```css
.panel { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--surface-panel); }
.header { display: flex; align-items: center; justify-content: space-between; padding: var(--sp-4) var(--sp-6);
  border-bottom: 1px solid var(--border-strong); }
.title { font-weight: var(--fw-bold); font-size: var(--fs-lg); }
.headerRight { display: flex; align-items: center; }
.body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
```

- [ ] **Step 9: Create `apps/web/src/components/layout/SectionPanel.tsx`**

```tsx
import { ActionToolbar, type ToolbarAction } from "../common/ActionToolbar";
import { Legenda, RecordCount } from "../common/Legenda";
import styles from "./SectionPanel.module.css";

export function SectionPanel({
  title, actions, count, countNoun = "elementi", legend, children, toolbarRight,
}: {
  title: string; actions: ToolbarAction[]; count?: number; countNoun?: string;
  legend?: React.ReactNode; children: React.ReactNode; toolbarRight?: React.ReactNode;
}) {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <span className={styles.headerRight}>
          {count !== undefined && <RecordCount n={count} noun={countNoun} />}
          {legend && <Legenda>{legend}</Legenda>}
        </span>
      </div>
      <ActionToolbar actions={actions} right={toolbarRight} />
      <div className={styles.body}>{children}</div>
    </div>
  );
}
```

- [ ] **Step 10: Create `apps/web/src/components/layout/FormCard.module.css`**

```css
.card { padding: var(--sp-6); overflow: auto; }
.group { margin-bottom: var(--sp-6); }
.groupTitle { font-size: var(--fs-sm); font-weight: var(--fw-bold); color: var(--text-secondary);
  border-bottom: 1px solid var(--border-subtle); padding-bottom: var(--sp-2); margin-bottom: var(--sp-3); }
.row { display: grid; grid-template-columns: 180px 1fr; gap: var(--sp-4); padding: var(--sp-2) 0; }
.label { color: var(--text-secondary); }
.value { color: var(--text-primary); }
```

- [ ] **Step 11: Create `apps/web/src/components/layout/FormCard.tsx`**

```tsx
import styles from "./FormCard.module.css";

export function FormCard({ children }: { children: React.ReactNode }) {
  return <div className={styles.card}>{children}</div>;
}
export function FieldGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className={styles.group}>
      {title && <div className={styles.groupTitle}>{title}</div>}
      {children}
    </div>
  );
}
export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value ?? "—"}</span>
    </div>
  );
}
```

- [ ] **Step 12: Create `apps/web/src/components/layout/DetailPanel.module.css`**

```css
.root { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.list { display: flex; gap: var(--sp-1); border-bottom: 1px solid var(--border-strong); padding: 0 var(--sp-5); background: var(--surface-panel-header); }
.trigger { padding: var(--sp-3) var(--sp-5); background: none; border: none; border-bottom: 2px solid transparent;
  color: var(--text-secondary); cursor: pointer; font-size: var(--fs-md); }
.trigger[data-state="active"] { color: var(--accent); border-bottom-color: var(--accent); font-weight: var(--fw-medium); }
.content { flex: 1; min-height: 0; overflow: auto; }
```

- [ ] **Step 13: Create `apps/web/src/components/layout/DetailPanel.tsx`**

```tsx
import * as Tabs from "@radix-ui/react-tabs";
import styles from "./DetailPanel.module.css";

export interface DetailTab { id: string; label: string; content: React.ReactNode; }
export function DetailPanel({ tabs }: { tabs: DetailTab[] }) {
  if (tabs.length === 0) return null;
  return (
    <Tabs.Root defaultValue={tabs[0].id} className={styles.root}>
      <Tabs.List className={styles.list}>
        {tabs.map((t) => <Tabs.Trigger key={t.id} value={t.id} className={styles.trigger}>{t.label}</Tabs.Trigger>)}
      </Tabs.List>
      {tabs.map((t) => <Tabs.Content key={t.id} value={t.id} className={styles.content}>{t.content}</Tabs.Content>)}
    </Tabs.Root>
  );
}
```

- [ ] **Step 14: Write test `apps/web/src/components/layout/layout.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SectionPanel } from "./SectionPanel";
import { STANDARD_ACTIONS } from "../common/ActionToolbar";
import { DetailPanel } from "./DetailPanel";
import { FormCard, FieldGroup, Field } from "./FormCard";

test("section panel shows title, count and actions", () => {
  render(<SectionPanel title="Dati Condominio" actions={STANDARD_ACTIONS} count={2} countNoun="condomini"><div>body</div></SectionPanel>);
  expect(screen.getByText("Dati Condominio")).toBeInTheDocument();
  expect(screen.getByText("2 condomini")).toBeInTheDocument();
  expect(screen.getByLabelText("Aggiungi")).toBeInTheDocument();
});
test("detail tabs switch", async () => {
  render(<DetailPanel tabs={[
    { id: "a", label: "Scheda", content: <FormCard><FieldGroup title="X"><Field label="Codice" value="SAT" /></FieldGroup></FormCard> },
    { id: "b", label: "Fornitori", content: <div>suppliers</div> },
  ]} />);
  expect(screen.getByText("SAT")).toBeVisible();
  await userEvent.click(screen.getByText("Fornitori"));
  expect(screen.getByText("suppliers")).toBeVisible();
});
```

- [ ] **Step 15: Run tests**

Run: `pnpm --filter @cl/web test src/components/layout`
Expected: PASS (2 tests).

- [ ] **Step 16: Commit**

```bash
git add apps/web/src/components/layout apps/web/src/components/common
git commit -m "feat(web): layout primitives — SectionPanel, DetailPanel, FormCard, toolbar, Legenda"
```

---

## Task 12: TreeTable grid adapter (TanStack) + inline editors + contract test

Implements the `TreeTableProps`/`TreeColumn` ports from Task 3 over TanStack Table, with expand/collapse, group/subtotal styling, selection, and inline cell editors.

**Files:**
- Create: `apps/web/src/components/grid/TreeTable.tsx` (+ `.module.css`)
- Create: `apps/web/src/components/grid/inlineEditors.tsx`
- Test: `apps/web/src/components/grid/TreeTable.test.tsx`

- [ ] **Step 1: Create `apps/web/src/components/grid/TreeTable.module.css`**

```css
.table { width: 100%; border-collapse: collapse; font-size: var(--fs-md); }
.th { text-align: left; font-weight: var(--fw-bold); color: var(--text-secondary); background: var(--surface-panel-header);
  border-bottom: 1px solid var(--border-strong); padding: var(--sp-2) var(--sp-4); position: sticky; top: 0; }
.thRight { text-align: right; }
.tr { height: var(--row-h); }
.tr:nth-child(even) { background: var(--surface-row-alt); }
.tr:hover { background: var(--surface-row-hover); }
.selected { background: var(--surface-row-selected) !important; }
.group { background: var(--surface-group); font-weight: var(--fw-bold); }
.td { padding: var(--sp-1) var(--sp-4); border-bottom: 1px solid var(--border-subtle); white-space: nowrap; }
.tdRight { text-align: right; }
.tree { display: inline-flex; align-items: center; gap: var(--sp-2); }
.toggle { background: none; border: none; cursor: pointer; padding: 0; color: var(--text-secondary); display: inline-flex; }
.spacer { display: inline-block; }
.editInput { width: 100%; border: 1px solid var(--accent); border-radius: var(--radius-sm);
  padding: 0 var(--sp-2); font-family: var(--font-num); text-align: right; font-size: var(--fs-md); }
```

- [ ] **Step 2: Create `apps/web/src/components/grid/TreeTable.tsx`**

```tsx
import { useState } from "react";
import {
  useReactTable, getCoreRowModel, getExpandedRowModel, flexRender,
  type ColumnDef, type ExpandedState, type Row as TanRow,
} from "@tanstack/react-table";
import type { TreeColumn, TreeTableProps } from "@cl/application";
import { Icon } from "../common/Icon";
import styles from "./TreeTable.module.css";

export function TreeTable<Row extends { id: string; children?: Row[] }>(
  { rows, columns, getRowKind, selectedId, onSelect }: TreeTableProps<Row>,
) {
  const [expanded, setExpanded] = useState<ExpandedState>(true); // expand all by default

  const colDefs: ColumnDef<Row>[] = columns.map((c, idx) => ({
    id: c.id,
    header: c.header,
    cell: ({ row }) => {
      const node = c.editor
        ? c.editor(row.original, (next) => { /* commit handled by caller via onSelect-less port */ void next; })
        : c.cell(row.original);
      if (idx === 0) {
        return (
          <span className={styles.tree} style={{ paddingLeft: row.depth * 14 }}>
            {row.getCanExpand() ? (
              <button className={styles.toggle} onClick={(e) => { e.stopPropagation(); row.toggleExpanded(); }}>
                <Icon name={row.getIsExpanded() ? "chevronDown" : "chevronRight"} size={12} />
              </button>
            ) : <span className={styles.spacer} style={{ width: 12 }} />}
            {node}
          </span>
        );
      }
      return node;
    },
    meta: { align: c.align },
  }));

  const table = useReactTable({
    data: rows,
    columns: colDefs,
    state: { expanded },
    onExpandedChange: setExpanded,
    getSubRows: (r) => r.children,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  return (
    <table className={styles.table}>
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((h) => {
              const align = (h.column.columnDef.meta as { align?: string } | undefined)?.align;
              return (
                <th key={h.id} className={`${styles.th} ${align === "right" ? styles.thRight : ""}`}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row: TanRow<Row>) => {
          const kind = getRowKind?.(row.original);
          const isGroup = kind === "group";
          return (
            <tr
              key={row.id}
              className={`${styles.tr} ${isGroup ? styles.group : ""} ${selectedId === row.original.id ? styles.selected : ""}`}
              onClick={() => onSelect?.(row.original)}
            >
              {row.getVisibleCells().map((cell) => {
                const align = (cell.column.columnDef.meta as { align?: string } | undefined)?.align;
                return (
                  <td key={cell.id} className={`${styles.td} ${align === "right" ? styles.tdRight : ""}`}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: Create `apps/web/src/components/grid/inlineEditors.tsx`**

```tsx
import { useState } from "react";
import styles from "./TreeTable.module.css";

/** Inline numeric editor: click to edit, Enter/blur commits, Esc cancels. */
export function InlineNumber({
  value, onCommit, decimals = 4,
}: { value: number; onCommit: (next: number) => void; decimals?: number }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  if (!editing) {
    return (
      <span onDoubleClick={() => { setDraft(String(value)); setEditing(true); }}>
        {value.toLocaleString("it-IT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      </span>
    );
  }
  const commit = () => {
    const n = Number(draft.replace(",", "."));
    if (!Number.isNaN(n)) onCommit(n);
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

- [ ] **Step 4: Write contract test `apps/web/src/components/grid/TreeTable.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TreeColumn } from "@cl/application";
import { TreeTable } from "./TreeTable";
import { InlineNumber } from "./inlineEditors";

interface R { id: string; label: string; n: number; kind: string; children?: R[]; }
const rows: R[] = [
  { id: "g", label: "Gruppo", n: 1000, kind: "group", children: [
    { id: "u1", label: "Unità 1", n: 312.5, kind: "unit" },
    { id: "u2", label: "Unità 2", n: 687.5, kind: "unit" },
  ] },
];

test("renders hierarchy expanded with group styling and selection", async () => {
  const onSelect = vi.fn();
  const cols: TreeColumn<R>[] = [
    { id: "label", header: "Nome", cell: (r) => r.label },
    { id: "n", header: "Coeff", align: "right", cell: (r) => String(r.n) },
  ];
  render(<TreeTable rows={rows} columns={cols} getRowKind={(r) => r.kind} onSelect={onSelect} />);
  expect(screen.getByText("Gruppo").closest("tr")).toHaveClass("group");
  expect(screen.getByText("Unità 1")).toBeInTheDocument(); // expanded by default
  await userEvent.click(screen.getByText("Unità 1"));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }));
});

test("inline editor commits on Enter", async () => {
  const onCommit = vi.fn();
  render(<InlineNumber value={312.5} onCommit={onCommit} />);
  await userEvent.dblClick(screen.getByText("312,5000"));
  const input = screen.getByRole("textbox");
  await userEvent.clear(input);
  await userEvent.type(input, "400{Enter}");
  expect(onCommit).toHaveBeenCalledWith(400);
});
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @cl/web test src/components/grid`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/grid
git commit -m "feat(web): TreeTable adapter (TanStack) + inline editors"
```

---

## Task 13: Section — Dati Condominio & Fornitori

Composes `SectionPanel` + `TreeTable` (condominium → period) + `SplitPane` + `DetailPanel`.

**Files:**
- Create: `apps/web/src/sections/dati/DatiCondominioSection.tsx` (+ `.module.css`)
- Test: `apps/web/src/sections/dati/DatiCondominioSection.test.tsx`

- [ ] **Step 1: Create `apps/web/src/sections/dati/DatiCondominioSection.tsx`**

```tsx
import type { CondominiumNode, AccountingPeriodNode } from "@cl/application";
import type { TreeColumn } from "@cl/application";
import { SectionPanel } from "../../components/layout/SectionPanel";
import { SplitPane } from "../../components/layout/SplitPane";
import { DetailPanel } from "../../components/layout/DetailPanel";
import { FormCard, FieldGroup, Field } from "../../components/layout/FormCard";
import { TreeTable } from "../../components/grid/TreeTable";
import { STANDARD_ACTIONS } from "../../components/common/ActionToolbar";
import { StatusChip, DateText } from "../../format";
import { useAppRuntime } from "../../runtime/useAppRuntime";

interface DatiRow { id: string; kind: "cond" | "period"; code: string; name: string; tipo: string; closed?: boolean; competenza?: string; children?: DatiRow[]; }

function toRows(tree: CondominiumNode[]): DatiRow[] {
  return tree.map((c) => ({
    id: c.id, kind: "cond", code: c.code, name: c.name, tipo: "Condominio",
    children: c.periods.map((p: AccountingPeriodNode) => ({
      id: p.id, kind: "period", code: "", name: p.name, tipo: p.type,
      closed: p.closed, competenza: `${fmt(p.start)} - ${fmt(p.end)}`,
    })),
  }));
}
const fmt = (iso: string) => new Date(iso).toLocaleDateString("it-IT");

const columns: TreeColumn<DatiRow>[] = [
  { id: "name", header: "Condominio / Gestione", cell: (r) => (r.kind === "cond" ? `${r.code} — ${r.name}` : r.name) },
  { id: "tipo", header: "Tipo", cell: (r) => r.tipo },
  { id: "closed", header: "Chiuso", cell: (r) => (r.kind === "period" ? (r.closed ? "Sì" : "No") : "") },
  { id: "competenza", header: "Competenza", cell: (r) => r.competenza ?? "" },
];

export function DatiCondominioSection() {
  const rt = useAppRuntime();
  const tree = rt.useCondominiumTree();
  const detail = rt.useCondominiumDetail();
  const rows = toRows(tree);

  const tabs = detail ? [
    { id: "scheda", label: "Scheda Condominio", content: (
      <FormCard>
        <FieldGroup>
          <Field label="Intestazione" value={detail.intestazione} />
          <Field label="Codice condominio" value={detail.codice} />
          <Field label="Status" value={<StatusChip status={detail.status} />} />
          <Field label="Tipo" value={detail.tipo} />
          <Field label="Indirizzo" value={detail.indirizzo} />
          <Field label="Codice Fiscale" value={detail.codiceFiscale} />
          <Field label="Data costruzione" value={<DateText iso={detail.dataCostruzione} />} />
        </FieldGroup>
        <FieldGroup title="Altro">
          <Field label="Dati catastali" value={detail.datiCatastali} />
          <Field label="Id sistema" value={detail.idSistema} />
          <Field label="Creato il" value={<DateText iso={detail.creatoIl} />} />
          <Field label="Modificato il" value={<DateText iso={detail.modificatoIl} />} />
        </FieldGroup>
      </FormCard>
    ) },
    { id: "fornitori", label: "Fornitori del Condominio", content: (
      <FormCard>
        {detail.suppliers.map((s) => <Field key={s.id} label={s.categoria} value={s.nominativo} />)}
      </FormCard>
    ) },
  ] : [];

  return (
    <SectionPanel
      title="Dati Condominio" actions={STANDARD_ACTIONS}
      count={tree.length} countNoun="condomini"
      legend={<div>Righe gruppo = condominio; righe figlie = gestioni (esercizi).</div>}
    >
      <SplitPane
        top={<TreeTable rows={rows} columns={columns} getRowKind={(r) => (r.kind === "cond" ? "group" : "row")} />}
        bottom={<DetailPanel tabs={tabs} />}
      />
    </SectionPanel>
  );
}
```

- [ ] **Step 2: Write test `apps/web/src/sections/dati/DatiCondominioSection.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { DatiCondominioSection } from "./DatiCondominioSection";

function Harness() {
  return <AppRuntimeProvider><Inner /></AppRuntimeProvider>;
}
import { useAppRuntime } from "../../runtime/useAppRuntime";
function Inner() {
  const rt = useAppRuntime();
  return (
    <>
      <button onClick={() => rt.select({ condominiumId: "sat", accountingPeriodId: "sat-2011" })}>sel</button>
      <DatiCondominioSection />
    </>
  );
}

test("lists condominiums and shows detail after selection", async () => {
  render(<Harness />);
  expect(screen.getByText(/SAT — Saturno/)).toBeInTheDocument();
  expect(screen.getByText("2 condomini")).toBeInTheDocument();
  await userEvent.click(screen.getByText("sel"));
  expect(await screen.findByText("Saturno")).toBeInTheDocument(); // intestazione in detail
  await userEvent.click(screen.getByText("Fornitori del Condominio"));
  expect(screen.getByText("Banca Pop. Emilia Romagna")).toBeInTheDocument();
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @cl/web test src/sections/dati`
Expected: PASS (1 test).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/sections/dati
git commit -m "feat(web): Dati Condominio & Fornitori section"
```

---

## Task 14: Section — Unità, Condòmini & Bilancio Personale

**Files:**
- Create: `apps/web/src/sections/unita/UnitaSection.tsx`
- Test: `apps/web/src/sections/unita/UnitaSection.test.tsx`

- [ ] **Step 1: Create `apps/web/src/sections/unita/UnitaSection.tsx`**

```tsx
import type { UnitRow, TreeColumn } from "@cl/application";
import { SectionPanel } from "../../components/layout/SectionPanel";
import { SplitPane } from "../../components/layout/SplitPane";
import { DetailPanel } from "../../components/layout/DetailPanel";
import { FormCard, FieldGroup, Field } from "../../components/layout/FormCard";
import { TreeTable } from "../../components/grid/TreeTable";
import { STANDARD_ACTIONS } from "../../components/common/ActionToolbar";
import { MoneyText } from "../../format";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { useState } from "react";

const columns: TreeColumn<UnitRow>[] = [
  { id: "label", header: "Gruppi / Unità / Condòmini", cell: (r) => r.label },
  { id: "tipo", header: "Tipo", cell: (r) => r.unitType ?? "" },
  { id: "restr", header: "Restr. competenza", cell: (r) => r.restriction ?? "" },
  { id: "saldoPrec", header: "Saldo prec.", align: "right", cell: (r) => <MoneyText value={r.saldoPrec} /> },
  { id: "preventivo", header: "Preventivo", align: "right", cell: (r) => <MoneyText value={r.preventivo} /> },
  { id: "consuntivo", header: "Consuntivo", align: "right", cell: (r) => <MoneyText value={r.consuntivo} /> },
  { id: "totDovuto", header: "Tot. dovuto", align: "right", cell: (r) => <MoneyText value={r.totDovuto} /> },
  { id: "versato", header: "Versato", align: "right", cell: (r) => <MoneyText value={r.versato} /> },
];

function findById(rows: UnitRow[], id: string): UnitRow | null {
  for (const r of rows) {
    if (r.id === id) return r;
    if (r.children) { const f = findById(r.children, id); if (f) return f; }
  }
  return null;
}

export function UnitaSection() {
  const rt = useAppRuntime();
  const rows = rt.useUnitsTree();
  const [selId, setSelId] = useState<string | null>(null);
  const sel = selId ? findById(rows, selId) : null;

  const tabs = sel ? [
    { id: "scheda", label: "Scheda Unità", content: (
      <FormCard>
        <FieldGroup>
          <Field label="Nome unità" value={sel.label} />
          <Field label="Tipo" value={sel.unitType} />
        </FieldGroup>
        <FieldGroup title="Dati identificativi">
          <Field label="Piano" value={sel.floor} />
          <Field label="Interno" value={sel.inner} />
          <Field label="Subalterno" value={sel.sub} />
        </FieldGroup>
        <FieldGroup title="Periodo di competenza ristretto">
          <Field label="Competenza" value={sel.restriction} />
        </FieldGroup>
      </FormCard>
    ) },
    { id: "condomini", label: "Condòmini del unità", content: (
      <FormCard>
        {(sel.children ?? []).map((c) => <Field key={c.id} label={c.label} value={<MoneyText value={c.totDovuto} />} />)}
      </FormCard>
    ) },
  ] : [];

  const unitCount = rows.reduce((n, g) => n + (g.children?.length ?? 0), 0);

  return (
    <SectionPanel
      title="Unità, Condòmini e Bilancio Personale" actions={STANDARD_ACTIONS}
      count={unitCount} countNoun="unità"
      legend={<div>Gruppo → unità → condòmino. I valori monetari sono blu (positivi) / rossi (negativi).</div>}
    >
      <SplitPane
        top={<TreeTable rows={rows} columns={columns} getRowKind={(r) => (r.kind === "group" ? "group" : "row")} selectedId={selId} onSelect={(r) => setSelId(r.id)} />}
        bottom={<DetailPanel tabs={tabs} />}
      />
    </SectionPanel>
  );
}
```

- [ ] **Step 2: Write test `apps/web/src/sections/unita/UnitaSection.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { UnitaSection } from "./UnitaSection";

function Inner() {
  const rt = useAppRuntime();
  return <><button onClick={() => rt.select({ accountingPeriodId: "sat-2011" })}>sel</button><UnitaSection /></>;
}

test("shows units after selection and opens detail", async () => {
  render(<AppRuntimeProvider><Inner /></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  expect(await screen.findByText("A01 - Alberi Dina (PR)")).toBeInTheDocument();
  await userEvent.click(screen.getByText("A01 - Alberi Dina (PR)"));
  expect(await screen.findByText("Dati identificativi")).toBeInTheDocument();
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @cl/web test src/sections/unita`
Expected: PASS (1 test).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/sections/unita
git commit -m "feat(web): Unità & Bilancio Personale section"
```

---

## Task 15: Section — Tabelle Millesimali & Riparto (inline coefficient edit)

Three panes: tables list, editable coefficients, distribution grid with estimate/current toggle.

**Files:**
- Create: `apps/web/src/sections/tabelle/TabelleSection.tsx` (+ `.module.css`)
- Test: `apps/web/src/sections/tabelle/TabelleSection.test.tsx`

- [ ] **Step 1: Create `apps/web/src/sections/tabelle/TabelleSection.module.css`**

```css
.top { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); height: 100%; min-height: 0; }
.pane { display: flex; flex-direction: column; min-height: 0; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); overflow: auto; }
.paneTitle { font-weight: var(--fw-bold); font-size: var(--fs-sm); padding: var(--sp-3) var(--sp-4); background: var(--surface-panel-header); border-bottom: 1px solid var(--border-subtle); }
.tableItem { padding: var(--sp-3) var(--sp-4); cursor: pointer; display: flex; justify-content: space-between; }
.tableItem:hover { background: var(--surface-row-hover); }
.selected { background: var(--surface-row-selected); }
.toggle { display: flex; gap: var(--sp-2); padding: var(--sp-3) var(--sp-4); }
.toggleBtn { padding: var(--sp-2) var(--sp-4); border: 1px solid var(--border-strong); background: var(--surface-panel); border-radius: var(--radius-sm); cursor: pointer; }
.toggleActive { background: var(--accent); color: #fff; border-color: var(--accent); }
```

- [ ] **Step 2: Create `apps/web/src/sections/tabelle/TabelleSection.tsx`**

```tsx
import { useState } from "react";
import type { DistributionRow, DistributionTableItem, TreeColumn } from "@cl/application";
import { SectionPanel } from "../../components/layout/SectionPanel";
import { SplitPane } from "../../components/layout/SplitPane";
import { TreeTable } from "../../components/grid/TreeTable";
import { InlineNumber } from "../../components/grid/inlineEditors";
import { STANDARD_ACTIONS } from "../../components/common/ActionToolbar";
import { MoneyText, Coefficient } from "../../format";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import styles from "./TabelleSection.module.css";

export function TabelleSection() {
  const rt = useAppRuntime();
  const tables = rt.useDistributionTables();
  const [selTableId, setSelTableId] = useState<string | null>(tables[0]?.id ?? null);
  const [type, setType] = useState<"estimate" | "current">("estimate");
  const dist = rt.useDistribution(type);
  // local editable coefficient overrides (prototype: behind a port later)
  const [coeffOverrides, setCoeffOverrides] = useState<Record<string, number>>({});

  const selTable = tables.find((t) => t.id === selTableId) ?? tables[0] ?? null;

  const distColumns: TreeColumn<DistributionRow>[] = [
    { id: "label", header: "Conto / Unità", cell: (r) => r.label },
    ...dist.columns.map((c) => ({
      id: c.accountId, header: c.header, align: "right" as const,
      cell: (r: DistributionRow) => <MoneyText value={r.amounts[c.accountId] ?? { cents: 0 }} />,
    })),
    { id: "total", header: "Totale", align: "right", cell: (r: DistributionRow) => <MoneyText value={r.total} /> },
  ];

  return (
    <SectionPanel
      title="Tabelle Millesimali e Riparto" actions={STANDARD_ACTIONS}
      count={tables.length} countNoun="tabelle"
      legend={<div>Doppio-click su un coefficiente per modificarlo. Preventivo = stime; Consuntivo = importi effettivi.</div>}
    >
      <SplitPane
        top={
          <div className={styles.top}>
            <div className={styles.pane}>
              <div className={styles.paneTitle}>Tabelle</div>
              {tables.map((t) => (
                <div key={t.id} className={`${styles.tableItem} ${selTable?.id === t.id ? styles.selected : ""}`} onClick={() => setSelTableId(t.id)}>
                  <span>{t.name}</span><span>{t.total}</span>
                </div>
              ))}
            </div>
            <div className={styles.pane}>
              <div className={styles.paneTitle}>Coefficienti — {selTable?.name ?? "—"}</div>
              <table style={{ width: "100%", fontSize: "var(--fs-md)" }}>
                <thead><tr><th style={{ textAlign: "left", padding: 4 }}>Unità</th><th style={{ textAlign: "right", padding: 4 }}>Coefficiente</th></tr></thead>
                <tbody>
                  {(selTable?.items ?? []).map((it: DistributionTableItem) => {
                    const key = `${selTable!.id}:${it.unitId}`;
                    const value = coeffOverrides[key] ?? it.coefficient;
                    return (
                      <tr key={it.unitId}>
                        <td style={{ padding: 4 }}>{it.unitLabel}</td>
                        <td style={{ padding: 4, textAlign: "right" }}>
                          <InlineNumber value={value} onCommit={(n) => setCoeffOverrides((o) => ({ ...o, [key]: n }))} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        }
        bottom={
          <div>
            <div className={styles.toggle}>
              <button className={`${styles.toggleBtn} ${type === "estimate" ? styles.toggleActive : ""}`} onClick={() => setType("estimate")}>Preventivo</button>
              <button className={`${styles.toggleBtn} ${type === "current" ? styles.toggleActive : ""}`} onClick={() => setType("current")}>Consuntivo</button>
            </div>
            <TreeTable rows={dist.rows} columns={distColumns} getRowKind={(r) => (r.kind === "group" ? "group" : "row")} />
          </div>
        }
      />
    </SectionPanel>
  );
}
```

> `Coefficient` is imported for parity with the spec's read-only coefficient formatting; the editable cell uses `InlineNumber` (which formats identically when not editing). If lint flags the unused import, remove it.

- [ ] **Step 3: Write test `apps/web/src/sections/tabelle/TabelleSection.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { TabelleSection } from "./TabelleSection";

function Inner() {
  const rt = useAppRuntime();
  return <><button onClick={() => rt.select({ accountingPeriodId: "sat-2011" })}>sel</button><TabelleSection /></>;
}

test("lists tables, toggles preventivo/consuntivo, edits coefficient", async () => {
  render(<AppRuntimeProvider><Inner /></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  expect(await screen.findByText("Proprietà")).toBeInTheDocument();
  await userEvent.click(screen.getByText("Consuntivo"));
  // edit a coefficient
  const cell = await screen.findByText("312,5000");
  await userEvent.dblClick(cell);
  const input = screen.getByRole("textbox");
  await userEvent.clear(input);
  await userEvent.type(input, "400{Enter}");
  expect(screen.getByText("400,0000")).toBeInTheDocument();
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @cl/web test src/sections/tabelle`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/sections/tabelle
git commit -m "feat(web): Tabelle Millesimali & Riparto section (inline coefficient edit)"
```

---

## Task 16: Section — Conti, Mastrini & Bilancio

**Files:**
- Create: `apps/web/src/sections/conti/ContiSection.tsx`
- Test: `apps/web/src/sections/conti/ContiSection.test.tsx`

- [ ] **Step 1: Create `apps/web/src/sections/conti/ContiSection.tsx`**

```tsx
import { useState } from "react";
import type { LedgerAccountRow, TreeColumn } from "@cl/application";
import { SectionPanel } from "../../components/layout/SectionPanel";
import { SplitPane } from "../../components/layout/SplitPane";
import { DetailPanel } from "../../components/layout/DetailPanel";
import { FormCard, FieldGroup, Field } from "../../components/layout/FormCard";
import { TreeTable } from "../../components/grid/TreeTable";
import { STANDARD_ACTIONS } from "../../components/common/ActionToolbar";
import { MoneyText } from "../../format";
import { useAppRuntime } from "../../runtime/useAppRuntime";

const columns: TreeColumn<LedgerAccountRow>[] = [
  { id: "label", header: "Conti", cell: (r) => r.label },
  { id: "dare", header: "Dare", align: "right", cell: (r) => <MoneyText value={r.dare} /> },
  { id: "avere", header: "Avere", align: "right", cell: (r) => <MoneyText value={r.avere} /> },
  { id: "saldo", header: "Saldo", align: "right", cell: (r) => <MoneyText value={r.saldo} /> },
  { id: "preventivo", header: "Preventivo", align: "right", cell: (r) => (r.preventivo ? <MoneyText value={r.preventivo} /> : <span>—</span>) },
];

function find(rows: LedgerAccountRow[], id: string): LedgerAccountRow | null {
  for (const r of rows) { if (r.id === id) return r; if (r.children) { const f = find(r.children, id); if (f) return f; } }
  return null;
}

export function ContiSection() {
  const rt = useAppRuntime();
  const rows = rt.useLedgerAccountsTree();
  const [selId, setSelId] = useState<string | null>(null);
  const sel = selId ? find(rows, selId) : null;

  const tabs = sel ? [
    { id: "scheda", label: "Scheda Conto", content: (
      <FormCard>
        <FieldGroup>
          <Field label="Conto" value={sel.label} />
          <Field label="Tipo conto" value={sel.kind === "grouping" ? "Raggruppamento" : "Movimentabile"} />
        </FieldGroup>
        <FieldGroup title="Saldi conto">
          <Field label="Dare" value={<MoneyText value={sel.dare} />} />
          <Field label="Avere" value={<MoneyText value={sel.avere} />} />
          <Field label="Saldo" value={<MoneyText value={sel.saldo} />} />
        </FieldGroup>
      </FormCard>
    ) },
    { id: "mastrina", label: "Mastrina", content: (
      <FormCard><Field label="Movimenti" value="(prototipo) — i movimenti del mastrino verranno mostrati qui" /></FormCard>
    ) },
  ] : [];

  return (
    <SectionPanel
      title="Conti, Mastrini e Bilancio" actions={STANDARD_ACTIONS}
      legend={<div>Albero del piano dei conti. Raggruppamenti in grassetto con subtotali.</div>}
    >
      <SplitPane
        top={<TreeTable rows={rows} columns={columns} getRowKind={(r) => (r.kind === "grouping" ? "group" : "row")} selectedId={selId} onSelect={(r) => setSelId(r.id)} />}
        bottom={<DetailPanel tabs={tabs} />}
      />
    </SectionPanel>
  );
}
```

- [ ] **Step 2: Write test `apps/web/src/sections/conti/ContiSection.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { ContiSection } from "./ContiSection";

function Inner() {
  const rt = useAppRuntime();
  return <><button onClick={() => rt.select({ accountingPeriodId: "sat-2011" })}>sel</button><ContiSection /></>;
}

test("shows chart of accounts and account detail", async () => {
  render(<AppRuntimeProvider><Inner /></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  expect(await screen.findByText("Patrimoniali")).toBeInTheDocument();
  await userEvent.click(screen.getByText("Cassa Contanti"));
  expect(await screen.findByText("Saldi conto")).toBeInTheDocument();
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @cl/web test src/sections/conti`
Expected: PASS (1 test).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/sections/conti
git commit -m "feat(web): Conti, Mastrini & Bilancio section"
```

---

## Task 17: Section — Libro Giornale & Prima Nota (+ wizard shell)

**Files:**
- Create: `apps/web/src/sections/giornale/GiornaleSection.tsx` (+ `.module.css`)
- Create: `apps/web/src/components/common/WizardDialog.tsx` (+ `.module.css`)
- Test: `apps/web/src/sections/giornale/GiornaleSection.test.tsx`

- [ ] **Step 1: Create `apps/web/src/components/common/WizardDialog.module.css`**

```css
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); }
.content { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
  background: var(--surface-panel); border-radius: var(--radius-md); box-shadow: var(--shadow-pop);
  width: 520px; max-width: 90vw; padding: var(--sp-6); }
.title { font-weight: var(--fw-bold); font-size: var(--fs-lg); margin-bottom: var(--sp-4); }
.steps { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-5); }
.step { padding: var(--sp-2) var(--sp-4); border-radius: var(--radius-sm); background: var(--surface-group); font-size: var(--fs-sm); }
.stepActive { background: var(--accent); color: #fff; }
.note { color: var(--text-muted); font-size: var(--fs-sm); }
.actions { display: flex; justify-content: flex-end; gap: var(--sp-3); margin-top: var(--sp-6); }
.btn { padding: var(--sp-3) var(--sp-5); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface-panel); cursor: pointer; }
```

- [ ] **Step 2: Create `apps/web/src/components/common/WizardDialog.tsx`**

```tsx
import * as Dialog from "@radix-ui/react-dialog";
import styles from "./WizardDialog.module.css";

export function WizardDialog({
  open, onOpenChange, title, steps,
}: { open: boolean; onOpenChange: (o: boolean) => void; title: string; steps: string[] }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>{title}</Dialog.Title>
          <div className={styles.steps}>
            {steps.map((s, i) => <span key={i} className={`${styles.step} ${i === 0 ? styles.stepActive : ""}`}>{i + 1}. {s}</span>)}
          </div>
          <p className={styles.note}>Prototipo: i passi della procedura guidata sono illustrati ma non eseguono salvataggi.</p>
          <div className={styles.actions}>
            <button className={styles.btn} onClick={() => onOpenChange(false)}>Chiudi</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 3: Create `apps/web/src/sections/giornale/GiornaleSection.module.css`**

```css
.entries { padding: var(--sp-2) var(--sp-7); color: var(--text-secondary); font-size: var(--fs-sm); }
.entryRow { display: grid; grid-template-columns: 1fr 120px 120px; gap: var(--sp-4); padding: var(--sp-1) 0; }
```

- [ ] **Step 4: Create `apps/web/src/sections/giornale/GiornaleSection.tsx`**

```tsx
import { useState } from "react";
import type { LedgerTxnRow, TreeColumn } from "@cl/application";
import { SectionPanel } from "../../components/layout/SectionPanel";
import { TreeTable } from "../../components/grid/TreeTable";
import { WizardDialog } from "../../components/common/WizardDialog";
import { MoneyText, DateText } from "../../format";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import styles from "./GiornaleSection.module.css";

interface GRow extends LedgerTxnRow { children?: GRow[]; }

const columns: TreeColumn<GRow>[] = [
  { id: "date", header: "Data", cell: (r) => <DateText iso={r.date} /> },
  { id: "code", header: "N.", cell: (r) => String(r.code) },
  { id: "description", header: "Descrizione operazione", cell: (r) => r.description },
  { id: "dare", header: "Dare", align: "right", cell: (r) => <MoneyText value={r.dare} /> },
  { id: "avere", header: "Avere", align: "right", cell: (r) => <MoneyText value={r.avere} /> },
];

export function GiornaleSection() {
  const rt = useAppRuntime();
  const txns = rt.useLedgerTransactions() as GRow[];
  const [wizard, setWizard] = useState<string | null>(null);

  const actions = [
    { icon: "add", label: "Registra fattura", primary: true, onClick: () => setWizard("Registrazione Fattura") },
    { icon: "edit", label: "Incasso", onClick: () => setWizard("Incasso Condòmino") },
    { icon: "edit", label: "Saldi iniziali", onClick: () => setWizard("Apertura Saldi Iniziali") },
    { sep: true, icon: "", label: "" },
    { icon: "print", label: "Stampa" }, { icon: "pdf", label: "PDF" },
  ];

  const stepsByWizard: Record<string, string[]> = {
    "Registrazione Fattura": ["Fornitore e importi", "Ritenuta/IVA", "Conferma"],
    "Incasso Condòmino": ["Condòmino", "Importo e conto", "Conferma"],
    "Apertura Saldi Iniziali": ["Conto", "Saldi per condòmino", "Conferma"],
  };

  return (
    <SectionPanel
      title="Libro Giornale e Prima Nota" actions={actions}
      count={txns.length} countNoun="scritture"
      legend={<div>Ogni scrittura ha righe Dare/Avere bilanciate. Espandi per vedere le righe.</div>}
    >
      <TreeTable
        rows={txns} columns={columns} getRowKind={() => "row"}
      />
      {/* entries preview under the grid */}
      <div className={styles.entries}>
        {txns.map((t) => (
          <div key={t.id}>
            <strong>#{t.code} {t.description}</strong>
            {t.entries.map((e, i) => (
              <div key={i} className={styles.entryRow}>
                <span>{e.account}</span><MoneyText value={e.dare} /><MoneyText value={e.avere} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <WizardDialog open={wizard !== null} onOpenChange={(o) => !o && setWizard(null)}
        title={wizard ?? ""} steps={wizard ? stepsByWizard[wizard] ?? [] : []} />
    </SectionPanel>
  );
}
```

- [ ] **Step 5: Write test `apps/web/src/sections/giornale/GiornaleSection.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { GiornaleSection } from "./GiornaleSection";

function Inner() {
  const rt = useAppRuntime();
  return <><button onClick={() => rt.select({ accountingPeriodId: "sat-2011" })}>sel</button><GiornaleSection /></>;
}

test("shows journal and opens an invoice wizard", async () => {
  render(<AppRuntimeProvider><Inner /></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  expect(await screen.findByText("Registrazione fattura Pulizie Acme")).toBeInTheDocument();
  await userEvent.click(screen.getByLabelText("Registra fattura"));
  expect(await screen.findByText("1. Fornitore e importi")).toBeInTheDocument();
});
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @cl/web test src/sections/giornale`
Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/sections/giornale apps/web/src/components/common/WizardDialog.tsx apps/web/src/components/common/WizardDialog.module.css
git commit -m "feat(web): Libro Giornale & Prima Nota section + wizard shell"
```

---

## Task 18: Section — Prospetto Rate (+ wizard shell)

**Files:**
- Create: `apps/web/src/sections/rate/RateSection.tsx`
- Test: `apps/web/src/sections/rate/RateSection.test.tsx`

- [ ] **Step 1: Create `apps/web/src/sections/rate/RateSection.tsx`**

```tsx
import { useState } from "react";
import type { InstallmentRow, TreeColumn } from "@cl/application";
import { SectionPanel } from "../../components/layout/SectionPanel";
import { TreeTable } from "../../components/grid/TreeTable";
import { WizardDialog } from "../../components/common/WizardDialog";
import { MoneyText } from "../../format";
import { useAppRuntime } from "../../runtime/useAppRuntime";

export function RateSection() {
  const rt = useAppRuntime();
  const { columns: instCols, rows } = rt.useInstallments();
  const [wizard, setWizard] = useState(false);

  const columns: TreeColumn<InstallmentRow>[] = [
    { id: "label", header: "Unità / Condòmino", cell: (r) => r.label },
    { id: "role", header: "Ruolo", cell: (r) => r.role ?? "" },
    { id: "saldoPrec", header: "Saldo prec.", align: "right", cell: (r) => <MoneyText value={r.saldoPrec} /> },
    { id: "totPreventivo", header: "Tot. preventivo", align: "right", cell: (r) => <MoneyText value={r.totPreventivo} /> },
    { id: "totDovuto", header: "Tot. dovuto", align: "right", cell: (r) => <MoneyText value={r.totDovuto} /> },
    ...instCols.map((c) => ({
      id: c.id, header: c.header, align: "right" as const,
      cell: (r: InstallmentRow) => <MoneyText value={r.byInstallment[c.id] ?? { cents: 0 }} />,
    })),
  ];

  const actions = [
    { icon: "add", label: "Crea rate da preventivo", primary: true, onClick: () => setWizard(true) },
    { icon: "edit", label: "Modifica rata" },
    { sep: true, icon: "", label: "" },
    { icon: "print", label: "Stampa" }, { icon: "pdf", label: "PDF" },
  ];

  const unitCount = rows.reduce((n, g) => n + (g.children?.length ?? 0), 0);

  return (
    <SectionPanel
      title="Prospetto Rate" actions={actions} count={unitCount} countNoun="unità"
      legend={<div>Una colonna per rata. Gli importi sono modificabili nel prodotto finale.</div>}
    >
      <TreeTable rows={rows} columns={columns} getRowKind={(r) => (r.kind === "group" ? "group" : "row")} />
      <WizardDialog open={wizard} onOpenChange={setWizard}
        title="Crea Rate da Preventivo"
        steps={["Numero e periodo", "Distribuzione", "Revisione", "Conto liquidità"]} />
    </SectionPanel>
  );
}
```

- [ ] **Step 2: Write test `apps/web/src/sections/rate/RateSection.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { RateSection } from "./RateSection";

function Inner() {
  const rt = useAppRuntime();
  return <><button onClick={() => rt.select({ accountingPeriodId: "sat-2011" })}>sel</button><RateSection /></>;
}

test("shows installment columns and opens the create wizard", async () => {
  render(<AppRuntimeProvider><Inner /></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  expect(await screen.findByText("Rata 1")).toBeInTheDocument();
  expect(screen.getByText("Rata 3")).toBeInTheDocument();
  await userEvent.click(screen.getByLabelText("Crea rate da preventivo"));
  expect(await screen.findByText("1. Numero e periodo")).toBeInTheDocument();
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @cl/web test src/sections/rate`
Expected: PASS (1 test).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/sections/rate
git commit -m "feat(web): Prospetto Rate section + create-installments wizard shell"
```

---

## Task 19: Module stubs + Condomini router + AppShell wiring

Wire the shell + sidebar + sections into the app; stub Calendario/Anagrafiche; boot into a logged-in studio.

**Files:**
- Create: `apps/web/src/modules/CalendarioStub.tsx`, `AnagraficheStub.tsx` (+ shared `Stub.module.css`)
- Create: `apps/web/src/modules/CondominiModule.tsx`
- Create: `apps/web/src/components/layout/AppShell.tsx` (+ `.module.css`)
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Create `apps/web/src/modules/Stub.module.css`**

```css
.stub { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); flex-direction: column; gap: var(--sp-4); }
```

- [ ] **Step 2: Create `apps/web/src/modules/CalendarioStub.tsx`**

```tsx
import styles from "./Stub.module.css";
export function CalendarioStub() {
  return <div className={styles.stub}><h2>Calendario</h2><p>Modulo non incluso nel prototipo (solo Condomini).</p></div>;
}
```

- [ ] **Step 3: Create `apps/web/src/modules/AnagraficheStub.tsx`**

```tsx
import styles from "./Stub.module.css";
export function AnagraficheStub() {
  return <div className={styles.stub}><h2>Anagrafiche</h2><p>Modulo non incluso nel prototipo (solo Condomini).</p></div>;
}
```

- [ ] **Step 4: Create `apps/web/src/modules/CondominiModule.tsx`**

```tsx
import { useAppRuntime } from "../runtime/useAppRuntime";
import { DatiCondominioSection } from "../sections/dati/DatiCondominioSection";
import { UnitaSection } from "../sections/unita/UnitaSection";
import { TabelleSection } from "../sections/tabelle/TabelleSection";
import { ContiSection } from "../sections/conti/ContiSection";
import { GiornaleSection } from "../sections/giornale/GiornaleSection";
import { RateSection } from "../sections/rate/RateSection";

export function CondominiModule() {
  const rt = useAppRuntime();
  const section = rt.useSection();
  const sel = rt.useSelection();
  if (!sel.accountingPeriodId && section !== "dati") {
    return <DatiCondominioSection />; // before a period is picked, show the registry
  }
  switch (section) {
    case "dati": return <DatiCondominioSection />;
    case "unita": return <UnitaSection />;
    case "tabelle": return <TabelleSection />;
    case "conti": return <ContiSection />;
    case "giornale": return <GiornaleSection />;
    case "rate": return <RateSection />;
  }
}
```

- [ ] **Step 5: Create `apps/web/src/components/layout/AppShell.module.css`**

```css
.shell { display: flex; flex-direction: column; height: 100%; }
.body { flex: 1; min-height: 0; display: flex; }
.main { flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; }
```

- [ ] **Step 6: Create `apps/web/src/components/layout/AppShell.tsx`**

```tsx
import { Suspense } from "react";
import { TopBar } from "../shell/TopBar";
import { MainNav } from "../shell/MainNav";
import { Breadcrumb } from "../shell/Breadcrumb";
import { Sidebar } from "../sidebar/Sidebar";
import { CondominiModule } from "../../modules/CondominiModule";
import { CalendarioStub } from "../../modules/CalendarioStub";
import { AnagraficheStub } from "../../modules/AnagraficheStub";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import styles from "./AppShell.module.css";

const SECTION_LABELS: Record<string, string> = {
  dati: "Dati Condominio e Fornitori", unita: "Unità, Condòmini e Bilancio Personale",
  tabelle: "Tabelle Millesimali e Riparto", conti: "Conti, Mastrini e Bilancio",
  giornale: "Libro Giornale e Prima Nota", rate: "Prospetto Rate",
};

export function AppShell() {
  const rt = useAppRuntime();
  const module = rt.useModule();
  const tree = rt.useCondominiumTree();
  const sel = rt.useSelection();
  const section = rt.useSection();

  const cond = tree.find((c) => c.id === sel.condominiumId);
  const period = cond?.periods.find((p) => p.id === sel.accountingPeriodId);
  const segments = module === "condomini"
    ? ["Condomini", cond?.name.split(" (")[0], period?.name, SECTION_LABELS[section]].filter(Boolean) as string[]
    : [module === "calendario" ? "Calendario" : "Anagrafiche"];

  return (
    <div className={styles.shell}>
      <TopBar />
      <MainNav />
      <Breadcrumb segments={segments} />
      <div className={styles.body}>
        {module === "condomini" && <Sidebar />}
        <main className={styles.main}>
          <Suspense fallback={<div style={{ padding: 16 }}>Caricamento…</div>}>
            {module === "condomini" && <CondominiModule />}
            {module === "calendario" && <CalendarioStub />}
            {module === "anagrafiche" && <AnagraficheStub />}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Replace `apps/web/src/App.tsx`**

```tsx
import { AppRuntimeProvider } from "./runtime/AppRuntimeProvider";
import { AppShell } from "./components/layout/AppShell";

export function App() {
  return (
    <AppRuntimeProvider>
      <AppShell />
    </AppRuntimeProvider>
  );
}
```

- [ ] **Step 8: Update the smoke test `apps/web/src/smoke.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { App } from "./App";

test("renders shell with brand and nav", () => {
  render(<App />);
  expect(screen.getByText("CondoLedger")).toBeInTheDocument();
  expect(screen.getByText("Condomini")).toBeInTheDocument();
});
```

- [ ] **Step 9: Write integration test `apps/web/src/App.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

test("end-to-end: pick period → navigate sections", async () => {
  render(<App />);
  // registry visible first
  expect(await screen.findByText(/SAT — Saturno/)).toBeInTheDocument();
  // pick a period in the sidebar tree
  await userEvent.click(screen.getByText("2011 (Ordinario)"));
  // go to Tabelle
  await userEvent.click(screen.getByText("Tabelle Millesimali e Riparto"));
  expect(await screen.findByText("Proprietà")).toBeInTheDocument();
  // switch module to Anagrafiche stub
  await userEvent.click(screen.getByText("Anagrafiche"));
  expect(await screen.findByText(/non incluso nel prototipo/)).toBeInTheDocument();
});
```

- [ ] **Step 10: Run the full test suite**

Run: `pnpm --filter @cl/web test`
Expected: PASS (all suites).

- [ ] **Step 11: Run the dev server manually to eyeball it**

Run: `pnpm --filter @cl/web dev` and open the printed URL. Confirm the shell, sidebar tree, section switching, inline coefficient edit, and a wizard modal all work.

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/modules apps/web/src/components/layout/AppShell.tsx apps/web/src/components/layout/AppShell.module.css apps/web/src/App.tsx apps/web/src/smoke.test.tsx apps/web/src/App.test.tsx
git commit -m "feat(web): wire AppShell, Condomini router, module stubs, integration test"
```

---

## Task 20: README + theme-switch affordance

**Files:**
- Create: `apps/web/README.md`
- Modify: `apps/web/src/components/shell/TopBar.tsx` (add a theme toggle to prove token swap)

- [ ] **Step 1: Add a theme toggle to `TopBar.tsx`**

Replace the `<button className={styles.logout}>` line's surrounding `right` div content by inserting, before the Esci button:

```tsx
        <button
          className={styles.logout}
          onClick={() => {
            const el = document.documentElement;
            el.dataset.theme = el.dataset.theme === "dark" ? "" : "dark";
          }}
        >
          <Icon name="lang" /> Tema
        </button>
```

- [ ] **Step 2: Create `apps/web/README.md`**

```markdown
# CondoLedger — Web (Condomini prototype)

Frontend-only prototype on mock data. See `docs/superpowers/specs/2026-06-07-prototype-design.md`.

## Run
```bash
pnpm install
pnpm --filter @cl/web dev
```

## Test
```bash
pnpm --filter @cl/web test
```

## Architecture
- `@cl/domain` — pure TS (Money). `@cl/application` — DTOs + ports.
- State: react-rxjs streams built in `src/runtime/createAppRuntime.ts`, injected via
  `<AppRuntimeProvider>` context (composition root — no module singletons).
- Styling: CSS Modules + design tokens (`src/styles/tokens.css`); dark theme via `data-theme="dark"`
  (toggle "Tema" in the top bar). Behavior primitives: Radix. Grid: TanStack behind `TreeTable`.
- Data: `src/mock/MockDataSource.ts` (Saturno/Pozzetto fixtures).
```

- [ ] **Step 3: Run tests to confirm nothing broke**

Run: `pnpm --filter @cl/web test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/README.md apps/web/src/components/shell/TopBar.tsx
git commit -m "docs(web): README + theme-switch affordance (proves token swap)"
```

---

## Self-review

**Spec coverage (vs `2026-06-07-prototype-design.md`):**
- §1.2 full shell → Tasks 9–11, 19. ✓
- §1.2 all 6 sections → Tasks 13–18. ✓
- §1.2 selection cascade → Task 8 (`periodId$` switchMap), exercised in Tasks 13–19. ✓
- §1.2 wizards as Radix shells → Tasks 17–18 (`WizardDialog`). ✓
- §1.2 Legenda/counts/money formatting → Tasks 6, 11. ✓
- §2 token-driven visual system + theme swap → Tasks 5, 20. ✓
- §3 component inventory + ports → Tasks 9–12 (TreeTable port in Task 3). ✓
- §4 react-rxjs composition root → Task 8 (+ isolation test). ✓
- §5 six sections columns/interactions → Tasks 13–18 match the spec's column lists. ✓
- §6 mock data from Saturno/Pozzetto → Task 7. ✓
- §7 CSS Modules + tokens + Radix → throughout. ✓
- §8 testing (component, runtime isolation, token, contract stub) → Tasks 5, 8, 12, 19. ✓
- §1.3 out-of-scope (Calendario/Anagrafiche stubs, no real backend/PDF/engine) → Task 19 stubs; engine left to `domain` later. ✓

**Placeholder scan:** the only "(prototipo)" notes are intentional in-UI copy (Mastrina movements, wizard note), not plan gaps. No TBD/TODO steps; every code step ships complete code.

**Type consistency:** `AppRuntime` methods used in sections (`useCondominiumTree`, `useSelection`, `select`, `useUnitsTree`, `useDistributionTables`, `useDistribution`, `useLedgerAccountsTree`, `useLedgerTransactions`, `useInstallments`, `useModule/setModule`, `useSection/setSection`) all match the interface in Task 3. `TreeColumn`/`TreeTableProps` used in Task 12 + sections match Task 3. `Money` (`{cents}`, `fromCents`, `formatEUR`) consistent across Tasks 2, 6, 7, sections. DTO field names (e.g. `totDovuto`, `byInstallment`, `amounts`, `preventivo`) consistent between fixtures (Task 7) and section columns (Tasks 14–18).

**Note for implementer:** if `pnpm install` is unavailable (sandboxed/offline), Tasks that run tests will block on dependency availability — flag it and proceed once deps install; do not fake passing tests.
