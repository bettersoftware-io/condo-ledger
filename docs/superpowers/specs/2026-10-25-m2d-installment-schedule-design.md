# M2d — Installment Schedule — design

Date: 2026-10-25. Status: written.

Parent spec: `docs/superpowers/specs/2026-10-11-app-v2-design.md` (Section 5,
M2: "Journal + ten wizards → Installments → Tables & Allocation → …"). The
Journal group's specs, whose shapes this one extends and does not repeat:
`2026-10-14-m2a-journal-design.md`, `2026-10-17-m2b-invoices-opening-edit-design.md`
and `2026-10-24-m2c-owner-collection-design.md` (installments, items, the
item a collection line pays, `itemBalances`, `InstallmentsPort`). Where they
differ, this one wins for M2d.

## Intent

An administrator sets, once a year, what each owner pays and when, and then
watches through the year who has paid what. The Installment Schedule screen
is that view: every owner, every installment, coloured by what is paid. The
user's instruction, carried over: decide from the legacy application and its
database, since the application never had real users.

## Sources

The decisions below rest on a survey of the design (`docs/design/web/v1/README.md`
§7 and the prototype `Condomini.dc.html`), the legacy client (`old/flex`) and
server, and the dump for Pozzetto 2013 (`p36`) and Saturno 2011 (`p1`). What
the survey found that shapes the design:

- The design draws the screen and its menus, but every menu item in the
  prototype only closes the menu: no flow is specified for any action.
- The legacy app implemented one action only, "Crea Rate Preventivo" (create
  budget installments), plus editing an installment's header, editing one
  item's amount, and deleting an installment. Advance ("acconto") and
  adjustment ("conguaglio") installments exist only as menu labels.
- The legacy algorithm (below) reproduces all 27 stored Pozzetto schedules
  exactly, given each resident's budget share. Saturno's stored items fit the
  same algorithm with whole-euro rounding and percentages 33.34/33.33/33.33.
  This corrects the M2c spec, which says the stored items cannot be
  recomputed by any formula.
- The legacy app never computed "Overdue" (`installmentsExpired()` returns 0;
  both printed schedules show 0,00 on every row).
- The domain's `computeInstallments` (`useCases/riparto/`) reproduces none of
  the stored items: it splits the budget evenly and ignores the previous
  balance. M2d does not use it.

## Scope

**In M2d:**

- the **Installment Schedule** screen, read from the period's stored data;
- **Create budget installments**, the legacy wizard;
- **Edit installment**: name, due date, locked;
- **Delete installment**;
- **editing one item's amount** in its cell;
- what the screen needs from the dump that the seed lacks: each resident's
  **role** and **period restriction** (dates).

**Not in M2d:**

- **Advance and adjustment installments.** The legacy app never implemented
  them; the design's menu shows them. They stay in the menu with M2a's
  "not built yet" notice, and go to `docs/IDEAS.md`.
- **The design's other menu items** ("Recalculate from budget", "Shift due
  dates", "Delete all installments"): same notice, same IDEAS entry.
- **Unit groups** (Saturno's A and B). They come with the Unit and
  UnitGroup entities of the Building Data & Units group; until then rows
  are units, then residents. A STATUS entry says so.
- **The allocation engine.** A resident's budget share is read from the
  period's stored budget allocation entry; the engine stays unwired.
- Print, PDF, XLS and ⟳: drawn, and showing M2a's "not built yet" notice, as
  the Accounts screen's print and export buttons do (`AccountsToolbar.tsx`).

## The screen

Management Menu "Installment Schedule" (`menu: "installments"`) opens it in
place of the placeholder. One panel, the Accounts screen's `TreeGrid`.

**Toolbar:** "Group rows by: By unit" (static text, as the legacy combo was
disabled), divider, `+ ▾` **Add installments** (Create advance installment ·
Create budget installments · Create adjustment installment), `✎ ▾` **Edit
installments** (one item per installment: `Edit "{name}"`; "No installments
to edit." when none), `− ▾` **Delete installments** (one item per unlocked
installment: `Delete "{name}"`; "No installments to delete." when none),
`⊞ ⊟`, print/PDF/XLS and ⟳ (the "not built yet" notice).

**Rows:** a root row (the building and period), then one row per unit in
unit-code order; a unit with one resident is one row (the resident, labelled
by unit code and name); a unit with several shows a unit row and one child
per resident, in residency order. A final **Roundings** row when its amount
is not zero. Root and unit rows are bold on `--zebra`.

**Columns** (the README §7 order), per resident:

| Column | Value |
|---|---|
| Groups / Units / Owners | unit code; the resident's name |
| Role | `PR` owner, `CO` co-owner, `TE` tenant… as the dump's role abbreviation |
| Restr. period | "{from} - end of FY", "start of FY - {to}", "{from} - {to}" (dd/mm/yyyy); blank for the whole period. The resident's restriction, or its unit's |
| Days | "{days}/{period days}" when restricted; blank otherwise (Pozzetto A04: 347/365 and 18/365) |
| Prev. bal. | the resident's lines on the owners account in the period's **opening entry** (debit positive); the party's `startingBalance` when the period has none. Equal on the seed for every resident |
| Total budget | the resident's line on the owners account in the period's **budget allocation entry** (`kind: "budgetAllocation"`), its share; 0 with none |
| Total due | Prev. bal. + Total budget |
| one per installment | the resident's item amount; blank when the resident has none |
| Total inst. | Σ the row's items |
| Paid | Σ `itemBalances(...).paid` over the row's items (collections linked to them) |
| Inst. bal. | Total inst. − Paid |
| Overdue | Σ remaining of the row's items whose due date is **before today** (`todayOf(clock)`, as the invoice payment wizard's "overdue") |

Unit and root rows sum their children, column by column; Role, Restr.
period and Days are blank there. The **Roundings** row shows, in Total budget
and Total due only, the sum of the budget allocation entry's lines on the
roundings-role account (Pozzetto −0.54 from the seed, Saturno 0.01), so the
root's Total budget equals the allocation's total.

Totale rate ≠ Totale dovuto by cents on many rows, and by whole credits on
residents whose credit exceeded the schedule (Pozzetto r170, r176): that is
the legacy data, shown as it is.

**Installment headers:** two lines, `{number}` with 🔒 when locked, and the
due date. Data-driven: any count.

**Cell colour** (design palette, README line 77): from the item's own paid
amount, `itemBalances`: amount 0 → no colour; paid ≥ amount → settled
`--ok`; 0 < paid < amount → partial `#e0892b` (a token, `--partial`);
paid 0 → unsettled `#2a6fdb` (`--unsettled`). Unit and root cells: the same
rule over the sums of their residents' items for that installment. On the
seed, item-linked payments equal an oldest-first spread of each resident's
payments, so this agrees with the design's oldest-first rule.

**Selection:** a row can be selected (the TreeGrid's); nothing else depends
on it in M2d.

## Create budget installments

`+ ▾ › Create budget installments` opens a three-step wizard on M2b's
`createWizardMachine` and `WizardDialog` ("Create Budget Installments").

**Step 1 — "Number and dates":** Number of installments* (1–12, default 3),
Due date of the first* (a date), Months between installments* (1–5,
default 4), and **Round to whole euros** (checkbox, off). Refused
`no-budget-allocation` when the period has no budget allocation entry.

**Step 2 — "Installments":** one row per new installment: Name* (default
`Installment {k}`, `k` = existing count + position), Due date (first +
(i−1)×months, the day clamped to the month's last; read-only), % of budget*.
Percentages default to `floor(100/n)` each, the first taking the rest
(3 → 34/33/33, 12 → 12 and 8×11); they may be typed with two decimals and
must add up to 100 (`percentages-not-100`). Names are unique in the period
(`name-taken`).

**Step 3 — "Review":** per resident: Total budget, Prev. bal., Total due, one
column per new installment, Total inst.; Save writes the installments and
their items.

**The algorithm** (the legacy generator; `InstallmentVO.as:383-447`,
`InstallmentGroupVO.as:212-330`), per resident:

1. `budgetPart = SB + B − Σ the resident's existing items − prevPart`, where
   `B` is Total budget, `SB` is Prev. bal., and `prevPart = SB` when the
   period has no installment yet, else 0. With no installments,
   `budgetPart = B`. With some, the new installments schedule what the old
   ones left out.
2. Item `i` = `budgetPart × pct_i / 100`, rounded half-up to the cent; with
   **Round to whole euros**, items 2…n are rounded half-up to whole euros and
   item 1 is `budgetPart − Σ items 2…n`.
3. `prevPart` is added to item 1.
4. Negative items carry forward: walking first to last, a negative item
   becomes 0 and its amount is added to the next; a negative left after the
   last is carried backwards the same way; a credit still left is dropped
   (every item 0).

No remainder correction: Σ items may differ from `budgetPart + prevPart` by
the per-item rounding, as in the legacy data.

**Reproduction** (a test over the seed): with each period's installments set
aside and their percentages, Pozzetto's 12 (12, 8×11; cents) reproduce 25 of
27 residents. r166 and r167 differ because the stored allocation entry
(898.80 / 46.49) is not the one the schedule was made from (898.64 / 46.63).
Saturno's 3 (33.34/33.33/33.33, whole euros) reproduce 9 of 10. r1 differs by
0.01, its rounding line.

New installments: type estimate, unlocked; `number` is the rank by due date
among the period's installments, then by id, which the port keeps.

## Edit installment

`✎ ▾ › Edit "{name}"` opens a dialog "Edit Installment": Name*, Due date*,
Locked (checkbox). While Locked is on, Name and Due date are disabled (the
legacy dialog). Refused: `name-taken`, a blank name.

## Delete installment

`− ▾ › Delete "{name}"` (unlocked installments only) asks with M2b's
`ConfirmAlert`: "Delete the installment “{name}”? This cannot be undone."
Refused `installment-locked`, and `installment-paid` when any of its items has
a collection line naming it (the legacy database refused it through its
foreign key). Its items go with it.

## Editing an item's amount

Click a resident's installment cell: M1's `InlineEditor`, en-US amount
(`parseAmount`), commit on blur or Enter, Esc cancels. Editable when the
installment is not locked **and** the item has no collection line naming it
(legacy `InstallmentItemVO.editable`); otherwise the cell is not editable
and its title says why. Sets that item only; nothing is redistributed.
Refused: `not-an-amount`, `negative-amount` (the schema's amount is
unsigned).

## Domain

- `OwnerParty` gains `role: string` (the abbreviation) and
  `restriction: Restriction | null`, `Restriction { from: string | null; to:
  string | null }` (ISO dates; the resident's own, else its unit's).
- `Installment` gains `locked: boolean`.
- Use cases:
  - `scheduleOf(books-shaped inputs, today)` builds the screen's rows;
  - `budgetSharesOf(entries)` reads the budget allocation entry (shares and
    roundings);
  - `previousBalancesOf(entries, parties)` reads the opening entry;
  - `planBudgetInstallments(input): ResultOf<InstallmentDraft[]>` is the
    algorithm.
- Write rules, as M2a's `validateEntry` is for entries: `validateSchedule` for
  create, edit and delete; `validateItemAmount`. Their reasons are those
  named above.

## Ports

`InstallmentsPort` (M2c's, read-only) gains writes, in the parent design's
words ("create installments, set amount"):

- `createInstallments(periodId, drafts)`;
- `updateInstallment(id, patch)`;
- `deleteInstallment(id)`;
- `setItemAmount(itemId, amount)`.

Each is judged by the domain rules and answers `ResultOf`, as `JournalPort`
does. The reads emit again after a write. The contract grows with each
write. The journal simulator still judges collections against the schedule
the installments port holds now: both simulators share one store per seed,
or the journal reads the installments port; the plan chooses.

## Core

- A presenter, `installmentSchedulePresenter`, over the books: rows, columns,
  headers, `today` from the clock. The books gain nothing new beyond the
  parties' new fields.
- Machines: the create wizard; the edit dialog; the inline amount edit
  (M1's inline editor machine); delete through the presenter's intents.

## Client

`InstallmentScheduleScreen` (a thin view-model reader) with a toolbar,
`TreeGrid` and money cells, the wizard and the dialog. Copy and measures
follow the design; the wizard is 680px wide like M2b's.

## Seed

The generator adds, per resident, `role` (from `unitResidentPriorityId` and
the unit's ownership scenario, as the legacy app's role abbreviation) and
`restriction` (`unitResident.periodRestriction*`, else the unit's), and per
installment `locked`. Expected from the dump:

- Pozzetto: r166 from 2013-01-19, r167 to 2013-01-18; r188 `CO`.
- Saturno: units A1, A2, A3 restricted (A1 2011-05-01 to 2011-05-31, A2 from
  2011-05-27, A3 to 2011-05-27); r3 and r7 `CO`; installment 1 locked.

## Tests

- **Domain:**
  - the algorithm, on a small schedule, for each step (percentages, cents and
    whole euros, prevPart on item 1, forward and backward carry, dropped
    credit, a second batch over existing items);
  - the reproduction test above;
  - `scheduleOf` totals equal the printed schedules' root rows:
    - Pozzetto: Prev. bal. −6,250.99, Total budget 38,000.00, Total inst.
      33,591.88, Paid 21,825.98, Inst. bal. 11,765.90;
    - Saturno: 288.92, 7,400.00, 7,688.92, 3,279.97, 4,408.95.
- **Ports:** contract tests for every write and refusal.
- **Core:** the wizard's steps and verdicts; the edit dialog; delete
  refused while paid; a write re-emits the rows.
- **Client:** page objects; the screen renders p36 with the root totals
  above; an inline edit; the wizard end to end on a period with no
  schedule (delete every unpaid installment of a test seed first).
- **Visual:**
  - the screen as a page at 1280 (p36, light);
  - component scenarios for the wizard's step 2 and the edit dialog
    (`capture: "viewport"`);
  - a money cell in each of its three colours.

## Review focus (what a person would expect)

1. Saving a new schedule writes exactly what step 3 showed.
2. A paid installment cannot be deleted, and a paid item cannot be edited.
   Nothing a collection names is ever removed.
3. Deleting a collection (M2c) makes its installment deletable again.
4. A second batch over an existing schedule adds only what the first left
   out, so Total inst. reaches Total due within the rounding.
5. The root row's totals equal the printed schedule's.
