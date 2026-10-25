# M2c — Record owner collection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Record owner collection wizard, with its edit and delete, on installment schedules projected read-only from the legacy dump.

**Architecture:** Installments and their items enter the domain, the seed and a new read-only `InstallmentsPort`. A collection's owner credit lines name the item they pay (`Posting.installmentItemId`), and what an item still owes is derived from those lines. The domain gains the derivation, the oldest-first settlement and the write rules. The core gains a three-step wizard on M2b's `createWizardMachine`, and the client draws it in M2b's `WizardDialog`.

**Tech Stack:** TypeScript, RxJS with `@rx-state/core`, React 19 with the React Compiler, Vitest, Playwright (the visual add-on 0.19).

**Spec:** `docs/superpowers/specs/2026-10-24-m2c-owner-collection-design.md`. Its parents, for shapes not repeated here: the M2b spec `docs/superpowers/specs/2026-10-17-m2b-invoices-opening-edit-design.md` and the M2a spec. The facts gathered for the spec (dump ids, amounts, file:line) are in `.superpowers/m2c/facts.md` in the worktree (git-ignored).

## Global Constraints

- Work in the worktree `../condo-ledger-worktrees/m2c-collection`, branch `worktree-m2c-collection`; one pull request at the end.
- Every task ends with `pnpm fix`, then `pnpm gate:full:quiet` green, then a commit. A red gate is not a finished task.
- AGENTS.md's code rules hold everywhere: function declarations, named object types, `#/` imports past one folder, no `useMemo`/`useCallback`/`memo`, no inline styles, test ids in `packages/client-react/src/ui/testids.ts`, UI tests through page objects, fake timers and no sleeps, fixture factories named `create…`, tests before helpers in a test file, an export only with its first caller (knip).
- The seed module `packages/domain/src/simulators/seed/legacySeed.generated.ts` is only rewritten by `pnpm --filter @cl/legacy-import gen:data`. The dump lives only in the project checkout: run generators and dump-backed tests with `LEGACY_DUMP_DIR=/Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/old/db` and `DESIGN_ORACLE_DIR=/Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/docs/design/web/v1/reports/pozzetto`, and show they ran, not skipped. Ids only in committed files: no real names.
- Amounts are `Cents`. Amount text is en-US (`1,234.56`) through M2a's `parseAmount`, as M2a and M2b pin it.
- Ids the generator gives: installments `in<legacy id>`, items `ii<legacy id>`; residents `r…`, persons `md…`, accounts `la…`, entries `tx…`. Seeded periods: `p36` Pozzetto 2013, `p1` Saturno 2011.
- Exact copy (the spec's):
  - wizard name "Record Owner Collection"; an edit's title "Edit Record Owner Collection";
  - step titles "Choose an owner", "Amount and liquidity account", "Description";
  - persons grid `Name | Units | Total inst. | Paid | Inst. balance`; empty state "No owner has an installment to pay.";
  - liquidity list header "LIQUIDITY ACCOUNT COLLECTED INTO"; field `Amount collected *`; hint "The amount is allocated against the owner's outstanding installments, oldest first.";
  - settlement table `Installment | Unit | Due | Owed | Paid now`, the last row marked "partial" when it is;
  - `over-owed`: "{person} owes {total} in all.";
  - generated description "Collection of installments from {person}: {list}", `{list}` = "{installment name} ({dd/mm/yyyy})" joined by ", ";
  - toolbar item "Record collection" (it exists).
- Visual tier (add-on 0.19, AGENTS.md "Visual goldens" and "The pyramid"): `host/`, `visual.pw.ts` and `playwright.config.ts` stay untouched; the project's files are `scenarios.ts`, `seeding.ts`, `registry.tsx`, `framing.ts`, `tolerance.ts`. A dialog is a component scenario mounted alone with `capture: "viewport"`. Every native `<select>` draws its chosen text as ordinary text over the control.

## Review Focus

1. **Stale owed amount.** A second collection for the same person lands (through the port) while the wizard is open; the wizard's save is refused with `over-remaining-item`, the dialog stays open, and the summary shows what the person owes now (Task 5 test).
2. **A seeded collection saved unchanged.** Editing p1's `tx6` (a hand split) or `tx167` (lines in a non-oldest order) and saving without changing the amount writes the same lines in the same order (Task 5 test).
3. **The exact total and one cent over.** An amount equal to everything the person owes is accepted and settles every open item; one cent more is `over-owed` (Task 1 and Task 5 tests).
4. **A person across several units.** p1's `md3` (residents `r1`, `r2`, `r6`, `r8`): the settlement walks due date first, then installment number, then unit code, across all four (Task 1 and Task 5 tests).
5. **Delete reopens.** Deleting a collection puts its person back in step 1's list with the amount it paid owed again (Task 4 contract and Task 7 screen test).

---

### Task 1: Installments and the settlement in the domain

**Files:**
- Create: `packages/domain/src/entities/installment.ts`, `packages/domain/src/useCases/installments.ts`, `packages/domain/src/useCases/collection.ts`
- Modify: `packages/domain/src/entities/journal.ts` (`Posting.installmentItemId?`), `packages/domain/src/index.ts`
- Test: `packages/domain/src/useCases/installments.test.ts`, `packages/domain/src/useCases/collection.test.ts`

**Interfaces:**
- Produces:
  - `Installment { id; periodId; number; name; dueDate }` and `InstallmentItem { id; installmentId; residentId; amount: Cents }`, exactly as the spec writes them;
  - `Posting.installmentItemId?: string`;
  - `ItemBalance { item: InstallmentItem; installment: Installment; paid: Cents; remaining: Cents }`;
  - `function itemBalances(items: InstallmentItem[], installments: Installment[], entries: JournalEntry[]): ItemBalance[]`: `paid` sums the credits of `collection` entries' lines naming the item;
  - `function owedBy(personId: string, parties: Party[], balances: ItemBalance[]): ItemBalance[]`: the items of every `OwnerParty` with that `personId`, `remaining > 0`, ordered by due date, then installment number, then the party's `unitCode`;
  - `Settlement { item: InstallmentItem; amount: Cents }`;
  - `function settleOldestFirst(amount: Cents, open: ItemBalance[]): ResultOf<Settlement[]>`: pays each in order until spent, the last possibly partial; `0` gives `[]`; rejected `over-owed` above the total remaining;
  - `function collectionPostings(accountId: string, settlements: Settlement[], accounts: Account[]): ResultOf<Posting[]>`: `accountId` debited with the total, no counterpart, first; then per settlement a credit on the owners-role account of the account's period with `{ kind: "owner", id: item.residentId }` and `installmentItemId`. Rejected `no-owners-account` when the period has none. (The spec's `person` argument is not needed: the counterpart is the item's resident.)
- Exports go into `index.ts` only with their first non-test caller (Task 2 or later), per knip.

- [ ] **Step 1: Write the failing tests**, on a local `createSchedule()` helper below the tests (two residents `rA` unit `A1` and `rB` unit `B1` of one person `mdX`, a third `rC` of `mdY`; installments `in1` due `2013-01-20` and `in2` due `2013-02-20`; items `iiA1` 10000, `iiB1` 5000, `iiA2` 3000, `iiB2` 0, `iiC1` 7000):
  - `itemBalances`: a collection paying `iiA1` 4000 and then another paying 6000 gives `iiA1` paid 10000 remaining 0; a credit naming `iiA1` on a `generic` entry does not count; a zero item has remaining 0;
  - `owedBy("mdX", …)` is `[iiA1, iiB1, iiA2]` in that order (due date, then unit code), and leaves out `iiB2` (zero) and `iiC1` (another person);
  - `settleOldestFirst`: 12000 over that list gives `iiA1` 10000, `iiB1` 2000; exactly 18000 settles all three; 18001 is rejected `over-owed`; 0 gives `[]`;
  - `collectionPostings("la156", …)` gives the debit 12000 first, then two owner credits with their items and residents; rejected `no-owners-account` for a chart without the role.
- [ ] **Step 2: Run** `pnpm --filter @cl/domain test -- installments collection`. Expected: FAIL (modules not found).
- [ ] **Step 3: Implement** the three files.
- [ ] **Step 4: Run** the same command. Expected: PASS. Then `pnpm mutation-check` (mutants JSON outside the repo) on the ordering keys, the partial-last branch and the `over-owed` comparison. Expected: KILLED.
- [ ] **Step 5: Commit** `feat(domain): installments, what each item still owes, and the oldest-first settlement`.

### Task 2: The write rules for a collection

**Files:**
- Modify: `packages/domain/src/useCases/validateEntry.ts`, `canDeleteEntry.ts`, `canEditEntry.ts`
- Test: `validateEntry.test.ts`, `canDeleteEntry.test.ts`, `canEditEntry.test.ts`

**Interfaces:**
- Consumes: Task 1's entities and `itemBalances`.
- Produces: `EntryContext` gains `installments: Installment[]` and `installmentItems: InstallmentItem[]`; `validateEntry` adds, after `opening-exists` and in this order, `item-not-allowed`, `item-required`, `unknown-item`, `wrong-resident`, `over-remaining-item` (the spec's table; lines on one item added together; on an edit, `replacing` leaves the edited entry out as for every rule); `canDeleteEntry` and `canEditEntry` accept `collection`.

- [ ] **Step 1: Write the failing tests:** one per new reason; `over-remaining-item` on an add (two lines on one item that together exceed it) and on an edit (the entry's own payment added back); M2a's reasons keep their order (a blank description with an unknown item still answers `blank-description`); `canDeleteEntry` and `canEditEntry` accept a `collection`, and still refuse `budgetAllocation` and `closingBalances`. Every existing caller of `EntryContext` in tests gets `installments: [], installmentItems: []` where it builds one.
- [ ] **Step 2: Run** `pnpm --filter @cl/domain test -- validateEntry canDeleteEntry canEditEntry`. Expected: FAIL.
- [ ] **Step 3: Implement.** Callers outside the domain that build an `EntryContext` (`contextOf` in client-core, the journal simulator) pass empty lists until Task 4 fills them.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS. `pnpm mutation-check` on the `over-remaining-item` comparison and the `replacing` exclusion. Expected: KILLED.
- [ ] **Step 5: Commit** `feat(journal): the rules a collection is judged by`.

### Task 3: Installments and the link in the seed

**Files:**
- Modify: `packages/domain/src/simulators/seed/legacySeed.ts` (shape and loader), `packages/legacy-import/src/project/legacySeed.ts` (emit), `packages/legacy-import/src/project/legacySeed.synthetic.test.ts`, `packages/domain/src/simulators/seed/legacySeed.generated.ts` (regenerated)
- Create: `packages/domain/src/simulators/seed/legacySeed.collections.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: `LegacySeed.installments: Installment[]` and `LegacySeed.installmentItems: InstallmentItem[]` (flat lists; an item's period is its installment's), with plain-number data forms beside `AccountData`; collection credit lines carry `installmentItemId`.

- [ ] **Step 1: Write the failing tests.**
  - The synthetic generator test gains one installment row, one item row and a collection line naming the item: projected as `in…`, `ii…`, and `installmentItemId` on that line only.
  - `legacySeed.collections.test.ts`, over the committed seed:
    - p36 has 12 installments numbered 1–12 by due date (`2013-01-20` … `2013-12-20`) and 324 items, 150 of them zero; p1 has 3 installments and 30 items;
    - every item's resident is a party of its period;
    - every owner-account credit of a `collection` entry names one item of its own resident (111 lines over p36 and p1), and no other line names one;
    - at period end, `itemBalances` gives p36 paid 2182598, remaining 1176590, non-zero items 95 fully paid, 1 partly (`ii789`: paid 14124 of 17938), 78 unpaid; p1 paid 327997, remaining 440895, 7 / 2 / 20;
    - for each p36 collection in number order and for p1's `tx166` and `tx168`, `settleOldestFirst` of its debit amount over `owedBy` its person, with the entries before it, gives its lines (items and amounts, in order).
- [ ] **Step 2: Run** `pnpm --filter @cl/domain test -- legacySeed.collections` and `pnpm --filter @cl/legacy-import test -- synthetic`. Expected: FAIL.
- [ ] **Step 3: Implement.** The generator reads `installment` and `installmentItem` for each period (the existing `src/project/installments.ts` shows the reading; it serves the old prototype JSON and is not reused for ids), numbers installments by `expiryDate`, keeps zero items, and sets `installmentItemId` from `ledgerEntry.installmentItemId` only on collection credits. Regenerate: `gen:data`, then `gen:oracle-fixture`; the two oracle fixtures must come out byte-identical (`git diff --stat`).
- [ ] **Step 4: Run** `pnpm gate:full:quiet`, and the legacy-import suite with both env vars (showing the oracle checks ran). Expected: PASS. Then `pnpm visual`: no golden changes.
- [ ] **Step 5: Commit** `feat(seed): installment schedules and the items each collection pays`.

### Task 4: The installments port, the journal judging collections, and the books

**Files:**
- Create: `packages/domain/src/ports/installmentsPort.ts`, `packages/domain/src/ports/__contracts__/InstallmentsPortContract.ts`, `packages/domain/src/simulators/installmentsSimulator.ts` (with `installmentsSimulator.contract.test.ts`)
- Modify: `packages/domain/src/simulators/journalSimulator.ts`, `packages/domain/src/ports/__contracts__/JournalPortContract.ts`, `packages/client-core/src/composition.ts` (`AppPorts.installments`, `createSimulatorPorts`), `packages/client-core/src/presenters/booksPresenter.ts`, `packages/client-core/src/machines/wizards/choices.ts` (`contextOf`), `packages/client-core/src/testing/createBooks.ts`, `packages/client-react/src/app/buildPorts.ts` (only if it lists ports by name)

**Interfaces:**
- Produces:
  - `interface InstallmentsPort { installments(periodId: string): Observable<Installment[]>; items(periodId: string): Observable<InstallmentItem[]> }`, erroring with M2a's `missing:` message for an unknown period;
  - `function createInstallmentsSimulator(seed: LegacySeed): InstallmentsPort`;
  - `AppPorts.installments`;
  - `Books.installments` and `Books.installmentItems`, read with the rest;
  - `contextOf(books, replacing)` fills the two new `EntryContext` fields.

- [ ] **Step 1: Write the failing tests.**
  - `InstallmentsPortContract`: a seeded period's installments and items read back; an unknown period errors. Run against the simulator.
  - `JournalPortContract` grows (with a collection draft from a `create…` factory in the contract harness): a collection lands and `itemBalances` over the entries shows its items paid; a line above an item's remaining is refused `over-remaining-item`; `replaceEntry` of a collection keeps id, number and stamp; deleting it reopens its items.
  - `booksPresenter.test.ts`: `books$` carries p36's 12 installments and 324 items, and switches with the period.
- [ ] **Step 2: Run** `pnpm --filter @cl/domain test` and `pnpm --filter @cl/client-core test`. Expected: FAIL on the new tests.
- [ ] **Step 3: Implement.** The journal simulator builds each write's `EntryContext` with the period's installments and items from the seed it already receives (the schedule does not change in M2c).
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(installments): the port, its simulator, and collections judged against the schedule`.

### Task 5: The Record owner collection wizard machine, and its editor

**Files:**
- Create: `packages/client-core/src/machines/wizards/collectionWizard.ts` and its test
- Modify: `packages/client-core/src/composition.ts` (`AppMachines.createCollectionWizard`), `packages/client-core/src/machines/journalDialogMachine.ts` (`WizardName` gains `"collection"`), `packages/client-core/src/machines/wizards/editorOf.ts`, `packages/client-core/src/index.ts`, `packages/client-react/src/ui/journal/JournalWizard.tsx` (a `"collection"` guard returning null until Task 7, as M2b did)

**Interfaces:**
- Consumes: Tasks 1–4; M2b's `createWizardMachine`, `WriteEntry`, `replacing`, `liquidityChoices`, `contextOf`, `todayOf`, `parseAmount`, `formatDate`.
- Produces:
  - `interface CollectionForm { personId: string | null; accountId: string | null; amount: string; description: string; edited: string[] }`;
  - `interface PersonRow { personId: string; name: string; units: string[]; total: Cents; paid: Cents; remaining: Cents }`;
  - `interface SettlementRow { itemId: string; installment: string; unitCode: string; dueDate: string; owed: Cents; paidNow: Cents; partial: boolean }`;
  - `interface CollectionSummary { people: PersonRow[]; owed: Cents | null; settlement: SettlementRow[] }` (`owed`: what the chosen person owes in all, the edited entry's own payment added back; null with none chosen);
  - `function createCollectionWizard(books: Books | null, clock: ClockPort, write: WriteEntry, editing: JournalEntry | null, latest?: () => Books | null): WizardMachine<CollectionForm, CollectionSummary>`;
  - `AppMachines.createCollectionWizard(editing: string | null)`;
  - `editorOf(collection)` is `"collection"` when the entry fits (one debit on a `liquidityChoices` account; every credit names an item of residents of one person), else null.

- [ ] **Step 1: Write the failing tests**, on the harness over the real seed:
  - **p36, step 1:** `people` lists only persons with something owed, in unit order; a person whose items are all zero is absent; `no-owner` until one is chosen.
  - **Choosing a person** prefills the account with the bank-role `la156`, the amount with what they owe on items due by the harness's today (all of it, since every due date is past), and the description "Collection of installments from {name}: Rata …".
  - **Nothing due yet:** with `fixedClock("2012-12-01T10:00:00Z")` (before every p36 due date), the amount starts at the remaining of the person's first open item.
  - **The settlement** follows the amount: a smaller amount settles fewer items and marks the last `partial`; `0` and `abc` are `not-an-amount`; one cent above `owed` is `over-owed` (Review Focus 3).
  - **p1, `md3`:** the settlement walks `r1`, `r2`, `r6`, `r8`'s items by due date, then unit code (Review Focus 4).
  - **A save** lands, and the person's `remaining` in `people` falls by the amount.
  - **Stale owed** (Review Focus 1): open the wizard on a person, save a collection of everything they owe through `harness.ports.journal`, then save from the wizard: `over-remaining-item`, `saving` back to false, and `summary.owed` is now 0.
  - **Editing** p1's `tx6` and `tx167` (Review Focus 2): starts at step 2 (`firstStep` 2), `back()` stays there, the form holds the entry's account and amount; saving unchanged writes the same lines in the same order and keeps the number. Changing the amount recomputes oldest first and regenerates the description; a description typed during the edit is kept.
  - **`editorOf`** gives `"collection"` for all 40 seeded collections.
- [ ] **Step 2: Run** `pnpm --filter @cl/client-core test -- collectionWizard editorOf`. Expected: FAIL.
- [ ] **Step 3: Implement** to the spec's "Record owner collection" and "Editing" sections, modelled on `invoicePaymentWizard.ts` (steps, prefill that follows until edited, `latest` re-read after a refused save, `formOf` an edited entry). The kept-lines rule: while `parseAmount(form.amount)` equals the edited entry's debit, the draft reuses the entry's credit lines as written.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS. `pnpm mutation-check` on the kept-lines comparison and the due-by-today prefill.
- [ ] **Step 5: Commit** `feat(wizards): the Record owner collection wizard`.

### Task 6: Bindings

**Files:**
- Modify: `packages/react-bindings/src/createViewModel.ts`, `viewModel.test.tsx`, `viewModel.page.tsx`

**Interfaces:**
- Produces: `useCollectionWizard(editing: string | null)`, a `WizardView` of the machine, reading its argument on the first render only, as the other wizard hooks do. Export from client-core's index only the types the hook needs.

- [ ] **Step 1: Write the failing test:** the hook mounts its machine over the selected period, and with `editing` set to a seeded collection shows that entry's form.
- [ ] **Step 2: Run** `pnpm --filter @cl/react-bindings test`. Expected: FAIL.
- [ ] **Step 3: Implement** on `useMachine`.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(bindings): the collection wizard`.

### Task 7: The wizard on screen

**Files:**
- Create: `packages/client-react/src/ui/journal/wizards/CollectionWizard.tsx`, `SettlementTable.tsx` (each with stylesheet, page object and test)
- Modify: `JournalToolbar.tsx` ("Record collection" opens the wizard), `JournalWizard.tsx` (route it; remove Task 5's guard), `reasons.ts` (the new reasons' messages), `WizardDialog.page.tsx`, `Wizards.test.tsx`, `JournalScreen.page.tsx`, `JournalScreen.test.tsx`, `testids.ts`

**Interfaces:**
- Consumes: Task 6's hook, M2b's `WizardDialog`, `SelectableList`, the liquidity list as `InvoicePaymentWizard` draws it, `Money`.
- Produces: `SettlementTable { rows: SettlementRow[] }`, props only.

- [ ] **Step 1: Write the failing tests.**
  - `Wizards.test.tsx`: choose a person in the grid, Next, see the amount prefilled, the hint and the settlement, lower the amount and see the last row marked "partial", Next, see the generated description, Save, and see the entry revealed in the grid; an amount above what is owed shows "{person} owes {total} in all."; with every installment paid, the empty state shows; editing a seeded collection titles "Edit Record Owner Collection" and opens at step 2.
  - `SettlementTable.test.tsx`: the columns, and "partial" on the last row only when it is.
  - `JournalScreen.test.tsx` (Review Focus 5): record a collection for a Pozzetto owner, reopen the wizard and see their balance fallen, edit the collection's amount with ✎, delete it, reopen the wizard and see the balance back.
- [ ] **Step 2: Run** `pnpm --filter @cl/client-react test -- Wizards SettlementTable JournalScreen`. Expected: FAIL.
- [ ] **Step 3: Implement** to the spec's "Client" section and M2b's wizard measures (680px dialog, label width 200); amounts through `Money`, en-US.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(journal): the Record owner collection wizard on screen`.

### Task 8: Goldens, STATUS and IDEAS

**Files:**
- Create: `packages/client-react/tests/visual/registry.tsx` (from `tools/templates/visual.packages__client-react__tests__visual__registry.tsx.txt`), the darwin-arm64 goldens of the new scenarios
- Modify: `packages/client-react/tests/visual/scenarios.ts`, `seeding.ts`; `docs/STATUS.md`; `docs/IDEAS.md`

- [ ] **Step 1: Add the scenarios** (AGENTS.md "The pyramid"; the first component scenarios of this project, so `registry.tsx` starts here, with `Surround` giving the app's theme root):
  - `collection-wizard-owner`: `level: "component"`, `mount: "collection-wizard"`, `capture: "viewport"`, p36, light, step 1;
  - `collection-wizard-amount`: the same mount, step 2 for one p36 person with an amount typed that leaves the last settled item partial;
  - `collection-settlement-partial`: `level: "component"`, `mount: "settlement-table"`, root capture, three rows from the scenario's props, the last partial.

  State goes in through the harness and the machine's own intents (`seeding.ts`), or as props for the table; never clicks.
- [ ] **Step 2: Run** `pnpm visual:update`, open each new image and check it shows what its name says; `pnpm visual` five times, every run passing; `git status` shows only the new images.
- [ ] **Step 3: Update the documents.**
  - STATUS: remove M2c from "Next, with no plan yet"; add there **Budget allocation** (with units, thousandth tables, residency dates and the engine in the app, the 0/0 lines, the engine's Pozzetto divergence) under the Tables & Allocation group, and **Installment schedules** (creating and editing a schedule, the Installment Schedule screen, whether `startingBalance` follows the opening entry) under the Installments group, each linking this spec; set the date.
  - IDEAS: a collection above what is owed held as a credit or an advance (the legacy app refused it; so does M2c).
  - The linux-x64 images are not a STATUS entry: they come from the `Update visual goldens` workflow in the closing steps.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`, `pnpm check:doc-links`, `pnpm check:status`. Expected: PASS.
- [ ] **Step 5: Commit** `test(visual): the collection wizard and its settlement; docs: STATUS and IDEAS for M2c`.
