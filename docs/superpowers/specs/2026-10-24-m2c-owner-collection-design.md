# M2c — Record owner collection — design

Date: 2026-10-24. Status: written.

Parent spec: `docs/superpowers/specs/2026-10-11-app-v2-design.md` (Section 5,
M2). Previous specs of the Journal group:
`docs/superpowers/specs/2026-10-14-m2a-journal-design.md` and
`docs/superpowers/specs/2026-10-17-m2b-invoices-opening-edit-design.md`. This one
extends their shapes and does not repeat them: the ports, the books presenter,
the wizard machine with a verdict per step, `validateEntry` over an
`EntryContext`, `canDeleteEntry`, `canEditEntry`, `editorOf`, the dialog, the
goldens. Where they differ, this one wins for M2c.

## Intent

An administrator records, all year long, what owners pay towards their
installments. That should take seconds: pick the owner, confirm the amount
and the account, save. The user's instruction, carried over from M2b: make
the operations fast and easy, and decide from the legacy application and its
database, since the application never had real users.

## Scope

**In M2c:**

- the **Record owner collection** wizard;
- **installments in the app**, read-only: each period's installment schedule
  and its items, projected from the legacy dump as they are stored;
- the link from a collection's lines to the items they pay, and what each
  item still owes, always derived from the payments;
- **edit and delete** of a collection.

**Not in M2c (agreed with the user, 2026-10-24):**

- **Budget allocation.** It needs units, thousandth tables, residency dates
  and the allocation engine running in the app, none of which the app has.
  The engine in `packages/domain/src/useCases/riparto/` reproduces Saturno
  2011 but is off on Pozzetto 2013 (cents per owner, about €426 between the
  two residents of unit A04). No legacy code ever wrote an allocation: both
  in the dump were inserted by hand. It moves to the Tables & Allocation
  group. The menu item keeps M2a's notice.
- **Creating or editing an installment schedule** ("Crea Rate Preventivo" in
  the legacy app), the Installment Schedule screen, and whether a resident's
  `startingBalance` follows the opening entry (installment 1 embeds it). They
  move to the Installments group.

## What the surveys found

Three surveys on 2026-10-18 and a fact check on 2026-10-24 (the app, the
legacy code in `old/flex`, the dump, the design). What shaped this design:

| Found | Consequence |
|---|---|
| The legacy wizard: pick a person (one row across all their units), tick installment items (a tick pays the item's whole residual; the last one can be lowered), pick a liquidity account (the default bank preselected), review the description. No date, no edit, no overpayment, no credit, no advance | The flow keeps the person, the account and the ceiling. The ticks become one amount (next row) |
| In the dump, every collection pays the person's open items oldest first. Spreading each entry's amount oldest first reproduces all 36 Pozzetto collections line for line. Of Saturno's 4, two match; one (tx167) has the same lines in another order, one (tx6) is a hand split of 1,000.00 over two items | One amount, spread oldest first, as the design shows. The person never ticks. A seeded entry keeps its lines as written until its amount is changed |
| An item's paid amount is stored nowhere: it is the item minus the collection lines that name it. The `status` column is never written by code | Derived, never stored, as M2b's invoice `paidOn` |
| Every one of the 111 collection credit lines names exactly one item, of its own resident and person (`ledgerEntry.installmentItemId`). The generator drops the link | The posting carries the link; the generator keeps it |
| The app has no installments: no entity, port or seed section | Installments enter the domain, the seed and a port, read-only |
| Pozzetto 2013: 12 installments (ids 25–36, due the 20th of each month), 324 items (27 residents × 12), 150 of them zero. Saturno 2011: 3 installments (ids 1, 5, 6), 30 items, one zero. The stored items cannot be recomputed by any formula the app has (Saturno's were edited by hand) | The seed carries the stored items as they are |
| 21 of the 111 lines pay an item before its due date | An item not yet due can be paid |

## Domain

### Entities

```ts
/** One installment of a period's schedule: "Rata 1", due on a date. */
export interface Installment {
  id: string;          // "in<legacy id>"
  periodId: string;
  number: number;      // 1-based, by due date
  name: string;        // the stored name, e.g. "Rata 1"
  dueDate: string;     // "YYYY-MM-DD"
}

/** What one resident owes on one installment. */
export interface InstallmentItem {
  id: string;          // "ii<legacy id>"
  installmentId: string;
  residentId: string;  // an OwnerParty id of the period
  amount: Cents;       // never negative; zero items exist
}
```

`Posting` gains `installmentItemId?: string`: on a collection's owner credit
line, the item it pays. It is absent on every other line of every kind.

### Use cases

- **`itemBalances(items, installments, entries): ItemBalance[]`**, with
  `ItemBalance = { item, installment, paid, remaining }`. `paid` is the sum
  of the credits of the `collection` entries' lines that name the item.
- **`owedBy(personId, parties, balances): ItemBalance[]`**: the open items
  (remaining > 0) of every residency of that person, ordered oldest first:
  due date, then installment number, then unit code.
- **`settleOldestFirst(amount, open): ResultOf<Settlement[]>`** with `Settlement = { item,
  amount }`: walks the ordered open items and pays each one's remaining
  until the amount is spent; the last may be partial. Rejected with
  `over-owed` when the amount exceeds the total remaining.
- **`collectionPostings(person, account, settlements, accounts)`**: the
  liquidity account debited with the total (first line, no counterpart),
  then one credit per settlement on the owners-role account, with the
  item's resident as counterpart and the item's id.
- **`validateEntry`** keeps M2b's reasons and order and adds, after
  `opening-exists`:

  | Reason | When |
  |---|---|
  | `item-not-allowed` | an `installmentItemId` on a line that is not an owners-account credit of a `collection` |
  | `item-required` | a `collection` credit on the owners account without an item |
  | `unknown-item` | an item the period does not have |
  | `wrong-resident` | a line whose counterpart is not the item's resident |
  | `over-remaining-item` | the entry's lines on one item, added together, above what the item still owes (on an edit: plus what the entry itself pays on it now) |

  `EntryContext` gains `installments` and `installmentItems`.
- **`canDeleteEntry`**: `collection` joins the deletable kinds. Deleting it
  reopens its items, since paid is derived.
- **`canEditEntry`**: `collection` joins the editable kinds.

Oldest first is the wizard's rule, not the port's: the port refuses only
what would make the books wrong (above, and the M2a/M2b rules).

### Ports

A new **`InstallmentsPort`** (read-only in M2c; the Installments group adds
its commands):

```ts
/** The period's installment schedule. Errors as entries() does. */
installments(periodId: string): Observable<Installment[]>;
/** What each resident owes on each installment of the period. */
items(periodId: string): Observable<InstallmentItem[]>;
```

With a contract in `__contracts__`, a simulator, and `AppPorts.installments`.
The journal simulator judges a collection with the installments of its
period (it receives the installments simulator, or the seed's lists, as the
plan decides). Its contract grows: a collection lands and its items' paid
amounts follow; a line above an item's remaining is refused; a collection
is edited in place and deleted.

### Seed

The generator emits, for each period that has a schedule (p36 and p1 among
the seeded ones):

- `installments`: the `installment` rows, ids `in<id>`, numbered by due date;
- `installmentItems`: the `installmentItem` rows, ids `ii<id>`, resident
  `r<unitResidentId>`, amount in cents, zero items included;
- `installmentItemId` on each collection credit line, from
  `ledgerEntry.installmentItemId`.

A test over the committed seed proves the link and the derivation:

- every collection owner credit names one item of its own resident (111 of
  111), and no other line names one;
- at period end, Pozzetto 2013: paid 21,825.98, remaining 11,765.90; 95
  non-zero items fully paid, 1 partly (ii789: 141.24 of 179.38), 78 unpaid;
  Saturno 2011: paid 3,279.97, remaining 4,408.95; 7 / 2 / 20;
- `settleOldestFirst` over each collection's amount, oldest first against the items
  open before it, gives that collection's lines for all 36 Pozzetto
  collections, and for Saturno's tx166 and tx168.

The two oracle fixtures and the Accounts and Journal goldens do not change.

## Core

`Books` gains `installments` and `installmentItems`, read with the rest.

### Record owner collection (three steps)

Kind `collection`. Wizard name "Record Owner Collection" (the design's).

- **Step 1, "Choose an owner".** A grid of persons, one row per person
  across all their residencies of the period: `Name | Units | Total inst. |
  Paid | Inst. balance` (the design's columns, plus Units). Only persons who
  still owe something are listed (fast: the rest cannot pay), in unit order.
  Empty state: "No owner has an installment to pay." Rule: `no-owner`.
- **Step 2, "Amount and liquidity account".** The liquidity list (M2b's
  `liquidityChoices`, labelled "LIQUIDITY ACCOUNT COLLECTED INTO"), the
  bank-role account chosen first. `Amount collected *`, prefilled with what
  the person owes on items due by today; when nothing is due yet, with the
  remaining of their next item. Below it, the hint "The amount is allocated
  against the owner's outstanding installments, oldest first." and the
  settlement as it stands, updated as the amount changes: one row per item
  paid, `Installment | Unit | Due | Owed | Paid now`, the last one marked
  partial when it is. Rules: `no-liquidity-account`, `not-an-amount`, and
  `over-owed`, shown as "{person} owes {total} in all.".
- **Step 3, "Description".** `Description *` prefilled "Collection of
  installments from {person}: {list}", where `{list}` is each settled item
  as "{installment name} ({dd/mm/yyyy})", joined by ", " (the legacy
  pattern, in English). It follows the choices until the person edits it.
  The shared "Entry postings" preview (my call: the app's one preview, not
  the design's 5-column grid).
- **No date field** (as the legacy wizard and every M2a/M2b wizard: the port
  stamps the entry).

**Editing** (`editorOf` gives `"collection"` for every collection; the seed
test checks all 40 fit: one liquidity debit on a `liquidityChoices` account,
every credit naming an item of one person). The edit starts at step 2 with
the person fixed. The form holds the entry's account and amount. While the
amount is the entry's own, its lines are kept as written (so tx6 and tx167
save unchanged); once the amount changes, the settlement is recomputed
oldest first over the person's items, with this entry left out. The
description starts as written; when the settlement is recomputed it is
regenerated, unless the person has typed in it during this edit (my call,
unlike M2b's edits, which keep every field as written: a collection's
description lists the installments it pays, and a stale list would
contradict the lines; the regenerated text is English even where the seeded
one is Italian). A collection never falls back to the generic editor, since
a generic draft cannot carry items.

**Delete** uses M2a's confirm; nothing else changes.

## Client

- `JournalToolbar`: "Record collection" opens the wizard.
- `CollectionWizard` (three steps) on M2b's `WizardDialog`, `SelectableList`
  for the persons grid, the liquidity list as in `InvoicePaymentWizard`, and
  a read-only settlement table. Every M2b keyboard rule holds: focus on the
  first empty or required field, Enter presses the primary button.
- `DeleteEntryConfirm` and the `kind-not-editable` text no longer apply to
  collections.

## Tests

- **Domain:** `itemBalances` (tranches, zero items, a payment of another
  item), `owedBy` ordering across units, `settleOldestFirst` (exact, partial last,
  `over-owed`), `collectionPostings`, each new `validateEntry` reason
  (`over-remaining-item` on an add and on an edit), `canDeleteEntry` and
  `canEditEntry` for collections, the installments contract on the
  simulator, the seed test above.
- **Core:** the wizard step by step on the harness over the real seed: the
  persons listed, the prefilled amount, the settlement as the amount
  changes, `over-owed`, a save that lands and lowers what the person owes,
  an edit that keeps a seeded entry's lines unchanged, an edit that changes
  the amount and reallocates, a delete that reopens the items.
- **Client:** page objects for the new component; the screen test records a
  collection for a Pozzetto owner, sees the person's balance fall, edits its
  amount, deletes it.
- **Goldens:** `journal-wizard-collection-owner` (step 1, Pozzetto 2013) and
  `journal-wizard-collection-amount` (step 2 for one person, the settlement
  showing a partial last item).
- Coverage at the add-on's bar for every new file.

## Decided here (my calls)

- One amount spread oldest first, not ticks: the dump's own operators did
  exactly that in every Pozzetto collection, and it is the design's flow.
- No credit or advance above what the person owes (the legacy rule).
- Only persons who owe something are offered.
- Items of every seeded resident count, including a residency that ended in
  the period (r167 paid after leaving): the generator's overlap rule already
  decides who is a resident of the period.
- A new collection is numbered after the period's last entry, closing
  included (the legacy app did the same in Saturno 2011).
- The description is English, like M2b's generated descriptions; the
  installment names stay as the seed stores them ("Rata 1").

## Build order

Each step ends with `pnpm gate:full:quiet` green and a commit, in the
worktree `m2c-collection`, one pull request:

1. Domain: the entities, `itemBalances`, `owedBy`, `settleOldestFirst`,
   `collectionPostings`, the `validateEntry` reasons, `canDeleteEntry`,
   `canEditEntry`.
2. Generator and seed: installments, items, the posting link; the seed test.
3. The installments port, its contract and simulator; the journal simulator
   judging collections; `Books`.
4. Core: the wizard, `editorOf`, the dialog machine.
5. Bindings.
6. Client: the wizard, the toolbar item, the screen test, the goldens.
7. STATUS (M2c out of "Next"; Budget allocation and the schedule work under
   the Tables & Allocation and Installments groups) and IDEAS.
