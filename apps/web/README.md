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
- Data: `src/mock/MockStore.ts` — stateful in-memory store (BehaviorSubjects) behind the
  `MockDataSource` port: reads are derivations, commands mutate immutably and propagate through
  the selection cascade. Derived values recompute in `src/recompute/` (largest-remainder
  rounding) — the naive stand-in for the future `@cl/domain` engine.

## Section capabilities (Plan 2)

- **Giornale** — in-grid entry rows, Partita column, paging; 5 working wizards: fattura,
  incasso, saldi iniziali, scrittura libera, pagamento ritenuta.
- **Conti** — mastrino with running saldo; R/d + riparto-table + competenza columns; search &
  hide-empty toggle; inline preventivo edit; account dialog and conti-funzionali dialog.
- **Rate** — inline rata editing with override markers and lock flags; modifica-rata dialog;
  crea-rate-da-preventivo wizard with overwrite warning.
- **Tabelle** — store-backed coefficient grid with live riparto recompute; table/coefficient
  CRUD dialogs; arrotondamento row.
- **Dati** — six live money aggregates (periodSummaries); condominium, gestione, fornitori,
  and F24 dialogs; F24 tab and Documenti tab.
- **Unità** — raggruppa-righe-per selector; unit, gruppo, and condòmino dialogs; subentro
  wizard (end-dates outgoing resident, adds successor).

Cross-cutting: per-section row selection tracked in the runtime; every toolbar button either
performs its action or shows an honest stub toast — no silent no-ops.

## Calendario (Plan 3)

Studio-wide agenda replacing the former stub (legacy `Calendar.mxml`):

- **Month grid** — 6 fixed weeks, Monday-first; events as chips coloured by calendar layer
  (Scadenze / Assemblee / Manutenzioni / Studio); weekend, today and selected-day tinting.
- **Right panel** — per-day list (Ora, Descrizione, Stato, Priorità) and a read-only
  "Dettagli scadenza" card for the selected event.
- **Toolbar** — Aggiungi / Modifica / Rimuovi scadenza (add/edit via single-step dialog with
  veto-close on errors), month prev/next plus Mese/Anno selects, and the
  Tutte/Competenza filter (Competenza = only events linked to the accounting period
  currently selected in Condomini).
- **Fixtures read true across modules** — calendar dates mirror the F24 deadlines (Dati)
  and the installment expiries (Rate); `fixtures.test.ts` guards the alignment.
- Default visible month is **April 2011** (the fixture era's richest month) — a real
  adapter would default to the current month.

## Anagrafiche (Plan 4)

Registro unico dello studio (legacy MasterData), non legato alla selezione del condominio:

- **Sidebar filtro** — parola chiave (nominativo, codice, CF, P.IVA, indirizzo), tipo
  (Persone fisiche / Società), stato (Attive / Archiviate) e l'elenco «Categorie Anagrafiche»
  con i conteggi; i filtri si compongono in un unico stream derivato nel runtime.
- **Elenco** — colonne legacy (Nominativo/Ragione Sociale, Codice, Tipo, Stato, Indirizzo,
  CF, P.IVA, Categoria), ordinato per nominativo, con paginazione (10/20/50 righe).
- **Dettaglio** — tab «Dettagli Anagrafica» (scheda persona o società, coordinate bancarie,
  note) e «Anagrafiche Condomini» (incroci derivati: dove l'anagrafica è fornitore o condòmino).
- **CRUD** — Aggiungi Persona / Aggiungi Azienda / Modifica / Rimuovi; id deterministici
  (slug + suffisso), validazione categoria nel mock store.
- Il dialog «Aggiungi Fornitore» dei Condomini ora pesca dalle società del registro (via port).

## Dati reali (generated dataset)

L'app in esecuzione usa `src/mock/data.generated.json`, prodotto dal generatore a partire dal dump
MySQL legacy `old/db/it-jtime-condominium.all.sql` (48 MB). Il JSON è committato: build e CI non
richiedono mai il dump originale.

**Rigenerare:**
```bash
cd apps/web && pnpm gen:data
```

**Dataset:** 9 condomini reali (condomini di test/junk esclusi), 113 anagrafiche in 34 categorie,
12 eventi calendario.

**Separazione test / app in esecuzione:** i test usano il seed selezionato `fixtures.ts` (via
`createMockDataSource()` / `MockStore()` senza argomenti), così i conteggi restano stabili. L'app
in esecuzione passa il dataset generato via `createGeneratedDataSource()`, che istanzia lo stesso
`MockStore` con `generatedSeed`.

**Gate di riconciliazione:** un periodo espone la contabilità completa (libro giornale, riparto,
rate) solo se il suo saldo in partita doppia netta a zero (tolleranza ±1 centesimo); altrimenti
viene pubblicato come «solo struttura» (unità, residenti, dettaglio, anagrafiche, calendario) con
contabilità vuota — dati veritieri, mai numeri errati.

**Libri completi:** solo **Saturno 2011** e **Pozzetto 2013** hanno scritture contabili caricate e
bilancio quadrato. Tutti gli altri edifici/periodi reali sono struttura-only by design: il dump
legacy non contiene scritture contabili pubblicate per essi.

**Motore di distribuzione (riparto):** per ogni conto spesa, il totale del sottoalbero viene
ripartito sulle unità in base ai coefficienti di tabella: split percentuale multi-tabella, tabelle
`estimate` vs `currentBalance`, suddivisione proprietario/inquilino. I valori di preventivo e
consuntivo per unità vengono così ricostruiti fedeli ai totali di conto.

## Parità con il legacy (screenshot pass)

Riferimento: `old/screenshots/presentazione Vittorio/`. Ogni schermata ha un corrispettivo
modernizzato; le stampe/PDF restano stub dichiarati (fuori scope da spec).

| Screenshot | Corrispettivo nel prototipo |
|---|---|
| 01 calendario | Modulo Calendario: griglia mese, pannello giorno, CRUD scadenze, filtro Competenza |
| 02 dati condominio — scheda | Condomini → Dati: scheda + colonne economiche (Liquidità…Tot. dovuto) |
| 03 dati condominio — fornitori | Condomini → Dati, tab Fornitori (aggiungi da anagrafiche / rimuovi) |
| 04 unità — scheda | Condomini → Unità: albero unità + scheda |
| 05–07 unità — condomini add/edit | Dialoghi Aggiungi/Modifica Condòmino |
| 08 subentri | Wizard Subentro (chiusura + successore) |
| 09 gerarchia condominio | Selettore «Raggruppa righe per» |
| 10–15 tabelle — riparto prev./cons. | Condomini → Tabelle: griglie riparto con riga arrotondamento |
| 16 edit inline coefficienti | InlineNumber inline con ricalcolo live |
| 17 conti — scheda | Condomini → Conti: albero con R/d, Tabelle, Restr. competenza |
| 18 conti — mastrino | Tab Mastrino (Data, Descrizione, Dare, Avere, Saldo progressivo running balance) |
| 19 configura conti funzionali | Dialogo «Configura Conti Funzionali» |
| 20 stampe bilanci | Stub dichiarato (toast «Non disponibile nel prototipo») |
| 21–22 conti patrimoniali / costi-ricavi | Stesso albero Conti (raggruppamenti fixture) |
| 23 editing inline preventivo | Edit inline Preventivo sui conti spesa |
| 24–25 specifica conto di costi | Dialogo conto spesa con mappatura tabelle |
| 26 libro giornale | Condomini → Giornale: righe espandibili, paginazione, colonna Partita |
| 27–28 inserimento fattura | Wizard Registrazione Fattura |
| 29 / 39 saldi iniziali | Wizard Saldi Iniziali (quadratura live) |
| 30 scritture contabili | Wizard Scrittura Contabile |
| 31–33 incasso | Wizard Incasso (rate aperte → conto liquidità → Versato) |
| 34–35 rate | Condomini → Rate: edit inline, flag bloccata, wizard Crea Rate |
| 36–38, 40–46, 48 ritagli | Dettagli delle stesse schermate Conti/Tabelle/Giornale |
| 47 riparto — box collassato | Righe gruppo collassabili (chevron) nella griglia riparto |
| 50 anagrafiche — tutto | Modulo Anagrafiche (questo piano) |
