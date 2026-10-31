# Status: what is left

What is not done yet, across the whole project. Finished work is removed from
this page, not archived: the git log and [the changelog](../CHANGELOG.md) say
what was done. So an entry that is not here is done, or was never started. Do
not read progress into its absence.

An idea nobody has committed to is not here. It is in [IDEAS.md](IDEAS.md),
and moves here when it gets a plan.

One bullet for each entry: its name in bold, what is left, and a link to its
plan when it has one. `AGENTS.md` says when an entry is added, moved and
removed.

**Last updated: 2026-10-31**

## In progress

Work that has started and is not finished.

## Designed, not built

- **M3, the server on Node and Postgres with the live port adapters.** The
  parent design names it:
  [2026-10-11-app-v2-design.md](superpowers/specs/2026-10-11-app-v2-design.md).
  No plan yet. Until M3, `pnpm dev:fs` throws by design
  (`packages/client-react/src/app/buildPorts.ts`).
  M3 also brings the browser tests against the server: a `fullstack` mode in
  `tools/e2e.config.mts`, specs in `packages/e2e/src/fullstack/`, and the
  `packages/server` entry of `serversWithoutEndToEnd` in
  `architecture.config.mts` deleted, which the kit's `end-to-end` gate then
  asks for.

## Planned, and held by something

Work that waits on a release, a decision or other work.

## Next, with no plan yet

- **Edit an account's allocation tables.** Account Details shows the
  tables an account is allocated by, read-only; the Edit Account dialog is
  where the legacy app changed them. Once links are editable, an account
  served by two tables, one of them all zeros, is only partly allocated:
  `unallocated` stays empty, and the wizard would post the rest as a
  "rounding" on the first resident (`budgetAllocationDraft.ts`). The draft
  must then refuse, or name the account, when a column's Roundings exceeds
  a rounding.
- **The rest of the Buildings module for M2.** The groups the parent design
  names that are not built yet, one spec each: Contacts and Calendar
  ([2026-10-11-app-v2-design.md](superpowers/specs/2026-10-11-app-v2-design.md)).
  Installments (M2d), Tables & Allocation (M2e) and Building Data & Units
  (M2f) are built.
- **New and deleted buildings and periods.** Building Data & Units edits
  what exists but cannot add or remove a building or a period. A new period
  starts from the previous one: its chart, units, residents and balances are
  carried over.
- **Edit a building's suppliers.** Building Data shows the suppliers
  read-only; editing them comes with Contacts.
- **Tidy-ups left by the M2f reviews.** None changes what a person sees.
  `daysOf` could use `spanOf`. `same()` is repeated in
  `validateUnits.ts` and `validateBuilding.ts`, and the parse of a blank or
  a date in `formDialog.ts` and `invoiceWizard.ts`. `ValueSelect` repeats the wizards'
  select, and `createFormDialog` parallels `tableDialogMachine.ts`. A few
  test helpers are copied (`rowLabels`, `rowWithKey`, `flatten`, `watch`).
- **Presenter robustness before the live adapters (M3).** In
  `packages/client-core/src/presenters/accountsPresenter.ts`, a key the tree
  no longer has should fall back to Total rather than error the stream for
  good (today unreachable, since no port changes the tree's structure);
  `buildingsPresenter.selectPeriod` before the tree loads reads as "no such
  period". The screen has no error boundary: a period with broken references
  crashes the whole app on render. In the Journal: the journal presenter's
  eager `selected$` subscription has no error handler, and its `context$` and
  `addEntry` follow `selected$` while its entries follow the books, so the
  two can disagree briefly; the journal port's contract test "adds an entry"
  relies on a synchronous first emission and has one subscriber; the
  simulator keeps a draft's postings by reference; the delete alert is
  hidden, not closed, when the selection vanishes while it is open, and
  comes back on the next selection. In Tables & Allocation (M2e): the
  tables port's contract counts emissions synchronously right after an
  awaited write, which a live adapter may need to flush; the allocation and
  tables streams and the table selection stay subscribed for the app's life;
  a period switch shows a loading state whose words ("No period is
  selected.", "No table is selected.") are wrong for that moment; clicking
  the edit or delete button while the selection is not yet listed would
  throw; Account Details now reads the tables and units ports, through
  `allocation.tables$` (`composition.ts`), so a failing live tables or
  units adapter would fail Account Details too, though only table names
  are at stake; and the Budget allocation wizard reads a null allocation
  as "There is no budget to allocate" when it means the tables are still
  on their way, so a live adapter needs a "still loading" state there. The
  screens' grids (`packages/client-core/src/screens.ts`) subscribe their
  presenter streams when a screen first asks for them and stay subscribed
  for the session, so a screen once visited keeps its data live off-screen:
  the allocation recomputes on every change of the books, and a live
  port's subscriptions behind them would stay open. The Building Data
  grid is one of them, and it reads every period's books, tables and units,
  not only the selected one's (`buildingDataPresenter.ts`): once the screen
  has been visited, one set of those streams per period stays subscribed,
  and each period's allocation recomputes on every change of its books. Its
  Period dialog judges against the units port's first answer, so it relies
  on a port that answers on subscribing, as the units presenter's dialogs
  do.
  The Building Data screen (M2f) has two more limits. One period's error (a
  port error in M3, or a period without a Liquidity or Funds account) breaks
  every building's Building Data rows until the page is reloaded; the fix in
  M3 is a catch for each period that shows that period's figures as blank
  and reports the error. And any change to the buildings tree, even renaming
  an unrelated building, recomputes every period's allocation for the
  Building Data screen. Its `scope$` also reads the tree twice, so a new
  building's row could arrive before its tree and throw, once buildings can
  be added. The units presenter resets its selection when the listed period
  changes, so a quick switch away and back, before the other period's ports
  answer, keeps the old selection.

## Waiting on a person

A step or a decision an agent cannot take.

## Known limits

- **Successive owners depart from the legacy rule.** The legacy application
  split a unit's share among all the residents of the unit and role,
  whatever their dates. M2f splits it only among the residents whose dates
  overlap, so successive owners each pay the whole share for their own days.
  Both seeded periods come out identical to the cent (A04 is the only dated
  unit), so the difference shows only for new data. The Unit Owners tab's
  Comb. coeff. follows the same rule.
- **Liquidity and Funds are found by name.** The generator gives the
  top-level assets account named Liquidità the role `liquidity` and the
  top-level liabilities account named Fondi the role `funds`, and refuses a
  period with none or two. A chart that names them differently cannot be
  seeded.
- **`Wizards.css`, `BudgetInstallmentsWizard.css` and `ValueSelect.css` style `FormField`'s box with `:has()`.**
  A change to `FormField`'s markup must check them.
- **The module tabs name no panel.** `ModuleTabs` is a named tab list with
  the keyboard of WAI-ARIA's tabs, but the main area below it is not marked
  as its `tabpanel` and named by the active tab: that needs an id shared
  between `ModuleTabs` and `AppRoot`.
- **The Allocation's Days differ from the legacy screen in two cells.**
  Saturno A3 shows 147/365 where the legacy app showed 146/365 (it lost an
  hour to the March clock change before a floor), and A4 is blank where the
  legacy showed 365/365 (the seed gives it no restriction of its own). The
  shares match to the cent.
- **Co-owners with an explicit 0% beside an empty percentage** are each
  given 1 divided by the empty count, as the legacy code does, so the unit
  is over-allocated and the Roundings row goes negative. The seed has no
  explicit 0%; it matters once co-ownership percentages can be edited.
- **Column widths that follow the data are kept per count of columns.**
  The screens' state (`packages/client-core/src/screens.ts`) keeps a grid's
  widths for each set of columns it is drawn with. The Installment
  Schedule's columns follow its installments and the Allocation's its
  accounts, so a period, a mode or a deleted installment that changes the
  count starts that grid from its default widths, and the widths come back
  with the count. Carrying a width across counts needs each column named,
  not counted. The widths last the session only: nothing is stored.
- **The Accounts grid's stripes are faint in the light themes.** It now
  follows the legacy screen: bold labels, regular-weight amounts, and rows
  striped by position. The stripe colour is the `--zebra` token, which is
  close to white in the light themes, so the stripes show far less than the
  legacy grey. A darker token would also darken the Schedule, the Journal
  and the grid footers that share it.

- **A visual state held in a view's own state has no picture in place.**
  The budget editor in an Accounts row, the editor in an Installment
  Schedule cell, the toolbars' menus and the top bar's pickers open on a
  click into the view's `useState`, and a scenario never clicks. Each is
  pictured as its component alone (`inline-editor-*`, `popover-*` in
  `packages/client-react/tests/visual/scenarios.ts`), not where it sits.
  `pnpm visual:coverage` lists what no scenario reaches yet, mostly event
  handlers.
- **The oracle check runs only where the design's export exists.** It skips
  in CI, by name. Pozzetto 2013 reconciles with four recorded deviations
  (`acc-p132` moved to `la219`; `acc-p135` budget 0 vs null; `acc-p184` and
  `acc-p188` oracle-only). Saturno 2011 has no oracle check yet.
- **Row order under a control account is by label with the Italian
  collation**, which depends on the Node's ICU; sibling ties fall back to
  seed order. The positional presenter test pins today's order.
- **Entry times are Rome wall-clock strings** converted from the dump's UTC.
  Two entries inside the repeated hour of the autumn change sort by the
  string, then by number.
- **A control account's assets side is always present**, zero when empty;
  a control account nested under a grouping, or of a fixed nature, splits per
  counterpart with no side. The legacy report agrees; the spec did not say.
- **An export exists only once something imports it** (knip refuses the rest), so
  a later task that needs a name from an earlier one adds the export then.
- **The outward-command hook is a guard against joined commands, not a
  security boundary.** A review of the commit that added it (2026-10-13)
  named parser differentials, a fail-open path and guard bypasses in
  `tools/agent-workflow/lib/shell.mts` and `lib/outward.mts`. The add-on's
  README states the first as its choice (a command it cannot read passes),
  and the plugin's own status page records the same review as not followed
  up. A second review of the push (same day) added that the `ask` rules the
  add-on merges into `.claude/settings.json` can be escaped by git's
  abbreviated flags (`--forc`) or bundled short flags, and that the hook's
  wrapper list is incomplete. The add-on's version on `main` since
  2026-10-14 closes those two and three more (a wrapper the host looks past,
  `xargs`, the Monitor tool): the hook now asks about every push that is
  not written plainly, and registers for Monitor. What the hook looks past
  is a copy of what Claude Code 2.1.296 looks past, so a later host can open
  the gap again; the plugin's own status page records that, and the first
  review's chain-detection points, as open. The control that holds is the
  repository's ruleset on `main` (no force-push, no deletion, a pull
  request required); the hook and the rules only reduce prompts and slips.
- **`ubuntu-latest` becomes Ubuntu 26 on 19 October 2026.** Every workflow
  here uses the label, as the plugin's templates do, and each job installs
  its own Node and pnpm (the Playwright jobs run in a container), so the
  project moves with it rather than pinning `ubuntu-24.04`. Watch the first
  runs of `main` after that date; a runner-image failure is not the change
  that merged. The plugin's own workflows passed on `ubuntu-26.04` on
  2026-10-16 (skills #40, skills-demo #13).
- **A write that fails shows nothing in the Units and Building Data
  dialogs.** A refusal is worded, but a rejected port call only reaches the
  console and the dialog stays open (`useDialogWrite.ts`). The simulators
  never reject; M3's adapters can.
- **A co-owner's percentage in a Units grid label is always written with a
  dot** (`unitsList.ts`), whatever the language. Every seeded share is whole,
  so it shows once co-ownership percentages can be edited.
- **The Installment Schedule drops an owner whose unit is not listed**,
  without a word. Real data cannot do this today.
- **The Journal's small gaps.** The multi-cost wizard's footer shows the
  lines' total alone, not against the amount paid; `validateEntry` judges an
  entry line by line, so the reason shown is the first faulty line's, not
  the weightiest across the lines.
- **A wizard can open on the old period's accounts (M3).** With asynchronous
  adapters, a wizard opened between a period switch and the new period's
  books arriving offers the old period's accounts while `addEntry` posts to
  the new period. The port refuses the entry as `unknown-account`, which the
  wizard words as "The period changed while this was open: cancel and open it
  again".
- **Create Budget Installments can save amounts its review did not show
  once the live store (M3) has other writers.** The wizard reviews over the
  books as they stood when it opened
  (`packages/client-core/src/machines/wizards/budgetInstallmentsWizard.ts`),
  while the port plans the items again from its own books at save time
  (`packages/domain/src/simulators/installmentsSimulator.ts`, in
  `createInstallments`). In the simulator nothing changes in between, so Save
  writes what step 3 showed; with M3's live store, another writer's change in
  between to what the plan reads (the budget allocation, the opening entry,
  the residents, the existing items) would make an accepted Save write
  amounts the person never saw. Fix in M3: the draft carries what it
  expects (the planned items, or a version of the books) and the port
  refuses on a mismatch.
- **A registration's replace shows both versions for one emission.** When
  an invoice's registration is rewritten, the books emit once with the new
  invoice terms beside the old postings: the presenter's consistency guard
  covers an add and a delete, not a replace.
- **A refused or failed `replaceEntry` shows as `entry-gone`.** When the port
  rejects the call for any reason, a transport failure included, the wizard
  words it as `entry-gone`. M3's adapter must tell "not found" from a
  transport failure (`packages/client-core/src/machines/wizards/wizard.ts`,
  `replacing`).
- **The books presenter's consistency guard can hold `books$` back.** If the
  data are ever truly inconsistent (an invoice without its registration, or
  the reverse), `books$` stops emitting. The seed test rules that out today.
- **The Invoice payment editor assumes a payment's two-line shape**
  (suppliers debit, liquidity credit). Every seeded payment fits; before
  M3's live data, a round-trip check (an entry's form, then its draft's
  postings, equal the entry's) should guard the payment, direct-payment and
  opening editors.
- **A refused payment re-reads the books once.** After an `over-remaining`
  refusal the payment wizard reads the books again a single time, which
  relies on the books having updated before the refusal arrives. The
  simulator does that; the live adapter of M3 need not.
- **`pnpm dev:fs` throws until M3.**
- **The schedule's Overdue does not move at midnight.** It is computed when
  the books emit, against the clock's today; a tab left open past midnight
  shows the day before's Overdue until the books next change.
- **The schedule's resized column widths reset** when an installment is
  created or deleted: the columns machine is rebuilt for the new count of
  installments (`InstallmentScheduleScreen.tsx`).
- **The schedule's "Restr. period" is the resident's own restriction, else
  its unit's, as one unit.** A resident with only one bound of its own does
  not inherit the unit's other bound.
- **Amounts and rates follow the language, read at the moment a form
  judges.** A form keeps what it holds when the language changes, so an
  amount the app prefilled (`539.92`) reads as not an amount after a
  switch to Italian until it is typed again. The inline editors open on the
  shown, grouped value (`1.000,00`), which parses. Grouping every amount
  (`useGrouping: "always"`) needs Chrome 106, Safari 15.4 or Firefox 116;
  older browsers leave four-digit amounts ungrouped in it-IT and es-ES. The
  schedule cell editor, the account details panel and the wizards' summary
  sentences take the locale the same way but have no Italian test of their
  own. At startup `amountLocale$` is en-US until the session's preferences
  arrive: on the simulators they answer at once, but over the M3 adapters a
  wizard opened before they do prefills its amounts in en-US, and keeps them
  after the language arrives
  ([2026-10-25-amount-locale-design.md](superpowers/specs/2026-10-25-amount-locale-design.md)).
