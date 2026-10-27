# CondoLedger app v2 — design

Date: 2026-10-11. Status: approved in conversation, pending written review.

## Intent

Build the real CondoLedger web app from the design handoff in
`docs/design/web/v1` (the HTML prototype `Condomini.dc.html` is the visual
and behavioural spec; `README.md` there lists every screen, dialog and
wizard), on the architecture the `bettersoftware-skills` plugin enforces:
ports and adapters, a domain / core / bindings / client split, gates run by
code. The two datasets in the handoff, Saturno 2011 and Pozzetto 2013, must
reconcile against `docs/design/web/v1/reports/`.

Two later stages are named so nothing here paints them in: a Node + Postgres
server implementing the same ports, and a React Native app for **both**
audiences — the administrator on the go and owners in self-service.

What this replaces: `apps/web`, the first attempt (Radix + react-rxjs,
frozen at Phase 1b-2b on 2026-06-19). It is archived, not ported. Three
things carry forward from it: the riparto/recompute engine (already in
`@cl/domain`), the `tools/gen` generator with its Gherkin-over-dump parity
specs (the oracle), and `data.generated.json` as the simulator's seed.

What already exists and is reused whole: `packages/db` — the legacy MySQL
schema translated to Drizzle/Postgres (94 tables, 23 enums, 6 views) with an
ETL that seeds Postgres from the dumps in `old/db` at row-count parity and
0 FK orphans, 127 tests, on `main`.

## Decisions taken

| Decision | Choice | Why |
|---|---|---|
| Where the app lives | This repo, restructured on branch `feat/app-v2` | Keeps the engine's history, the data, the docs and the DB migration in one tree; gates cover everything |
| How the starter gets in | `create-project.mts` into a scratch folder, proven green there, merged by hand with a log | The creation skill refuses a non-empty folder; the log becomes the spec for a skill improvement (see Follow-ups) |
| Build strategy | Vertical slice first: one screen through every layer, then widen | Ports designed without a consumer are wrong in the details; gates catch drift from day one |
| What ports carry | Raw period state; derivation (allocation, balances, installment status) runs in core via domain use cases | Simulator and Postgres adapter only supply state; the engine runs identically on both |
| Principal | Ports are built once per session for a `Principal` (`administrator` or `owner`); nothing takes a principal per call | Owner self-service becomes other port *implementations*, not a parallel API |
| Mobile audience | Both roles | Domain carries the principal now; the permission model (the design's *Linked Accounts* grid) arrives with M4 |
| Money | `Cents` as a branded integer | The handoff: store cents as integers; the UI renders `1,234.56` |

## Section 1 — repo restructure (M0)

Starting point: commit what is pending on `main` (`.gitignore`,
`.claude/settings.json`, `docs/design/`, this spec), then branch.

Create the starter in scratch and prove it before touching the repo:

```bash
node <plugin>/scripts/create-project.mts <scratch> --scope @cl --name condo-ledger
cd <scratch> && git init && pnpm install && pnpm gate:full:quiet
```

A red gate here is the starter's fault and stops the work. Then merge:

| From the starter | Into the repo | Note |
|---|---|---|
| root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `tsconfig.tooling.json`, `turbo.json`, `eslint.config.mts`, `architecture.config.mts`, `AGENTS.md`, `CLAUDE.md`, `tools/`, `.github/`, `.claude/settings.json` (hooks merged into ours, `enabledPlugins` and `extraKnownMarketplaces` kept) | root | Replaces ours. `pnpm-workspace.yaml` loses `apps/*`. `packageManager` becomes `pnpm@12.6.0+sha512…`; Corepack switches per repo |
| `packages/domain` | merged into the existing `packages/domain` | Starter layout `entities/ ports/ simulators/ useCases/`; our `money`, `allocate`, `riparto/` move into `entities/` and `useCases/`. The price-list sample is deleted |
| `packages/shared`, `client-core`, `react-bindings`, `client-react`, `server`, `integration` | new | The price-list sample stays through M0 (it proves the scaffolding and is what `AGENTS.md` points at); M1 replaces it pattern by pattern; the scaffolding stays (`createViewModel`, `useMachine`, `ViewModelProvider`, `createAppHarness`, `composition.ts`, `startApp.tsx`, `buildPorts.ts`) |
| — | `packages/db` stays | Role **`leaf`**: it imports no workspace package; `server` imports it. `scripts/reset.mjs` → `reset.mts`; `tsx` dropped, Node runs TypeScript |
| — | `packages/application` deleted | Its `ports.ts` was the prototype's god-port; new ports are written per area in domain words |
| — | `apps/web` → `old/prototype-web/` | Out of the workspace, history intact |
| — | `apps/web/tools/gen` → `packages/legacy-import` | Role **`server`** (Node-side; may import `domain` and the `db` leaf). Holds the generator and the parity specs; emits the simulator seed |

Package scope stays `@cl`.

Green at the end of M0 means `pnpm gate:full:quiet` passes with no app
screens: the domain engine, `db`, `legacy-import`, and empty-but-wired
client packages. Two commits: the mechanical move, then the add-ons, so each
is its own diff.

Add-ons chosen before any feature: `format-lint`, `strict-lint`, `coverage`,
`ci-security:dependabot`, and `visual` (pixel-close is the brief; goldens
from the first screen). `e2e` waits for M3. `performance` and `repo-hygiene`
are not planned.

Every file merged, every collision and what was done with it is logged in
`docs/superpowers/notes/2026-10-11-m0-merge-log.md` during M0.

## Section 2 — layers and ports

### Domain (`packages/domain`)

- Entities in the design's vocabulary: Building, Period, Unit, UnitGroup,
  Owner (with ownership span and share), ThousandthTable, Coefficient,
  Account (type, nature, budget, flags), JournalEntry, Posting, Installment,
  Payment, Supplier, Contact, ContactCategory, CalendarLayer,
  CalendarEvent, Firm, Principal.
- `Cents` branded integer; formatting is not here (it is UI).
- Use cases: the existing engine (`computeRiparto`, `recomputePeriod`,
  `computeInstallments`, `computeBalances`), ledger running balance, and
  pure validators shared by wizard machines and port implementations: an
  entry must balance, invoice withholding maths, installment settlement
  oldest-first.
- Ports, contracts in `ports/__contracts__`, simulators in `simulators/`.

### Ports

One per bounded area. Reads are `Observable`s; commands are functions
returning `Promise<Ok | Rejected>` where `Rejected` carries a domain reason.
Ports carry raw period state, not derived views.

| Port | Reads | Commands |
|---|---|---|
| `SessionPort` | the signed-in principal, firm, preferences (theme, mode, language) | set preference |
| `BuildingsPort` | buildings tree with periods, building profile, suppliers | edit building, edit period, add/remove supplier |
| `UnitsPort` | groups, units, owners with ownership spans for a period | edit unit, edit group, add/edit owner |
| `TablesPort` | thousandth tables and coefficients | edit table, set coefficient |
| `AccountsPort` | chart of accounts with budgets and flags, functional account roles | edit account, set budget, configure functional accounts |
| `JournalPort` | entries with postings | the ten wizards as commands, delete entry |
| `InstallmentsPort` | installment plans and payments | create installments, set amount |
| `ContactsPort` | contacts, categories, connected contacts, linked accounts | edit person, edit company, edit contact row |
| `CalendarPort` | layers, events | add, edit, remove deadline |

Ports are built once per session in the composition root for a
`Principal`. A simulator throws on an unknown id; it never returns empty for
a wrong key.

### Core (`packages/client-core`)

- A presenter per screen combines port streams with the selected
  building/period and runs the engine. First: `buildingsPresenter` (tree,
  selected period), `accountsPresenter` (accounts tree with
  Debit/Credit/Balance/Budget per node, selected account, its ledger with
  running balance and total).
- State machines for per-component state: tree expand/collapse (with
  expand-all/collapse-all), selection, split ratio, column widths, bottom
  tab, maximize, drawer, and every wizard's steps (step validity decides
  `Next`).
- `composition.ts` wires ports → presenters; `testing/appHarness.ts`
  composes it with simulators for tests. Only that file calls `createApp`.
- Adapters for the real server arrive in M3 under `adapters/`.

### Bindings (`packages/react-bindings`)

The view model: one hook per presenter output and per machine. Imports
`react` only, never `react-dom`, so a React Native client mounts it
unchanged. No `useMemo`, `useCallback`, `memo` (lint-enforced).

### Client (`packages/client-react`)

- `src/app`: `buildPorts` picks simulators (`pnpm dev`) or server adapters by
  env; `startApp` mounts the provider.
- `src/ui`: shell (`TopBar`, `Breadcrumb`, `Sidebar`, `Splitter`), primitives
  from the handoff (`Panel`, `TabbedPanel`, `Toolbar`, `TreeGrid`, `Money`,
  `Scheda`, `Field`, `Dialog`), screens. CSS Modules over the handoff's
  `tokens.css`; IBM Plex Sans/Mono; lucide icons per the handoff's mapping.
- A thin component reads hooks by name from the view model and hands plain
  props to compiled dumb components. No `style={{}}`; no RxJS, storage,
  fetch or timers in `ui`.
- `testids.ts` is the only source of test ids; page objects are the only
  files that touch Testing Library.

### Server, db, legacy-import

`packages/server` (role server), `packages/db` (leaf) and
`packages/legacy-import` (server) exist from M0. The server implements the
nine ports in M3; `legacy-import` emits the simulator seed from the dumps in
M0 so M1 and M3 reconcile against the same oracle.

### Errors

A command returns `Ok | Rejected(reason)` from domain validation; the UI
shows the reason inline (the handoff's `--neg` validation message). A port
failure (network, M3) surfaces on an error stream the shell renders as a
toast. Toolbar buttons that are not yet wired show a toast stub rather than
doing nothing (the prototype's convention, kept).

## Section 3 — the first slice (M1)

Goal: app shell + Buildings sidebar + *Accounts, Ledgers & Balance* on the
simulator seeded with Pozzetto 2013, reconciling to
`docs/design/web/v1/reports/pozzetto/acc.json`.

In:

- Shell: top bar (logo, account/profile/firm line, light/dark + theme +
  language controls, module tabs), breadcrumb, Buildings sidebar (*Select
  Management* tree, *Management Menu*), vertical splitter, compact mode
  (< 1180px) with drawer and scrim. Other module tabs and menu items render
  a placeholder panel.
- Ports: `SessionPort`, `BuildingsPort` (tree and selection), `AccountsPort`,
  `JournalPort` reads only (the ledger is postings filtered by account),
  each with contract and simulator.
- Core: `buildingsPresenter`, `accountsPresenter`; machines for tree,
  selection, split ratio, column widths, bottom tab, maximize, drawer.
- UI: `Panel`, `TabbedPanel`, `Toolbar`, `TreeGrid` (CSS-grid rows, sticky
  header, resizable columns, carets, selected row, sticky footer), `Money`,
  `Scheda` with fieldsets; the Accounts screen with its grid, the *Account
  Details* scheda and the *Ledger* tab. Search and "Hide empty accounts"
  are real. `+ ✎ −`, print menu and ⚙ show the toast stub. Budget inline
  edit is in: the one command, exercising the write path.
- Seed: `legacy-import` emits Pozzetto 2013; `acc.json` is the assertion
  target.

Out: the other six screens, every dialog and wizard, Calendar, Contacts,
the server, visual verification of themes other than slate (the token file
ships all three × light/dark).

Build order, each step green before the next:

1. `tokens.css`, fonts, `Money`, `Panel`, with visual goldens.
2. `AccountsPort` + contract + simulator; `accountsPresenter` asserted in
   the harness against `acc.json` totals.
3. `TreeGrid` with its page object, driven by static props.
4. Accounts screen on the view model; shell and sidebar around it.
5. Budget inline edit end to end; compact mode; goldens for the screen at
   1280 and 1100 wide, slate light and dark.

Two design choices are prepared with context and handed to the user to
write (5–10 lines each): the `AccountsPort` read shape (tree with per-node
balances vs flat accounts + postings with the tree derived in core) and the
ledger running-balance rule in `accountsPresenter`.

## Section 4 — testing

| Tier | Where | Proves | Runs in |
|---|---|---|---|
| Contract | `domain/src/ports/__contracts__`, run by every simulator and later every server adapter | each implementation of a port behaves the same | `gate:full`; the `port-contracts` gate fails an adapter folder that skips one |
| Engine parity | `domain` use-case tests; `legacy-import` Gherkin-over-dump specs | riparto, balances, installments match the dump; M2e's allocation reproduces both periods ([spec](2026-10-26-m2e-tables-allocation-design.md)); the posted A04 lines were typed by hand | `gate:full` |
| Presenter | `client-core` on `createAppHarness`, fake timers | Accounts totals, running balance, selection against `acc.json`; wizard machines step by step | `gate:full` |
| UI | `client-react` page objects + `visual` goldens | a component renders its props and fires its intents; the screen is pixel-close | page tests in `gate:full`; goldens in the visual workflow |

Rules: test ids only from `testids.ts`; page objects only touch Testing
Library; a number in a UI test comes from the page object; no test sleeps;
goldens are starting files; the `coverage` add-on's per-file floor applies.
`packages/integration` is declared and empty until M3; `e2e` arrives with
M3.

## Section 5 — milestones

| | Milestone | Done when |
|---|---|---|
| M0 | Restructure | `gate:full` green on the merged starter, sample feature removed, `db` leaf, `legacy-import` emitting the seed, `apps/web` archived, add-ons in; merge log written |
| M1 | First slice | Accounts screen reconciles to `acc.json`; goldens committed; budget edit round-trips |
| M2 | Widen | Remaining screens in the handoff's order: Journal + ten wizards → Installments → Tables & Allocation → Building Data & Units → Contacts → Calendar; one spec per group; Saturno 2011 joins the seed at Tables & Allocation |
| M3 | Server | `packages/server` on Node + Postgres over `db`; nine ports as adapters against the ETL-seeded database; `shared` wire protocol; `integration` and `e2e` on. Deferred to that spec: legacy tables as-is vs domain-shaped tables fed from them |
| M4 | Owners + React Native | Owner-scoped port implementations; `packages/client-native` as a second `client`-role package on the same bindings; permission model from the *Linked Accounts* grid |

This spec covers M0 and M1 in full. M2–M4 get their own specs.

## Risks

- Toolchain jump (TypeScript 6/7 native, ESLint 10, Vite 8, React 19 +
  Compiler, pnpm 12): M0 proves the untouched starter green before the
  merge, so a red gate afterwards is ours.
- `TreeGrid` is built for one screen in M1; Journal's expandable posting
  rows in M2 test whether its API generalises. Budget a reshaping there.
- Per-session UI state (`gcols`, `maxP`, split ratios) belongs in machines,
  never in `SessionPort`.
- Plugin version is pinned by install (`bb28b9341029`); a later plugin
  update is applied through `add-to-project.mts`, never by hand.

## Follow-ups

- **Skill: `starter` unit for `add-to-project.mts`** (bettersoftware-io/skills).
  Installs the seven starter packages as starting files into a repo that
  already has a project, with `architecture.packages` entries and root
  scripts merged, collisions listed under "Still to do by hand".
  `creating-a-project` keeps its empty-folder rule; `extending-a-project`
  gains "adopt the starter". The M0 merge log is the unit's fixture.
- Ratification items left open by the DB migration (studio backfill,
  country-code case, `post_code.code` unique, bank registry not loaded) are
  decided in the M3 spec.
