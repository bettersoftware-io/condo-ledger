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
