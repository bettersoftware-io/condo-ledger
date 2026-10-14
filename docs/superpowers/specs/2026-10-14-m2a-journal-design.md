# M2a — Journal & Daybook, with the self-contained wizards — design

Date: 2026-10-14. Status: implemented on worktree-m2a-journal (2026-10-14).

Parent spec: `docs/superpowers/specs/2026-10-11-app-v2-design.md`, whose
Section 5 names M2 as "Journal + ten wizards → Installments → Tables &
Allocation → Building Data & Units → Contacts → Calendar; one spec per group".
This document is the first of the Journal group's two specs. It builds the
screen and the five wizards that need nothing the domain does not model yet.
The second (M2b) takes the five wizards that pull in suppliers and invoices,
installments, the functional-account settings and the allocation engine.
Where this document and the parent differ, this one wins for M2a; the
parent's decisions table stays in force. The M1 spec,
`2026-10-12-m1-accounts-slice-design.md`, is the shape every layer here copies.

## Goal

The *Journal & Daybook* screen of the design
(`docs/design/web/v1/README.md`, screen 6) on the in-memory simulators: the
period's entries by number, each expandable into its postings with the
running balance, searched and paged, one selectable, one deletable; and five
of the ten journal-entry wizards, each writing an entry through the journal
port. Done when: Pozzetto 2013's journal reconciles to the design's export
`docs/design/web/v1/reports/pozzetto/journal.json` through a committed
fixture proven locally against it; a wizard's entry appears in the Journal
and in the Accounts ledger of the account it posted to; a delete closes the
numbering gap; the goldens are committed.

## What the surveys changed

| Found | Consequence |
|---|---|
| The read side is largely built: `JournalEntry`, `Posting`, a read-only `JournalPort`, its simulator, and `ledgerOf` for the running balance | M2a adds the kind, the two commands, the derivation the grid needs, and the screen. No entity is renamed |
| The dump types each transaction with ten values (`ledgerTransaction.type`); the untyped ones are the generic entries. The seed does not carry it. The design's export shows it as the entry's icon | `JournalEntry.kind`, emitted by the generator; the untyped ones become `generic` |
| The legacy app stamps an entry in a trigger (`timestamp = IFNULL(…, UTC_TIMESTAMP)`) and numbers it `MAX(code) + 1` within the period in the insert routine (`AccountingDAO::addLedgerTransaction`). The wizards of the design have no date field | The port assigns the number and the stamp; no code above it thinks about either. The simulator takes a clock so tests are deterministic |
| The legacy delete (`AccountingDAO::deleteLedgerTransactions`) removes any entry, moves every later number of the period down by one, deletes the invoice behind a registration and reopens the invoice behind a payment. A "last entry only" rule exists in the code and is commented out | Delete closes the gap. The kinds whose side effects this app does not model yet are refused until M2b |
| The legacy app's direct payments debit one or several cost leaves and credit the one bank-role account (Saturno 2011 has both forms); a withholding payment debits one tax-role leaf and credits the bank | "Direct payment to multiple cost accounts" is the bank purchase with several lines, so it joins this spec |
| Pozzetto 2013's generic entries post on control accounts with a counterpart (individual expenses per owner, a partial invoice per supplier) | A generic line names its party: the picker offers the same rows the Accounts tree shows |
| The export writes a posting's path through the tree, except that under a control account the side level `(Assets)` / `(Liabilities)` is dropped: 540 postings, no other form | `journalOf` drops the side level for a control row; the local oracle check proves it |
| Saturno 2011 is in the seed (`p1`, 18 entries) and its number order differs from its date order | The Journal lists by number, as the port promises and the legacy book did; the ledger stays by date |
| `TreeGrid` always puts the tree in the first column; the Journal's tree column is the third | Rows gain leading cells; the Accounts and Ledger grids pass none |
| The prototype's wizards close on Save and write nothing | What each wizard writes is defined here, not lifted |

## Seed

The generator maps `ledgerTransaction.type` to `EntryKind` and emits it on
every entry of `legacySeed.generated.ts`; nothing else in the module
changes, and `seed/data.generated.json` is untouched. The mapping:

| Dump | Kind |
|---|---|
| `startingBalance` | `openingBalances` |
| `closingBalance` | `closingBalances` |
| `ledgerInvoiceRegistration` | `invoice` |
| `ledgerInvoicePayment` | `invoicePayment` |
| `unitResidentTakings` | `collection` |
| `estimateDistribution` | `budgetAllocation` |
| `individualExpense` | `individualExpense` |
| `directPaymentInCash` | `directPaymentCash` |
| `checkingAccountDirectPayment` | `directPaymentBank` |
| `withholdingTaxPayment` | `withholdingPayment` |
| `NULL` | `generic` |

Pozzetto 2013: 140 entries, 540 postings, numbers 1 to 140, every entry
balanced, eleven generic. Saturno 2011: 18 entries, with five bank purchases
(two of them multi-line), one cash purchase and one withholding payment.

## Domain

### Entities (`packages/domain/src/entities`)

```ts
export type EntryKind =
  | "openingBalances" | "closingBalances"
  | "invoice" | "invoicePayment" | "collection" | "budgetAllocation"
  | "individualExpense"
  | "directPaymentCash" | "directPaymentBank" | "withholdingPayment"
  | "generic";

export interface JournalEntry {
  id: string; periodId: string; number: number; at: string;   // at: "YYYY-MM-DDTHH:mm:ss", Rome wall clock
  kind: EntryKind; description: string; postings: Posting[];
}

/** What a wizard hands the port: the port adds the id, the number and the stamp. */
export interface EntryDraft { kind: EntryKind; description: string; postings: Posting[]; }

/** A command that answers with a value. `Result` stays for the ones that do not. */
export type ResultOf<T> = (Ok & { value: T }) | Rejected;
```

`Posting` and `Counterpart` are unchanged. The seed's data types
(`JournalEntryData`) carry the kind too.

### Use cases (`packages/domain/src/useCases`)

**`validateEntry(draft, accounts): Result`** decides whether a draft may be
written to the period whose accounts are given. The reasons, in the order
they are checked:

| Reason | When |
|---|---|
| `blank-description` | the description is empty after trimming |
| `no-postings` | no posting |
| `unknown-account` | a posting's account is not one of the period's |
| `not-a-leaf` | a posting on a `grouping` account |
| `empty-line` | a posting with neither debit nor credit |
| `both-sides` | a posting with both (a legacy line is one signed amount) |
| `negative` | a debit or a credit below zero |
| `counterpart-required` | a posting on a `control` or `controlUnitResident` account with no counterpart |
| `counterpart-not-allowed` | a posting on any other account with one |
| `unbalanced` | the debit total differs from the credit total |

The simulator runs it before writing; a wizard machine runs it on the draft
as it stands to decide Next and Save; the server's adapter runs it in M3.

**`canDeleteEntry(entry): Result`**: accepted for `generic`,
`directPaymentCash`, `directPaymentBank` and `withholdingPayment`; refused
with `kind-not-deletable` for the other seven, because the legacy delete had
side effects this app does not model yet (the invoice behind a registration
or a payment, the installments behind a collection) and the opening,
closing, allocation and individual-expense entries belong to flows M2b
builds. M2b loosens the rule kind by kind as it models each side effect.

**`journalOf(tree, entries): JournalEntryView[]`**, the grid's data, in
number order:

```ts
export interface PostingView { path: string; debit: Cents; credit: Cents; balance: Cents; }
export interface JournalEntryView {
  id: string; number: number; at: string; kind: EntryKind; description: string;
  debit: Cents; credit: Cents;          // the entry's totals
  postings: PostingView[];
}
```

`balance` is the running debit minus credit within the entry, so the last
line of a valid entry reads zero. `path` is the path of the node the posting
belongs to, labels joined by ` › ` as `pathOf` writes it, with one rule: for
a posting on a `control` or `controlUnitResident` account the side level,
`(Assets)` or `(Liabilities)`, is left out. That is the form the design's
export writes for all 540 postings, and the only place the journal's path
differs from the ledger's. The node a posting belongs to is found as
`ledgerOf` finds it (the scope that owns the posting); the two share that
lookup and the `NONE` key, exported once from `accountTree.ts`.

**`romeTime(date: Date): string`** moves from the generator to
`packages/domain/src/support/romeTime.ts`: the Rome wall clock as
`YYYY-MM-DDTHH:mm:ss`, through `Intl` with a fixed zone. The generator parses
the dump's UTC string into a `Date` and calls it. Its two tests (either side
of the autumn change) move with it.

### Ports (`packages/domain/src/ports`)

```ts
export interface JournalPort {
  /** In number order. Errors with "missing: the period <id>" for a period the port does not have. */
  entries(periodId: string): Observable<JournalEntry[]>;
  /** Refused with validateEntry's reason; the entry gets the period's next number and the port's stamp. Rejects for a period the port does not have. */
  addEntry(periodId: string, draft: EntryDraft): Promise<ResultOf<{ id: string }>>;
  /** Refused with canDeleteEntry's reason; every later entry of the period moves down one number. Rejects for an entry the port does not have. */
  deleteEntry(entryId: string): Promise<Result>;
}
```

**Simulator.** `createJournalSimulator(seed, clock)` keeps one
`BehaviorSubject<JournalEntry[]>` per period, as the accounts simulator
does. `addEntry` validates against the seed's accounts of the period (type
and nature never change, so the budget edit is irrelevant), assigns
`max(number) + 1` (1 in an empty period), an id of its own (`new1`, `new2`…,
never colliding with the seed's `tx…`), `at = romeTime(clock.now())`, and
emits. `deleteEntry` asks `canDeleteEntry`, removes the entry, renumbers,
emits. `Clock` is `{ now: () => Date }` in `domain/src/support/clock.ts`,
with `systemClock`. It is a parameter of the simulator, not an app port: the
server stamps with its own clock in M3, and nothing above the port needs the
time. `createSimulatorPorts(seed, clock = systemClock)` passes it;
`createAppHarness` passes a fixed clock (`2026-10-14T10:00:00` Rome) unless a
test brings its own; the visual host's seeding passes the same fixed one.

**Contract** (`__contracts__/JournalPortContract.ts`): the entries of a
seeded period come in number order; an unknown period errors; a valid draft
lands with the next number, the stamp and the id the result names, and the
stream emits it; a refused draft leaves the stream silent; a delete of a
deletable entry closes the gap and emits; a delete of a refused kind answers
the reason and leaves the stream silent; an unknown id rejects. The
simulator's own test adds the renumbering across several deletes and the
fixed clock's stamp.

## Core (`packages/client-core`)

**`booksPresenter(ports, selected$)`** reads the selected period's three
streams once and exposes `books$: Books | null`:

```ts
export interface Books { periodId: string; tree: AccountNode; accounts: Account[]; parties: Party[]; entries: JournalEntry[]; }
```

The accounts presenter takes `books$` instead of reading the ports; what it
exposes is unchanged, and it gains `distinctUntilChanged` on
`selectedKey$` (a STATUS item). The journal presenter reads the same stream.

**`journalPresenter(books$, buildings$, selected$, port)`**:

```ts
export interface JournalContext { building: string; period: string; }
export interface JournalPresenter {
  entries$: DefaultedStateObservable<JournalEntryView[]>;     // journalOf(books.tree, books.entries); [] with no period
  context$: DefaultedStateObservable<JournalContext | null>;  // the wizards' first row
  addEntry: (draft: EntryDraft) => Promise<ResultOf<{ id: string }>>;   // on the selected period
  deleteEntry: (id: string) => Promise<Result>;
}
```

`addEntry` with no period selected answers `Rejected("no-period")`.

**`journalGridMachine(entries$)`**, one per grid:

```ts
export type JournalGridRow =
  | { kind: "entry"; entry: JournalEntryView; expanded: boolean; selected: boolean }
  | { kind: "posting"; entryId: string; index: number; posting: PostingView; last: boolean };

export interface JournalGridState {
  rows: JournalGridRow[];     // the page's entries, each expanded one followed by its posting rows
  selectedId: string | null;
  expanded: string[];
  search: string;
  page: number; pageSize: number; pageCount: number; total: number;   // total: entries after the search
}
export interface JournalGridIntents {
  select: (id: string) => void;
  toggle: (id: string) => void; expandAll: () => void; collapseAll: () => void;
  setSearch: (text: string) => void;          // back to page 1
  setPage: (page: number) => void; setPageSize: (size: 10 | 25 | 50 | 100) => void;
  reveal: (id: string) => void;               // the page that holds it, selected, not expanded
}
```

Search matches the description and the number, case-insensitively, trimmed.
The page size starts at 10, the design's. `pageCount` is at least 1. On
every emission the state is reconciled with the entries: a selected id that
is gone is dropped, a page past the last becomes the last, expanded ids that
are gone are forgotten. Expand all and collapse all act on the entries the
search left, not only the page.

**Wizard machines.** Three factories, one contract. A machine takes the
books and the presenter's `addEntry`; it never sees a port.

```ts
export interface PreviewLine { path: string; debit: Cents; credit: Cents; }
export interface WizardChoice { key: string; label: string; group: string; }   // an account or a tree row the person may pick
export interface WizardState<TForm> {
  step: number; stepCount: number;     // 1-based step; every M2a wizard has one step
  form: TForm;
  choices: WizardChoice[];             // what the pickers offer, from the books
  preview: PreviewLine[];              // the "Entry postings" grid
  verdict: Result;                     // validateEntry on the draft as it stands, plus the wizard's own rules
  saving: boolean;
}
export interface WizardIntents<TForm> {
  edit: (patch: Partial<TForm>) => void;
  next: () => void; back: () => void;
  save: () => Promise<ResultOf<{ id: string }>>;   // the draft to addEntry; Rejected when verdict is, without calling
}
export type WizardMachine<TForm> = Machine<WizardState<TForm>, WizardIntents<TForm>>;
```

Amounts travel as text in the form and are parsed in core: `parseAmount`
moves from `client-react/src/ui/format.ts` to `client-core/src/amounts.ts`
with its test, and the budget editor imports it from there. A machine's
`verdict` is then decided on fake timers; the UI only displays it.

- **`createDirectPaymentWizard(kind, books, addEntry)`**, with `kind` one of
  `directPaymentCash`, `directPaymentBank`, `withholdingPayment`. Form:
  `description` (prefilled "Direct cash purchase", "Direct purchase via bank
  account", "Withholding payment ({account})", editable), `targetId: string
  | null`, `amount: string`. The choices are the period's `regular` accounts
  of nature `expenses`, or for a withholding the `regular` accounts with the
  `tax` role, keyed by account id and grouped by their top-level account. The account paid from is the
  `regular` account with the `cash` role (cash purchase) or the `bank` role
  (the two others); with none, `verdict` is `Rejected("no-paid-from-account")`
  and stays so. The preview is the target debited and the paid-from account
  credited. The draft's postings carry no counterpart.
- **`createMultiCostPaymentWizard(books, addEntry)`**: the bank purchase
  with `amount: string` (paid) and `lines: { accountId: string | null;
  amount: string }[]`, starting with one line. Lines are added and removed
  through `edit({ lines })`, the one contract; the machine keeps at least
  one line. Beyond `validateEntry`, the lines must sum to the amount paid
  (`lines-do-not-sum`). The choices are the expense leaves, as above. The
  preview is one debit line per cost line, in order, and one credit on the
  bank. The kind written is `directPaymentBank`.
- **`createGenericEntryWizard(books, addEntry)`**: `description: string`,
  `lines: { scopeKey: string | null; debit: string; credit: string }[]`,
  starting with one, edited the same way. The choices are the tree's
  posting-owning rows (a node whose `scope` is not null), keyed by the
  node's key, labelled by its path and grouped by its top level, so a
  control account's line names its party by construction and a plain
  leaf's line has none; the draft's posting is the scope's account id and
  counterpart. The lines grid's Balance column is the running sum of the
  preview's lines, which are the form's lines in order. The kind written is
  `generic`.

`save` builds the draft, calls `addEntry`, and while it runs `saving` is
true; the result is returned to the caller as it came, and the machine does
nothing with it: closing the dialog and revealing the entry are the
screen's.

**Composition.** `AppPresenters` gains `books` and `journal`; `AppMachines`
gains `createJournalGrid`, `createDirectPaymentWizard(kind)`,
`createMultiCostPaymentWizard`, `createGenericEntryWizard`. The last three
need the current books: the factory subscribes to `books$` and builds the
machine over the latest value, so a wizard opened with no period selected
has no choices and a rejected verdict. Which dialog is open is the screen's
own view state, as the budget editor's is in `AccountsGrid`, not a machine.

## Bindings (`packages/react-bindings`)

New hooks on the view model: `useJournal(): { entries: JournalEntryView[] }`,
`useJournalContext(): JournalContext | null`, `useDeleteEntry(): (id) =>
Promise<Result>`, `useJournalGrid(): MachineView<JournalGridState,
JournalGridIntents>`, `useDirectPaymentWizard(kind)`,
`useMultiCostPaymentWizard()`, `useGenericEntryWizard()`, each returning a
`MachineView` of its wizard's state and intents. The wizard hooks take the
factory's argument on the first render only, like `useColumns(spec)`, and
the `ViewModel` interface says so.

## Client (`packages/client-react`)

### TreeGrid

- `TreeGridRowData` gains `leading: ReactNode[]`, the cells drawn before the
  tree cell, and `tone?: "muted"` (the row's text in 11px `--txd`).
- `TreeGridProps.columns` keeps its order; a new `treeColumn: number`
  (default 0) says which column holds the tree. `TreeGrid` and `TreeGridRow`
  draw `leading` before the label cell and `cells` after it; the header and
  the resize handles are unchanged.
- The Accounts and Ledger grids pass `leading: []` and no `treeColumn`; the
  four existing goldens prove them unchanged on both platforms.

### Journal screen (`src/ui/journal`)

- `JournalScreen` (thin: reads the view model, holds which dialog is open,
  hands props down). One `Panel` "Journal", meta "{n} entries total",
  maximize through the shell's machine as the Accounts screen does.
  `Screen.tsx` routes `menu === "journal"` to it; the placeholder goes.
- `JournalToolbar`: search; `+ ▾` "Add transaction" on `Popover` with the
  ten items in the design's order (New invoice, Record collection, Invoice
  payment, Direct purchase via bank, Direct purchase with cash,
  Withholding-tax payment, Opening balances, Budget allocation, Generic
  entry, Direct payment to multiple cost accounts), the five built ones
  opening their wizard and the five others posting a stub notice; `✎` stub;
  `−` opening the delete confirm, disabled with no selection; divider;
  expand all, collapse all; print, PDF, XLS stubs; the paging group on the
  right: "Page **{page}** of {pageCount}" between previous and next
  (disabled at the ends, the design's `.4` opacity), the page-size chip
  `{size} ▾` opening a popover of the four sizes; `⟳` stub.
- `JournalGrid`: the machine's rows as tree-grid rows. An entry row: leading
  `formatDateTime(at)` in 11px `--txd` tabular and the number in 11px 600;
  the kind's icon and the description, bold, cut with an ellipsis; Debit and
  Credit `plain` bold; Balance `0.00`. A posting row: depth 1, muted, zebra,
  no caret, two empty leading cells, the path as the label; Debit and Credit
  plain; the running balance bold, except the last line's zero in regular
  weight. Clicking a posting row selects its entry. Columns and widths from
  the prototype (`Date | P.N. | Entry description / Postings | Debit |
  Credit | Balance`, the description flexible), in `columns.ts` beside it.
  Empty state "No entry matches." under a search, "No entry in this period."
  otherwise.
- Kind icons, in `EntryIcon.tsx`, lucide: `Receipt` for opening and closing
  balances, `FileText` for an invoice, `Banknote` for a collection,
  `CreditCard` for the four payment kinds, `Calculator` for the allocation,
  `Users` for individual expenses, `PencilLine` for generic.
- `DeleteEntryConfirm`: the 380px alert on `ConfirmAlert`: title "Notice",
  the warning glyph, "Delete the entry "{description}"?", Yes and No. Yes
  calls `deleteEntry`; a `Rejected` keeps it open with the reason's message
  in `--neg` under the text ("This kind of entry is removed through its own
  flow, which is not built yet."); `Ok` closes it, and the grid's
  reconciliation drops the selection. No and Escape close it; focus returns
  to the grid.

### Wizards (`src/ui/journal/wizards`)

- `WizardDialog` draws any `WizardMachine` view: the title "{name} — Step
  {n}: {title}" (a one-step wizard shows the name alone), the
  "Building / Period: {building} / {period}" row from `useJournalContext`
  (the building's address arrives with Building Data, M2d), the step's body
  as children, the "Entry postings" summary grid (`# | Account (Partita) |
  Debit | Credit`, the preview lines, the design's widths `46px 1fr 110px
  110px`), the footer: "Required fields are marked with *"; `◀ Back` hidden
  on step 1; `Next ▶`, or `✓ Save entry` on the last step, disabled while
  `verdict` is rejected; `✕ Cancel`. The rejected reason, once the person has
  edited something, shows in `--neg` beside the summary in the wizard's
  words; the generic entry's is the design's "The entry must balance — the
  transaction balance must be 0 and a description is required." Save: `Ok`
  closes the dialog and calls the grid's `reveal(id)`; `Rejected` from the
  port shows the same way and the dialog stays. Cancel and Escape close
  without saving. The dialog component mounts the machine's hook, so a
  closed and reopened wizard starts clean.
- `DirectPaymentWizard` (the three kinds, one body): `Description`,
  the section "COST ACCOUNT" or "TAX ACCOUNT TO SETTLE" as a
  `SelectableList` of the choices with the document icon, `Amount *`
  right-aligned (width 160), the read-only "Paid from: {account}" line, or
  the `--neg` message "This period has no {cash | default bank} account"
  when there is none.
- `MultiCostPaymentWizard`: the same with `Amount paid *` and a lines grid
  `# | Cost account | Amount` with `＋ −` row buttons; the cost account is a
  `<select>` over the expense leaves; the grid's footer shows the lines'
  total against the amount paid.
- `GenericEntryWizard`: `Description *`; the editable lines grid `# |
  Account (Partita) | Debit | Credit | Balance` (`46px 1fr 110px 110px
  110px`), `＋ −` row buttons, the Total footer (Debit, Credit, Balance in
  `--num`). The account cell is a `<select>` whose options are the choices
  labelled by their path, grouped by top level in `<optgroup>`s (a native
  select keeps the keyboard and needs no new primitive). Debit and Credit
  are text inputs.

### New primitives (`src/ui`)

Each with a stylesheet, a page object and a test, in the design's measures:
`Dialog` (scrim `--scrim` fading in, card by width 380 / 560 / 680 with
`--shadow-modal` and the pop-in, title bar, body, footer; Escape closes; the
primary disabled while the step is invalid), `ConfirmAlert` on it,
`FormField` (the `{labelW} 1fr` row, label 12.5px 600 `--txd`, required in
`--acc` with `*`, the field box, the read-only variant on `--zebra`),
`SelectableList` (the design's rows, `6px 10px`, border-top `--bd2`, selected
`--sel`, scrolling at a max height), `MenuItem` for the popover's rows (icon
slot, hover `--hover`). The title bar's drag and the per-dialog position go
to IDEAS: no behaviour depends on them.

### Rules carried from M1

No inline styles; one stylesheet per component, classes prefixed with the
component's name, colours from tokens; lucide icons; test ids from
`testids.ts`; a page object per component with an intent; a view-model
reader stays thin and hands plain props to compiled components.
`compilerTracked` gains `JournalGrid`'s row mapping if the plan finds it
worth holding; otherwise nothing.

## Oracle fixture and tests

- `packages/domain/src/testing/pozzetto2013.journal.ts`, written by
  `gen:oracle-fixture` beside the accounts fixture: one row per entry
  (`number`, `kind`, `at`, `debit`, `credit`) and per posting (`key`,
  `debit`, `credit`, `balance`) in cents, where `key` is the posting's
  scope without a side: `la154`, `la157/md17`, `la158/md104/r162`. Ids
  only, so it is committable. Its header lists every place the export
  disagrees with the seed, as the accounts fixture's does.
- `packages/client-core/src/presenters/journalPresenter.oracle.test.ts`:
  on the harness over the real seed with Pozzetto 2013 selected, walks
  `entries$` against the fixture entry by entry and posting by posting:
  number, kind, stamp, totals, key, amounts, running balance. Runs
  everywhere.
- The local check `packages/legacy-import/specs/oracleFixture.test.ts`
  gains the journal: it reads `journal.json`, maps each posting's path to
  a key through the label map it builds from `acc.json` (recording both the
  full path and, for a control row, the path without the side level), and
  compares with the fixture: number, the Italian stamp to the seed's,
  icon to kind (🧾 opening and closing, 📄 invoice, 🟩 the payments, 💶
  collection, 🧮 allocation, 📝 generic), Italian amounts to cents, path
  to key, running balance. The first mismatch is reported with both
  labels. It skips with the dump suites' visible `SKIP` line without the
  export. The header-drift test (`pozzettoFixture.test.ts`) renders the new
  fixture from the seed too and compares bytes.
- Domain: `validateEntry` one test per reason and one accepted draft;
  `canDeleteEntry` both ways; `journalOf` on a small hand-written tree
  (order, totals, the three path forms, the running balance ending at
  zero); `romeTime` on both sides of the autumn change; the contract run by
  the simulator; the simulator's renumbering and stamp.
- Core: the books presenter switching periods; `entries$` and `context$`;
  the grid machine (search, paging, the clamp after a delete, `reveal`,
  expand all under a search); each wizard machine step by step on the
  harness: the verdict after each edit, the preview, a save that lands with
  the next number and the fixed stamp, the period without a role account,
  the lines that do not sum. `pnpm mutation-check` on `validateEntry`, the
  wizards' rules and the paging arithmetic.
- Client: a page object per new component; the screen test opens the menu,
  fills the generic wizard through the page objects, saves, sees the entry
  selected in the grid, switches to Accounts and finds its posting in the
  ledger of the account; the delete flow both ways; the toolbar's stubs.
  Fake timers, no sleeps.
- Goldens, both platforms: `journal-1280-light`, `journal-1280-dark`
  (Pozzetto 2013, page 1, entry 2 expanded and selected: three postings) and
  `journal-delete-confirm`. No wizard has a golden: on linux-x64 a dialog card
  centred at a half-pixel offset redraws its inner boxes' rounded corners one
  or two colour levels apart from frame to frame, so the host never gets two
  identical frames (the bank purchase also scrolls, which draws unstably).
  `Scenario` gains `menu`,
  `expandedEntries`, `selectedEntry` and `dialog`, delivered in
  `seeding.ts` through the machines' own intents and the screen's dialog
  state; the host stays untouched. `dialog` is `"delete"`. `selectedEntry` goes through the grid's `reveal`, so an entry
  on a later page is shown on its page, selected. The linux set comes from
  the goldens workflow.
- Coverage holds at the add-on's bar for every new file.

## Housekeeping folded into M2a

- `distinctUntilChanged` on `selectedKey$`; `NONE` exported once from
  `accountTree.ts`; `AccountDetails` on its own stylesheet; `parseAmount` to
  core; `romeTime` to the domain. The STATUS entries these close are
  removed in the pull request.
- STATUS gains M2b under "Next, with no plan yet" (the five remaining
  wizards, the delete of their kinds, `✎` on an entry); IDEAS gains the
  dialog drag.

## Out of scope

M2b's wizards (New Invoice, Invoice Payment, Record Owner Collection,
Opening Balances, Budget Allocation) and the delete of their kinds; editing
an entry; the dialog's drag; print and exports; a date field on a wizard;
Saturno 2011's oracle (its journal export is a PDF; the parent puts
Saturno's checks at Tables & Allocation); per-grid persistence; the
parent's own out-of-scope list.

## Build order

Each step ends with `pnpm gate:full:quiet` green and a commit, in the
worktree `m2a-journal`, one pull request:

1. Domain: `EntryKind`, `EntryDraft`, `ResultOf`, `Clock`, `romeTime` moved,
   `validateEntry`, `canDeleteEntry`, `journalOf`, `NONE` exported once,
   with their tests.
2. Generator: the kind emitted; the seed module regenerated; the journal
   fixture written and proven against the export locally; the header-drift
   test extended.
3. Port, contract, simulator with the clock and the renumbering; the
   harness and `createSimulatorPorts` pass their clocks.
4. Core: `booksPresenter`, the accounts presenter on it, `journalPresenter`
   with its oracle test, the grid machine, the three wizard machines,
   `parseAmount` moved, `createApp`.
5. Bindings.
6. Client primitives: `TreeGrid` leading cells and tone (the four existing
   goldens unchanged), `Dialog`, `ConfirmAlert`, `FormField`,
   `SelectableList`, `MenuItem`.
7. The Journal screen, toolbar, grid, paging, delete confirm; the screen
   routed; the two journal goldens and the delete golden.
8. `WizardDialog` and the five wizards; the screen test through to the
   ledger; STATUS and IDEAS.
