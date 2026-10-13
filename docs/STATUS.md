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

**Last updated: 2026-10-13**

## In progress

- **M1, the Accounts, Ledgers & Balance slice.** Built and reviewed on
  `feat/m1-accounts`; pull request #3 is open with every required check
  green. It merges once the three decisions under "Waiting on a person" are
  taken. Spec:
  [2026-10-12-m1-accounts-slice-design.md](superpowers/specs/2026-10-12-m1-accounts-slice-design.md);
  plan:
  [2026-10-12-m1-accounts-slice.md](superpowers/plans/2026-10-12-m1-accounts-slice.md).
- **This branch (`chore/workflow-and-status`).** Adds the `agent-workflow`
  add-on, this page and `IDEAS.md`. It sits on top of `feat/m1-accounts` and
  merges after #3.

## Designed, not built

- **M2, the rest of the Buildings module, and M3, the server on Node and
  Postgres with the live port adapters.** The parent design names them:
  [2026-10-11-app-v2-design.md](superpowers/specs/2026-10-11-app-v2-design.md).
  No plan yet for either. Until M3, `pnpm dev:fs` throws by design
  (`packages/client-react/src/app/buildPorts.ts`).

## Planned, and held by something

- **Bring the project's copy of the kit and the add-ons up to the plugin's
  0.15.0.** The project runs the kit as installed in M0 (plugin 0.13.1): the
  `ci-security` add-on with Renovate support, three gates and one hook are
  newer upstream. Held by the merge of #3 and by the update-bot decision below.
  Command: `node <plugin root>/scripts/add-to-project.mts . kit`, then each
  add-on.
- **Negative budgets.** Pozzetto 2013 holds two on editable expense leaves
  (`la215` −1,200.00 and `la216` −380.00, deduction accounts). The spec's rule
  "a budget is never negative" stays; an unchanged text on blur cancels, so
  they are not an error trap. Held by the decision below; if negatives are
  allowed, drop the `negative` reason in
  `packages/domain/src/useCases/validateBudget.ts` and its message in
  `packages/client-react/src/ui/accounts/AccountsGrid.tsx`.

## Next, with no plan yet

- **Add the `repo-hygiene` add-on and fix what it finds.** Installed and run
  once on 2026-10-13, not kept, because its three checks join `gate:fast` and
  two of them fail today. `pnpm check:versions` passes (55 entries, 8 files
  agree). `pnpm check:doc-links` finds 6 dead links: two in-page anchors in
  `docs/PROJECT_BRIEF.md` (`#naming`, `#competitive-landscape`), two links to
  the archived `apps/web/` in `docs/domain/README.md` and
  `docs/domain/requirements.md`, and two in
  `packages/legacy-import/specs/README.md` with one `../` too many.
  `pnpm lint:css` finds 277 findings in 21 stylesheets: 265 that
  `stylelint --fix` repairs (blank lines before rules, `rgba()` → modern
  `rgb(… / 12%)`, `#ffffff` → `#fff`, `@import` notation), 12 hard-coded
  colours that need a token each (six account-icon tints in
  `packages/client-react/src/ui/accounts/AccountIcon.css`, three whites and
  a red in `ui/shell/TopBar.css`, the scrollbar thumb in `src/index.css`, the
  resize-handle hover in `ui/TreeGrid.css`), a keyframes name and one
  descending-specificity order. The goldens should not move (no colour
  value changes); run `pnpm visual` to prove it.
  Command: `node <plugin root>/scripts/add-to-project.mts . repo-hygiene`.
- **Generator: silent fallbacks should throw.** In
  `packages/legacy-import/src/project/legacySeed.ts`: a missing timestamp
  gives `at: ""`, a missing unit code `"?"`, a missing order `0`, a parent
  outside the period `null`, two role columns on one account keep the last;
  a posting's `accountId` is not checked against the period's accounts; the
  account `nature`/`type` are unchecked casts. In
  `src/oracle/designOracle.ts`, `toCents("")` gives 0. None occurs in
  today's dump (verified); make each one throw, naming the id.
- **Move the oracle fixture into the domain.** It lives in
  `packages/client-core/src/testing/fixtures/pozzetto2013.oracle.ts` and the
  check in `packages/legacy-import` imports it, so a server-role package
  devDepends on `@cl/client-core` and the AGENTS.md sentence "may import
  `@cl/domain`, `@cl/db` and `@cl/shared`" is stale. `packages/domain/src/testing/`
  lets both reach it. While there, say in the fixture header that the local
  check pairs a control account's rows order-insensitively, so it proves the
  multiset of amounts under it, not which party each belongs to.
- **CI-side tests for what only runs with the dump.** `legacy-import` is
  excluded from coverage wholesale, so `romeTime` (both DST sides),
  `projectLegacySeed` and `parseDesignOracle` run only where the dump and the
  oracle exist. A unit test on synthetic input for each would run in CI; a
  test that regenerates the fixture header from `DEVIATIONS` and compares it
  with the committed file would catch header drift.
- **Per-grid persistence.** The design says a column resize persists per
  grid; today every per-component machine (grid expansion, columns, split,
  bottom tab) is rebuilt when its component mounts, so leaving the Accounts
  menu and coming back resets them, and the Ledger's column widths reset on
  every tab switch. `useColumns(spec)` and `useBottomTab(tabs)` also take the
  first render's argument only; document that in the `ViewModel` interface
  until it changes.
- **Presenter robustness before the live adapters (M3).** In
  `packages/client-core/src/presenters/accountsPresenter.ts`: add
  `distinctUntilChanged` on `selectedKey$` (it re-emits on every books
  emission); a key the tree no longer has should fall back to Total rather
  than error the stream for good (today unreachable, since no M1 port changes
  the tree's structure); `buildingsPresenter.selectPeriod` before the tree
  loads reads as "no such period". The screen has no error boundary: a period
  with broken references crashes the whole app on render.
- **Accessibility polish.** The tabbed panel lacks `aria-labelledby` and
  arrow keys; the popover menus have no focus return and no arrow keys; the
  inline editor's input has no label, `aria-invalid` or `role="alert"` on its
  error; the disabled checkbox in Account Details has no accessible name; the
  splitter has no `onPointerCancel`.
- **Tests worth tightening** (each cheap): the server greeting test's
  `nextMessage()` misses a message that landed before the call; a later
  second greeting would pass; `validateBudget` tests do not pin the check
  order; `ordered()` in `accountTree.ts` is unproven by the fixture; the
  `budget === 0` half of hide-empty; `parseAmount("0.29")` for the rounding;
  "draws a divider" asserts only a button; a budget click also selects its
  row (unpinned either way); the splitter tests drag one step at a time; the
  TreeGrid `min-content` change has no test (a golden with a long label).
- **Structural tidy-ups:** `NONE` duplicated in `ledger.ts` (export it from
  `accountTree.ts`); `missing()` duplicated across the two simulators;
  `TopBar.tsx` has two near-identical picker blocks; `LedgerTab` is a
  view-model reader that builds every row itself (split it like
  `AccountsGrid`); `AccountDetails` borrows `AccountsScreen.css`;
  `.accounts-top .toolbar-button[data-icon-only]` reaches wider than its
  comment; `createSeedWithASecondPeriod` duplicates half of
  `createTwoPeriodSeed`; `twoBuildings()` is not named `create…`;
  `Counterpart.kind` is never checked against the account's role;
  `validateBudget` rejects only `grouping` as "not a leaf" (use
  `type !== "regular"`); the `compilerTracked` rationale and `AccountsGrid`'s
  doc comment are inaccurate; `Breadcrumb` keys rows by their text; a dead
  `data-tone="muted"`; `tokens.css` still names the prototype's path in its
  header; the `knip.jsonc` client-react workspace repeats the `packages/*`
  settings (keep in sync).
- **`ubuntu-latest` becomes Ubuntu 26 on 19 October 2026.** Every workflow
  here uses that label. Decide whether to pin `ubuntu-24.04` or move with it,
  then re-run CI.
- **AGENTS.md:** the oracle's path is written without backticks so the
  `agent-docs` gate does not look for a file that is not in git; pointing at
  the test and `DESIGN_ORACLE_DIR` instead would be cleaner.

## Waiting on a person

- **Merge #3.** `gh pr merge 3 --auto --merge`, after the three decisions
  below.
- **Negative budgets.** Allow them (the legacy application does, for
  deduction accounts) or keep the spec's rule. See "Planned, and held".
- **Two design ambiguities, visible in the goldens
  (`packages/client-react/tests/visual/goldens/`).** The README's Money rule
  bolds every amount of an aggregate row, its Accounts section says "bold on
  Balance"; built: all four bold. The README gives group rows the `--zebra`
  background, the spec gave it to Total only; built: Total only. Say which,
  each is one line.
- **One update bot.** Dependabot cannot update a project on this kit: its
  updater runs Node 24 and the root pins `devEngines.runtime >= 26`, so every
  run fails (recorded in the plugin's own status page). Renovate's onboarding
  pull request #2 is open. Decide for Renovate, merge #2, and take
  `ci-security:renovate` with the kit update above, which removes
  Dependabot's file.
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
  the plan was wrong).

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
- **`pnpm dev:fs` throws until M3.**
