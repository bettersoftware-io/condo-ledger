# M2e — Thousandth Tables & Allocation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Thousandth Tables & Allocation screen on the legacy allocation algorithm, live in the app, with table and coefficient edits, the Journal's Budget allocation wizard and the account's table links in Account Details.

**Architecture:**
- The seed gains what the legacy period held for this screen: units, groups, tables, coefficients, the account-to-table links with their role shares, account abbreviations and the residents' shares and own dates.
- The domain gets the legacy algorithm (`allocationOf`), the rules for table and coefficient writes, and the budget allocation's draft.
- A new `TablesPort` (with writes) and a read-only `UnitsPort` join the ports. The core gets an allocation presenter, machines for the panels and dialog, and a one-step wizard on M2b's `createWizardMachine`. The client draws three panels with M1's `TreeGrid`, `InlineEditor` and `Splitter`.
- `packages/legacy-import`'s parity spec moves onto `allocationOf`, which closes the A04 gap.

**Tech Stack:**
- TypeScript, RxJS with `@rx-state/core`, React 19 with the React Compiler;
- Vitest, and Playwright through the visual add-on 0.20.

**Spec:** `docs/superpowers/specs/2026-10-26-m2e-tables-allocation-design.md`. It is the authority. For shapes not repeated here, its parents are the M2d spec (`budgetSharesOf`, `previousBalancesOf`, `daysOf`, the restriction text) and M2b's (the wizard machine, `WizardDialog`, `ConfirmAlert`). The surveys behind the spec (legacy file:line, dump ids, every pinned figure) are in `.superpowers/tables-allocation/` in the worktree, which git ignores:
- `ta-legacy.md`: the algorithm (§3), and the dump's counts and examples (§5);
- `ta-design.md`: layout and strings (§1–§5), and figures (§4, §7);
- `ta-codebase.md`: what exists.

## Global Constraints

- **Where and how to work:**
  - Work in the worktree `../condo-ledger-worktrees/tables-allocation`, branch `worktree-tables-allocation`, and open one pull request at the end.
  - Every task ends with `pnpm fix`, then `pnpm gate:full:quiet` green, then a commit. A red gate is not a finished task.
  - `pnpm --filter X test -- <name>` does not filter in this repo. While iterating, run single files with vitest from the package.
- **AGENTS.md code rules hold everywhere:**
  - function declarations and named object types;
  - `#/` imports past one folder;
  - no `useMemo`, `useCallback` or `memo`, and no inline styles;
  - test ids in `packages/client-react/src/ui/testids.ts`, and UI tests through page objects;
  - fake timers and no sleeps;
  - fixture factories named `create…`, and tests before helpers in a test file;
  - an export only with its first non-test caller (knip);
  - colours as tokens in `src/styles/tokens.css`.
- **The seed:** `packages/domain/src/simulators/seed/legacySeed.generated.ts` is only rewritten by `pnpm --filter @cl/legacy-import gen:data`.
  - Run generators and dump-backed tests with `LEGACY_DUMP_DIR=/Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/old/db` and `DESIGN_ORACLE_DIR=/Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/docs/design/web/v1/reports/pozzetto`, and show that they ran, not skipped.
  - Run `gate:full` without `LEGACY_DUMP_DIR` (STATUS "Known limits").
  - Committed files carry ids only, never real names.
- **Amounts and numbers:**
  - Amounts are `Cents`.
  - A coefficient is an integer count of ten-thousandths (`38` is `380000`).
  - A link's or a role's percentage is an integer in hundredths of a percent (`50%` is `5000`), or `null` when empty.
  - An owner's `share` is an integer in ten-thousandths of a percent (`100%` is `1000000`), or `null`.
  - The generator fails on a value that does not fit its unit.
- **Typed text** is read in the session's amount locale (M2's `parseAmount` and `parseHundredths`). A coefficient uses a new `parseTenThousandths` beside them. Dates show as dd/mm/yyyy.
- **Ids:**
  - periods `p1` (Saturno 2011) and `p36` (Pozzetto 2013);
  - accounts `la…`, entries `tx…`, residents `r…`;
  - new: units `u{legacy id}`, groups `ug{id}`, tables `dt{id}`, links `el{id}`. Simulator-made tables are `dt-new-1`, … and never collide with seeded ids.
  - Saturno: allocation entry `tx5`, revenue account `la49`.
  - Pozzetto: allocation entry `tx291`; resident `r162` is A01; `r166` and `r167` are A04; `r187` and `r188` are A18.
- **Exact copy (the spec's):**
  - **Panels:** "Thousandth Tables", "Table Coefficients", "Allocation".
    - Thousandth Tables columns: `Name | Restriction on | Counter | Total`.
    - Table Coefficients columns: `Unit | Period | Coefficient`.
    - Allocation columns: `Groups / Units / Owners | Role | Restr. period | Days | {account columns} | Total | Prev. bal. | Total due | Paid`. The last row is "Roundings".
  - **Mode button:** "Budget ▾" or "Final balance ▾"; its menu items are "Budget allocation" and "Final-balance allocation". Disabled: "Group rows by: By unit ▾", "Group cols by: By account ▾", "Include installments".
  - **Dialogs:** "New Thousandth Table" and "Edit Thousandth Table" (560px), with fields "Name", "Order" and "NOTES". The delete question is "Delete the table {name}?".
  - **Wizard:** "Budget Allocation — Accounting entry summary" (680px). The description defaults to "Budget allocation (no.1)". The helper text is "Auto-generated from the approved budget — each owner is charged their share and the revenue account is credited."
  - **Messages:**
    - "Enter a coefficient of zero or more, with at most 4 decimals"
    - "A table named {name} already exists"
    - "{name} allocates {account path}; unlink it first"
    - "This period already has a budget allocation; delete it first"
    - "{account path} has a budget but no table to allocate it"
    - "There is no budget to allocate"
    - "This period has no {owners' | roundings | budget allocation revenue} account"
  - **Account Details:** the mini-grid's header is `% | Table | PR/NP/LE | US/CF | CO | SC | Table restr. on group`. Blank cells read "-", the last column "-None-", and the empty state is "No tables linked — uses parent account settings."
  - **Reasons** (domain codes, worded in the client's reasons maps): `not-a-coefficient`, `blank-name`, `name-taken`, `bad-order`, `table-linked`, `allocation-exists`, `unallocated-budget`, `no-budget`, `missing-account`.
- **Visual tier** (add-on 0.20, AGENTS.md "Visual goldens"):
  - `host/`, `visual.pw.ts` and `playwright.config.ts` stay untouched.
  - A dialog is a component scenario with `capture: "viewport"`.
  - A native `<select>` draws its chosen text as ordinary text.

## Review Focus

1. **An edited coefficient that does not read, or is negative,** is refused where it is typed, and nothing downstream moves: the Total, the group sum and the allocation stay as they were (Task 4 and Task 9 tests).
2. **A table whose coefficients are all 0** (a new table not yet filled in) allocates nothing for the accounts it serves. The Roundings row shows the whole of their budget, and the wizard refuses with `unallocated-budget` (Task 3 and Task 8 tests).
3. **Switching the period with a table selected** starts the new period on its first table and never shows the old period's coefficients (Task 7 test).
4. **Switching the language with a coefficient editor open** keeps the typed text. The cells redraw in the new locale (Task 9 test).
5. **Deleting the budget allocation after installments were planned from it** leaves the installments, lets the wizard post again, and the schedule's shares follow the new entry (Task 8 test).

---

### Task 1: The allocation's data in the seed

**Files:**
- Create:
  - `packages/domain/src/entities/unit.ts` (`Unit`, `UnitGroup`);
  - `packages/domain/src/entities/table.ts` (`ThousandthTable`, `Coefficient`, `TableLink`, `LinkUse`);
  - `packages/domain/src/simulators/seed/legacySeed.allocation.test.ts`.
- Modify:
  - `packages/domain/src/entities/account.ts`, `party.ts`;
  - `packages/domain/src/simulators/seed/legacySeed.ts` (data forms and loader);
  - `packages/legacy-import/src/project/legacySeed.ts` and its synthetic test;
  - the test seed factories under `packages/domain/src/testing/`, which get empty or small data for the new fields;
  - `legacySeed.generated.ts` (regenerated).

**Interfaces:**
- Produces:
  - `interface Unit { id: string; periodId: string; code: string; groupId: string | null; restriction: Restriction | null }`;
  - `interface UnitGroup { id: string; periodId: string; code: string; name: string; parentId: string | null }`;
  - `interface ThousandthTable { id: string; periodId: string; name: string; order: number; notes: string; restrictionGroupId: string | null }`;
  - `interface Coefficient { tableId: string; unitId: string; value: number }` (ten-thousandths);
  - `type LinkUse = "budget" | "finalBalance" | "both"`;
  - `interface RoleShares { 1: number | null; 2: number | null; 3: number | null; 4: number | null }`, each a role row's percentage, `null` when the row's percentage is empty or there is no row;
  - `interface RolePresence { 1: boolean; 2: boolean; 3: boolean; 4: boolean }`, whether the link has a role row of that priority. The algorithm iterates only the present rows: a missing row and an empty percentage are not the same (`ta-legacy.md` §1, "A row with an empty % is not saved").
  - `interface TableLink { id: string; accountId: string; tableId: string; use: LinkUse; percentage: number | null; roles: RoleShares; present: RolePresence }`;
  - `Account.abbreviation: string | null`, `Account.links: TableLink[]` (its own links only);
  - `AccountRole` gains `"budgetAllocation"`;
  - `OwnerParty.unitId: string`, `OwnerParty.share: number | null` and `OwnerParty.ownRestriction: Restriction | null`;
  - `LegacySeed` (and `LegacySeedData`) gains `units: Unit[]`, `unitGroups: UnitGroup[]`, `tables: ThousandthTable[]` and `coefficients: Coefficient[]`.

- [ ] **Step 1: Write the failing tests.**
  - The synthetic generator test:
    - a table with items projects with `value` in ten-thousandths;
    - a link with `type` NULL projects as `use: "both"`;
    - a role row of priority 3 at 100 projects as `roles[3] = 10000`, `present[3] = true`;
    - a resident's own dates project to `ownRestriction`, while `restriction` keeps M2d's rule;
    - the account a stored `estimateDistribution` entry credits gets the role `budgetAllocation`;
    - a unit with two unit periods in one seeded period makes the generator throw.
  - `legacySeed.allocation.test.ts`, over the committed seed:
    - **p1:**
      - 5 tables, in order: Property, General residents, Stairs (restricted to group A's id), Water budget, Water actual;
      - 36 coefficients; A1's coefficient in Property is `1000000`;
      - groups A and B; 8 units;
      - `la49.role` is `"budgetAllocation"`;
      - the Water account's links are `el84` with `use: "budget"` and `el85` with `use: "finalBalance"`.
    - **p36:**
      - 12 tables; 216 coefficients; 18 units; no groups;
      - `r166.ownRestriction` is `{ from: "2013-01-19", to: null }`, and `r167.ownRestriction` is `{ from: null, to: "2013-01-18" }`;
      - every other p36 owner has `ownRestriction` null;
      - `la172.abbreviation` is `"Generali PR"`, and its link is to `dt14` with `roles[1] = 10000`.
    - Every owner party's `unitId` names a unit of its period.
- [ ] **Step 2: Run** the two test files. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The generator follows `ta-legacy.md` §1. The tables come from `distributionTable` and the coefficients from `distributionTableItem`.
  - The links come from `expenseLA2Table` and `expenseLA2Role`. A role's `percentage` is NULL when the dump has a row with NULL; `present` is false when there is no row.
  - `ownRestriction` comes from `unitResident.periodRestriction*` only.
  - Then regenerate: run `gen:data`, then `gen:oracle-fixture`. The oracle fixtures may change only by the new fields. If one changes otherwise, stop and report.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`, and the legacy-import suite with both env vars, showing that the oracle checks ran. Then run `pnpm visual`. Expected: every golden unchanged.
- [ ] **Step 5: Commit** `feat(seed): units, groups, thousandth tables, coefficients and table links`.

### Task 2: The legacy share of one account, per resident

**Files:**
- Create: `packages/domain/src/useCases/allocation/share.ts`, with its test.

**Interfaces:**
- Consumes: Task 1's entities.
- Produces:
  - `type AllocationMode = "budget" | "finalBalance"`;
  - `function legacyRound(x: number, places: number): number`. It returns `Math.round(Number((x * 10 ** places).toPrecision(12))) / 10 ** places`.
  - `interface AllocationInput { period: PeriodDates; accounts: Account[]; tables: ThousandthTable[]; coefficients: Coefficient[]; units: Unit[]; residents: OwnerParty[]; balances: Map<string, Cents>; individual: Map<string, Map<string, Cents>> }`.
    - `balances` is each posting account's balance for the period, debit − credit. It is empty in budget mode.
    - `individual` maps an account to its residents' sums, for `controlUnitResident` accounts.
  - `function shareOf(input: AllocationInput, mode: AllocationMode, accountId: string, residentId: string): Cents`, the spec's rules 1–7.

- [ ] **Step 1: Write the failing tests,** on a `createAllocationInput` fixture of two tables, three units (one with an owner and a tenant, one with two co-owners, one with a resident who has their own dates), a grouping account with two children, and a `controlUnitResident` account. One test for each rule:
  - a grouping account is the sum of its children rounded one by one: pin a case where rounding the sum would differ by a cent;
  - links are inherited from the nearest ancestor;
  - a link whose `use` does not match the mode is skipped;
  - a unit with coefficient 0 gets 0, and a table total of 0 gives 0;
  - election:
    - with a tenant, the owner pays only priority 1 and the tenant priority 3;
    - without one, the owner pays priority 3 too;
    - a `PR 50% / CO 50%` link splits evenly;
  - co-ownership: with percentages 60/40; with one of two empty (that one gets 0); with none (halves);
  - residency: 18/365 and 347/365 prorate the resident with own dates. A resident with only the unit's restriction is not prorated;
  - `controlUnitResident`: 0 in budget mode, the resident's own sum in final-balance mode;
  - `legacyRound`: `legacyRound(0.125, 2)` is `0.13`, `legacyRound(-0.125, 2)` is `-0.12`, and `legacyRound(1.005, 2)` is `1.01`. The last is the 12-digit step.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** The arithmetic is the legacy's own, in floating point and in euros, in this order:

```ts
sub = legacyRound(legacyRound(base * tc * rc * tic * compound, 12), 2);
share = legacyRound(share + sub, 2);
```

  `base` is `cents / 100`. The result goes back to `Cents` with `Math.round(share * 100)`. A day count is inclusive. A missing end runs to the period's end, and a missing start to its beginning.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS. Then run `pnpm mutation-check` on the election range (`<` against `<=`), the empty-percentage co-owner and the own-dates condition. Expected: KILLED.
- [ ] **Step 5: Commit** `feat(domain): the legacy allocation's share of an account`.

### Task 3: The allocation, its tree and the pinned figures

**Files:**
- Create:
  - `packages/domain/src/useCases/allocation/allocation.ts`, with its test;
  - `packages/domain/src/useCases/allocation/allocation.legacy.test.ts` (over the real seed);
  - `packages/domain/src/useCases/allocation/tables.ts`, with its test.

**Interfaces:**
- Consumes: Task 2; M2d's `previousBalancesOf` and `daysOf` (export `daysOf` from `schedule.ts` for this caller); M2c's collections per resident, as `scheduleOf` counts Paid.
- Produces:
  - `interface AllocationColumn { accountId: string; label: string }`, where the label is the abbreviation, else the name;
  - `interface AllocationRow { key: string; kind: "root" | "group" | "unit" | "resident" | "roundings"; label: string; role: string; restriction: string; days: string; amounts: Cents[]; total: Cents; previousBalance: Cents | null; due: Cents | null; paid: Cents | null; children: AllocationRow[] }`.
    - `amounts` follows the columns.
    - The Roundings row has `null` previous balance, due and paid.
  - `interface Allocation { columns: AllocationColumn[]; root: AllocationRow; unallocated: string[] }`, where `unallocated` lists the accounts with a non-zero base that allocate nothing;
  - `interface AllocationBooks { input: AllocationInput; entries: JournalEntry[]; periodLabel: string }`;
  - `function allocationOf(books: AllocationBooks, mode: AllocationMode): Allocation`. The rows follow the spec's "Rows": groups by code, units by code, residents by their unit and then `ownRestriction.from` with nulls first. A unit with one resident is that resident's row, labelled `{unitCode} {name}`. A resident's label adds ` (PR 50%)` when `share` is set;
  - `function tableTotalsOf(coefficients: Coefficient[], tables: ThousandthTable[]): Map<string, number>`;
  - `interface CoefficientNode { key: string; kind: "group" | "unit"; label: string; period: string; value: number; children: CoefficientNode[] }`;
  - `function coefficientsTreeOf(table: ThousandthTable, units: Unit[], groups: UnitGroup[], coefficients: Coefficient[], residents: OwnerParty[], period: PeriodDates): CoefficientNode[]`. It is limited to the table's restriction group, and a group's value is the sum of its units.

- [ ] **Step 1: Write the failing tests.**
  - On the Task 2 fixture:
    - the Roundings row equals each account's total minus Σ residents;
    - group and root rows sum their children;
    - `unallocated` names an account whose only table is all zeros (**Review Focus 2**). Its Roundings cell is its whole budget.
  - `allocation.legacy.test.ts`: every pinned figure of the spec's "Pinned figures":
    - Saturno budget and final balance:
      - the root of 6 columns;
      - the Roundings rows;
      - the ten residents' Totals;
      - the root's Prev. bal. 28892, due 768892 and paid 327997;
    - Pozzetto budget:
      - Σ 3800000;
      - `r162` 16668 on `la172` and Total 168731;
      - `r166` 17097 and `r167` 887 on `la172`, with Totals 89864 and 4663;
      - A18 on "Generali PR+CO" and "Generali CO";
      - the nine Roundings figures and their Total −52;
    - Pozzetto final balance: Σ 3488771, and the "Individual" root 48906.
  - `tables.ts`:
    - Pozzetto's twelve totals (`ta-design.md` §2);
    - Saturno's Stairs tree is group A only, A's value is `10000000`, and its units' Period text is `01/05/2011 - 31/05/2011` for A1.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** The column headers come from `Account.abbreviation`. An account's total for the Roundings row is its budget (for a grouping account, the sum of its children's budgets), or its balance.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(domain): the allocation of a period, as the legacy app drew it`.

### Task 4: The rules for tables, coefficients and the budget allocation entry

**Files:**
- Create:
  - `packages/domain/src/useCases/validateTable.ts`, with its test;
  - `packages/domain/src/useCases/allocation/budgetAllocationDraft.ts`, with its test.
- Modify:
  - `packages/domain/src/useCases/validateEntry.ts` (admit `budgetAllocation`'s 0.00 lines), `canDeleteEntry.ts` (admit `budgetAllocation`), and their tests.

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - `interface TableDraft { name: string; order: number; notes: string }`;
  - `function validateTable(tables: ThousandthTable[], draft: TableDraft, editing: string | null): Result`. It answers `blank-name`, `name-taken` (case-sensitive, ignoring the table itself) and `bad-order` (not a whole number ≥ 1), in that order.
  - `function validateTableDelete(table: ThousandthTable, accounts: Account[]): Result`, which answers `table-linked` and names the first linking account by id in the reason's detail. Follow how `Result` carries a detail today; if it carries none, add an optional `detail: string` to the rejected form and say so in the report.
  - `function validateCoefficient(value: number): Result`, which answers `not-a-coefficient` for a negative value or one that is not an integer of ten-thousandths;
  - `function budgetAllocationDraftOf(allocation: Allocation, books: AllocationBooks, accounts: Account[], description: string): ResultOf<EntryDraft>`.
    - It answers, in this order:
      - `allocation-exists`;
      - `missing-account`, with which one in the detail: `owners`, `roundings` or `budgetAllocation`;
      - `no-budget`;
      - `unallocated-budget`, with the first account in the detail.
    - Otherwise the draft is the spec's: one debit per resident in row order, 0.00 included, then the roundings line on the first resident, then the credit. The roundings line is left out when it is 0.

- [ ] **Step 1: Write the failing tests.**
  - One per reason, and the order where two apply.
  - **Saturno:** over the real seed with `tx5` removed, the draft equals `tx5`'s postings line for line (account, counterpart, debit, credit).
  - **Pozzetto:** with `tx291` removed, it equals `tx291`'s owner lines except `r166` and `r167`. Its roundings are one line of −52 against tx291's 27 lines of −2. The test names both differences.
  - `validateEntry` accepts a `budgetAllocation` with a 0.00 line and still refuses one in a `generic` entry with `empty-line`.
  - `canDeleteEntry` accepts `tx5`.
  - `validateCoefficient`: `-1` and `0.5` are refused; `0` and `1453000` are accepted.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(domain): the rules for tables and coefficients, and the budget allocation's draft`.

### Task 5: The tables and units ports

**Files:**
- Create:
  - `packages/domain/src/ports/tablesPort.ts`, `ports/__contracts__/TablesPortContract.ts`;
  - `packages/domain/src/ports/unitsPort.ts`, `ports/__contracts__/UnitsPortContract.ts`;
  - `packages/domain/src/simulators/tablesSimulator.ts` and `unitsSimulator.ts`, each with its contract test and unit test.
- Modify:
  - `packages/client-core/src/composition.ts` (`AppPorts`, `createSimulatorPorts`);
  - `packages/client-react/src/app/buildPorts.ts`, if it lists the ports.

**Interfaces:**
- Consumes: Task 4's validators.
- Produces:
  - `TablesPort`:
    - `tables(periodId: string): Observable<ThousandthTable[]>`, in order;
    - `coefficients(periodId: string): Observable<Coefficient[]>`;
    - `addTable(periodId: string, draft: TableDraft): Promise<ResultOf<TableAdded>>`, with `TableAdded { id: string }`. A new table gets a 0 coefficient for every unit of the period;
    - `editTable(tableId: string, draft: TableDraft): Promise<Result>`;
    - `deleteTable(tableId: string): Promise<Result>`, which takes the table's coefficients with it;
    - `setCoefficient(tableId: string, unitId: string, value: number): Promise<Result>`.
    - Unknown ids reject (throw), and the reads re-emit after an accepted write. Errors read as the other ports' ("missing: the period <id>").
  - `UnitsPort`: `units(periodId)`, `groups(periodId)`.
  - `createTablesSimulator(seed, accountsOf?: (periodId: string) => Account[])`. The reader defaults to the seed's accounts; `createSimulatorPorts` passes the accounts simulator's current state, in the shape M2d used for journal and installments (a synchronous `current(periodId)` on `AccountsSimulator extends AccountsPort`).
  - `AppPorts.tables` and `AppPorts.units`.

- [ ] **Step 1: Write the failing tests.**
  - Contracts:
    - every read;
    - add, with zeros for every unit, and the refusals `blank-name` and `name-taken`;
    - edit;
    - delete, of an unlinked table and refused `table-linked` for a linked one;
    - `setCoefficient`, accepted and `not-a-coefficient`;
    - re-emission;
    - unknown ids reject.
    - The harness supplies a period, a linked table, an unlinked one and a unit.
  - Over the real seed: deleting `dt14` is refused, and adding "Test" to p36 gives 18 zero coefficients.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Each period's tables and coefficients live in a `BehaviorSubject`, as the other simulators keep their state.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tables): the tables and units ports, and their simulators`.

### Task 6: The parity spec on the new algorithm

**Files:**
- Modify:
  - `packages/legacy-import/specs/features/riparto.feature`, `specs/steps.ts`, `specs/README.md`;
  - `packages/legacy-import/src/project/` where a seed-shaped `AllocationInput` is built from the dump. Reuse Task 1's projection; do not build a second adapter.

**Interfaces:**
- Consumes: Tasks 1–3.

- [ ] **Step 1: Rewrite the scenarios.**
  - Saturno 2011: every resident's budget Total equals the posted `tx5` line.
  - Pozzetto 2013: 25 residents equal the posted `tx291`. `r166` and `r167` equal the legacy report's 898.64 and 46.63.
  - The NOTE says that the posted entry was typed by hand, and the report and the algorithm agree.
  - The one-cent tolerance goes. `buildRiparto`'s own scenarios stay as they are, since the old engine is still the prototype seed's.
- [ ] **Step 2: Run** the specs with both env vars. Expected: FAIL before the steps are rewritten. Then PASS, shown as run, not skipped.
- [ ] **Step 3: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 4: Commit** `test(legacy-import): the allocation parity spec on the legacy algorithm`.

### Task 7: The allocation presenter and the panels' machines

**Files:**
- Create:
  - `packages/client-core/src/presenters/allocationPresenter.ts`, with its test;
  - `packages/client-core/src/machines/allocationMachines.ts`, with its test: the mode, the table selection and the two trees' expansion.
- Modify: `composition.ts`, `index.ts`, `packages/domain/src/index.ts`, and `packages/client-core/src/amounts.ts` (`parseTenThousandths`, `formatTenThousandths`).

**Interfaces:**
- Consumes: Tasks 3–5; the books presenter; the buildings presenter's selected period; the session's amount locale.
- Produces:
  - `interface AllocationPresenter { tables$: DefaultedStateObservable<TableView[]>; allocation$(mode: AllocationMode): DefaultedStateObservable<Allocation | null>; coefficients$(tableId: string | null): DefaultedStateObservable<CoefficientNode[]>; addTable(draft: TableDraft): Promise<ResultOf<TableAdded>>; editTable(id: string, draft: TableDraft): Promise<Result>; deleteTable(id: string): Promise<Result>; setCoefficient(tableId: string, unitId: string, text: string): Promise<Result> }`.
    - `TableView { table: ThousandthTable; total: number; restriction: string }`. `restriction` is the group's name.
    - `setCoefficient` parses the text with `parseTenThousandths` in the session's locale. Unreadable text answers `not-a-coefficient` without a write.
    - `allocation$` and `coefficients$` are built once per argument value; follow how M2d's presenter exposes one stream per argument, or take the argument from a machine's state.
  - `AppPresenters.allocation`;
  - `function parseTenThousandths(text: string, locale: AmountLocale): number | null`: up to 4 decimals and no groups, digit by digit, as `parseHundredths`. A minus is left to the caller;
  - `function formatTenThousandths(value: number, locale: AmountLocale): string`, with 4 decimals and grouping, as `formatAmount` groups;
  - `AppMachines.createTableSelection()`. Its state is `{ tableId: string | null }`, and it starts and restarts on the period's first table when the period changes. Intent: `select`.
  - `AppMachines.createAllocationMode()`, with state `{ mode: AllocationMode }` and intent `choose`;
  - `AppMachines.createCoefficientsGrid()` and `createAllocationGrid()`, in the shape of `scheduleGridMachine`. Everything starts expanded.

- [ ] **Step 1: Write the failing tests.**
  - On the harness:
    - `tables$` for p1 has five tables with Property's total `10000000`;
    - a `setCoefficient(dt1, A1's unit, "200")` re-emits the allocation with A1's Property column changed and the table total `11000000`;
    - `setCoefficient` with `"-1"` and with `"abc"` answers `not-a-coefficient`, and nothing re-emits (**Review Focus 1**).
  - **Review Focus 3:** the table selection on p1 picks `dt1`. Switching to p36 picks `dt14`, and `coefficients$` never emits p1's nodes after the switch.
  - `parseTenThousandths`: `"38"` gives 380000, `"0,022"` in it-IT gives 220, `"1.5"` in it-IT gives null, and `"1.23456"` gives null.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**, in the shape of `installmentSchedulePresenter.ts` and `scheduleGridMachine.ts`.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(allocation): the presenter and the panels' machines`.

### Task 8: The Budget allocation wizard and the table dialog machines

**Files:**
- Create:
  - `packages/client-core/src/machines/wizards/budgetAllocationWizard.ts`, with its test;
  - `packages/client-core/src/machines/tableDialogMachine.ts`, with its test.
- Modify:
  - `journalDialogMachine.ts` (`WizardName` gains `"budgetAllocation"`), `composition.ts`, `index.ts`;
  - `editorOf.ts`, whose test keeps `budgetAllocation` uneditable.

**Interfaces:**
- Consumes: M2b's `createWizardMachine`; Tasks 3, 4 and 7.
- Produces:
  - `interface BudgetAllocationForm { description: string }`;
  - `interface BudgetAllocationSummary { preview: EntryDraft | null }`;
  - `function createBudgetAllocationWizard(books: Books | null, allocation: Allocation | null, write: (draft: EntryDraft) => Promise<ResultOf<EntryAdded>>): WizardMachine<BudgetAllocationForm, BudgetAllocationSummary>`. Its single step's verdict is `budgetAllocationDraftOf`'s.
  - `AppMachines.createBudgetAllocationWizard()`;
  - `interface TableDialogForm { name: string; order: string; notes: string }`;
  - `function createTableDialog(tables: ThousandthTable[], editing: ThousandthTable | null, write: (draft: TableDraft) => Promise<Result>)`, a machine with `edit`, `save` and verdict. Order text that does not read answers `bad-order`. A new table's default order is the highest + 1, or 1;
  - `AppMachines.createTableDialog(editing: string | null)`.

- [ ] **Step 1: Write the failing tests.**
  - The wizard on p1 with `tx5` deleted: the preview equals Task 4's Saturno draft, and Save adds an entry the journal lists. On p1 as seeded it is refused `allocation-exists`.
  - **Review Focus 5:**
    1. on p36, plan installments as M2d's wizard does;
    2. delete `tx291`, then post the allocation again;
    3. the installments are unchanged, and `budgetSharesOf` now gives `r166` 89864.
  - The table dialog: `blank-name`, `name-taken`, `bad-order` for `"0"` and `"x"`, the default order 6 on p1, and Save calls the write with the parsed order.
  - **Review Focus 2:** a new table linked nowhere does not change the wizard's verdict. Over a test seed where an account's only table is all zeros, the verdict is `unallocated-budget`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** The preview calls `budgetAllocationDraftOf` with the presenter's budget allocation, the same call the save makes.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(wizards): Budget allocation, and the thousandth table dialog`.

### Task 9: Bindings and the screen

**Files:**
- Modify:
  - `packages/react-bindings/src/createViewModel.ts`, `viewModel.test.tsx` and `viewModel.page.tsx`;
  - `packages/client-react/src/ui/shell/Screen.tsx`, to route `menu === "thousandths"`;
  - `testids.ts`.
- Create, each with stylesheet, page object and test:
  - `packages/client-react/src/ui/allocation/TablesAllocationScreen.tsx` (reader);
  - `ThousandthTablesPanel.tsx`;
  - `CoefficientsPanel.tsx`;
  - `AllocationPanel.tsx` (each props only, on `TreeGrid`);
  - `allocationReasons.ts`, the messages for the reasons in Global Constraints.

**Interfaces:**
- Produces:
  - `useAllocation()`, which gives `{ tables; allocation; coefficients; mode; chooseMode; selectTable; addTable; editTable; deleteTable; setCoefficient }`;
  - `useCoefficientsGrid()`, `useAllocationGrid()`.

- [ ] **Step 1: Write the failing tests.**
  - The hooks mount over the selected period.
  - The screen on p1:
    - the three panels' headers;
    - five table rows, with Property's Total `1,000.0000`;
    - the coefficients of Property under groups A and B;
    - the Allocation root row's six columns and Total `7,400.00`;
    - a final Roundings row of `0.01`;
    - the disabled controls are disabled.
  - The mode menu switches to "Final balance" and the root Total reads `2,455.19`.
  - An inline coefficient edit of A1 in Property to `200` changes the table Total to `1,100.0000` and A1's share.
  - **Review Focus 1:** `-1` shows the coefficient message in the editor, and the Total is unchanged.
  - **Review Focus 4:** with the editor open on `12,5` in it-IT, switching to en-US keeps `12,5` in the editor.
  - On p36: A04's two residents with Days `347/365` and `18/365`.
  - Print, PDF, XLS, ⟳ and Legend show the notice.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The splits come from M1's split machine.
  - The allocation's columns go through the columns machine: a spec for the fixed columns and one per account column. The first track is `minmax(380px, 1fr)`.
  - Measures and strings follow `ta-design.md` §1–§4.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(allocation): the Thousandth Tables & Allocation screen`.

### Task 10: The dialogs, the wizard and Account Details on screen

**Files:**
- Create, each with page object and test:
  - `packages/client-react/src/ui/allocation/TableDialog.tsx`;
  - `packages/client-react/src/ui/journal/wizards/BudgetAllocationWizard.tsx`;
  - `packages/client-react/src/ui/accounts/AllocationTablesGrid.tsx` (props only).
- Modify:
  - `ThousandthTablesPanel.tsx` (`+`, `✎`, `−` open the dialog and the confirm);
  - `JournalToolbar.tsx`, whose "Budget allocation" item now has `wizard: "budgetAllocation"`;
  - the Journal dialog's wizard switch;
  - `AccountDetails.tsx`, which shows the grid;
  - `DeleteEntryConfirm.tsx`, if it words `budgetAllocation` as not deletable;
  - `testids.ts`.

- [ ] **Step 1: Write the failing tests.**
  - **Tables:**
    - New table "Test": it appears last, is selected, and shows 0 coefficients;
    - edit it to "Test 2" with order 1: it moves first;
    - delete it after confirming;
    - delete Property: refused with "Property allocates {path}; unlink it first".
  - **The wizard end to end:**
    1. on p1, delete `tx5` from the Journal (now allowed);
    2. open "Budget allocation";
    3. the preview shows 11 debit lines and a credit of `7,400.00`;
    4. Save, and the Journal lists the entry.
  - **Account Details:**
    - on p36, `la173` shows its inherited link, with Table "Generale", PR/NP/LE `100%`, the other cells `-` and "-None-";
    - the legend reads "(USES PARENT ACCOUNT SETTINGS)";
    - on p1, the Water account (two links, `use` budget and final balance) reads yes for "Separate tables for budget & final balance", and `la173` reads no;
    - an account with no links keeps the empty state.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** with M2b's `WizardDialog` (680px), `Dialog` (560px), `FormField` and `ConfirmAlert`.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(allocation): table dialogs, the Budget allocation wizard and the account's tables on screen`.

### Task 11: Goldens

**Files:**
- Modify:
  - `packages/client-react/tests/visual/scenarios.ts`, `seeding.ts`, `registry.tsx`;
  - darwin-arm64 goldens;
  - the `placeholder` scenario: change its title to a menu still unbuilt (`"units"` or `"data"`), so it keeps picturing the placeholder.

- [ ] **Step 1: Add the scenarios** (spec "Visual"):
  - `allocation-1280-light`, a page with p1 and `menu: "thousandths"`;
  - component scenarios:
    - `thousandth-tables-panel`;
    - `coefficients-stairs-restricted` (p1, Stairs: group A only);
    - `allocation-panel-final-balance`;
    - `table-dialog-new` and `table-dialog-name-taken` (viewport);
    - `budget-allocation-wizard` (p1 with `tx5` deleted, viewport);
    - `budget-allocation-wizard-refused` (p1 as seeded, `allocation-exists`, viewport);
    - `account-allocation-tables` (p36, `la173`).
- [ ] **Step 2: Run** `pnpm visual:update`. Open each new image and check that it shows what its name says. Then run `pnpm visual` three times: every run passes, and no other golden changes except `placeholder` (retitled).
- [ ] **Step 3: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 4: Commit** `test(visual): Thousandth Tables & Allocation`.

### Task 12: STATUS, IDEAS and the specs

**Files:**
- Modify:
  - `docs/STATUS.md`, `docs/IDEAS.md`;
  - the parent design's "accepted gap" line (`2026-10-11-app-v2-design.md`, Testing table);
  - `packages/legacy-import/specs/README.md`, if Task 6 left it.

- [ ] **Step 1: Update the documents.**
  - **STATUS:**
    - Remove "Budget allocation, in the Tables & Allocation group", with the A04 divergence and the 0/0 lines.
    - Reword "Unit groups and the Units entity": the entities and `UnitsPort` exist; the schedule does not draw groups yet.
    - Update "The rest of the Buildings module for M2", since Tables & Allocation is built.
    - Add **Retire the old allocation engine:** `buildRiparto`, `recomputePeriod` and the prototype's seed `data.generated.json` have no caller but the generator. Remove them together.
    - Add **Edit an account's allocation tables:** the Edit Account dialog.
    - Set the date.
  - **IDEAS:** meters (the "Counter" column); Group rows/cols and Include installments, which the legacy app disabled; a table's restriction group made editable.
  - **Parent design:** the "resident 166/167 swap stays pinned as an accepted gap" becomes "M2e's allocation reproduces both periods; the posted A04 lines were typed by hand", linking the M2e spec.
- [ ] **Step 2: Run** `pnpm gate:full:quiet`, `pnpm check:doc-links` and `pnpm check:status`. Expected: PASS.
- [ ] **Step 3: Commit** `docs: STATUS, IDEAS and the parent design after M2e`.
