# M1 — Accounts, Ledgers & Balance slice — design

Date: 2026-10-12. Status: implemented on feat/m1-accounts (2026-10-13).

Parent spec: `docs/superpowers/specs/2026-10-11-app-v2-design.md`, whose
Section 3 names this slice. This document is the detail that section left to
the plan, plus what the surveys of 2026-10-12 found that the parent did not
know. Where the two differ, this one wins for M1; the parent's decisions table
stays in force.

## Goal

The app shell, the Buildings sidebar and the *Accounts, Ledgers & Balance*
screen, running on in-memory simulators seeded with the pseudonymised legacy
data, with every node of the Pozzetto 2013 chart of accounts reconciling to
the design's oracle `docs/design/web/v1/reports/pozzetto/acc.json`. Done
when: the reconciliation test passes against a committed fixture, the fixture
is proven against the local oracle, the budget edit round-trips through a
port command, and the goldens are committed.

## What the surveys changed

| Found | Consequence |
|---|---|
| The oracle's tree has levels and rows the seed does not carry: Total › Patrimonial › (Assets) / (Liabilities), Costs, Revenue; one row per supplier and per owner under the three control accounts; gross debit and credit per node | The ports carry the raw facts that derivation needs (account nature and type, each posting's counterpart) and the core derives the tree. The generator emits those facts |
| The seed nets debit against credit on every leaf, and its groupings carry their own budget rather than a roll-up | Nothing in M1 reads the seed's precomputed account rows. Debit, credit, balance and budget roll up from postings and leaves in the core |
| The oracle's labels are English translations of the real names, so the file cannot be committed | The committed assertion target is a fixture of node keys and cents in the oracle's order. A local-only test proves the fixture against the oracle and skips, visibly, where the file is absent |
| The data is not translated (design README, *Interactions*) | The screen shows the seed's own Italian account names; only chrome strings are English |
| The visual tier fails any request that leaves its host | IBM Plex Sans and Mono are self-hosted from the `@fontsource` packages, never linked from Google Fonts |
| The prototype switched themes by writing inline variables; `tokens.css` keys on `data-theme` and `data-mode` | The shell's root element carries both attributes; no inline styles |
| The prototype's search, hide-empty, toast, ledger footer and ledger-per-account are drawn, not coded | Their behaviour is defined here, not lifted |
| The starter styles with one plain stylesheet and attribute selectors; the parent spec said CSS Modules | Plain stylesheets, one per component, classes prefixed with the component's name (`.panel-header`). No CSS Modules: nothing in the toolchain needs them and the visual host imports plain CSS |

## Seed

`packages/legacy-import` gains a second output beside `seed/data.generated.json`:
`packages/domain/src/simulators/seed/legacySeed.generated.ts`, a TypeScript
module exporting one constant of type `LegacySeed` (declared in the domain
beside it). The existing JSON stays as it is for the parity specs and is
retired in M2. The new file is written by the same `gen:data` run, after
pseudonymisation, and is excluded from Biome like the JSON.

Its content is what the four M1 ports read, for the two periods that have
books, Saturno 2011 (`p1`) and Pozzetto 2013 (`p36`):

```ts
export interface LegacySeed {
  buildings: Building[];        // with their periods; only buildings that have a period with books
  accounts: Account[];          // every account of those periods
  entries: JournalEntry[];      // every transaction with its postings
  parties: Party[];             // every supplier and owner a posting names
}
```

The generator keeps the counterpart of a posting (the dump's `masterDataId`
for a supplier, `unitResidentId` for an owner), the account's `kind` as
`nature` and its `type`, and the transaction's full timestamp.

## Domain

### Entities (`packages/domain/src/entities`)

```ts
export type Cents = number & { readonly __brand: "Cents" };   // integer minor units
export function cents(n: number): Cents;                       // throws unless integer

export interface Building { id: string; name: string; periods: Period[]; }
export interface Period { id: string; name: string; type: "ordinary" | "extra" | "auxiliary";
                          start: string; end: string; closed: boolean; }   // dates ISO yyyy-mm-dd

export type AccountNature = "assets" | "liabilities" | "assetsOrLiabilities" | "income" | "expenses";
export type AccountType = "grouping" | "regular" | "control" | "controlUnitResident";
export interface Account { id: string; periodId: string; parentId: string | null; name: string;
                           order: number; nature: AccountNature; type: AccountType; budget: Cents | null; }

export type Counterpart = { kind: "supplier"; id: string } | { kind: "owner"; id: string };
export interface Posting { accountId: string; debit: Cents; credit: Cents; counterpart: Counterpart | null; }
export interface JournalEntry { id: string; periodId: string; number: number; at: string;  // ISO date-time
                                description: string; postings: Posting[]; }

export type Party = { kind: "supplier"; id: string; name: string }
                  | { kind: "owner"; id: string; personId: string; name: string; unitCode: string };
// An owner party is one residency (the dump's unitResident): a person in a
// unit. personId groups the residencies of one person; name is the person's.

export interface Principal { username: string; displayName: string; role: "administrator" | "owner"; }
export interface Firm { name: string; }
export interface Preferences { mode: "light" | "dark"; theme: "slate" | "carbon" | "sage";
                               language: "en" | "it" | "fr" | "de" | "es"; }
```

The existing `Money` (`{ cents }`) stays for the riparto engine; M1 code
uses `Cents`. Unifying them is M2 work.

### Use cases (`packages/domain/src/useCases`)

**`buildAccountTree(accounts, entries, parties): AccountNode`** derives the
screen's tree for one period, in the legacy report's shape:

- Root `total`, then `patrimonial` holding `assets` and `liabilities`, then
  `costs` (nature `expenses`) and `revenue` (nature `income`). An account of
  nature `assets` goes under `assets`, `liabilities` under `liabilities`,
  whatever the sign of its balance. Top-level accounts keep their legacy
  order inside each level. Groupings nest as in the data.
- An account of nature `assetsOrLiabilities` (the three control accounts:
  suppliers, owners, roundings) appears under both `assets` and
  `liabilities`, each side holding the subsidiary rows whose balance has
  that sign (debit balance → assets, credit balance → liabilities; a zero
  balance → assets). A side that has no row is omitted. A `control`
  account groups its postings by supplier, one row per supplier. A
  `controlUnitResident` account groups by person (`personId`), one row
  per person, and under it one row per residency the person holds
  (labelled with the unit code), where the postings sit; a person's side
  is decided by the sum of their residencies. A `controlUnitResident`
  account of nature `expenses` (individual expenses) groups by person the
  same way under `costs`. Subsidiary rows are ordered by label.
- Every node carries `debit`, `credit`, `balance` and `budget`: debit and
  credit are the gross sums of the postings under the node, balance is
  debit minus credit, budget is the sum of the leaf budgets under the
  node, or `null` where no leaf has one.
- Node keys are deterministic and never shown: `total`, `patrimonial`,
  `assets`, `liabilities`, `costs`, `revenue`; an account's own id
  (`la154`); a supplier row `la157@assets/md17`; a person row
  `la158@assets/md104`; a residency row `la158@assets/md104/r162`. A
  control account's node carries its side: `la157@assets`,
  `la157@liabilities`.
- Labels: the account's name; a supplier's name; an owner's name; a unit's
  code. The five derived levels have fixed English labels (Total,
  Patrimonial, (Assets), (Liabilities), Costs, Revenue), the only account
  labels that are chrome.
- Icon hints are data for the UI, decided here: `folder` for any node with
  children, `document` for a leaf, and the special leaves by functional
  role of the account: `cash`, `bank`, `suppliers`, `owners`, `roundings`,
  `tax`. The nature travels with the node so the UI can tint folders.

**`ledgerOf(node, entries): Ledger`** returns the postings under a node in
`(at, number)` order, each with its running balance, plus totals:

```ts
export interface LedgerLine { entryId: string; at: string; number: number; description: string;
                              postingPath: string; debit: Cents; credit: Cents; balance: Cents; }
export interface Ledger { lines: LedgerLine[]; totalDebit: Cents; totalCredit: Cents; balance: Cents; }
```

The running balance is the cumulative debit minus credit, with no sign by
nature: that rule reproduces all 75 rows of the design's ledger and the
posting balances of every journal entry. A grouping node's ledger is the
union of its subtree's postings in the same order. `postingPath` is the
path of the node the posting belongs to, joined by ` › `.

**`validateBudget(account, cents): Ok | Rejected`**: a budget is accepted on
a leaf account of nature `expenses` when it is a non-negative integer; the
reasons are `not-a-cost-account`, `not-a-leaf`, `negative`.

**`must(value, what)`** replaces the M0 `must(value)`: the thrown message
names what was missing. `listFor` is unchanged. Both move to
`packages/domain/src/support/`.

### Ports (`packages/domain/src/ports`)

Each is an `interface`, has a contract in `__contracts__` that calls every
method, and a simulator in `simulators/` that runs it. Reads are
`Observable`s that replay the current value to a new subscriber; commands
return `Promise<Ok | Rejected>`:

```ts
export type Ok = { ok: true };
export type Rejected = { ok: false; reason: string };
```

| Port | Reads | Commands |
|---|---|---|
| `SessionPort` | `principal(): Observable<Principal>`, `firm(): Observable<Firm>`, `preferences(): Observable<Preferences>` | `setPreference(patch: Partial<Preferences>)` |
| `BuildingsPort` | `buildings(): Observable<Building[]>` | none in M1 |
| `AccountsPort` | `accounts(periodId): Observable<Account[]>`, `parties(periodId): Observable<Party[]>` | `setBudget(accountId, cents)` |
| `JournalPort` | `entries(periodId): Observable<JournalEntry[]>` | none in M1 |

A simulator is built from a `LegacySeed` (`createSessionSimulator(seedPrincipal)`,
`createBuildingsSimulator(seed)`, …) and throws on an unknown period or
account id. `setBudget` validates through `validateBudget` and, on `Ok`,
emits the updated accounts list. The session simulator's principal is the
design's invented administrator (`marco`, Ferrari Marco, Studio Ferrari).
Preferences start at slate, light, en.

The `PricePort`, its contract, simulator, use case and entities are deleted.

## Core (`packages/client-core`)

`createApp(ports: AppPorts): App` with `AppPorts = { session, buildings, accounts, journal }`:

```ts
export interface App {
  presenters: { session: SessionPresenter; buildings: BuildingsPresenter; accounts: AccountsPresenter };
  navigation: Machine<NavigationState, NavigationIntents>;   // one per app: module tab and menu item
  notices: Notices;                                          // one per app: the toast stream
  machines: {                                                // one per component that asks
    createAccountsGrid: () => Machine<AccountsGridState, AccountsGridIntents>;
    createColumns: (spec: ColumnSpec[]) => Machine<ColumnsState, ColumnsIntents>;
    createSplit: () => Machine<SplitState, SplitIntents>;
    createBottomTab: (tabs: readonly string[]) => Machine<BottomTabState, BottomTabIntents>;
    createMaximize: () => Machine<MaximizeState, MaximizeIntents>;
    createSidebar: () => Machine<SidebarState, SidebarIntents>;
  };
}
```

- **`sessionPresenter`**: `principal$`, `firm$`, `preferences$`; intents
  `setMode`, `setTheme`, `setLanguage` forward to the port.
- **`buildingsPresenter`**: `tree$` (buildings with periods), `selected$`
  (`{ buildingId, periodId }`, shared across screens, defaults to the
  first building's first period), intent `selectPeriod(periodId)`, which
  also resets the accounts selection to `total`.
- **`accountsPresenter`**: for the selected period, `tree$` from
  `buildAccountTree` over the three reads; `selectedKey$` (default
  `total`); `selectedNode$`; `ledger$` from `ledgerOf`; `details$` (the
  scheda's fields: path, type label, nature label, balances, system id);
  intents `select(key)`, `setBudget(accountId, cents): Promise<Ok | Rejected>`.
  Every stream is shared (`state`), built once per period change.
- **`accountsGridMachine(tree$)`** takes the presenter's tree as input and
  holds `expanded` (a set of keys, `total` and the five levels open at
  start), `search` and `hideEmpty`; its state carries `rows`, the visible
  rows in order with depth and `hasChildren`. Search matches on a node's
  label, case-insensitively, keeps every ancestor of a match and shows
  the matches expanded. Hide-empty drops a node whose debit, credit and
  budget are all zero or null and whose subtree is likewise. Intents:
  `toggle(key)`, `expandAll`, `collapseAll`, `setSearch`, `setHideEmpty`.
- **`columnsMachine(spec)`**: widths per column from a spec of
  `{ def, min, max, grow }`, intent `resize(index, px)` clamped to the
  spec; state carries the `gridTemplateColumns` string.
- **`splitMachine`**: ratio 0.5, clamped 0.2–0.8.
- **`bottomTabMachine(tabs)`**: the active tab name.
- **`maximizeMachine`**: which panel is maximized, `top`, `bottom` or none.
- **`sidebarMachine`**: `width` (272, clamped 180–440) and `open`
  (the drawer, false at start). Compact mode is CSS: below 1180px the
  sidebar is an overlay whose visibility is `open`; above, it is always
  shown and `open` is ignored.
- **`navigationMachine`**: `module` (`calendar` | `buildings` | `contacts`,
  default `buildings`) and `menu` (the six items, default `accounts` in
  M1). The other modules and items render a placeholder.
- **`notices`**: a shared stream of `{ id, text }` with `stub(label)`
  that posts `"${label}: not yet available"` and `clear(id)`; the port
  error stream named by the parent spec arrives with M3.
- The price presenter, selection machine and WebSocket price adapter are
  deleted. `wsConnection` stays: the server keeps one message.
- `testing/appHarness.ts` builds the app on the four simulators over the
  real seed, or over a seed the test passes, and exposes the ports so a
  test can deliver or read raw state.

## Shared and server

The sample's price protocol goes. `packages/shared` keeps `WS_PATH` and one
message, `{ type: "ready" }`, that the server sends when a client connects.
`packages/server` keeps `startServer({ port })` sending it; the integration
test proves a client adapter receives it. The nine ports arrive on the
server in M3.

## Bindings (`packages/react-bindings`)

`createViewModel(app)` exposes one hook per presenter stream and per
machine factory, plus `useNavigation` and `useNotices` for the shared
machines: `useSession`, `useBuildingsTree`, `useSelectedPeriod`,
`useAccountsTree`, `useSelectedAccount`, `useLedger`, `useAccountDetails`,
`useAccountsGrid`, `useColumns(spec)`, `useSplit`, `useBottomTab(tabs)`,
`useMaximize`, `useSidebar`. Intents come back on the same hook, as in the
starter's `MachineView`. The sample's `usePrices` and `useSelection` go.

## Client (`packages/client-react`)

### Styling

- `src/styles/tokens.css` is the handoff's file, unchanged; `fonts.css`
  imports the `@fontsource/ibm-plex-sans` (400, 500, 600, 700) and
  `@fontsource/ibm-plex-mono` (400, 500) weights. Both are imported from
  `index.css`, which also carries the global rules (`box-sizing`, the 11px
  scrollbar, the three keyframes).
- One stylesheet beside each component, imported by it, classes prefixed
  with the component's name. Values are the handoff's; where the prototype
  and the README differ, the prototype's code wins (maximize at .26s with
  ▢/❐, a 48px rail in compact mode, assets red and liabilities blue in the
  folder tint, bold on all four money columns of a node with children).
- Icons from `lucide-react` with the README's mapping; the PDF and XLS
  glyphs and the logo are inline SVG components.
- The root `<div class="app-root" data-theme data-mode>` carries the
  preferences; no code touches `document`.

### Components (`src/ui`)

Shell: `AppRoot` (thin: reads preferences and navigation), `TopBar`,
`ModuleTabs`, `Breadcrumb`, `Sidebar` with `BuildingsTree` and
`ManagementMenu`, `Rail`, `Splitter` (vertical and horizontal), `Drawer`
scrim, `ToastHost`, `Placeholder`.

Primitives: `Panel` (header, meta, maximize), `TabbedPanel`, `Toolbar`
(buttons, dividers, search box, checkbox), `TreeGrid` (CSS-grid rows,
sticky header, resizable columns from a `columnsMachine`, carets, indent
`8 + depth × 16`, selected row, optional sticky footer), `Money`
(en-US format `1,234.56`, `plain` and `emph` variants, colour by sign),
`Scheda` with `Fieldset` and `Row`, `InlineEditor` (commit on blur or
Enter, cancel on Escape).

Screen: `AccountsScreen` (thin), `AccountsGrid` (the 13 columns with the
prototype's widths; the eight attribute columns render their headers and
empty cells in M1, filled in M2 with Tables and account attributes),
`AccountDetails` (the scheda: path, type, nature, default contra and
period restriction as "None (uses parent account settings)", the cost
fieldsets with the prototype's placeholder values, balances, system id
from the legacy id, created on as `---`), `LedgerTab` (seven columns,
running balance, sticky footer with the totals).

Behaviour: the Budget cell of an expense leaf opens the inline editor;
commit parses the text to cents and calls `setBudget`; a `Rejected`
reason shows under the cell in `--neg` until the next edit. `+ ✎ −`, ⚙
and the three print menus call `notices.stub`. ⟳ is absent, as in the
prototype's Accounts toolbar.

`compilerTracked` moves from the price row to `TreeGridRow`.

### Dev entry

`buildPorts` builds the four simulators over the generated seed when
`VITE_SERVER_URL` is unset; the live branch throws `"the server arrives in
M3"` until then, so the composition root keeps its two branches and its
test.

## Oracle fixture and tests

- `packages/client-core/src/testing/fixtures/pozzetto2013.oracle.ts`:
  `OracleNode = { key, debit, credit, balance, budget?, children? }` in
  cents, in the derived tree's order, with a header listing every place
  the oracle disagrees with the dump (known today: the Costs node's own
  debit, the Elevator account's position, two zero leaves the dump does
  not have). The dump is authoritative there.
- `packages/client-core/src/presenters/accountsPresenter.oracle.test.ts`:
  on the harness over the real seed with Pozzetto 2013 selected, walks
  `tree$` against the fixture node by node: same keys, same four amounts,
  same child count. Runs everywhere.
- `packages/legacy-import/specs/oracleFixture.test.ts`: reads
  `docs/design/web/v1/reports/pozzetto/acc.json`, parses the Italian
  amounts, walks it in order against the fixture and reports the first
  mismatch with both labels; skips with the dump suites' visible `SKIP`
  line where the file is absent. Also asserts the seed module is fresh:
  a regeneration from the dump reproduces it byte for byte.
- Contract per port, run by its simulator. Presenter and machine tests on
  fake timers, as in the starter. Page objects for every component that
  has an intent. Goldens: `accounts-1280-light`, `accounts-1280-dark`,
  `accounts-1100-light` (compact, drawer closed), `accounts-1100-drawer`,
  plus one per primitive in isolation (`money`, `panel`, `tree-grid`).
  The `Scenario` type gains `width`, `mode` and the selected key; the
  project's `visual.pw.ts` sets the viewport per scenario.
- Coverage holds at the add-on's bar for every new file; the generated
  seed module is excluded with its reason.

## Housekeeping folded into M1

- `must(value, what)` and `packages/domain/src/support/`.
- The 30 s `testTimeout` in `packages/legacy-import` applies only to the
  dump-reading suites (per-suite option), not to the whole package.
- Turbo: the legacy-import `test` task declares its dump dependency
  following the installed Turbo docs, or disables its cache if inputs
  cannot name it; either way with the reason in the config.
- `subtree(unknownId)` throws, with a test.
- Deferred, not in M1: splitting `pseudonymise.ts`; unifying `Money` and
  `Cents`; the attribute columns' content; the per-account `Allocation
  tables` text (needs the tables port, M2).

## Out of scope

The parent's list, plus: carbon and sage goldens; non-English chrome
strings; the language picker's effect beyond storing the preference; any
toolbar action past the budget edit; owner-scoped ports; the server's
ports.

## Build order

Each step ends with `pnpm gate:full:quiet` green and a commit:

1. Remove the price sample from every package; the server greets; the
   integration test proves it. Housekeeping items.
2. Domain entities, `must`, `buildAccountTree` and `ledgerOf` on a small
   hand-written fixture, `validateBudget`.
3. Generator: `LegacySeed` emission with nature, type, counterparts and
   parties; the seed module committed; the freshness test.
4. The four ports, contracts, simulators; the harness over the seed.
5. Presenters, machines, `createApp`; the oracle fixture written from the
   derived tree and proven against `acc.json` locally; the oracle test.
6. Bindings.
7. Tokens, fonts, `Money`, `Panel`, `TreeGrid` on static props, with their
   page objects and goldens.
8. The Accounts screen on the view model; the shell around it; the budget
   edit; toasts; compact mode; the four screen goldens.
