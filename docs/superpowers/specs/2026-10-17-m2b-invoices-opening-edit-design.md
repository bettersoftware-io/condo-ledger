# M2b — Invoices, opening balances and editing an entry — design

Date: 2026-10-17. Status: written. A builder read it and raised questions;
each is settled below as a marked call.

Parent spec: `docs/superpowers/specs/2026-10-11-app-v2-design.md` (Section 5,
M2). Previous spec of the Journal group:
`docs/superpowers/specs/2026-10-14-m2a-journal-design.md`, whose shapes
(ports, the books presenter, the wizard machine, the dialog, the goldens)
this one extends and does not repeat. Where the two differ, this one wins for
M2b.

## Intent

The person keeping a building's books should get through the everyday
operations quickly: register a supplier's invoice, pay it, open a period,
fix an entry they got wrong. The user's one instruction for this milestone:
make those operations fast and easy. Every call below that is not forced by
the domain is tested against that: fewer fields to fill, values that can be
known are filled in, a mistake is mended in place rather than deleted and
retyped.

## What the surveys found

Three surveys (the domain and seed, the legacy application, the prototype)
on 2026-10-17. What they changed:

| Found | Consequence |
|---|---|
| The legacy server stores what the client sends and checks nothing, not even the balance; the Flex wizards built every posting | What each wizard writes, and what the port refuses, is defined here. The legacy formulas are kept where the dump proves them |
| The prototype's wizards are static pictures: hard-coded values, no saving, Next on the last step closes. `✎` has no handler | The layout and the strings come from the prototype; the behaviour does not |
| The dump proves the invoice arithmetic on all of Pozzetto 2013's 47 registrations: the cost account takes the gross, VAT and social security have no posting of their own | The domain computes an invoice's postings from its terms, and a test over the seed proves the computation on every seeded invoice |
| An invoice's paid amount is not stored anywhere: it is the sum of the payments that name it. Tranches are separate payment entries (invoice 7736: 1,000 + 1,000 + 1,002.14) | The open amount is derived, never stored. A payment carries the invoice it pays |
| The app's seed has no invoices, no withholding catalogue, no supplier list and no resident roster. A period's parties are only those its postings name, so a supplier never posted to cannot be picked | The generator emits invoices, the withholding catalogue, every supplier of the building and every owner of the period, with each owner's starting balance |
| The legacy owner collection is not oldest first (the person ticks installments), and no legacy code ever wrote a budget allocation (the dump's two were inserted by hand). Both need installments and the allocation engine, which the app does not have | Collection and allocation move to their own spec, M2c (below) |
| The legacy opening balance is a loop, one account per pass, saved only once balanced, with no counterpart account | One editable list of every account that can open, with the running balance; saved when it balances |
| The legacy edit deletes and rewrites an entry's lines; it allowed registrations, payments and free entries | `✎` rewrites an entry in place: same id, same number, same stamp |

## Scope, and what moves to M2c

**In M2b:**

- the **New invoice** and **Invoice payment** wizards, with invoices and
  the withholding catalogue in the domain, the seed and the journal port;
- the **Opening balances** wizard;
- **`✎`**: editing an entry of any kind a wizard of M2a or M2b writes;
- **delete** of invoices, payments and opening entries.

**Moved to M2c, its own spec (my call):** *Record owner collection* and
*Budget allocation*. Both stand on installments and on the allocation engine
in the app: a collection settles installments, an allocation charges each
owner the share the engine computes. Those are the substance of the
*Installments* and *Tables & Allocation* groups that follow in the parent's
order, so M2c is written with them, before the Installments screen. The two
menu items stay as M2a left them: a notice that the flow is not built yet.

## Domain

### Entities

```ts
/** Hundredths of a percent: 400 is 4%, 2000 is 20%. */
export type Rate = number & { readonly __rate: unique symbol };

/** A tribute code the building withholds on, and the account the withholding is owed on in this period. */
export interface WithholdingTax {
  code: string;          // "1019", "1020", "1040", "1004", "1001"
  name: string;          // the legacy name, e.g. "Società di persone"
  rate: Rate;
  accountId: string;     // a regular leaf with the tax role
}

/** What the person types for an invoice. Dates are "YYYY-MM-DD". */
export interface InvoiceTerms {
  supplierId: string;
  number: string;
  reason: string;
  date: string;
  dueDate: string | null;
  costAccountId: string;              // one expense leaf (see "Not built")
  taxable: Cents;
  socialSecurityRate: Rate;           // the legacy "welfare tax" (cassa previdenziale)
  vatRate: Rate;
  nonTaxable: Cents;
  withholdingCode: string | null;     // a WithholdingTax code of the period, or none
  withholdingOnSocialSecurity: boolean;
}

export interface Invoice extends InvoiceTerms {
  id: string;
  periodId: string;
  entryId: string;                    // its registration
}

/** Every amount an invoice's terms imply, rounded half up to the cent at each step, as the legacy client did. */
export interface InvoiceTotals {
  socialSecurity: Cents;     // taxable × socialSecurityRate
  invoiceTaxable: Cents;     // taxable + socialSecurity
  vat: Cents;                // invoiceTaxable × vatRate
  total: Cents;              // invoiceTaxable + vat + nonTaxable
  withholdingBase: Cents;    // taxable, plus socialSecurity when withholdingOnSocialSecurity
  withholding: Cents;        // withholdingBase × the code's rate; 0 with no code
  dueToSupplier: Cents;      // total − withholding
}
```

`JournalEntry` gains `invoiceId: string | null`: the invoice a registration
created or a payment pays; null on every other kind. `EntryDraft` gains
`invoice?: InvoiceTerms` (a registration's terms) and `invoiceId?: string`
(the invoice a payment pays). `OwnerParty` stands for one residency, owner or
tenant, as it does today. It gains `startingBalance: Cents`: what the
resident owed at the start of the period, negative when in credit. This is
the legacy `unitResident.startingBalance`.

An invoice's date and due date may lie outside its period: Saturno 2011's
two invoices are dated 2012. No rule ties them to the period.

**In M2b, `startingBalance` is read-only seed data. It only prefills a new
opening entry** (my call). The books read the opening entry's lines. The
legacy app linked the two: `unitResident.startingBalanceLedgerEntryId`
pointed at the posting, and the starting balance locked once an opening
entry existed. Whether they stay linked is M2c's question, because its
installments read the starting balance.

**Today's date.** The invoice wizard's default date and the overdue marking
need today. A clock is the outside world, so `Clock` (already
`domain/src/support/clock.ts`, handed to the simulator) becomes an app port
(my call). The port carries a contract, `systemClock` serves as the real
adapter, and the harness and the visual seeding pass a fixed clock. Core
reads today as `romeTime(clock.now())`'s date. The harness's fixed instant,
2026-10-14, lies outside every seeded period. The tests and goldens
therefore see the period's last day as the default date, deterministically.

### Use cases

- **`invoiceTotals(terms, rate: Rate | null): InvoiceTotals`**, the formulas
  above. Rounding: half up, on the cent, at each step (the legacy
  `MixedUtil.round`).
- **`invoicePostings(terms, catalogue, accounts): Posting[]`**, in this
  order: the cost account debited with `total`; the suppliers-role account
  credited with `dueToSupplier`, the supplier as counterpart; when
  `withholding` is not zero, the code's account credited with it.
- **`openInvoices(invoices, entries): OpenInvoice[]`**, where
  `OpenInvoice = { invoice, totals, paid, remaining }`. `paid` is the sum of
  the suppliers-account debits of the `invoicePayment` entries that name the
  invoice. Only `remaining > 0`; ordered by due date (none last), then date,
  then number.
- **`validateEntry(draft, books)`** keeps M2a's reasons and order and adds,
  after `unbalanced`:

  | Reason | When |
  |---|---|
  | `invoice-required` | an `invoice` draft without terms, or an `invoicePayment` draft without `invoiceId` |
  | `invoice-not-allowed` | terms or an `invoiceId` on any other kind |
  | `unknown-supplier` | the terms name a supplier the period does not have |
  | `unknown-withholding` | the terms name a code the period's catalogue does not have |
  | `postings-disagree` | an `invoice` draft whose postings differ from `invoicePostings(terms)` |
  | `unknown-invoice` | a payment of an invoice the period does not have |
  | `wrong-supplier` | a payment whose suppliers-account debit is not with the invoice's supplier |
  | `over-remaining` | a payment above what the invoice still owes (on an edit: above what it owes plus the payment's own current amount) |
  | `supplier-has-payments` | an edit of a registration that changes the supplier while a payment names the invoice |
  | `below-paid` | an edit of a registration whose `dueToSupplier` falls below what its payments have paid |
  | `opening-exists` | a second `openingBalances` entry in the period |

  Its second argument becomes what it needs to decide all of these: the
  accounts, the parties, the catalogue, the invoices and the entries. The
  plan names that type; the simulator and the wizard machines both have
  them.
- **`canDeleteEntry(entry, entries)`**: `invoicePayment` and
  `openingBalances` join the deletable kinds. `invoice` is deletable when no
  payment names it, refused with `invoice-has-payments` otherwise (the
  legacy app deleted it and left its payments pointing nowhere). Deleting a
  registration deletes its invoice. `collection`, `budgetAllocation`,
  `closingBalances` and `individualExpense` stay refused with
  `kind-not-deletable`.
- **`canEditEntry(entry)`**: accepted for `generic`, the three direct
  payment kinds, `invoice`, `invoicePayment` and `openingBalances`; refused
  with `kind-not-editable` for the four others.

### Ports

`JournalPort` gains:

```ts
/** The period's invoices, registered and paid or not. Errors as entries() does. */
invoices(periodId: string): Observable<Invoice[]>;
/** Rewrites an entry in place: same id, number and stamp. Refused with canEditEntry's reason, `kind-changed` when the draft's kind differs, or validateEntry's reason judged with the entry itself left out. Rejects for an entry the port does not have. */
replaceEntry(entryId: string, draft: EntryDraft): Promise<Result>;
```

`addEntry` of an `invoice` draft creates the invoice with the entry, in one
step, and sets the entry's `invoiceId`; `replaceEntry` of one rewrites the
invoice's terms. A registration and its invoice are written together because
in M3 they are one database transaction.

`AccountsPort` gains `withholdingTaxes(periodId):
Observable<WithholdingTax[]>`, and `parties(periodId)` changes meaning: the
building's suppliers and the period's owners, whether or not a posting names
them. The account tree still makes a control account's rows from the
postings, so the Accounts screen does not change.

The contracts grow with each: invoices read back as written; a registration
lands with its invoice; a payment reduces `openInvoices`; a replace keeps
id, number and stamp, and is refused for a changed kind; a delete of a paid
invoice is refused; a second opening entry is refused.

### Seed

The generator emits, for each period:

- `invoices`: every `ledgerInvoice` with its terms, its registration's entry
  id, and `invoiceId` on its registration and payment entries
  (`ledgerTransaction.ledgerInvoiceId`). The legacy `mixedVatAmount` and
  `quadroAc` are not carried (none of Pozzetto's invoices uses the first; the
  second belongs to the annual return).
- `withholdingTaxes`: the `withholdingTax` rows joined with
  `withholdingTax2LA` for the period. Pozzetto 2013: 1004 → la166, 1019 →
  la167, 1020 → la168, 1040 → la165.
- `parties`: the building's suppliers (`condominiumSupplier`) and the
  period's residents (owners and tenants): the residencies that overlap the
  period, each with its `startingBalance`. Saturno 2011 has 10 residents (2
  tenants) and Pozzetto 2013 has 27. Today's seed holds one global party
  list and `parties()` answers it whatever the period. Parties per period is
  a new seed shape; the plan decides it. Every party a seeded posting names
  must be among its period's parties, because `buildAccountTree` throws
  otherwise. Every invoice supplier and every posted supplier is in
  `condominiumSupplier`.

A test over the committed seed proves the arithmetic. It checks
`invoicePostings` of each seeded invoice against its registration entry's
postings, for all 47 of Pozzetto 2013 and the two of Saturno 2011 (which
withhold on social security). It also checks that `openInvoices` at the end
of Pozzetto 2013 is the eight invoices the dump leaves unsettled. Pozzetto
2013's opening entry must equal the owners' starting balances plus the bank,
or the test names the difference.

## Core

### Books

`Books` gains `invoices: Invoice[]` and `withholdingTaxes: WithholdingTax[]`,
read with the rest so no wizard sees invoices of one emission with entries of
another. `journalPresenter` gains `replaceEntry(id, draft)`.

### The wizard machine

`createWizardMachine(definition, write)` takes `write: (draft) =>
Promise<ResultOf<EntryAdded>>`. For a new entry that is the presenter's
`addEntry`. For an edit it is `replaceEntry(id, …)` with an accepted
`Result` mapped to `{ id }`. Either way the dialog reveals the entry by the
id the save answers, as M2a's does. `WizardDefinition` gains `firstStep`
(default 1), so an edit can start past a step whose choice is fixed.

**A verdict per step** (my call). The definition gains
`stepVerdict(form, step): Result`. The state gains `stepVerdict`, and Next
is enabled while the current step's verdict accepts. The whole `verdict`
still decides Save. Each wizard below names the rules of each step; a rule
that is on no step is judged at Save. Each
wizard factory takes an optional entry to edit: with one, `initial` is the
form that entry was written from (below), the title reads "Edit …", and save
replaces.

`journalDialogMachine` gains the three new wizards and an `edit` dialog that
names the entry. Which wizard edits an entry is decided in core by
`editorOf(entry, books)`:

| Kind | Editor | Form from |
|---|---|---|
| `generic` | generic | the postings |
| `directPaymentCash`, `withholdingPayment` | direct payment | the debit line and its amount |
| `directPaymentBank` | direct payment with one debit line, multi-cost with several | the debit lines |
| `invoice` | new invoice | the invoice's terms |
| `invoicePayment` | invoice payment, starting at step 2 | the invoice and the payment's amount and account |
| `openingBalances` | opening balances | the postings |

Some entries have postings their editor cannot write: a seeded direct
payment credited to some other account than the role account, say. An
opening entry is another case, when one of its lines is on an account the
opening list leaves out: Saturno 2011's opening has two supplier lines. Such
an entry opens in the generic editor, which keeps the entry's kind (my call:
the person can always correct the lines; refusing would leave only delete
and retype). The generic wizard therefore takes the kind it writes, `generic`
for a new entry. Invoices and payments never fall back, since a generic
draft cannot carry an invoice. All 49 seeded invoices and 44 seeded
payments have their editor's shape, and the seed test checks that
`editorOf` gives each its own editor.

### New invoice (two steps)

Form: `supplierId`, `number`, `reason`, `date`, `dueDate`, `costAccountId`,
then `taxable`, `socialSecurityRate`, `vatRate`, `nonTaxable`,
`withholdingCode`, `withholdingOnSocialSecurity`, `description`. Amounts and
rates are text, parsed in core as M2a's amounts are; dates are text, parsed by
a new `parseDate` in core. It takes `23/4/2013`, `23/04/2013` and `23/4`; with
no year it uses the period's.

- **Step 1, "Select supplier"**: supplier, invoice number, reason, cost
  account, invoice date, due date. The choices are the period's suppliers by
  name and its expense leaves (as M2a's direct payment offers them).
- **Step 2, "Calculate withholding"**: the computed rows of the design, each
  a read-only field from `invoiceTotals`, and the editable rates.
- **Prefill (fast):** choosing a supplier copies its most recent invoice in
  the period (by date, then number): cost account, social security and VAT
  rates, withholding code and flag, and the reason. The person changes only
  what differs. A supplier with no earlier invoice gets VAT 20% (every seeded
  invoice), no social security, no withholding. Fields the person already
  edited are not overwritten. The date starts at today when today is inside
  the period, otherwise at the period's last day. The description is
  generated as "Invoice {number} — {supplier}: {reason}" and follows the
  fields until the person edits it.
- **The design's four pills** ("Company", "Professional w/ register",
  "Professional w/o register", "With non-subject amounts") are presets over
  the same fields (my call):

  | Pill | Social security | On social security | Non-taxable field |
  |---|---|---|---|
  | Company | 0% | off | hidden, 0 |
  | Professional w/ register | 4% | on | hidden, 0 |
  | Professional w/o register | 0% | off | hidden, 0 |
  | With non-subject amounts | as before | as before | shown |

  The pill does not choose the withholding code. Picking one changes the
  fields, and the fields stay editable. The pill starts on whichever
  matches the prefilled fields.
- Wizard rules beyond `validateEntry`:
  - step 1: `no-supplier`, `no-number`, `no-reason`, `no-cost-account`,
    `not-a-date` (date and due date), `due-before-date`;
  - step 2: `not-an-amount`, `not-a-rate`, then `validateEntry`.
- **Editing a paid invoice:** the supplier picker is locked, with the note
  "This invoice has payments: its supplier cannot change." `below-paid`
  shows as "Payments already made total {paid}." The port refuses both
  regardless (the table above). A duplicate number for the same supplier in
  the period is a warning shown under the number, not a refusal (my call:
  the legacy app allowed it, and a supplier can reuse numbers across years).
- Preview: `invoicePostings`. Kind `invoice`, with the terms on the draft.

### Invoice payment (three steps)

- **Step 1, "Select invoice"**: the grid `Nr. | Reason | Date | Due |
  Supplier` of the design, plus a `Remaining` column, from `openInvoices`.
  Rows due before today show the due date in `--neg`. Empty state: "No
  invoice is waiting to be paid."
- **Step 2, "Liquidity account and amount"**: the period's cash and bank
  leaves (regular accounts under the liquidity group of the cash and bank
  roles: the leaves of the nature `assets` whose parent holds the
  role accounts; the plan checks this against Pozzetto 2013 and Saturno
  2011), the bank-role account chosen first; the design's tranche note;
  `Amount to pay *` prefilled with `remaining`.
- **Step 3, "Description"**: `Description *` prefilled "Payment of invoice
  {number} — {supplier}"; the postings: the suppliers account debited with
  the supplier as counterpart, the liquidity account credited.
- Rules:
  - step 1: `no-invoice`;
  - step 2: `no-liquidity-account`, `not-an-amount`, and `over-remaining`
    from the domain, shown as "The invoice still owes {remaining}.";
  - step 3: `validateEntry`.

  Kind `invoicePayment`, with `invoiceId`.
- No seeded invoice has a due date. The ordering then falls to the date,
  and the overdue marking is proven by unit tests only.

### Opening balances (one step)

- One editable list, in place of the design's tree, single amount and
  "insert and restart" radios (my call: one screen instead of a loop of
  passes). Its rows are every regular leaf of nature `assets`, `liabilities`
  or `assetsOrLiabilities`, by its path, and one row per resident of the
  period (owners and tenants) under the owners-role account, labelled
  "{account} › {resident} › {unit}".
  The suppliers-role and roundings-role accounts are left out (a supplier's
  opening debt needs an opening invoice, below). Each row has Debit and
  Credit inputs.
- **Prefill:** each owner's row from `startingBalance` (positive in Debit,
  negative in Credit). For most periods the person then types only the bank
  and cash balances.
- "Transaction balance" above the list: debits minus credits, in `--neg`
  while not zero. A search box filters the rows by label, and a "Show only
  rows with an amount" checkbox narrows the list.
- Rows with neither amount write nothing. Description prefilled "Opening
  balances". Kind `openingBalances`.
- The menu item, when the period already has an opening entry, edits that
  entry instead of refusing: through `editorOf`, so in this wizard when its
  lines fit and in the generic editor when they do not (fast: there is one
  opening per period, and the person who opens the menu wants it). An edit
  shows the entry's own lines. The `startingBalance` prefill applies only
  to a new entry.
- Both seeded periods already have an opening entry. The core test of the
  prefill and the `journal-wizard-opening` golden therefore delete Pozzetto
  2013's seeded opening first, through the port's own delete (in the
  scenario: `deliver`), then open the menu item.

## Client

- `JournalToolbar`: the New invoice, Invoice payment and Opening balances
  items open their wizards. `✎` is enabled when the selected entry passes
  `canEditEntry`, with a tooltip of the reason when it does not; it also
  opens on a double click of an entry row. Record collection and Budget
  allocation keep M2a's notice.
- `DeleteEntryConfirm`: the new reason's message, "This invoice has
  payments. Delete them first."
- `WizardDialog` titles an edit "Edit {name}"; its last button reads `✓ Save
  entry` for both a new entry and an edit. After a save it reveals the entry
  in the grid as M2a does.
- **Keyboard (fast):** every wizard step puts the focus on its first field
  that is empty or required, and Enter in a text field does what the
  primary button does when the primary is enabled. In the opening list,
  Enter moves to the next row's Debit field; Tab keeps its native order
  (Debit, Credit, next Debit).
- New components, each with its stylesheet, page object and test:
  `InvoiceWizard` (both steps, the pills as a segmented control),
  `InvoicePaymentWizard`, `OpeningBalancesWizard`, `DateField` (a text
  field showing the parsed date beside it when the text is short),
  `SupplierSelect` and the payment grid on M2a's `SelectableList` and
  `ChoiceSelect`. Every native `<select>` draws its chosen text through
  `ChoiceSelect`'s overlay (the visual tier cannot photograph a select's own
  text reliably).

## Tests

- **Domain:**
  - `invoiceTotals` on the two dump examples (Saturno 182.37 → 220.00 due,
    Pozzetto 2,588.05 → 3,002.14 due) and the rounding half up;
  - `invoicePostings` with and without withholding;
  - `openInvoices` with tranches, ordering and a fully paid invoice;
  - `validateEntry`: one test per new reason;
  - `canDeleteEntry` and `canEditEntry` both ways;
  - the seed test above;
  - the contracts on the simulator.
- **Core:** each new wizard machine step by step on the harness, as M2a's
  are:
  - the verdict after each edit;
  - the supplier prefill, and that it does not overwrite an edited field;
  - the pills;
  - a save that lands and reduces `openInvoices`;
  - a payment of the remainder that removes the invoice from the open list;
  - the opening prefill and its balance;
  - `editorOf` for every kind, the shape fallback included;
  - an edit that keeps the number and the stamp.

  `pnpm mutation-check` on `invoiceTotals`, `openInvoices`, the new
  `validateEntry` reasons and `parseDate`.
- **Client:** a page object per new component. The screen test:
  - registers an invoice through the page objects;
  - pays it in two tranches and sees it leave the payment grid;
  - edits the first payment's amount;
  - fails to delete the invoice while paid, deletes the payments, then
    deletes the invoice;
  - edits a generic entry and sees the same number in the grid.

  Fake timers, no sleeps.
- **Goldens**, both platforms, through the whole-app capture as M2a's:
  - `journal-wizard-invoice` (step 2 of a seeded supplier's invoice with
    withholding);
  - `journal-wizard-payment` (step 1 with Pozzetto 2013's open invoices);
  - `journal-wizard-opening` (the owners prefilled, the bank typed, the
    balance zero);
  - `journal-wizard-edit` (a generic entry in its editor).

  `Scenario.dialog` gains the three wizards with their fields and an `edit`
  form naming the entry.
- Coverage holds at the add-on's bar for every new file.

## Not built (to IDEAS or M2c)

- **To M2c:**
  - Record owner collection;
  - Budget allocation;
  - the delete and the edit of their kinds;
  - the 0/0 lines of the legacy allocation.
- **To IDEAS:**
  - an invoice split over several cost accounts (the legacy app allowed it; no seeded invoice uses it);
  - the mixed VAT amount;
  - the `quadroAc` flag;
  - opening invoices, a supplier's unpaid invoices carried into a new period with the opening entry;
  - a supplier's tax treatment as stored defaults (`masterDataTaxTreatment`; Pozzetto's suppliers have none, and the prefill from the last invoice covers the need);
  - carrying a period's closing balances into the next one's opening.
- Out of scope as in M2a: print and exports, the dialog drag, Saturno 2011's
  journal oracle, per-grid persistence.

## Build order

Each step ends with `pnpm gate:full:quiet` green and a commit, in the
worktree `m2b-journal`, one pull request:

1. Domain: `Rate`, `WithholdingTax`, `InvoiceTerms`, `Invoice`,
   `invoiceTotals`, `invoicePostings`, `openInvoices`, the new
   `validateEntry` reasons, `canDeleteEntry` and `canEditEntry`, with their
   tests.
2. Generator: invoices, the catalogue, the full parties with starting
   balances; the seed regenerated; the seed test.
3. Ports, contracts, simulators: `invoices`, `replaceEntry` (with
   `supplier-has-payments` and `below-paid`), `withholdingTaxes`, the new
   `parties`, the clock as an app port.
4. Core: books, the presenter's `replaceEntry`, `parseDate`, the wizard
   machine's `write` and `firstStep`, the three wizards, `editorOf` and the
   generic wizard's kind, the dialog machine.
5. Bindings.
6. Client: the three wizards, `DateField`, `SupplierSelect`, `✎`, the
   delete message, the keyboard; the screen test; the goldens.
7. STATUS (M2b out of "Next", M2c in, with this spec's link) and IDEAS.
