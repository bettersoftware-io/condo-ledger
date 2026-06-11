# Prototype Completion Spec — full legacy parity on mock data

> **Status:** Design / spec. Supersedes §1.3 (out-of-scope list) of
> [`prototype-design`](./2026-06-07-prototype-design.md); everything else in that spec still applies
> (visual system, tokens, shell anatomy, state architecture).
> **Date:** 2026-06-11
> **Purpose:** Take the existing `apps/web` Condomini prototype (28/28 tests, all 6 sections render)
> to **full legacy parity**: complete the 6 Condomini sections, build the Calendario and Anagrafiche
> modules for real, and make every interaction work against in-memory mock state.

---

## 1. Decisions (made with the user, 2026-06-11)

1. **Scope: full legacy parity.** All 6 Condomini sections finished to spec, PLUS real Calendario
   and Anagrafiche modules. Every screenshot in `old/screenshots/presentazione Vittorio/` has a
   counterpart screen.
2. **Data: frontend-only, enriched hand-written mocks.** No backend. Fixture values are
   hand-transcribed from the Saturno/Pozzetto data in `old/db/it-jtime-condominium.all.sql` for
   realism. No dump-parsing script; no live Postgres dependency.
3. **Interactivity: working on mock state.** Wizards have real forms (legacy fields + validators),
   toolbars perform CRUD, inline editors commit — all mutating in-memory mock streams. A registered
   invoice appears in Giornale; an incasso updates Versato. Refresh resets (no persistence).
4. **Mutation architecture: stateful store behind the existing port.** `MockDataSource` becomes a
   BehaviorSubject-backed in-memory store with command methods on the same port the runtime already
   consumes. No command bus; no per-section local state. The future real-API adapter replaces one
   file.

### Out of scope (unchanged)

Real backend/persistence/auth; PDF & report generation (buttons → "not in prototype" toast); real
file upload (file tabs list mock names only); the legacy Assemblee module (commented out in Flex
too); real accounting math (naive recompute behind a port — the real engine arrives with
`@cl/domain`).

---

## 2. Baseline (audit of 2026-06-11)

All 6 sections render with Saturno/Pozzetto fixtures; selection cascade, TreeTable, detail tabs,
tokens/theming, and runtime isolation all work. Gaps:

| Section | Gaps to close |
|---|---|
| Dati | 6 money columns missing (Liquidità, Fondi, Preventivo, Consuntivo, Saldo prec., Tot. dovuto); Fornitori tab has no toolbar; no F24/Documenti tabs; dialogs absent |
| Unità | No "Raggruppa righe per" selector; no add/edit dialogs (unit, gruppo, condòmino, subentro) |
| Tabelle | Coefficient grid is raw HTML; no Competenza column, tables-pane toolbar, or rounding row |
| Conti | Mastrino tab is a text stub; R/d, Tabelle di riparto, Restr. competenza columns missing; no search / "Nascondi conti vuoti"; no inline preventivo edit; no account dialogs |
| Giornale | No expandable transaction rows; no paging; 3 wizards are step-header shells with no forms; Partita column missing |
| Rate | Installment cells read-only; no locked/rounded flags; wizard is a shell |
| Cross-cutting | Toolbar buttons presentation-only; only inline editor is a plain number input; `WizardDialog` has no step machinery; Calendario/Anagrafiche are labeled stubs |

Reference inventory of the legacy feature surface: Flex views under `old/flex/src/it/jtime/`, PHP
RPC surface under `old/flex/php/services/it/jtime/condominium/` (DAOs: Condominium, Unit,
Installment, DistributionTable, Accounting, MasterData, Calendar + report DAOs).

---

## 3. Part 1 — Data layer & shared infrastructure (build first)

Every section gap traces back to one of these four foundations.

### 3.1 Stateful mock store

`MockDataSource` is rebuilt around an in-memory store: one `BehaviorSubject` per collection
(condominiums+periods, unit tree, distribution tables, accounts, transactions+invoices,
installments, anagrafiche, calendar events, F24s, files), initialized from fixtures. Existing read
streams become derivations over the subjects — current consumers keep working unchanged.

Command methods join the same port:

- Domain flows: `registerInvoice`, `recordTaking` (incasso), `openBalances` (saldi iniziali),
  `addTransaction` (scrittura), `payWithholding`, `createInstallments`, `setInstallmentAmount`,
  `setCoefficient`, `setPreventivo`.
- Generic CRUD: add/edit/remove for condominium, accounting period, unit, unit group, resident
  (incl. subentro = end-date + successor), supplier link, distribution table (+items), ledger
  account (+ expense variant), anagrafica (person/company), calendar event, F24.

Commands validate (ported Flex validators as pure functions), mutate the subjects, and let the
existing derived streams propagate — the selection cascade updates every open section.

### 3.2 Derived-value recompute (`recompute/` behind a port)

Pre-computed fixture totals become naive pure functions behind the `AllocationPreview`-style port,
replaced later by `@cl/domain`:

- Account balances (Dare/Avere/Saldo, group roll-ups) derived from transactions.
- Riparto split: expense accounts × coefficients, **largest-remainder rounding** with an explicit
  rounding row (the Pozzetto "arrotondamento" screenshots `12`,`13`).
- Installment distribution: total preventivo × coefficient share ÷ N rate, remainder redistribution
  on manual override; Versato/settled state from incassi.
- Condominium-level aggregates for the Dati grid (Liquidità, Fondi, Preventivo, Consuntivo,
  Saldo prec., Tot. dovuto).

### 3.3 Richer fixtures

Hand-transcribed from the SQL dump: real account names, coefficient sets summing to 1000, journal
entries that balance, installments consistent with the riparto. New fixture entities: anagrafiche
(persons + companies with categories), calendar events (scadenze tied to the fixture periods: rate
expiries, F24 deadlines), F24s, file name lists.

### 3.4 Form & editor primitives

- **Inline editors** for `TreeTable`: `MoneyInput`, `CoefficientInput` (4-decimal), `ComboBox`,
  `DateField` — joining `InlineNumber`; token-styled; commit/cancel semantics as today
  (double-click, Enter/blur/Esc).
- **WizardDialog step machinery**: per-step field rendering, next/back with per-step validation,
  review-step pattern, `onSubmit` → store command.
- **Form controls** shared by wizards, dialogs, and detail panels: `TextInput`, `Select`,
  `DateField`, `MoneyField`, `CheckboxField`, nested address/bank field groups.
- **ActionToolbar wiring**: Add/Edit/Remove open the right dialog for the section's selection;
  Print/PDF/Excel → toast stub; Refresh re-emits.
- **New shared controls**: paging bar (first/prev/next/last + "pagina X di Y"), search box,
  boolean toolbar toggle ("Nascondi conti vuoti"), regroup selector.

---

## 4. Part 2 — Completing the six Condomini sections

Reference screenshots per section as in the 2026-06-07 spec §2.3.

### 4.1 Dati Condominio & Fornitori (`02`,`03`)
- Add the six money columns to the condominium/period tree, fed by recompute.
- Fornitori tab toolbar: add (pick from anagrafiche via ComboBox dialog), remove.
- Dialogs: Add/Edit Condominium (name, code, status, tipo, address group, tax code, manufacture
  date, land registry, bank/IBAN group, notes), Add Accounting Period.
- New detail tabs from legacy: **F24** (list + status, mock add/edit), **Documenti**
  (public/private file lists, names only).

### 4.2 Unità, Condòmini & Bilancio Personale (`04`–`09`)
- "Raggruppa righe per" selector: Per unità / Per gruppo / Per condòmino — regroups the tree.
- Dialogs: Add/Edit Unit (code, floor, interno, subalterno, tipo, restricted period, land registry,
  notes), Add Gruppo, Add Condòmino (person from anagrafiche; ownership %, role, priority, dates),
  Subentro wizard (end-date current resident + add successor).

### 4.3 Tabelle Millesimali & Riparto (`10`–`16`,`47`,`48`)
- Coefficient grid → `TreeTable` + `CoefficientInput` (replaces raw HTML), Competenza column added.
- Tables-pane toolbar: add/edit/delete table, add/remove coefficient row.
- Riparto grid: rounding row + collapsible boxes (`47`); coefficient edits re-run recompute live.

### 4.4 Conti, Mastrini & Bilancio (`17`–`25`)
- **Mastrino tab implemented**: selected account's entries — Data, Descrizione, Dare, Avere,
  running Saldo — from the transaction store.
- Columns added: R/d, Tabelle di riparto, Restr. competenza. Search box + "Nascondi conti vuoti".
- Inline preventivo edit on expense accounts (`23`).
- Dialogs: Add/Edit account; expense-account variant with distribution-table mapping + role rules
  (`24`,`25`); "Configura conti funzionali" (`19`).

### 4.5 Libro Giornale & Prima Nota (`26`–`33`)
- Expandable transaction rows (entries as child rows in-grid); paging; Partita column.
- Wizard forms (all submit to store commands):
  - **Registrazione Fattura**: supplier ComboBox → invoice no./date/amounts → ritenuta/IVA
    computed → expense-account pick → review → posts balanced transaction + invoice record.
  - **Incasso**: resident pick → outstanding installments table (checkboxes) → liquid-asset
    account → review → settles items, bumps Versato.
  - **Saldi iniziali**: balanced opening entries with live Dare=Avere check.
  - **Scrittura contabile** (plain transaction) and **Pagamento ritenuta** (new, simple).

### 4.6 Prospetto Rate (`34`,`35`)
- Installment cells → inline `MoneyInput`; locked/rounded flags rendered; manual override calls
  `setInstallmentAmount` with remainder redistribution.
- **Crea rate da preventivo** wizard: count + cadence + first expiry → distribution preview from
  coefficients → review → creates the installment set.
- Edit Installment dialog: Locked checkbox disables Name/Type/ExpiryDate (legacy behavior).

---

## 5. Part 3 — New modules

### 5.1 Calendario (`01`; Flex `Calendar.mxml`)
Replaces `CalendarioStub`. Same runtime, new module slice (`calendarEvents$(range)` + commands).
- **Month grid**: custom CSS-grid component (~42 day cells), events as colored chips by layer,
  weekend/today tinting, day selection.
- **Right panel** (vertical split): day list (Ora, Descrizione, Stato, Priorità for selected day);
  event-details form below (Descrizione, Data, Calendario/layer, Stato, Priorità, Note).
- **Toolbar**: month prev/next + month/year picker; add/edit/delete event dialog (same fields);
  Competenza/Tutte filter.
- Fixtures: scadenze tied to Saturno/Pozzetto periods (rate expiries, F24 deadlines) so
  cross-module data reads true.

### 5.2 Anagrafiche (`50`; Flex `MasterData.mxml`)
Replaces `AnagraficheStub`. Three-zone layout:
- **Left sidebar**: Filtro (text search, tipo Persona/Azienda, condominio) + Categorie list with
  counts (click filters). Search + category compose as one derived stream.
- **Main grid** with paging: Nominativo/Ragione sociale, Categoria, Tipo icon, Stato, Indirizzo,
  Partita IVA/Cod. fiscale.
- **Detail tabs**: *Dettagli Anagrafica* (person vs company field card), *Anagrafiche Condomini*
  (cross-refs: where this person is supplier/resident, read from store).
- **Toolbar**: Add Persona / Add Azienda dialogs (legacy field sets incl. nested address + bank),
  edit, delete.

### 5.3 Runtime additions
`createAppRuntime` gains `calendar` and `anagrafiche` slices, and promotes per-section row
selection (`useSelectedRow(section)` / `selectRow(section, ref)`) from section-local `useState`
into the port, as the original spec §4 intended.

---

## 6. Testing

Extends the existing RTL suite, same style; suite stays green throughout.

- **Section interaction tests**: regroup selector regroups; coefficient edit updates riparto +
  rounding row; invoice wizard end-to-end mutates the Giornale grid; **incasso settles an
  installment and updates Versato in Unità** (the cross-section cascade test); Giornale paging;
  Conti search/hide-empty; Mastrino shows entries; Rate inline edit redistributes; calendar
  add-event appears in the month cell; anagrafiche search + category filter.
- **Recompute unit tests**: balance derivation, largest-remainder rounding, installment
  distribution & redistribution.
- **Store command unit tests** via the port (validation failures included).
- Target: every command and every inline editor has at least one test.

---

## 7. Delivery

Feature branch `feat/prototype-complete`, small per-slice commits, dependency order:

1. Part 1 foundations (store, recompute, fixtures, editors/wizard machinery).
2. Sections in audit-severity order: Giornale → Conti → Rate → Tabelle → Dati → Unità.
3. Calendario, then Anagrafiche.
4. Fixture-enrichment pass from the dump; final side-by-side screenshot pass.

### Success criteria
- Every screenshot in `presentazione Vittorio/` has a recognizable, modernized counterpart.
- A demo can run end-to-end on mock state: register an invoice, take an incasso, create rate,
  edit a coefficient — and watch the dependent sections update.
- All toolbar buttons do something (action or honest stub toast); no empty wizard.
- Test suite green; runtime isolation preserved (no singletons).
