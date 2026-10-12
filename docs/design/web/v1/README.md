# Handoff: CondoLedger — full app UI (prototype → `apps/web`)

## Overview
The prototype `Condomini.dc.html` is the visual and behavioural spec for the CondoLedger web app: a condominium administration + double-entry accounting workspace. It covers the whole shell (top bar, breadcrumb, sidebars) and all modules: Calendar, Buildings (Data & Suppliers, Units & Owners, Thousandth Tables & Allocation, Accounts & Ledger, Journal, Installments), Contacts, plus every dialog and journal-entry wizard. Two real datasets are wired in and reconcile: **Saturno 2011** and **Pozzetto 2013**.

## About the design files
Everything in this bundle is a **design reference built in HTML** (a single-file interactive prototype). It is not production code. The task is to **recreate it inside the existing `apps/web` codebase** (Vite + React 18 + TypeScript, CSS Modules + `tokens.css`, Radix primitives, TanStack Table behind `TreeTable`, react-rxjs runtime, `MockStore`) using its established patterns. Do not port the prototype's inline styles or its `renderVals()` logic; lift the values and behaviours documented here.

## Fidelity
**High-fidelity.** Colors, type sizes, spacing, radii, grid column templates and interaction states are final. Recreate pixel-close. Where the prototype uses emoji as icons (🏢 🏠 👤 📁 📄 🏦 💵), the app should use `lucide-react` equivalents at 13–14px, keeping the same semantic mapping (see Assets).

## Suggested implementation order
1. Replace `apps/web/src/styles/tokens.css` + `theme-dark.css` with `tokens.css` from this bundle (names differ from the current tokens — update CSS Modules that reference `--surface-*`, `--text-*`, `--accent`). Swap Inter → IBM Plex Sans / Mono (Google Fonts link or self-hosted).
2. Harden the shared primitives (section “Shared components”), each the first time a screen needs it.
3. Port screens in this order: Accounts & Ledger → Journal + wizards → Installments → Tables & Allocation → Building Data & Units → Contacts → Calendar.
4. Verify against the datasets: Saturno 2011 and Pozzetto 2013 totals in `reports/` must match what the grids show.

---

## Global layout (app shell)

Root: `height:100vh; display:flex; flex-direction:column; overflow:hidden; font-family:var(--font-sans); font-size:13px; color:var(--tx); background:var(--app)`.

### Top bar (`--chrome`, padding `0 18px`, gap 18px, stretch)
- Left: logo tile 44×44, radius 12, bg `--acc`, white building/€ glyph; wordmark “CONDO LEDGER” 17px/700/`#fff`, letter-spacing .3px; sub-line “CONDOMINIUM ADMIN” 10px uppercase, letter-spacing .16em, `--cfgd`.
- Right column, top row (12px, `--cfgd`): `Account **marco** · Ferrari Marco | Profile **Administrator** | Firm **Studio Ferrari**` (bold parts `--cfg`, weight 600; separators `|` at opacity .4). Then controls: light/dark toggle 30×28, theme picker (swatch 11×11 r3 + name + ▾), language picker (flag 15px + ▾), “✕ Log out” in `#e98a8a` 600. Chrome buttons: height 28, radius 7, bg `rgba(255,255,255,.07)`, border `1px solid rgba(255,255,255,.12)`, color `--cfg`, 12px.
- Right column, bottom row: **module tabs** (Calendar · Buildings · Contacts), right-aligned, gap 3px. Tab: padding `7px 16px 9px`, radius `9px 9px 0 0`, 12.5px; active = bg `--panel`, color `--tx`, 600; inactive = transparent, `--cfgd`, 500. Leading 7px dot: Calendar `#3aa0e0`, Buildings `#2f6fed`, Contacts `#7f8c8d` when active, `--cfgd` otherwise.
- Popovers (theme/language): width 172–184, bg `--panel`, border `--bd`, radius 9, shadow `--shadow-pop`, padding 5; section label 10.5px/700 uppercase `--txd` letter-spacing .04em; rows padding `7px 9px`, radius 6, hover `--hover`, check ✓ in `--acc` on selected. Click-outside scrim closes.

### Breadcrumb bar
Height 29, bg `--panel`, border-bottom `--bd`, padding `0 14px`, 12px `--txd`, gap 7. Home chip 18×18 r4 bg `--ph` border `--bd2`. Items separated by `›`; last item `--tx` 600. Paths: `Calendar` · `Contacts` · `Buildings › {Building} › {Period} › {Menu item} [› {Unit code}]`.

### Body
`flex:1; display:flex; min-height:0`. Sidebar (left) → 12px splitter → `main` (`padding:6px; gap:6px; flex-direction:column; background:--app`).

### Sidebar (Buildings module), default width 272, bg `--app`
Two stacked cards with 8px left margin:
1. **Select Management** — header strip (bg `--ph`, border `--bd`, radius `6 6 0 0`, padding `7px 10px`, 11.5px/600 `--phf`), toolbar row (`+` green, `✎`, `−` red, spacer, `⟳`; buttons 24×22 r5 border `--bd` bg `--ctrl`), scrollable tree: Building rows (🏢 name “(Building)”, 13px/500, caret ▾/▸ 9px) and period rows (📁 “2013 (Ordinary)”, 12.5px, indent 18px; selected = bg `--sel`, `inset 2px 0 0 --acc`, color `--acc` 600).
2. **Management Menu** — same header; items full-width, padding `8px 11px`, border-bottom `--bd2`, 12px/500, icon + label + `▸` (visible only when active, `--acc`). Active: bg `--sel`, `inset 3px 0 0 --acc`, color `--acc` 600. Items: Building Data & Suppliers · Units, Owners & Personal Balance · Thousandth Tables & Allocation · Accounts, Ledgers & Balance · Journal & Daybook · Installment Schedule.

Collapsed state: a vertical rail card (margin `6px 0 6px 8px`, radius 6) with `›` in `--acc` and vertical “MANAGEMENT” 11px/600 `--txd` letter-spacing .04em.

Contacts module replaces it with the **Filters** sidebar: “Filter Contacts” card (checkboxes Natural persons / Companies, Keyword field, Building select, buttons 🔍 Search / ↺ Reset at height 26 r6 12px), then “Contact Categories” card (toolbar + list of category + right-aligned count; selected row `--sel` with left bar).

### Splitters
Vertical: hit area 12px wide, cursor `col-resize`, hover bg `--bd2`, pill 4×42 r3 `--bd` centered; `margin-right:-6px` overlaps main. Horizontal (between stacked panels): height 12, `margin:-6px 0`, cursor `row-resize`, pill 42×4. Drag updates a split ratio in state; default 0.5 for all stacked views, Calendar right column default 404px.

### Compact mode (viewport < 1180px)
Left sidebar, Contacts filter sidebar and the Calendar deadlines column become **overlay drawers**: hidden by default; the rail click opens them `position:absolute` over `main` (z-index above content) with a scrim `--scrim-drawer`; clicking scrim closes. Bottom (stacked) panels keep normal flow. Splitters hidden in compact mode.

---

## Shared components (build these in `components/`)

### Panel (`SectionPanel`)
bg `--panel`, border `1px solid --bd`, radius 7, `overflow:hidden`, column flex. **Header**: bg `--ph`, border-bottom `--bd`, padding `5px 11px`, title 12px/600 `--phf`; right side: optional meta 11.5px `--txd` (“ⓘ Legend”, “18 units total”) and a **maximize** button 22×20 r4 (⤢ / ⤡) that hides the sibling panel (`max-height:0`, transition .18s) and restores it.

### Tabbed panel (bottom detail panels)
Tabs row above the panel, gap 3: tab padding `6px 16px`, border `--bd`, radius `7 7 0 0`, 12px, `margin-bottom:-1px`; active = bg `--panel`, border-bottom `--panel`, `--tx` 600, z 2; inactive = bg `--ph`, `--txd` 500. Panel below has radius `0 7px 7px 7px`.

### Toolbar (inside a panel, under the header)
`display:flex; gap:5–6px; padding:4px 8px; border-bottom:1px solid --bd2; align-items:center`. Buttons: height 24, radius 5, border `--bd`, bg `--ctrl`, 12px; icon-only width 24–28. Color coding: `+` `--ok` 700 (with ▾ 9px `--txd` when it opens a menu), `✎` `--txd`, `−` `--neg` 700, `⊞/⊟` expand/collapse all 13px, `⟳` refresh right-aligned, print/PDF/XLS icons (PDF red `#d8392b`, XLS green `#1d7a43`, 15px). Vertical divider between groups: 1×16 `--bd`, margin `0 3px`. Search box: width 220, bg `--ctrl`, border `--bd`, r5, padding `4px 8px`, 12px placeholder `--txd` with 🔍. Select-like chips: border `--bd`, r5, padding `3px 9px`, 11.5px, trailing ▾. Disabled paging buttons: border `--bd2`, opacity .4.

### Data grid (`TreeTable` — extend the existing one)
CSS grid rows (not `<table>`), one `grid-template-columns` per grid (see per-screen templates). Behaviours required:
- Sticky header: bg `--ph`, border-bottom `--bd`, 10.5px/600 `--phf`, letter-spacing .02em, cell padding `6px 8px` (5px for dense grids). Numeric columns right-aligned, flags centered.
- **Resizable columns**: drag handle over each header boundary (11px hit area; thin 1px `--bd` line at left+5px; hover `rgba(120,140,170,.22)`); each column has `min`/`max`/`def`, first column `grow`. Row `min-width` = sum of column widths; the panel body scrolls horizontally.
- Rows: border-bottom `1px solid --bd2`, body text 12px (11–11.5px for secondary columns in `--txd`), `align-items:center`, cell padding `4–5px 8px`.
- **Tree**: indent `8 + depth×16px`; caret box 17px wide, ▾/▸ 13px/700 `--acc` when expandable (else empty spacer); click on caret toggles, click on row selects. Group/root rows: bg `--zebra`, label 700. Leaf 500 (owner rows 400).
- **Selected row**: bg `--sel`, `box-shadow: inset 3px 0 0 --acc`, label 600. Hover (lists): `--hover`.
- **Expand all / Collapse all** toolbar buttons.
- Hidden/invalid rows (`err`): label `--txd` italic.
- Sticky footer totals (Ledger): `position:sticky; bottom:0; border-top:2px solid --bd; background:--zebra; font-weight:700`.

### Money cell (`Money`)
Right-aligned, `font-variant-numeric: tabular-nums`, 11.5px, padding `3px 8px`, nowrap. Format: en-US style `1,234.56` (prototype converts the Italian source `1.234,56`). Color rules: blank → nothing; negative (`-`) → `--neg`; zero (`0.00`, `---`, `-`) → `--txd`; positive → `--num`. `plain` variant (Journal/Ledger Debit/Credit): `--tx`, zero `--txd`. Aggregates (`emph`: group/root rows, totals) weight 700, else 500.
Installment cells additionally color by settlement status: settled `--ok`, partial `#e0892b`, unsettled `#2a6fdb`.

### Inline editors
Click on an editable numeric cell (Budget on cost accounts, Coefficient, Installment amount) swaps in an `<input>`: `width:100%; text-align:right; border:1px solid --acc; radius 4; padding 2px 6px; 11.5px; bg --ctrl`. Commit on blur / Enter, cancel on Esc.

### Scheda (read-only detail form)
Container padding `11–14px 16–18px`, `max-width` 560–900, column gap 9px. Row = grid `170px 1fr` (156px inside fieldsets; 300/283px on Accounts detail), 12.5px, label `--txd` 600, value `--tx` (`---` placeholder in `--txd`, ✓ Active in `--ok`, codes in `--font-mono`, links in `--acc`). **Fieldset**: border `--bd2`, radius 7, padding `6px 14px 12px`, legend 11px/700 uppercase `--txd` letter-spacing .04em, padding `0 6px`.

### Form field (dialogs)
Row = grid `{labelW} 1fr`, gap 10, align center; label 12.5px/600, `--txd`; **required labels in `--acc` with trailing `*`**. Field box: bg `--ctrl`, border `--bd`, radius 6, padding `6px 9px`, 12.5px, min-height 30. Focused/required-highlight border `--acc`. Read-only/computed: bg `--zebra`, border `--bd2`, `--txd`. Selects show trailing ▾ `--txd`; dates show 📅; chip values (linked account / supplier) as `bg --sel r4 padding 2px 7px "{value} ✕"`. Checkbox 14–15px r3–4 (checked: bg+border `--acc`, white ✓ 10px/700). Radio 14px (checked: `border:4px solid --acc`). Address-type fields render `✎ (acc) ⊖ (neg) value` inline instead of a box. Notes: textarea box min-height 58–80.

### Dialog (`WizardDialog` — extend)
Scrim `--scrim`, fade .12s. Card: width per dialog (380 alert · 460 nested · 560 default · 640 cost account · 680 wizard · 720 configure · up to 94vw), bg `--panel`, border `--bd`, radius 10, shadow `--shadow-modal`, `max-height:90vh`, pop-in .16s. **Title bar** is the drag handle: bg `--ph`, border-bottom `--bd`, padding `11px 16px`, 13px/600 `--phf`, `cursor:move` (card becomes positioned; position persists per dialog id during the session). Body padding `16px 18px`, column gap 12–13. **Footer**: bg `--zebra`, border-top `--bd2`, padding `12px 16px`; left “Required fields are marked with *” 11.5px `--txd`; right buttons height 32 r6 12.5px: `◀ Back` (secondary), primary (bg+border `--acc`, white, 600 — label `✎ Save`, `Next ▶`, `✓ Confirm`…), `✕ Cancel` (secondary: border `--bd`, bg `--ctrl`). Esc closes. Primary disabled while the step is invalid.
**Confirm alert** (380): title “Notice”, ⚠️ in a 34px circle `#fdf0d5`, text 12.5px/1.55, buttons Yes (primary) / No, height 30. Stacks above other dialogs (z 60).

### Dropdown menu (from `+ ▾` buttons)
Same chrome as popovers (width 188–228, radius 9, shadow). Section label uppercase 10.5px; items padding `7px 9px`, 12.5px, icon in 16px slot, hover `--hover`.

---

## Screens

All building-scoped screens read from the selected building/period; grids re-shape per building (column sets for allocation and installments are **data-driven**, not hard-coded).

### 1. Calendar (module tab)
Layout: calendar panel (flex 1) | splitter | deadlines column (404px default; collapsible to a vertical “DEADLINES” rail; drawer in compact).
- Toolbar: `‹` month `›` (26×24, chevrons `--acc`), month title 13px/600 min-width 128 centered, divider, **Calendars** filter button (▦ + label + count badge bg `--acc` white r9 10px + ▾) opening a 218px popover with “SHOW CALENDARS” + “All/None” link and one checkbox row per layer (9×9 r2 color square + label); right: “Building: — All — ▾”, ⟳.
- Weekday header row (7 cols); month grid `repeat(7,1fr) × repeat(5,1fr)`; day cells: number top-left (today ringed in `--acc`, selected cell bg `--sel`), events as 10px lines `color --acc`, `border-left:2px solid {layerColor}`, padding-left 4, tick mark ✓ `--ok` / ✕ `--neg` / other `--warn`.
- Footer: “View: ● Monthly ○ Weekly ○ List” 11.5px, active `--acc` 600.
- Right column, top panel “Deadlines for {d Month yyyy}” with toolbar `+ ✎ −` and grid `Time | St. | Pr. | Description` (header on `--zebra`, 10.5px); row: time tabular `--txd`, ✓ `--ok`, priority dot 9px (`#2e9e5b` / `#e08a2b`), description 11.5px ellipsis; empty state “No deadlines on this day.” centered 12px `--txd`. Horizontal splitter, then **“Selected deadline details”** panel: rows grid `84px 1fr` (Description, Date, Calendar, Status ✓, Priority dot) and a NOTES box (bg `--zebra`, border `--bd2`, r6, 11.5px/1.55, `white-space:pre-line`).

### 2. Buildings › Building Data & Suppliers
Top panel “Building Data” (meta “ⓘ Legend · 2 buildings total”, maximize). Toolbar: `+▾ ✎ − | ⊞ ⊟ | print PDF XLS … ⟳`.
Grid columns: `Code | Building / Period | Type | Closed | Period | Liquidity | Funds | Budget | Actual | Prev. bal. | Total due`. Building rows (🏢, bg `--zebra`, code in mono 11px `--txd`, name 700 12.5px) expand to period rows (📁, indent 22px, period range tabular 11.5px `--txd`, unchecked 13px checkbox for Closed). Selecting a period sets the active building/period app-wide.
Bottom tabbed panel: **Building Profile** (scheda: Name, Building code, Status, Type, Address, Tax code, Construction date; fieldset OTHER: Cadastral data, System ID, Created on, Modified on) · **Building Suppliers** (split: list grid `Name / Company | Contact category` | splitter | supplier scheda: Contact type, Status, Code; COMPANY DATA: Company name, Registered office, Tax domicile; CONTACTS: Phone, Email in `--acc`).

### 3. Buildings › Units, Owners & Personal Balance
Top panel toolbar: “Group by: By unit ▾”, divider, `+▾` menu (📁 New group · 🏠 New unit · 👤 New owner), `✎ −`, `⊞ ⊟`, print/PDF/XLS, ⟳.
Grid template: `minmax(280px,1.6fr) 50px 40px 40px 110px 152px 92px 90px 90px 96px 80px 86px 92px` → `Groups / Units / Owners | Floor | Int. | Sub. | Type | Restr. period | Prev. bal. | Budget | Actual | Total due | Paid | Overdue | Adjustment`. Tree: root 🏢 “Pozzetto / 2013 (address)” → units 🏠 “A02 - Variola Dina, Rosso Sergio” → owners 👤 “Variola Dina (PR 100%)”; Saturno adds group level 📁 (A, B). Owner-change rows carry `restr` “19/01/2013 - end of FY”.
Bottom tabbed panel: **Unit Profile** (Unit name, Location; IDENTIFICATION DATA: Code mono, Floor, Interior, Sub-unit; RESTRICTED PERIOD: Start/End date) · **Unit Owners** grid `Periods / Roles / Owners | Owner relationship scenario | Out | Restr. period | Days | % Share | Comb. coeff.` with head row 🗓 “Full period” (bg `--zebra`), 👥 “Owners” sub-head, owner rows; `% Share` is a progress bar (track `--bd2`, fill `--acc`, centered white 10.5px/700 label); `Out` shows ✓ in `--acc` for outgoing owner; coefficient 6 decimals.

### 4. Buildings › Thousandth Tables & Allocation
Top row (max-height collapsible): **Thousandth Tables** panel (grid `Name | Restriction on | Counter | Total`, total plain money, selected row `--sel`; toolbar at bottom `+▾ ✎ − | print PDF XLS`) | splitter | **Table Coefficients** panel (grid `Unit | Period | Coefficient`; tree groups bg `--zebra`; coefficient 11.5px 500/700, inline-editable with live recompute of the allocation below; bottom toolbar `⊞ ⊟ | ✎ … ⟳`).
Horizontal splitter. Bottom **Allocation** panel: toolbar `[Budget allocation ▾ | Final-balance allocation]` toggle button (600), “Group rows by: By unit ▾”, “Group cols by: By account ▾”, checkbox “Include installments” (checked), ⟳. Grid: `minmax(240px,1.4fr) 50px 146px 64px` + one `~92–104px` column per **cost account/group** (data-driven, labels from the chart of accounts) + `Total | Prev. bal. | Total due | Paid`. Header: `Groups / Units / Owners | Role | Restr. period | Days | …`. Rows = same tree as Units (per payer, matching the PDF exports); group/root rows bold with `--zebra` bg; a final “Roundings” row where applicable. Bottom toolbar `⊞ ⊟ | print PDF XLS`.

### 5. Buildings › Accounts, Ledgers & Balance
Top panel “Accounts, Ledgers & Balance”. Toolbar: search (220), checkbox “Hide empty accounts”, divider, ⚙ (Configure functional accounts), divider, `+ ✎ −`, divider, `⊞ ⊟`, divider, print menu “Print balances ▾” (Chart of Accounts · Budget statement · Actual statement · Detailed actual statement · Comparative Actual/Budget · Comparative Actual/Prev. actual), PDF, XLS, ⟳.
Grid header: `Accounts | Debit | Credit | Balance | Budget | Restr. period | R/d | Allocation tables | Restriction on | Ecc. | Default contra | R/s | Detr.`. Tree root “Total” (Σ) → Patrimonial / Costs / Revenue → … Icons: folder SVG (closed/open, tinted per nature: assets blue-ish, liabilities, costs, revenue — use the account `nature` to pick a lucide `Folder`/`FolderOpen` with a per-nature color), document for leaves; special leaves 💵 cash, 🏦 bank, 🚚 suppliers, 👥 owners, 🔢 roundings, 🏛️ tax authority. Money: Debit/Credit `plain`; Balance colored; **0.00 grey in every column; aggregates bold on Balance**. Budget cell inline-editable on cost accounts. Flags R/d, Ecc., R/s, Detr. are 13px checkboxes (read-only). Selected account drives the bottom panel.
Bottom tabbed panel: **Account Details** (scheda, label col 300px: Account path in `--acc`, Account type, Account nature, Default contra-account, Period restriction; for cost accounts fieldset COST ACCOUNT ATTRIBUTES: Allocation restriction on a group, Allocation on ownership change, Default tax deduction, Next-period budget calculation “**100%** of actual + 0 EUR”; checkbox “Separate tables for budget & final balance (uses parent account settings)”; fieldset with mini-grid `% | Table | PR/NP/LE | US/CF | CO | SC | Table restr. on group` (cols `48px minmax(110px,1.4fr) 72px 60px 54px 48px minmax(130px,1.3fr)`); fieldset ACCOUNT BALANCES: Debit, Credit, Balance (`--num` 600), Budget; OTHER: System ID, Created on) · **Ledger** (grid `Date | P.N. | Entry description | Posting | Debit | Credit | Balance`, running balance, sticky Total footer).

### 6. Buildings › Journal & Daybook
Single panel “Journal” (meta “{n} entries total”, maximize). Toolbar: search, `+ ▾` **Add transaction** menu (📄 New invoice · 💶 Record collection · Invoice payment · Direct purchase via bank · Direct purchase with cash · Withholding-tax payment · Opening balances · Budget allocation · Generic entry · Direct payment to multiple cost accounts), `✎`, `−` (opens the delete confirm alert with the entry description), divider, `⊞ ⊟`, print/PDF/XLS, paging “Page **1** of n”, page size `10 ▾`, ⟳.
Grid `Date | P.N. | Entry description / Postings | Debit | Credit | Balance`. Entry row: date 11px `--txd` tabular (dd/mm/yyyy hh:mm), P.N. 11px 600, caret + type icon (🧾 📄 💶 …) + description 12px/600 ellipsis, Debit/Credit `plain` bold, Balance 0.00. Expanded posting rows: bg `--zebra`, path 11px `--txd` indented 53px (“Total › Patrimonial › (Assets) › Liquidity › …”), Debit/Credit plain, running Balance (last line 0.00 regular, others bold).

### 7. Buildings › Installment Schedule
Single panel. Toolbar: “Group rows by: By unit ▾”, divider, `+ ▾` **Add installments** menu (＋ Create advance installment · ≣ Create budget installments · Create final-balance installment · …), `✎ −`, `⊞ ⊟`, print/PDF/XLS, ⟳.
Grid: `Groups / Units / Owners | Role | Restr. period | Days | Prev. bal. | Total budget | Total due |` + one column per installment (header two lines: `n` and due date, 10px, colored per installment) `| Total inst. | Inst. bal. | Paid | Overdue`. Installment cells inline-editable (leaf, non-group rows); colored by settlement status computed from Paid, oldest-first (settled `--ok`, partial `#e0892b`, unsettled `#2a6fdb`). Group/root rows bold on `--zebra`.

### 8. Contacts (module tab)
Top panel “Contact List” with paging toolbar (`« ‹ › »`, print/PDF/XLS, “Page **1** of 12 · 111 contacts total”, `10 ▾`, ⟳). Grid `Name / Company | Code | Type | St. | Reference address | Tax code | VAT no. | Lng. | Category` — code mono 11px `--txd`, type icon 🏢/👤, status ✓ `--ok` or ◳ `--warn` (pending), flag 🇬🇧 when language set.
Bottom tabbed panel: **Contact Details** (scheda: Contact type, Status, Code; COMPANY DATA / PERSONAL DATA; CONTACTS: Phone; SUPPLIER OF THE FOLLOWING BUILDINGS list or “— None —”) · **Connected Contacts** grid `Order | Relationship | Name | Code | Type | St. | Reference address | Tax code | VAT no.` (cols `50px 156px minmax(150px,1.3fr) 64px 40px 36px minmax(170px,1.5fr) 130px 104px`) · **Linked Accounts** grid `Username | Status | Profile | P/F | P/T | P/O | P/A | Privileges` (permission cells are 13px checkboxes).

---

## Dialogs & wizards

All share the Dialog spec. Field label column widths noted per dialog.

**Edit Building** (560, label 160): Name*, Building code, Status* (select), Type* (🏢 select), Address (inline ✎ ⊖ value), Tax code, Construction date 📅; fieldset OTHER: Cadastral data; NOTES.
**Edit Management / Period** (560, 160): Management name*, Type*, Status*; fieldset COMPETENCE PERIOD: Start date*, End date; NOTES.
**Edit Unit** (560, 160/145): Unit name; IDENTIFICATION DATA: Manual code (mono), Floor, Interior, Sub-unit; RESTRICTED PERIOD: Start/End; ADDITIONAL DATA: Type select, Cadastral data.
**Edit Group** (560): Code*, Name*, Address, NOTES.
**Add/Edit Owner** (560, 148): Linked contact* (chip), Role select, Previous balance*, Co-ownership % (read-only), RESTRICTED PERIOD; FRONTEND ACCESS KEYS: Username (mono, read-only), Password (mono).
**Edit Thousandth Table** (560): Name*, Order, NOTES.
**Edit Account** (640, 215): Account name*, Order, Account type* (locked select), Account nature* (locked), Budget (€) for cost accounts; RESTRICTED PERIOD; cost accounts only → COST ACCOUNT ATTRIBUTES (Allocation on ownership change, Default tax deduction), NEXT-PERIOD BUDGET CALCULATION (`[100] % of [actual ▾] + extra [ ] EUR`), radio “Separate tables for budget & final balance: yes / no / ● use parent settings”, ALLOCATION TABLES mini-grid (cols `56px minmax(180px,1.6fr) 80px 66px 58px 52px minmax(170px,1.4fr)`, table name in `--acc` with ▾, empty state “No tables linked — uses parent account settings.”, `＋ −` 22px buttons); NOTES.
**Specify Cost Account** (640, 190): Account (path `--acc`), Abbreviation, Account type select, Account nature, Allocation table* (border `--acc`), Default contra-account, Period restriction.
**Configure functional accounts** (720, 230): Cash on hand, Default bank account, Payables/receivables vs suppliers, Receivables/payables vs owners, Owner rounding fund, Owner individual expenses (each a chip field); fieldset TAX PAYABLE ACCOUNTS: 20% (1001 Employee salaries), 0% (1004 Condo admin without VAT), 4% (1019 Partnership), 4% (1020 Corporation), 20% (1040 Professionals with VAT) — chip or italic placeholder “Type account initials…”.
**Edit Person** (560, 160/140): Status*, Code; PERSONAL DATA: First name, Last name*, Gender radios (Male/Female/Unspecified), Birth date, Birth place, Residence/Domicile address (inline ✎ ⊖); CONTACTS (legend has ⊕): 📞 Phone, ✉️ Email, 🔗 Website rows with ✎ ⊖ (✎ opens nested **Edit Contact** 460: Order*, Contact type*, Label*, Value*); USEFUL DATA: Salutation select, Tax code, VAT number, Contact category select.

### Journal-entry wizards (680, label 200). Every wizard shows “Building / Period: {name} ({address})” first and ends with an **Entry postings** summary grid (`46px 1fr 110px 110px` → `# | Account (Partita) | Debit | Credit`, header bg `--ph` 10.5px/700, rows 11.5px). Selectable list rows: padding `6–7px 10px`, border-top `--bd2`, 12px, selected bg `--sel`.
1. **New Invoice Entry** — Step 1 “Select Supplier”: Invoice number*, Invoice reason*, Supplier* (chip), Invoice date*, Invoice due date. Step 2 “Calculate Withholding” (label 240): withholding-type pills; Taxable amount (computed), Social security withholding `[4 %]` → amount, Invoice taxable, Total VAT `[20 %]` → amount, Non-taxable amount, **Total invoice** (bg `--zebra`, 700); checkbox “Apply withholding on social security”; Withholding taxable; Withholding tax select “4% (1019 Partnership)” → amount; **Total due to supplier** (700).
2. **Record Owner Collection** — Step 1: owner grid `Name | Total inst. | Paid | Inst. balance` (select). Step 2: “LIQUIDITY ACCOUNT COLLECTED INTO” list (🏦), Amount collected* input (right-aligned, width 160), note “The amount is allocated against the owner's outstanding installments, oldest first.” Step 3: Description* (“Collection Installments 2011 (Ordinary) / {owner}”), lines grid `Order | Posting | Debit | Credit | Balance` (cols `46px minmax(240px,1fr) 90px 90px 90px`) with Total footer.
3. **Invoice Payment** — Step 1: unpaid invoices grid `Nr. | Reason | Date | Due | Supplier` (cols `70px 1fr 110px 110px 200px`). Step 2: “SELECT A MOVABLE LIQUIDITY ACCOUNT” list, tranche note, Amount to pay* (prefilled with invoice total). Step 3: Description* + postings (Suppliers debit / Liquidity credit).
4. **Direct Purchase via Default Bank Account** / 5. **Direct Purchase with Cash** / 6. **Withholding-tax Payment to Tax Authority** (one step): Description, section “COST ACCOUNT” (or “TAX ACCOUNT TO SETTLE”) selectable list (📄), Amount*, “Paid from: {bank or Cash on hand}”, postings. Next disabled until amount > 0.
7. **Opening Balances Entry**: Transaction balance (running), scrollable account tree (max-height 240, selectable), Amount* (border `--acc`), radios “● Insert and restart the procedure for another asset account / ○ Don't insert and go to the next step”.
8. **Add Accounting Entry (generic)**: Description* input; editable lines grid `# | Account (Partita) | Debit | Credit | Balance` (cols `46px 1fr 110px 110px 110px`, inputs r4 11.5px), Total footer (Debit, Credit, Balance in `--num`); `＋ −` row buttons; validation message in `--neg`: “The entry must balance — the transaction balance must be 0 and a description is required.”
9. **Budget Allocation** (summary only): Description “Budget allocation (no.1)”, helper text, postings: one debit line per owner/unit + roundings, one credit line “Total › Revenue › From owners › From budget allocation”.
10. **Direct payment to multiple cost accounts**: like 4 but with multiple cost lines summing to the paid amount.

Footer buttons: `◀ Back` (hidden on step 1), primary `Next ▶` / final `✓ Save entry`, `✕ Cancel`.

---

## Interactions & behaviour summary
- Module tabs switch sidebar + main; Management Menu switches the Buildings sub-view; sidebar period click sets building/period and resets selections (default unit, table, account “Total”).
- Tree expand/collapse per node id; ⊞/⊟ set all. State persists while navigating.
- Row selection drives bottom panels (building → profile/suppliers, unit → profile/owners, account → details/ledger, contact → details/connected/linked, table → coefficients, deadline → details).
- Maximize toggles per stacked view (`maxP`), with a .18s transition; column separators re-position after layout changes (resize observer).
- Splitters: mouse drag updates ratio; min sizes respected.
- Column resize: drag on header boundary; persists per grid in state (`gcols`).
- Popovers/menus close on outside click or Esc. Dialogs close on Esc or Cancel; the delete alert returns focus to the grid.
- Inline edit: click → input → blur/Enter commits (recomputes totals/allocation), Esc cancels.
- Light/dark mode and 3 themes (slate/carbon/sage) via `data-mode` / `data-theme` on the root.
- Language picker (en/it/fr/de/es) — UI strings only; data is not translated.
- Compact (<1180px): sidebars and Calendar deadlines as overlay drawers with scrim.
- Hover: toolbar buttons bg `--hover`; list rows `--hover`; splitters `--bd2`.
- Loading/empty: grids show “No … on this day.” style messages centered 12px `--txd`; toolbar stubs show a toast rather than silently doing nothing (keep the repo's convention).

## State (per the runtime)
`section` (calendar|buildings|contacts), `menu` (data|units|thousandths|accounts|journal|installments), `building`, `period`, `expanded{}`, selections (`sel` unit, `accSel`, `tblSel`, `contactSel`, `supplier`, `calDay`, `calDeadline`), tabs (`bottomTab`, `unitTab`, `accTab`, `contactTab`), split ratios, `gcols{}` column overrides, `maxP`, `compact`, `drawer`, theme/mode/lang, dialog state (`editModal`, `jModal`+`jStep`+per-wizard form fields, `cfgOpen`, `scOpen`, `jDelOpen`, `cEdit`), inline `editKey`+`edits{}`, calendar `filters{}`, `ripMode` (budget|actual).

## Data
- `reports/pozzetto/acc.json` — Pozzetto 2013 chart of accounts tree with Debit/Credit/Balance/Budget per node.
- `reports/pozzetto/journal.json` — Pozzetto 2013 journal entries with postings.
- `reports/saturno/EXTRACTED.md` + PDFs — Saturno 2011 source exports (chart of accounts, journal, allocation budget/actual, installments, thousandth tables, unit list). Pozzetto PDFs likewise.
- Names in the prototype are invented (Ferrari Marco / Studio Ferrari replaces real PII); supplier names and IBANs are kept as in the exports.
- Amount format in sources is Italian (`1.234,56`); the UI renders `1,234.56`. Store cents as integers.

## Assets
- Fonts: IBM Plex Sans 400/500/600/700, IBM Plex Mono 400/500 (Google Fonts).
- Icons: prototype uses emoji + a few inline SVGs (print, PDF, XLS, folder/document, logo). Map to lucide-react: Building2 (🏢), Home (🏠), User (👤), Users (👥), Folder/FolderOpen (📁), FileText (📄), Landmark (🏦/🏛️), Banknote (💵), Truck (🚚), Hash (🔢), Receipt (🧾), Calendar (📅/🗓), Printer, Settings (⚙), RefreshCw (⟳), Pencil (✎), Plus, Minus, Search, ChevronRight/Down (carets), Maximize2/Minimize2. PDF/XLS: keep the colored document glyphs (red `#d8392b`, green `#1d7a43`).
- Logo: 44×44 tile, radius 12, `--acc`, white outlined building with a € badge (see SVG in `Condomini.dc.html` header).

## Files in this bundle
- `README.md` — this document.
- `tokens.css` — all color/type/spacing tokens (3 themes × light/dark), ready to replace `apps/web/src/styles/tokens.css` and `theme-dark.css`.
- `Condomini.dc.html` + `support.js` — the interactive prototype (open `Condomini.dc.html` in a browser; resize below 1180px to see compact mode; use the theme/mode toggles top-right).
- `reports/` — source datasets and PDF exports for Saturno 2011 and Pozzetto 2013 (real printouts, kept on this machine outside git).
