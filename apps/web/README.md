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
