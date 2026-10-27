# M2e — Thousandth Tables & Allocation — design

Date: 2026-10-26. Status: written.

Parent spec: `docs/superpowers/specs/2026-10-11-app-v2-design.md` (Section 5,
M2: "Journal + ten wizards → Installments → Tables & Allocation → …"). The
Journal and Installments specs (`2026-10-14-m2a-journal-design.md`,
`2026-10-17-m2b-invoices-opening-edit-design.md`,
`2026-10-24-m2c-owner-collection-design.md`,
`2026-10-25-m2d-installment-schedule-design.md`) set the shapes this one
extends: wizards, `ResultOf` writes, notices, the books, `budgetSharesOf`.
Where they differ, this one wins for M2e.

## Intent

Each year an administrator decides how the building's costs are shared:
which thousandth table each cost follows, and each unit's thousandths in it.
The allocation turns that into what every owner and tenant owes, account by
account. They check the result on screen, correct a coefficient if needed,
and then post the budget allocation to the journal. The installments of M2d
are later planned from that entry. The user's instruction, carried over:
decide from the legacy application and its database, since the application
never had real users.

## Sources

The decisions below rest on three surveys, kept beside the worktree in
`.superpowers/tables-allocation/` (git-ignored):

- `ta-legacy.md`: the legacy Flex client and PHP server (`old/flex`) and the
  Pozzetto 2013 and Saturno 2011 dumps.
- `ta-design.md`: the design (`docs/design/web/v1/README.md` §4, the
  prototype `Condomini.dc.html`, the Saturno and Pozzetto exports).
- `ta-codebase.md`: what this repository already has.

What the surveys found that shapes the design:

- **The legacy allocation is computed in the client.** It lives in the AS3
  value objects (`UnitResidentVO.getShareByExpenseLedgerAccount`,
  `compoundCoefficient`, `isElectedForPriority`); the PHP holds a copy for the
  PDF reports. A re-implementation reproduces both stored allocations:
  - Saturno 2011: all 10 residents;
  - Pozzetto 2013: 25 of 27 residents as posted, and all 27 as the legacy
    PDF report prints them.

  The two Pozzetto exceptions are the two residents of unit A04, who changed
  hands on 2013-01-19. The posted entry has 898.80 and 46.49; the algorithm
  and the report both give 898.64 and 46.63. The posted entry was typed in by
  hand: no legacy code creates an allocation entry (M2c's finding, confirmed).
- **The domain's engine (`useCases/riparto/`, `buildRiparto`) is not the
  legacy algorithm.** It has no residency days, rounds differently and emits
  no roundings. That is the cause of the "A04 divergence" recorded in
  STATUS. The app does not use it; only `packages/legacy-import` does.
- **Several controls were disabled in the legacy screen:** "Group rows by",
  "Group cols by" and "Include installments". The design's prototype draws
  them and wires none of them.
- **The prototype has no recompute.** An edited coefficient changes its cell
  and nothing else; the README promises a live recompute without saying how.
  The legacy app re-binds the allocation grid after each saved coefficient.
- **The app seed lacks this screen's data.** It already holds both periods
  (Saturno `p1`, Pozzetto `p36`) with their accounts, entries, owners and
  their residency dates (M2d). It has no thousandth tables, coefficients,
  account-to-table links, units, unit groups, account abbreviations or
  co-ownership percentages.

## Scope

**In M2e:**

- the **Thousandth Tables & Allocation** screen: tables, coefficients,
  allocation, read from the period's stored data;
- **the legacy allocation algorithm** as a domain use case, live in the app,
  in both modes (budget and final balance);
- **add, edit and delete a thousandth table**;
- **editing a coefficient** in its cell, with the allocation following at
  once;
- the Journal's **Budget allocation** wizard (today a "not yet available"
  notice), and deleting a budget allocation entry;
- the **Allocation tables** of a cost account, read-only, in Account Details
  (today an empty box);
- what the screen needs in the seed: units, unit groups, tables,
  coefficients, account-to-table links with their role shares, account
  abbreviations, co-ownership percentages;
- the parity specs in `packages/legacy-import` moved onto the new use case.
  The A04 "accepted gap" is closed, and STATUS's entry with it.

**Not in M2e:**

- **Editing an account's tables and role shares** (Edit Account's ALLOCATION
  TABLES grid). The Edit Account dialog is not built; the mini-grid shows the
  links read-only.
- **Editing units, groups and residents**, and drawing unit groups in the
  Installment Schedule. These stay with Building Data & Units. STATUS's
  "Unit groups" entry is reworded: the entities now exist; the schedule does
  not use them yet.
- **Retiring `buildRiparto` and the prototype's seed**
  (`packages/legacy-import/seed/data.generated.json`, which nothing reads).
  After M2e the old engine's only callers are that seed's generator. A STATUS
  entry records the removal as the next tidy-up.
- **Meters** ("Counter"): no data, and the legacy column was never bound. The
  column is drawn, always blank.
- **The table's "Restriction on" group, edited.** It is shown, and it limits
  the coefficients tree, as in the legacy app. The legacy form did not edit
  it either.
- Print, PDF, XLS, ⟳ and ⓘ Legend: drawn, with M2a's "not yet available"
  notice, as on the other screens.

## The allocation (domain)

A pure use case, `allocationOf(input, mode)`, with `mode` `"budget"` or
`"finalBalance"`. It is the legacy algorithm (`ta-legacy.md` §3), and every
amount is in integer cents.

**What it reads.** Per period:

- accounts with type, parent, budget and their links;
- links: `{ accountId, tableId, use: "budget" | "finalBalance" | "both",
  percentage | null, roles: { priority 1–4: percentage | null } }`;
- tables with their coefficients per unit;
- units with their group and restriction;
- residents with unit, role priority, co-ownership percentage and own
  restriction;
- in final-balance mode, each account's balance for the period from the
  books. For an individual-expense account (`controlUnitResident`), each
  resident's own postings.

**The amount of an account, per resident:**

1. **A grouping account** is the sum of its children, each child allocated
   on its own and rounded to the cent, then summed.
2. **A `control` account** is 0.
3. **A `controlUnitResident` account** is 0 in budget mode. In final-balance
   mode it is the sum of the resident's own postings on it; no tables are
   involved.
4. **A regular account** has a base: its budget, or its balance in
   final-balance mode. It takes the links of the nearest account up its chain
   that has links; with none, it allocates nothing. Its share is built link by
   link, for each link whose `use` matches the mode:
   - `tic` = the unit's coefficient ÷ the table's total. It is 0 when the
     total is 0 or the unit has no coefficient; skip the link then.
   - `tc` = the link's percentage ÷ 100, or 1 when it is empty.
   - For each role column the resident is **elected** for: `rc` = that
     column's percentage ÷ 100 (1 when empty), and
     `sub = round2(round12(base × tc × rc × tic × compound))`. The share is
     then `round2(share + sub)`.
5. **Elected.** A resident of priority p pays the role column of priority q
   when p = q, or when p < q and no other resident of the same unit has a
   priority in (p, q]. So an owner pays the tenant's columns when the unit
   has no tenant.
6. **Compound coefficient** = co-ownership factor × residency factor:
   - **Co-ownership factor**, over the residents of the same unit with the
     same role:
     - if their percentages sum to more than zero, this resident's percentage
       ÷ 100, or 0 for a resident with no percentage (the "0/0 lines");
     - otherwise 1 ÷ how many there are.
   - **Residency factor** = the resident's days ÷ the unit's days, only for a
     resident with a restriction of their own; otherwise 1. Days are
     inclusive, counted over the period. A unit's own restriction does not
     prorate: Saturno's A1 is restricted to May and still pays its full
     share.
7. **Rounding.** `round(x, p)` is `Math.round(Number((x × 10^p).toPrecision(12))) / 10^p`.
   That is half toward +∞, as AS3's `Math.round`; M2d uses the same rule.
8. **Rows.** A unit, a group and the root are the sums of their children.
   The **Roundings** row, per account column, is the account's total (its
   budget, the sum of its children's budgets, or its balance) minus the sum
   of every resident's share.

**The columns** are the top-level cost accounts: children of the expenses
root, in account order. Saturno has six: the prototype's five and "Spese
personali" (individual expenses), which the legacy report prints too and
the prototype leaves out; it is 0.00 in budget mode. A column is headed by the account's abbreviation, or
its name when it has none. **Total** is the expenses root. **Prev. bal.** is
the resident's previous balance (`previousBalancesOf`, M2d). **Total due** is
Total + Prev. bal. **Paid** is the sum of the resident's collections in the
period, as M2c and M2d already count it. Paid is the same in both modes, and
the Roundings row shows "–" for Prev. bal. and Paid.

**Pinned figures** (`ta-legacy.md` §5 and `ta-design.md` §4 and §7). Every
one is a test:

- **Saturno budget:**
  - root 2,800.00 / 1,300.00 / 950.00 / 1,900.00 / 450.00, and 0.00 on
    "Spese personali" (Σ 7,400.00);
  - Roundings 0.01, in Water only;
  - resident Totals A1 856.41; A2 PR 476.00 and CO 752.73; A3 2,174.32;
    A4 2,782.64; B1 PR 56.00 and CO 31.79; B2 89.96; B3 91.12; B4 89.02.
- **Saturno final balance:**
  - root 1,378.40 / 491.84 / 116.99 / 467.96 / 0.00 (Σ 2,455.19);
  - Roundings −0.01 / 0.03 / −0.01 / 0 / 0.
- **Pozzetto budget:**
  - Σ 38,000.00;
  - resident 162 (A01) 166.68 on "Generali PR" and a Total of 1,687.31;
  - A04 from 2013-01-19 170.97 and until 2013-01-18 8.87 on "Generali PR";
    their Totals 898.64 and 46.63;
  - A18 PR 42.00 and CO 42.00 on "Generali PR+CO"; on "Generali CO", PR 0.00
    and CO 246.76;
  - Roundings −0.07, −0.20, −0.14, +0.02, −0.01, −0.01, −0.02, −0.06, −0.03
    (Total −0.52), on the columns the report names.
- **Pozzetto final balance:** Σ 34,887.71; "Individual" 489.06 on the root.

The use case also gives **the table totals** (the plain sum of the
coefficients; it is not forced to be 1,000) and **the coefficients tree**.

## The screen

Management Menu "Thousandth Tables & Allocation" (`menu: "thousandths"`)
replaces the placeholder. The layout follows the design (`ta-design.md` §1):
a top row with **Thousandth Tables** | **Table Coefficients**, a vertical
splitter between them, then a horizontal splitter, then **Allocation**. Only
the Allocation panel maximizes. The splits default to 0.5 and clamp to
0.2–0.8. Measures, strings and widths follow the prototype where it and the
README differ (`ta-design.md` §8 lists them). The Allocation's first track is
`minmax(380px, 1fr)`.

**Thousandth Tables:**

- Columns: `Name | Restriction on | Counter | Total`.
  - Restriction on: the group's name, or blank.
  - Counter: always blank.
  - Total: 4 decimals, plain.
- Rows sorted by order. Clicking a row selects it, and the selection drives
  the coefficients. A period starts on its first table.
- Toolbar: `+` (New Thousandth Table), `✎` (Edit Thousandth Table on the
  selection), `−` (delete the selection), then print, PDF and XLS. `+` opens
  its dialog directly: the design's `▾` has no menu behind it, and the legacy
  app had a single add. My call.

**Table Coefficients:**

- Columns: `Unit | Period | Coefficient`.
- A tree of groups, then units, for the selected table:
  - limited to the table's restriction group when it has one;
  - a group row shows the sum of its units, bold, on `--zebra`;
  - Pozzetto has no groups, so its units sit at the top;
  - a unit is labelled `{code} - {its residents' names}`, as in the design;
  - Period is the unit's restriction as the schedule writes it
    (`dd/mm/yyyy - end of FY`, `start of FY - dd/mm/yyyy`), or blank;
  - Coefficient has 4 decimals.
- **Editing.** A unit's coefficient is edited in place with M1's inline
  editor, the one the Accounts budget uses: a click opens it, Enter or blur
  commits, Esc cancels. The value is read in the amount locale (M2's
  `parseHundredths` family, at 4 decimals).
  - It is refused when it is not a number, is negative, or has more than 4
    decimals: "Enter a coefficient of zero or more, with at most 4 decimals".
    The legacy limits are unsigned and 4 decimals.
  - The total need not be 1,000; Pozzetto's are not.
  - A saved coefficient changes the table's Total, the group sums and the
    Allocation at once.
- Toolbar: `⊞ ⊟`, then `⟳` with the notice.

**Allocation:**

- Toolbar:
  - the mode button: `Budget ▾` or `Final balance ▾`. It opens a popover with
    "Budget allocation" and "Final-balance allocation", the README's names
    for the legacy's Preventivo and Consuntivo. The prototype's "Actual" is
    not used: the legacy word is final balance. My call.
  - "Group rows by: By unit ▾", "Group cols by: By account ▾" and "Include
    installments", drawn **disabled**, as in the legacy app;
  - `⟳` with the notice.
- Columns: `Groups / Units / Owners | Role | Restr. period | Days`, one
  column per account, then `Total | Prev. bal. | Total due | Paid`.
- Rows: the period → its groups → their units → the residents, then a
  final **Roundings** row at the root, in italics and `--txd`. A unit with
  one resident is a leaf that shows the resident (as the legacy tree does). A
  resident's label is their name, with " (PR 50%)" when they have a
  co-ownership percentage. Days is `days/period days`, only on a row with a
  restriction of its own, as M2d's `daysOf`.
- Money cells use the non-plain colours (negative red, zero grey); aggregate
  rows are bold. Rows do not select. `⊞ ⊟`, then print, PDF and XLS.
- When the period has nothing to allocate (no tables, or no budget), the
  grid still draws its tree, with zeros, and the Roundings row shows each
  budget unallocated. No empty-state text: the design draws none.

## New, edit and delete a thousandth table

- **The dialog**, "New Thousandth Table" or "Edit Thousandth Table", 560px
  wide (README):
  - Name* (required, unique in the period: "A table named {name} already
    exists");
  - Order (a whole number from 1; a new table defaults to the highest order
    + 1);
  - NOTES.
- **A new table** gets a coefficient of 0 for every unit of the period, as
  the legacy server did, and is selected.
- **Delete** asks "Delete the table {name}?" (M2a's `ConfirmAlert`). It is
  **refused while an account links to the table**: "{name} allocates {account
  path}; unlink it first". The legacy server cascaded the links away
  silently, with a TODO to check; a silent change to the allocation is worse
  than a refusal. My call.

## Budget allocation (the Journal's wizard)

The Add transaction menu's "Budget allocation" opens a one-step wizard,
"Budget Allocation — Accounting entry summary", 680px wide like the other
wizards (`ta-design.md` §5):

- **Building / Period**: read-only.
- **Description**: editable, prefilled "Budget allocation (no.1)", with the
  helper text "Auto-generated from the approved budget — each owner is
  charged their share and the revenue account is credited."
- **The postings preview**, as the other wizards show it:
  - one debit per resident on the owners' account (`role: "owners"`), with
    the resident as counterpart, for the resident's budget Total. This
    includes 0.00 lines, as the Pozzetto entry has them;
  - one line on the roundings account (`role: "roundings"`) for the
    allocation's total Roundings, charged to the first resident by unit
    order. Saturno's entry does exactly this (+0.01 on A1); the legacy
    allocation never computed roundings per resident, and Pozzetto's 27
    lines of −0.02 were typed by hand. My call;
  - one credit, for the budget total, on the account with the new role
    `budgetAllocation` ("From owners › From budget allocation"; in the seed
    `la49` "Da riparto preventivo" in p1, and its twin under `la229` in p36).

  The entry's kind is `budgetAllocation`, and it balances by construction.
  **Its 0.00 lines are kept**: M2a's `validateEntry` refuses an empty line
  (`"empty-line"`) for every other kind and admits it for `budgetAllocation`,
  as the legacy entry has them, so every resident has a line M2d's
  `budgetSharesOf` reads. My call.
- **Refusals** (the wizard's verdict, worded as the others):
  - the period already has a budget allocation: "This period already has a
    budget allocation; delete it first";
  - an account has a budget and allocates nothing (no links up its chain, or
    every linked table's coefficients are 0 for every unit): "{account path}
    has a budget but no table to allocate it";
  - the budget total is 0: "There is no budget to allocate";
  - the period has no account with the role `owners`, `roundings` or
    `budgetAllocation`: "This period has no {owners' | roundings | budget
    allocation revenue} account".
- **Editing** stays off, as in the legacy app. **Deleting** becomes allowed
  (`canDeleteEntry`), as in the legacy app. To redo an allocation, delete it
  and create it again. Installments already planned from it keep their
  items: M2d reads the shares only when it plans.

## Account Details

For a cost account, the fieldset "ALLOCATION TABLES" lists the links that
apply. These are its own, or else its nearest ancestor's, and then the
legend keeps "(USES PARENT ACCOUNT SETTINGS)". The mini-grid follows the
design, `% | Table | PR/NP/LE | US/CF | CO | SC | Table restr. on group`:

- blank cells are "-";
- the last column is "-None-" (the legacy field exists, and neither dump
  sets it);
- the empty state stays: "No tables linked — uses parent account settings.";
- "Separate tables for budget & final balance" shows yes when any link's
  `use` is not "both".

Read-only.

## Domain

- **Entities:**
  - `Unit { id, periodId, code, groupId | null, restriction }`;
  - `UnitGroup { id, periodId, code, name, parentId | null }`;
  - `ThousandthTable { id, periodId, name, order, notes, restrictionGroupId
    | null }`;
  - `Coefficient { tableId, unitId, value }`, where `value` is in
    ten-thousandths, an integer;
  - `TableLink` as above.
- **Account** gains `abbreviation: string | null` and `links: TableLink[]`.
  `AccountRole` gains `budgetAllocation`: the revenue account a budget
  allocation credits.
- **OwnerParty** gains:
  - `unitId`;
  - `share: number | null`, the co-ownership percentage, in ten-thousandths
    of a percent (the dump's `decimal(10,6)`; Saturno and Pozzetto use
    whole percentages);
  - `ownRestriction`, the resident's own dates, kept apart from
    `restriction`, which stays as M2d defined it.
- **Use cases:**
  - `allocationOf`, above;
  - `tableTotalsOf`;
  - `coefficientsTreeOf`;
  - `budgetAllocationDraftOf(allocation, books)`, the entry, or a reason;
  - `validateTable`;
  - `validateCoefficient`.
- `canDeleteEntry` admits `budgetAllocation`; `validateEntry` admits its
  0.00 lines.

## Ports

- **`TablesPort`** (the parent design's): `tables(periodId)`,
  `coefficients(periodId)`, `addTable`, `editTable`, `deleteTable`,
  `setCoefficient(tableId, unitId, value)`. Each write is judged by the
  domain rules and answers `ResultOf`, as `JournalPort` does; the reads emit
  again after a write.
- **`UnitsPort`**, read-only for now: `units(periodId)`, `groups(periodId)`.
  Its writes arrive with Building Data & Units.
- **`AccountsPort`**: the accounts carry `abbreviation` and `links`. It
  gains no write.
- `JournalPort.addEntry` takes the budget allocation like any entry.
  `deleteTable` refuses a linked table, so the tables simulator reads the
  accounts. The plan chooses how: a shared store per seed, as M2d did for
  installments, or a reader.
- Contract tests for every read, write and refusal, run against each
  simulator.

## Core

- `allocationPresenter`: the period's tables, the selected table, the
  coefficients tree, the mode, and the allocation rows and columns, derived
  from the ports with `allocationOf`. A saved coefficient re-emits through
  the port, so the rows follow.
- Machines:
  - the table dialog;
  - the coefficient's inline edit (M1's inline editor machine);
  - the mode;
  - the Budget allocation wizard (M2a's wizard machine, one step);
  - grid expansion for each of the two trees.
- `editorOf` keeps `budgetAllocation` uneditable. `JournalToolbar`'s item
  gets its wizard.

## Client

`TablesAllocationScreen` is a thin view-model reader, with
`ThousandthTablesPanel`, `CoefficientsPanel` and `AllocationPanel` taking
props. It reuses `TreeGrid`, the money cells, `Splitter`, `Popover`,
`InlineEditor`, `ConfirmAlert` and `WizardDialog`. Copy and measures follow
the design.

## Seed

The generator (`packages/legacy-import`, `projectLegacySeed`) adds, per
seeded period:

- units (code, group, restriction) and unit groups (Saturno: A and B;
  Pozzetto: none);
- the tables, their coefficients, and the links with their role shares;
- each account's `abbreviation`;
- the role `budgetAllocation` on the account each period's stored budget
  allocation entry credits (the legacy period had no field for it; the
  entry is the evidence);
- each owner's `unitId`, `share` and `ownRestriction`.

The generator fails if a seeded period has a unit with more than one unit
period (a change of ownership scenario). The algorithm then needs the
unit-period level, which this design leaves out. The surveys found no such
unit; the generator proves it.

Expected from the dump:

- Saturno: 5 tables (Property, General residents, Stairs restricted to A,
  Water budget, Water actual); 36 coefficients; links 84 (budget) and 85
  (final balance) for Water.
- Pozzetto: 12 tables, 216 coefficients, 18 units, no groups; r166 and r167
  with their own dates, the others with none.

## Tests

- **Domain:**
  - `allocationOf`, on a small seed, for each rule: grouping sum of rounded
    children; inherited links; a link `use` per mode; tic of 0 skipped;
    election with and without a tenant; co-ownership with percentages, with
    one empty, with none; residency proration; a unit restriction that does
    not prorate; `controlUnitResident` in both modes; the rounding at a tie;
    the Roundings row;
  - every pinned figure above, from the app seed;
  - the table rules and the coefficient rules;
  - `budgetAllocationDraftOf` for Saturno, equal to the stored entry tx5
    line for line. For Pozzetto it equals the stored tx291 except A04's two
    lines and the roundings lines. That difference is the stored entry's,
    and the test names it.
- **legacy-import specs:** `riparto.feature` runs on `allocationOf`:
  Saturno all residents equal; Pozzetto 25 equal to the posted entry and A04
  equal to the report's 898.64 / 46.63, with the NOTE rewritten to say why.
  The old one-cent tolerance goes.
- **Ports:** contract tests as above.
- **Core:** the presenter re-emits on a coefficient write; the table
  dialog's verdicts; the wizard's preview and refusals; the mode switch.
- **Client:** page objects; the screen renders p1 with the pinned root row;
  an inline coefficient edit changes a Total and a resident's share; add,
  edit and delete a table, with the refusal for a linked one; the Budget
  allocation wizard end to end, on p1 after deleting tx5; Account Details
  shows a link.
- **Visual:**
  - the screen as a page at 1280 (p1, light);
  - component scenarios for:
    - the Thousandth Tables panel;
    - the coefficients tree with groups (Saturno, Stairs: restricted to A);
    - the Allocation panel in final-balance mode;
    - the table dialog, and its refusal;
    - the wizard, and a refusal (`capture: "viewport"`);
    - the Account Details mini-grid.

## Review focus (what a person would expect)

1. **A coefficient edited to an unreadable or negative value** is refused
   where it is typed, and the allocation does not move.
2. **A table whose coefficients are all 0**, or a new table not yet filled
   in: the accounts it serves allocate nothing, and the Roundings row shows
   the whole budget unallocated. The Budget allocation wizard refuses to
   post it.
3. **Switching period** with a table selected: the new period starts on its
   first table and never shows the previous period's coefficients.
4. **Switching the language** while the screen is open: amounts and
   coefficients redraw in the new locale, and an open coefficient editor
   keeps the text typed (M2's amount-locale rule).
5. **Deleting the budget allocation after installments were planned from
   it**: the installments stay, the wizard can post a new allocation, and
   the schedule's shares follow the new entry the next time it plans.
