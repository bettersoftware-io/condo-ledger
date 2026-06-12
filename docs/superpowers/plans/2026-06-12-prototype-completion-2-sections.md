# Prototype Completion — Plan 2: Section Completions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the six Condomini sections (Giornale, Conti, Rate, Tabelle, Dati, Unità) to legacy parity: real wizard forms posting to the MockStore, inline editors wired to commands, new columns/tabs/dialogs, search/paging/regroup — per spec §4 of `docs/superpowers/specs/2026-06-11-prototype-completion-design.md`.

**Architecture:** Plan 1 landed the stateful `MockStore` (BehaviorSubject per collection, command methods on the `MockDataSource` port), the `recompute/` layer (`allocate`, `distributeInstallments`/`redistributeOverride`, `applyEntryDeltas`, `recomputeDistribution`, `addMonths`/`formatItDate`), form fields (`TextField`/`DateField`/`SelectField`/`MoneyField`/`CheckboxField`), inline editors (`InlineNumber`/`InlineMoney`), `WizardDialog` step machinery, and small controls (`PagingBar`/`SearchBox`/`ToolbarToggle`/`Toast`). Plan 2 builds the section UIs on those APIs and extends types/fixtures/store where a section needs data that doesn't exist yet (partita, mastrino accountIds, R/d columns, F24s, functional accounts, period summaries). Components never import the store — everything goes through `useAppRuntime()` (`rt.commands.*`, `rt.use*`).

**Tech Stack:** React 18 + TypeScript strict (`noUncheckedIndexedAccess: true` — guard every indexed access or use `!` deliberately), rxjs + @react-rxjs/core, Radix Dialog/Tabs, TanStack table (wrapped by `TreeTable`), CSS Modules + tokens (no Tailwind), Vitest + RTL + user-event.

---

## Conventions (read before any task)

- Branch: `feat/prototype-complete` (continue on it; do NOT branch off).
- Every commit message ends with the footer line: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` (use a HEREDOC with `git commit -m "$(cat <<'EOF' ... EOF)"`).
- Test commands: `pnpm --filter @cl/web exec vitest run <path>` for one file, `pnpm --filter @cl/web test` for the suite, `pnpm --filter @cl/web typecheck` after every task (the strict flags bite).
- Money is integer cents: `fromCents(n)` (`@cl/domain`) constructs, `formatEUR` renders `1.234,56`. Italian user-facing strings, English dev-facing error messages already established as: Italian for validation the user sees (e.g. `"Scrittura non bilanciata: dare ≠ avere"`).
- `latest()` helper used in store tests:
  ```ts
  const latest = <T,>(obs: Observable<T>): T => {
    let v!: T; obs.subscribe((x) => { v = x; }).unsubscribe(); return v;
  };
  ```
- Section tests use this harness pattern (period selection happens via a button so the runtime cascade is exercised):
  ```tsx
  function Inner() {
    const rt = useAppRuntime();
    return <><button onClick={() => rt.select({ accountingPeriodId: "sat-2011" })}>sel</button><XxxSection /></>;
  }
  render(<AppRuntimeProvider><Inner /></AppRuntimeProvider>);
  ```
  Wizard/Toast tests that need the toast must wrap in `<ToastProvider>` too (inside the runtime provider).

## File map (created → C, modified → M)

| File | Task | Responsibility |
|---|---|---|
| `packages/application/src/types.ts` | M:1 | partita, LedgerTxnEntry.accountId, R/d columns, F24Row, PeriodSummary, locked/overridden flags, docs lists, WithholdingPaymentInput, FunctionalRole |
| `packages/application/src/ports.ts` | M:2,15 | payWithholding, editInstallment, addF24/editF24, f24s(), functionalAccounts()/setFunctionalAccount, periodSummaries(); AppRuntime hooks |
| `apps/web/src/mock/fixtures.ts` | M:1 | consistent account tree, txn accountIds/partita, F24s, docs, functional seed, supplierCandidates |
| `apps/web/src/mock/fixtures.test.ts` | C:1 | roll-up + balance consistency guards |
| `apps/web/src/mock/MockStore.ts` | M:2,11,15 | new subjects/reads/commands; addTransaction account guard; overridden flag |
| `apps/web/src/mock/treeRows.ts` | M:5 | `flattenRows` |
| `apps/web/src/recompute/installments.ts` | M:3 | reject-negative redistribution |
| `apps/web/src/recompute/summary.ts` | C:15 | per-period Dati aggregates |
| `apps/web/src/recompute/distribution.ts` | M:14 | `roundingRow` |
| `apps/web/src/components/common/Toast.tsx` | M:3 | unmount cleanup |
| `apps/web/src/components/common/WizardDialog.tsx` | M:3 | aria-describedby, dynamic-steps idx guard |
| `apps/web/src/components/forms/fields.tsx` | M:3 | MoneyField single-commit |
| `apps/web/src/sections/giornale/*` | M:4,5,6,7 | grid upgrade + 5 real wizards |
| `apps/web/src/sections/giornale/wizards/*` | C:5,6,7 | one file per wizard + shared EntriesForm |
| `apps/web/src/sections/conti/*` | M:8,9,10 | mastrino, columns, search/hide-empty, inline preventivo, dialogs |
| `apps/web/src/sections/rate/*` | M:11,12 | inline cells, flags, Modifica rata, Crea rate wizard |
| `apps/web/src/sections/tabelle/*` | M:13,14 | TreeTable coefficients, toolbar dialogs, rounding row |
| `apps/web/src/sections/dati/*` | M:15,16 | money columns, Fornitori toolbar, dialogs, F24/Documenti tabs |
| `apps/web/src/sections/unita/*` | M:17,18 | regroup selector, dialogs, subentro wizard |
| `apps/web/src/mock/regroup.ts` | C:17 | pure regrouping of the unit tree |
| `apps/web/src/runtime/createAppRuntime.ts` | M:2,15 | bind new reads |
| `apps/web/README.md` | M:19 | section feature list |

---

### Task 1: Types + fixture enrichment (consistent accounts tree, txn accountIds, F24/docs/functional fixtures)

The wizards post real entries and Task 2 adds a guard that throws for unknown account ids — so the fixture chart of accounts must actually contain expense/payable/withholding/credit accounts, with parent rows equal to the sum of their children. The current `sat-2011` tree is thin and its roll-ups don't sum; replace it wholesale (preserving ids/labels existing tests assert: `cassa` 13552/2350, `banca`, labels "Patrimoniali", "Cassa Contanti").

**Files:**
- Modify: `packages/application/src/types.ts`
- Modify: `apps/web/src/mock/fixtures.ts`
- Test: `apps/web/src/mock/fixtures.test.ts` (create)

- [ ] **Step 1: Extend types.** In `packages/application/src/types.ts`:

Replace the `LedgerTxnRow` block with:

```ts
export interface LedgerTxnEntry { accountId?: Id; account: string; dare: Money; avere: Money; }
export interface LedgerTxnRow {
  id: Id; date: string; code: number; description: string;
  partita?: string;        // legacy "Partita" matching reference
  dare: Money; avere: Money;
  entries: LedgerTxnEntry[];
}
```

Extend `LedgerAccountRow` with three optional display fields (after `preventivo`):

```ts
  rd?: "R" | "d";          // Ripartito / diretto
  tabelle?: string;        // riparto table names, comma-joined
  restriction?: string;    // restr. competenza display range
```

Extend `InstallmentColumn` and `InstallmentRow`:

```ts
export interface InstallmentColumn { id: Id; header: string; expiry?: string; locked?: boolean; }
```
and add to `InstallmentRow` (after `byInstallment`): `overridden?: Record<Id, boolean>;`

Extend `CondominiumDetail` (after `suppliers`): `publicDocs: string[]; privateDocs: string[];`

Add to `TransactionInput`: `partita?: string;`

Append new types at the end of the file:

```ts
export interface F24Row { id: Id; descrizione: string; scadenza: string /* ISO */; importo: Money; stato: "da pagare" | "pagato"; }
export type FunctionalRole = "liquid" | "payable" | "withholding" | "credit";
export interface PeriodSummary {
  liquidita: Money; fondi: Money; preventivo: Money;
  consuntivo: Money; saldoPrec: Money; totDovuto: Money;
}
export interface WithholdingPaymentInput {
  date: string; amountCents: number;
  withholdingAccountId: Id; withholdingAccountLabel: string;
  liquidAccountId: Id; liquidAccountLabel: string;
}
```

- [ ] **Step 2: Write the failing fixture-consistency test** at `apps/web/src/mock/fixtures.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { LedgerAccountRow } from "@cl/application";
import * as fx from "./fixtures";

function checkRollups(rows: LedgerAccountRow[]): void {
  for (const r of rows) {
    if (r.children?.length) {
      const dare = r.children.reduce((a, c) => a + c.dare.cents, 0);
      const avere = r.children.reduce((a, c) => a + c.avere.cents, 0);
      expect.soft({ id: r.id, dare: r.dare.cents, avere: r.avere.cents })
        .toEqual({ id: r.id, dare, avere });
      checkRollups(r.children);
    }
    expect(r.saldo.cents).toBe(r.dare.cents - r.avere.cents);
  }
}

describe("fixture consistency", () => {
  it.each(Object.entries(fx.ledgerAccountsByPeriod))("%s account roll-ups sum", (_id, rows) => {
    checkRollups(rows);
    expect(rows[0]!.saldo.cents).toBe(0); // Totale balances
  });
  it.each(Object.entries(fx.ledgerTxnsByPeriod))("%s journal entries balance", (_id, txns) => {
    for (const t of txns) {
      const dare = t.entries.reduce((a, e) => a + e.dare.cents, 0);
      const avere = t.entries.reduce((a, e) => a + e.avere.cents, 0);
      expect(dare).toBe(avere);
      for (const e of t.entries) expect(e.accountId).toBeTruthy();
    }
  });
  it("seeds functional accounts and F24s for both periods", () => {
    for (const pid of ["sat-2011", "poz-2010"]) {
      expect(fx.functionalByPeriod[pid]).toMatchObject({ liquid: expect.any(String) });
      expect(fx.f24sByPeriod[pid]!.length).toBeGreaterThan(0);
      expect(fx.detailByPeriod[pid]!.publicDocs.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `pnpm --filter @cl/web exec vitest run src/mock/fixtures.test.ts`
Expected: FAIL — roll-ups don't sum (e.g. `liq` 243231 ≠ 227741), `functionalByPeriod` doesn't exist.

- [ ] **Step 4: Rewrite the account fixtures + extend the others.** In `apps/web/src/mock/fixtures.ts`:

Replace `ledgerAccountsByPeriod` entirely with (numbers are pre-computed so every parent = Σ children and Totale saldo = 0):

```ts
export const ledgerAccountsByPeriod: Record<Id, LedgerAccountRow[]> = {
  "sat-2011": [
    { id: "tot", kind: "grouping", label: "Totale", dare: c(1335340), avere: c(1335340), saldo: c(0), preventivo: null,
      children: [
        { id: "patr", kind: "grouping", label: "Patrimoniali", dare: c(1139340), avere: c(1335340), saldo: c(-196000), preventivo: null,
          children: [
            { id: "att", kind: "grouping", label: "(Attività)", dare: c(1139340), avere: c(325900), saldo: c(813440), preventivo: null,
              children: [
                { id: "liq", kind: "grouping", label: "Liquidità", dare: c(227741), avere: c(175900), saldo: c(51841), preventivo: null,
                  children: [
                    { id: "cassa", kind: "regular", label: "Cassa Contanti", dare: c(13552), avere: c(2350), saldo: c(11202), preventivo: null },
                    { id: "banca", kind: "regular", label: "Banca Pop. Emilia Romagna - C/C 0764.94", dare: c(214189), avere: c(173550), saldo: c(40639), preventivo: null },
                  ] },
                { id: "fondi", kind: "grouping", label: "Fondi", dare: c(0), avere: c(50000), saldo: c(-50000), preventivo: null,
                  children: [
                    { id: "friserva", kind: "regular", label: "Fondo di riserva", dare: c(0), avere: c(50000), saldo: c(-50000), preventivo: null },
                  ] },
                { id: "crediti", kind: "grouping", label: "Crediti v/condòmini", dare: c(911599), avere: c(100000), saldo: c(811599), preventivo: null,
                  children: [
                    { id: "csaldi", kind: "regular", label: "Condòmini c/saldi iniziali", dare: c(625099), avere: c(0), saldo: c(625099), preventivo: null },
                    { id: "crate", kind: "regular", label: "Condòmini c/rate", dare: c(286500), avere: c(100000), saldo: c(186500), preventivo: null },
                  ] },
              ] },
            { id: "pass", kind: "grouping", label: "(Passività)", dare: c(0), avere: c(1009440), saldo: c(-1009440), preventivo: null,
              children: [
                { id: "forn", kind: "regular", label: "Fornitori c/acquisti", dare: c(0), avere: c(120000), saldo: c(-120000), preventivo: null },
                { id: "erar", kind: "regular", label: "Erario c/ritenute", dare: c(0), avere: c(0), saldo: c(0), preventivo: null },
                { id: "patrini", kind: "regular", label: "Patrimonio iniziale", dare: c(0), avere: c(889440), saldo: c(-889440), preventivo: null },
              ] },
          ] },
        { id: "econ", kind: "grouping", label: "Economici", dare: c(196000), avere: c(0), saldo: c(196000), preventivo: null,
          children: [
            { id: "spese", kind: "grouping", label: "Spese", dare: c(196000), avere: c(0), saldo: c(196000), preventivo: null,
              children: [
                { id: "e-pul", kind: "regular", label: "Pulizie", dare: c(120000), avere: c(0), saldo: c(120000), preventivo: c(120000),
                  rd: "R", tabelle: "Proprietà", restriction: "01/01/2011 - 31/12/2011" },
                { id: "e-asc", kind: "regular", label: "Ascensore", dare: c(76000), avere: c(0), saldo: c(76000), preventivo: c(80000),
                  rd: "R", tabelle: "Scale", restriction: "01/01/2011 - 31/12/2011" },
              ] },
          ] },
      ] },
  ],
  "poz-2010": [
    { id: "tot-p", kind: "grouping", label: "Totale", dare: c(659000), avere: c(659000), saldo: c(0), preventivo: null,
      children: [
        { id: "liq-p", kind: "regular", label: "Cassa Contanti", dare: c(600000), avere: c(590000), saldo: c(10000), preventivo: null },
        { id: "e-pul-p", kind: "regular", label: "Pulizie", dare: c(59000), avere: c(0), saldo: c(59000), preventivo: c(60000), rd: "R", tabelle: "Proprietà" },
        { id: "patr-p", kind: "regular", label: "Patrimonio iniziale", dare: c(0), avere: c(69000), saldo: c(-69000), preventivo: null },
      ] },
  ],
};
```

Replace `ledgerTxnsByPeriod` so every entry carries `accountId` (existing fixture ids) and a `partita`, and tx1's entries actually balance:

```ts
export const ledgerTxnsByPeriod: Record<Id, LedgerTxnRow[]> = {
  "sat-2011": [
    { id: "tx1", date: "2011-01-01", code: 1, description: "Apertura saldi iniziali", partita: "Apertura",
      dare: c(625099), avere: c(625099),
      entries: [
        { accountId: "csaldi", account: "Condòmini c/saldi iniziali", dare: c(625099), avere: c(0) },
        { accountId: "patrini", account: "Patrimonio iniziale", dare: c(0), avere: c(625099) },
      ] },
    { id: "tx2", date: "2011-03-15", code: 2, description: "Registrazione fattura Pulizie Acme", partita: "Acme Pulizie",
      dare: c(120000), avere: c(120000),
      entries: [
        { accountId: "e-pul", account: "Pulizie", dare: c(120000), avere: c(0) },
        { accountId: "forn", account: "Fornitori c/acquisti", dare: c(0), avere: c(120000) },
      ] },
    { id: "tx3", date: "2011-04-02", code: 3, description: "Incasso rata A02 Mauri", partita: "A02 Mauri",
      dare: c(100000), avere: c(100000),
      entries: [
        { accountId: "banca", account: "Banca Pop. Emilia Romagna", dare: c(100000), avere: c(0) },
        { accountId: "crate", account: "Condòmini c/rate", dare: c(0), avere: c(100000) },
      ] },
  ],
  "poz-2010": [
    { id: "txp1", date: "2010-02-01", code: 1, description: "Apertura", partita: "Apertura",
      dare: c(600000), avere: c(600000),
      entries: [
        { accountId: "liq-p", account: "Cassa", dare: c(600000), avere: c(0) },
        { accountId: "patr-p", account: "Patrimonio", dare: c(0), avere: c(600000) },
      ] },
  ],
};
```

Add `publicDocs`/`privateDocs` to BOTH entries of `detailByPeriod`:

```ts
    publicDocs: ["Regolamento condominiale.pdf", "Verbale assemblea 2011-03.pdf"],
    privateDocs: ["Contratto pulizie Acme.pdf"],
```
(for `poz-2010` use `["Regolamento condominiale.pdf"]` / `["Polizza fabbricato.pdf"]`).

Append new fixture exports at the end of the file:

```ts
export const f24sByPeriod: Record<Id, F24Row[]> = {
  "sat-2011": [
    { id: "f24-1", descrizione: "Ritenute d'acconto 1° trim.", scadenza: "2011-04-16", importo: c(10000), stato: "da pagare" },
    { id: "f24-2", descrizione: "Ritenute d'acconto 2010 conguaglio", scadenza: "2011-01-16", importo: c(7500), stato: "pagato" },
  ],
  "poz-2010": [
    { id: "f24-p1", descrizione: "Ritenute d'acconto", scadenza: "2010-07-16", importo: c(4200), stato: "pagato" },
  ],
};

export const functionalByPeriod: Record<Id, Partial<Record<FunctionalRole, Id>>> = {
  "sat-2011": { liquid: "banca", payable: "forn", withholding: "erar", credit: "crate" },
  "poz-2010": { liquid: "liq-p", payable: "patr-p", withholding: "patr-p", credit: "patr-p" },
};

/** Pool the "add supplier" dialog picks from (replaced by real anagrafiche in Plan 4). */
export const supplierCandidates: SupplierRow[] = [
  { id: "cand-1", nominativo: "Idraulica Blu S.n.c.", categoria: "Idraulico" },
  { id: "cand-2", nominativo: "Elettrosistemi Friuli", categoria: "Elettricista" },
  { id: "cand-3", nominativo: "Studio Rag. Bianchi", categoria: "Commercialista" },
];
```

Update the type-only import at the top of fixtures.ts to include `F24Row, FunctionalRole, SupplierRow` (SupplierRow may already be absent — add what's missing).

- [ ] **Step 5: Run the fixture test + full suite + typecheck**

Run: `pnpm --filter @cl/web exec vitest run src/mock/fixtures.test.ts` → PASS.
Run: `pnpm --filter @cl/web test` → all green (existing tests assert `cassa` 13552, labels "Patrimoniali"/"Cassa Contanti" — all preserved; `registerInvoice`/`recordTaking` tests use ids `cassa`/`banca` which still exist).
Run: `pnpm -r typecheck` → clean (the `LedgerTxnEntry` extraction is structural-compatible; `detailByPeriod` now requires the two new doc arrays).

- [ ] **Step 6: Commit**

```bash
git add packages/application/src/types.ts apps/web/src/mock/fixtures.ts apps/web/src/mock/fixtures.test.ts
git commit -m "$(cat <<'EOF'
feat(web): consistent ledger fixtures + Plan 2 type surface (partita, R/d, F24, functional accounts)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
### Task 2: Store + port extensions (F24s, functional accounts, payWithholding, editInstallment, account guard)

**Files:**
- Modify: `packages/application/src/ports.ts`
- Modify: `apps/web/src/mock/MockStore.ts`
- Modify: `apps/web/src/runtime/createAppRuntime.ts`
- Test: `apps/web/src/mock/MockStore.test.ts` (extend)

- [ ] **Step 1: Extend the ports.** In `packages/application/src/ports.ts`:

Add to the type-only import from `./types`: `F24Row, FunctionalRole, PeriodSummary, WithholdingPaymentInput, InstallmentColumn`.

Add to `DataCommands` (after `createInstallments`):

```ts
  payWithholding(periodId: Id, input: WithholdingPaymentInput): void;
```

Add to `CrudCommands` (after `removeAccountRow`):

```ts
  addF24(periodId: Id, f24: F24Row): void;
  editF24(periodId: Id, id: Id, patch: Partial<F24Row>): void;
  editInstallment(periodId: Id, installmentId: Id, patch: Partial<InstallmentColumn>): void;
  setFunctionalAccount(periodId: Id, role: FunctionalRole, accountId: Id): void;
```

Add to `MockDataSource` (after `installments`):

```ts
  f24s(periodId: Id): Observable<F24Row[]>;
  functionalAccounts(periodId: Id): Observable<Partial<Record<FunctionalRole, Id>>>;
  /** keyed by accounting-period id; feeds the Dati grid money columns (Task 15) */
  periodSummaries(): Observable<Record<Id, PeriodSummary>>;
```

Add to `AppRuntime` (after `useInstallments`):

```ts
  useF24s(): F24Row[];
  useFunctionalAccounts(): Partial<Record<FunctionalRole, Id>>;
  usePeriodSummaries(): Record<Id, PeriodSummary>;
```

- [ ] **Step 2: Write the failing store tests.** Append to `apps/web/src/mock/MockStore.test.ts`:

```ts
describe("Plan 2 store extensions", () => {
  it("serves and mutates F24s per period", () => {
    const s = new MockStore();
    expect(latest(s.f24s("sat-2011")).map((f) => f.id)).toEqual(["f24-1", "f24-2"]);
    s.addF24("sat-2011", { id: "f24-9", descrizione: "Nuovo F24", scadenza: "2011-10-16", importo: { cents: 5000 }, stato: "da pagare" });
    s.editF24("sat-2011", "f24-9", { stato: "pagato" });
    expect(latest(s.f24s("sat-2011")).find((f) => f.id === "f24-9")!.stato).toBe("pagato");
  });
  it("serves and updates functional accounts", () => {
    const s = new MockStore();
    expect(latest(s.functionalAccounts("sat-2011")).payable).toBe("forn");
    s.setFunctionalAccount("sat-2011", "payable", "erar");
    expect(latest(s.functionalAccounts("sat-2011")).payable).toBe("erar");
  });
  it("payWithholding posts dare-withholding / avere-liquid", () => {
    const s = new MockStore();
    s.payWithholding("sat-2011", {
      date: "2011-04-16", amountCents: 10000,
      withholdingAccountId: "erar", withholdingAccountLabel: "Erario c/ritenute",
      liquidAccountId: "banca", liquidAccountLabel: "Banca",
    });
    const txns = latest(s.ledgerTransactions("sat-2011"));
    const last = txns[txns.length - 1]!;
    expect(last.description).toContain("ritenuta");
    expect(last.entries.map((e) => [e.accountId, e.dare.cents, e.avere.cents]))
      .toEqual([["erar", 10000, 0], ["banca", 0, 10000]]);
  });
  it("editInstallment patches a rata column (lock + header)", () => {
    const s = new MockStore();
    s.editInstallment("sat-2011", "r1", { locked: true, header: "Rata 1 (31/01/2011)" });
    const { columns } = latest(s.installments("sat-2011"));
    expect(columns.find((c) => c.id === "r1")).toMatchObject({ locked: true, header: "Rata 1 (31/01/2011)" });
  });
  it("addTransaction throws for an unknown accountId, posting nothing", () => {
    const s = new MockStore();
    expect(() => s.addTransaction("sat-2011", {
      date: "2011-05-01", description: "Conto fantasma",
      entries: [
        { accountId: "ghost", label: "Fantasma", dareCents: 100, avereCents: 0 },
        { accountId: "cassa", label: "Cassa", dareCents: 0, avereCents: 100 },
      ],
    })).toThrow(/Conto inesistente: ghost/);
    expect(latest(s.ledgerTransactions("sat-2011"))).toHaveLength(3);
  });
});
```

Note: the existing `registerInvoice`/`recordTaking` tests use real fixture ids (`cassa`, `banca`) so the new guard does not break them.

- [ ] **Step 3: Run to see the new tests fail**

Run: `pnpm --filter @cl/web exec vitest run src/mock/MockStore.test.ts`
Expected: FAIL — `f24s is not a function`, etc.

- [ ] **Step 4: Implement in `apps/web/src/mock/MockStore.ts`.**

Extend the type-only import with `F24Row, FunctionalRole, PeriodSummary, WithholdingPaymentInput`. Add two subjects next to the others:

```ts
  private f24s$ = new BehaviorSubject<Record<Id, F24Row[]>>(fx.f24sByPeriod);
  private functional$ = new BehaviorSubject<Record<Id, Partial<Record<FunctionalRole, Id>>>>(fx.functionalByPeriod);
```

Add reads next to the existing ones (`periodSummaries()` body lands in Task 15; stub it now so the port compiles):

```ts
  f24s(periodId: Id) { return this.f24s$.pipe(map((f) => f[periodId] ?? [])); }
  functionalAccounts(periodId: Id) { return this.functional$.pipe(map((f) => f[periodId] ?? {})); }
  periodSummaries(): Observable<Record<Id, PeriodSummary>> { return new BehaviorSubject({}).asObservable(); } // real derivation in Task 15
```

Add commands:

```ts
  addF24(periodId: Id, f24: F24Row): void {
    this.patch(this.f24s$, periodId, [], (fs) => [...fs, f24]);
  }
  editF24(periodId: Id, id: Id, patchF24: Partial<F24Row>): void {
    this.patch(this.f24s$, periodId, [], (fs) => fs.map((f) => (f.id === id ? { ...f, ...patchF24 } : f)));
  }
  editInstallment(periodId: Id, installmentId: Id, patchCol: Partial<InstallmentColumn>): void {
    this.patch(this.installments$, periodId, { columns: [], rows: [] }, (data) => ({
      ...data,
      columns: data.columns.map((col) => (col.id === installmentId ? { ...col, ...patchCol } : col)),
    }));
  }
  setFunctionalAccount(periodId: Id, role: FunctionalRole, accountId: Id): void {
    const cur = this.functional$.getValue();
    this.functional$.next({ ...cur, [periodId]: { ...cur[periodId], [role]: accountId } });
  }
  payWithholding(periodId: Id, input: WithholdingPaymentInput): void {
    this.addTransaction(periodId, {
      date: input.date, description: "Pagamento ritenuta d'acconto", partita: "F24",
      entries: [
        { accountId: input.withholdingAccountId, label: input.withholdingAccountLabel, dareCents: input.amountCents, avereCents: 0 },
        { accountId: input.liquidAccountId, label: input.liquidAccountLabel, dareCents: 0, avereCents: input.amountCents },
      ],
    });
  }
```

In `addTransaction`, after the balance check and BEFORE any patch, add the existence guard, and thread `accountId`/`partita` into the stored row:

```ts
    const accounts = this.accounts$.getValue()[periodId] ?? [];
    const exists = (rows: LedgerAccountRow[], id: Id): boolean =>
      rows.some((r) => r.id === id || exists(r.children ?? [], id));
    for (const e of input.entries) {
      if (!exists(accounts, e.accountId)) throw new Error(`Conto inesistente: ${e.accountId}`);
    }
```
and in the pushed txn object: `partita: input.partita,` plus `entries: input.entries.map((e) => ({ accountId: e.accountId, account: e.label, ... }))`.

- [ ] **Step 5: Bind the new reads in `apps/web/src/runtime/createAppRuntime.ts`** (same `periodId$.pipe(switchMap(...))` shape as the neighbors):

```ts
  const [useF24s] = bind(
    periodId$.pipe(switchMap((id) => (id ? data.f24s(id) : of([])))), []);
  const [useFunctionalAccounts] = bind(
    periodId$.pipe(switchMap((id) => (id ? data.functionalAccounts(id) : of({})))), {});
  const [usePeriodSummaries] = bind(data.periodSummaries(), {});
```
and add `useF24s, useFunctionalAccounts, usePeriodSummaries,` to the returned object.

- [ ] **Step 6: Run tests + typecheck, then commit**

Run: `pnpm --filter @cl/web exec vitest run src/mock/MockStore.test.ts` → PASS. `pnpm --filter @cl/web test` → green. `pnpm -r typecheck` → clean.

```bash
git add packages/application/src/ports.ts apps/web/src/mock/MockStore.ts apps/web/src/mock/MockStore.test.ts apps/web/src/runtime/createAppRuntime.ts
git commit -m "$(cat <<'EOF'
feat(web): F24/functional-account slices, payWithholding, editInstallment, unknown-account guard

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Plan 1 deferred fixes (Toast cleanup, WizardDialog a11y/guard, MoneyField single-commit, negative-redistribution rejection)

Four small review findings from Plan 1's final review, each with a pinning test.

**Files:**
- Modify: `apps/web/src/components/common/Toast.tsx`
- Modify: `apps/web/src/components/common/WizardDialog.tsx`
- Modify: `apps/web/src/components/forms/fields.tsx`
- Modify: `apps/web/src/recompute/installments.ts`
- Test: `apps/web/src/components/common/smallControls.test.tsx`, `apps/web/src/components/common/WizardDialog.test.tsx`, `apps/web/src/components/forms/forms.test.tsx`, `apps/web/src/recompute/installments.test.ts` (extend each)

- [ ] **Step 1: Write the failing tests.**

Append to `smallControls.test.tsx` (uses the existing fake-timers setup in that file):

```tsx
test("toast timer is cleared on provider unmount (no setState after unmount)", () => {
  vi.useFakeTimers();
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  function Fire() { const t = useToast(); return <button onClick={() => t("ciao")}>go</button>; }
  const { unmount } = render(<ToastProvider><Fire /></ToastProvider>);
  fireEvent.click(screen.getByText("go"));
  unmount();
  vi.advanceTimersByTime(3500);
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
  vi.useRealTimers();
});
```

Append to `WizardDialog.test.tsx`:

```tsx
test("clamps the step index when the steps array shrinks", async () => {
  function Host() {
    const [n, setN] = useState(2);
    const steps = Array.from({ length: n }, (_, i) => ({ title: `S${i + 1}`, content: <div>body {i + 1}</div> }));
    return (
      <>
        <button onClick={() => setN(1)}>shrink</button>
        <WizardDialog open onOpenChange={() => {}} title="T" steps={steps} />
      </>
    );
  }
  render(<Host />);
  await userEvent.click(screen.getByText("Avanti")); // now on step 2
  expect(screen.getByText("body 2")).toBeInTheDocument();
  await userEvent.click(screen.getByText("shrink"));
  expect(screen.getByText("body 1")).toBeInTheDocument(); // idx clamped, no crash
});
```
(add `import { useState } from "react";` to the test file if missing).

Append to `forms.test.tsx`:

```tsx
test("MoneyField commits once on Enter followed by blur", async () => {
  const onChange = vi.fn();
  render(<MoneyField label="Importo" cents={0} onChange={onChange} />);
  const input = screen.getByLabelText("Importo");
  await userEvent.clear(input);
  await userEvent.type(input, "12,50{Enter}");
  await userEvent.tab(); // blur without further edits
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith(1250);
});
```

Append to `installments.test.ts`:

```ts
test("redistributeOverride rejects overrides that would drive later cells negative", () => {
  const cells = [100, 10, 10];
  expect(redistributeOverride(cells, 0, 300)).toBe(cells); // delta -200 → r2/r3 would go negative
  expect(redistributeOverride(cells, 0, -5)).toBe(cells);  // negative cell value itself rejected
  expect(redistributeOverride(cells, 0, 80)).toEqual([80, 20, 20]); // legal spread still works
});
```

- [ ] **Step 2: Run them to see all four fail**

Run: `pnpm --filter @cl/web exec vitest run src/components/common src/components/forms src/recompute/installments.test.ts`
Expected: 4 new failures (console.error from setState-after-unmount; crash/wrong body on shrink; onChange called twice; negative cells returned).

- [ ] **Step 3: Implement the four fixes.**

`Toast.tsx` — clear the timer on unmount:

```tsx
  useEffect(() => () => clearTimeout(timer.current), []);
```
(add `useEffect` to the react import).

`WizardDialog.tsx` — clamp the index and silence the Radix description warning. Replace the `step`/`last` lines with:

```tsx
  const safeIdx = Math.min(idx, Math.max(0, steps.length - 1));
  const step = steps[safeIdx] ?? { title: "" };
  const last = steps.length === 0 || safeIdx === steps.length - 1;
```
use `safeIdx` everywhere `idx` was read for display/navigation (`setIdx(safeIdx + 1)`, `safeIdx > 0`, `setIdx(safeIdx - 1)`, the `i === safeIdx` class check), and add `aria-describedby={step.content ? undefined : "wizard-shell-note"}` to `<Dialog.Content>` with `id="wizard-shell-note"` on the fallback `<Dialog.Description>`.

`fields.tsx` — make MoneyField commit only when the draft changed (Enter parses+normalizes, so the following blur sees a clean draft and skips):

```tsx
  const lastCommitted = useRef(cents);
  useEffect(() => { lastCommitted.current = cents; }, [cents]);
  const commit = () => {
    const parsed = parseItMoney(draft);
    if (parsed === null) { setDraft(formatEUR(fromCents(cents))); return; }
    setDraft(formatEUR(fromCents(parsed)));
    if (parsed !== lastCommitted.current) { lastCommitted.current = parsed; onChange(parsed); }
  };
```

`installments.ts` — reject instead of producing negatives. In `redistributeOverride`, after computing `split`, validate before mutating:

```ts
  if (newValue < 0) return cells;
  const split = allocate(delta, later.map(() => 1));
  if (later.some((cellIdx, k) => out[cellIdx]! + split[k]! < 0)) return cells;
```
(returning the ORIGINAL `cells` reference makes `setInstallmentAmount` re-derive to an identical state — the UI simply keeps the old values; same observable behavior as the existing unknown-id no-op).

- [ ] **Step 4: Run the suite + typecheck, then commit**

Run: `pnpm --filter @cl/web test` → green (the existing `setInstallmentAmount` redistribution test still passes — its delta is positive). `pnpm --filter @cl/web typecheck` → clean.

```bash
git add apps/web/src/components/common/Toast.tsx apps/web/src/components/common/WizardDialog.tsx apps/web/src/components/common/WizardDialog.test.tsx apps/web/src/components/common/smallControls.test.tsx apps/web/src/components/forms/fields.tsx apps/web/src/components/forms/forms.test.tsx apps/web/src/recompute/installments.ts apps/web/src/recompute/installments.test.ts
git commit -m "$(cat <<'EOF'
fix(web): Plan 1 review follow-ups — toast cleanup, wizard idx/a11y, money single-commit, negative-redistribution guard

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
### Task 4: Giornale grid upgrade (entries as child rows, Partita column, paging, toast stubs)

**Files:**
- Modify: `apps/web/src/sections/giornale/GiornaleSection.tsx`
- Delete: `apps/web/src/sections/giornale/GiornaleSection.module.css` (entries-preview block is replaced by in-grid child rows)
- Test: `apps/web/src/sections/giornale/GiornaleSection.test.tsx` (rewrite)

- [ ] **Step 1: Rewrite the test file** as:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { ToastProvider } from "../../components/common/Toast";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { GiornaleSection } from "./GiornaleSection";

function Inner() {
  const rt = useAppRuntime();
  const addMany = () => {
    for (let i = 0; i < 12; i++) {
      rt.commands.addTransaction("sat-2011", {
        date: "2011-08-01", description: `Movimento ${i + 1}`,
        entries: [
          { accountId: "cassa", label: "Cassa Contanti", dareCents: 100, avereCents: 0 },
          { accountId: "banca", label: "Banca", dareCents: 0, avereCents: 100 },
        ],
      });
    }
  };
  return (
    <>
      <button onClick={() => rt.select({ accountingPeriodId: "sat-2011" })}>sel</button>
      <button onClick={addMany}>seed</button>
      <GiornaleSection />
    </>
  );
}
const setup = () => render(
  <AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>,
);

test("shows transactions with entries as expandable child rows and the Partita column", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  expect(await screen.findByText("Registrazione fattura Pulizie Acme")).toBeInTheDocument();
  expect(screen.getByText("Partita")).toBeInTheDocument();        // column header
  expect(screen.getByText("Acme Pulizie")).toBeInTheDocument();   // partita value
  expect(screen.getByText("Fornitori c/acquisti")).toBeInTheDocument(); // entry child row (expanded by default)
});

test("pages the journal 10 per page", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(screen.getByText("seed")); // 3 fixtures + 12 = 15 txns
  expect(await screen.findByText("pagina 1 di 2")).toBeInTheDocument();
  expect(screen.queryByText("Movimento 12")).not.toBeInTheDocument();
  await userEvent.click(screen.getByLabelText("Pagina successiva"));
  expect(await screen.findByText("Movimento 12")).toBeInTheDocument();
});

test("Stampa is an honest stub toast", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(screen.getByLabelText("Stampa"));
  expect(await screen.findByRole("status")).toHaveTextContent("Non disponibile nel prototipo");
});
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm --filter @cl/web exec vitest run src/sections/giornale`
Expected: FAIL — no Partita header, entries not in-grid, no paging bar, Stampa does nothing.

- [ ] **Step 3: Rewrite `GiornaleSection.tsx`** (wizard wiring stays exactly as today — Tasks 5–7 replace `shellSteps`):

```tsx
import { useState } from "react";
import type { LedgerTxnRow, TreeColumn } from "@cl/application";
import { SectionPanel } from "../../components/layout/SectionPanel";
import { TreeTable } from "../../components/grid/TreeTable";
import { WizardDialog, shellSteps } from "../../components/common/WizardDialog";
import { PagingBar } from "../../components/common/PagingBar";
import { useToast } from "../../components/common/Toast";
import { MoneyText, DateText } from "../../format";
import { useAppRuntime } from "../../runtime/useAppRuntime";

const PAGE_SIZE = 10;

interface GRow {
  id: string; kind: "txn" | "entry";
  date?: string; code?: number; description: string; partita?: string;
  dare: import("@cl/domain").Money; avere: import("@cl/domain").Money;
  children?: GRow[];
}

function toRows(txns: LedgerTxnRow[]): GRow[] {
  return txns.map((t) => ({
    id: t.id, kind: "txn", date: t.date, code: t.code, description: t.description,
    partita: t.partita, dare: t.dare, avere: t.avere,
    children: t.entries.map((e, i) => ({
      id: `${t.id}-e${i}`, kind: "entry", description: e.account, dare: e.dare, avere: e.avere,
    })),
  }));
}

const columns: TreeColumn<GRow>[] = [
  { id: "date", header: "Data", cell: (r) => (r.date ? <DateText iso={r.date} /> : "") },
  { id: "code", header: "N.", cell: (r) => (r.code !== undefined ? String(r.code) : "") },
  { id: "partita", header: "Partita", cell: (r) => r.partita ?? "" },
  { id: "description", header: "Descrizione operazione", cell: (r) => r.description },
  { id: "dare", header: "Dare", align: "right", cell: (r) => <MoneyText value={r.dare} /> },
  { id: "avere", header: "Avere", align: "right", cell: (r) => <MoneyText value={r.avere} /> },
];

export function GiornaleSection() {
  const rt = useAppRuntime();
  const toast = useToast();
  const txns = rt.useLedgerTransactions();
  const [wizard, setWizard] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(txns.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = toRows(txns.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE));

  const stub = () => toast("Non disponibile nel prototipo");
  const actions = [
    { icon: "add", label: "Registra fattura", primary: true, onClick: () => setWizard("Registrazione Fattura") },
    { icon: "edit", label: "Incasso", onClick: () => setWizard("Incasso Condòmino") },
    { icon: "edit", label: "Saldi iniziali", onClick: () => setWizard("Apertura Saldi Iniziali") },
    { sep: true, icon: "", label: "" },
    { icon: "print", label: "Stampa", onClick: stub }, { icon: "pdf", label: "PDF", onClick: stub },
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
      legend={<div>Ogni scrittura ha righe Dare/Avere bilanciate, elencate sotto la scrittura.</div>}
    >
      <TreeTable rows={rows} columns={columns} getRowKind={(r) => (r.kind === "txn" ? "group" : "row")} />
      <PagingBar page={safePage} pageCount={pageCount} onPage={setPage} />
      <WizardDialog open={wizard !== null} onOpenChange={(o) => !o && setWizard(null)}
        title={wizard ?? ""} steps={shellSteps(wizard ? stepsByWizard[wizard] ?? [] : [])} />
    </SectionPanel>
  );
}
```

Delete `GiornaleSection.module.css` (`git rm`); nothing else imports it.

- [ ] **Step 4: Run section tests + suite, then commit**

Run: `pnpm --filter @cl/web exec vitest run src/sections/giornale` → PASS. `pnpm --filter @cl/web test && pnpm --filter @cl/web typecheck` → green/clean.

```bash
git add -A apps/web/src/sections/giornale
git commit -m "$(cat <<'EOF'
feat(web): giornale grid — in-grid entry rows, Partita column, paging, honest print stubs

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Entries form + Scrittura contabile & Saldi iniziali wizards

One shared balanced-entries form powers both the plain transaction wizard and the opening-balances wizard (same posting rule; different title/command, per the store's `openBalances` delegation).

**Files:**
- Modify: `apps/web/src/mock/treeRows.ts` (+ `flattenRows`)
- Test: `apps/web/src/mock/treeRows.test.ts` (extend)
- Create: `apps/web/src/sections/giornale/wizards/accountOptions.ts`
- Create: `apps/web/src/sections/giornale/wizards/EntriesForm.tsx`
- Create: `apps/web/src/sections/giornale/wizards/ScritturaWizard.tsx`
- Modify: `apps/web/src/sections/giornale/GiornaleSection.tsx`
- Test: `apps/web/src/sections/giornale/wizards/ScritturaWizard.test.tsx` (create)

- [ ] **Step 1: Add `flattenRows` to `treeRows.ts` with a pinning test.**

Append to `treeRows.ts`:

```ts
/** Depth-first flatten of a tree into a single list (parents before children). */
export function flattenRows<R extends TreeRowLike>(rows: R[]): R[] {
  return rows.flatMap((r) => [r, ...flattenRows((r.children ?? []) as R[])]);
}
```

Append to `treeRows.test.ts`:

```ts
test("flattenRows lists depth-first, parents first", () => {
  const rows = [{ id: "a", children: [{ id: "a1" }, { id: "a2", children: [{ id: "a2x" }] }] }, { id: "b" }];
  expect(flattenRows(rows).map((r) => r.id)).toEqual(["a", "a1", "a2", "a2x", "b"]);
});
```

Run: `pnpm --filter @cl/web exec vitest run src/mock/treeRows.test.ts` → fails (no export) → implement → PASS.

- [ ] **Step 2: Create `accountOptions.ts`** — postable (non-grouping) accounts as select options:

```ts
import type { LedgerAccountRow } from "@cl/application";
import { flattenRows } from "../../../mock/treeRows";

export interface AccountOption { value: string; label: string; }

export function accountOptions(rows: LedgerAccountRow[]): AccountOption[] {
  return flattenRows(rows)
    .filter((r) => r.kind !== "grouping")
    .map((r) => ({ value: r.id, label: r.label }));
}

export function accountLabel(options: AccountOption[], id: string): string {
  return options.find((o) => o.value === id)?.label ?? id;
}
```

- [ ] **Step 3: Create `EntriesForm.tsx`** — editable Dare/Avere rows + live totals:

```tsx
import { fromCents, formatEUR } from "@cl/domain";
import { SelectField, MoneyField } from "../../../components/forms/fields";
import type { AccountOption } from "./accountOptions";

export interface EntryDraft { accountId: string; dareCents: number; avereCents: number; }

export const entryTotals = (entries: EntryDraft[]) => ({
  dare: entries.reduce((a, e) => a + e.dareCents, 0),
  avere: entries.reduce((a, e) => a + e.avereCents, 0),
});

/** Returns the Italian validation message for a draft entry list, or null when postable. */
export function validateEntries(entries: EntryDraft[]): string | null {
  if (entries.some((e) => !e.accountId)) return "Seleziona un conto per ogni riga";
  const { dare, avere } = entryTotals(entries);
  if (dare !== avere) return "Scrittura non bilanciata: dare ≠ avere";
  if (dare === 0) return "Inserisci almeno un importo";
  return null;
}

export function EntriesForm({ entries, onChange, options }: {
  entries: EntryDraft[]; onChange: (next: EntryDraft[]) => void; options: AccountOption[];
}) {
  const patch = (i: number, p: Partial<EntryDraft>) =>
    onChange(entries.map((e, k) => (k === i ? { ...e, ...p } : e)));
  const { dare, avere } = entryTotals(entries);
  return (
    <div>
      {entries.map((e, i) => (
        <div key={i} style={{ display: "flex", gap: "var(--sp-3)", alignItems: "flex-end" }}>
          <SelectField label={`Conto ${i + 1}`} value={e.accountId}
            onChange={(v) => patch(i, { accountId: v })}
            options={[{ value: "", label: "—" }, ...options]} />
          <MoneyField label={`Dare ${i + 1}`} cents={e.dareCents} onChange={(c) => patch(i, { dareCents: c })} />
          <MoneyField label={`Avere ${i + 1}`} cents={e.avereCents} onChange={(c) => patch(i, { avereCents: c })} />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...entries, { accountId: "", dareCents: 0, avereCents: 0 }])}>
        Aggiungi riga
      </button>
      <p>Totale Dare {formatEUR(fromCents(dare))} — Totale Avere {formatEUR(fromCents(avere))}
        {dare !== avere && <strong> (sbilancio {formatEUR(fromCents(dare - avere))})</strong>}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Create `ScritturaWizard.tsx`** — serves both modes:

```tsx
import { useState } from "react";
import { WizardDialog } from "../../../components/common/WizardDialog";
import { TextField, DateField } from "../../../components/forms/fields";
import { useToast } from "../../../components/common/Toast";
import { useAppRuntime } from "../../../runtime/useAppRuntime";
import { accountOptions, accountLabel } from "./accountOptions";
import { EntriesForm, validateEntries, type EntryDraft } from "./EntriesForm";

const EMPTY: EntryDraft[] = [
  { accountId: "", dareCents: 0, avereCents: 0 },
  { accountId: "", dareCents: 0, avereCents: 0 },
];

export function ScritturaWizard({ open, onOpenChange, mode }: {
  open: boolean; onOpenChange: (o: boolean) => void; mode: "scrittura" | "saldi";
}) {
  const rt = useAppRuntime();
  const toast = useToast();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const options = accountOptions(rt.useLedgerAccountsTree());

  const [date, setDate] = useState("");
  const [description, setDescription] = useState(mode === "saldi" ? "Apertura saldi iniziali" : "");
  const [partita, setPartita] = useState("");
  const [entries, setEntries] = useState<EntryDraft[]>(EMPTY);

  const reset = () => { setDate(""); setDescription(mode === "saldi" ? "Apertura saldi iniziali" : ""); setPartita(""); setEntries(EMPTY); };
  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const submit = () => {
    if (!periodId) return;
    const input = {
      date, description, partita: partita || undefined,
      entries: entries.map((e) => ({
        accountId: e.accountId, label: accountLabel(options, e.accountId),
        dareCents: e.dareCents, avereCents: e.avereCents,
      })),
    };
    try {
      if (mode === "saldi") rt.commands.openBalances(periodId, input);
      else rt.commands.addTransaction(periodId, input);
      toast("Scrittura registrata");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Errore");
    }
  };

  return (
    <WizardDialog open={open} onOpenChange={close}
      title={mode === "saldi" ? "Apertura Saldi Iniziali" : "Scrittura Contabile"}
      onSubmit={submit}
      steps={[
        {
          title: "Dati scrittura",
          validate: () => (!date ? "Inserisci la data" : !description ? "Inserisci la descrizione" : null),
          content: (
            <div>
              <DateField label="Data" value={date} onChange={setDate} />
              <TextField label="Descrizione" value={description} onChange={setDescription} />
              <TextField label="Partita" value={partita} onChange={setPartita} />
            </div>
          ),
        },
        {
          title: "Righe Dare/Avere",
          validate: () => validateEntries(entries),
          content: <EntriesForm entries={entries} onChange={setEntries} options={options} />,
        },
        {
          title: "Conferma",
          content: (
            <div>
              <p>{date} — {description}</p>
              <ul>
                {entries.map((e, i) => (
                  <li key={i}>{accountLabel(options, e.accountId)}: D {e.dareCents / 100} / A {e.avereCents / 100}</li>
                ))}
              </ul>
            </div>
          ),
        },
      ]}
    />
  );
}
```

- [ ] **Step 5: Wire into `GiornaleSection.tsx`.** Add a "Scrittura" toolbar button and mount the two wizard instances; remove their entries from `stepsByWizard`:

```tsx
import { ScritturaWizard } from "./wizards/ScritturaWizard";
// in actions, after "Saldi iniziali":
    { icon: "add", label: "Scrittura", onClick: () => setWizard("Scrittura Contabile") },
// stepsByWizard now only contains "Registrazione Fattura" and "Incasso Condòmino"
// before </SectionPanel>:
      <ScritturaWizard mode="scrittura" open={wizard === "Scrittura Contabile"} onOpenChange={(o) => !o && setWizard(null)} />
      <ScritturaWizard mode="saldi" open={wizard === "Apertura Saldi Iniziali"} onOpenChange={(o) => !o && setWizard(null)} />
```
and change the remaining shell `WizardDialog` to render only when `wizard` is one of the two still-shell wizards:
```tsx
      <WizardDialog open={wizard !== null && wizard in stepsByWizard} onOpenChange={(o) => !o && setWizard(null)}
        title={wizard ?? ""} steps={shellSteps(wizard ? stepsByWizard[wizard] ?? [] : [])} />
```

- [ ] **Step 6: Write the wizard test** at `wizards/ScritturaWizard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../../runtime/AppRuntimeProvider";
import { ToastProvider } from "../../../components/common/Toast";
import { useAppRuntime } from "../../../runtime/useAppRuntime";
import { GiornaleSection } from "../GiornaleSection";

function Inner() {
  const rt = useAppRuntime();
  return <><button onClick={() => rt.select({ accountingPeriodId: "sat-2011" })}>sel</button><GiornaleSection /></>;
}

test("scrittura wizard validates balance and posts to the journal", async () => {
  render(<AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(screen.getByLabelText("Scrittura"));

  // step 1
  await userEvent.type(screen.getByLabelText("Data"), "2011-09-01");
  await userEvent.type(screen.getByLabelText("Descrizione"), "Giroconto cassa-banca");
  await userEvent.click(screen.getByText("Avanti"));

  // step 2 — unbalanced first, then fixed
  await userEvent.selectOptions(screen.getByLabelText("Conto 1"), "cassa");
  const dare1 = screen.getByLabelText("Dare 1");
  await userEvent.clear(dare1); await userEvent.type(dare1, "10,00{Enter}");
  await userEvent.click(screen.getByText("Avanti"));
  expect(await screen.findByText("Scrittura non bilanciata: dare ≠ avere")).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Conto 2"), "banca");
  const avere2 = screen.getByLabelText("Avere 2");
  await userEvent.clear(avere2); await userEvent.type(avere2, "10,00{Enter}");
  await userEvent.click(screen.getByText("Avanti"));

  // step 3 — confirm
  await userEvent.click(screen.getByText("Conferma"));
  expect(await screen.findByText("Giroconto cassa-banca")).toBeInTheDocument(); // now in the grid
});
```

- [ ] **Step 7: Run, fix, commit**

Run: `pnpm --filter @cl/web exec vitest run src/sections/giornale src/mock/treeRows.test.ts` → PASS. Suite + typecheck → green/clean.

```bash
git add apps/web/src/mock/treeRows.ts apps/web/src/mock/treeRows.test.ts apps/web/src/sections/giornale
git commit -m "$(cat <<'EOF'
feat(web): scrittura contabile + saldi iniziali wizards on a shared balanced-entries form

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
### Task 6: Registrazione Fattura wizard

Supplier → amounts → ritenuta/expense account → review → `registerInvoice`. Payable/withholding accounts come from the functional-accounts config (Task 2), not from user input — matching the legacy flow.

**Files:**
- Create: `apps/web/src/sections/giornale/wizards/InvoiceWizard.tsx`
- Modify: `apps/web/src/sections/giornale/wizards/accountOptions.ts` (+ `expenseOptions`)
- Modify: `apps/web/src/sections/giornale/GiornaleSection.tsx`
- Test: `apps/web/src/sections/giornale/wizards/InvoiceWizard.test.tsx` (create)

- [ ] **Step 1: Add `expenseOptions` to `accountOptions.ts`:**

```ts
/** Expense accounts only (riparto-relevant leaves: have a preventivo or an R/d flag). */
export function expenseOptions(rows: LedgerAccountRow[]): AccountOption[] {
  return flattenRows(rows)
    .filter((r) => r.kind !== "grouping" && (r.preventivo !== null || r.rd !== undefined))
    .map((r) => ({ value: r.id, label: r.label }));
}
```

- [ ] **Step 2: Create `InvoiceWizard.tsx`:**

```tsx
import { useState } from "react";
import { fromCents, formatEUR } from "@cl/domain";
import { WizardDialog } from "../../../components/common/WizardDialog";
import { TextField, DateField, SelectField, MoneyField } from "../../../components/forms/fields";
import { useToast } from "../../../components/common/Toast";
import { useAppRuntime } from "../../../runtime/useAppRuntime";
import { accountOptions, expenseOptions, accountLabel } from "./accountOptions";

export function InvoiceWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const rt = useAppRuntime();
  const toast = useToast();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const detail = rt.useCondominiumDetail();
  const accounts = rt.useLedgerAccountsTree();
  const functional = rt.useFunctionalAccounts();
  const allOpts = accountOptions(accounts);
  const expOpts = expenseOptions(accounts);

  const [supplier, setSupplier] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [date, setDate] = useState("");
  const [grossCents, setGrossCents] = useState(0);
  const [withholdingCents, setWithholdingCents] = useState(0);
  const [expenseAccountId, setExpenseAccountId] = useState("");

  const reset = () => {
    setSupplier(""); setInvoiceNumber(""); setDate("");
    setGrossCents(0); setWithholdingCents(0); setExpenseAccountId("");
  };
  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const suppliers = (detail?.suppliers ?? []).map((s) => ({ value: s.nominativo, label: s.nominativo }));
  const net = grossCents - withholdingCents;

  const submit = () => {
    if (!periodId || !functional.payable || !functional.withholding) {
      toast("Configura i conti funzionali (Fornitori / Ritenuta)"); return;
    }
    try {
      rt.commands.registerInvoice(periodId, {
        date, supplierName: supplier, invoiceNumber, grossCents, withholdingCents,
        expenseAccountId, expenseAccountLabel: accountLabel(allOpts, expenseAccountId),
        payableAccountId: functional.payable, payableAccountLabel: accountLabel(allOpts, functional.payable),
        withholdingAccountId: functional.withholding, withholdingAccountLabel: accountLabel(allOpts, functional.withholding),
      });
      toast("Fattura registrata");
    } catch (err) { toast(err instanceof Error ? err.message : "Errore"); }
  };

  return (
    <WizardDialog open={open} onOpenChange={close} title="Registrazione Fattura" onSubmit={submit}
      steps={[
        {
          title: "Fornitore e importi",
          validate: () =>
            !supplier ? "Seleziona il fornitore"
            : !invoiceNumber ? "Inserisci il numero fattura"
            : !date ? "Inserisci la data"
            : grossCents <= 0 ? "Importo lordo non valido" : null,
          content: (
            <div>
              <SelectField label="Fornitore" value={supplier} onChange={setSupplier}
                options={[{ value: "", label: "—" }, ...suppliers]} />
              <TextField label="Numero fattura" value={invoiceNumber} onChange={setInvoiceNumber} />
              <DateField label="Data" value={date} onChange={setDate} />
              <MoneyField label="Importo lordo" cents={grossCents} onChange={setGrossCents} />
            </div>
          ),
        },
        {
          title: "Ritenuta e conto di spesa",
          validate: () =>
            withholdingCents < 0 || withholdingCents > grossCents ? "Ritenuta non valida"
            : !expenseAccountId ? "Seleziona il conto di spesa" : null,
          content: (
            <div>
              <MoneyField label="Ritenuta d'acconto" cents={withholdingCents} onChange={setWithholdingCents} />
              <SelectField label="Conto di spesa" value={expenseAccountId} onChange={setExpenseAccountId}
                options={[{ value: "", label: "—" }, ...expOpts]} />
              <p>Netto a pagare: {formatEUR(fromCents(net))}</p>
            </div>
          ),
        },
        {
          title: "Conferma",
          content: (
            <div>
              <p>Fattura {invoiceNumber} — {supplier} — {date}</p>
              <p>Lordo {formatEUR(fromCents(grossCents))}, ritenuta {formatEUR(fromCents(withholdingCents))},
                 netto {formatEUR(fromCents(net))} su {accountLabel(allOpts, expenseAccountId)}</p>
            </div>
          ),
        },
      ]}
    />
  );
}
```

- [ ] **Step 3: Wire it in `GiornaleSection.tsx`** — remove "Registrazione Fattura" from `stepsByWizard` and mount:

```tsx
import { InvoiceWizard } from "./wizards/InvoiceWizard";
// before </SectionPanel>:
      <InvoiceWizard open={wizard === "Registrazione Fattura"} onOpenChange={(o) => !o && setWizard(null)} />
```

- [ ] **Step 4: Write the end-to-end test** at `wizards/InvoiceWizard.test.tsx` (same harness shape as ScritturaWizard.test):

```tsx
test("invoice wizard posts a balanced invoice into the journal", async () => {
  render(<AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(screen.getByLabelText("Registra fattura"));

  await userEvent.selectOptions(screen.getByLabelText("Fornitore"), "Banca Pop. Emilia Romagna");
  await userEvent.type(screen.getByLabelText("Numero fattura"), "F-99");
  await userEvent.type(screen.getByLabelText("Data"), "2011-09-15");
  const gross = screen.getByLabelText("Importo lordo");
  await userEvent.clear(gross); await userEvent.type(gross, "500,00{Enter}");
  await userEvent.click(screen.getByText("Avanti"));

  const rit = screen.getByLabelText("Ritenuta d'acconto");
  await userEvent.clear(rit); await userEvent.type(rit, "100,00{Enter}");
  await userEvent.selectOptions(screen.getByLabelText("Conto di spesa"), "e-pul");
  await userEvent.click(screen.getByText("Avanti"));
  expect(await screen.findByText(/Netto a pagare/)).toBeInTheDocument();

  await userEvent.click(screen.getByText("Conferma"));
  expect(await screen.findByText(/Registrazione fattura F-99/)).toBeInTheDocument();
});
```
(`Inner` is the same `sel`-button + `<GiornaleSection />` harness as in ScritturaWizard.test — repeat it in this file.)

- [ ] **Step 5: Run, fix, commit**

Run: `pnpm --filter @cl/web exec vitest run src/sections/giornale` → PASS; suite + typecheck green.

```bash
git add apps/web/src/sections/giornale
git commit -m "$(cat <<'EOF'
feat(web): registrazione fattura wizard posting via registerInvoice with functional-account defaults

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Incasso wizard (cross-section cascade) + Pagamento Ritenuta wizard

The incasso needs a reliable resident→installment-row link: add `unitId` to `InstallmentRow` (fixtures + `createInstallments` already know it).

**Files:**
- Modify: `packages/application/src/types.ts` (`InstallmentRow.unitId?: Id`)
- Modify: `apps/web/src/mock/fixtures.ts` (set `unitId` on installment unit rows: `i-a01`→`u-a01`, `i-a02`→`u-a02`, `i-p01`→`u-p01`)
- Modify: `apps/web/src/mock/MockStore.ts` (`createInstallments` children gain `unitId: item.unitId`)
- Create: `apps/web/src/sections/giornale/wizards/IncassoWizard.tsx`
- Create: `apps/web/src/sections/giornale/wizards/RitenutaWizard.tsx`
- Modify: `apps/web/src/sections/giornale/GiornaleSection.tsx`
- Test: `apps/web/src/sections/giornale/wizards/IncassoWizard.test.tsx` (create)

- [ ] **Step 1: Type + fixture + store `unitId` additions** (three one-line edits described above). Run `pnpm -r typecheck` → clean.

- [ ] **Step 2: Create `IncassoWizard.tsx`:**

```tsx
import { useState } from "react";
import { fromCents, formatEUR } from "@cl/domain";
import type { UnitRow } from "@cl/application";
import { WizardDialog } from "../../../components/common/WizardDialog";
import { DateField, SelectField, CheckboxField } from "../../../components/forms/fields";
import { useToast } from "../../../components/common/Toast";
import { useAppRuntime } from "../../../runtime/useAppRuntime";
import { flattenRows } from "../../../mock/treeRows";
import { accountOptions, accountLabel } from "./accountOptions";

/** resident id → its parent unit id (residents are direct children of units). */
function unitOfResident(units: UnitRow[], residentId: string): UnitRow | null {
  for (const u of flattenRows(units)) {
    if (u.kind === "unit" && (u.children ?? []).some((r) => r.id === residentId)) return u;
  }
  return null;
}

export function IncassoWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const rt = useAppRuntime();
  const toast = useToast();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const units = rt.useUnitsTree();
  const installments = rt.useInstallments();
  const functional = rt.useFunctionalAccounts();
  const allOpts = accountOptions(rt.useLedgerAccountsTree());

  const residents = flattenRows(units).filter((r) => r.kind === "resident")
    .map((r) => ({ value: r.id, label: r.label }));

  const [date, setDate] = useState("");
  const [residentId, setResidentId] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [liquidAccountId, setLiquidAccountId] = useState("");

  const reset = () => { setDate(""); setResidentId(""); setChecked({}); setLiquidAccountId(""); };
  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const unit = residentId ? unitOfResident(units, residentId) : null;
  const instRow = unit
    ? flattenRows(installments.rows).find((r) => r.kind !== "group" && r.unitId === unit.id) ?? null
    : null;
  const settlements = installments.columns
    .filter((c) => checked[c.id])
    .map((c) => ({ installmentId: c.id, amountCents: instRow?.byInstallment[c.id]?.cents ?? 0 }));
  const total = settlements.reduce((a, s) => a + s.amountCents, 0);
  const liquid = liquidAccountId || functional.liquid || "";

  const submit = () => {
    if (!periodId || !functional.credit) { toast("Configura il conto funzionale Crediti"); return; }
    try {
      rt.commands.recordTaking(periodId, {
        date, residentId, residentLabel: residents.find((r) => r.value === residentId)?.label ?? residentId,
        liquidAccountId: liquid, liquidAccountLabel: accountLabel(allOpts, liquid),
        creditAccountId: functional.credit, creditAccountLabel: accountLabel(allOpts, functional.credit),
        settlements,
      });
      toast("Incasso registrato");
    } catch (err) { toast(err instanceof Error ? err.message : "Errore"); }
  };

  return (
    <WizardDialog open={open} onOpenChange={close} title="Incasso Condòmino" onSubmit={submit}
      steps={[
        {
          title: "Condòmino",
          validate: () => (!date ? "Inserisci la data" : !residentId ? "Seleziona il condòmino" : null),
          content: (
            <div>
              <DateField label="Data" value={date} onChange={setDate} />
              <SelectField label="Condòmino" value={residentId} onChange={setResidentId}
                options={[{ value: "", label: "—" }, ...residents]} />
            </div>
          ),
        },
        {
          title: "Rate da incassare",
          validate: () => (settlements.length === 0 || total === 0 ? "Seleziona almeno una rata" : null),
          content: (
            <div>
              {installments.columns.map((c) => (
                <CheckboxField key={c.id}
                  label={`${c.header} — ${formatEUR(fromCents(instRow?.byInstallment[c.id]?.cents ?? 0))}`}
                  checked={checked[c.id] ?? false}
                  onChange={(v) => setChecked((m) => ({ ...m, [c.id]: v }))} />
              ))}
              <p>Totale incasso: {formatEUR(fromCents(total))}</p>
            </div>
          ),
        },
        {
          title: "Conto di liquidità",
          validate: () => (!liquid ? "Seleziona il conto" : null),
          content: (
            <SelectField label="Conto di liquidità" value={liquid} onChange={setLiquidAccountId}
              options={allOpts} />
          ),
        },
        { title: "Conferma", content: <p>Incasso di {formatEUR(fromCents(total))} su {accountLabel(allOpts, liquid)}</p> },
      ]}
    />
  );
}
```

- [ ] **Step 3: Create `RitenutaWizard.tsx`** (simple two-step):

```tsx
import { useState } from "react";
import { fromCents, formatEUR } from "@cl/domain";
import { WizardDialog } from "../../../components/common/WizardDialog";
import { DateField, MoneyField } from "../../../components/forms/fields";
import { useToast } from "../../../components/common/Toast";
import { useAppRuntime } from "../../../runtime/useAppRuntime";
import { accountOptions, accountLabel } from "./accountOptions";

export function RitenutaWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const rt = useAppRuntime();
  const toast = useToast();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const functional = rt.useFunctionalAccounts();
  const allOpts = accountOptions(rt.useLedgerAccountsTree());
  const [date, setDate] = useState("");
  const [amountCents, setAmountCents] = useState(0);
  const close = (o: boolean) => { if (!o) { setDate(""); setAmountCents(0); } onOpenChange(o); };

  const submit = () => {
    if (!periodId || !functional.withholding || !functional.liquid) {
      toast("Configura i conti funzionali (Ritenuta / Liquidità)"); return;
    }
    try {
      rt.commands.payWithholding(periodId, {
        date, amountCents,
        withholdingAccountId: functional.withholding, withholdingAccountLabel: accountLabel(allOpts, functional.withholding),
        liquidAccountId: functional.liquid, liquidAccountLabel: accountLabel(allOpts, functional.liquid),
      });
      toast("Ritenuta pagata");
    } catch (err) { toast(err instanceof Error ? err.message : "Errore"); }
  };

  return (
    <WizardDialog open={open} onOpenChange={close} title="Pagamento Ritenuta" onSubmit={submit}
      steps={[
        {
          title: "Importo",
          validate: () => (!date ? "Inserisci la data" : amountCents <= 0 ? "Importo non valido" : null),
          content: (
            <div>
              <DateField label="Data" value={date} onChange={setDate} />
              <MoneyField label="Importo ritenuta" cents={amountCents} onChange={setAmountCents} />
            </div>
          ),
        },
        { title: "Conferma", content: <p>Pagamento ritenuta di {formatEUR(fromCents(amountCents))}</p> },
      ]}
    />
  );
}
```

- [ ] **Step 4: Wire both in `GiornaleSection.tsx`.** Delete `stepsByWizard` and the shell `WizardDialog` + `shellSteps` import entirely (every Giornale wizard is now real). Add a toolbar button `{ icon: "edit", label: "Paga ritenuta", onClick: () => setWizard("Pagamento Ritenuta") }` and mount:

```tsx
      <IncassoWizard open={wizard === "Incasso Condòmino"} onOpenChange={(o) => !o && setWizard(null)} />
      <RitenutaWizard open={wizard === "Pagamento Ritenuta"} onOpenChange={(o) => !o && setWizard(null)} />
```

- [ ] **Step 5: Write the cascade test** at `wizards/IncassoWizard.test.tsx` — the spec's flagship cross-section assertion (incasso updates Versato in Unità):

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../../runtime/AppRuntimeProvider";
import { ToastProvider } from "../../../components/common/Toast";
import { useAppRuntime } from "../../../runtime/useAppRuntime";
import { GiornaleSection } from "../GiornaleSection";
import { UnitaSection } from "../../unita/UnitaSection";

function Inner() {
  const rt = useAppRuntime();
  return (
    <>
      <button onClick={() => rt.select({ accountingPeriodId: "sat-2011" })}>sel</button>
      <GiornaleSection />
      <UnitaSection />
    </>
  );
}

test("incasso settles a rata and bumps Versato in the Unità section", async () => {
  render(<AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(screen.getByLabelText("Incasso"));

  await userEvent.type(screen.getByLabelText("Data"), "2011-10-01");
  await userEvent.selectOptions(screen.getByLabelText("Condòmino"), "r-a01-1");
  await userEvent.click(screen.getByText("Avanti"));

  await userEvent.click(screen.getByLabelText(/Rata 1 — 495,76/)); // A01 r1 = 49576 cents
  await userEvent.click(screen.getByText("Avanti"));
  await userEvent.click(screen.getByText("Avanti")); // liquid account defaults to functional "banca"
  await userEvent.click(screen.getByText("Conferma"));

  expect(await screen.findByText(/Incasso Alberi Dina/)).toBeInTheDocument(); // journal row
  const versati = await screen.findAllByText("495,76");
  expect(versati.length).toBeGreaterThanOrEqual(1); // Versato cell(s) in Unità
});
```

- [ ] **Step 6: Run, fix, commit**

Run: `pnpm --filter @cl/web exec vitest run src/sections/giornale` → PASS; full suite + `pnpm -r typecheck` green.

```bash
git add packages/application/src/types.ts apps/web/src/mock/fixtures.ts apps/web/src/mock/MockStore.ts apps/web/src/sections/giornale
git commit -m "$(cat <<'EOF'
feat(web): incasso + pagamento ritenuta wizards; installment rows linked to units by unitId

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
### Task 8: Conti — Mastrino tab, new columns, promoted row selection

**Files:**
- Create: `apps/web/src/sections/conti/mastrino.ts`
- Test: `apps/web/src/sections/conti/mastrino.test.ts` (create)
- Modify: `apps/web/src/sections/conti/ContiSection.tsx`
- Test: `apps/web/src/sections/conti/ContiSection.test.tsx` (extend)

- [ ] **Step 1: Write the failing mastrino test** at `mastrino.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mastrino } from "./mastrino";
import { ledgerTxnsByPeriod } from "../../mock/fixtures";

describe("mastrino", () => {
  it("extracts an account's entries with a running saldo", () => {
    const rows = mastrino(ledgerTxnsByPeriod["sat-2011"]!, "banca");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: "2011-04-02", description: "Incasso rata A02 Mauri",
    });
    expect(rows[0]!.dare.cents).toBe(100000);
    expect(rows[0]!.saldo.cents).toBe(100000); // running: 0 + 100000 - 0
  });
  it("accumulates saldo across multiple entries in date order", () => {
    const txns = [
      { id: "a", date: "2011-02-01", code: 2, description: "B", dare: { cents: 0 }, avere: { cents: 0 },
        entries: [{ accountId: "x", account: "X", dare: { cents: 0 }, avere: { cents: 300 } }] },
      { id: "b", date: "2011-01-01", code: 1, description: "A", dare: { cents: 0 }, avere: { cents: 0 },
        entries: [{ accountId: "x", account: "X", dare: { cents: 1000 }, avere: { cents: 0 } }] },
    ];
    const rows = mastrino(txns, "x");
    expect(rows.map((r) => r.saldo.cents)).toEqual([1000, 700]); // sorted by date, then code
  });
  it("returns [] for an account with no movements", () => {
    expect(mastrino(ledgerTxnsByPeriod["sat-2011"]!, "erar")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to fail, then implement `mastrino.ts`:**

```ts
import { fromCents, type Money } from "@cl/domain";
import type { Id, LedgerTxnRow } from "@cl/application";

export interface MastrinoRow {
  id: string; date: string; code: number; description: string;
  dare: Money; avere: Money; saldo: Money;
}

/** The selected account's ledger card: its entries across all transactions, date-ordered, with running saldo. */
export function mastrino(txns: LedgerTxnRow[], accountId: Id): MastrinoRow[] {
  const hits = txns
    .flatMap((t) => t.entries
      .filter((e) => e.accountId === accountId)
      .map((e, i) => ({ id: `${t.id}-m${i}`, date: t.date, code: t.code, description: t.description, dare: e.dare, avere: e.avere })))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.code - b.code));
  let run = 0;
  return hits.map((h) => { run += h.dare.cents - h.avere.cents; return { ...h, saldo: fromCents(run) }; });
}
```

Run: `pnpm --filter @cl/web exec vitest run src/sections/conti/mastrino.test.ts` → PASS.

- [ ] **Step 3: Upgrade `ContiSection.tsx`.** Three changes:

(a) Extend the columns array (after `saldo`, before `preventivo`):

```tsx
  { id: "rd", header: "R/d", cell: (r) => r.rd ?? "" },
  { id: "tabelle", header: "Tabelle di riparto", cell: (r) => r.tabelle ?? "" },
  { id: "restr", header: "Restr. competenza", cell: (r) => r.restriction ?? "" },
```

(b) Replace local selection state with the promoted runtime API:

```tsx
  const selId = rt.useSelectedRow("conti");
  const sel = selId ? find(rows, selId) : null;
  // TreeTable: selectedId={selId} onSelect={(r) => rt.selectRow("conti", r.id)}
```
(delete the `useState` import if now unused).

(c) Implement the Mastrino tab (replace the stub; label "Mastrino"):

```tsx
import { mastrino } from "./mastrino";
import { DateText } from "../../format";
// inside the component, before tabs:
  const txns = rt.useLedgerTransactions();
  const card = sel ? mastrino(txns, sel.id) : [];
// the tab:
    { id: "mastrino", label: "Mastrino", content: (
      <table>
        <thead><tr><th>Data</th><th>Descrizione</th><th>Dare</th><th>Avere</th><th>Saldo</th></tr></thead>
        <tbody>
          {card.map((m) => (
            <tr key={m.id}>
              <td><DateText iso={m.date} /></td><td>{m.description}</td>
              <td><MoneyText value={m.dare} /></td><td><MoneyText value={m.avere} /></td>
              <td><MoneyText value={m.saldo} /></td>
            </tr>
          ))}
          {card.length === 0 && <tr><td colSpan={5}>Nessun movimento</td></tr>}
        </tbody>
      </table>
    ) },
```

- [ ] **Step 4: Extend `ContiSection.test.tsx`:**

```tsx
test("mastrino tab lists the selected account's movements with running saldo", async () => {
  render(<AppRuntimeProvider><Inner /></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(await screen.findByText("Pulizie"));
  await userEvent.click(screen.getByText("Mastrino"));
  expect(await screen.findByText("Registrazione fattura Pulizie Acme")).toBeInTheDocument();
  expect(screen.getByText("R/d")).toBeInTheDocument();           // new column
  expect(screen.getByText("Proprietà")).toBeInTheDocument();     // Tabelle di riparto value
});
```

- [ ] **Step 5: Run, fix, commit**

Run: `pnpm --filter @cl/web exec vitest run src/sections/conti` → PASS; suite + typecheck green.

```bash
git add apps/web/src/sections/conti
git commit -m "$(cat <<'EOF'
feat(web): conti — mastrino tab with running saldo, R/d + riparto + competenza columns, promoted selection

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Conti — search, "Nascondi conti vuoti", inline preventivo edit

**Files:**
- Create: `apps/web/src/sections/conti/filterAccounts.ts`
- Test: `apps/web/src/sections/conti/filterAccounts.test.ts` (create)
- Modify: `apps/web/src/sections/conti/ContiSection.tsx`
- Test: `apps/web/src/sections/conti/ContiSection.test.tsx` (extend)

- [ ] **Step 1: Write the failing filter tests:**

```ts
import { describe, it, expect } from "vitest";
import { filterAccounts } from "./filterAccounts";
import { ledgerAccountsByPeriod } from "../../mock/fixtures";

const rows = ledgerAccountsByPeriod["sat-2011"]!;
const labels = (rs: ReturnType<typeof filterAccounts>): string[] =>
  rs.flatMap(function walk(r): string[] { return [r.label, ...(r.children ?? []).flatMap(walk)]; });

describe("filterAccounts", () => {
  it("matches case-insensitively and keeps ancestor groups of matches", () => {
    const out = filterAccounts(rows, "cassa", false);
    expect(labels(out)).toEqual(["Totale", "Patrimoniali", "(Attività)", "Liquidità", "Cassa Contanti"]);
  });
  it("hides zero-movement leaves when hideEmpty is on, pruning emptied groups", () => {
    const out = filterAccounts(rows, "", true);
    expect(labels(out)).not.toContain("Erario c/ritenute"); // 0/0 leaf
    expect(labels(out)).toContain("Fornitori c/acquisti");
  });
  it("no query, no hide → same reference (no pointless re-allocation)", () => {
    expect(filterAccounts(rows, "", false)).toBe(rows);
  });
});
```

- [ ] **Step 2: Run to fail, implement `filterAccounts.ts`:**

```ts
import type { LedgerAccountRow } from "@cl/application";

/** Search + hide-empty over the account tree. A group survives if it matches the
 * query itself (keeping all its children) or if any descendant survives. */
export function filterAccounts(rows: LedgerAccountRow[], query: string, hideEmpty: boolean): LedgerAccountRow[] {
  const q = query.trim().toLowerCase();
  if (!q && !hideEmpty) return rows;
  const walk = (rs: LedgerAccountRow[]): LedgerAccountRow[] =>
    rs.flatMap((r) => {
      const children = r.children ? walk(r.children) : undefined;
      const selfMatch = !q || r.label.toLowerCase().includes(q);
      if (r.children?.length) {
        if (!children?.length && !selfMatch) return [];
        return [{ ...r, children: selfMatch && !children?.length ? r.children : children }];
      }
      const empty = r.dare.cents === 0 && r.avere.cents === 0;
      return selfMatch && !(hideEmpty && empty) ? [r] : [];
    });
  return walk(rows);
}
```

Run: `pnpm --filter @cl/web exec vitest run src/sections/conti/filterAccounts.test.ts` → PASS (adjust the first expectation if the group-keeps-children branch yields extra rows: a query match on a group keeps its original children — the test queries a leaf so only its ancestor chain survives).

- [ ] **Step 3: Wire into `ContiSection.tsx`:**

```tsx
import { useState } from "react";
import { SearchBox } from "../../components/common/SearchBox";
import { ToolbarToggle } from "../../components/common/ToolbarToggle";
import { InlineMoney } from "../../components/grid/inlineEditors";
import { filterAccounts } from "./filterAccounts";
// in the component:
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const [query, setQuery] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);
  const allRows = rt.useLedgerAccountsTree();
  const rows = filterAccounts(allRows, query, hideEmpty);
  // `find(...)` for the detail keeps searching allRows so selection survives filtering
```

Replace the static `preventivo` column with an inline-editable one (columns must move INSIDE the component to close over `rt`/`periodId`):

```tsx
  { id: "preventivo", header: "Preventivo", align: "right", cell: (r) =>
      r.kind === "regular" && r.preventivo !== null && periodId
        ? <InlineMoney value={r.preventivo} onCommit={(cents) => rt.commands.setPreventivo(periodId, r.id, cents)} />
        : (r.preventivo ? <MoneyText value={r.preventivo} /> : <span>—</span>) },
```

Add the controls to the panel:

```tsx
    <SectionPanel ... toolbarRight={
      <>
        <ToolbarToggle label="Nascondi conti vuoti" checked={hideEmpty} onChange={setHideEmpty} />
        <SearchBox value={query} onChange={setQuery} placeholder="Cerca conto…" />
      </>
    }>
```

- [ ] **Step 4: Extend `ContiSection.test.tsx`:**

```tsx
test("search narrows the tree and hide-empty drops zero accounts", async () => {
  render(<AppRuntimeProvider><Inner /></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  await userEvent.type(await screen.findByPlaceholderText("Cerca conto…"), "banca");
  expect(screen.queryByText("Cassa Contanti")).not.toBeInTheDocument();
  expect(screen.getByText(/Banca Pop\. Emilia Romagna/)).toBeInTheDocument();
  await userEvent.clear(screen.getByPlaceholderText("Cerca conto…"));
  await userEvent.click(screen.getByLabelText("Nascondi conti vuoti"));
  expect(screen.queryByText("Erario c/ritenute")).not.toBeInTheDocument();
});

test("preventivo is inline-editable on expense accounts and persists to the store", async () => {
  render(<AppRuntimeProvider><Inner /></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  await userEvent.dblClick(await screen.findByText("1.200,00")); // e-pul preventivo
  const input = screen.getByRole("textbox");
  await userEvent.clear(input);
  await userEvent.type(input, "1.300,00{Enter}");
  expect(await screen.findByText("1.300,00")).toBeInTheDocument();
});
```
(`getByLabelText("Nascondi conti vuoti")` works because ToolbarToggle wires label→input via htmlFor.)

- [ ] **Step 5: Run, fix, commit**

```bash
git add apps/web/src/sections/conti
git commit -m "$(cat <<'EOF'
feat(web): conti — account search, hide-empty toggle, inline preventivo edit via setPreventivo

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Conti — account dialogs + Configura conti funzionali

**Files:**
- Create: `apps/web/src/sections/conti/AccountDialog.tsx`
- Create: `apps/web/src/sections/conti/FunctionalAccountsDialog.tsx`
- Modify: `apps/web/src/sections/conti/ContiSection.tsx`
- Test: `apps/web/src/sections/conti/ContiSection.test.tsx` (extend)

- [ ] **Step 1: Create `AccountDialog.tsx`** — single-step WizardDialog covering add + edit, with the expense variant:

```tsx
import { useEffect, useState } from "react";
import { fromCents } from "@cl/domain";
import type { LedgerAccountRow } from "@cl/application";
import { WizardDialog } from "../../components/common/WizardDialog";
import { TextField, SelectField, MoneyField, CheckboxField } from "../../components/forms/fields";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { flattenRows } from "../../mock/treeRows";

export function AccountDialog({ open, onOpenChange, editing }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: LedgerAccountRow | null;
}) {
  const rt = useAppRuntime();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const accounts = rt.useLedgerAccountsTree();
  const tables = rt.useDistributionTables();
  const groups = flattenRows(accounts).filter((r) => r.kind === "grouping")
    .map((r) => ({ value: r.id, label: r.label }));

  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<"regular" | "grouping">("regular");
  const [parentId, setParentId] = useState("");
  const [isExpense, setIsExpense] = useState(false);
  const [tableName, setTableName] = useState("");
  const [preventivoCents, setPreventivoCents] = useState(0);

  useEffect(() => {
    if (!open) return;
    setLabel(editing?.label ?? "");
    setKind(editing?.kind === "grouping" ? "grouping" : "regular");
    setParentId("");
    setIsExpense(editing ? editing.rd === "R" : false);
    setTableName(editing?.tabelle ?? "");
    setPreventivoCents(editing?.preventivo?.cents ?? 0);
  }, [open, editing]);

  const submit = () => {
    if (!periodId) return;
    const expense = isExpense
      ? { rd: "R" as const, tabelle: tableName, preventivo: fromCents(preventivoCents) }
      : {};
    if (editing) {
      rt.commands.editAccountRow(periodId, editing.id, { label, ...expense });
    } else {
      const zero = fromCents(0);
      rt.commands.addAccountRow(periodId, parentId || null, {
        id: `acc-${label.toLowerCase().replace(/\W+/g, "-")}`,
        kind, label, dare: zero, avere: zero, saldo: zero,
        preventivo: isExpense ? fromCents(preventivoCents) : null,
        ...(isExpense ? { rd: "R" as const, tabelle: tableName } : {}),
      });
    }
  };

  return (
    <WizardDialog open={open} onOpenChange={onOpenChange}
      title={editing ? "Modifica Conto" : "Aggiungi Conto"} onSubmit={submit} submitLabel="Salva"
      steps={[{
        title: "Dati conto",
        validate: () =>
          !label.trim() ? "Inserisci il nome del conto"
          : !editing && !parentId ? "Seleziona il raggruppamento padre"
          : isExpense && !tableName ? "Seleziona la tabella di riparto" : null,
        content: (
          <div>
            <TextField label="Nome conto" value={label} onChange={setLabel} />
            {!editing && (
              <>
                <SelectField label="Tipo conto" value={kind} onChange={(v) => setKind(v as "regular" | "grouping")}
                  options={[{ value: "regular", label: "Movimentabile" }, { value: "grouping", label: "Raggruppamento" }]} />
                <SelectField label="Raggruppamento padre" value={parentId} onChange={setParentId}
                  options={[{ value: "", label: "—" }, ...groups]} />
              </>
            )}
            {kind === "regular" && (
              <>
                <CheckboxField label="Conto di spesa (ripartito)" checked={isExpense} onChange={setIsExpense} />
                {isExpense && (
                  <>
                    <SelectField label="Tabella di riparto" value={tableName} onChange={setTableName}
                      options={[{ value: "", label: "—" }, ...tables.map((t) => ({ value: t.name, label: t.name }))]} />
                    <MoneyField label="Preventivo" cents={preventivoCents} onChange={setPreventivoCents} />
                  </>
                )}
              </>
            )}
          </div>
        ),
      }]}
    />
  );
}
```

- [ ] **Step 2: Create `FunctionalAccountsDialog.tsx`:**

```tsx
import { useEffect, useState } from "react";
import type { FunctionalRole } from "@cl/application";
import { WizardDialog } from "../../components/common/WizardDialog";
import { SelectField } from "../../components/forms/fields";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { accountOptions } from "../giornale/wizards/accountOptions";

const ROLES: { role: FunctionalRole; label: string }[] = [
  { role: "liquid", label: "Conto di liquidità" },
  { role: "payable", label: "Fornitori c/acquisti" },
  { role: "withholding", label: "Erario c/ritenute" },
  { role: "credit", label: "Condòmini c/rate" },
];

export function FunctionalAccountsDialog({ open, onOpenChange }: {
  open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const rt = useAppRuntime();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const functional = rt.useFunctionalAccounts();
  const options = accountOptions(rt.useLedgerAccountsTree());
  const [draft, setDraft] = useState<Partial<Record<FunctionalRole, string>>>({});
  useEffect(() => { if (open) setDraft(functional); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    if (!periodId) return;
    for (const { role } of ROLES) {
      const id = draft[role];
      if (id) rt.commands.setFunctionalAccount(periodId, role, id);
    }
  };

  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} title="Configura Conti Funzionali"
      onSubmit={submit} submitLabel="Salva"
      steps={[{
        title: "Ruoli",
        content: (
          <div>
            {ROLES.map(({ role, label }) => (
              <SelectField key={role} label={label} value={draft[role] ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, [role]: v }))}
                options={[{ value: "", label: "—" }, ...options]} />
            ))}
          </div>
        ),
      }]}
    />
  );
}
```

- [ ] **Step 3: Wire the toolbar in `ContiSection.tsx`.** Replace `STANDARD_ACTIONS` with wired actions (toast stubs for print group):

```tsx
  const toast = useToast();
  const stub = () => toast("Non disponibile nel prototipo");
  const [dialog, setDialog] = useState<"add" | "edit" | "functional" | null>(null);
  const actions = [
    { icon: "add", label: "Aggiungi", primary: true, onClick: () => setDialog("add") },
    { icon: "edit", label: "Modifica", disabled: !sel, onClick: () => setDialog("edit") },
    { icon: "remove", label: "Rimuovi", disabled: !sel || !!sel?.children?.length,
      onClick: () => { if (periodId && selId) { rt.commands.removeAccountRow(periodId, selId); rt.selectRow("conti", null); } } },
    { sep: true, icon: "", label: "" },
    { icon: "edit", label: "Conti funzionali", onClick: () => setDialog("functional") },
    { sep: true, icon: "", label: "" },
    { icon: "print", label: "Stampa", onClick: stub }, { icon: "pdf", label: "PDF", onClick: stub },
    { icon: "excel", label: "Excel", onClick: stub },
    { sep: true, icon: "", label: "" },
    { icon: "refresh", label: "Aggiorna", onClick: () => {} },
  ];
  // mounted before </SectionPanel>:
      <AccountDialog open={dialog === "add" || dialog === "edit"}
        editing={dialog === "edit" ? sel : null}
        onOpenChange={(o) => !o && setDialog(null)} />
      <FunctionalAccountsDialog open={dialog === "functional"} onOpenChange={(o) => !o && setDialog(null)} />
```
ContiSection tests now need `<ToastProvider>` in their harness — update the render wrapper in `ContiSection.test.tsx`.

- [ ] **Step 4: Extend `ContiSection.test.tsx`:**

```tsx
test("adds an account via the dialog under a chosen group", async () => {
  render(<AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(screen.getByLabelText("Aggiungi"));
  await userEvent.type(screen.getByLabelText("Nome conto"), "C/C Postale");
  await userEvent.selectOptions(screen.getByLabelText("Raggruppamento padre"), "liq");
  await userEvent.click(screen.getByText("Salva"));
  expect(await screen.findByText("C/C Postale")).toBeInTheDocument();
});

test("functional accounts dialog persists role changes", async () => {
  render(<AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(screen.getByLabelText("Conti funzionali"));
  await userEvent.selectOptions(screen.getByLabelText("Conto di liquidità"), "cassa");
  await userEvent.click(screen.getByText("Salva"));
  // reopen: the persisted value is shown
  await userEvent.click(screen.getByLabelText("Conti funzionali"));
  expect(screen.getByLabelText("Conto di liquidità")).toHaveValue("cassa");
});
```

- [ ] **Step 5: Run, fix, commit**

Run: `pnpm --filter @cl/web exec vitest run src/sections/conti` → PASS; suite + typecheck green.

```bash
git add apps/web/src/sections/conti
git commit -m "$(cat <<'EOF'
feat(web): conti — add/edit/remove account dialogs (expense variant) + configura conti funzionali

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
### Task 11: Rate — inline cell editing (unit rows only), override/lock flags, Modifica Rata dialog

**Files:**
- Modify: `apps/web/src/mock/MockStore.ts` (`setInstallmentAmount` marks the cell overridden)
- Test: `apps/web/src/mock/MockStore.test.ts` (extend)
- Modify: `apps/web/src/components/forms/fields.tsx` (`disabled` prop on TextField/DateField)
- Create: `apps/web/src/sections/rate/EditInstallmentDialog.tsx`
- Modify: `apps/web/src/sections/rate/RateSection.tsx`
- Test: `apps/web/src/sections/rate/RateSection.test.tsx` (extend)

- [ ] **Step 1: Store — mark overridden cells.** In `setInstallmentAmount`'s `mapRow` callback, when building the edited row also set:

```ts
        return {
          ...r,
          byInstallment: Object.fromEntries(order.map((id, i) => [id, fromCents(next[i]!)])),
          overridden: { ...r.overridden, [installmentId]: true },
        };
```
Guard: when `redistributeOverride` returned the SAME array (rejected negative — Task 3), skip the flag:
```ts
        const next = redistributeOverride(cells, idx, cents);
        if (next === cells) return r;
```
(note: `cells` is freshly mapped each call, so compare against the result: `redistributeOverride` returns its `cells` argument by reference on rejection — `next === cells` detects it.)

Pinning test (append to `MockStore.test.ts`):

```ts
  it("setInstallmentAmount flags the edited cell as overridden; rejected edits flag nothing", () => {
    const s = new MockStore();
    s.setInstallmentAmount("sat-2011", "i-a01", "r1", 40000);
    let a01 = latest(s.installments("sat-2011")).rows[0]!.children!.find((r) => r.id === "i-a01")!;
    expect(a01.overridden).toEqual({ r1: true });
    s.setInstallmentAmount("sat-2011", "i-a01", "r2", 99999999); // would drive r3 negative → rejected
    a01 = latest(s.installments("sat-2011")).rows[0]!.children!.find((r) => r.id === "i-a01")!;
    expect(a01.overridden).toEqual({ r1: true });
    expect(a01.byInstallment.r2!.cents).toBe(49576 + 4788); // unchanged by the rejected edit
  });
```

- [ ] **Step 2: `fields.tsx`** — add `disabled?: boolean` to TextField's props and pass it to the `<input>`; DateField inherits via spread. (One-line each.)

- [ ] **Step 3: Create `EditInstallmentDialog.tsx`** — legacy behavior: Bloccata disables name/expiry:

```tsx
import { useEffect, useState } from "react";
import { WizardDialog } from "../../components/common/WizardDialog";
import { TextField, DateField, SelectField, CheckboxField } from "../../components/forms/fields";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { formatItDate } from "../../recompute/dates";

export function EditInstallmentDialog({ open, onOpenChange }: {
  open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const rt = useAppRuntime();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const { columns } = rt.useInstallments();
  const [colId, setColId] = useState("");
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [locked, setLocked] = useState(false);

  useEffect(() => { if (open) { setColId(""); setName(""); setExpiry(""); setLocked(false); } }, [open]);
  const pick = (id: string) => {
    setColId(id);
    const col = columns.find((c) => c.id === id);
    setName(col?.header ?? ""); setExpiry(col?.expiry ?? ""); setLocked(col?.locked ?? false);
  };

  const submit = () => {
    if (!periodId || !colId) return;
    const header = expiry ? `${name.replace(/\s*\(.*\)$/, "")} (${formatItDate(expiry)})` : name;
    rt.commands.editInstallment(periodId, colId, { header, expiry: expiry || undefined, locked });
  };

  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} title="Modifica Rata" onSubmit={submit} submitLabel="Salva"
      steps={[{
        title: "Rata",
        validate: () => (!colId ? "Seleziona la rata" : !name.trim() ? "Inserisci il nome" : null),
        content: (
          <div>
            <SelectField label="Rata" value={colId} onChange={pick}
              options={[{ value: "", label: "—" }, ...columns.map((c) => ({ value: c.id, label: c.header }))]} />
            <CheckboxField label="Bloccata" checked={locked} onChange={setLocked} />
            <TextField label="Nome" value={name} onChange={setName} disabled={locked} />
            <DateField label="Scadenza" value={expiry} onChange={setExpiry} disabled={locked} />
          </div>
        ),
      }]}
    />
  );
}
```

- [ ] **Step 4: Rewire `RateSection.tsx`.** Move `columns` inside the component, make rata cells inline-editable on non-group rows, render flags, wire the dialog + toast stubs:

```tsx
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const toast = useToast();
  const stub = () => toast("Non disponibile nel prototipo");
  const [editDialog, setEditDialog] = useState(false);

  const columns: TreeColumn<InstallmentRow>[] = [
    /* label/role/saldoPrec/totPreventivo/totDovuto unchanged */
    ...instCols.map((c) => ({
      id: c.id,
      header: c.locked ? `${c.header} (bloccata)` : c.header,
      align: "right" as const,
      cell: (r: InstallmentRow) => {
        const value = r.byInstallment[c.id] ?? { cents: 0 };
        const mark = r.overridden?.[c.id] ? " •" : "";
        if (r.kind === "group" || !periodId) return <><MoneyText value={value} />{mark}</>;
        return <><InlineMoney value={value} onCommit={(cents) => rt.commands.setInstallmentAmount(periodId, r.id, c.id, cents)} />{mark}</>;
      },
    })),
  ];

  const actions = [
    { icon: "add", label: "Crea rate da preventivo", primary: true, onClick: () => setWizard(true) },
    { icon: "edit", label: "Modifica rata", onClick: () => setEditDialog(true) },
    { sep: true, icon: "", label: "" },
    { icon: "print", label: "Stampa", onClick: stub }, { icon: "pdf", label: "PDF", onClick: stub },
  ];
  // mounted: <EditInstallmentDialog open={editDialog} onOpenChange={setEditDialog} />
```
Update the legend to `Doppio-click su una rata per modificarla; • = importo modificato a mano.` RateSection tests now need `<ToastProvider>` — update the harness.

- [ ] **Step 5: Extend `RateSection.test.tsx`:**

```tsx
test("editing a rata cell redistributes later rate and marks the cell", async () => {
  setup(); // harness with ToastProvider
  await userEvent.click(screen.getByText("sel"));
  await userEvent.dblClick(await screen.findByText("495,76")); // A01 r1
  const input = screen.getByRole("textbox");
  await userEvent.clear(input);
  await userEvent.type(input, "400,00{Enter}");
  expect(await screen.findByText("400,00")).toBeInTheDocument();
  expect(screen.getAllByText(/543,64/).length).toBeGreaterThan(0); // r2 absorbed 47,88
});

test("modifica rata locks a rata: name disabled, header flagged", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(screen.getByLabelText("Modifica rata"));
  await userEvent.selectOptions(screen.getByLabelText("Rata"), "r1");
  await userEvent.click(screen.getByLabelText("Bloccata"));
  expect(screen.getByLabelText("Nome")).toBeDisabled();
  await userEvent.click(screen.getByText("Salva"));
  expect(await screen.findByText("Rata 1 (bloccata)")).toBeInTheDocument();
});
```

- [ ] **Step 6: Run, fix, commit**

Run: `pnpm --filter @cl/web exec vitest run src/sections/rate src/mock/MockStore.test.ts` → PASS; suite + typecheck green.

```bash
git add apps/web/src/mock/MockStore.ts apps/web/src/mock/MockStore.test.ts apps/web/src/components/forms/fields.tsx apps/web/src/sections/rate
git commit -m "$(cat <<'EOF'
feat(web): rate — inline rata editing with override markers, lock flags, modifica rata dialog

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Rate — "Crea rate da preventivo" wizard

**Files:**
- Create: `apps/web/src/sections/rate/CreateInstallmentsWizard.tsx`
- Modify: `apps/web/src/sections/rate/RateSection.tsx`
- Test: `apps/web/src/sections/rate/RateSection.test.tsx` (extend)

- [ ] **Step 1: Create `CreateInstallmentsWizard.tsx`:**

```tsx
import { useState } from "react";
import { fromCents, formatEUR } from "@cl/domain";
import { WizardDialog } from "../../components/common/WizardDialog";
import { TextField, DateField, SelectField, MoneyField } from "../../components/forms/fields";
import { useToast } from "../../components/common/Toast";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { distributeInstallments } from "../../recompute/installments";

export function CreateInstallmentsWizard({ open, onOpenChange }: {
  open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const rt = useAppRuntime();
  const toast = useToast();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const tables = rt.useDistributionTables();
  const existing = rt.useInstallments();

  const [tableId, setTableId] = useState("");
  const [totalCents, setTotalCents] = useState(0);
  const [count, setCount] = useState("4");
  const [cadence, setCadence] = useState("3");
  const [firstExpiry, setFirstExpiry] = useState("");

  const reset = () => { setTableId(""); setTotalCents(0); setCount("4"); setCadence("3"); setFirstExpiry(""); };
  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const n = parseInt(count, 10);
  const cad = parseInt(cadence, 10);
  const table = tables.find((t) => t.id === tableId) ?? null;
  const preview = table && n > 0 && totalCents > 0
    ? distributeInstallments(totalCents, table.items.map((i) => i.coefficient), n)
    : [];

  const submit = () => {
    if (!periodId) return;
    try {
      rt.commands.createInstallments(periodId, {
        count: n, firstExpiry, cadenceMonths: cad, totalCents, tableId,
      });
      toast("Rate create");
    } catch (err) { toast(err instanceof Error ? err.message : "Errore"); }
  };

  return (
    <WizardDialog open={open} onOpenChange={close} title="Crea Rate da Preventivo" onSubmit={submit}
      steps={[
        {
          title: "Numero e periodo",
          validate: () =>
            !tableId ? "Seleziona la tabella di riparto"
            : totalCents <= 0 ? "Inserisci il totale preventivo"
            : !Number.isInteger(n) || n < 1 || n > 12 ? "Numero rate non valido (1–12)"
            : !Number.isInteger(cad) || cad < 1 ? "Cadenza non valida"
            : !firstExpiry ? "Inserisci la prima scadenza" : null,
          content: (
            <div>
              <SelectField label="Tabella di riparto" value={tableId} onChange={setTableId}
                options={[{ value: "", label: "—" }, ...tables.map((t) => ({ value: t.id, label: t.name }))]} />
              <MoneyField label="Totale preventivo" cents={totalCents} onChange={setTotalCents} />
              <TextField label="Numero rate" value={count} onChange={setCount} type="number" />
              <TextField label="Cadenza (mesi)" value={cadence} onChange={setCadence} type="number" />
              <DateField label="Prima scadenza" value={firstExpiry} onChange={setFirstExpiry} />
            </div>
          ),
        },
        {
          title: "Distribuzione",
          content: (
            <table>
              <thead><tr><th>Unità</th><th>Totale</th></tr></thead>
              <tbody>
                {(table?.items ?? []).map((item, i) => (
                  <tr key={item.unitId}>
                    <td>{item.unitLabel}</td>
                    <td>{formatEUR(fromCents((preview[i] ?? []).reduce((a, b) => a + b, 0)))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ),
        },
        {
          title: "Revisione",
          content: (
            <div>
              {existing.rows.length > 0 && (
                <p role="alert"><strong>Attenzione:</strong> le rate esistenti verranno sostituite.</p>
              )}
              <p>{count} rate ogni {cadence} mesi dalla prima scadenza, per un totale di {formatEUR(fromCents(totalCents))}.</p>
            </div>
          ),
        },
      ]}
    />
  );
}
```

- [ ] **Step 2: Wire into `RateSection.tsx`** — replace the shell `WizardDialog`/`shellSteps` with:

```tsx
      <CreateInstallmentsWizard open={wizard} onOpenChange={setWizard} />
```
(remove the now-unused `shellSteps`/`WizardDialog` imports).

- [ ] **Step 3: Extend `RateSection.test.tsx`:**

```tsx
test("crea rate wizard warns about overwrite and replaces the installment set", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(screen.getByLabelText("Crea rate da preventivo"));

  await userEvent.selectOptions(screen.getByLabelText("Tabella di riparto"), "t-prop");
  const tot = screen.getByLabelText("Totale preventivo");
  await userEvent.clear(tot); await userEvent.type(tot, "38.000,00{Enter}");
  await userEvent.type(screen.getByLabelText("Prima scadenza"), "2011-02-01");
  await userEvent.click(screen.getByText("Avanti"));

  expect(await screen.findByText("A01 - Alberi Dina")).toBeInTheDocument(); // preview rows
  await userEvent.click(screen.getByText("Avanti"));

  expect(await screen.findByRole("alert")).toHaveTextContent("verranno sostituite");
  await userEvent.click(screen.getByText("Conferma"));

  expect(await screen.findByText("Rata 1 (01/02/2011)")).toBeInTheDocument();
  expect(screen.getByText("Rata 4 (01/11/2011)")).toBeInTheDocument();
});
```

- [ ] **Step 4: Run, fix, commit**

Run: `pnpm --filter @cl/web exec vitest run src/sections/rate` → PASS; suite + typecheck green.

```bash
git add apps/web/src/sections/rate
git commit -m "$(cat <<'EOF'
feat(web): crea rate da preventivo wizard with distribution preview and overwrite warning

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
### Task 13: Tabelle — TreeTable coefficient grid wired to the store + tables-pane toolbar/dialogs

The coefficient editor currently writes to throwaway local state (`coeffOverrides`); rewire it to `setCoefficient` so the riparto pane recomputes live (the store command from Plan 1 already does both panes).

**Files:**
- Create: `apps/web/src/sections/tabelle/TableDialogs.tsx`
- Modify: `apps/web/src/sections/tabelle/TabelleSection.tsx`
- Test: `apps/web/src/sections/tabelle/TabelleSection.test.tsx` (rewrite/extend)

- [ ] **Step 1: Create `TableDialogs.tsx`** (two single-step dialogs):

```tsx
import { useEffect, useState } from "react";
import type { DistributionTable } from "@cl/application";
import { WizardDialog } from "../../components/common/WizardDialog";
import { TextField, SelectField } from "../../components/forms/fields";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { flattenRows } from "../../mock/treeRows";

export function TableDialog({ open, onOpenChange, editing }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: DistributionTable | null;
}) {
  const rt = useAppRuntime();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const [name, setName] = useState("");
  const [total, setTotal] = useState("1000");
  useEffect(() => {
    if (open) { setName(editing?.name ?? ""); setTotal(String(editing?.total ?? 1000)); }
  }, [open, editing]);

  const submit = () => {
    if (!periodId) return;
    const tot = Number(total);
    if (editing) rt.commands.editTable(periodId, editing.id, { name, total: tot });
    else rt.commands.addTable(periodId, {
      id: `t-${name.toLowerCase().replace(/\W+/g, "-")}`, name, restriction: null, total: tot, items: [],
    });
  };

  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} onSubmit={submit} submitLabel="Salva"
      title={editing ? "Modifica Tabella" : "Aggiungi Tabella"}
      steps={[{
        title: "Tabella",
        validate: () => (!name.trim() ? "Inserisci il nome" : Number.isNaN(Number(total)) ? "Totale non valido" : null),
        content: (
          <div>
            <TextField label="Nome tabella" value={name} onChange={setName} />
            <TextField label="Totale (millesimi)" value={total} onChange={setTotal} type="number" />
          </div>
        ),
      }]}
    />
  );
}

export function AddItemDialog({ open, onOpenChange, tableId }: {
  open: boolean; onOpenChange: (o: boolean) => void; tableId: string | null;
}) {
  const rt = useAppRuntime();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const units = flattenRows(rt.useUnitsTree()).filter((u) => u.kind === "unit");
  const [unitId, setUnitId] = useState("");
  const [coefficient, setCoefficient] = useState("0");
  useEffect(() => { if (open) { setUnitId(""); setCoefficient("0"); } }, [open]);

  const submit = () => {
    if (!periodId || !tableId) return;
    rt.commands.addTableItem(periodId, tableId, {
      unitId, unitLabel: units.find((u) => u.id === unitId)?.label ?? unitId,
      coefficient: Number(coefficient.replace(",", ".")), competenza: "intero",
    });
  };

  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} onSubmit={submit} submitLabel="Salva"
      title="Aggiungi Coefficiente"
      steps={[{
        title: "Riga",
        validate: () => (!unitId ? "Seleziona l'unità" : Number.isNaN(Number(coefficient.replace(",", "."))) ? "Coefficiente non valido" : null),
        content: (
          <div>
            <SelectField label="Unità" value={unitId} onChange={setUnitId}
              options={[{ value: "", label: "—" }, ...units.map((u) => ({ value: u.id, label: u.label }))]} />
            <TextField label="Coefficiente" value={coefficient} onChange={setCoefficient} />
          </div>
        ),
      }]}
    />
  );
}
```

- [ ] **Step 2: Rework `TabelleSection.tsx`.** Replace the raw `<table>` coefficient grid and dead local override state:

```tsx
import { TreeTable } from "../../components/grid/TreeTable";
import { InlineNumber } from "../../components/grid/inlineEditors";
import { Coefficient } from "../../format";
import { TableDialog, AddItemDialog } from "./TableDialogs";
// in the component (replace coeffOverrides state):
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const [dialog, setDialog] = useState<"addTable" | "editTable" | "addItem" | null>(null);
  const [selItemId, setSelItemId] = useState<string | null>(null);

  interface CoeffRow { id: string; label: string; coefficient: number; competenza: string; }
  const coeffRows: CoeffRow[] = (selTable?.items ?? []).map((it) => ({
    id: it.unitId, label: it.unitLabel, coefficient: it.coefficient, competenza: it.competenza,
  }));
  const coeffColumns: TreeColumn<CoeffRow>[] = [
    { id: "label", header: "Unità", cell: (r) => r.label },
    { id: "coeff", header: "Coefficiente", align: "right", cell: (r) =>
        periodId && selTable
          ? <InlineNumber value={r.coefficient} onCommit={(n) => rt.commands.setCoefficient(periodId, selTable.id, r.id, n)} />
          : <Coefficient value={r.coefficient} /> },
    { id: "competenza", header: "Competenza", cell: (r) => r.competenza },
  ];
```

Replace the coefficient pane body with:

```tsx
            <div className={styles.pane}>
              <div className={styles.paneTitle}>Coefficienti — {selTable?.name ?? "—"}</div>
              <TreeTable rows={coeffRows} columns={coeffColumns} getRowKind={() => "row"}
                selectedId={selItemId} onSelect={(r) => setSelItemId(r.id)} />
            </div>
```

Add a tables-pane toolbar above the tables list (plain buttons, token-styled via the existing `styles.paneTitle` block area):

```tsx
              <div className={styles.paneTitle}>
                Tabelle
                <span style={{ float: "right", display: "inline-flex", gap: "var(--sp-2)" }}>
                  <button aria-label="Aggiungi tabella" onClick={() => setDialog("addTable")}>+</button>
                  <button aria-label="Modifica tabella" disabled={!selTable} onClick={() => setDialog("editTable")}>✎</button>
                  <button aria-label="Elimina tabella" disabled={!selTable}
                    onClick={() => { if (periodId && selTable) { rt.commands.removeTable(periodId, selTable.id); setSelTableId(null); } }}>×</button>
                  <button aria-label="Aggiungi coefficiente" disabled={!selTable} onClick={() => setDialog("addItem")}>+r</button>
                  <button aria-label="Rimuovi coefficiente" disabled={!selTable || !selItemId}
                    onClick={() => { if (periodId && selTable && selItemId) { rt.commands.removeTableItem(periodId, selTable.id, selItemId); setSelItemId(null); } }}>−r</button>
                </span>
              </div>
```

Mount the dialogs before `</SectionPanel>`:

```tsx
      <TableDialog open={dialog === "addTable" || dialog === "editTable"}
        editing={dialog === "editTable" ? selTable : null}
        onOpenChange={(o) => !o && setDialog(null)} />
      <AddItemDialog open={dialog === "addItem"} tableId={selTable?.id ?? null}
        onOpenChange={(o) => !o && setDialog(null)} />
```

- [ ] **Step 3: Rewrite/extend `TabelleSection.test.tsx`** — the old "edits coefficient" test asserted local-state behavior; replace it:

```tsx
test("coefficient edit persists to the store and recomputes the riparto live", async () => {
  render(<AppRuntimeProvider><Inner /></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  const cell = await screen.findByText("312,5000");
  await userEvent.dblClick(cell);
  const input = screen.getByRole("textbox");
  await userEvent.clear(input);
  await userEvent.type(input, "500{Enter}");
  expect(await screen.findByText("500,0000")).toBeInTheDocument();
  expect(await screen.findByText("505,26")).toBeInTheDocument(); // riparto A01 Pulizie re-split (50526 cents)
  expect(screen.getByText("Competenza")).toBeInTheDocument();    // new column
});

test("adds and removes a distribution table via the pane toolbar", async () => {
  render(<AppRuntimeProvider><Inner /></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(await screen.findByLabelText("Aggiungi tabella"));
  await userEvent.type(screen.getByLabelText("Nome tabella"), "Acqua");
  await userEvent.click(screen.getByText("Salva"));
  expect(await screen.findByText("Acqua")).toBeInTheDocument();
});
```

- [ ] **Step 4: Run, fix, commit**

Run: `pnpm --filter @cl/web exec vitest run src/sections/tabelle` → PASS; suite + typecheck green.

```bash
git add apps/web/src/sections/tabelle
git commit -m "$(cat <<'EOF'
feat(web): tabelle — store-backed coefficient grid with live riparto recompute + table CRUD toolbar

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Tabelle — riparto rounding row ("Arrotondamento")

The legacy riparto shows the largest-remainder leftover as an explicit row (Pozzetto screenshots `12`/`13`): per column, `total − Σ floor(total · wᵢ / W)` — the cents that had to be assigned by remainder ranking.

**Files:**
- Modify: `apps/web/src/recompute/distribution.ts`
- Test: `apps/web/src/recompute/distribution.test.ts` (extend)
- Modify: `apps/web/src/sections/tabelle/TabelleSection.tsx`
- Test: `apps/web/src/sections/tabelle/TabelleSection.test.tsx` (extend)

- [ ] **Step 1: Write the failing recompute test** (append to `distribution.test.ts`):

```ts
import { roundingByColumn } from "./distribution";
import { distributionByPeriod, distributionTablesByPeriod } from "../mock/fixtures";

test("roundingByColumn yields the leftover cents the remainder pass assigned", () => {
  const dist = distributionByPeriod["sat-2011"]!.estimate;
  const tables = distributionTablesByPeriod["sat-2011"]!;
  // 312.5/687.5 over 120000 splits exactly → 0; same for e-asc 400/600 over 80000.
  expect(roundingByColumn(dist, tables)).toEqual({ "e-pul": 0, "e-asc": 0 });
  // 500/687.5 over 120000: floors are 50526 + 69473 = 119999 → 1 cent assigned by remainder
  const edited = tables.map((t) => t.id !== "t-prop" ? t : ({
    ...t, items: t.items.map((i) => (i.unitId === "u-a01" ? { ...i, coefficient: 500 } : i)),
  }));
  expect(roundingByColumn(dist, edited)).toEqual({ "e-pul": 1, "e-asc": 0 });
});
```

- [ ] **Step 2: Run to fail, then implement** (append to `distribution.ts`):

```ts
import type { DistributionTable } from "@cl/application";

/** Cents per expense column that the largest-remainder pass had to assign:
 * total − Σ floor(total·wᵢ/W) over the group's units, using the column's owning table. */
export function roundingByColumn(dist: Dist, tables: DistributionTable[]): Record<Id, number> {
  const group = dist.rows[0];
  const units = group?.children ?? [];
  const out: Record<Id, number> = {};
  for (const col of dist.columns) {
    const table = tables.find((t) => t.id === col.tableId);
    if (!table || !group) { out[col.accountId] = 0; continue; }
    const w = new Map(table.items.map((i) => [i.unitId, i.coefficient]));
    const W = units.reduce((a, u) => a + (w.get(u.unitId ?? "") ?? 0), 0);
    const total = group.amounts[col.accountId]?.cents ?? 0;
    if (W === 0) { out[col.accountId] = 0; continue; }
    const floors = units.reduce((a, u) => a + Math.floor((total * (w.get(u.unitId ?? "") ?? 0)) / W), 0);
    out[col.accountId] = total - floors;
  }
  return out;
}
```

Run: `pnpm --filter @cl/web exec vitest run src/recompute/distribution.test.ts` → PASS.

- [ ] **Step 3: Render it.** In `TabelleSection.tsx`, append a synthetic row to the riparto rows:

```tsx
import { fromCents } from "@cl/domain";
import { roundingByColumn } from "../../recompute/distribution";
// in the component:
  const rounding = roundingByColumn(dist, tables);
  const roundingRow: DistributionRow = {
    id: "row-arrotondamento", kind: "unit", label: "Arrotondamento",
    amounts: Object.fromEntries(Object.entries(rounding).map(([k, v]) => [k, fromCents(v)])),
    total: fromCents(Object.values(rounding).reduce((a, b) => a + b, 0)),
  };
  // bottom TreeTable: rows={[...dist.rows, roundingRow]}
```

- [ ] **Step 4: Extend the section test:**

```tsx
test("riparto shows the arrotondamento row, updated by coefficient edits", async () => {
  render(<AppRuntimeProvider><Inner /></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  expect(await screen.findByText("Arrotondamento")).toBeInTheDocument();
  const cell = await screen.findByText("312,5000");
  await userEvent.dblClick(cell);
  const input = screen.getByRole("textbox");
  await userEvent.clear(input);
  await userEvent.type(input, "500{Enter}");
  expect(await screen.findByText("0,01")).toBeInTheDocument(); // 1 cent of rounding on Pulizie
});
```

- [ ] **Step 5: Run, fix, commit**

```bash
git add apps/web/src/recompute/distribution.ts apps/web/src/recompute/distribution.test.ts apps/web/src/sections/tabelle
git commit -m "$(cat <<'EOF'
feat(web): riparto arrotondamento row derived from largest-remainder leftovers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
### Task 15: Dati — period summaries (six money columns)

**Files:**
- Create: `apps/web/src/recompute/summary.ts`
- Test: `apps/web/src/recompute/summary.test.ts` (create)
- Modify: `apps/web/src/mock/MockStore.ts` (real `periodSummaries()` derivation)
- Test: `apps/web/src/mock/MockStore.test.ts` (extend)
- Modify: `apps/web/src/sections/dati/DatiCondominioSection.tsx`
- Test: `apps/web/src/sections/dati/DatiCondominioSection.test.tsx` (extend)

- [ ] **Step 1: Write the failing recompute test** at `summary.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { periodSummary } from "./summary";
import { ledgerAccountsByPeriod, unitsByPeriod } from "../mock/fixtures";

describe("periodSummary", () => {
  it("derives the six Dati aggregates for sat-2011", () => {
    const s = periodSummary(ledgerAccountsByPeriod["sat-2011"]!, unitsByPeriod["sat-2011"]!);
    expect(s.liquidita.cents).toBe(51841);      // saldo of the "Liquidità" group
    expect(s.fondi.cents).toBe(-50000);          // saldo of "Fondi"
    expect(s.preventivo.cents).toBe(3800000);    // units root group
    expect(s.consuntivo.cents).toBe(3439865);
    expect(s.saldoPrec.cents).toBe(-625099);
    expect(s.totDovuto.cents).toBe(2814766);
  });
  it("falls back to cassa-like accounts when no Liquidità group exists (poz)", () => {
    const s = periodSummary(ledgerAccountsByPeriod["poz-2010"]!, unitsByPeriod["poz-2010"]!);
    expect(s.liquidita.cents).toBe(10000);       // "Cassa Contanti" leaf
    expect(s.fondi.cents).toBe(0);
  });
  it("returns zeros for empty inputs", () => {
    const s = periodSummary([], []);
    expect(s.preventivo.cents).toBe(0);
    expect(s.liquidita.cents).toBe(0);
  });
});
```

- [ ] **Step 2: Run to fail, implement `summary.ts`:**

```ts
import { fromCents } from "@cl/domain";
import type { LedgerAccountRow, PeriodSummary, UnitRow } from "@cl/application";

const zero = fromCents(0);

function findByLabel(rows: LedgerAccountRow[], re: RegExp): LedgerAccountRow | null {
  for (const r of rows) {
    if (re.test(r.label)) return r;
    if (r.children) { const hit = findByLabel(r.children, re); if (hit) return hit; }
  }
  return null;
}

/** Naive Dati-grid aggregates (replaced by @cl/domain later): money positions from the
 * account tree by label convention, dovuto/preventivo figures from the units root group. */
export function periodSummary(accounts: LedgerAccountRow[], units: UnitRow[]): PeriodSummary {
  const liquid = findByLabel(accounts, /liquidità|cassa/i);
  const fondi = findByLabel(accounts, /fond/i);
  const root = units[0] ?? null;
  return {
    liquidita: liquid?.saldo ?? zero,
    fondi: fondi?.saldo ?? zero,
    preventivo: root?.preventivo ?? zero,
    consuntivo: root?.consuntivo ?? zero,
    saldoPrec: root?.saldoPrec ?? zero,
    totDovuto: root?.totDovuto ?? zero,
  };
}
```

Run: `pnpm --filter @cl/web exec vitest run src/recompute/summary.test.ts` → PASS.

- [ ] **Step 3: Real `periodSummaries()` in `MockStore.ts`** — replace the Task 2 stub:

```ts
import { combineLatest } from "rxjs"; // extend the rxjs import
import { periodSummary } from "../recompute/summary";

  periodSummaries(): Observable<Record<Id, PeriodSummary>> {
    return combineLatest([this.accounts$, this.units$]).pipe(map(([accounts, units]) => {
      const ids = new Set([...Object.keys(accounts), ...Object.keys(units)]);
      return Object.fromEntries(
        [...ids].map((id) => [id, periodSummary(accounts[id] ?? [], units[id] ?? [])]),
      );
    }));
  }
```

Store test (append to `MockStore.test.ts`):

```ts
  it("periodSummaries re-derives when a transaction lands", () => {
    const s = new MockStore();
    expect(latest(s.periodSummaries())["sat-2011"]!.liquidita.cents).toBe(51841);
    s.addTransaction("sat-2011", {
      date: "2011-09-01", description: "Versamento in cassa",
      entries: [
        { accountId: "cassa", label: "Cassa", dareCents: 1000, avereCents: 0 },
        { accountId: "crate", label: "Condòmini c/rate", dareCents: 0, avereCents: 1000 },
      ],
    });
    expect(latest(s.periodSummaries())["sat-2011"]!.liquidita.cents).toBe(52841);
  });
```

- [ ] **Step 4: Columns in `DatiCondominioSection.tsx`.** Extend `DatiRow` with `summary?: PeriodSummary`, fill it in `toRows` (which now takes the summaries map), and append six columns:

```tsx
import type { PeriodSummary } from "@cl/application";
import { MoneyText } from "../../format";
// DatiRow gains: summary?: PeriodSummary;
// toRows(tree, summaries: Record<string, PeriodSummary>) sets on period rows: summary: summaries[p.id]
// in the component:
  const summaries = rt.usePeriodSummaries();
  const rows = toRows(tree, summaries);
// appended columns:
const money = (pick: (s: PeriodSummary) => import("@cl/domain").Money) =>
  (r: DatiRow) => (r.summary ? <MoneyText value={pick(r.summary)} /> : "");
// after "competenza":
  { id: "liq", header: "Liquidità", align: "right", cell: money((s) => s.liquidita) },
  { id: "fondi", header: "Fondi", align: "right", cell: money((s) => s.fondi) },
  { id: "prev", header: "Preventivo", align: "right", cell: money((s) => s.preventivo) },
  { id: "cons", header: "Consuntivo", align: "right", cell: money((s) => s.consuntivo) },
  { id: "sprec", header: "Saldo prec.", align: "right", cell: money((s) => s.saldoPrec) },
  { id: "dovuto", header: "Tot. dovuto", align: "right", cell: money((s) => s.totDovuto) },
```

Section test (append):

```tsx
test("period rows show the six money aggregates", async () => {
  render(<Harness />);
  expect(await screen.findByText("Liquidità")).toBeInTheDocument();
  expect(screen.getByText("518,41")).toBeInTheDocument();    // sat-2011 liquidità
  expect(screen.getByText("38.000,00")).toBeInTheDocument(); // sat-2011 preventivo
});
```

- [ ] **Step 5: Run, fix, commit**

Run: `pnpm --filter @cl/web exec vitest run src/recompute/summary.test.ts src/mock/MockStore.test.ts src/sections/dati` → PASS; suite + typecheck green.

```bash
git add apps/web/src/recompute/summary.ts apps/web/src/recompute/summary.test.ts apps/web/src/mock/MockStore.ts apps/web/src/mock/MockStore.test.ts apps/web/src/sections/dati
git commit -m "$(cat <<'EOF'
feat(web): dati — six money columns from live periodSummaries derivation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Dati — Fornitori toolbar, condominium/period dialogs, F24 + Documenti tabs

**Files:**
- Create: `apps/web/src/sections/dati/DatiDialogs.tsx` (CondominiumDialog, PeriodDialog, SupplierDialog, F24Dialog)
- Modify: `apps/web/src/sections/dati/DatiCondominioSection.tsx`
- Test: `apps/web/src/sections/dati/DatiCondominioSection.test.tsx` (extend)

- [ ] **Step 1: Create `DatiDialogs.tsx`:**

```tsx
import { useEffect, useState } from "react";
import { fromCents } from "@cl/domain";
import type { CondominiumNode } from "@cl/application";
import { WizardDialog } from "../../components/common/WizardDialog";
import { TextField, DateField, SelectField, MoneyField } from "../../components/forms/fields";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { supplierCandidates } from "../../mock/fixtures";

export function CondominiumDialog({ open, onOpenChange, editing }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: CondominiumNode | null;
}) {
  const rt = useAppRuntime();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<CondominiumNode["type"]>("regular");
  useEffect(() => {
    if (open) { setCode(editing?.code ?? ""); setName(editing?.name ?? ""); setType(editing?.type ?? "regular"); }
  }, [open, editing]);
  const submit = () => {
    if (editing) rt.commands.editCondominium(editing.id, { code, name, type });
    else rt.commands.addCondominium({ id: `c-${code.toLowerCase()}`, code, name, type, periods: [] });
  };
  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} onSubmit={submit} submitLabel="Salva"
      title={editing ? "Modifica Condominio" : "Aggiungi Condominio"}
      steps={[{
        title: "Anagrafica",
        validate: () => (!code.trim() ? "Inserisci il codice" : !name.trim() ? "Inserisci l'intestazione" : null),
        content: (
          <div>
            <TextField label="Codice" value={code} onChange={setCode} />
            <TextField label="Intestazione (con indirizzo)" value={name} onChange={setName} />
            <SelectField label="Tipo" value={type} onChange={(v) => setType(v as CondominiumNode["type"])}
              options={[{ value: "regular", label: "Condominio" }, { value: "super", label: "Supercondominio" }, { value: "residence", label: "Residence" }]} />
          </div>
        ),
      }]}
    />
  );
}

export function PeriodDialog({ open, onOpenChange, condominiumId }: {
  open: boolean; onOpenChange: (o: boolean) => void; condominiumId: string | null;
}) {
  const rt = useAppRuntime();
  const [year, setYear] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  useEffect(() => { if (open) { setYear(""); setStart(""); setEnd(""); } }, [open]);
  const submit = () => {
    if (!condominiumId) return;
    rt.commands.addPeriod(condominiumId, {
      id: `${condominiumId}-${year}`, name: `${year} (Ordinario)`, type: "ordinary",
      closed: false, start, end,
    });
  };
  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} onSubmit={submit} submitLabel="Salva" title="Aggiungi Gestione"
      steps={[{
        title: "Gestione",
        validate: () => (!/^\d{4}$/.test(year) ? "Anno non valido" : !start || !end ? "Inserisci il periodo" : null),
        content: (
          <div>
            <TextField label="Anno" value={year} onChange={setYear} type="number" />
            <DateField label="Inizio" value={start} onChange={setStart} />
            <DateField label="Fine" value={end} onChange={setEnd} />
          </div>
        ),
      }]}
    />
  );
}

export function SupplierDialog({ open, onOpenChange, periodId }: {
  open: boolean; onOpenChange: (o: boolean) => void; periodId: string | null;
}) {
  const rt = useAppRuntime();
  const [candidateId, setCandidateId] = useState("");
  useEffect(() => { if (open) setCandidateId(""); }, [open]);
  const submit = () => {
    const cand = supplierCandidates.find((c) => c.id === candidateId);
    if (!periodId || !cand) return;
    rt.commands.addSupplier(periodId, { ...cand, id: `s-${cand.id}` });
  };
  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} onSubmit={submit} submitLabel="Salva" title="Aggiungi Fornitore"
      steps={[{
        title: "Fornitore",
        validate: () => (!candidateId ? "Seleziona il fornitore" : null),
        content: (
          <SelectField label="Anagrafica" value={candidateId} onChange={setCandidateId}
            options={[{ value: "", label: "—" }, ...supplierCandidates.map((c) => ({ value: c.id, label: `${c.nominativo} (${c.categoria})` }))]} />
        ),
      }]}
    />
  );
}

export function F24Dialog({ open, onOpenChange, periodId }: {
  open: boolean; onOpenChange: (o: boolean) => void; periodId: string | null;
}) {
  const rt = useAppRuntime();
  const [descrizione, setDescrizione] = useState("");
  const [scadenza, setScadenza] = useState("");
  const [importoCents, setImportoCents] = useState(0);
  useEffect(() => { if (open) { setDescrizione(""); setScadenza(""); setImportoCents(0); } }, [open]);
  const submit = () => {
    if (!periodId) return;
    rt.commands.addF24(periodId, {
      id: `f24-${descrizione.toLowerCase().replace(/\W+/g, "-")}`,
      descrizione, scadenza, importo: fromCents(importoCents), stato: "da pagare",
    });
  };
  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} onSubmit={submit} submitLabel="Salva" title="Aggiungi F24"
      steps={[{
        title: "F24",
        validate: () => (!descrizione.trim() ? "Inserisci la descrizione" : !scadenza ? "Inserisci la scadenza" : importoCents <= 0 ? "Importo non valido" : null),
        content: (
          <div>
            <TextField label="Descrizione" value={descrizione} onChange={setDescrizione} />
            <DateField label="Scadenza" value={scadenza} onChange={setScadenza} />
            <MoneyField label="Importo" cents={importoCents} onChange={setImportoCents} />
          </div>
        ),
      }]}
    />
  );
}
```

- [ ] **Step 2: Rework `DatiCondominioSection.tsx`.**

(a) Promote selection: `const selId = rt.useSelectedRow("dati");` + `selectedId={selId} onSelect={(r) => rt.selectRow("dati", r.id)}` on the TreeTable. Derive `const selCond = tree.find((c) => c.id === selId) ?? null;`.

(b) Toolbar (replaces `STANDARD_ACTIONS`; needs `useToast` — wrap the section tests in `<ToastProvider>`):

```tsx
  const [dialog, setDialog] = useState<"addCond" | "editCond" | "addPeriod" | "addSupplier" | "addF24" | null>(null);
  const actions = [
    { icon: "add", label: "Aggiungi", primary: true, onClick: () => setDialog("addCond") },
    { icon: "edit", label: "Modifica", disabled: !selCond, onClick: () => setDialog("editCond") },
    { icon: "add", label: "Aggiungi gestione", disabled: !selCond, onClick: () => setDialog("addPeriod") },
    { sep: true, icon: "", label: "" },
    { icon: "print", label: "Stampa", onClick: stub }, { icon: "pdf", label: "PDF", onClick: stub },
    { icon: "excel", label: "Excel", onClick: stub },
  ];
```

(c) Fornitori tab gets its own mini-toolbar + selectable list (local `selSupplierId` state is fine — it's tab-internal):

```tsx
    { id: "fornitori", label: "Fornitori del Condominio", content: (
      <div>
        <div>
          <button aria-label="Aggiungi fornitore" onClick={() => setDialog("addSupplier")}>Aggiungi</button>
          <button aria-label="Rimuovi fornitore" disabled={!selSupplierId}
            onClick={() => { if (periodId && selSupplierId) { rt.commands.removeSupplier(periodId, selSupplierId); setSelSupplierId(null); } }}>Rimuovi</button>
        </div>
        <ul>
          {detail.suppliers.map((s) => (
            <li key={s.id} onClick={() => setSelSupplierId(s.id)}
                style={{ fontWeight: selSupplierId === s.id ? 600 : 400, cursor: "pointer" }}>
              {s.nominativo} — {s.categoria}
            </li>
          ))}
        </ul>
      </div>
    ) },
```

(d) Two new tabs after Fornitori:

```tsx
    { id: "f24", label: "F24", content: (
      <div>
        <button aria-label="Aggiungi F24" onClick={() => setDialog("addF24")}>Aggiungi</button>
        <table>
          <thead><tr><th>Descrizione</th><th>Scadenza</th><th>Importo</th><th>Stato</th></tr></thead>
          <tbody>
            {f24s.map((f) => (
              <tr key={f.id}>
                <td>{f.descrizione}</td><td><DateText iso={f.scadenza} /></td>
                <td><MoneyText value={f.importo} /></td>
                <td>
                  <button onClick={() => periodId && rt.commands.editF24(periodId, f.id, { stato: f.stato === "pagato" ? "da pagare" : "pagato" })}>
                    {f.stato}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) },
    { id: "documenti", label: "Documenti", content: (
      <div>
        <h4>Pubblici</h4><ul>{detail.publicDocs.map((d) => <li key={d}>{d}</li>)}</ul>
        <h4>Privati</h4><ul>{detail.privateDocs.map((d) => <li key={d}>{d}</li>)}</ul>
      </div>
    ) },
```
(`const f24s = rt.useF24s();` and `const periodId = rt.useSelection().accountingPeriodId ?? null;` in the component.)

(e) Mount all four dialogs before `</SectionPanel>` with the obvious `open`/`onOpenChange` wiring (`editing={dialog === "editCond" ? selCond : null}` for CondominiumDialog, `condominiumId={selCond?.id ?? null}`, `periodId={periodId}`).

- [ ] **Step 3: Extend `DatiCondominioSection.test.tsx`** (harness now includes `<ToastProvider>`):

```tsx
test("adds a condominium and a supplier; toggles an F24", async () => {
  render(<Harness />);
  await userEvent.click(screen.getByText("sel"));
  // add condominium
  await userEvent.click(screen.getByLabelText("Aggiungi"));
  await userEvent.type(screen.getByLabelText("Codice"), "NEW");
  await userEvent.type(screen.getByLabelText("Intestazione (con indirizzo)"), "Nuovo Condominio");
  await userEvent.click(screen.getByText("Salva"));
  expect(await screen.findByText(/NEW — Nuovo Condominio/)).toBeInTheDocument();
  // add supplier from candidates
  await userEvent.click(screen.getByText("Fornitori del Condominio"));
  await userEvent.click(screen.getByLabelText("Aggiungi fornitore"));
  await userEvent.selectOptions(screen.getByLabelText("Anagrafica"), "cand-1");
  await userEvent.click(screen.getByText("Salva"));
  expect(await screen.findByText(/Idraulica Blu/)).toBeInTheDocument();
  // F24 tab
  await userEvent.click(screen.getByText("F24"));
  expect(await screen.findByText("Ritenute d'acconto 1° trim.")).toBeInTheDocument();
  await userEvent.click(screen.getByText("da pagare"));
  expect(await screen.findByText("pagato")).toBeInTheDocument();
});

test("documenti tab lists public and private file names", async () => {
  render(<Harness />);
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(screen.getByText("Documenti"));
  expect(await screen.findByText("Regolamento condominiale.pdf")).toBeInTheDocument();
  expect(screen.getByText("Contratto pulizie Acme.pdf")).toBeInTheDocument();
});
```
Note: the F24 toggle assertion needs care — fixture `f24-2` is already "pagato", so assert via `getAllByText` counts or scope queries with `within(...)`. The implementer should use `within` from RTL on the F24 table rows.

- [ ] **Step 4: Run, fix, commit**

Run: `pnpm --filter @cl/web exec vitest run src/sections/dati` → PASS; suite + typecheck green.

```bash
git add apps/web/src/sections/dati
git commit -m "$(cat <<'EOF'
feat(web): dati — condominium/period/supplier/F24 dialogs, F24 + documenti tabs, wired toolbar

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
### Task 17: Unità — "Raggruppa righe per" selector

**Files:**
- Create: `apps/web/src/mock/regroup.ts`
- Test: `apps/web/src/mock/regroup.test.ts` (create)
- Modify: `apps/web/src/sections/unita/UnitaSection.tsx`
- Test: `apps/web/src/sections/unita/UnitaSection.test.tsx` (extend)

- [ ] **Step 1: Write the failing regroup test:**

```ts
import { describe, it, expect } from "vitest";
import { regroupUnits } from "./regroup";
import { unitsByPeriod } from "../mock/fixtures";

const rows = unitsByPeriod["sat-2011"]!;

describe("regroupUnits", () => {
  it("'gruppo' returns the tree unchanged (same reference)", () => {
    expect(regroupUnits(rows, "gruppo")).toBe(rows);
  });
  it("'unita' lifts units to the top level, residents kept as children", () => {
    const out = regroupUnits(rows, "unita");
    expect(out.map((r) => r.id)).toEqual(["u-a01", "u-a02"]);
    expect(out[0]!.children!.map((r) => r.id)).toEqual(["r-a01-1"]);
  });
  it("'condomino' lifts residents to the top level with their unit as child", () => {
    const out = regroupUnits(rows, "condomino");
    expect(out.map((r) => r.id)).toEqual(["r-a01-1", "r-a02-1", "r-a02-2"]);
    expect(out[0]!.children!.map((r) => r.label)).toEqual(["A01 - Alberi Dina (PR)"]);
  });
});
```

- [ ] **Step 2: Run to fail, implement `regroup.ts`:**

```ts
import type { UnitRow } from "@cl/application";
import { flattenRows } from "./treeRows";

export type RegroupMode = "gruppo" | "unita" | "condomino";

/** Reshape the group→unit→resident tree for the legacy "Raggruppa righe per" selector. */
export function regroupUnits(rows: UnitRow[], mode: RegroupMode): UnitRow[] {
  if (mode === "gruppo") return rows;
  const units = flattenRows(rows).filter((r) => r.kind === "unit");
  if (mode === "unita") return units;
  // per condòmino: each resident at top, its unit attached as a context child (without grandchildren)
  return units.flatMap((u) =>
    (u.children ?? []).filter((r) => r.kind === "resident")
      .map((r) => ({ ...r, children: [{ ...u, children: undefined }] })),
  );
}
```

Run: `pnpm --filter @cl/web exec vitest run src/mock/regroup.test.ts` → PASS.

- [ ] **Step 3: Wire into `UnitaSection.tsx`.** Promote selection and add the selector:

```tsx
import { regroupUnits, type RegroupMode } from "../../mock/regroup";
// in the component (replace the local selId useState):
  const selId = rt.useSelectedRow("unita");
  const [mode, setMode] = useState<RegroupMode>("gruppo");
  const allRows = rt.useUnitsTree();
  const rows = regroupUnits(allRows, mode);
  const sel = selId ? findById(allRows, selId) : null; // detail keeps working across regroupings
// SectionPanel gains:
    toolbarRight={
      <label>Raggruppa righe per{" "}
        <select value={mode} onChange={(e) => setMode(e.target.value as RegroupMode)}>
          <option value="gruppo">Per gruppo</option>
          <option value="unita">Per unità</option>
          <option value="condomino">Per condòmino</option>
        </select>
      </label>
    }
// TreeTable: selectedId={selId} onSelect={(r) => rt.selectRow("unita", r.id)}
// getRowKind for "condomino"/"unita" modes: top-level rows are not groups —
//   getRowKind={(r) => (mode === "gruppo" && r.kind === "group" ? "group" : "row")}
```

- [ ] **Step 4: Extend `UnitaSection.test.tsx`:**

```tsx
test("regroup selector reshapes the tree", async () => {
  render(<AppRuntimeProvider><Inner /></AppRuntimeProvider>);
  await userEvent.click(screen.getByText("sel"));
  await screen.findByText("A01 - Alberi Dina (PR)");
  await userEvent.selectOptions(screen.getByLabelText(/Raggruppa righe per/), "condomino");
  expect(screen.queryByText("Saturno / 2011 (via A. Marangoni, 4, Udine)")).not.toBeInTheDocument(); // group row gone
  expect(screen.getAllByText(/Mauri Dina \(PR 100%\)/).length).toBeGreaterThan(0);   // resident at top
  await userEvent.selectOptions(screen.getByLabelText(/Raggruppa righe per/), "gruppo");
  expect(await screen.findByText("Saturno / 2011 (via A. Marangoni, 4, Udine)")).toBeInTheDocument();
});
```

- [ ] **Step 5: Run, fix, commit**

```bash
git add apps/web/src/mock/regroup.ts apps/web/src/mock/regroup.test.ts apps/web/src/sections/unita
git commit -m "$(cat <<'EOF'
feat(web): unità — raggruppa-righe-per selector (gruppo/unità/condòmino) + promoted selection

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: Unità — unit/gruppo/condòmino dialogs + Subentro wizard

**Files:**
- Create: `apps/web/src/sections/unita/UnitaDialogs.tsx`
- Create: `apps/web/src/sections/unita/SubentroWizard.tsx`
- Modify: `apps/web/src/sections/unita/UnitaSection.tsx`
- Test: `apps/web/src/sections/unita/UnitaSection.test.tsx` (extend)

- [ ] **Step 1: Create `UnitaDialogs.tsx`** (UnitDialog covers add+edit; GroupDialog and ResidentDialog are add-only):

```tsx
import { useEffect, useState } from "react";
import { fromCents } from "@cl/domain";
import type { UnitRow } from "@cl/application";
import { WizardDialog } from "../../components/common/WizardDialog";
import { TextField, SelectField } from "../../components/forms/fields";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { flattenRows } from "../../mock/treeRows";

const zero = () => fromCents(0);
const zeroMoney = () => ({ saldoPrec: zero(), preventivo: zero(), consuntivo: zero(), totDovuto: zero(), versato: zero() });

export function UnitDialog({ open, onOpenChange, editing }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: UnitRow | null;
}) {
  const rt = useAppRuntime();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const groups = flattenRows(rt.useUnitsTree()).filter((r) => r.kind === "group")
    .map((r) => ({ value: r.id, label: r.label }));
  const [label, setLabel] = useState("");
  const [unitType, setUnitType] = useState("Appartamento");
  const [floor, setFloor] = useState("");
  const [inner, setInner] = useState("");
  const [sub, setSub] = useState("");
  const [parentId, setParentId] = useState("");
  useEffect(() => {
    if (!open) return;
    setLabel(editing?.label ?? ""); setUnitType(editing?.unitType ?? "Appartamento");
    setFloor(editing?.floor ?? ""); setInner(editing?.inner ?? ""); setSub(editing?.sub ?? "");
    setParentId(groups[0]?.value ?? "");
  }, [open, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    if (!periodId) return;
    const fields = { label, unitType, floor, inner, sub };
    if (editing) rt.commands.editUnitRow(periodId, editing.id, fields);
    else rt.commands.addUnitRow(periodId, parentId || null, {
      id: `u-${label.toLowerCase().replace(/\W+/g, "-")}`, kind: "unit", ...fields, ...zeroMoney(),
    });
  };

  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} onSubmit={submit} submitLabel="Salva"
      title={editing ? "Modifica Unità" : "Aggiungi Unità"}
      steps={[{
        title: "Unità",
        validate: () => (!label.trim() ? "Inserisci il nome dell'unità" : !editing && !parentId ? "Seleziona il gruppo" : null),
        content: (
          <div>
            <TextField label="Nome unità" value={label} onChange={setLabel} />
            <SelectField label="Tipo" value={unitType} onChange={setUnitType}
              options={["Appartamento", "Box", "Cantina", "Negozio"].map((t) => ({ value: t, label: t }))} />
            <TextField label="Piano" value={floor} onChange={setFloor} />
            <TextField label="Interno" value={inner} onChange={setInner} />
            <TextField label="Subalterno" value={sub} onChange={setSub} />
            {!editing && <SelectField label="Gruppo" value={parentId} onChange={setParentId} options={groups} />}
          </div>
        ),
      }]}
    />
  );
}

export function GroupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const rt = useAppRuntime();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const [label, setLabel] = useState("");
  useEffect(() => { if (open) setLabel(""); }, [open]);
  const submit = () => {
    if (!periodId) return;
    rt.commands.addUnitRow(periodId, null, {
      id: `g-${label.toLowerCase().replace(/\W+/g, "-")}`, kind: "group", label, ...zeroMoney(), children: [],
    });
  };
  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} onSubmit={submit} submitLabel="Salva" title="Aggiungi Gruppo"
      steps={[{
        title: "Gruppo",
        validate: () => (!label.trim() ? "Inserisci il nome del gruppo" : null),
        content: <TextField label="Nome gruppo" value={label} onChange={setLabel} />,
      }]}
    />
  );
}

export function ResidentDialog({ open, onOpenChange, unitId }: {
  open: boolean; onOpenChange: (o: boolean) => void; unitId: string | null;
}) {
  const rt = useAppRuntime();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const [name, setName] = useState("");
  const [role, setRole] = useState("PR");
  const [percent, setPercent] = useState("100");
  useEffect(() => { if (open) { setName(""); setRole("PR"); setPercent("100"); } }, [open]);
  const submit = () => {
    if (!periodId || !unitId) return;
    rt.commands.addUnitRow(periodId, unitId, {
      id: `r-${name.toLowerCase().replace(/\W+/g, "-")}`, kind: "resident",
      label: `${name} (${role} ${percent}%)`, ...zeroMoney(),
    });
  };
  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} onSubmit={submit} submitLabel="Salva" title="Aggiungi Condòmino"
      steps={[{
        title: "Condòmino",
        validate: () =>
          !name.trim() ? "Inserisci il nominativo"
          : Number.isNaN(Number(percent)) || Number(percent) <= 0 || Number(percent) > 100 ? "Percentuale non valida" : null,
        content: (
          <div>
            <TextField label="Nominativo" value={name} onChange={setName} />
            <SelectField label="Ruolo" value={role} onChange={setRole}
              options={[{ value: "PR", label: "Proprietario" }, { value: "IN", label: "Inquilino" }, { value: "US", label: "Usufruttuario" }]} />
            <TextField label="Percentuale" value={percent} onChange={setPercent} type="number" />
          </div>
        ),
      }]}
    />
  );
}
```

- [ ] **Step 2: Create `SubentroWizard.tsx`** — end-date the outgoing resident, add the successor:

```tsx
import { useState } from "react";
import { fromCents } from "@cl/domain";
import type { UnitRow } from "@cl/application";
import { WizardDialog } from "../../components/common/WizardDialog";
import { TextField, DateField, SelectField } from "../../components/forms/fields";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { flattenRows } from "../../mock/treeRows";
import { formatItDate } from "../../recompute/dates";

export function SubentroWizard({ open, onOpenChange, unit }: {
  open: boolean; onOpenChange: (o: boolean) => void; unit: UnitRow | null;
}) {
  const rt = useAppRuntime();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const residents = (unit?.children ?? []).filter((r) => r.kind === "resident");
  const [outgoingId, setOutgoingId] = useState("");
  const [date, setDate] = useState("");
  const [successor, setSuccessor] = useState("");
  const close = (o: boolean) => { if (!o) { setOutgoingId(""); setDate(""); setSuccessor(""); } onOpenChange(o); };

  const submit = () => {
    if (!periodId || !unit) return;
    const outgoing = residents.find((r) => r.id === outgoingId);
    if (!outgoing) return;
    rt.commands.editUnitRow(periodId, outgoingId, {
      restriction: `fino al ${formatItDate(date)}`,
    });
    const zero = fromCents(0);
    rt.commands.addUnitRow(periodId, unit.id, {
      id: `r-${successor.toLowerCase().replace(/\W+/g, "-")}`, kind: "resident",
      label: `${successor} (PR 100%)`, restriction: `dal ${formatItDate(date)}`,
      saldoPrec: zero, preventivo: zero, consuntivo: zero, totDovuto: zero, versato: zero,
    });
  };

  return (
    <WizardDialog open={open} onOpenChange={close} onSubmit={submit} title="Subentro Condòmino"
      steps={[
        {
          title: "Condòmino uscente",
          validate: () => (!outgoingId ? "Seleziona il condòmino uscente" : !date ? "Inserisci la data di subentro" : null),
          content: (
            <div>
              <SelectField label="Condòmino uscente" value={outgoingId} onChange={setOutgoingId}
                options={[{ value: "", label: "—" }, ...residents.map((r) => ({ value: r.id, label: r.label }))]} />
              <DateField label="Data subentro" value={date} onChange={setDate} />
            </div>
          ),
        },
        {
          title: "Subentrante",
          validate: () => (!successor.trim() ? "Inserisci il nominativo del subentrante" : null),
          content: <TextField label="Nominativo subentrante" value={successor} onChange={setSuccessor} />,
        },
        { title: "Conferma", content: <p>Il subentrante {successor} sostituisce il condòmino uscente dalla data indicata.</p> },
      ]}
    />
  );
}
```
(the `flattenRows` import is unused here — drop it; listed to warn the implementer NOT to add it.)

- [ ] **Step 3: Wire the toolbar in `UnitaSection.tsx`** (needs `useToast` for stubs → add `<ToastProvider>` to this section's test harness):

```tsx
  const [dialog, setDialog] = useState<"unit" | "editUnit" | "group" | "resident" | "subentro" | null>(null);
  const selIsUnit = sel?.kind === "unit";
  const actions = [
    { icon: "add", label: "Aggiungi unità", primary: true, onClick: () => setDialog("unit") },
    { icon: "add", label: "Aggiungi gruppo", onClick: () => setDialog("group") },
    { icon: "add", label: "Aggiungi condòmino", disabled: !selIsUnit, onClick: () => setDialog("resident") },
    { icon: "edit", label: "Modifica", disabled: !selIsUnit, onClick: () => setDialog("editUnit") },
    { icon: "edit", label: "Subentro", disabled: !selIsUnit, onClick: () => setDialog("subentro") },
    { icon: "remove", label: "Rimuovi", disabled: !sel,
      onClick: () => { if (periodId && selId) { rt.commands.removeUnitRow(periodId, selId); rt.selectRow("unita", null); } } },
    { sep: true, icon: "", label: "" },
    { icon: "print", label: "Stampa", onClick: stub }, { icon: "pdf", label: "PDF", onClick: stub },
  ];
  // mounted before </SectionPanel>:
      <UnitDialog open={dialog === "unit" || dialog === "editUnit"}
        editing={dialog === "editUnit" && selIsUnit ? sel : null}
        onOpenChange={(o) => !o && setDialog(null)} />
      <GroupDialog open={dialog === "group"} onOpenChange={(o) => !o && setDialog(null)} />
      <ResidentDialog open={dialog === "resident"} unitId={selIsUnit ? sel!.id : null}
        onOpenChange={(o) => !o && setDialog(null)} />
      <SubentroWizard open={dialog === "subentro"} unit={selIsUnit ? sel : null}
        onOpenChange={(o) => !o && setDialog(null)} />
```

- [ ] **Step 4: Extend `UnitaSection.test.tsx`:**

```tsx
test("adds a condòmino to the selected unit", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(await screen.findByText("A01 - Alberi Dina (PR)"));
  await userEvent.click(screen.getByLabelText("Aggiungi condòmino"));
  await userEvent.type(screen.getByLabelText("Nominativo"), "Verdi Anna");
  await userEvent.click(screen.getByText("Salva"));
  expect(await screen.findByText("Verdi Anna (PR 100%)")).toBeInTheDocument();
});

test("subentro end-dates the outgoing resident and adds the successor", async () => {
  setup();
  await userEvent.click(screen.getByText("sel"));
  await userEvent.click(await screen.findByText("A01 - Alberi Dina (PR)"));
  await userEvent.click(screen.getByLabelText("Subentro"));
  await userEvent.selectOptions(screen.getByLabelText("Condòmino uscente"), "r-a01-1");
  await userEvent.type(screen.getByLabelText("Data subentro"), "2011-07-01");
  await userEvent.click(screen.getByText("Avanti"));
  await userEvent.type(screen.getByLabelText("Nominativo subentrante"), "Bianchi Carlo");
  await userEvent.click(screen.getByText("Avanti"));
  await userEvent.click(screen.getByText("Conferma"));
  expect(await screen.findByText("Bianchi Carlo (PR 100%)")).toBeInTheDocument();
  expect(screen.getByText("fino al 01/07/2011")).toBeInTheDocument(); // outgoing restriction
});
```

- [ ] **Step 5: Run, fix, commit**

Run: `pnpm --filter @cl/web exec vitest run src/sections/unita` → PASS; suite + typecheck green.

```bash
git add apps/web/src/sections/unita
git commit -m "$(cat <<'EOF'
feat(web): unità — unit/gruppo/condòmino dialogs and subentro wizard

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 19: Final verification + README

**Files:**
- Modify: `apps/web/README.md`

- [ ] **Step 1: Full gate.**

Run, in order, all must succeed:
```bash
pnpm --filter @cl/web test
pnpm -r typecheck
pnpm --filter @cl/web build
```

- [ ] **Step 2: Update `apps/web/README.md`** — in the section list / features area, replace the Plan 1-era description of section capabilities with one line per completed section (Giornale: in-grid entries, paging, 5 wizards; Conti: mastrino, search/hide-empty, inline preventivo, account + functional dialogs; Rate: inline rata edit with override/lock flags, crea-rate wizard; Tabelle: store-backed coefficients, table CRUD, arrotondamento row; Dati: six aggregates, F24/Documenti tabs, condominium dialogs; Unità: regroup selector, dialogs, subentro). Keep it to ~10 lines, match the file's existing tone.

- [ ] **Step 3: Commit**

```bash
git add apps/web/README.md
git commit -m "$(cat <<'EOF'
docs(web): README — Plan 2 section completions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review notes (already applied)

- **Spec coverage (§4):** 4.1 Dati → Tasks 15–16; 4.2 Unità → 17–18; 4.3 Tabelle → 13–14; 4.4 Conti → 8–10; 4.5 Giornale → 4–7; 4.6 Rate → 11–12. Cross-cutting §3.4 toolbar wiring/stub toasts are folded into each section task. §6's flagship cross-section test (incasso → Versato) is Task 7 Step 5. Plan 1 deferred review items are Tasks 2–3 plus the group-row edit guard (Task 11 renders group cells read-only) and the overwrite warning (Task 12).
- **Out of Plan 2 scope (later plans):** Calendario (Plan 3), Anagrafiche incl. real anagrafiche-backed supplier picker (Plan 4), dump-accurate fixture enrichment pass (Plan 4 per spec §7).
- **Known sequencing constraints:** Task 1 must precede Task 2 (the unknown-account guard needs the enriched chart of accounts); Task 3's redistribution rejection must precede Task 11 (override flag skips rejected edits); Task 7's `unitId` must precede nothing else (self-contained).
- **Type consistency spot-checks:** `rt.commands` is `DataCommands & CrudCommands` — every command used by the UI exists on the port after Task 2. `InlineMoney` commits integer cents; `setCoefficient(periodId, tableId, unitId, n)` matches Plan 1's signature. `formatItDate`/`addMonths` come from `recompute/dates`.
