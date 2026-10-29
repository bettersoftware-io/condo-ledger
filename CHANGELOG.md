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
