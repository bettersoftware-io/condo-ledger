# M2b — Invoices, opening balances and editing an entry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The New invoice, Invoice payment and Opening balances wizards, `✎` on an entry, and the delete of invoices, payments and openings, on the in-memory simulators.

**Architecture:** Invoices join the journal port, written in one step with their registration entry; the open amount is derived from the payments that name an invoice. The domain gains the invoice arithmetic and the write rules (`validateEntry` over an `EntryContext`, `canDeleteEntry`, `canEditEntry`); the core gains three wizard machines on M2a's `createWizardMachine`, which now writes through either `addEntry` or `replaceEntry` and judges each step; the client draws them in M2a's `WizardDialog`.

**Tech Stack:** TypeScript, RxJS with `@rx-state/core`, React 19 with the React Compiler, Vitest, Playwright (visual tier).

**Spec:** `docs/superpowers/specs/2026-10-17-m2b-invoices-opening-edit-design.md`. Its parent for shapes not repeated here: `docs/superpowers/specs/2026-10-14-m2a-journal-design.md`.

## Global Constraints

- Work in the worktree `../condo-ledger-worktrees/m2b-journal`, branch `worktree-m2b-journal`; one pull request at the end.
- Every task ends with `pnpm fix`, then `pnpm gate:full:quiet` green, then a commit. A red gate is not a finished task.
- AGENTS.md's code rules hold everywhere: function declarations, named object types, `#/` imports past one folder, no `useMemo`/`useCallback`/`memo`, no inline styles, test ids in `packages/client-react/src/ui/testids.ts`, UI tests through page objects, fake timers and no sleeps, fixture factories named `create…`, tests before helpers in a test file.
- The seed module `packages/domain/src/simulators/seed/legacySeed.generated.ts` is only ever rewritten by `pnpm --filter @cl/legacy-import gen:data`, never by hand. The dump lives in `old/db` on this machine only. Ids only in committed files: no real names in tests, fixtures or goldens' names.
- Amounts are `Cents` (integers). A `Rate` is hundredths of a percent: `400` is 4%, `2000` is 20%. Every product of an amount and a rate is rounded half up to the cent, at each step.
- Ids the generator gives: invoices `li<legacy id>`; suppliers keep `md…`, residents `r…`, accounts `la…`, entries `tx…`.
- Exact copy (the spec's, or this plan's where marked):
  - wizard names: "New Invoice Entry", "Invoice Payment", "Opening Balances Entry"; an edit's title is "Edit {name}";
  - invoice steps: "Select supplier", "Calculate withholding";
  - payment steps: "Select invoice", "Liquidity account and amount", "Description";
  - pills: "Company", "Professional w/ register", "Professional w/o register", "With non-subject amounts";
  - generated descriptions: "Invoice {number} — {supplier}: {reason}", "Payment of invoice {number} — {supplier}", "Opening balances";
  - liquidity list header: "SELECT A MOVABLE LIQUIDITY ACCOUNT";
  - tranche note: "You may pay an invoice in several tranches: enter an amount lower than the invoice total to settle it partially; the remainder can be paid later.";
  - empty payment grid: "No invoice is waiting to be paid.";
  - messages:
    - "The invoice still owes {remaining}.";
    - "This invoice has payments: its supplier cannot change.";
    - "Payments already made total {paid}.";
    - "This invoice has payments. Delete them first.";
  - opening list: "Transaction balance", "Show only rows with an amount";
  - this plan's own wording:
    - "{supplier} already has an invoice {number} in this period." (the duplicate warning);
    - "This kind of entry is edited through its own flow, which is not built yet." (`kind-not-editable`).
- The visual add-on's `host/` stays untouched; scenarios go through `scenarios.ts` and `seeding.ts`. Every native `<select>` draws its chosen text through `ChoiceSelect`'s overlay.

## Review Focus

1. **Italian-formatted amounts in the invoice form.** `2.588,05` in Taxable must give 258805 cents, as M2a's `parseAmount` does for its fields (Task 6 test).
2. **The entry vanishes while its edit is open.** The port then rejects `replaceEntry`. The person should see a message and keep the dialog, with no unhandled rejection (Task 5 test).
3. **A stale remaining amount.** A payment saved after another payment of the same invoice has landed must show "The invoice still owes {remaining}." from the port, and the dialog must stay open (Task 7 test).
4. **Switching supplier after the prefill.** Fields the person edited stay as typed; the others take the new supplier's last invoice, or the defaults when it has none (Task 6 test).
5. **Zero and negative amounts in the opening list.** A row with `0` or `0,00` writes nothing. A row with `-50` is `not-an-amount` and names the row (Task 8 test).

---

### Task 1: Invoice arithmetic

**Files:**
- Create: `packages/domain/src/entities/invoice.ts`, `packages/domain/src/useCases/invoice.ts`
- Modify: `packages/domain/src/index.ts` (exports)
- Test: `packages/domain/src/useCases/invoice.test.ts`

**Interfaces:**
- Produces, in `entities/invoice.ts`:
  - `type Rate = number & { readonly __rate: unique symbol }` and `function rate(hundredthsOfAPercent: number): Rate`, which throws on a negative or non-integer value;
  - `WithholdingTax { periodId: string; code: string; name: string; rate: Rate; accountId: string }`. The spec's shape gains `periodId`, as `Account` has one, so the seed can hold one list;
  - `InvoiceTerms`, `Invoice` and `InvoiceTotals`, exactly as the spec writes them.
- Produces, in `useCases/invoice.ts`:
  - `function percentOf(amount: Cents, r: Rate): Cents`, rounded half up;
  - `function invoiceTotals(terms: InvoiceTerms, withholdingRate: Rate | null): InvoiceTotals`;
  - `function invoicePostings(terms: InvoiceTerms, catalogue: WithholdingTax[], accounts: Account[]): ResultOf<Posting[]>`. It is rejected with `no-suppliers-account` when the period has no suppliers-role account, and with `unknown-withholding` when `withholdingCode` is not in the catalogue for the terms' period.

- [ ] **Step 1: Write the failing tests** (`invoice.test.ts`):
  - `invoiceTotals` on Saturno's invoice: taxable 18237, social security 400, VAT 2000, non-taxable 0, withholding rate 400, `withholdingOnSocialSecurity: true` → `{ socialSecurity: 729, invoiceTaxable: 18966, vat: 3793, total: 22759, withholdingBase: 18966, withholding: 759, dueToSupplier: 22000 }`.
  - Pozzetto's invoice: taxable 258805, VAT 2000, rate 400, no social security → `total: 310566, withholding: 10352, dueToSupplier: 300214`.
  - Rounding half up: taxable 30015, VAT 2000, rate 400 → `vat: 6003, total: 36018, withholding: 1201` (12.006 rounds to 12.01). Also `percentOf(cents(125), rate(200))` is `3`.
  - No withholding code: `withholding: 0` and `dueToSupplier === total`.
  - `invoicePostings` with code `"1020"` → account `la168`. Posting `[{ cost la200 D 36018 }, { suppliers C 34817 counterpart { kind: "supplier", id: "md78" } }, { la168 C 1201 }]`, with no counterpart on the first and the third. Without a code, two postings. Rejected `unknown-withholding` for code `"9999"`; rejected `no-suppliers-account` for a chart without the role. Build the chart with a local `createChart()` helper below the tests.
- [ ] **Step 2: Run** `pnpm --filter @cl/domain test -- invoice`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the two files. `percentOf` is `Math.round(amount * r / 10000)` (amounts and rates are never negative here). The posting order is fixed by the spec: cost, suppliers, tax.
- [ ] **Step 4: Run** the same command. Expected: PASS. Then run `pnpm mutation-check` with mutants on `percentOf`'s rounding, `withholdingOnSocialSecurity`'s branch and the withholding line's guard. Expected: all KILLED.
- [ ] **Step 5: Commit** `feat(domain): invoice terms, totals and postings`.

### Task 2: Invoices, the catalogue and the period's residents in the seed

**Files:**
- Modify:
  - `packages/domain/src/entities/journal.ts`
  - `packages/domain/src/entities/party.ts`
  - `packages/domain/src/simulators/seed/legacySeed.ts`
  - `packages/domain/src/simulators/accountsSimulator.ts` (parties per period)
  - `packages/legacy-import/src/project/legacySeed.ts`
  - `packages/domain/src/simulators/seed/legacySeed.generated.ts` (regenerated)
- Create: `packages/domain/src/useCases/openInvoices.ts`, `packages/domain/src/simulators/seed/legacySeed.invoices.test.ts`
- Test: `packages/domain/src/useCases/openInvoices.test.ts`, `packages/legacy-import/src/project/legacySeed.test.ts` (extend)

**Interfaces:**
- Consumes: Task 1's types, `invoicePostings`.
- Produces:
  - `JournalEntry.invoiceId: string | null`;
  - `EntryDraft.invoice?: InvoiceTerms` and `EntryDraft.invoiceId?: string`;
  - `OwnerParty.startingBalance: Cents`;
  - `LegacySeed` gains `invoices: Invoice[]` and `withholdingTaxes: WithholdingTax[]`, and `parties` becomes `PeriodParties[]` with `interface PeriodParties { periodId: string; parties: Party[] }`. The data forms (`InvoiceData`, `WithholdingTaxData`, `PartyData`) hold plain numbers, as `AccountData` does;
  - `function openInvoices(invoices: Invoice[], entries: JournalEntry[], withholdingTaxes: WithholdingTax[]): OpenInvoice[]` with `OpenInvoice { invoice: Invoice; totals: InvoiceTotals; paid: Cents; remaining: Cents }`;
  - `function paidOn(invoiceId: string, entries: JournalEntry[]): Cents`: the suppliers-account debits of the `invoicePayment` entries that name the invoice. The suppliers account is the debit posting with a supplier counterpart.

- [ ] **Step 1: Write the failing tests.**
  - `openInvoices.test.ts`:
    - an invoice due 300214 with three payments of 100000, 100000 and 100214 is not open; with two of them it is open with `paid: 200000, remaining: 100214`;
    - ordering: due date ascending, `null` last, then date, then number;
    - a payment naming another invoice does not count.
  - `legacySeed.invoices.test.ts`, over the committed seed:
    - for every invoice of `p36` (47) and `p1` (2), `invoicePostings(invoice, …)` equals its registration entry's postings, in order;
    - every registration and every payment of those periods has an `invoiceId` that is among the period's invoices;
    - `openInvoices` for `p36` is exactly 8 invoices;
    - the `p36` catalogue maps `1004→la166`, `1019→la167`, `1020→la168`, `1040→la165`, and `1004`'s rate is 0;
    - `p36` has 27 residents and 12 suppliers, and `p1` has 10 residents, of whom 2 are tenants;
    - every counterpart a seeded posting of a period names is among that period's parties;
    - the owner lines of `p36`'s opening entry equal each named resident's `startingBalance` (a positive balance on the debit side), and its one other line is the bank `la156`, debited 625099.
  - The generator test (`legacySeed.test.ts`) gains the projection of one invoice row and one withholding row, on the synthetic rows its other tests use.
- [ ] **Step 2: Run** `pnpm --filter @cl/domain test -- openInvoices legacySeed.invoices`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **The generator** emits:
    - every `ledgerInvoice` of a period as an invoice. The fields map to `InvoiceTerms`: `welfareTaxPercentage` → `socialSecurityRate`, `totalTaxFreeAmount` → `nonTaxable`, `expiryDate` → `dueDate`. `costAccountId` is the account of the registration's single debit line. `entryId` is the registration's;
    - `invoiceId` on each entry from `ledgerTransaction.ledgerInvoiceId`;
    - the `withholdingTax` rows joined with `withholdingTax2LA` for each period;
    - the parties per period: the building's `condominiumSupplier` suppliers, and the `unitResident` rows whose residency overlaps the period, owners and tenants, each with its `startingBalance`.

    The legacy percentages are percent decimals: multiply by 100 to get a `Rate`.
  - **The loader** converts the data forms.
  - **`accountsSimulator.parties(periodId)`** answers that period's list. It errors with M2a's `missing:` message for an unknown period.
  - **Regenerate:** `pnpm --filter @cl/legacy-import gen:data`, then `pnpm --filter @cl/legacy-import gen:oracle-fixture`. The two oracle fixtures must come out byte-identical; check with `git diff --stat`.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS. Then run `pnpm visual`: the four Accounts goldens and the journal goldens must not change, because the tree still makes control rows from postings.
- [ ] **Step 5: Commit** `feat(seed): invoices, the withholding catalogue and each period's suppliers and residents`.

### Task 3: The write rules, the journal port's new commands, and the books

**Files:**
- Modify:
  - `packages/domain/src/useCases/validateEntry.ts`, `canDeleteEntry.ts`
  - `packages/domain/src/ports/journalPort.ts`, `accountsPort.ts`
  - `packages/domain/src/ports/__contracts__/JournalPortContract.ts`, `AccountsPortContract.ts`
  - `packages/domain/src/simulators/journalSimulator.ts`, `accountsSimulator.ts`
  - `packages/domain/src/useCases/journal.ts` (`JournalEntryView.editable`)
  - `packages/client-core/src/presenters/booksPresenter.ts`, `journalPresenter.ts`
  - `packages/client-core/src/machines/wizards/wizard.ts` (`judged`)
  - `packages/client-core/src/machines/wizards/choices.ts` (`contextOf`)
  - `packages/client-core/src/testing/createBooks.ts`
- Create: `packages/domain/src/useCases/canEditEntry.ts`
- Test: `validateEntry.test.ts`, `canDeleteEntry.test.ts`, `canEditEntry.test.ts`, `journalSimulator.test.ts`, `booksPresenter.test.ts`, `journalPresenter.test.ts`, and the contracts

**Interfaces:**
- Consumes: Task 2's entities, `invoicePostings`, `openInvoices`, `paidOn`.
- Produces:
  - `interface EntryContext { accounts: Account[]; parties: Party[]; withholdingTaxes: WithholdingTax[]; invoices: Invoice[]; entries: JournalEntry[]; replacing: string | null }`, where `replacing` is the id of the entry an edit rewrites, left out of `entries` for every rule;
  - `function validateEntry(draft: EntryDraft, context: EntryContext): Result`;
  - `function canDeleteEntry(entry: JournalEntry, entries: JournalEntry[]): Result`;
  - `function canEditEntry(entry: JournalEntry): Result`;
  - `JournalEntryView.editable: Result`;
  - `JournalPort.invoices(periodId): Observable<Invoice[]>` and `JournalPort.replaceEntry(entryId, draft): Promise<Result>`;
  - `AccountsPort.withholdingTaxes(periodId): Observable<WithholdingTax[]>`;
  - `Books` gains `invoices: Invoice[]`, `withholdingTaxes: WithholdingTax[]`, and `period: PeriodDates`, with `interface PeriodDates { start: string; end: string }` taken from the building tree's period. `createBooksPresenter` gains the buildings presenter's `tree$` as an argument; a period the tree does not hold yet gives `books$` null;
  - `JournalPresenter.replaceEntry: (id: string, draft: EntryDraft) => Promise<Result>`;
  - `function contextOf(books: Books, replacing: string | null): EntryContext` in `choices.ts`.

- [ ] **Step 1: Write the failing tests.**
  - `validateEntry`: one test per new reason, in the spec's order after `unbalanced`:
    - `invoice-required` (both forms);
    - `invoice-not-allowed`;
    - `unknown-supplier`;
    - `unknown-withholding`;
    - `postings-disagree` (cost debited 1 cent less);
    - `unknown-invoice`;
    - `wrong-supplier`;
    - `over-remaining`, on an add and on an edit, where the edit's own amount is added back;
    - `supplier-has-payments`;
    - `below-paid`;
    - `opening-exists`, refused on an add and accepted on the edit of that same opening.

    M2a's reasons keep their order: a draft with a blank description and a wrong invoice still answers `blank-description`.
  - `canDeleteEntry`: `invoicePayment` and `openingBalances` are accepted. An `invoice` with a payment naming it is refused with `invoice-has-payments`; one without is accepted. `collection` is refused with `kind-not-deletable`.
  - `canEditEntry`: accepted for the seven kinds the spec names, refused with `kind-not-editable` for `collection`, `budgetAllocation`, `closingBalances` and `individualExpense`.
  - The contracts, in `JournalPortContract`:
    - `invoices` reads back what a registration wrote, and the entry's `invoiceId` names it;
    - a payment of the remainder takes the invoice out of `openInvoices(invoices, entries, catalogue)`;
    - `replaceEntry` keeps `id`, `number` and `at` and emits;
    - `replaceEntry` with another kind is refused with `kind-changed`;
    - `replaceEntry` of a `collection` is refused with `kind-not-editable`;
    - `replaceEntry` of an unknown id rejects;
    - deleting a paid invoice's registration is refused, and deleting an unpaid one removes its invoice from `invoices`.

    In `AccountsPortContract`: `withholdingTaxes` of a seeded period is not empty, and an unknown period errors. The contract tests receive a seed through their existing factories.
  - `booksPresenter.test.ts`: `books$` carries the period's invoices, catalogue and dates (`p36`: `2013-01-01` to `2013-12-31`, as the seed's building tree has them), and switches with the period.
  - `journalPresenter.test.ts`: `replaceEntry` reaches the port; with no period selected, `replaceEntry` answers `Rejected("no-period")`.
- [ ] **Step 2: Run** `pnpm --filter @cl/domain test` and `pnpm --filter @cl/client-core test`. Expected: FAIL on the new tests.
- [ ] **Step 3: Implement.**
  - **The simulator** keeps `invoices` per period beside the entries, in a `BehaviorSubject`:
    - `addEntry` of an `invoice` creates `Invoice { id: "newInv<n>", periodId, entryId, ...terms }` and sets the entry's `invoiceId`;
    - `addEntry` of a payment sets `invoiceId` from the draft;
    - `replaceEntry` rewrites the entry's description and postings, and the invoice's terms for a registration;
    - deleting a registration removes its invoice;
    - every write judges with `validateEntry(draft, context)`, where the context carries the period's accounts, parties, catalogue, invoices and entries, and `replacing`.

    `journalOf` sets `editable` from `canEditEntry`. `judged` (M2a's helper) takes an `EntryContext` in place of the accounts, and every wizard passes `contextOf(books, null)`.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS. Then run `pnpm mutation-check` on the `over-remaining` comparison, the `replacing` exclusion and `canDeleteEntry`'s payment check. Expected: KILLED.
- [ ] **Step 5: Commit** `feat(journal): invoices on the port, entries rewritten in place, and the rules for both`.

### Task 4: The clock as an app port

**Files:**
- Create:
  - `packages/domain/src/ports/clockPort.ts`
  - `packages/domain/src/ports/__contracts__/ClockPortContract.ts`
  - `packages/domain/src/simulators/fixedClock.ts` (with `fixedClock.contract.test.ts`)
  - `packages/client-core/src/adapters/systemClock.ts` (with `systemClock.contract.test.ts`)
  - `packages/client-core/src/today.ts` and `today.test.ts`
- Modify:
  - `packages/domain/src/support/clock.ts`, which is removed: its two exports move;
  - `packages/domain/src/simulators/journalSimulator.ts`, whose clock parameter becomes required;
  - `packages/client-core/src/composition.ts` (`AppPorts.clock`, `createSimulatorPorts`);
  - `packages/client-core/src/testing/appHarness.ts`;
  - `packages/client-react/src/app/buildPorts.ts`;
  - `packages/client-react/tests/visual/seeding.ts`;
  - every importer the gate names.

**Interfaces:**
- Produces:
  - `interface ClockPort { now: () => Date }`;
  - `function fixedClock(iso: string): ClockPort` in the domain's simulators;
  - `systemClock: ClockPort` in `client-core/src/adapters`;
  - `AppPorts.clock: ClockPort`;
  - `function todayOf(clock: ClockPort): string` in `client-core/src/today.ts`, the Rome date `YYYY-MM-DD` from `romeTime(clock.now())`.

- [ ] **Step 1: Write the failing tests.**
  - `ClockPortContract`: `now()` is a valid `Date`, and a second call is not earlier than the first. It runs against both clocks.
  - `today.test.ts`:
    - `todayOf(fixedClock("2026-10-14T08:00:00Z"))` is `"2026-10-14"`;
    - `todayOf(fixedClock("2026-10-14T22:30:00Z"))` is `"2026-10-15"` (already the next day in Rome).
- [ ] **Step 2: Run** `pnpm --filter @cl/domain test -- Clock` and `pnpm --filter @cl/client-core test -- today`. Expected: FAIL.
- [ ] **Step 3: Implement.** The harness and the visual seeding pass `fixedClock` at the harness's instant (2026-10-14T10:00:00 Rome, as today). `createSimulatorPorts(seed, clock)` puts the same clock in `AppPorts.clock` and the journal simulator. `buildPorts` passes `systemClock`. Run `pnpm check:arch`: the adapter's file imports nothing from presenters.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS, with every journal stamp unchanged.
- [ ] **Step 5: Commit** `feat(clock): the clock is an app port with a contract`.

### Task 5: Wizards that write, judge each step, and edit

**Files:**
- Modify:
  - `packages/client-core/src/machines/wizards/wizard.ts`
  - `directPaymentWizard.ts`, `multiCostPaymentWizard.ts`, `genericEntryWizard.ts`
  - `packages/client-core/src/amounts.ts` (`parseDate`)
  - `packages/client-core/src/composition.ts`
- Test: `wizard.test.ts`, the three wizards' tests, `amounts.test.ts`

**Interfaces:**
- Consumes: `JournalPresenter.replaceEntry` (Task 3), `todayOf` (Task 4).
- Produces:
  - `type WriteEntry = (draft: EntryDraft) => Promise<ResultOf<EntryAdded>>`, replacing `AddEntry`;
  - `function replacing(entryId: string, replaceEntry: JournalPresenter["replaceEntry"]): WriteEntry`, which maps an accepted `Result` to `{ id: entryId }`, and a rejected promise to `Rejected("entry-gone")`;
  - `WizardDefinition` gains `firstStep?: number` and `stepVerdict: (form: TForm, step: number) => Result`;
  - `WizardState` gains `stepVerdict: Result` and `firstStep: number` (Back is disabled at it) and `editing: string | null`;
  - each factory gains a trailing `editing: JournalEntry | null`;
  - `createGenericEntryWizard(books, write, editing, kind: EntryKind = "generic")`;
  - `function parseDate(text: string, periodYear: number): string | null` → `YYYY-MM-DD`;
  - `function fitsDirectPayment(entry: JournalEntry, books: Books): boolean`;
  - `function fitsMultiCost(entry: JournalEntry, books: Books): boolean`.

  The machine factories in `AppMachines` gain an optional `editing: string | null`, the entry's id, looked up in `latestBooks`.

- [ ] **Step 1: Write the failing tests.**
  - `wizard.test.ts`:
    - Next is gated by `stepVerdict` of the current step: a two-step definition whose step 2 field is blank keeps `stepVerdict` accepted on step 1;
    - `back()` stops at `firstStep`;
    - a save through `replacing` answers `{ id }`;
    - a save whose `replaceEntry` rejects answers `Rejected("entry-gone")` with `saving` back to false (Review Focus 2).
  - Each M2a wizard opened on a seeded entry of its kind shows that entry's form:
    - direct cash: the target and the amount as text;
    - multi-cost: the lines;
    - generic: the lines by scope key.

    Saving unchanged keeps the number and the stamp. A generic wizard with `kind: "withholdingPayment"` writes that kind.
  - `parseDate`:
    - `"23/4/2013"`, `"23/04/2013"` and `"23/4"` with year 2013 → `"2013-04-23"`;
    - `"31/2/2013"`, `"2013-04-23x"` and `""` → `null`.
- [ ] **Step 2: Run** `pnpm --filter @cl/client-core test -- wizard amounts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The verdict per step is decided by the definition. The M2a wizards have one step, whose `stepVerdict` is their whole verdict.
  - An editing factory takes `initial` from the entry and `write` from `replacing`.
  - `firstStep` defaults to 1.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS. Run `pnpm mutation-check` on `parseDate`'s day-of-month check and the `back()` floor.
- [ ] **Step 5: Commit** `feat(wizards): write through add or replace, a verdict per step, and editing the M2a kinds`.

### Task 6: The New invoice wizard machine

**Files:**
- Create: `packages/client-core/src/machines/wizards/invoiceWizard.ts` and its test
- Modify: `composition.ts`, `journalDialogMachine.ts` (`WizardName` gains `"invoice"`), `packages/client-core/src/index.ts`

**Interfaces:**
- Consumes:
  - `invoiceTotals` and `invoicePostings` (Task 1);
  - `Books.invoices` and `contextOf` (Task 3);
  - `todayOf` (Task 4);
  - `createWizardMachine`, `parseDate` and `WriteEntry` (Task 5);
  - `parseAmount`.
- Produces:
  - `type InvoicePreset = "company" | "professionalWithRegister" | "professionalWithoutRegister" | "nonSubject"`;
  - `interface InvoiceForm`, holding the spec's fields as text plus `preset: InvoicePreset`, and `edited: string[]` (the names of the fields the person changed, which the prefill leaves alone);
  - `interface InvoiceSummary`, holding `totals: InvoiceTotals | null`, `supplierLocked: boolean`, `paid: Cents`, `duplicate: boolean` and `nonTaxableShown: boolean`;
  - `function createInvoiceWizard(books: Books | null, clock: ClockPort, write: WriteEntry, editing: JournalEntry | null): WizardMachine<InvoiceForm, InvoiceSummary>`;
  - `AppMachines.createInvoiceWizard(editing: string | null)`.

- [ ] **Step 1: Write the failing tests**, on the harness over the real seed, `p36` selected:
  - **Choosing supplier `md78`** prefills, from its most recent `p36` invoice: the cost account, VAT `20`, withholding `"1020"` and the reason. The description reads "Invoice {number} — {name of md78}: {reason}" once a number is typed.
  - **Editing:**
    - after an edit of the cost account, choosing another supplier keeps the edited cost account and takes the rest from the new supplier;
    - a supplier with no earlier invoice gets VAT `20`, social security `0` and no withholding (Review Focus 4).
  - **The date** starts at `books.period.end` (`2013-12-31` for `p36`): the harness's today is outside `p36`, so it takes the period's last day. With a clock inside the period, it starts at that day. `parseDate`'s year without one is the year of `books.period.start`.
  - **Taxable `2.588,05`** gives `summary.totals.dueToSupplier` 300214 with code `"1019"` (Review Focus 1).
  - **The steps:**
    - step 1's `stepVerdict` names `no-supplier`, then `no-number`, `no-reason`, `no-cost-account`, `not-a-date` and `due-before-date`, as each field is filled;
    - step 2's `stepVerdict` names `not-an-amount` and `not-a-rate`.
  - **Presets:**
    - `professionalWithRegister` sets social security `4` and the flag on;
    - `nonSubject` shows the non-taxable field;
    - the preset starts on the one matching the prefilled fields.
  - **The duplicate warning:** `duplicate` is true when the supplier already has that number in `p36`, and the save is not refused.
  - **A save** lands with the next number and the fixed stamp, and `openInvoices` gains the invoice.
  - **Editing a seeded paid invoice:**
    - its form comes from its terms;
    - `supplierLocked` is true;
    - lowering Taxable until the amount due is below what was paid makes the verdict `below-paid`, with `summary.paid` set.
- [ ] **Step 2: Run** `pnpm --filter @cl/client-core test -- invoiceWizard`. Expected: FAIL.
- [ ] **Step 3: Implement** to the spec's "New invoice" section. The choices are the period's supplier parties by name and the expense leaves (`leafChoices` with `isExpenseLeaf`). The preview is `invoicePostings` as paths.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS. Run `pnpm mutation-check` on the "edited fields are not overwritten" guard and the date's period clamp.
- [ ] **Step 5: Commit** `feat(wizards): the New invoice wizard`.

### Task 7: The Invoice payment wizard machine

**Files:**
- Create: `packages/client-core/src/machines/wizards/invoicePaymentWizard.ts` and its test
- Modify: `choices.ts` (`liquidityChoices`), `composition.ts`, `journalDialogMachine.ts` (`"invoicePayment"`)

**Interfaces:**
- Consumes:
  - `openInvoices` and `paidOn` (Task 2);
  - `contextOf` (Task 3);
  - `todayOf` (Task 4);
  - the Task 5 machine.
- Produces:
  - `interface InvoicePaymentForm { invoiceId: string | null; accountId: string | null; amount: string; description: string; edited: string[] }`;
  - `interface InvoicePaymentSummary { open: OpenInvoiceRow[]; remaining: Cents | null }`, with `OpenInvoiceRow { id: string; number: string; reason: string; date: string; dueDate: string | null; supplier: string; remaining: Cents; overdue: boolean }`;
  - `function liquidityChoices(books: Books): WizardChoice[]`: the regular `assets` leaves under the parent of the cash-role account, or of the bank-role account when there is no cash role;
  - `function createInvoicePaymentWizard(books, clock, write, editing)`;
  - `AppMachines.createInvoicePaymentWizard(editing: string | null)`.

- [ ] **Step 1: Write the failing tests**, on the harness, `p36`:
  - `summary.open` has 8 rows, ordered by date (no seeded due dates).
  - `liquidityChoices` holds `la154` and `la156`, and the form starts with `la156`.
  - Choosing an invoice prefills `amount` with its remaining amount, and the description with "Payment of invoice {number} — {supplier}".
  - The rules:
    - step 1 `no-invoice`;
    - step 2 `no-liquidity-account` and `not-an-amount`;
    - an amount one cent above the remaining amount is `over-remaining`.
  - Paying in two tranches: the first leaves the invoice in `open` with the rest; the second removes it.
  - A stale remaining amount (Review Focus 3): open the wizard, save a payment of the remainder through the port directly, then save from the wizard. The save answers `over-remaining`.
  - Editing a seeded payment:
    - it starts at step 2 (`firstStep: 2`);
    - `back()` stays there;
    - the amount may rise to its remaining amount plus its own amount, and no further.
  - `overdue` is true for a hand-made invoice due before `todayOf(clock)`.
- [ ] **Step 2: Run** `pnpm --filter @cl/client-core test -- invoicePaymentWizard`. Expected: FAIL.
- [ ] **Step 3: Implement** to the spec's "Invoice payment" section. The postings are the suppliers account debited with the invoice's supplier as counterpart, and the liquidity account credited.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(wizards): the Invoice payment wizard`.

### Task 8: The Opening balances wizard machine, `editorOf`, and the edit dialog

**Files:**
- Create:
  - `packages/client-core/src/machines/wizards/openingBalancesWizard.ts` and its test
  - `packages/client-core/src/machines/wizards/editorOf.ts` and its test
- Modify: `journalDialogMachine.ts`, `composition.ts`, `index.ts`

**Interfaces:**
- Consumes: Tasks 3 and 5–7.
- Produces:
  - `interface OpeningAmount { debit: string; credit: string }`;
  - `interface OpeningForm { description: string; amounts: Record<string, OpeningAmount>; search: string; onlyWithAmount: boolean }`;
  - `interface OpeningRowView { key: string; label: string; debit: string; credit: string }` and `interface OpeningSummary { rows: OpeningRowView[]; balance: Cents }`, where `rows` is filtered by `search` and `onlyWithAmount`;
  - `function openingRows(books: Books): OpeningRow[]`, with `OpeningRow { key: string; label: string; accountId: string; counterpart: Counterpart | null }`. A leaf's key is its account id, and a resident's is `<owners account id>/<resident id>`;
  - `function createOpeningBalancesWizard(books, write, editing)`;
  - `function editorOf(entry: JournalEntry, books: Books): WizardName | null`, which is null when `canEditEntry` refuses;
  - `WizardDialog` gains `editing: string | null`;
  - `JournalDialogIntents.openEdit(entryId: string)`;
  - `createJournalDialogMachine(lookups: JournalDialogLookups)` with `interface JournalDialogLookups { editorOf: (entryId: string) => WizardName | null; openingEntry: () => string | null }`. `openWizard("openingBalances")` opens the existing opening as an edit when `openingEntry()` gives one.

- [ ] **Step 1: Write the failing tests.**
  - The opening wizard, on the harness, `p36`, after deleting the seeded opening through the port:
    - the rows are the regular assets, liabilities and assetsOrLiabilities leaves (no suppliers-role or roundings-role account), plus 27 resident rows;
    - each resident's amount is prefilled from `startingBalance`, on the debit side when positive and the credit side when negative;
    - `balance` is minus the bank's 625099 until `la156` gets 6.250,99, then 0;
    - `0` and `0,00` write nothing; `-50` gives `not-an-amount` (Review Focus 5);
    - `search` and `onlyWithAmount` filter the rows;
    - a save writes kind `openingBalances`, and a second `openWizard("openingBalances")` opens it as an edit.
  - Editing the seeded `p36` opening shows its own lines, not the prefill.
  - `editorOf`:
    - every kind gives the spec's editor;
    - `p1`'s seeded opening, with its supplier lines, gives `"genericEntry"`;
    - a seeded direct cash payment credited to an account other than the cash-role one gives `"genericEntry"` (build it with `createBooks`);
    - every seeded `p36` and `p1` invoice and payment gives its own editor;
    - `collection` gives null.
  - The dialog machine: `openEdit` of an editable id opens `{ kind: "wizard", wizard, editing }`, and of a non-editable one leaves it closed.
- [ ] **Step 2: Run** `pnpm --filter @cl/client-core test -- openingBalances editorOf journalDialog`. Expected: FAIL.
- [ ] **Step 3: Implement** to the spec's "Opening balances" and "The wizard machine" sections. An opening entry fits this editor when each posting maps to exactly one row of `openingRows` and no row is named twice. Otherwise `editorOf` answers the generic editor, which keeps the kind. Composition builds the dialog machine with lookups over `latestBooks`.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(wizards): the Opening balances wizard and the editor of each entry`.

### Task 9: Bindings

**Files:**
- Modify: `packages/react-bindings/src/createViewModel.ts`, `viewModel.test.tsx`, `viewModel.page.tsx`

**Interfaces:**
- Produces:
  - `useInvoiceWizard(editing: string | null)`;
  - `useInvoicePaymentWizard(editing: string | null)`;
  - `useOpeningBalancesWizard(editing: string | null)`;
  - the M2a hooks gain the same trailing `editing` argument: `useGenericEntryWizard(editing, kind?)`.

  Each returns a `WizardView` of its machine, and reads its arguments on the first render only, as `useDirectPaymentWizard(kind)` does. The `ViewModel` interface says so.

- [ ] **Step 1: Write the failing test.** Each new hook mounts its machine and disposes of it on unmount. A hook given an `editing` id shows that entry's form.
- [ ] **Step 2: Run** `pnpm --filter @cl/react-bindings test`. Expected: FAIL.
- [ ] **Step 3: Implement** on `useMachine`, as the M2a hooks are.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(bindings): the three new wizards, and editing through every wizard hook`.

### Task 10: Client primitives: `DateField`, `SupplierSelect`, `SegmentedControl`

**Files:**
- Create in `packages/client-react/src/ui/`, each with a `.css`, `.page.tsx` and `.test.tsx`: `DateField.tsx`, `SegmentedControl.tsx`, and `journal/wizards/SupplierSelect.tsx` (on `ChoiceSelect`)
- Modify: `testids.ts`

**Interfaces:**
- Produces:
  - `DateField { label: string; required?: boolean; value: string; parsed: string | null; onChange: (text: string) => void }`. When `parsed` is not null and the text is not already in full form, it shows the parsed date beside the text as `dd/mm/yyyy`, through `formatDate`;
  - `SegmentedControl<T extends string> { options: readonly SegmentOption<T>[]; value: T; onChange: (value: T) => void; label: string }`, with `SegmentOption { value; label }`. It is a `radiogroup` with arrow keys;
  - `SupplierSelect { choices: WizardChoice[]; value: string | null; locked: boolean; note?: string; onChange }`.

- [ ] **Step 1: Write the failing tests**, through each page object:
  - `DateField` shows "23/04/2013" beside the text "23/4";
  - `SegmentedControl` moves on ArrowRight and calls `onChange`;
  - `SupplierSelect` is disabled and shows its note when `locked`.
- [ ] **Step 2: Run** `pnpm --filter @cl/client-react test -- DateField SegmentedControl SupplierSelect`. Expected: FAIL.
- [ ] **Step 3: Implement** in the design's measures (`docs/design/web/v1/README.md` "Forms"). The pills follow the toolbar's select-like chips; the selected one is on `--sel` with `--acc` text. Colours come from tokens.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): date field, segmented control and supplier select`.

### Task 11: The invoice and payment wizards on screen

**Files:**
- Create: `packages/client-react/src/ui/journal/wizards/InvoiceWizard.tsx`, `InvoicePaymentWizard.tsx`, `OpenInvoicesGrid.tsx`
- Modify: `WizardDialog.tsx` (the "Edit {name}" title, Next gated by `stepVerdict`, Back hidden at `firstStep`, the keyboard), `reasons.ts` (the messages), `WizardDialog.page.tsx`, `Wizards.css`, `Wizards.test.tsx`, `JournalScreen.tsx` (the dialogs routed), `testids.ts`

**Interfaces:**
- Consumes: Task 9's hooks, Task 10's primitives, M2a's `WizardDialog`, `FormField`, `SelectableList` and `ChoiceSelect`.

- [ ] **Step 1: Write the failing tests** (`Wizards.test.tsx`, through `WizardDialog.page.tsx`):
  - **Invoice:**
    - fill step 1, Next, see the totals on step 2 with "Total due to supplier", save, and see the entry revealed in the grid;
    - the "Professional w/ register" pill sets social security to 4;
    - the duplicate warning text shows.
  - **Payment:**
    - the grid lists the open invoices with Remaining;
    - choose one, Next, see the amount prefilled and the tranche note, Next, Save;
    - an over-remaining amount shows "The invoice still owes {remaining}.";
    - with no open invoice the empty text shows.
  - **Keyboard:**
    - the first required empty field has the focus on each step;
    - Enter in a field presses Next when Next is enabled, and does nothing when it is disabled.
  - **Edit:**
    - the title reads "Edit New Invoice Entry";
    - on a paid seeded invoice the supplier is locked with "This invoice has payments: its supplier cannot change.";
    - lowering Taxable below what was paid shows "Payments already made total {paid}.".
- [ ] **Step 2: Run** `pnpm --filter @cl/client-react test -- Wizards`. Expected: FAIL.
- [ ] **Step 3: Implement** to the spec's "Client" section and the design's wizard measures (680px; label width 200, and 240 on the invoice's step 2). Overdue due dates are in `--neg`. The `Remaining` column is `plain` money.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(journal): the New invoice and Invoice payment wizards on screen`.

### Task 12: Opening balances on screen, `✎`, and the screen test

**Files:**
- Create: `packages/client-react/src/ui/journal/wizards/OpeningBalancesWizard.tsx`
- Modify:
  - `JournalToolbar.tsx`: the three items open their wizards; `✎` is enabled by `entry.editable`, with the reason as its title;
  - `JournalGrid.tsx`: double click on an entry row opens its edit;
  - `JournalScreen.tsx`, `DeleteEntryConfirm.tsx` (the `invoice-has-payments` message), `reasons.ts` (`kind-not-editable`);
  - `JournalScreen.page.tsx`, `JournalScreen.test.tsx`, `testids.ts`

**Interfaces:**
- Consumes: Tasks 8, 9 and 11.

- [ ] **Step 1: Write the failing tests.**
  - The opening wizard:
    - "Transaction balance" shows in `--neg` while not zero;
    - search narrows the rows;
    - "Show only rows with an amount" narrows them;
    - Enter in a Debit or Credit field moves to the next row's Debit field; Tab keeps its native order.
  - The screen test (`JournalScreen.test.tsx`) on Pozzetto 2013:
    - register an invoice through the page objects;
    - pay it in two tranches and see it leave the payment grid;
    - edit the first payment's amount with `✎`;
    - try to delete the invoice and read "This invoice has payments. Delete them first.";
    - delete both payments, then delete the invoice;
    - double click a generic entry, change its description, save, and see the same number in the grid with the new description;
    - with a `collection` selected, `✎` is disabled and its title is the `kind-not-editable` message.
- [ ] **Step 2: Run** `pnpm --filter @cl/client-react test -- Journal Wizards`. Expected: FAIL.
- [ ] **Step 3: Implement.** The opening list is a scrolling grid `Account | Debit | Credit` (`1fr 110px 110px`) with a max height of 240, the design's tree measure. It shrinks within the dialog's 90vh rather than scrolling the body (M2a's rule for `SelectableList`).
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(journal): opening balances, edit on an entry, and the delete of invoices`.

### Task 13: Goldens, STATUS and IDEAS

**Files:**
- Modify: `packages/client-react/tests/visual/scenarios.ts` and `seeding.ts`; `docs/STATUS.md`; `docs/IDEAS.md`
- Create: the darwin-arm64 goldens of the four new scenarios. The linux-x64 set comes from the `Update visual goldens` workflow at the end of the work.

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Add the scenarios.** `ScenarioDialog` gains:
  - `{ wizard: "invoice"; step: 2; form: Partial<InvoiceForm> }`;
  - `{ wizard: "invoicePayment" }` at step 1;
  - `{ wizard: "openingBalances"; deleteSeeded: true; amounts: Record<string, OpeningAmount> }`;
  - `{ edit: string }`, the entry id.

  They are delivered in `seeding.ts` through the machines' own intents and the port's delete (in `deliver`). The four scenarios, all `p36`, 1280, light, menu journal:
  - `journal-wizard-invoice`: supplier `md78`, taxable `300,15`, step 2;
  - `journal-wizard-payment`;
  - `journal-wizard-opening`: the seeded opening deleted, `la156` given `6.250,99`;
  - `journal-wizard-edit`: the first generic entry of `p36` in number order.
- [ ] **Step 2: Run** `pnpm visual:update`, then open each new image and check it shows what its name says. Run `pnpm visual` five times: every run passes with no difference. Check with `git status` that only the four new images were added.
- [ ] **Step 3: Update the documents.**
  - **STATUS:**
    - remove the M2b entry from "Next, with no plan yet";
    - add M2c there: Record owner collection and Budget allocation, with installments and the allocation engine in the app, the delete and edit of their kinds, the 0/0 lines, and whether `startingBalance` follows the opening entry. Link this spec;
    - set the date.

    The linux-x64 set of the four goldens is not a STATUS entry. It is part of the pull request's closing steps: push, run the `Update visual goldens` workflow on the branch, then commit the images its artifact holds, after checking them as in Step 2. The `Visual goldens` check fails until they are in.
  - **IDEAS:** add the spec's "To IDEAS" list.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`, `pnpm check:doc-links` and `pnpm check:status`. Expected: PASS.
- [ ] **Step 5: Commit** `test(visual): the three new wizards and an edit; docs: STATUS and IDEAS for M2b`.
