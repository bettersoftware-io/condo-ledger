# Changelog

What reached the main branch, week by week, written for a person catching up.
It is not a list of commits. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), with two changes:

- **A version is an ISO week** (`2026-W40` is Monday 28 September to Sunday
  4 October). A pull request belongs to the week of its merge time in UTC.
- **A week is grouped by theme, then by kind.** It opens with a short summary,
  then `Added`, `Changed` and `Fixed` for what a user or a developer would
  notice, `Decisions` for the choices worth remembering, and `Under the hood`
  for tests, gates, tooling, docs and dependency updates.

Every merged pull request is cited by its number in square brackets, with a
`#` before the number. Each citation has a link definition at the bottom of
this file, in ascending order, and `pnpm changelog defs --write` writes them.
`pnpm changelog check <week>` proves both. The newest week comes first. A
session starts with a note of the finished weeks that are due, and
`pnpm changelog due` lists them.

Each finished week is also a git tag of the same name, on the last commit
that reached the main branch before Monday 00:00 UTC. So
`git diff 2026-W39 2026-W40` is exactly the change the W40 section describes.
The `Weekly tag` workflow creates the tag and opens an issue that asks for
the entry.

## 2026-W44 — 26 Oct – 1 Nov

Three more screens of the Buildings module: thousandth tables and
allocation, units and building data, and contacts. The demo data now reads
in English. In between, the clean-ups STATUS had collected were cleared: the
old allocation engine retired, grids that keep their state, keyboard and
focus after the WAI-ARIA patterns, and the first browser tests.

### Added

- **Thousandth Tables & Allocation** [#39]. Tables, their coefficients and
  the allocation of the budget or the final balance, with a Roundings row,
  and the Journal's Budget allocation wizard. The allocation follows the
  legacy algorithm and its rounding steps, and matches every resident of the
  Saturno and Pozzetto reports to the cent.
- **Units, owners and building data** [#49]. The Units grid with each
  owner's previous balance, budget, actual, total due, paid, overdue and
  adjustment, and the profile and owner tabs. Groups, units and owners can
  be added, edited and deleted. The Building Data screen shows each period's
  liquidity, funds and balances, and the building, period and address
  dialogs. Both seeded periods match the legacy figures to the cent.
- **Contacts** [#52]. Find, add, edit, archive and delete people and
  companies, with their phones, emails, categories and connections. A
  contact still in use cannot be deleted, and the screen says why. The
  building's suppliers become editable, and the owner and supplier pickers
  create or edit a contact in place. A renamed contact is right on every
  screen at once. The seed holds all 113 contacts of the dump.

### Changed

- **The demo data reads in English** [#40]. The legacy database's account
  names, entry descriptions, invoice reasons and table names are translated
  once, at import. An unknown string stops the generator, so nothing slips
  through in Italian. Names, codes, ids and amounts are untouched.
- **Each grid keeps its state for the session** [#44]. Column widths, open
  rows, splits and the bottom tab survive leaving a screen and coming back.
  A period switch starts the open rows and the Journal's page again.
- **Keyboard and focus** [#45]. Tabs, menu buttons and dialogs follow the
  WAI-ARIA patterns: the arrow keys, Home and End, focus kept inside a
  dialog and returned to whatever opened it. A confirmation puts focus on
  "No". A 2px focus ring in the accent colour is readable in every theme.
- **A selected row comes into view** in every grid, a long row label has a
  tooltip, the contact picker shows the contact it links, and a refused
  Journal delete says so in words [#51].
- **Successive owners** of a unit each pay the whole share for their own
  days [#49].

### Fixed

- **The Add transaction menu** no longer wraps its items [#37].
- **A budget on a non-regular account** and **a counterpart of the wrong
  kind** are refused by the domain's checks [#42].
- **A unit date edit that cuts an owner's dates** is refused, instead of
  crashing the app or over-allocating the unit [#49].

### Decisions

- **The legacy allocation algorithm, rounding included** [#39], not a
  cleaner one. One hand-typed posting in the legacy books differs from it
  by a few cents and stays as typed. The reasoning is in
  [the M2e design](docs/superpowers/specs/2026-10-26-m2e-tables-allocation-design.md).
- **The old allocation engine is retired** [#43], with the prototype's
  40,000-line JSON seed. The app seed and both oracle fixtures came out
  byte-identical without it.
- **Overdue and Adjustment follow Danea's definitions** [#49], since the
  legacy app never computed them. See
  [the M2f design](docs/superpowers/specs/2026-10-29-m2f-building-data-units-design.md).
- **A contact in use is archived, not deleted** [#52]. See
  [the M2g design](docs/superpowers/specs/2026-11-01-m2g-contacts-design.md).

### Under the hood

- **Browser tests** [#46]. The end-to-end add-on drives the built client on
  its simulator: the chart of accounts, a journal delete and dark mode.
  Each spec was shown to fail on a mutant of the app.
- **A flaky server test fixed** [#37]. A raw socket with no error listener
  ended a run now and then.
- **The tidy-ups** [#42] [#47]. Shared helpers in the simulators and the
  wizard tests, one picker menu in the top bar, the Journal's blank-search
  rule in the core.
- **The dump folder in a worktree** [#38]. The ETL reads
  `LEGACY_DUMP_DIR` everywhere, as the generator does.
- **The kit and its add-ons** from bettersoftware-skills 0.24.2 and 0.25.0
  [#38] [#46] [#54], with Biome 2.6.2.
- **STATUS** gained what the reviews left and lost what was done [#33]
  [#50] [#53]. The changelog for W42 and W43 [#41] [#48].
- Dependency updates [#34] [#35].

## 2026-W43 — 19 Oct – 25 Oct

Two new pieces of the Buildings module landed: owners' collections in the
Journal and the Installment Schedule screen. Amounts started following the
chosen language, and the Accounts grid moved to the legacy app's look. Around
them, a week of tooling: the kit and its add-ons were brought up to date
three times, and the visual tier grew from pages to a pyramid of components.

### Added

- **Record an owner's collection** [#23]. A Journal wizard takes an owner,
  the amount and the cash or bank account, and spreads the payment over
  their oldest installments first. A collection can now be edited and
  deleted. The legacy installment schedules come into the seed, and what each
  owner still owes is worked out from the entries. All 36 Pozzetto
  collections come out line for line.
- **The Installment Schedule screen** [#25]. Every owner against every
  installment, each cell coloured settled, partial or unpaid. It comes with
  the legacy "Create budget installments" wizard and editing of an
  installment, its deletion, and one owner's amount in its cell. Nothing a
  collection has paid can be changed or deleted. Its totals equal the
  printed schedules of both buildings.

### Changed

- **Amounts and rates follow the language** [#31]. English writes
  `1,234.56`, Italian and German `1.234,56`, French `1 234,56`. Typed amounts
  are read the same way, and a text never means two different amounts in two
  languages.
- **The Accounts grid in the legacy look** [#30]. Group rows have bold
  labels, and rows are striped by position. A cost account's budget may now
  be negative, as the legacy books have.
- **"Edit Accounting Entry"** [#32] is the editor's title when it edits,
  instead of "Edit Add Accounting Entry".

### Decisions

- **Negative budgets are allowed** [#30]. The "never negative" rule came
  from an early plan, not from the legacy app, whose books hold negative
  budgets.
- **The amount format follows the language, not a fixed en-US style** [#31],
  which overrides the design README. The reasoning is in
  [the amount locale note](docs/superpowers/specs/2026-10-25-amount-locale-design.md).
- **Playwright updates wait for a person** [#20]. Renovate moves the
  Playwright package and the workflows' Playwright image together, as their
  own group, and only when someone asks for it on the Dependency Dashboard.
  A new browser redraws every golden.

### Under the hood

- **The visual tier's pyramid** [#27]. 26 component pictures, every state
  that matters, and 2 sections join the 15 pages. Dialogs are pictured
  alone, at the size of their viewport.
- **Tests no longer share vitest's module cache** [#22]. Packages tested
  side by side could delete it under each other. A gate now fails a test
  script without the flag.
- **The kit and its add-ons** from bettersoftware-skills 0.19, 0.20 and
  0.21 [#21] [#22] [#24] [#26].
- **Development tools past their advisories:** fast-uri, zod and esbuild,
  lifted by scoped overrides [#29]. None of them is in the app.
- **STATUS** shed its decided items [#30] [#32].
- Dependency updates [#17] [#18].

## 2026-W42 — 12 Oct – 18 Oct

The week the app was rebuilt. The repository moved onto the
bettersoftware-skills starter, with the legacy data pseudonymised. Then the
first three screens followed on in-browser simulators: the Accounts,
Ledgers & Balance screen and the Journal, with its first wizards, then
invoices, payments and opening balances.

### Added

- **The rebuild's foundation** [#1]. A ports-and-adapters monorepo on the
  starter, with its architecture gates. Every person and company in the
  legacy dump gets a realistic, fixed fake identity before anything is
  projected, and every amount and id stays as it was.
- **Accounts, Ledgers & Balance** [#3]. The account tree in five levels, with
  rows per supplier, person and residency under the control accounts. It
  comes with the ledger and its running balance, account details and budget
  editing, all inside the app's shell: top bar, module tabs, breadcrumb,
  sidebar and splitter.
- **The Journal & Daybook** [#9]. Entries by number, expandable into their
  postings, searched and paged. An entry can be deleted where the legacy app
  allowed it. Five wizards write entries: purchases paid in cash or by bank,
  withholding-tax payments, payments to several cost accounts, and the
  generic entry.
- **Invoices, payments and opening balances** [#15]. A new invoice works out
  its totals and withholding as the legacy app did, and is checked on all 49
  seeded invoices. An invoice is paid in tranches. Opening balances are one
  editable list. Any entry opens in place for editing, in its own wizard.

### Decisions

- **Pseudonymised data in a public repository** [#1]. The real dump stays on
  one machine; the repository holds only fake identities. The plan is in
  [the app v2 design](docs/superpowers/specs/2026-10-11-app-v2-design.md).
- **Renovate in place of Dependabot** [#13]. Dependabot's updater runs an
  older Node than the project's floor, so every one of its runs failed.
- **Screenshots without Chromium's partial raster** [#10] [#11]. It shaded the
  same rounded corner differently from frame to frame. Dialogs also sit on
  whole pixels, and a native select's own text is drawn as plain text, so
  the pictures hold still.

### Under the hood

- **The agent workflow and STATUS.md** [#4] [#5] [#6] [#7] [#12] [#16].
  STATUS.md became the one page of what is left. The first code-scanning
  findings, the repository's settings and a flaky server test were written
  into it.
- **Housekeeping between M1 and M2** [#8]. The kit and add-ons were updated,
  the repo-hygiene checks added (versions, doc links, CSS from tokens), the
  generator's silent fallbacks made to throw, and ten tests tightened.
- **The kit and add-ons** from bettersoftware-skills 0.18.1 [#13].

[#1]: https://github.com/bettersoftware-io/condo-ledger/pull/1
[#3]: https://github.com/bettersoftware-io/condo-ledger/pull/3
[#4]: https://github.com/bettersoftware-io/condo-ledger/pull/4
[#5]: https://github.com/bettersoftware-io/condo-ledger/pull/5
[#6]: https://github.com/bettersoftware-io/condo-ledger/pull/6
[#7]: https://github.com/bettersoftware-io/condo-ledger/pull/7
[#8]: https://github.com/bettersoftware-io/condo-ledger/pull/8
[#9]: https://github.com/bettersoftware-io/condo-ledger/pull/9
[#10]: https://github.com/bettersoftware-io/condo-ledger/pull/10
[#11]: https://github.com/bettersoftware-io/condo-ledger/pull/11
[#12]: https://github.com/bettersoftware-io/condo-ledger/pull/12
[#13]: https://github.com/bettersoftware-io/condo-ledger/pull/13
[#15]: https://github.com/bettersoftware-io/condo-ledger/pull/15
[#16]: https://github.com/bettersoftware-io/condo-ledger/pull/16
[#17]: https://github.com/bettersoftware-io/condo-ledger/pull/17
[#18]: https://github.com/bettersoftware-io/condo-ledger/pull/18
[#20]: https://github.com/bettersoftware-io/condo-ledger/pull/20
[#21]: https://github.com/bettersoftware-io/condo-ledger/pull/21
[#22]: https://github.com/bettersoftware-io/condo-ledger/pull/22
[#23]: https://github.com/bettersoftware-io/condo-ledger/pull/23
[#24]: https://github.com/bettersoftware-io/condo-ledger/pull/24
[#25]: https://github.com/bettersoftware-io/condo-ledger/pull/25
[#26]: https://github.com/bettersoftware-io/condo-ledger/pull/26
[#27]: https://github.com/bettersoftware-io/condo-ledger/pull/27
[#29]: https://github.com/bettersoftware-io/condo-ledger/pull/29
[#30]: https://github.com/bettersoftware-io/condo-ledger/pull/30
[#31]: https://github.com/bettersoftware-io/condo-ledger/pull/31
[#32]: https://github.com/bettersoftware-io/condo-ledger/pull/32
[#33]: https://github.com/bettersoftware-io/condo-ledger/pull/33
[#34]: https://github.com/bettersoftware-io/condo-ledger/pull/34
[#35]: https://github.com/bettersoftware-io/condo-ledger/pull/35
[#37]: https://github.com/bettersoftware-io/condo-ledger/pull/37
[#38]: https://github.com/bettersoftware-io/condo-ledger/pull/38
[#39]: https://github.com/bettersoftware-io/condo-ledger/pull/39
[#40]: https://github.com/bettersoftware-io/condo-ledger/pull/40
[#41]: https://github.com/bettersoftware-io/condo-ledger/pull/41
[#42]: https://github.com/bettersoftware-io/condo-ledger/pull/42
[#43]: https://github.com/bettersoftware-io/condo-ledger/pull/43
[#44]: https://github.com/bettersoftware-io/condo-ledger/pull/44
[#45]: https://github.com/bettersoftware-io/condo-ledger/pull/45
[#46]: https://github.com/bettersoftware-io/condo-ledger/pull/46
[#47]: https://github.com/bettersoftware-io/condo-ledger/pull/47
[#48]: https://github.com/bettersoftware-io/condo-ledger/pull/48
[#49]: https://github.com/bettersoftware-io/condo-ledger/pull/49
[#50]: https://github.com/bettersoftware-io/condo-ledger/pull/50
[#51]: https://github.com/bettersoftware-io/condo-ledger/pull/51
[#52]: https://github.com/bettersoftware-io/condo-ledger/pull/52
[#53]: https://github.com/bettersoftware-io/condo-ledger/pull/53
[#54]: https://github.com/bettersoftware-io/condo-ledger/pull/54
