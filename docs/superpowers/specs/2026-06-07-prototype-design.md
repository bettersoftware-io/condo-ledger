# Prototype Spec — Condomini module (UI/UX baseline)

> **Status:** Design / spec. Derives from [`migration-overview`](./2026-06-07-migration-overview-design.md).
> **Date:** 2026-06-07
> **Purpose:** A frontend-only React prototype, with **mock data**, that recreates the full **Condomini**
> module of the legacy app — modernized styling, *identical* information architecture and data density.
> It is the artifact we iterate UI/UX on before any backend exists.

---

## 1. Purpose & scope

### 1.1 What this prototype is for
- Lock the **visual design system** (modernized, same layout/density) and the **interaction patterns**
  (master-detail, hierarchical tree-tables with inline editing, action toolbars, wizards).
- Prove the **architecture seams** end-to-end with mock data: ports & adapters (§3 of overview), the
  react-rxjs **composition-root** state pattern, CSS-Modules-+-tokens styling, Radix primitives,
  TanStack Table grid adapter.
- Be a faithful enough recreation that it can be shown beside the legacy screenshots and read as
  "the same app, modernized."

### 1.2 In scope
- **Full app shell**: top bar, secondary nav, breadcrumb, two-panel left sidebar.
- **Condomini module — all 6 sections**, each with realistic mock data, the grid, the action toolbar,
  the bottom tabbed detail panel, and inline editing where the legacy had it:
  1. Dati Condominio & Fornitori
  2. Unità, Condòmini & Bilancio Personale
  3. Tabelle Millesimali & Riparto
  4. Conti, Mastrini & Bilancio
  5. Libro Giornale & Prima Nota
  6. Prospetto Rate
- **The selection cascade**: choosing a condominium + accounting period in the sidebar tree hydrates
  all sections (from mock streams).
- **Wizards/dialogs as shells**: the add/edit/registration wizards appear as Radix modals with the
  correct steps/fields laid out, but submit to mock state (no real persistence logic).
- **Legenda** popovers, record counts, money formatting (blue/red, tabular), status icons.

### 1.3 Out of scope (this prototype)
- Real backend, real persistence, real auth (a fake login screen or a "logged-in" stub is fine).
- **Calendario** and **Anagrafiche** modules — present in the nav, but rendered as labeled stubs.
- Real PDF/report generation — toolbar buttons present, click → "not in prototype" stub.
- The actual accounting math — mock data carries pre-computed numbers (the *real* engine arrives with
  `packages/domain`; the prototype only needs to *display* believable numbers and demonstrate inline
  edit UX). Where inline edit changes a coefficient/amount, the prototype may do a naive local
  recompute purely for feedback, clearly isolated behind a port so the real engine drops in later.

### 1.4 Success criteria
- Side-by-side with `old/screenshots/presentazione Vittorio/`, each of the 6 sections is recognizably
  the same screen, modernized.
- Swapping the styling token file visibly re-themes the app (proves token indirection).
- The runtime can be mounted in isolation with mock streams (proves the composition-root pattern).

---

## 2. Visual design system (modernized, same density)

**Direction:** keep the legacy *layout, columns, and density* exactly; replace the gray beveled Flex
"halo" chrome with flat, modern surfaces — refined neutrals, one accent color, a clean sans font,
tabular numerals for money, semantic status colors. **Everything is driven by design tokens** (CSS
custom properties) so the look is themeable and the styling engine is swappable.

### 2.1 Token categories (in `apps/web/src/styles/tokens.css` as `:root` custom properties)
- **Color**: surface (app bg, panel, panel-header, row, row-alt, row-hover, row-selected), border
  (subtle/strong), text (primary/secondary/muted), accent (+hover/active), and semantic
  (positive/credit, negative/debit, warning, info, status-active/closed).
- **Typography**: font family (modern sans), sizes (xs–xl), weights, line-heights; a dedicated
  **monospace/tabular-numeric** treatment for money/coefficient columns.
- **Spacing**: a small scale (2/4/6/8/12/16/24) — the app is dense; default paddings are tight.
- **Sizing**: row height (compact), toolbar height, sidebar width, header heights.
- **Elevation/radius**: subtle shadows for popovers/modals, small radii.

### 2.2 Mapping legacy → modern
| Legacy (Flex halo) | Prototype (modern) |
|---|---|
| Dark glossy header w/ JUST IN TIME logo | Flat dark header, modern CondoLedger wordmark, same right-side cluster (account/profile/studio/lang/logout). |
| Beveled gray panels, gradient title bars | Flat panels, thin borders, quiet panel headers. |
| Colored 3D icon toolbar buttons | Flat icon buttons (lucide-style), same actions/order, accent on primary (Add). |
| Halo tree/grid w/ heavy gridlines | Clean tree-table, light row separators, zebra striping, bold group/subtotal rows. |
| Money in blue, negatives in red | Same semantics via tokens; tabular numerals, right-aligned. |
| Green check / status glyphs | Semantic status chips/icons via tokens. |
| "Legenda" link + record count top-right | Preserved: Legenda popover + count. |

### 2.3 Reference screenshots (ground truth for each screen)
`old/screenshots/presentazione Vittorio/`: `02`,`03` (dati condominio/fornitori) · `04`–`09` (unità) ·
`10`–`16`,`47`,`48` (tabelle/riparto) · `17`–`25` (conti) · `26`–`33` (libro giornale) ·
`34`,`35` (rate) · `01` (calendario) · `50` (anagrafiche). `old/screenshots/beta/` for extra detail.

---

## 3. Layout & component architecture

### 3.1 Shell anatomy (top → bottom)
```
┌ TopBar ───────────────────────────────────────────────────────────────┐
│ [CondoLedger]  AMMINISTRAZIONE CONDOMINI      Account·Profilo·Studio·🏳·Esci │
├ MainNav ──────────────────────────────────────────────────────────────┤
│  Calendario   ▸Condomini◂   Anagrafiche                                 │
├ Breadcrumb ───────────────────────────────────────────────────────────┤
│  🏠 › Condomini › Pozzetto › 2010 (Ordinario) › Dati Condominio e Fornitori │
├ Body (horizontal split) ──────────────────────────────────────────────┤
│ ┌ Sidebar ────────┐ ┌ SectionPanel ─────────────────────────────────┐ │
│ │ Scegli Gestione │ │  Title · count · Legenda                       │ │
│ │  (tree+toolbar) │ │  Toolbar: + ✎ ✕ | 🖨 pdf xls | ⟳               │ │
│ │ ─────────────── │ │  ┌ TreeTable (grid) ───────────────────────┐  │ │
│ │ Menu Gestione   │ │  │ group / row / subtotal, inline edit      │  │ │
│ │  (6 sections)   │ │  └──────────────────────────────────────────┘  │ │
│ │                 │ │  ══ splitter ══                                 │ │
│ │                 │ │  ┌ DetailPanel (tabs) ──────────────────────┐  │ │
│ │                 │ │  │ Scheda … | … : grouped form card         │  │ │
│ │                 │ │  └──────────────────────────────────────────┘  │ │
│ └─────────────────┘ └────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component inventory
**Shell:** `AppShell`, `TopBar`, `MainNav`, `Breadcrumb`, `Sidebar` (`GestioneTree` + `SectionMenu`),
`SplitPane` (resizable), `SectionPanel` (title + count + `Legenda` popover + `ActionToolbar` + body),
`DetailPanel` (Radix Tabs + `FormCard`/`FieldGroup`).

**Shared primitives (`packages/ui` or `apps/web/src/components`):**
- `TreeTable` — the grid adapter (TanStack Table): expand/collapse, group/subtotal rows, zebra,
  selection, **inline cell editors**, money/coefficient/number formatters, right-aligned numeric cols.
- `Money`, `Coefficient`, `NumberCell`, `StatusChip`, `DateText` — formatting primitives consuming
  tokens + the `Money` type.
- Inline editors: `MoneyInput`, `NaturalNumberInput`, `CoefficientInput` (4-decimal), with the legacy
  validators ported as pure functions.
- `ActionToolbar` + `IconButton` (Add/Edit/Remove/Print/Pdf/Excel/Refresh/Search), Radix `Tooltip`.
- `Dialog`/`Wizard` (Radix Dialog + a step header) for add/edit/registration flows.
- `ComboBox`, `DateField`, `TextInput`, `TextArea` (Radix-based form controls, token-styled).

### 3.3 Ports exposed by the shell (so screens depend on interfaces)
- `AppRuntime` (state slices; §4).
- `TreeTableAdapter` — the grid contract (data, columns, editing) independent of TanStack.
- `Navigation` — current module/section/breadcrumb.
- `MockDataSource` — observable streams of mock entities (stands in for the future data-access port).

---

## 4. State architecture (canonical react-rxjs composition root)

Implements §6 of the overview. **No module-level singletons.**

```
application/ports:
  interface AppRuntime {
    // navigation / selection
    useSelectedModule(): Module
    useSelectedSection(): CondominiSection
    useCondominiTree(): CondominiumNode[]
    useSelection(): { condominiumId?: id; accountingPeriodId?: id }
    select(sel): void
    // cascade-hydrated section data (mock now, real later)
    useCondominiumData(): CondominiumDetail | null
    useUnitsTree(): UnitRow[]
    useDistributionTables(): DistributionTable[]
    useDistribution(type: 'estimate'|'current'): DistributionRow[]
    useLedgerAccountsTree(): LedgerAccountRow[]
    useLedgerTransactions(page): LedgerTxnRow[]
    useInstallments(): InstallmentRow[]
    // detail selection within a section
    useSelectedRow(section): EntityRef | null
    selectRow(section, ref): void
  }
```

- `createAppRuntime(deps: { data: MockDataSource })` builds RxJS subjects (`selection$`,
  `selectedRow$`, …) and **derived streams** (`units$ = selection$.pipe(switchMap(...data...))`), wraps
  each in react-rxjs `bind()` **scoped to this call**, and returns an `AppRuntime`.
- `<AppRuntimeProvider data={mockData}>` calls the factory **once**, memoizes the instance, provides it
  via context. `useAppRuntime()` reads it. Components never import `react-rxjs`.
- **Selection cascade**: `selection$` → switchMap over `MockDataSource` → all section streams. Picking
  a period in `GestioneTree` updates every section automatically.
- **Testing/Storybook**: mount `<AppRuntimeProvider data={fixtureData}>`; each story/test gets an
  isolated reactive graph.

---

## 5. The six sections (columns & interactions per screen)

Columns/labels are taken from the legacy VOs + `Condominium.properties` + the screenshots. Money is
right-aligned, tabular, blue/red by sign.

### 5.1 Dati Condominio & Fornitori (ref: `02`,`03`)
- **Grid (tree):** condominiums → accounting periods. Columns: Cod., Condominio/Gestione, Tipo,
  Chiuso (closed icon), Competenza (date range), Liquidità, Fondi, Preventivo, Consuntivo,
  Saldo prec., Tot. dovuto. Group rows = condominium; child rows = periods.
- **Detail tabs:** *Scheda Condominio* (Intestazione, Codice, Status, Tipo, Indirizzo, Codice Fiscale,
  Data costruzione, group "Altro": Dati catastali, Id sistema, Creato/Modificato il) ·
  *Fornitori del Condominio* (supplier list + its own toolbar).

### 5.2 Unità, Condòmini & Bilancio Personale (ref: `04`–`09`)
- **Group-by selector**: "Raggruppa righe per: Per unità" (regroup control).
- **Grid (deep tree):** Gruppi/Unità/Condòmini. Columns: floor/inner/sub (Int./Sub.), Tipo,
  Restr. competenza (period restriction), Saldo prec., Preventivo, Consuntivo, Tot. dovuto, Versato.
  Rows: unit group → unit → resident (with ownership %), with bold subtotals.
- **Detail tabs:** *Scheda Unità* (Nome, Ubicazione, Dati identificativi: Codice/Piano/Interno/
  Subalterno, "Periodo di competenza ristretto": Data inizio/fine) · *Condòmini del unità*.
- **Inline:** none critical; selection drives detail.

### 5.3 Tabelle Millesimali & Riparto (ref: `10`–`16`,`47`,`48`)
- **Three panes:** (a) **Tabelle** list (Nome, Restrizione, Totale) with toolbar; (b) **Coefficienti
  Tabella** AdvancedDataGrid for the selected table — Unità + **inline-editable Coefficiente**
  (4-decimal) + Competenza; (c) full-width **Riparto** grid below with a **Preventivo/Consuntivo**
  toggle: expense accounts × units allocation, group subtotals, rounding row.
- **Inline editing** of coefficients is the headline interaction here — `CoefficientInput`, optimistic
  local update, recompute via the (mock) allocation port; box-collapse states (ref `47`).

### 5.4 Conti, Mastrini & Bilancio (ref: `17`–`25`)
- **Grid (tree = chart of accounts):** Conti hierarchy (Totale → Patrimoniali → Attività → Liquidità →
  Banche → account). Columns: Dare, Avere, Saldo, Preventivo, Restr. competenza, R/d, Tabelle di
  riparto. "Nascondi conti vuoti" toggle, Search. Bold group subtotals; selected account highlighted.
- **Detail tabs:** *Scheda Conto* (Conto path, Abbreviazione, Tipo conto, Natura conto, Contropartita
  predefinita, Restrizione periodo, "Saldi conto": Dare/Avere/Saldo/Preventivo) · *Mastrina*
  (sub-ledger / T-account entries for the selected account).
- **Inline:** preventivo editing on expense accounts (ref `23`).

### 5.5 Libro Giornale & Prima Nota (ref: `26`–`33`)
- **Grid:** journal transactions — Date, Descrizione operazione/Partita, Dare, Avere, running notes;
  expandable to show the ledger entries (debit/credit lines) per transaction. **Paging** controls
  (first/prev/next/last) + Preview.
- **Wizards (Radix modals, shells):** Add Ledger Entry, Add Transaction, Balance Opening (saldi
  iniziali), Invoice Registration, Invoice Payment, Unit-Resident Takings (incasso), Withholding-Tax
  Payment — each with its steps laid out (ref `27`–`33`, `39`).

### 5.6 Prospetto Rate (ref: `34`,`35`)
- **Grid (tree):** units/residents × installments. Columns: Ruolo, Restrizione competenza,
  Saldo prec., Totale preventivo, Tot. dovuto, then **one column per installment (Rata 1, Rata 2, …)**
  with **inline-editable amounts**, plus a residual/compensation column. Bold subtotals per group.
- **Wizard:** Create Estimate Installments (set count/period → distribute → review → pick liquid-asset
  account).
- **Inline:** `MoneyInput` per installment cell; locked/rounded flags reflected.

---

## 6. Mock data

- Hand-author a compact but realistic fixture set modeled on the **Saturno** and **Pozzetto**
  condominiums (the ones in the screenshots), enough to populate all 6 sections with believable
  hierarchies, coefficients, accounts, journal entries, and installments.
- Shape the fixtures as the **port DTOs** (`packages/application` types), exposed via `MockDataSource`
  as observables. Pre-compute displayed totals (no real engine yet); keep any inline-edit recompute
  behind an `AllocationPreview` port so the real `packages/domain` engine replaces it later without UI
  changes.
- Source realistic values from the legacy data dumps / report PDFs where convenient.

---

## 7. Styling implementation

- **CSS Modules** co-located with components (`Component.module.css`), consuming **only token
  variables** — no hard-coded colors/spacing. One `tokens.css` defines the theme; a second theme file
  proves swappability.
- **Radix primitives** for Dialog/Tabs/Tooltip/Dropdown/Popover, styled via CSS Modules (no Tailwind,
  no shadcn).
- Semantic, readable class names (`.toolbar`, `.groupRow`, `.moneyNegative`). No utility soup.
- Icons: a lucide-style set behind an `Icon` component (swappable).

---

## 8. Testing

- **Component tests** (React Testing Library): each section renders the mock hierarchy, correct
  columns, selection updates detail, inline edit fires the port.
- **Runtime isolation test**: two `<AppRuntimeProvider>` instances don't share state (proves no
  singletons).
- **Token/theme test or story**: swapping the theme file re-themes (visual/Storybook).
- **Contract test stub** for `TreeTableAdapter` and `MockDataSource` ports (so real adapters later
  reuse the suite).
- (Optional) Storybook for the design system + each section.

---

## 9. Build & run

- `apps/web`: Vite dev server, `pnpm --filter web dev`.
- No backend; `MockDataSource` is the only data source.
- TypeScript strict; ESLint/Prettier.

---

## 10. Open questions

- **Wordmark/branding** for the modern header (placeholder "CondoLedger" until naming finalized per
  brief).
- **Icon set** preference (lucide assumed).
- Degree of inline-edit *recompute* realism wanted in the prototype (pure display vs naive local
  recompute) — defaulting to naive-local-behind-a-port.
- Whether to include a minimal **fake login** screen or boot straight into a logged-in studio.
