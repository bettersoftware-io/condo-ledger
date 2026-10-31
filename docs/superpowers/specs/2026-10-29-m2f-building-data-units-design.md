# M2f — Building Data & Units — design

Date: 2026-10-29. Status: written.

Parent spec: `docs/superpowers/specs/2026-10-11-app-v2-design.md` (Section 5,
M2: "… → Tables & Allocation → Building Data & Units → Contacts →
Calendar"). The M2a–M2e specs set the shapes this one extends: wizards and
dialogs, `Result` writes with a domain reason, the "not yet available"
notice, the books, and M2e's allocation (`allocationOf`). Where they differ,
this one wins for M2f.

## Intent

An administrator opens a building's year and needs to know who lives
there, what each unit is, and where each person stands: what they owed
from last year, what this year's budget and actual costs put on them, what
they have paid. When someone moves in, moves out, buys a flat or a unit is
split, they record it here, and every other screen (the allocation, the
installments, the books) follows. The Building Data screen is the list of
buildings and their years, with each building's own details and its
suppliers. The user's standing instruction holds: decide from the legacy
application and its database, since the application never had real users.

## Sources

Three surveys, kept beside the worktree in `.superpowers/building-units/`
(git-ignored):

- `bu-legacy.md`: the legacy Flex client and PHP server (`old/flex`) and
  the Pozzetto 2013 and Saturno 2011 data in the dump.
- `bu-design.md`: the design (`docs/design/web/v1/README.md` screens 2 and
  3 and their dialogs, the prototype `Condomini.dc.html`, the exports).
- `bu-codebase.md`: what this repository already has.
- `bu-danea.md`: how Danea Domustudio, whose conventions the legacy app
  follows (its headers Scaduto, Conguaglio, Disavanzo, Attivo, Passivo are
  the Italian standard ones), defines the columns the legacy app never
  computed; from Danea's online help (help.danea.it), corroborated by
  Arcadia, Datos and KondoManager, and checked against both periods.

What the surveys found that shapes the design:

- **The Units grid's money is the allocation, twice, and it matches the
  legacy reports to the cent.** Prev. bal., Budget, Actual, Total due and
  Paid were computed in the legacy client by the algorithm M2e ported. The
  design's figures equal the legacy unit list (`elenco-unita.pdf`) on all 37
  Pozzetto rows and all 16 Saturno rows. Total due is **Prev. bal. +
  Actual**, everywhere on this screen. The Installment Schedule's Total due
  is Prev. bal. + Budget; the two screens disagree in the legacy app too.
- **Overdue and Adjustment were never computed** on the legacy Units grid
  (`dataField="dummy"`), and every Building Data money column was `dummy`
  too. The prototype leaves Building Data's money blank and fills Overdue
  and Adjustment with 0,00. **Danea defines them** (`bu-danea.md`):
  - Scaduto (Overdue) is the unpaid part of the installments already due
    ("Totale scaduto"; a reminder's debt is "la somma di tutte le rate
    scadute"), which the Installment Schedule already computes;
  - Conguaglio (Adjustment) is, verbatim, "CONGUAGLIO = RIPARTO CONSUNTIVO
    - TOTALE RATE EMESSE", counting the installments issued "e non quelle
    realmente versate" (help.danea.it, "Rate a conguaglio"). The legacy
    app meant the same: the column's header and the never-built
    "conguaglio" installment type share one resource key.
- **The tree folds a single-occupant unit into its row.** A unit with one
  resident shows "A01 - {name} (PR)" and no child; a unit with several shows
  them as children. Groups sit between the root and the units; the
  rounding row closes the root. That is the shape `allocationOf` already
  builds.
- **The legacy model has a hidden "unit period"** between a unit and its
  residents (an ownership scenario and dates). The UI could never add a
  second one, every unit in the data has exactly one, all of scenario 1
  (Standard: owner/tenant). A change of owner mid-year is two residents of
  the same unit with their own dates (Pozzetto A04).
- **Nothing seeded can be deleted.** Every resident of both periods is
  named by a posting, and the database refused such deletes (with a raw
  error). A unit or group is deleted with its residents, so neither can go
  either. Only what the user adds can be removed again.
- **The previous balance is frozen once the opening entry is posted**
  (legacy Edit Owner disables it). Both seeded periods have one.
- **A new unit gets coefficient 0 in every table** of the period (legacy
  `addUnit`).
- **A building supplier is only a link** between the building and a
  contact. Adding one means picking or creating a contact; "edit" edits the
  contact. Both are Contacts' dialogs.
- **A new period in the legacy app is an empty row**: no accounts, no
  units, nothing copied. A building with any period cannot be deleted;
  deleting a period deletes everything in it.
- **The seed lacks most of this screen's fields.** Building code, type,
  status, address, tax code, construction date, cadastral data, notes;
  unit floor, interior, sub-unit, type, name, cadastral data, notes; group
  address and notes; supplier category and contact details. The dump has
  them, and pseudonymisation already covers the sensitive ones.
- **Owners live in the accounts port today** (`AccountsPort.parties`), and
  the tables simulator fixes each period's units when it starts. Writing
  units and owners means one source both read.

## Scope

**In M2f:**

- the **Units, Owners & Personal Balance** screen: the tree with its unit
  columns and money, the Unit Profile and Unit Owners tabs;
- **add, edit and delete a group, a unit and an owner** (a residency),
  with every other screen following at once;
- the **Building Data & Suppliers** screen: the tree of buildings and
  periods, the Building Profile tab, and the Building Suppliers tab, read
  only;
- **Edit Building** and **Edit Management / Period**;
- the **Installment Schedule draws unit groups** (Saturno's A and B), which
  closes STATUS's "Unit groups and the Units entity" entry;
- the building's **address in the period labels**: the trees' root rows and
  the wizards' header read "{building} / {period} ({address})" as the
  design draws them;
- what the screens need in the seed (below), and a first, read-only
  **`ContactsPort`** (the contacts the seed knows), which Add Owner picks
  from and the Suppliers tab reads.

**Not in M2f:**

- **New building, new period, delete building, delete period.** A new
  period is empty in the legacy app (no accounts, no units), and every
  screen here assumes a period has books. Starting a period from the
  previous one is its own piece of work; a STATUS entry records it. The
  menu items are drawn and show the "not yet available" notice.
- **Adding, removing or editing a building's suppliers.** Each needs the
  Contacts dialogs (pick a contact, create a person or company, edit one).
  They arrive with Contacts. The tab is read-only here.
- **A second "unit period" per unit and the ownership scenarios.** Every
  unit has one, scenario Standard (owner/tenant). The Unit Owners tab draws
  that one period. Bare ownership/usufruct and leasing roles are left out.
- **Editing co-ownership percentages.** The design shows the field
  read-only. The Known limit on an explicit 0% stands.
- **Frontend access keys** (Username, Password). The app has no owner
  portal, and the legacy app stored the password in clear text. The
  fieldset is not drawn.
- **Group by** other than "By unit": the legacy control was disabled. The
  chip is drawn, as on the other screens.
- **A conguaglio installment** (the Installments menu's "Create
  final-balance installment"), which would ask for the Adjustment column's
  amount. The column shows the figure; issuing it stays a notice.
- **Bank coordinates, public and private files, F24s** of a building: the
  design dropped them.
- Print, PDF, XLS, ⟳ and ⓘ Legend: drawn, with the "not yet available"
  notice, as on the other screens.

## The Units grid

The panel "Units, Owners & Personal Balance", meta "{n} units total". The
grid template and headers are the design's:

`Groups / Units / Owners | Floor | Int. | Sub. | Type | Restr. period |
Prev. bal. | Budget | Actual | Total due | Paid | Overdue | Adjustment`

**Rows**, in order (the legacy tree, `bu-legacy.md` §3.1):

- **Root**: 🏢 "{building} / {period} ({address})", the period's dates in
  Restr. period, the sums.
- **Groups**, by code, nested as their parents say: 📁 "{code} - {name}"
  and " ({address})" when the group has one.
- **Units**, by code, inside their group or at the top after the groups:
  icon by type (🏠 apartment, 🏪 shop and premises, 🅿️ garage). Label
  "{code} - {name}" when the unit has a name, else "{code} - {residents'
  names, comma-separated}", then " ({role})" when it has exactly one
  resident. Floor, Int., Sub., Type and its own Restr. period.
- **Residents**, only under a unit with more than one, by role priority
  then the order they were added: 👤 "{name} ({role}[ {share}%])", their
  own Restr. period.
- **Rounding**, last child of the root: "Rounding error", money only.

Restr. period is written as elsewhere ("19/01/2013 - end of FY",
`restrictionTextOf`). Group rows and the root are bold on `--zebra`.

**Money, per row:**

| Column | Resident | Unit, group, root | Rounding |
|---|---|---|---|
| Prev. bal. | `previousBalancesOf` | sum | blank |
| Budget | `allocationOf(…, "budget")` row total | sum | budget total − sum |
| Actual | `allocationOf(…, "finalBalance")` row total | sum | actual total − sum |
| Total due | Prev. bal. + Actual | sum | Actual's rounding |
| Paid | the allocation's `paid` (collections on the owners account) | sum | blank |
| Overdue | the Installment Schedule's `overdue`, as of today | sum | blank |
| Adjustment | Total due − the installments issued to the resident | sum | Total due's rounding |

The root therefore equals the books: Budget = the cost budgets' total,
Actual = the costs' balance. Budget and Actual are the computed
allocation, not the posted budget entry, as the legacy screen and report
did (they differ for Pozzetto A04 by a few cents; M2e's finding).

**Overdue and Adjustment are Danea's definitions** (`bu-danea.md` §3):

- **Overdue** (Scaduto): over the resident's installment items due before
  today, the part not yet paid, each item at least 0; summed up the tree
  without offsetting anyone's credit. It is the Installment Schedule's
  `overdue` (`scheduleOf`), so the two screens never disagree. An item due
  today is not yet overdue (the schedule's rule and KondoManager's; the
  legacy app's colours counted it). Both periods are long past, so every
  item is due: roots Pozzetto 11,765.90, Saturno 4,408.95.
- **Adjustment** (Conguaglio): Total due − the sum of the installment
  items issued to the resident, paid or not. Positive: a conguaglio
  installment must ask for more; negative: the resident is owed a refund.
  Danea's "riparto consuntivo" is read as including the previous balance,
  since its installments issued include it too (Danea's plan spreads "le
  quote di preventivo e quelle dei saldi dell'esercizio precedente").
  Roots: Pozzetto −4,955.16 (28,636.72 − 33,591.88), Saturno −4,944.81
  (2,744.11 − 7,688.92). It is not the legacy closing entry's "Conguaglio a
  consuntivo" (Actual − Budget, −3,112.29 for Pozzetto): the two agree
  only when the plan issued exactly Prev. bal. + Budget, which Saturno's
  did and Pozzetto's did not.

The three columns measure different things and can disagree for one
person: Saturno A3 has 725.00 overdue on its installments while the
actual costs left it in credit. Each header carries a tooltip with its
formula. The two "Total due" of the app differ the same way Danea's do:
here Prev. bal. + Actual (the final account), on the Installment
Schedule Prev. bal. + Budget (the plan); their tooltips say which.

**Selection.** A click selects any row. The selected row drives the bottom
panel, and the breadcrumb gains "› {code}": the unit's code for a unit or a
resident row, the group's code for a group, nothing for the root or the
rounding row. Selection resets to the first unit on a period switch. The
top toolbar's ✎ edits the selected group, unit or resident; − deletes it.

**Toolbar:** "Group by: **By unit**" (static), divider, `+▾` (📁 New group ·
🏠 New unit · 👤 New owner), ✎, −, divider, ⊞ ⊟, divider, print, PDF, XLS,
spacer, ⟳.

## The bottom panel

Two tabs, **Unit Profile** and **Unit Owners**. They show the selected
unit, or the unit of the selected resident. On the root, a group or the
rounding row they show an empty state ("Select a unit."). Their toolbar:
`+` adds an owner to the unit, ✎ edits the selected owner (Unit Owners) or
the unit (Unit Profile), −, then print/PDF/XLS and ⓘ Legend.

**Unit Profile** (a read-only sheet): Unit name; Location (the unit's
groups, root to leaf, joined by " » "; blank at the top); IDENTIFICATION
DATA: Code (mono), Floor, Interior, Sub-unit; RESTRICTED PERIOD: Start
date, End date; ADDITIONAL DATA: Type, Cadastral data; NOTES. Empty values
show `---`.

**Unit Owners**: grid `Periods / Roles / Owners | Owner relationship
scenario | Out | Restr. period | Days | % Share | Comb. coeff.`.

- Head row 🗓 "Full period" on `--zebra`: scenario "Standard
  (owner/tenant)", the unit's Restr. period, Days as "{days}/{upper}" with
  days = the unit's own dates or the period's, upper = the same (legacy:
  a unit's own dates prorate nobody).
- A sub-head per role present, plural: 👥 "Owners", "Tenants",
  "Subtenants".
- A row per resident: their name; Out ✓ (`--acc`) when they have an end
  date of their own; their Restr. period; Days "{days}/{upper}" only when
  they have dates of their own, with upper = the unit's dates or the
  period's; % Share as a bar (track `--bd2`, fill `--acc`, the README's
  colour, not the prototype's gradient), blank when none; Comb. coeff. with
  six decimals, the legacy `compoundCoefficient` (M2e's private
  `compoundCoefficientOf`, exported with this caller).

Pozzetto A04 shows 347/365 and 18/365, 0.950685 and 0.049315; A09's third
owner shows 0.000000 (an empty share beside a 100% sibling).

## Groups, units and owners: add, edit, delete

All three are dialogs on the Dialog spec (560 wide), opened from the `+▾`
menu or ✎. OK is disabled while a required field is empty; a refusal from
the port is shown in the dialog in words (M2e's `allocationReasons` way).
A delete asks first in a `ConfirmAlert` naming what goes.

**Group** (Edit Group: Code\*, Name\*, Address, NOTES). New group's parent
is the selected group, or the selected unit's group, else the top. The
parent cannot change later. Refused: an empty code or name; a sibling with
the same code or the same name ("A group with code A or name Stairwell A
is already in this group"). **Delete** only a group with no units and no
sub-groups; the − button is disabled otherwise.

**Unit** (Edit Unit: Unit name; IDENTIFICATION DATA: Code\*, Floor,
Interior, Sub-unit; RESTRICTED PERIOD: Start date, End date; ADDITIONAL
DATA: Type\* (Apartment, Shop, Garage, Premises), Cadastral data; NOTES).
New unit's group is the selected group, or the selected unit's group, else
the top; it cannot change later. A new unit opens blank, type Apartment.
Refused: an empty code; a code another unit of the period has; an end date
before the start date; dates outside the period. A new unit gets a
coefficient of 0 in every table of the period (legacy); the Thousandth
Tables screen lists it at once. **Delete**: refused while any of its
residents could not be deleted (below); otherwise the unit, its residents
and its coefficients go.

The legacy code was optional, with a generated code in its place; here it
is required and unique, because the code names the unit in every grid,
label and wizard. *Call made here.*

**Owner** (Add Owner / Edit Owner, label column 148):

- **Linked contact\***: a picker over the contacts the app knows
  (`ContactsPort`), by name, people and companies. Read-only on edit.
  Creating a contact in place comes with Contacts.
- **Role**: Owner (PR), Tenant (CO), Subtenant (SC). Read-only on edit.
- **Previous balance\***: money, negative allowed. Editable only while the
  period has no opening entry; after it, read-only with the line "Posted in
  the opening entry: change it through the journal." On add, after the
  opening entry, it is 0 and read-only. (The Prev. bal. column reads the
  opening entry when there is one, so a value typed beside it would show
  nowhere.)
- **Co-ownership %**: read-only, the stored share or blank.
- RESTRICTED PERIOD: Start date, End date.

Refused: no contact; the contact already a resident of this unit; an end
before the start; dates outside the period. A change of owner is recorded
the legacy way: give the outgoing owner an end date, add the new one with
a start date. The two then pay one after the other, each the whole share
for their own days (see "Successive owners" under Domain), with no
percentage to type. **Delete**: refused when a posting names the residency or an
installment item belongs to it ("{name} is named in the journal: delete
those entries first"). In the seeded periods that is every resident; what
the user adds can be deleted again.

**What follows a write, at once:** the Units grid, the allocation and its
Thousandth Tables trees, the Installment Schedule's rows, the Accounts
tree's split per owner, and the journal wizards' lists of residents. A new
resident has no installment items and no posted budget share; their Budget
and Actual come from the allocation. Nothing is posted.

## The Building Data screen

Panel "Building Data", meta "{n} buildings total". Grid template and
headers are the design's:

`Code | Building / Period | Type | Closed | Period | Liquidity | Funds |
Budget | Actual | Prev. bal. | Total due`

- **Building rows** (🏢, `--zebra`): code in mono, "{name} ({address})" in
  700, a type icon. Buildings by name.
- **Period rows** (📁, indented): "{period name} ({type})", a type icon,
  Closed as a read-only checkbox, the dates ("01/01/2013 - 31/12/2013").
  Periods by start date.
- **Money columns (decided by the user, 2026-10-30: computed).** The
  legacy app bound them to nothing, so this is the app's own definition.
  On a period row:
  - Liquidity: the balance of the period's Liquidity account, as the
    Accounts screen shows it;
  - Liquidity is Danea's "disponibilità" of the resources: cash, banks,
    post, deposit books, over all of the period's entries (the closing
    entry is dated after the period's end);
  - Funds: the balance of its Funds account, shown as the positive amount
    set aside, as Danea and the legacy balance sheet print it (Saturno
    1,750.00 under liabilities; the Accounts screen's ledger sign is
    −1,750.00);
  - Budget, Actual, Prev. bal., Total due: the Units grid's root row for
    that period, so Total due = Prev. bal. + Actual.

  Building rows leave them blank. The expected figures, from the design's
  exports and `bu-danea.md` §4:

  | Period | Liquidity | Funds | Budget | Actual | Prev. bal. | Total due |
  |---|---|---|---|---|---|---|
  | Saturno 2011 | 2,954.14 | 1,750.00 | 7,400.00 | 2,455.19 | 288.92 | 2,744.11 |
  | Pozzetto 2013 | 1,078.26 | 0.00 | 38,000.00 | 34,887.71 | −6,250.99 | 28,636.72 |

  The five columns the design dropped stay dropped: Paid and Overdue are
  on the Units grid's root; Assets and Liabilities are Danea's balance
  sheet totals, always equal, a report's figure rather than a grid's; and
  Danea's "disavanzo" means three different things (the period's result,
  a cash figure equal to Liquidity, and a balance-sheet imbalance that
  must be 0). The imbalance is a test instead (below).

  The Liquidity and Funds accounts are found by a role the generator sets
  (`AccountRole` gains `liquidity` and `funds`): the top-level assets
  account named Liquidity and the top-level liabilities account named
  Funds. The generator refuses a seeded period that has not exactly one of
  each. These columns need every period's books, not only the selected
  one's: the building data presenter assembles each period's books from
  the same ports, while the screen is shown. STATUS's "Presenter
  robustness" entry gains that: these streams stay subscribed, one set per
  period, once the screen has been visited.

**Selection.** Any row can be selected. Clicking a period row also makes
it the app's period (as the sidebar does). The selection starts on the
app's period and follows the sidebar. The bottom panel shows the selected
row's building. The top ✎ edits the selected building or period; `+▾`
offers New building and New period, and − deletes: all three show the "not
yet available" notice. The Sidebar's "Select Management" ✎ opens Edit
Management / Period for the app's period; its + and − stay notices.

**Building Profile** (read-only sheet): Name, Building code, Status (✓
Active / Archived), Type (🏢 Building / Super-building / Residence),
Address, Tax code, Construction date; OTHER: Cadastral data, System ID,
Created on, Modified on; NOTES. Its toolbar's ✎ opens Edit Building.

**Building Suppliers** (read-only): a split, list `Name / Company |
Contact category` (by category, then name) and the selected supplier's
sheet: Contact type (person or company), Status, Code; COMPANY DATA:
Company name, Registered office, Tax domicile; CONTACTS: Phone, Email (in
`--acc`). Its `+`, ✎ and − show the notice "Suppliers are edited in
Contacts, which is not yet available."

## Edit Building and Edit Management / Period

**Edit Building** (label 160): Name\*, Building code, Status\* (Active,
Archived), Type\* (Building, Super-building, Residence), Address (inline ✎
⊖: ✎ opens a small Address dialog with Street and number\*, Postcode,
City; ⊖ clears it), Tax code, Construction date; OTHER: Cadastral data;
NOTES. Refused: an empty name; a name or a code another building has.
Saving sets Modified on.

**Edit Management / Period** (label 160; the README's title, not the
prototype's "Edit Fiscal Year"): Management name\*, Type\* (Ordinary,
Extraordinary, Auxiliary), Status\* (Open, Closed); COMPETENCE PERIOD:
Start date\*, End date\*; NOTES. Refused: an empty name; a name another
period of the building has; an end before the start; dates that would
leave a unit's or a residency's own dates outside them (their days would
no longer count). Entries are not checked: an entry's date is when it was
recorded, Pozzetto 2013 already holds three recorded in January 2014, and
the wizards stamp new ones with today's clock. Installment due dates are
not checked either; the legacy app checked nothing. Closed only changes
the checkbox and the icon, as in the legacy app; it locks nothing.

The legacy end date was optional (an open period ran to today); here it is
required, because every day count in the app reads it. *Call made here.*

A change of dates moves everything that counts days (the allocation's
residency shares, Days in the grids) at once.

## Domain

**Entities, extended:**

- `Building`: `code | null`, `type` (`"building" | "superBuilding" |
  "residence"`), `status` (`"active" | "archived"`), `address: Address |
  null`, `taxCode | null`, `constructionDate | null`, `cadastralData |
  null`, `notes | null`, `createdOn`, `modifiedOn`.
- `Period`: `notes | null`; exported by name.
- `Address`: `street` (street and number), `postcode | null`, `city |
  null`. One line when written: "{street}, {postcode} {city}". Contacts
  reuses it.
- `Unit`: `name | null`, `floor | null`, `interior | null`, `subUnit |
  null`, `type` (`"apartment" | "shop" | "garage" | "premises"`),
  `cadastralData | null`, `notes | null`.
- `UnitGroup`: `address: Address | null`, `notes | null`.
- `OwnerParty` keeps its shape; the role set used by the dialogs is PR, CO,
  SC.
- `Contact` (new): `id`, `kind` (`"person" | "company"`), `name`, `status`,
  `code | null`, `category | null`, `companyName | null`,
  `registeredOffice: Address | null`, `taxDomicile: Address | null`,
  `phone | null`, `email | null`.

**Successive owners (decided by the user, 2026-10-30).** The legacy
co-ownership factor (`coOwnershipOf` in
`packages/domain/src/useCases/allocation/share.ts`) groups every resident
of a unit with the same role, whatever their dates. With percentages
read-only, a change of owner recorded with dates would then split the share
(both empty: half each) or give the newcomer nothing (beside a 100%). The
rule changes: a resident's co-owners are the residents of the same unit and
role whose dates overlap theirs, where a resident's dates are their own,
else the unit's, else the period's. The legacy rule then applies within
that set, unchanged. Owners whose dates do not overlap are successive, and
each pays the whole share for their own days. Both seeded periods come out
the same, to the cent: A04 is the only unit with dated residents, and its
two owners already carry 100% each. The parity specs and M2e's pinned
figures hold that. The Unit Owners tab's Comb. coeff. follows the same
rule.

**Rules**, pure validators returning `Result` with a reason, used by the
dialogs' machines and the simulators alike (M2e's `validateTable` shape):
`validateBuilding`, `validatePeriod`, `validateGroup`, `validateGroupDelete`,
`validateUnit`, `validateUnitDelete`, `validateResidency`,
`validateResidencyDelete`. The delete rules take the period's entries and
installment items.

**Use cases:**

- `unitsListOf(…)`: the Units grid's rows from the two allocations, the
  previous balances, the schedule's overdue, the units and groups.
  It reuses M2e's tree helpers (`layout.ts`), exported through the index
  with this first caller.
- `unitOwnersOf(unit, residents, period)`: the Unit Owners rows.
- `buildingRowsOf(…)`: the Building Data rows, with each period's figures
  from its books (`buildAccountTree` for Liquidity and Funds, the Units
  root for the rest).
- `coOwnershipOf` changes as "Successive owners" says.
- The schedule's tree (`scheduleOf`) takes the groups and builds the
  group level, as `allocationOf` does.

## Ports

- **`BuildingsPort`**: `buildings()` with the extended entities;
  `suppliers(buildingId): Observable<string[]>` (contact ids);
  `editBuilding(id, draft)`, `editPeriod(id, draft)`.
- **`UnitsPort`**: `units(periodId)`, `groups(periodId)`, and now
  `residents(periodId)`; `addGroup`, `editGroup`, `deleteGroup`,
  `addUnit`, `editUnit`, `deleteUnit`, `addResident`, `editResident`,
  `deleteResident`. The parent design gives this port the owners.
- **`ContactsPort`** (new, reads only for now): `contacts():
  Observable<Contact[]>`.
- **`AccountsPort.parties`** keeps its shape for its readers; its owners
  now come from the units simulator.

Every command returns `Promise<Result>`. Each port gets its contract test
in `__contracts__`, run against its simulator.

**Simulators.** One source of a period's units and residents: the units
simulator holds them, with a `BehaviorSubject` per period, and the accounts
simulator (owners) and the tables simulator (a unit's coefficients) read
them from it, as the tables simulator reads accounts today. The tables
simulator adds a 0 coefficient for a new unit in every table, and drops a
deleted unit's. The units simulator judges deletes against the journal's
entries and the installments' items, read the same way. The buildings
simulator keeps its buildings in a `BehaviorSubject` and judges a period's
dates against that period's units and residents, read from the units
simulator.

## Core and client

- **Presenters:** a units presenter (the Units grid, the bottom tabs, the
  writes), a building data presenter (the rows, the profile, the
  suppliers with their contacts). The allocation presenter's way of
  assembling a period from the books and the ports
  (`allocationPresenter.periodOf`) is the model.
- **Machines:** the grids' state in `screens.ts` (`units`, `unitOwners`,
  `buildingData`, `suppliers`; splits; the two bottom tabs); one dialog
  machine each for group, unit, owner, building, period and the address,
  M2e's `tableDialogMachine` shape.
- **Client:** `ui/units/` and `ui/buildingData/`, thin screens reading the
  view model, panels taking props; routing in `shell/Screen.tsx`. The
  sidebar test that uses "Building Data & Suppliers" as its placeholder
  example moves to Contacts.

## Seed

The generator (`packages/legacy-import`) projects, for the seeded
buildings and periods:

- building: code, type, status, address (`parseAddressVO`, the city
  through the dump's city table), tax code, construction date, cadastral
  data, notes, created, last modified;
- period: notes;
- unit: name, floor, inner number, sub-unit, type, cadastral data, notes;
- group: address, notes;
- contacts: every resident's and supplier's contact, with kind, status,
  code, category, company name, the two company addresses, and the first
  phone and the first email;
- the building's supplier links;
- the `liquidity` and `funds` account roles.

Everything goes through pseudonymisation and the English translation as
today. New words get entries in `translate/exact.ts`: unit types
(Appartamento → Apartment, Negozio → Shop, Box → Garage, Locale →
Premises; Garage matches the group already translated "Garages"),
contact categories, and any notes. Before committing, check that no
projected field carries a real name (notes, cadastral data); one that does
is dropped and listed in the generator, not patched by hand. The seed
module is regenerated, never edited.

## Tests

- **Domain:** each validator; `unitsListOf` over the seed, pinned to the
  legacy unit list for both periods (the five money columns on every row,
  by unit code: the tables in `bu-design.md` §1); `unitOwnersOf` for
  Pozzetto A04 and A09 and Saturno A2; successive owners (an owner given
  an end date and a newcomer a start date in a unit whose owner had no
  percentage, and in one whose owner had 100%: each pays the whole share
  for their days, and the unit is fully allocated); the Building Data
  figures above for both periods; Overdue and Adjustment at the roots
  (above) and for Saturno A3; the books agree with the Units grid: for
  each period, the sum of Total due − Paid equals the owners' accounts in
  the Accounts tree (Pozzetto 6,810.74, Saturno −535.86, as the legacy
  balance sheet has them), and Funds + payables to third parties −
  receivables from them − Liquidity gives the same figure; the
  schedule's group level; the
  contracts of the three ports against their simulators, with the writes
  and their refusals; that a new unit appears in every table at 0, and a
  new resident in the allocation and the account tree.
- **Core:** the presenters' rows, selection and its reset on a period
  switch, the dialogs' machines (refusals in words, OK disabled).
- **Client:** each panel and dialog through its page object; the
  breadcrumb's unit crumb.
- **Visual:** pages `units-1280-light` (Saturno, with groups) and
  `building-data-1280-light`; components for the Unit Owners tab (A04),
  the Unit Profile, the Building Profile, the Suppliers tab, each dialog
  and a refused state of each; the Installment Schedule's goldens redrawn
  for the group level and the root label's address.
- **End to end:** one spec on the simulator: add an owner to a unit and
  see them in the Units grid and in the Installment Schedule.

## Review focus (what a person would expect)

- **Adding someone changes other people's shares.** A second owner with
  no percentage halves the first owner's share (both empty → one half
  each); a new tenant takes the tenant columns from the owner. That is the
  legacy rule, and the grid must show it at once.
- **A refused delete says why**, in words, and leaves the row selected;
  it never shows a raw error, as the legacy app did.
- **The previous balance is the opening entry's.** After the opening entry
  is posted the field is locked, and the column never shows a value the
  journal does not hold.
- **A period's dates moved** inside a unit's or a residency's own dates
  are refused; otherwise every Days cell and share follows.
- **A unit added mid-session** shows in Thousandth Tables at 0 in every
  table, can be given a coefficient, and then takes its share.

## Calls to check

Made here, without the user; each is marked in the text:

- Overdue and Adjustment follow Danea's definitions (Danea's help
  states both; reading "riparto consuntivo" as including the previous
  balance is inferred). An item due today is not yet overdue.
- A unit's code is required and unique in its period.
- A period's end date is required.
- The rounding row sits under the root (the legacy screen), not under the
  last group (the prototype).
- The Building Data grid lets a building row be selected, to show its
  profile (the legacy app and README line 173; the prototype only toggled).
- Unit type "Box" is translated Garage, not the design's "Box".
- Edit Period checks its dates against the units' and residencies' own
  dates, not against entries or installment due dates.
- Building Data's Funds is shown positive, as Danea and the legacy
  balance sheet print it; building rows stay blank; Liquidity and Funds
  read all of the period's entries, the closing entry included.

Decided by the user, 2026-10-30:

- Owners whose dates do not overlap are successive, not co-owners.
- The Building Data money columns are computed.
