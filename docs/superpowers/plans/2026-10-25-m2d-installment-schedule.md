# M2d — Installment Schedule — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Installment Schedule screen, read from the period's stored data, with Create budget installments, Edit installment, Delete installment and an item's amount edited in its cell.

**Architecture:**
- The domain builds the schedule's tree (`scheduleOf`) from what the books already hold.
- The domain also plans new installments with the legacy algorithm (`planBudgetInstallments`), and judges every schedule write.
- `InstallmentsPort` gains four writes. Its simulator and the journal simulator each read the other's current state, so a collection is judged against the schedule as it is now, and an installment is refused while a collection names its items.
- The core gains a presenter over the books, a grid machine, the create wizard (M2b's `createWizardMachine`) and an edit dialog machine. The client draws them with M1's `TreeGrid` and `InlineEditor` and M2b's `WizardDialog`.

**Tech Stack:**
- TypeScript, RxJS with `@rx-state/core`, React 19 with the React Compiler;
- Vitest, and Playwright through the visual add-on 0.19.

**Spec:** `docs/superpowers/specs/2026-10-25-m2d-installment-schedule-design.md`. It is the authority. Its parents, for shapes not repeated here, are the M2c spec (`2026-10-24-m2c-owner-collection-design.md`: installments, items, `itemBalances`, `InstallmentsPort`) and M2b's (the wizard machine, `WizardDialog`, `ConfirmAlert`). The survey behind the spec (dump ids, amounts, legacy file:line) is in `.superpowers/installments/facts.md` in the worktree. That file is git-ignored.

## Global Constraints

- **Where and how to work:**
  - Work in the worktree `../condo-ledger-worktrees/installments`, branch `worktree-installments`, and open one pull request at the end.
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
- **Amounts:** they are `Cents`. Amount text is en-US (`1,234.56`) through `parseAmount`, and dates show as dd/mm/yyyy.
- **Ids:**
  - periods `p36` (Pozzetto 2013) and `p1` (Saturno 2011);
  - residents `r…`, installments `in…`, items `ii…`;
  - entries: Pozzetto budget allocation `tx291`, opening `tx100`; Saturno `tx5` and `tx1`.
  - New installment and item ids are the simulator's own, for example `in-new-1`; they never collide with seeded ids.
- **Exact copy (the spec's):**
  - **Menu and screen:** "Installment Schedule"; "Group rows by: By unit".
  - **Add menu:** "Create advance installment", "Create budget installments", "Create adjustment installment". The first and third, "Recalculate from budget", "Shift due dates" and "Delete all installments" show M2a's "not built yet" notice; the last three are not in the menus.
  - **Edit menu:** `Edit "{name}"`, or "No installments to edit.".
  - **Delete menu:** `Delete "{name}"` (unlocked only), or "No installments to delete.".
  - **Delete confirmation:** "Delete the installment “{name}”? This cannot be undone.".
  - **Columns:** `Groups / Units / Owners | Role | Restr. period | Days | Prev. bal. | Total budget | Total due | {n} {dd/mm/yyyy}… | Total inst. | Paid | Inst. bal. | Overdue`. A locked installment's header shows 🔒. The final row is "Roundings".
  - **Restriction text:** "{from} - end of FY", "start of FY - {to}", "{from} - {to}". Days read "{days}/{period days}".
  - **Wizard** "Create Budget Installments", with steps "Number and dates", "Installments", "Review".
    - Step 1 fields: "Number of installments", "Due date of the first", "Months between installments", "Round to whole euros".
    - Step 2 columns: "Name", "Due date", "% of budget".
    - The default name is `Installment {k}`.
  - **Dialog** "Edit Installment", with fields "Name", "Due date", "Locked".
  - **Reasons:** `no-budget-allocation`, `percentages-not-100`, `name-taken`, `blank-name`, `installment-locked`, `installment-paid`, `item-paid`, `not-an-amount`, `negative-amount`.
- **Colours:** settled `--ok`; partial `--partial` `#e0892b`; unsettled `--unsettled` `#2a6fdb`. Add tokens only where none already means the same.
- **Visual tier** (add-on 0.19, AGENTS.md "Visual goldens"):
  - `host/`, `visual.pw.ts` and `playwright.config.ts` stay untouched.
  - A dialog is a component scenario with `capture: "viewport"`.
  - A native `<select>` draws its chosen text as ordinary text.

## Review Focus

1. **Save writes what step 3 showed.** The review's per-resident amounts are the items the port then holds, to the cent (Task 7 test).
2. **Nothing a collection names is removed or changed.**
   - Deleting an installment with a paid item is refused `installment-paid`.
   - Editing a paid item's amount is refused `item-paid`.
   - After M2c deletes the collection, both are accepted (Task 5 contract, Task 10 screen test).
3. **A second batch adds only what the first left out.** Over Pozzetto's existing schedule, every resident's new items total `SB + B − Σ existing`, or zero after the credit carry (Task 3 test).
4. **The root row matches the printed schedule.**
   - Pozzetto: Prev. bal. −6,250.99, Total budget 38,000.00, Total inst. 33,591.88, Paid 21,825.98, Inst. bal. 11,765.90.
   - Saturno: 288.92, 7,400.00, 7,688.92, 3,279.97, 4,408.95 (Task 2 test).
5. **A collection after a schedule edit is judged against the edited schedule.** After an item's amount is lowered, a collection above the new amount is refused `over-remaining-item` (Task 5 contract).

---

### Task 1: Roles, restrictions and locks in the seed

**Files:**
- Modify:
  - `packages/domain/src/entities/party.ts`, `packages/domain/src/entities/installment.ts`;
  - `packages/domain/src/simulators/seed/legacySeed.ts` (data forms and loader);
  - `packages/legacy-import/src/project/legacySeed.ts` and its synthetic test;
  - the test seed factories under `packages/domain/src/testing/`, which get `role`, `restriction` and `locked`;
  - `legacySeed.generated.ts` (regenerated).
- Create: `packages/domain/src/simulators/seed/legacySeed.schedule.test.ts`.

**Interfaces:**
- Produces:
  - `interface Restriction { from: string | null; to: string | null }` (ISO dates, in `party.ts`);
  - `OwnerParty.role: string` (`"PR"`, `"CO"`, … the legacy abbreviation) and `OwnerParty.restriction: Restriction | null` (the resident's own restriction, else its unit's);
  - `Installment.locked: boolean`.

- [ ] **Step 1: Write the failing tests.**
  - The synthetic generator test: a resident with a priority, a unit restriction and a locked installment project as `role`, `restriction` and `locked`. A resident's own restriction wins over its unit's.
  - `legacySeed.schedule.test.ts`, over the committed seed:
    - p36: `r166` is `{ from: "2013-01-19", to: null }`, `r167` is `{ from: null, to: "2013-01-18" }`, `r188.role` is `"CO"`, and every other p36 resident has `restriction` null.
    - p1:
      - the residents of A1 are `{ from: "2011-05-01", to: "2011-05-31" }`;
      - A2's are `{ from: "2011-05-27", to: null }`;
      - A3's are `{ from: null, to: "2011-05-27" }`;
      - `r3.role` and `r7.role` are `"CO"`;
      - installment `in1` is locked, and every other installment of both periods is unlocked.
    - Every owner party has a non-empty `role`.
- [ ] **Step 2: Run** the two test files. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Role:** the generator reads the role abbreviation the legacy app showed (`unitResidentPriorityId` with the unit period's `unitOwnershipScenarioId` into `unitResidentRole`; facts §4).
  - **Restriction:** `unitResident.periodRestriction*`, else the unit's.
  - **Locked:** `installment.locked`.
  - **Regenerate:** run `gen:data`, then `gen:oracle-fixture`. Both oracle fixtures must come out byte-identical.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`, and the legacy-import suite with both env vars (showing that the oracle checks ran). Then run `pnpm visual`. Expected: every golden unchanged.
- [ ] **Step 5: Commit** `feat(seed): residents' roles and period restrictions, and locked installments`.

### Task 2: The schedule's tree

**Files:**
- Create:
  - `packages/domain/src/useCases/schedule.ts`, with its test;
  - `packages/domain/src/useCases/budgetShares.ts`, with its test.

**Interfaces:**
- Consumes: Task 1's fields; M2c's `itemBalances(items, installments, entries)`.
- Produces:
  - `interface BudgetShares { shares: Map<string, Cents>; roundings: Cents; found: boolean }`;
  - `function budgetSharesOf(entries: JournalEntry[], accounts: Account[]): BudgetShares`.
    - `shares` comes from the `budgetAllocation` entry's lines on the owners-role account, by counterpart resident, as debit − credit.
    - `roundings` is the sum of that entry's lines on the roundings-role account, as debit − credit.
    - `found` is false when the period has no such entry.
  - `function previousBalancesOf(entries: JournalEntry[], accounts: Account[], parties: Party[]): Map<string, Cents>`.
    - It reads the `opening` entry's owners-account lines by resident, as debit − credit.
    - Without an opening entry, each owner party's `startingBalance`.
  - `type CellStatus = "settled" | "partial" | "unsettled"`;
  - `interface ScheduleCell { installmentId: string; itemId: string | null; amount: Cents | null; paid: Cents; status: CellStatus | null }`;
  - `interface ScheduleNode { key: string; kind: "root" | "unit" | "resident" | "roundings"; label: string; residentId: string | null; role: string; restriction: Restriction | null; days: string; previousBalance: Cents; budget: Cents; due: Cents; cells: ScheduleCell[]; totalInstallments: Cents; paid: Cents; balance: Cents; overdue: Cents; children: ScheduleNode[] }`;
  - `interface ScheduleInput { periodLabel: string; period: { start: string; end: string }; accounts: Account[]; parties: Party[]; entries: JournalEntry[]; installments: Installment[]; installmentItems: InstallmentItem[] }`. Declare the period's shape as a named interface.
  - `interface Schedule { installments: Installment[]; root: ScheduleNode }`, with installments in number order;
  - `function scheduleOf(input: ScheduleInput, today: string): Schedule`.
    - The tree follows the spec's "Rows": root, then units in unit-code order. A unit with one resident is that resident's node, labelled `{unitCode} {name}`. Otherwise the unit's node is labelled `{unitCode}` and has one child per resident. The Roundings node comes last, only when `roundings` is not 0, with budget = due = roundings and every other amount 0.
    - The columns follow the spec's table.
    - `days` is `"{covered}/{period days}"` for a restricted resident, counting both ends, and `""` otherwise.
    - Overdue sums the remaining of items with `dueDate < today`.
    - A cell's status: amount 0 or null gives null; otherwise paid ≥ amount is settled, paid > 0 is partial, and paid 0 is unsettled. Unit and root cells apply the same rule to their sums.

- [ ] **Step 1: Write the failing tests.**
  - `budgetSharesOf` and `previousBalancesOf` on a small `create…` fixture: a missing entry, debit − credit, and the fallback to `startingBalance`.
  - Over the real seed, on p36:
    - `budgetSharesOf` gives `r162` 168731, `r166` 89880 and roundings −54, with Σ shares + roundings = 3800000;
    - `previousBalancesOf` equals each party's `startingBalance`;
    - `scheduleOf(…, "2026-10-14")`'s root is previousBalance −625099, budget 3800000, totalInstallments 3359188, paid 2182598, balance 1176590 and overdue 1176590. It has a Roundings node of −54.
  - Over the real seed, on p1: the root is 28892 / 740000 / 768892 / 327997 / 440895, with Roundings 1.
  - `scheduleOf` on the real seed:
    - A04 is a unit node with children `r167` then `r166`, in residency order (by `restriction.from`, nulls first);
    - `r166.days` is `"347/365"` and `r167.days` is `"18/365"`;
    - `ii789`'s cell is partial;
    - a zero item's status is null;
    - overdue is 0 with today `"2012-12-01"`;
    - p36's Pozzetto A01 cell for installment 1 sums its residents.
- [ ] **Step 2: Run** the test files. Expected: FAIL.
- [ ] **Step 3: Implement** the two files. Export from `packages/domain/src/index.ts` only what Task 6's presenter will call (knip), when Task 6 adds the call. Until then, keep the tests importing by path.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS. Then run `pnpm mutation-check` on the overdue comparison (`<` against `<=`), the status thresholds and the restriction fallback. Expected: KILLED.
- [ ] **Step 5: Commit** `feat(domain): the installment schedule's tree`.

### Task 3: Planning budget installments

**Files:**
- Create: `packages/domain/src/useCases/planInstallments.ts`, with its test.

**Interfaces:**
- Consumes: Task 2's `budgetSharesOf` and `previousBalancesOf`.
- Produces:
  - `interface PlannedInstallment { name: string; dueDate: string; percentage: number }` (percentage in hundredths of a percent, so 3333 = 33.33%);
  - `interface PlanInput { installments: PlannedInstallment[]; wholeEuros: boolean; residents: string[]; shares: Map<string, Cents>; previousBalances: Map<string, Cents>; existingItems: InstallmentItem[] }`;
  - `interface PlannedItem { installmentIndex: number; residentId: string; amount: Cents }`;
  - `function planBudgetInstallments(input: PlanInput): PlannedItem[]`, the spec's algorithm. `prevPart` is SB when `existingItems` is empty, else 0, and `budgetPart = SB + B − Σ existing − prevPart`.
  - `function defaultPercentages(count: number): number[]`: `floor(100/n)`, in whole percent × 100, with the first taking the rest. So 3 gives `[3400, 3300, 3300]`, and 12 gives `[1200, 800 ×11]`.
  - `function dueDates(first: string, count: number, months: number): string[]`: the day is clamped to the month's last, so `2013-01-31` monthly gives `2013-02-28`.

- [ ] **Step 1: Write the failing tests.**
  - The algorithm's steps on a hand fixture:
    - percentages split to cents, half-up;
    - whole euros, where items 2..n are rounded to euros and item 1 takes the rest;
    - SB on item 1;
    - a negative item carried forward;
    - a negative carried backward from the last;
    - a credit that exceeds everything is dropped (all 0);
    - a second batch over existing items.
  - **Reproduction over the real seed:**
    - p36, with percentages `defaultPercentages(12)`, cents, and existing items empty: each resident's planned items equal its stored items for 25 of 27 residents. The test pins that the two others are exactly `r166` and `r167`.
    - p1, with `[3334, 3333, 3333]` and whole euros: 9 of 10, pinning `r1` as the one off by 1 cent.
  - **Review Focus 3:** a second batch of 2 installments over p36's existing items. Every resident's new items total `max(0, SB + B − Σ existing)` once the carry is applied (r170 and r176 total 0).
  - `defaultPercentages(3)`, `defaultPercentages(12)`, `dueDates("2013-01-31", 3, 1)` and `dueDates("2011-03-15", 3, 4)`, which gives `["2011-03-15", "2011-07-15", "2011-11-15"]`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Half-up rounding is on integers: cents, or hundreds of cents for whole euros. No floating point reaches an amount.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS. Then run `pnpm mutation-check` on the carry direction, the dropped credit, the `prevPart` condition and the rounding. Expected: KILLED.
- [ ] **Step 5: Commit** `feat(domain): budget installments planned as the legacy app did`.

### Task 4: The rules a schedule write is judged by

**Files:**
- Create: `packages/domain/src/useCases/validateSchedule.ts`, with its test.

**Interfaces:**
- Consumes: Task 3's `PlannedInstallment`; M2c's `itemBalances`.
- Produces:
  - `interface ScheduleContext { installments: Installment[]; items: InstallmentItem[]; entries: JournalEntry[]; budgetFound: boolean }`;
  - `function validateCreate(context: ScheduleContext, planned: PlannedInstallment[]): Result`. It answers `no-budget-allocation`, `blank-name`, `name-taken` (against the existing names and the others in the batch), and `percentages-not-100` (Σ ≠ 10000), checked in that order.
  - `interface InstallmentPatch { name?: string; dueDate?: string; locked?: boolean }`;
  - `function validateUpdate(context: ScheduleContext, installmentId: string, patch: InstallmentPatch): Result`.
    - It answers `blank-name` and `name-taken`, ignoring the installment's own name.
    - It also answers `installment-locked` when the installment is locked and the patch changes its name or due date. Unlocking alone is accepted.
  - `function validateDelete(context: ScheduleContext, installmentId: string): Result`, which answers `installment-locked`, then `installment-paid` (any item of it with `paid > 0`).
  - `function validateItemAmount(context: ScheduleContext, itemId: string, amount: Cents): Result`, which answers `negative-amount`, `installment-locked`, then `item-paid`.

- [ ] **Step 1: Write the failing tests.** One per reason, and the order where two apply, on a `create…` fixture with one paid item. The real seed's `ii789` (partly paid) is refused `item-paid`, and a p36 zero item is accepted.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** The unknown-id cases throw, as the journal rules do for an id the port does not hold: the port rejects them before judging.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(domain): the rules a schedule write is judged by`.

### Task 5: The port's writes, and the two simulators reading each other

**Files:**
- Modify:
  - `packages/domain/src/ports/installmentsPort.ts`, `ports/__contracts__/InstallmentsPortContract.ts`;
  - `simulators/installmentsSimulator.ts` and its contract test;
  - `simulators/journalSimulator.ts`, `ports/__contracts__/JournalPortContract.ts`;
  - `packages/client-core/src/composition.ts` (`createSimulatorPorts`);
  - the test seed (`createTwoPeriodSeed.ts` or its base), which needs a period with a budget allocation entry, an opening entry and no installments.

**Interfaces:**
- Consumes: Tasks 3 and 4.
- Produces:
  - `InstallmentsPort` gains:
    - `createInstallments(periodId: string, draft: InstallmentsDraft): Promise<Result>`, with `InstallmentsDraft { installments: PlannedInstallment[]; wholeEuros: boolean }`. The port plans the items itself with `planBudgetInstallments` from its own books and judges them with `validateCreate`, so what is saved is what the domain plans.
    - `updateInstallment(installmentId: string, patch: InstallmentPatch): Promise<Result>`;
    - `deleteInstallment(installmentId: string): Promise<Result>`, which removes the installment's items too;
    - `setItemAmount(itemId: string, amount: Cents): Promise<Result>`.
    - Each write rejects (throws) for an unknown id or period. The reads re-emit after an accepted write, and `number` stays the rank by due date, then by id.
  - `createInstallmentsSimulator(seed, entriesOf?: (periodId: string) => JournalEntry[])`, and `createJournalSimulator(seed, clock, scheduleOf?: (periodId: string) => PeriodSchedule)`.
    - `PeriodSchedule { installments: Installment[]; items: InstallmentItem[] }` is exported from the installments simulator's file.
    - Each optional reader defaults to the seed's fixed data, so existing tests stand.
    - `createSimulatorPorts` wires the two to each other through these readers.
    - Each simulator object also carries a synchronous `current(periodId)` beside its port methods for the other to read. That member is not in the port interface: type the simulators as `InstallmentsSimulator extends InstallmentsPort` and `JournalSimulator extends JournalPort`.

- [ ] **Step 1: Write the failing tests.**
  - `InstallmentsPortContract` grows:
    - create on the empty-schedule period: the planned items land, and a refusal leaves everything unchanged;
    - update, with a rename and `installment-locked`;
    - delete: an unpaid installment goes, and a paid one is refused `installment-paid`;
    - `setItemAmount`, accepted and `item-paid`;
    - the reads re-emit;
    - an unknown id rejects.
    - The harness supplies the period, a paid installment and item, and an unpaid one.
  - The composed ports, in a client-core test of `createSimulatorPorts` over the real seed (Review Focus 2 and 5):
    - a collection paying an item makes its installment refuse delete; deleting the collection through `journal.deleteEntry` makes delete accept;
    - lowering an unpaid item to 10.00 makes a collection of 20.00 on it refused `over-remaining-item`.
- [ ] **Step 2: Run** the domain and client-core tests. Expected: FAIL.
- [ ] **Step 3: Implement.** The installments simulator keeps each period's schedule in a `BehaviorSubject`, as the journal simulator keeps entries.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(installments): the schedule written through the port, judged against the journal`.

### Task 6: The schedule presenter and grid machine

**Files:**
- Create:
  - `packages/client-core/src/presenters/installmentSchedulePresenter.ts`, with its test;
  - `packages/client-core/src/machines/scheduleGridMachine.ts`, with its test.
- Modify: `packages/client-core/src/composition.ts`, `packages/client-core/src/index.ts`, `packages/domain/src/index.ts`.

**Interfaces:**
- Consumes: Task 2's `scheduleOf`; Task 4's validators, for the cell's editable verdict; Task 5's writes; the books presenter; the clock (`todayOf`).
- Produces:
  - `interface InstallmentSchedulePresenter { schedule$: DefaultedStateObservable<Schedule | null>; cellEditable: (itemId: string) => Result; updateInstallment(id: string, patch: InstallmentPatch): Promise<Result>; deleteInstallment(id: string): Promise<Result>; setItemAmount(itemId: string, amount: Cents): Promise<Result> }`. `cellEditable` is `validateItemAmount` with the item's current amount.
  - `AppPresenters.schedule`;
  - `ScheduleGridState { rows: ScheduleNode[]; expanded: string[] }`, where `rows` is the visible nodes in order with their depth. Name a type for that. Intents are `toggle`, `expandAll` and `collapseAll`. Everything starts expanded.
  - `AppMachines.createScheduleGrid()`.

- [ ] **Step 1: Write the failing tests.**
  - On the harness, `schedule$` for p36 carries the root totals from Task 2 and switches with the period.
  - A `setItemAmount` re-emits the schedule with the new amount.
  - `cellEditable` refuses `ii789` with `item-paid`.
  - The grid machine collapses A04 and shows it again.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**, in the shape of `accountsPresenter.ts` and `accountsGridMachine.ts`.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(schedule): the presenter and the grid`.

### Task 7: The create wizard and the edit dialog machines

**Files:**
- Create:
  - `packages/client-core/src/machines/wizards/budgetInstallmentsWizard.ts`, with its test;
  - `packages/client-core/src/machines/installmentDialogMachine.ts`, with its test.
- Modify: `composition.ts`, `index.ts`.

**Interfaces:**
- Consumes: M2b's `createWizardMachine`; Tasks 3–6.
- Produces:
  - `interface BudgetInstallmentsForm { count: string; firstDue: string; months: string; wholeEuros: boolean; rows: InstallmentRowForm[] }` and `InstallmentRowForm { name: string; percentage: string }`, where the percentage is text like `"33.33"`. Due dates are derived, not in the form.
  - `interface BudgetInstallmentsSummary { dueDates: string[]; review: ReviewRow[]; total: Cents }` and `ReviewRow { residentId: string; label: string; budget: Cents; previousBalance: Cents; due: Cents; items: Cents[]; total: Cents }`.
  - `function createBudgetInstallmentsWizard(books: Books | null, write: (draft: InstallmentsDraft) => Promise<Result>): WizardMachine<BudgetInstallmentsForm, BudgetInstallmentsSummary>`.
    - The rows follow the count, with default names and `defaultPercentages`.
    - Changing the count resets the percentages. A typed name is kept.
  - `AppMachines.createBudgetInstallmentsWizard()`;
  - `interface InstallmentDialogForm { name: string; dueDate: string; locked: boolean }`;
  - `function createInstallmentDialog(installment: Installment, write: (patch: InstallmentPatch) => Promise<Result>)`, a machine with `edit`, `save` and verdict, like the wizards' single step;
  - `AppMachines.createInstallmentDialog(installmentId: string)`.

- [ ] **Step 1: Write the failing tests**, on the harness's empty-schedule period.
  - Step 1's verdicts: `no-budget-allocation` on a period without one; count outside 1–12, months outside 1–5 and a blank date are each refused with a reason of the step's own (choose names, in the reasons style).
  - Step 2's verdicts: `percentages-not-100` and `name-taken`.
  - **Review Focus 1:** step 3's `review` items equal what the port holds after Save, per resident, to the cent.
  - On p36, a second batch's review gives r170 all zeros.
  - The dialog: Locked disables a name change (verdict `installment-locked`) and saves an unlock.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** The review calls `planBudgetInstallments` with the books' data, the same call the port makes.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(wizards): Create budget installments, and the installment dialog`.

### Task 8: Bindings

**Files:**
- Modify: `packages/react-bindings/src/createViewModel.ts`, `viewModel.test.tsx`, `viewModel.page.tsx`.

**Interfaces:**
- Produces:
  - `useSchedule()` gives `{ schedule; cellEditable; updateInstallment; deleteInstallment; setItemAmount }`;
  - `useScheduleGrid()`;
  - `useBudgetInstallmentsWizard()`;
  - `useInstallmentDialog(installmentId: string)`, which reads its argument on the first render only.
  - Export from client-core's index only the types these need.

- [ ] **Step 1: Write the failing test.** The hooks mount over the selected period, and the schedule shows p36's root budget.
- [ ] **Step 2: Run** `pnpm --filter @cl/react-bindings test`. Expected: FAIL.
- [ ] **Step 3: Implement** on `useMachine` and the presenter pattern of the other hooks.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(bindings): the installment schedule`.

### Task 9: The screen

**Files:**
- Create, each with stylesheet, page object and test:
  - `packages/client-react/src/ui/installments/InstallmentScheduleScreen.tsx` (reader);
  - `ScheduleToolbar.tsx`;
  - `ScheduleGrid.tsx` (props only, on `TreeGrid`);
  - `InstallmentCell.tsx` (props only: amount, status, editable, editing).
- Modify:
  - `packages/client-react/src/ui/shell/Screen.tsx`, to route `menu === "installments"`;
  - `testids.ts`;
  - `src/styles/tokens.css`, for `--partial` and `--unsettled` unless tokens already mean them.

**Interfaces:**
- Consumes: Task 8's hooks; M1's `TreeGrid`, `InlineEditor`, `Money` and the columns machine; M2b's `ConfirmAlert`.

- [ ] **Step 1: Write the failing tests.**
  - The screen on p36:
    - the columns' headers, including `1 20/01/2013` and so on;
    - the root row's totals (Task 2's figures, formatted en-US);
    - A04 with its two residents, their restriction text and days;
    - a partial cell has `data-status="partial"`;
    - a locked header (p1's `1`) shows 🔒.
  - An inline edit of an unpaid zero item to `10.00` updates the cell and the row's Total inst. An edit on `ii789` is not offered, and its title gives the `item-paid` reason.
  - **Delete:** the menu lists only unlocked installments. Confirming on an unpaid one removes its column. On a paid one, the refusal toast gives `installment-paid`'s message.
  - Advance, adjustment and the other notice items show the notice.
  - Collapse and expand.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Write the reasons' messages in one sentence each, in the style of `ui/journal/wizards/reasons.ts`: a schedule reasons map beside it, or a new file under `ui/installments`.
  - Column widths go through the columns machine, with a spec for the fixed columns and one per installment.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(installments): the Installment Schedule screen`.

### Task 10: The wizard and the dialog on screen

**Files:**
- Create, each with page object and test:
  - `packages/client-react/src/ui/installments/BudgetInstallmentsWizard.tsx`;
  - `InstallmentDialog.tsx`.
- Modify: `ScheduleToolbar.tsx` (open them), `InstallmentScheduleScreen.tsx`, `testids.ts`.

- [ ] **Step 1: Write the failing tests.**
  - The wizard end to end on a period with no schedule: step 1 defaults (3, 4 months), a first date, Next, step 2's three rows `Installment 1…3` with 34/33/33, a percentage changed to break 100 shows the reason, Next, step 3's review, Save, and the screen shows three new columns.
  - On p36, `Edit "Rata 3"` renames it, and the header shows the new name's number and date.
  - **Review Focus 2, as a screen test:**
    1. record a collection (M2c's wizard) on an unpaid p36 item;
    2. delete that installment, and see the refusal;
    3. delete the collection;
    4. delete the installment, and see its column gone.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** with M2b's `WizardDialog` (680px) and `FormField`.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(installments): Create budget installments and Edit installment on screen`.

### Task 11: Goldens, STATUS and IDEAS

**Files:**
- Modify:
  - `packages/client-react/tests/visual/scenarios.ts`, `seeding.ts`, `registry.tsx`;
  - darwin-arm64 goldens for the new scenarios;
  - `docs/STATUS.md`, `docs/IDEAS.md`;
  - the M2c spec's sentence that stored items "cannot be recomputed".

- [ ] **Step 1: Add the scenarios:**
  - `installments-1280-light`, a page with p36 and the screen;
  - `installment-cell-states`, a component with one cell per status and one editable, from props;
  - `budget-installments-wizard-step2`, a component with `capture: "viewport"`, a period with no schedule, and step 2 reached through the machine's intents;
  - `installment-dialog`, a component with `capture: "viewport"` and p1's locked `Rata nr. 1`.
- [ ] **Step 2: Run** `pnpm visual:update`. Open each new image and check that it shows what its name says. Run `pnpm visual` five times: every run passes and no existing golden changes.
- [ ] **Step 3: Update the documents.**
  - **STATUS:**
    - Remove "Installment schedules" from "Next".
    - Add **Unit groups and the Units entity** under the Building Data & Units group: Saturno's A and B are not drawn, and rows are units then residents. Link this spec.
    - Update "Visual goldens as a pyramid" with the new component scenarios.
    - Set the date.
  - **IDEAS:** advance and adjustment installments (never implemented by the legacy app), "Recalculate from budget", "Shift due dates", "Delete all installments", and the Overdue colour the legacy app drew (red past due) against the design's three colours.
  - **M2c spec:** the sentence that stored items "cannot be recomputed by any formula the app has" becomes "are reproduced by M2d's planning, 25/27 and 9/10, see the M2d spec".
- [ ] **Step 4: Run** `pnpm gate:full:quiet`, `pnpm check:doc-links` and `pnpm check:status`. Expected: PASS.
- [ ] **Step 5: Commit** `test(visual): the installment schedule; docs: STATUS and IDEAS for M2d`.
