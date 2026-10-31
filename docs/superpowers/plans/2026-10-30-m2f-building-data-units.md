# M2f — Building Data & Units — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Units, Owners & Personal Balance screen and the Building Data & Suppliers screen, with adding, editing and deleting groups, units and owners, editing buildings and periods, the Installment Schedule's unit groups, and every money column defined (Danea's Overdue and Adjustment, computed Building Data figures).

**Architecture:**
- The seed gains the profile fields of buildings, periods, units and groups, the contacts, the building–supplier links, and the `liquidity` and `funds` account roles.
- The domain gets the successive-owners rule, the validators for every write, and three use cases:
  - `unitsListOf`, the Units grid, from two runs of `allocationOf`, the previous balances and the schedule;
  - `unitOwnersOf`;
  - `buildingRowsOf`, the Building Data rows.
- `UnitsPort` becomes the one writable source of a period's units, groups and residents. The accounts, journal, installments and tables simulators read residents and units from it. `BuildingsPort` gains writes and the supplier links, and a new read-only `ContactsPort` joins the ports.
- The core gets two presenters (units, building data) and their dialog machines; the client draws two screens on M1's `TreeGrid`, `Panel`, `TabbedPanel` and `Scheda`, with M2e's dialog shapes.

**Tech Stack:**
- TypeScript, RxJS with `@rx-state/core`, React 19 with the React Compiler;
- Vitest, Playwright through the visual add-on 0.20 and the e2e add-on.

**Spec:** `docs/superpowers/specs/2026-10-29-m2f-building-data-units-design.md`. It is the authority. Its parents are the M2e spec (`allocationOf`, `TablesPort`, the table dialog, `allocationReasons`) and M2d's (`scheduleOf`, `previousBalancesOf`, `daysOf`, the restriction text). The surveys behind it are in `.superpowers/building-units/` in the worktree, which git ignores:
- `bu-legacy.md`: the legacy screens, dialogs, rules, and the dump's counts (§6);
- `bu-design.md`: the layout, strings and every row's figures for both periods (§1 tables);
- `bu-codebase.md`: what exists, with file:line;
- `bu-danea.md`: the Overdue, Adjustment, Liquidity and Funds definitions and their figures.

## Global Constraints

- **Where and how to work:**
  - Work in the worktree `../condo-ledger-worktrees/building-units`, branch `worktree-building-units`, and open one pull request at the end.
  - Every task ends with `pnpm fix`, then `pnpm gate:full:quiet` green, then a commit. A red gate is not a finished task.
  - `pnpm --filter X test -- <name>` does not filter in this repo. While iterating, run single files with vitest from the package.
- **AGENTS.md code rules hold everywhere:**
  - function declarations and named object types;
  - `#/` imports past one folder;
  - no `useMemo`, `useCallback` or `memo`, and no inline styles;
  - test ids in `packages/client-react/src/ui/testids.ts`, and UI tests through page objects;
  - fake timers and no sleeps;
  - fixture factories named `create…`, and tests before helpers in a test file;
  - an export only with its first non-test caller (knip): each task below names the exports it adds, and adds them with their caller;
  - colours as tokens.
- **The seed:** `packages/domain/src/simulators/seed/legacySeed.generated.ts` is only rewritten by `pnpm --filter @cl/legacy-import gen:data`.
  - Run generators and dump-backed tests with `LEGACY_DUMP_DIR=/Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/old/db` and `DESIGN_ORACLE_DIR=/Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/docs/design/web/v1/reports/pozzetto`, and show that they ran, not skipped. Run `gate:full` without them.
  - Committed files carry ids, unit codes and building names only, never a person's real name. Check every newly projected free-text field (notes, cadastral data) for one.
- **Amounts and numbers:** amounts are `Cents`; a co-ownership share is ten-thousandths of a percent (`100%` is `1000000`) or `null`; dates are `"YYYY-MM-DD"` and show as dd/mm/yyyy. Typed money reads in the session's amount locale (`parseAmount`).
- **Ids:**
  - periods `p1` (Saturno 2011, building `c1`) and `p36` (Pozzetto 2013, building `c19`);
  - units `u…`, groups `ug…`, residents `r…`, contacts `md…` (a supplier's and an owner's `personId` already are);
  - simulator-made ids: groups `ug-new-<n>`, units `u-new-<n>`, residents `r-new-<n>`; they never collide with seeded ids.
  - Pozzetto: `r166` and `r167` are A04; A09 has three residents. Saturno: groups A (`ug1`) and B (`ug2`); A2 and B1 have a PR and a CO.
- **Exact copy (the spec's):**
  - **Units panel:** title "Units, Owners & Personal Balance", meta "{n} units total". Columns: `Groups / Units / Owners | Floor | Int. | Sub. | Type | Restr. period | Prev. bal. | Budget | Actual | Total due | Paid | Overdue | Adjustment`. The last row is "Rounding error". Toolbar chip "Group by: By unit"; `+▾` items "New group", "New unit", "New owner".
  - **Header tooltips:** Total due (Units) "Previous balance + actual share"; Total due (Installment Schedule) "Previous balance + budget share"; Overdue "Installments due before today, not yet paid"; Adjustment "Total due − installments issued: positive asks for more, negative is a refund".
  - **Bottom tabs:** "Unit Profile" and "Unit Owners"; empty state "Select a unit."
    - Profile labels: "Unit name", "Location", fieldset "IDENTIFICATION DATA" ("Code", "Floor", "Interior", "Sub-unit"), "RESTRICTED PERIOD" ("Start date", "End date"), "ADDITIONAL DATA" ("Type", "Cadastral data"), "NOTES". Empty values "---".
    - Owners columns: `Periods / Roles / Owners | Owner relationship scenario | Out | Restr. period | Days | % Share | Comb. coeff.`; head row "Full period" with scenario "Standard (owner/tenant)"; role sub-heads "Owners", "Tenants", "Subtenants".
  - **Building Data panel:** title "Building Data", meta "{n} buildings total". Columns: `Code | Building / Period | Type | Closed | Period | Liquidity | Funds | Budget | Actual | Prev. bal. | Total due`. Tabs "Building Profile" and "Building Suppliers".
    - Profile labels: "Name", "Building code", "Status", "Type", "Address", "Tax code", "Construction date"; fieldset "OTHER" ("Cadastral data", "System ID", "Created on", "Modified on"); "NOTES".
    - Suppliers list columns `Name / Company | Contact category`; sheet labels "Contact type", "Status", "Code"; fieldset "COMPANY DATA" ("Company name", "Registered office", "Tax domicile"); "CONTACTS" ("Phone", "Email").
    - Suppliers notice: "Suppliers are edited in Contacts, which is not yet available."
  - **Words for values:** unit types Apartment, Shop, Garage, Premises; building types Building, Super-building, Residence; building status Active, Archived; period types Ordinary, Extraordinary, Auxiliary; period status Open, Closed; roles "Owner (PR)", "Tenant (CO)", "Subtenant (SC)"; contact kinds Person, Company.
  - **Dialogs** (560px; label column 160, owner 148):
    - "New Group" / "Edit Group": "Code", "Name", "Address", "NOTES";
    - "New Unit" / "Edit Unit": "Unit name"; "IDENTIFICATION DATA" ("Code", "Floor", "Interior", "Sub-unit"); "RESTRICTED PERIOD" ("Start date", "End date"); "ADDITIONAL DATA" ("Type", "Cadastral data"); "NOTES";
    - "Add Owner" / "Edit Owner" (buttons "+ Add" / "✎ Save"): "Linked contact", "Role", "Previous balance", "Co-ownership %", "RESTRICTED PERIOD"; the locked balance's line "Posted in the opening entry: change it through the journal.";
    - "Edit Building": "Name", "Building code", "Status", "Type", "Address", "Tax code", "Construction date", "OTHER" ("Cadastral data"), "NOTES";
    - "Edit Management / Period": "Management name", "Type", "Status", "COMPETENCE PERIOD" ("Start date", "End date"), "NOTES";
    - "Address": "Street and number", "Postcode", "City".
    - Required fields carry `*`, as the other dialogs do.
  - **Delete questions:** "Delete the group {code} - {name}?", "Delete the unit {code}?", "Remove {name} from {unit code}?".
  - **Reasons** (domain codes, worded in the client's reasons maps):
    - `blank-code` "Enter a code"; `blank-name` "Enter a name"; `blank-street` "Enter the street and number";
    - `group-taken` "A group with code {code} or name {name} is already in this group";
    - `unit-code-taken` "Another unit of this period has the code {code}";
    - `building-name-taken` "Another building is named {name}"; `building-code-taken` "Another building has the code {code}";
    - `period-name-taken` "This building has another period named {name}";
    - `bad-dates` "The end date is before the start date";
    - `outside-period` "The dates must lie within the period ({start} - {end})";
    - `period-excludes` "{what} has dates outside these: change them first" ({what} is a unit code or a resident's name);
    - `group-not-empty` "Move or delete its units and groups first";
    - `no-contact` "Choose a contact"; `already-resident` "{name} already lives in this unit";
    - `named-in-journal` "{name} is named in the journal: delete those entries first";
    - `has-installments` "{name} has installments: delete those first".
- **Visual tier** (add-on 0.20, AGENTS.md "Visual goldens"): `host/`, `visual.pw.ts` and `playwright.config.ts` stay untouched; a dialog is a component scenario with `capture: "viewport"`; a native `<select>` draws its chosen text as ordinary text.

## Review Focus

1. **A second owner added without a percentage to a single-owner unit** halves the first owner's Budget and Actual at once, and the unit's total is unchanged. The same owner added with a start date after the first owner's end date takes the whole share for their days instead (Task 2 and Task 6 tests).
2. **A delete refused by the journal** leaves the row selected and the dialog's alert shows the reason in words, never a thrown error. The same row stays deletable later once nothing names it (Task 4 and Task 12 tests).
3. **Switching the period with a unit selected** starts the new period on its first unit, and the bottom tabs never show the old period's unit (Task 9 test).
4. **A unit added, then given a coefficient in Thousandth Tables,** takes its share in the Units grid and the Allocation, and its row in Thousandth Tables shows 0 until then (Task 4 and Task 9 tests).
5. **Editing a period's dates** moves every Days cell and the Building Data figures, and a range that would cut a restricted unit (Saturno A1, May 2011) or resident (Pozzetto r166/r167) is refused with `period-excludes` (Task 3 and Task 10 tests).

---

### Task 1: The profile fields, the contacts and the account roles in the seed

**Files:**
- Create: `packages/domain/src/entities/address.ts`, `entities/contact.ts`; `packages/domain/src/simulators/seed/legacySeed.buildings.test.ts`.
- Modify:
  - `packages/domain/src/entities/building.ts`, `unit.ts`, `account.ts`;
  - `packages/domain/src/simulators/seed/legacySeed.ts` (forms and loader);
  - `packages/legacy-import/src/project/legacySeed.ts`, `structure.ts`, its tests and synthetic test;
  - `packages/legacy-import/src/translate/exact.ts`, `translateSeed.ts`;
  - the test seed factories under `packages/domain/src/testing/`, which get small data for the new fields;
  - `legacySeed.generated.ts` (regenerated).

**Interfaces:**
- Produces:
  - `interface Address { street: string; postcode: string | null; city: string | null }` (Task 7 adds `addressTextOf` with its first caller);
  - `PeriodType` exported by name;
  - `Building` gains `code: string | null; type: BuildingType; status: RecordStatus; address: Address | null; taxCode: string | null; constructionDate: string | null; cadastralData: string | null; notes: string | null; createdOn: string; modifiedOn: string` (timestamps `"YYYY-MM-DD HH:mm:ss"`, Rome time as entries are), with `type BuildingType = "building" | "superBuilding" | "residence"` and `type RecordStatus = "active" | "archived"`;
  - `Period` exported by name, gaining `notes: string | null`;
  - `Unit` gains `name: string | null; floor: string | null; interior: string | null; subUnit: string | null; type: UnitType; cadastralData: string | null; notes: string | null`, with `type UnitType = "apartment" | "shop" | "garage" | "premises"`;
  - `UnitGroup` gains `address: Address | null; notes: string | null`;
  - `interface Contact { id: string; kind: "person" | "company"; name: string; status: RecordStatus; code: string | null; category: string | null; companyName: string | null; registeredOffice: Address | null; taxDomicile: Address | null; phone: string | null; email: string | null }`;
  - `interface SupplierLink { buildingId: string; contactId: string }`;
  - `AccountRole` gains `"liquidity"` and `"funds"`;
  - `LegacySeed` (and its data form) gains `contacts: Contact[]` (every resident's and supplier's contact of the seeded periods, by name) and `supplierLinks: SupplierLink[]`.

- [ ] **Step 1: Write the failing tests.**
  - The synthetic generator test: a condominium with code, type `super`, serialised address and land registry projects them; a unit with `unitTypeId` 3 projects `type: "garage"`; a company contact projects its two addresses and its first `tel` and `mail` contact rows; the top-level assets account named "Liquidità" gets role `liquidity` and the liabilities one "Fondi" `funds`; a period with no such account, or two, makes the generator throw.
  - `legacySeed.buildings.test.ts`, over the committed seed:
    - `c1` has code `"SAT"`, type `"building"`, status `"active"`, a construction date `"1980-05-20"`, an address; `c19` has code null and an address;
    - p1's units: A1–A4 and B1–B4, all with floor and interior, types two shops, two apartments, four garages; A2's sub-unit `"a"`; groups `ug1` and `ug2` each with an address;
    - p36's units: A01–A16 apartments, A17 and A18 premises, floor, interior and sub-unit null;
    - 6 supplier links for `c1`, 12 for `c19`; every link's contact and every owner's `personId` is in `contacts`;
    - p1 and p36 each have exactly one `liquidity` and one `funds` account, top-level.
- [ ] **Step 2: Run** both files. Expected: FAIL.
- [ ] **Step 3: Implement.** Follow `bu-legacy.md` §6 and `bu-codebase.md` §2: the address through `parseAddressVO`, the city from the dump's city table by `cityId`; the contact data from `masterData`, `company`, `masterDataCategory`, `masterDataContact`; the roles by name at the top of the chart. Translate the unit types (Appartamento → Apartment … Box → Garage, Locale → Premises are labels in the client; the seed carries the `UnitType` values), the contact categories, and any projected notes, in `exact.ts`. A notes or cadastral field that holds a real name is dropped by the generator, listed by id. Regenerate with `gen:data`, then `gen:oracle-fixture`: the oracle fixtures may change only by new fields; stop and report otherwise.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`, the legacy-import suite with both env vars (show the oracle checks ran), and `pnpm visual`. Expected: green, every golden unchanged.
- [ ] **Step 5: Commit** `feat(seed): building, period, unit and group profiles, contacts, supplier links, liquidity and funds roles`.

### Task 2: Successive owners

**Files:**
- Modify: `packages/domain/src/useCases/allocation/share.ts` (`coOwnershipOf`), `share.test.ts`, `allocation.test.ts`.

**Interfaces:**
- Consumes: `AllocationInput` (its `period`, `units`, `residents`).
- Produces: `compoundCoefficientOf(input: AllocationInput, resident: OwnerParty): number` exported (first caller: Task 6).

- [ ] **Step 1: Write the failing tests** in `share.test.ts`, on a one-unit input with a single 1000-coefficient table and a budget of 1,000.00:
  - one PR without share for the whole period, then a second PR without share added for the whole period: each gets 500.00;
  - in a period 2013-01-01..2013-12-31, an outgoing PR with `ownRestriction { from: null, to: "2013-06-30" }` and an incoming PR with `{ from: "2013-07-01", to: null }`, both without share: they get 495.89 and 504.11 (181 and 184 of 365 days), and the unit is fully allocated (sum 1,000.00);
  - the same pair where the outgoing PR has share 100% and the incoming none: the same two figures;
  - an incoming PR whose dates overlap the outgoing one's by one day: the legacy rule applies to the overlapping pair (both empty: each takes ½ of their days).
  - Keep every existing test of `share.test.ts`, `allocation.test.ts` and `allocation.legacy.test.ts` green unchanged: both seeded periods to the cent.
- [ ] **Step 2: Run** `share.test.ts`. Expected: the first new test passes (it is the legacy rule), the next two FAIL.
- [ ] **Step 3: Implement** the spec's rule ("Successive owners"): a resident's co-owners are the residents of the same unit and role whose dates overlap theirs, a resident's dates being their own, else the unit's, else the period's (an open end runs to the period's). Then the legacy rule within that set.
- [ ] **Step 4: Run** `pnpm gate:full:quiet` and the legacy-import parity specs with `LEGACY_DUMP_DIR`. Expected: PASS, parity unchanged.
- [ ] **Step 5: Commit** `feat(allocation): owners whose dates do not overlap pay one after the other`.

### Task 3: The rules for buildings, periods, groups, units and residencies

**Files:**
- Create: `packages/domain/src/useCases/validateUnits.ts` and `validateBuilding.ts`, each with its test.

**Interfaces:**
- Consumes: Task 1's entities.
- Produces (each returns `Result` from `entities/result.ts`, reasons as Global Constraints, `detail` the name or code the message needs):
  - `interface GroupDraft { code: string; name: string; address: Address | null; notes: string | null }`; `validateGroup(draft: GroupDraft, parentId: string | null, groups: UnitGroup[], editing: string | null): Result` (`blank-code`, `blank-name`, `group-taken` among siblings, ignoring the group being edited);
  - `validateGroupDelete(groupId: string, groups: UnitGroup[], units: Unit[]): Result` (`group-not-empty`);
  - `interface UnitDraft { code: string; name: string | null; floor: string | null; interior: string | null; subUnit: string | null; restriction: Restriction | null; type: UnitType; cadastralData: string | null; notes: string | null }`; `validateUnit(draft: UnitDraft, units: Unit[], period: PeriodDates, editing: string | null): Result` (`blank-code`, `unit-code-taken`, `bad-dates`, `outside-period`);
  - `interface ResidencyDraft { contactId: string | null; role: "PR" | "CO" | "SC"; startingBalance: Cents; ownRestriction: Restriction | null }`; `validateResidency(draft: ResidencyDraft, unitId: string, residents: OwnerParty[], period: PeriodDates, editing: string | null): Result` (`no-contact`, `already-resident` with detail the contact id, `bad-dates`, `outside-period`);
  - `validateResidencyDelete(resident: OwnerParty, entries: JournalEntry[], items: InstallmentItem[]): Result` (`named-in-journal`, then `has-installments`, detail the resident's name);
  - `validateUnitDelete(unitId: string, residents: OwnerParty[], entries: JournalEntry[], items: InstallmentItem[]): Result` (the first resident's refusal);
  - `interface BuildingDraft { name: string; code: string | null; status: RecordStatus; type: BuildingType; address: Address | null; taxCode: string | null; constructionDate: string | null; cadastralData: string | null; notes: string | null }`; `validateBuilding(draft: BuildingDraft, buildings: Building[], editing: string): Result` (`blank-name`, `building-name-taken`, `building-code-taken`);
  - `interface PeriodDraft { name: string; type: PeriodType; closed: boolean; start: string; end: string; notes: string | null }`; `validatePeriod(draft: PeriodDraft, building: Building, editing: string, units: Unit[], residents: OwnerParty[]): Result` (`blank-name`, `period-name-taken`, `bad-dates`, `period-excludes` with detail the unit's code or the resident's name);
  - `validateAddress(address: Address): Result` (`blank-street`).
  - Exports go into `packages/domain/src/index.ts` with their first caller (Tasks 4 and 5).

- [ ] **Step 1: Write the failing tests:** one per reason and one accepted case per validator, with these from the seed: a group "A" or "Stairwell A" beside `ug1` is `group-taken`, a group "C" accepted; a unit "A1" in p1 is `unit-code-taken`, editing A1 to keep "A1" accepted; dates 2011-12-01 to 2012-01-31 in p1 `outside-period`; `r166` delete `named-in-journal`; a fresh resident with no postings but an item `has-installments`; p1's dates moved to 2011-06-01..2011-12-31 `period-excludes` with detail `"A1"`; Pozzetto renamed "Saturno" `building-name-taken`.
- [ ] **Step 2: Run** both test files. Expected: FAIL.
- [ ] **Step 3: Implement.** Codes compare trimmed and case-blind; names compare trimmed and case-blind.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS (the validators are reached by tests only until Task 4: export them from their modules, not yet from `index.ts`).
- [ ] **Step 5: Commit** `feat(units): the rules for building, period, group, unit and residency writes`.

### Task 4: One source of units and residents: the units port

**Files:**
- Modify:
  - `packages/domain/src/ports/unitsPort.ts`, `ports/__contracts__/UnitsPortContract.ts`;
  - `packages/domain/src/simulators/unitsSimulator.ts` and its tests; `accountsSimulator.ts`, `journalSimulator.ts`, `installmentsSimulator.ts`, `tablesSimulator.ts` and their tests;
  - `packages/client-core/src/composition.ts` (`createSimulatorPorts`); `packages/domain/src/index.ts`.

**Interfaces:**
- Consumes: Task 3's validators.
- Produces:
  - `UnitsPort` gains `residents(periodId: string): Observable<OwnerParty[]>`, `addGroup(periodId: string, parentId: string | null, draft: GroupDraft): Promise<ResultOf<Added>>`, `editGroup(groupId: string, draft: GroupDraft): Promise<Result>`, `deleteGroup(groupId: string): Promise<Result>`, `addUnit(periodId: string, groupId: string | null, draft: UnitDraft): Promise<ResultOf<Added>>`, `editUnit(unitId: string, draft: UnitDraft): Promise<Result>`, `deleteUnit(unitId: string): Promise<Result>`, `addResident(unitId: string, draft: ResidencyDraft): Promise<ResultOf<Added>>`, `editResident(residentId: string, draft: ResidencyDraft): Promise<Result>`, `deleteResident(residentId: string): Promise<Result>`, with `interface Added { id: string }`. Unknown ids reject; reads re-emit after an accepted write.
  - A new resident's `name` is its contact's, `unitCode` and `unitId` its unit's, `restriction` its own dates else its unit's, `share` null, `personId` the contact id. Editing a unit's code or dates rewrites its residents' `unitCode` and `restriction`.
  - `interface UnitsSimulator extends UnitsPort { currentUnits(periodId: string): Unit[]; currentResidents(periodId: string): OwnerParty[] }`; `createUnitsSimulator(seed: LegacySeed, readers?: UnitsReaders)` with `interface UnitsReaders { entriesOf(periodId: string): JournalEntry[]; itemsOf(periodId: string): InstallmentItem[]; contactsOf(): Contact[]; periodOf(periodId: string): PeriodDates }`, defaulting to the seed's.
  - `createAccountsSimulator(seed, residentsOf?)`, `createJournalSimulator(seed, clock, scheduleOf, residentsOf?)`, `createInstallmentsSimulator(seed, entriesOf, residentsOf?)`: each reads the period's owners through `residentsOf(periodId): OwnerParty[]` (default: the seed's), and the suppliers from the seed as before. `AccountsPort.parties(periodId)` re-emits when the residents change, suppliers first then residents, as today.
  - `createTablesSimulator(seed, accountsOf?, unitsOf?)`: a period's units come from `unitsOf(periodId): Unit[]`; a unit it has no coefficient for reads as 0 in every table and `setCoefficient` accepts it; a unit no longer listed loses its coefficients. `coefficients(periodId)` re-emits when the units change (the units simulator's streams are combined in).
  - `createSimulatorPorts` builds the units simulator first and passes its `currentResidents` and `currentUnits` to the four others, and the journal's and installments' `current` to it, each read lazily as today.

- [ ] **Step 1: Write the failing tests.**
  - `UnitsPortContract`: every read; each add, edit and delete accepted; each refusal of Task 3 reached through the port; re-emission; unknown ids reject. The harness supplies a period, a group with no units, a unit with a resident named in the journal, and a contact who is not a resident.
  - Over the real seed through `createSimulatorPorts`:
    - `addUnit("p36", null, { code: "A19", … })`: the tables port's `coefficients("p36")` then has 12 coefficients for the new id, all 0; `setCoefficient` on it is accepted;
    - `addResident` on the new unit with contact `md…` (any seeded contact): `accounts.parties("p36")` emits it; a collection posted for it through the journal port is accepted, where before the change the journal refused a counterpart it did not know;
    - `deleteResident("r166")` is `named-in-journal`; deleting the new resident is accepted, then deleting the unit is accepted and its coefficients are gone.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Each period's units, groups and residents live in `BehaviorSubject`s in the units simulator, as the other simulators keep theirs. A group's delete takes nothing with it (it is refused unless empty); a unit's takes its residents.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS, every existing contract and presenter test unchanged.
- [ ] **Step 5: Commit** `feat(units): units, groups and residents written through the units port, read by every simulator`.

### Task 5: The buildings port's writes and the contacts port

**Files:**
- Create: `packages/domain/src/ports/contactsPort.ts`, `ports/__contracts__/ContactsPortContract.ts`, `simulators/contactsSimulator.ts` with its contract test.
- Modify: `ports/buildingsPort.ts`, `__contracts__/BuildingsPortContract.ts`, `simulators/buildingsSimulator.ts` and tests; `packages/client-core/src/composition.ts` (`AppPorts.contacts`); `packages/client-react/src/app/buildPorts.ts` if it lists ports; `index.ts`.

**Interfaces:**
- Consumes: Task 3's `validateBuilding`, `validatePeriod`, `validateAddress`; Task 4's `currentUnits`, `currentResidents`.
- Produces:
  - `BuildingsPort` gains `suppliers(buildingId: string): Observable<string[]>` (contact ids; errors "missing: the building <id>"), `editBuilding(buildingId: string, draft: BuildingDraft): Promise<Result>`, `editPeriod(periodId: string, draft: PeriodDraft): Promise<Result>`. An accepted building edit sets `modifiedOn` from the clock.
  - `createBuildingsSimulator(seed, clock, readers?)` with `interface BuildingsReaders { unitsOf(periodId: string): Unit[]; residentsOf(periodId: string): OwnerParty[] }`.
  - `ContactsPort { contacts(): Observable<Contact[]> }`; `createContactsSimulator(seed): ContactsPort`; `AppPorts.contacts`. The units simulator's `contactsOf` reads the seed's contacts (the contacts port has no writes yet).

- [ ] **Step 1: Write the failing tests.** Contracts: `buildings()` re-emits after an accepted edit; each refusal reached; `suppliers` of a known and an unknown building; `contacts()` lists every contact once. Over the seed: `editPeriod("p1", { …, start: "2011-06-01" })` is `period-excludes` with detail `"A1"`; `editPeriod("p36", { …, notes: "x" })` is accepted and `buildings()` re-emits with the note.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** The buildings live in one `BehaviorSubject`.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(buildings): edit a building and a period; the building's suppliers; the contacts port`.

### Task 6: The Units grid and the Unit Owners tab (domain)

**Files:**
- Create: `packages/domain/src/useCases/units/unitsList.ts`, `unitOwners.ts`, each with its test, and `unitsList.legacy.test.ts` (the pinned figures).
- Modify: `useCases/allocation/layout.ts` (exported helpers), `index.ts`.

**Interfaces:**
- Consumes: `allocationOf`, `AllocationBooks`, `scheduleOf`, `ScheduleInput`, `previousBalancesOf`, `levelOf`, `groupLabelOf`, `residentsOf`, `restrictionTextOf`, `daysOf`, Task 2's `compoundCoefficientOf`.
- Produces:
  - `type UnitsRowKind = "root" | "group" | "unit" | "resident" | "rounding"`;
  - `interface UnitsRow { key: string; kind: UnitsRowKind; label: string; icon: "building" | "group" | UnitType | "owner" | "rounding"; unitId: string | null; residentId: string | null; groupId: string | null; floor: string; interior: string; subUnit: string; type: UnitType | null; restriction: string; previousBalance: Cents | null; budget: Cents; actual: Cents; due: Cents; paid: Cents | null; overdue: Cents | null; adjustment: Cents; children: UnitsRow[] }`;
  - `interface UnitsList { root: UnitsRow; unitCount: number }`;
  - `interface UnitsBooks { allocation: AllocationBooks; schedule: ScheduleInput; units: Unit[]; groups: UnitGroup[]; buildingLabel: string }`; `unitsListOf(books: UnitsBooks, today: string): UnitsList`.
    - Rows and labels as the spec's "The Units grid"; keys `root`, `group:<id>`, `unit:<id>`, `resident:<id>`, `rounding`. A single-resident unit is one row of kind `"unit"` carrying both `unitId` and `residentId`.
    - Per resident: `previousBalance` from `previousBalancesOf`; `budget` and `actual` the resident row's `total` of `allocationOf` in `"budget"` and `"finalBalance"`; `due = previousBalance + actual`; `paid` the allocation's; `overdue` the schedule resident's `overdue`; `adjustment = due − the schedule resident's totalInstallments`. Upper rows sum; the rounding row is `budget` and `actual` as each allocation's Roundings total, `due` and `adjustment` = its `actual`, the rest null.
  - `interface OwnersRow { key: string; kind: "period" | "role" | "resident"; label: string; scenario: string; out: boolean; restriction: string; days: string; share: number | null; coefficient: number | null; residentId: string | null; children: OwnersRow[] }`; `unitOwnersOf(unit: Unit, input: AllocationInput): OwnersRow` (the head row, its role sub-heads in priority order, residents within as `residentsOf` orders them).

- [ ] **Step 1: Write the failing tests.**
  - `unitsList.legacy.test.ts`, over the seed with `today` `"2026-10-30"`: every row of `bu-design.md` §1's two tables, by unit code (Prev. bal., Budget, Actual, Total due, Paid), e.g. Pozzetto root −6,250.99 / 38,000.00 / 34,887.71 / 28,636.72 / 21,825.98, A04 2,697.11 / 945.27 / 884.88 / 3,581.99 / 3,339.89, the rounding row −0.52 / −0.32; Saturno group A 89.42 / 7,042.10 / 2,305.58 / 2,395.00 / 3,126.23, B1's CO −12.67 / 31.79 / 9.83 / −2.84 / 0.00, rounding 0.01 / 0.01.
  - Overdue and Adjustment at the roots: Pozzetto 11,765.90 and −4,955.16, Saturno 4,408.95 and −4,944.81; Saturno A3's Overdue 725.00 with its Total due − Paid negative.
  - The books identity: for each period, the root's `due − paid` equals the balance of the `owners` account node in `buildAccountTree` (Pozzetto 6,810.74, Saturno −535.86).
  - Structure: Saturno's root children are group A, group B, then the rounding row; A1 is a single row "A1 - {name} (PR)" with floor "1", interior "1", type `"shop"`, restriction "01/05/2011 - 31/05/2011"; Pozzetto's A04 has two resident children.
  - `unitOwnersOf`: Pozzetto A04: head "Full period", "Standard (owner/tenant)", days "365/365"; sub-head "Owners"; r167 `out` true, days "18/365", coefficient 0.049315; r166 days "347/365", coefficient 0.950685 (the order is `residentsOf`'s). A09's third owner coefficient 0. Saturno A2: sub-heads "Owners" then "Tenants".
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Build the tree with `levelOf`, reading the residents' figures from the two allocations' resident rows by key (`resident:<id>`) and the schedule's by `residentId`. The rounding row is the root's last child.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(units): the Units grid and the Unit Owners tab, with Danea's Overdue and Adjustment`.

### Task 7: Groups in the Installment Schedule, and the address in the period labels

**Files:**
- Modify: `packages/domain/src/useCases/schedule.ts` and tests; `useCases/allocation/allocationSource.ts`; `packages/client-core/src/presenters/buildingsPresenter.ts` (`periodLabelOf`), `installmentSchedulePresenter.ts`, `journalPresenter.ts` (`JournalContext`), their tests; `packages/client-react/src/ui/journal/wizards/WizardDialog.tsx` and its test; the schedule's column spec in the client (the Total due tooltip); goldens of the Installment Schedule, the Allocation and the wizards.

**Interfaces:**
- Consumes: Task 1's `Address`, `Unit`, `UnitGroup`.
- Produces:
  - `addressTextOf(address: Address): string` in `entities/address.ts` → "{street}, {postcode} {city}", leaving out what is null;
  - `ScheduleInput` gains `units: Unit[]` and `groups: UnitGroup[]`; `ScheduleNodeKind` gains `"group"`. The schedule's rows: root, groups (by code, nested, "{code} - {name}"), units, residents, Roundings, as `allocationOf` orders them. Its figures do not change.
  - `periodLabelOf(tree, periodId)` → "{building} / {period} ({address})", without " ({address})" when the building has none. The allocation's and the schedule's root labels use it.
  - `JournalContext` gains `address: string | null`; the wizard header reads "Building / Period: {building} ({address}) / {period}".

- [ ] **Step 1: Write the failing tests:** Saturno's schedule root has children group A, group B (and Roundings when posted), A's figures sum A1–A4's; Pozzetto's root label is "Pozzetto / 2013 ({address})" with the seed's address text; the wizard header test reads the address.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**, adding the Installment Schedule's "Total due" tooltip to its column.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`, then `pnpm visual`. Expected: green; the changed darwin goldens are the schedule's (group rows, root label), the allocation's and the wizards' (label). Open each, say why it is right, and update only those.
- [ ] **Step 5: Commit** `feat(schedule): unit groups in the Installment Schedule; the building's address in period labels`.

### Task 8: The Building Data rows (domain)

**Files:**
- Create: `packages/domain/src/useCases/buildingRows.ts` and its test.

**Interfaces:**
- Consumes: `buildAccountTree`, Task 6's `unitsListOf`.
- Produces:
  - `interface PeriodFigures { liquidity: Cents; funds: Cents; budget: Cents; actual: Cents; previousBalance: Cents; due: Cents }`;
  - `periodFiguresOf(list: UnitsList, tree: AccountNode, accounts: Account[]): PeriodFigures`: Liquidity the `liquidity` account node's balance as the Accounts tree has it; Funds the `funds` node's balance shown positive (negated ledger sign); the rest the Units root's;
  - `interface BuildingRow { key: string; kind: "building" | "period"; buildingId: string; periodId: string | null; code: string; label: string; type: BuildingType | PeriodType; closed: boolean | null; dates: string; figures: PeriodFigures | null; children: BuildingRow[] }`;
  - `buildingRowsOf(buildings: Building[], figures: Map<string, PeriodFigures>): BuildingRow[]`: buildings by name, "{name} ({address})"; periods by start, "{name} ({type word})" with the period type's English word; a period with no figures yet has `figures` null.

- [ ] **Step 1: Write the failing tests:** over the seed, the spec's table: Saturno 2011 2,954.14 / 1,750.00 / 7,400.00 / 2,455.19 / 288.92 / 2,744.11; Pozzetto 2013 1,078.26 / 0.00 / 38,000.00 / 34,887.71 / −6,250.99 / 28,636.72. The identity: Funds + payables to third parties − receivables from them − Liquidity equals the Units root's `due − paid` for both periods (Pozzetto 0 + 7,889.00 − 0 − 1,078.26 = 6,810.74; Saturno 1,750.00 + 668.28 − 0 − 2,954.14 = −535.86), each term read from the Accounts tree; `bu-danea.md` §4 names the accounts behind each term. If a term cannot be read so that the identity holds, stop and report rather than fit it. Building rows: Pozzetto then Saturno, each one period child.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(buildings): the Building Data rows and each period's figures`.

### Task 9: The units presenter and its machines

**Files:**
- Create: `packages/client-core/src/presenters/unitsPresenter.ts`, `machines/unitDialogMachines.ts` (group, unit, owner), each with tests.
- Modify: `screens.ts` (`GridName` + `"units" | "unitOwners"`, `SplitName` + `"units"`, `TabbedPanelName` + `"units"`), `composition.ts` (presenter and dialog factories), `presenters/booksPresenter.ts` (exports `booksOf`, below).

**Interfaces:**
- Consumes: Tasks 4–7; `createTreeGridMachine`, `createScreens`; M2e's `tableDialogMachine` as the shape to copy.
- Produces:
  - `booksOf(ports: BooksPresenterPorts, periodId: string, period: PeriodDates): Observable<Books>`, the per-period half of `createBooksPresenter`, which now calls it;
  - `interface UnitsView { list: UnitsList; selected: UnitsRow | null; unit: Unit | null; owners: OwnersRow | null; openingPosted: boolean }`; `createUnitsPresenter(books$, buildings.tree$, { units, tables, contacts }, clock)` with `view$: Observable<UnitsView | null>` (null while the period's units are not yet the books' period, as `allocationPresenter.periodOf` does), `select(key: string): void` (selection resets to the first unit row on a period switch), and the nine writes forwarded to the port;
  - dialog machines `createGroupDialog`, `createUnitDialog`, `createOwnerDialog` (new and edit), each with fields as text, `canSave` false while a required field is blank, `save(): Promise<Result>` judging with Task 3's validator first, then the port; the owner's previous balance locked (and 0 on add) when `openingPosted`;
  - the breadcrumb's last crumb: `crumb$: Observable<string | null>`, the selected unit's or resident's unit code, the group's code, null for root and rounding.

- [ ] **Step 1: Write the failing tests** (harness over the real seed): the view's root and selection; switching from p1 with B3 selected to p36 selects A01 and the bottom tabs show A01 (Review Focus 3); adding a group under `ug1` lists it; adding an owner without a percentage to Saturno A3 halves the existing owner's Budget (Review Focus 1); a refused delete answers `named-in-journal` and the selection stays; adding unit A19, then `tables.setCoefficient` on it, gives it a Budget (Review Focus 4); the owner dialog on p36 has the balance locked; the crumb for r166 is "A04".
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(units): the units presenter and the group, unit and owner dialogs' machines`.

### Task 10: The building data presenter and its machines

**Files:**
- Create: `packages/client-core/src/presenters/buildingDataPresenter.ts`, `machines/buildingDialogMachines.ts` (building, period, address), each with tests.
- Modify: `screens.ts` (`GridName` + `"buildingData" | "suppliers"`, `SplitName` + `"buildingData" | "suppliers"`, `TabbedPanelName` + `"buildingData"`), `composition.ts`, `docs/STATUS.md`'s "Presenter robustness" entry (one set of streams per period stays subscribed once the screen is visited).

**Interfaces:**
- Consumes: Task 5's ports, Task 8's use cases, Task 9's `booksOf`.
- Produces:
  - `interface BuildingDataView { rows: BuildingRow[]; selected: BuildingRow | null; building: Building | null; suppliers: Contact[]; supplier: Contact | null }`; `createBuildingDataPresenter(ports, buildings, clock)` with `view$`, `select(key: string)` (a period row also calls `buildings.selectPeriod`), `selectSupplier(contactId: string)`. Each period's figures come from its own `booksOf`, tables and units, assembled as `unitsListOf` needs; the selection starts on the app's period row and follows the sidebar. Suppliers by category, then name.
  - dialog machines `createBuildingDialog`, `createPeriodDialog`, `createAddressDialog`, as Task 9's.

- [ ] **Step 1: Write the failing tests:** both period rows carry Task 8's figures; selecting Saturno's period row makes p1 the app's period; selecting a building row shows its profile and does not change the period; the period dialog refuses p1 starting 2011-06-01 with `period-excludes` (Review Focus 5); renaming p36 updates the sidebar tree; the suppliers of `c19` are 12, ordered.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(buildings): the building data presenter and the building, period and address dialogs' machines`.

### Task 11: The Units screen

**Files:**
- Create: `packages/client-react/src/ui/units/` (`UnitsScreen.tsx` thin reader, `UnitsPanel.tsx`, `UnitProfile.tsx`, `UnitOwnersGrid.tsx`, `ShareBar.tsx`, `columns.ts`, CSS, page objects and tests).
- Modify: `packages/react-bindings/src/createViewModel.ts` (`useUnits`, `useUnitsGrid`, `useUnitOwnersGrid`, `useUnitDialog`), `viewModel.page.tsx`, `viewModel.test.tsx`; `ui/shell/Screen.tsx` (route `units`), `ui/shell/Breadcrumb.tsx` (the crumb), `ui/shell/Sidebar.test.tsx` (its placeholder example becomes Contacts), `testids.ts`, `architecture.config.mts` (`compilerTracked`: `UnitsPanel`, `UnitOwnersGrid`).

**Interfaces:**
- Consumes: Task 9's view, selection, crumb and dialog factories.
- Produces: the screen as the spec's "The Units grid" and "The bottom panel": icons, bold `--zebra` group and root rows, tooltips, the static chip, toolbars whose print/PDF/XLS/⟳/Legend show the "not yet available" notice, the `% Share` bar in `--acc`, coefficients with six decimals, the "Select a unit." empty state.

- [ ] **Step 1: Write the failing tests** through page objects: Saturno's grid lists the root, A, A1…A4, B, B1…B4 and "Rounding error"; A1's Floor "1" and Type "Shop"; selecting B1 shows its profile and its owners grid with sub-heads "Owners" and "Tenants"; the breadcrumb ends "› B1"; the Total due header's tooltip; the Unit Owners tab of Pozzetto A04 shows "18/365" and "0.049315" with Out ticked.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(units): the Units, Owners & Personal Balance screen`.

### Task 12: The group, unit and owner dialogs on screen

**Files:**
- Create: `packages/client-react/src/ui/units/GroupDialog.tsx`, `UnitDialog.tsx`, `OwnerDialog.tsx`, `ContactPicker.tsx`, `unitsReasons.ts`, page objects and tests.
- Modify: `UnitsScreen.tsx` (dialog state, `+▾` menu, ✎, −, `ConfirmAlert`s), `testids.ts`.

**Interfaces:**
- Consumes: Task 9's machines; M2e's `TableDialog` and `ConfirmAlert` as the shapes to copy; `DateField`, `FormField`, `Fieldset`.
- Produces: the three dialogs with the exact copy; `unitsReasons.ts` words every reason of Task 3 with its detail; − is disabled on a group with children, on the root and on the rounding row.

- [ ] **Step 1: Write the failing tests:** New Unit with a blank code keeps "+ Add"/OK disabled; a taken code shows "Another unit of this period has the code A1"; removing r166 shows "Remove {name} from A04?" then, on Yes, "{name} is named in the journal: delete those entries first" with the row still selected (Review Focus 2); Edit Owner on p36 shows the locked balance's line; the contact picker filters by typed text and adds the owner to the grid.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(units): add, edit and delete groups, units and owners`.

### Task 13: The Building Data screen and its dialogs

**Files:**
- Create: `packages/client-react/src/ui/buildingData/` (`BuildingDataScreen.tsx`, `BuildingDataPanel.tsx`, `BuildingProfile.tsx`, `BuildingSuppliers.tsx`, `BuildingDialog.tsx`, `PeriodDialog.tsx`, `AddressDialog.tsx`, `buildingReasons.ts`, CSS, page objects and tests).
- Modify: `createViewModel.ts` (`useBuildingData`, `useBuildingDataGrid`, `useBuildingDialog`, `usePeriodDialog`), its page and test; `ui/shell/Screen.tsx` (route `data`), `ui/shell/Sidebar.tsx` (its ✎ opens the period dialog), `testids.ts`, `architecture.config.mts` (`compilerTracked`: `BuildingDataPanel`).

**Interfaces:**
- Consumes: Task 10's view and dialog factories.
- Produces: the screen as the spec's "The Building Data screen"; the two dialogs and the Address dialog with the exact copy; the `+▾` (New building, New period), − and the suppliers' `+ ✎ −` show their notices.

- [ ] **Step 1: Write the failing tests:** both period rows show their six figures; clicking Saturno's period row switches the sidebar's selection; the profile shows "SAT" and the construction date "20/05/1980"; the suppliers tab lists 12 for Pozzetto with categories, and the sheet shows a company's phone; Edit Building with a blank name keeps OK disabled; the sidebar's ✎ opens "Edit Management / Period"; an Address with a blank street shows "Enter the street and number".
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(buildings): the Building Data & Suppliers screen, Edit Building and Edit Management / Period`.

### Task 14: Goldens and the end-to-end spec

**Files:**
- Modify: `packages/client-react/tests/visual/scenarios.ts`, `registry.tsx`, `seeding.ts` (selection of a unit row, a building data row, a supplier, the bottom tab); goldens; `packages/e2e/src/sim/units.spec.ts` (new), `packages/e2e/src/pages/Units.page.ts` (new), `src/testing/test.ts`.

- [ ] **Step 1: Add the scenarios:** pages `units-1280-light` (Saturno, B1 selected, Unit Owners tab) and `building-data-1280-light` (Pozzetto period selected, Building Profile); components `units-panel-pozzetto`, `unit-owners-ownership-change` (A04), `unit-profile-restricted` (Saturno A1), `building-profile`, `building-suppliers`, `group-dialog-taken`, `unit-dialog-new`, `owner-dialog-locked-balance`, `owner-dialog-add`, `building-dialog`, `period-dialog-refused`, `address-dialog`.
- [ ] **Step 2: Run** `pnpm visual:update`, open every new image and check it shows what its name says; `git status` lists only those, plus nothing else changed.
- [ ] **Step 3: Write the e2e spec** on the simulator: open "Units, Owners & Personal Balance", add an owner to a unit through the dialog, and see the owner in the Units grid and in the Installment Schedule. Run `pnpm e2e --mode sim`. Expected: PASS.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `test(visual): Building Data & Units scenarios; e2e: add an owner`. The controller redraws the linux-x64 set.

### Task 15: STATUS, IDEAS and the specs

**Files:** `docs/STATUS.md`, `docs/IDEAS.md`, `docs/superpowers/specs/2026-10-11-app-v2-design.md`.

- [ ] **Step 1:** In STATUS: remove "Unit groups and the Units entity"; in "The rest of the Buildings module for M2" leave Contacts and Calendar; add "Next, with no plan yet" entries "**New and deleted buildings and periods**" (a new period starts from the previous one: chart, units, residents, balances carried) and "**Edit a building's suppliers**" (with Contacts); add to Known limits the successive-owners departure from the legacy rule and that Liquidity and Funds are found by the generator's role; keep "Presenter robustness" as Task 10 left it. Set "Last updated".
- [ ] **Step 2:** In IDEAS: "Issue a conguaglio installment from the Adjustment column"; "Edit co-ownership percentages"; "Ownership scenarios (bare ownership/usufruct, leasing) and a second unit period". In the parent design, the M2 row and the Ports table say what M2f built (`UnitsPort` writes, `ContactsPort` reads).
- [ ] **Step 3: Run** `pnpm check:status`, `pnpm check:doc-links`, `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 4: Commit** `docs: STATUS, IDEAS and the parent design after M2f`.
