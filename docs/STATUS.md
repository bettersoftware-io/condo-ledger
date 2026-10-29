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

**Last updated: 2026-10-29**

## In progress

Work that has started and is not finished.

## Designed, not built

- **M3, the server on Node and Postgres with the live port adapters.** The
  parent design names it:
  [2026-10-11-app-v2-design.md](superpowers/specs/2026-10-11-app-v2-design.md).
  No plan yet. Until M3, `pnpm dev:fs` throws by design
  (`packages/client-react/src/app/buildPorts.ts`).

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
- **Unit groups and the Units entity, in the Building Data & Units group.**
  The entities and `UnitsPort` exist (M2e). The Installment Schedule does
  not draw Saturno's unit groups (A and B) yet: its rows are units, then
  residents
  ([2026-10-25-m2d-installment-schedule-design.md](superpowers/specs/2026-10-25-m2d-installment-schedule-design.md),
  "Scope").
- **The rest of the Buildings module for M2.** The groups the parent design
  names, one spec each: Building Data & Units, Contacts and Calendar
  ([2026-10-11-app-v2-design.md](superpowers/specs/2026-10-11-app-v2-design.md));
  Installments (M2d) and Tables & Allocation (M2e) are built. The entry
  above opens the first.
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
  port's subscriptions behind them would stay open.

## Waiting on a person

A step or a decision an agent cannot take.

## Known limits

- **`Wizards.css` and `BudgetInstallmentsWizard.css` style `FormField`'s box with `:has()`.**
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
- **The Journal's small gaps.** A delete refused for a reason no sentence
  words shows the reason's code; the multi-cost wizard's footer shows the
  lines' total alone, not against the amount paid; `validateEntry` judges an
  entry line by line, so the reason shown is the first faulty line's, not
  the weightiest across the lines.
- **A wizard can be left on the old period's accounts.** The dialog traps
  no focus, so the keyboard can leave an open wizard (Tab to the sidebar),
  switch the period and come back: the wizard still offers the old period's
  accounts while `addEntry` posts to the new period, and the port refuses
  the entry as `unknown-account`, which the wizard words as "The period
  changed while this was open: cancel and open it again". This holds until
  the dialog traps focus. With asynchronous adapters (M3) a wizard opened
  between a period switch and the new period's books arriving does the same.
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
