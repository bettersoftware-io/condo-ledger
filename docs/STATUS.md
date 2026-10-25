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

**Last updated: 2026-10-25**

## In progress

Work that has started and is not finished.

## Designed, not built

- **M3, the server on Node and Postgres with the live port adapters.** The
  parent design names it:
  [2026-10-11-app-v2-design.md](superpowers/specs/2026-10-11-app-v2-design.md).
  No plan yet. Until M3, `pnpm dev:fs` throws by design
  (`packages/client-react/src/app/buildPorts.ts`).

## Planned, and held by something

- **Negative budgets.** Pozzetto 2013 holds two on editable expense leaves
  (`la215` −1,200.00 and `la216` −380.00, deduction accounts). The spec's rule
  "a budget is never negative" stays; an unchanged text on blur cancels, so
  they are not an error trap. Held by the decision below; if negatives are
  allowed, drop the `negative` reason in
  `packages/domain/src/useCases/validateBudget.ts` and its message in
  `packages/client-react/src/ui/accounts/AccountsGrid.tsx`.

## Next, with no plan yet

- **Budget allocation, in the Tables & Allocation group.** Moved out of
  M2c ([2026-10-24-m2c-owner-collection-design.md](superpowers/specs/2026-10-24-m2c-owner-collection-design.md),
  "Scope"). An allocation charges each owner the share the engine computes,
  so it needs units, thousandth tables, residency dates and the allocation
  engine running in the app, none of which the app has. Left too: the 0/0
  lines of the legacy allocation, and the engine's divergence on Pozzetto
  2013 (it reproduces Saturno 2011, but is off by cents per owner on
  Pozzetto, about 426 euros between the two residents of unit A04). The
  menu item keeps M2a's notice until then.
- **Installment schedules, in the Installments group.** Moved out of M2c
  ([2026-10-24-m2c-owner-collection-design.md](superpowers/specs/2026-10-24-m2c-owner-collection-design.md),
  "Scope"), which reads the stored schedules only. Left: creating and
  editing a period's schedule ("Crea Rate Preventivo" in the legacy app),
  the Installment Schedule screen, and whether a resident's
  `startingBalance` follows the period's opening entry (installment 1
  embeds it; in M2b it only prefills a new opening).
- **The rest of the Buildings module for M2.** The groups the parent design
  names, one spec each: Installments, Tables & Allocation, Building Data &
  Units, Contacts and Calendar
  ([2026-10-11-app-v2-design.md](superpowers/specs/2026-10-11-app-v2-design.md)).
  The two entries above open the first two.
- **Visual goldens as a pyramid.** Since the `visual` add-on's 0.19.0 the
  fourteen Accounts and Journal scenarios are pages (the whole app at 1280
  or 1100 by 720), the shape its README says to avoid. M2c started the
  pyramid: `tests/visual/registry.tsx`, its `Surround` carrying the
  `data-theme` and `data-mode` that `ui/shell/AppRoot.tsx` sets, `render`
  from `seeding.ts`, and three component scenarios (the collection wizard
  on steps 1 and 2, its settlement table). `Surround` sets the attributes
  only, so the page around a part keeps the body's light colours: a dark
  component scenario needs that page dark too. Left: component scenarios
  before more pages. First: `Money` (positive, negative, zero),
  `TreeGridRow` (aggregate, selected, collapsed, long label), `InlineEditor`
  (editing, refused), `SegmentedControl`, `ConfirmAlert` and `WizardDialog`
  mounted alone with `capture: "viewport"`. `pnpm visual:coverage` lists
  what no scenario renders; `MultiCostPaymentWizard` has none (4.8%).
- **A flaky server test, `packages/server/src/startServer.port.test.ts`.**
  During M2b's final fix wave (2026-10-17), one local `pnpm gate:full` run
  failed on an unhandled error from a socket read in this file; the rerun
  passed, and M2b never touched the server. Not investigated. A likely
  suspect, unverified: `breakTheProtocol` opens a raw `net` socket with a
  `close` listener and no `error` listener, so a reset when the server drops
  the client (`ECONNRESET`) would surface as an unhandled error. Reproduce
  it (run the file in a loop), and fix the cause rather than retrying.
- **Per-grid persistence.** The design says a column resize persists per
  grid; today every per-component machine (grid expansion, columns, split,
  bottom tab) is rebuilt when its component mounts, so leaving the Accounts
  menu and coming back resets them, and the Ledger's column widths reset on
  every tab switch. `useColumns(spec)` and `useBottomTab(tabs)` also take the
  first render's argument only; document that in the `ViewModel` interface
  until it changes.
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
  comes back on the next selection.
- **Accessibility polish.** The tabbed panel lacks `aria-labelledby` and
  arrow keys; the popover menus have no focus return and no arrow keys; the
  inline editor's input has no label, `aria-invalid` or `role="alert"` on its
  error; the disabled checkbox in Account Details has no accessible name; the
  splitter has no `onPointerCancel`. From the Journal: `ConfirmAlert` is a
  `dialog` with no `aria-describedby`, so its question may not be read (an
  `alertdialog`); `Dialog` traps no focus and gives none back when a wizard
  closes on its own; one Escape would close two stacked dialogs; a
  `FormField` read-only row is a `<label>` naming nothing, and the required
  star is not announced (`aria-required`); after a dialog closes, the focus
  lands on the grid's wrapper, whose outline is removed, so nothing shows
  where it is.
- **Structural tidy-ups:** `missing()` duplicated across the two simulators;
  `TopBar.tsx` has two near-identical picker blocks; `LedgerTab` is a
  view-model reader that builds every row itself (split it like
  `AccountsGrid`); `.accounts-top .toolbar-button[data-icon-only]` reaches
  wider than its comment; `createSeedWithASecondPeriod` duplicates half of
  `createTwoPeriodSeed`; `twoBuildings()` is not named `create…`;
  `Counterpart.kind` is never checked against the account's role;
  `validateBudget` rejects only `grouping` as "not a leaf" (use
  `type !== "regular"`); the `compilerTracked` rationale and `AccountsGrid`'s
  doc comment are inaccurate; `Breadcrumb` keys rows by their text; a dead
  `data-tone="muted"`; `tokens.css` still names the prototype's path in its
  header; the `knip.jsonc` client-react workspace repeats the `packages/*`
  settings (keep in sync). From the Journal: `judgedPayment` and `Debit`
  live in `directPaymentWizard.ts`, though the multi-cost wizard uses them
  too (beside `payingOf` in `choices.ts`); the three wizard machine tests
  copy one create-and-dispose harness, and the three wizard readers repeat
  one skeleton; `JournalScreen` restates the grid machine's blank-search rule
  (a `searching` flag on the grid's state); `JournalPaging` and
  `JournalToolbar` use classes from `JournalScreen.css` without importing it;
  `Wizards.css` reaches into `FormField`'s class with `:has()`; posting keys
  (`entryId/index`) assume an entry id holds no slash.
- **AGENTS.md:** the oracle's path is written without backticks so the
  `agent-docs` gate does not look for a file that is not in git; pointing at
  the test and `DESIGN_ORACLE_DIR` instead would be cleaner.

## Waiting on a person

- **The probe branch `worktree-visual-flake-probe` on GitHub (the user).**
  It measured which Chromium flags hold the visual tier still: candidate
  flag sets as Playwright projects, each writing its own images, compared
  across parallel runs. Look through it, then delete it:
  `git push origin --delete worktree-visual-flake-probe`.
- **Negative budgets.** Allow them (the legacy application does, for
  deduction accounts) or keep the spec's rule. See "Planned, and held".
- **Wording and input choices made during M2b (the user).** Keep or change
  each:
  - amounts are typed en-US (`1,234.56`), as M2a pinned, not Italian
    (`1.234,56`); accepting Italian means changing `parseAmount`
    (`packages/client-core/src/amounts.ts`) and two of M2a's tests;
  - the generic editor's title on an edit reads "Edit Add Accounting Entry";
  - strings written without a source in the spec or the design: "Choose a
    supplier…", "No withholding", "Search account…", "No account matches."
    (the last two as the Accounts screen has them), "Enter an amount of
    zero or more for {row}", the step rules' messages and the entry-gone
    text in `packages/client-react/src/ui/journal/wizards/reasons.ts`;
  - the opening list's order: the leaves in tree order, then the residents.
- **Two design ambiguities, visible in the goldens
  (`packages/client-react/tests/visual/goldens/`).** The README's Money rule
  bolds every amount of an aggregate row, its Accounts section says "bold on
  Balance"; built: all four bold. The README gives group rows the `--zebra`
  background, the spec gave it to Total only; built: Total only. Say which,
  each is one line.
- **Eight open code-scanning alerts.** Seven are from the first CodeQL scan
  (switched on 2026-10-13, with Dependabot security updates and private vulnerability
  reporting; all nine settings `pnpm repo:settings` reads are now on; Dependabot
  security updates went off again on 2026-10-17, since Renovate opens the fixes). One was
  CodeQL's: `js/incomplete-sanitization`, a warning, in
  `tools/arch/gates/lib/files.mts`, the kit's own file; the kit's 0.15.0
  (on `main` with this entry) replaces the `*` through a function, so the
  alert should close at the next scan of `main`. Check it did, and dismiss
  it by hand if it did not. The eighth came with the housekeeping
  branch (pull request #8): `js/incomplete-multi-character-sanitization`,
  rated high, in `tools/repo-hygiene/lib/markdown.mts:100`, the add-on's
  heading reader stripping tags to make an anchor that is never rendered. The
  plugin read that same line on 2026-10-16 and dismissed it there as a false
  positive (skills #36): the anchor it makes is never written into a page.
  Dismiss it here with that reason.
  The CodeQL check is not in the ruleset, and #8 merged with it red. The other six
  are OpenSSF Scorecard's ratings of the repository's practices shown as
  errors with no file: CI best practices, code review, maintained, fuzzing,
  SAST and branch protection. They are not code defects; decide which to act
  on (code review and branch protection may be Scorecard reading the ruleset
  and the single-maintainer history its own way) and dismiss the rest with a
  reason, under Security → Code scanning.
- **Housekeeping carried from M0.** Delete the pre-rewrite backups beside the
  repository (`condo-ledger-backup-2026-10-12.git`,
  `condo-ledger-legacy-data-2026-10-12/`) once sure; rotate the credentials
  the old history held; GitHub Pages stays off.
- **To file in bettersoftware-io/skills** (observations from M0 and M1, not
  this project's to fix): a `starter` unit for `add-to-project.mts`; folder
  entries for `javascriptAllowed`; the Biome template repeats the base's
  `**`; `check-dockerfiles` parser findings; knip's "an export arrives with
  its caller" made every M1 task restore the names it imported (a note for
  the planning skill); the stop hook judges a subagent's in-flight tree and
  blocks the controller mid-task; the plan assumed the goldens workflow
  pushes a commit, while it uploads an artifact (the add-on's README is right,
  the plan was wrong); the `agent-workflow` installer wrote
  `.claude/commands/workflow/*.md` into a folder the project's `.gitignore`
  ignored and said nothing, so CI failed the `agent-docs` gate on files the
  branch did not carry (an installer could warn when a file it wrote is
  ignored).

## Known limits

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
