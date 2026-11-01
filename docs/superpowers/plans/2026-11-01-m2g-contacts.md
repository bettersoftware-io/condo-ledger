# M2g — Contacts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Contacts module: find, read, add, edit, archive and delete people and companies, with their categories and connections; editable Building Suppliers; a contact picker that creates in place; and one source for a contact's name.

**Architecture:**
- The seed gains every contact of the dump, with their fields, rows, categories, connection and salutations.
- `ContactsPort` becomes writable, and answers where each contact is used. The contacts simulator owns the contacts. The units, accounts, journal and installments simulators read names from it, and one rule gives a period's suppliers.
- The core gets a contacts presenter and the dialog machines; the client draws the screen on the existing `TreeGrid`, `Panel`, `TabbedPanel`, `Scheda`, `Dialog` and paging.

**Tech Stack:**
- TypeScript, RxJS with `@rx-state/core`, React 19 with the React Compiler;
- Vitest, Playwright through the visual and e2e add-ons.

**Spec:** `docs/superpowers/specs/2026-11-01-m2g-contacts-design.md`. It is the authority. Its Sources section names the legacy files and screenshots to read for layout. `old/` is not in the worktree: read it in the project's checkout, `/Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/old`.

## Global Constraints

- **Where and how to work:**
  - Work in the worktree `../condo-ledger-worktrees/contacts`, branch `worktree-contacts`, and open one pull request at the end.
  - Every task ends with `pnpm fix`, then `pnpm gate:full:quiet` green, then a commit. A red gate is not a finished task.
  - `pnpm --filter X test -- <name>` does not filter in this repo. While iterating, run single files with vitest from the package.
- **AGENTS.md code rules hold everywhere:** function declarations and named object types; `#/` imports past one folder; no `useMemo`, `useCallback` or `memo`, and no inline styles; test ids in `packages/client-react/src/ui/testids.ts`, and UI tests through page objects; fake timers and no sleeps; fixture factories named `create…`, and tests before helpers in a test file; a line of an `index.ts` only with an importer through it (knip); colours as tokens.
- **The seed:** `legacySeed.generated.ts` is only rewritten by `pnpm --filter @cl/legacy-import gen:data`.
  - Run generators and dump-backed tests with `LEGACY_DUMP_DIR=/Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/old/db` and `DESIGN_ORACLE_DIR=/Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/docs/design/web/v1/reports/pozzetto`, and show that they ran, not skipped. Run `gate:full` without them.
  - Committed files never carry a person's real name, street, phone, email or tax code. The legacy screenshots hold real data: nothing from them goes into a test, a spec or a golden.
  - Passwords and `accessAccount`, `unitResidentAccount` are never read by the generator.
- **Ids:** contacts `md<n>` (a new one takes the highest number plus one); a supplier's party id and counterpart id are its contact's id; categories `mc<n>`, new `mc-new-<n>`; connections `cr<n>`, new `cr-new-<n>`; contact rows `mr<n>`, new `mr-new-<n>`. Buildings `c1` (Saturno, period `p1`) and `c19` (Pozzetto, period `p36`).
- **Exact copy (the spec's):**
  - **Filters:** cards "Filter Contacts" ("Natural persons", "Companies", "Keyword", "Building", "Status", buttons "Search", "Reset") and "Contact Categories"; "- All -"; rail "FILTERS".
  - **List:** panel "Contact List"; "Page {p} of {n} · {total} contacts total"; columns `Name / Company | Code | Type | St. | Reference address | Tax code | VAT no. | Lng. | Category`; empty value `---`; "No contact matches."
  - **Tabs:** "Contact Details", "Connected Contacts"; `+ ▾` items "New person", "New company". Fieldsets "PERSONAL DATA", "COMPANY DATA", "CONTACTS", "SUPPLIER OF THE FOLLOWING BUILDINGS" ("- None -"), "RESIDENT OF", "ON INVOICES OF", "IN ENTRIES OF", "USEFUL DATA", "NOTES". Connected columns `Order | Relationship | Name | Code | Type | St. | Reference address | Tax code | VAT no.`; "No connected contacts."
  - **Dialogs:** "New Person" / "Edit Person", "New Company" / "Edit Company" (560px); "Add Contact" / "Edit Contact" (460px: "Order", "Contact type", "Label", "Value"); "New Category" / "Edit Category" ("Name"); "Add Connected Contact" / "Edit Connected Contact" ("Contact", "Relationship", "Order"); "Add Supplier" ("Contact"). Person fields: "Status", "Code", "First name", "Last name", "Gender" (Male, Female, Unspecified), "Birth date", "Birth place", "Office address", "Residence address", "Domicile address", "Salutation", "Tax code", "VAT number", "Contact category", "Postal address", "Language" (Italian, English). Company: "Company name", "Registered office", "Tax domicile". Row types: Phone, Email, Website, Instant messaging, Certified email; each type's usual label is its own word.
  - **Questions:** "Delete {name}? This cannot be undone."; "Delete the category {name}?"; "Remove {name} from this contact?"; "Remove {name} from this building's suppliers?"
  - **Reasons** (domain codes, worded in `ui/contacts/contactReasons.ts`):
    - `blank-last-name` "Enter a last name"; `blank-company-name` "Enter a company name"; `code-too-long` "A code has at most 15 characters"; `contact-code-taken` "Another contact has the code {code}"; `bad-birth-date` "The birth date is not a date";
    - `blank-label` "Enter a label"; `blank-value` "Enter a value"; `bad-order` "The order is a whole number from 1";
    - `blank-name` "Enter a name"; `name-too-long` "A name has at most 63 characters"; `category-name-taken` "Another category is named {name}"; `category-not-empty` "Move its {n} contacts to another category first.";
    - `no-contact` "Choose a contact"; `same-contact` "A contact cannot be connected to itself"; `blank-relationship` "Enter the relationship"; `relationship-too-long` "A relationship has at most 127 characters"; `connection-taken` "{name} already has this relationship";
    - `is-resident` "{name} is a resident of {building}, so it cannot be deleted. Archive it instead."; `is-supplier` "{name} is a supplier of {building}, so it cannot be deleted. Archive it instead."; `on-invoice` "{name} is on an invoice of {building}, so it cannot be deleted. Archive it instead."; `in-entries` "{name} is in an entry of {building}, so it cannot be deleted. Archive it instead.";
    - `already-supplier` "{name} is already a supplier of this building".
- **Visual tier:** `host/`, `visual.pw.ts` and `playwright.config.ts` stay untouched; a dialog is a component scenario with `capture: "viewport"`; a native `<select>` draws its chosen text as ordinary text.

**Ruling recorded here, beyond the spec:** `ContactsPort` also answers `uses()`, where each contact is used. The spec has the presenter work this out from every period's streams. A port read gives the server one query in M3, and spares the presenter a stream per period, a cost `docs/STATUS.md` already lists against Building Data. `contactUsesOf` stays the pure use case behind it.

## Review Focus

1. **A renamed contact** is right on Units, Building Suppliers, the Journal, the Installment Schedule and the invoice wizard with no reload, and the renamed row keeps its selection on whichever page it moves to (Tasks 3, 4 and 8 tests).
2. **A new person saved from Add Owner, then the owner cancelled:** the contact exists, nothing else changed, and focus returns cleanly (Task 12 test).
3. **Add Owner → New person → Add Contact:** Escape closes only the top dialog, and focus returns to the button that opened it (Task 11 test).
4. **The last contact on the last page deleted, or a filter down to nothing:** the page clamps, a selection follows or the panel says "No contact matches.", never "page 3 of 2" (Task 6 test).
5. **A supplier removed with invoices in the period:** its name stays on those entries, and the Accounts tree does not throw; one with nothing posted leaves the wizard's list (Task 5 test).

---

### Task 1: The contact's fields, every contact and the categories in the seed

**Files:**
- Modify:
  - `packages/domain/src/entities/contact.ts`, `packages/domain/src/index.ts`;
  - `packages/domain/src/simulators/seed/legacySeed.ts`, `contactsSimulator.ts`, `unitsSimulator.ts` (the resident's name);
  - `packages/domain/src/ports/contactsPort.ts`, its contract and `contactsSimulator.contract.test.ts`;
  - `packages/domain/src/testing/createSmallBooks.ts`, `createUnitsSeed.ts`;
  - `packages/legacy-import/src/project/masterData.ts`, `legacySeed.ts`, their tests; `src/translate/exact.ts`, `translateSeed.ts` and test;
  - `packages/client-core/src/presenters/buildingDataPresenter.ts`, `unitsPresenter.ts`, their tests;
  - `packages/client-react/src/ui/buildingData/BuildingSuppliers.tsx` and test, `ui/units/ContactPicker.tsx` and test;
  - `legacySeed.generated.ts` (regenerated).
- Create: `packages/domain/src/simulators/seed/legacySeed.contacts.test.ts`, `packages/domain/src/useCases/contacts/contactViews.ts` and test.

**Interfaces:**
- Produces:
  - `Contact = PersonContact | CompanyContact`, as the spec's Domain section, with `ContactBase`. `ContactRow { id; type: ContactRowType; label; value; order }`, `type ContactRowType = "phone" | "email" | "web" | "im" | "pec"`. `ContactCategory { id; name }`. `ContactConnection { id; contactId; connectedId; relationship; order }`.
  - `nameOf(contact: Contact): string`; `referenceAddressOf(contact: Contact): Address | null`.
  - `interface ContactView { contact: Contact; id: string; kind: Contact["kind"]; name: string; status: RecordStatus; code: string | null; category: string | null; referenceAddress: string | null }`, and `contactViewsOf(contacts: Contact[], categories: ContactCategory[]): ContactView[]`, by name (`localeCompare` with `"it"`), then id.
  - `ContactsPort.categories(): Observable<ContactCategory[]>`, `connections(contactId: string): Observable<ContactConnection[]>`.
  - `LegacySeed` gains `contactCategories`, `contactConnections` and `salutations: string[]` (most used first, then by name).
  - `units.contacts$` and `useContacts()` answer `ContactView[]`. `BuildingDataView.suppliers` and `supplier` become `ContactView`.

- [ ] **Step 1: Write the failing tests.**
  - `legacySeed.contacts.test.ts`, over the committed seed: 113 contacts, 81 people and 32 companies; 111 active and 2 archived; 29 with a code, all different; 34 categories; 47 rows, sorted by order within a contact; 1 connection whose `contactId` is the legacy `to`; 9 salutations; every contact's `categoryId` is in `contactCategories`; `supplierLinks` still 6 for `c1` and 12 for `c19`.
  - The synthetic generator test: a person projects first and last name, gender, birth date, birth place, the three addresses, postal address, `it_IT` as `"it"`, salutation and notes; a company projects its two addresses; a variation's rows are left out.
  - `contactViews.test.ts`: `referenceAddressOf` for each step of both chains (person: office, residence, domicile, postal; company: registered office, tax domicile, postal), and null with none; `nameOf` for a person with no first name.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.** `projectContacts` takes every `masterData` row. Translate the row labels, salutations and categories in `exact.ts`; the three test labels pass through. Replace `phone`, `email` and `category` for their readers: the supplier sheet keeps showing one phone and one email in this task. Regenerate with `gen:data`, then `gen:oracle-fixture`.
- [ ] **Step 4: Prove the seed moved only where meant.** A throwaway script compares the old and new generated seed key by key, and only `contacts`, `contactCategories`, `contactConnections` and `salutations` may differ. Then add a planted person's name in `notes` and a planted street in `birthPlace` to the privacy test's sweep and see it fail on them, then remove them. Show both results.
- [ ] **Step 5: Run** `pnpm gate:full:quiet`, the legacy-import suite with both env vars, and `pnpm visual`. Expected: green, every golden unchanged.
- [ ] **Step 6: Commit** `feat(contacts): every contact of the dump in the seed, with its fields, rows and categories`.

### Task 2: The rules

**Files:**
- Create: `packages/domain/src/useCases/contacts/validateContact.ts`, `validateCategory.ts`, `validateConnection.ts`, `contactUses.ts`, `contactFilter.ts`, each with its test.

**Interfaces:**
- Produces:
  - `type ContactDraft` (the entity's fields without `id`, with `rows: ContactRowDraft[]`), `ContactRowDraft { id: string | null; type; label; value; order: number }`.
  - `validateContact(draft: ContactDraft, contacts: Contact[], editing: string | null): Result`; `validateContactRow(row: ContactRowDraft): Result`.
  - `validateCategory(name: string, categories: ContactCategory[], editing: string | null): Result`; `validateCategoryDelete(category: ContactCategory, contacts: Contact[]): Result`, with the count as detail.
  - `ConnectionDraft { connectedId: string | null; relationship: string; order: number }`; `validateConnection(contactId: string, draft: ConnectionDraft, connections: ContactConnection[], editing: string | null): Result`.
  - `ContactUses { supplierOf: string[]; residentOf: string[]; onInvoicesOf: string[]; inEntriesOf: string[] }` (building ids, each once); `type ContactUsesById = Map<string, ContactUses>`; `UsesOfPeriod { buildingId; residents: OwnerParty[]; invoices: Invoice[]; entries: JournalEntry[] }`; `contactUsesOf(links: SupplierLink[], periods: UsesOfPeriod[]): ContactUsesById`.
  - `validateContactDelete(contact: Contact, uses: ContactUses | undefined, buildings: Building[]): Result`, checked in the order `is-resident`, `is-supplier`, `on-invoice`, `in-entries`, the detail the first building's name.
  - `ContactFilter { persons: boolean; companies: boolean; keyword: string; buildingId: string | null; status: RecordStatus | null; categoryId: string | null }`; `ALL_CONTACTS: ContactFilter`; `filterContacts(contacts: Contact[], filter: ContactFilter, uses: ContactUsesById): Contact[]`.

- [ ] **Step 1: Write the failing tests:**
  - `validateContact`: blank last name, blank company name (spaces count as blank); a 15 character code passes and a 16 fails; a code differing only in case is `contact-code-taken` with the code as detail; the same contact keeping its code passes; a blank code passes twice; a birth date of `"2023-02-30"` is `bad-birth-date`.
  - `validateContactRow`: blank label, blank value, orders 0 and 1.5 are `bad-order`.
  - `validateCategory`: blank; 63 and 64 characters; taken ignoring case; own name while editing. `validateCategoryDelete`: a category with 2 contacts is `category-not-empty` with detail `"2"`; with none it passes.
  - `validateConnection`: no contact; the contact itself; 127 and 128 characters; the same contact with the same relationship, ignoring case, is `connection-taken`; the same contact with another relationship passes.
  - `contactUsesOf`: a supplier counterpart counts in `inEntriesOf`; an owner counterpart reaches its contact through the resident's `personId`; a building appears once however many periods name the contact.
  - `validateContactDelete`: each reason in order, and passing with no uses.
  - `filterContacts`: neither box ticked gives none; `"citta"` finds a code holding `"Città"`, and each of the six keyword fields is reached; `"   "` narrows nothing; each of the four meanings of Building; status and category.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Keyword compares after trimming, lower-casing and removing accents (`normalize("NFD")`, then strip combining marks).
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(contacts): the rules for contacts, categories and connections, and where a contact is used`.

### Task 3: The contacts port's writes

**Files:**
- Modify: `packages/domain/src/ports/contactsPort.ts`, `__contracts__/ContactsPortContract.ts`, `simulators/contactsSimulator.ts`, its contract test, `packages/client-core/src/composition.ts`.
- Create: `simulators/contactsSimulator.test.ts`.

**Interfaces:**
- Consumes: Task 2.
- Produces:
  - `ContactsPort` gains `uses(): Observable<ContactUsesById>`, `addContact(draft: ContactDraft): Promise<ResultOf<Added>>`, `editContact(id: string, draft: ContactDraft): Promise<Result>`, `deleteContact(id: string): Promise<Result>`, `addCategory(name: string): Promise<ResultOf<Added>>`, `editCategory(id: string, name: string): Promise<Result>`, `deleteCategory(id: string): Promise<Result>`, `addConnection(contactId: string, draft: ConnectionDraft): Promise<ResultOf<Added>>`, `editConnection(id: string, draft: ConnectionDraft): Promise<Result>`, `deleteConnection(id: string): Promise<Result>`. `Added` moves to `entities/result.ts` beside `Accepted`.
  - `ContactsSimulator extends ContactsPort { currentContacts(): Contact[] }`; `ContactsReaders { uses$: Observable<ContactUsesById>; buildings(): Building[] }`; `createContactsSimulator(seed, wired?: Partial<ContactsReaders>)`. Left out, the readers are the seed's. `composition.ts` builds `uses$` from `contactUsesOf` over the buildings, the supplier links and each period's residents, invoices and entries.

- [ ] **Step 1: Write the failing tests** in the contract: a write emits on `contacts()`; a refusal changes nothing and emits nothing; `addContact` answers an id the list then holds, the number after the highest; a delete takes the contact's rows and every connection on either end; a category delete with contacts is refused; an edit keeps `kind`. In `contactsSimulator.test.ts`: a contact with a resident is refused `is-resident`; `editContact` on an unknown id rejects.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Held in `BehaviorSubject`s. A row of a draft with `id: null` gets `mr-new-<n>`. A delete reads `await firstValueFrom(readers.uses$)`.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(contacts): add, edit and delete contacts, categories and connections`.

### Task 4: One source for a name

**Files:**
- Modify: `packages/domain/src/simulators/unitsSimulator.ts`, `accountsSimulator.ts`, `journalSimulator.ts`, `installmentsSimulator.ts`, `seededParties.ts`, their tests; `packages/client-core/src/composition.ts`.
- Create: `packages/client-core/src/composition.contacts.test.ts`.

**Interfaces:**
- Consumes: Task 3's `ContactsSimulator`.
- Produces: `UnitsReaders` gains `contacts$(): Observable<Contact[]>`. `residents()` combines the held residents with it and answers each with `nameOf` of its contact; `currentResidents()` answers the same. A resident whose `personId` the contacts lack keeps its held name, so small test seeds stay valid. A supplier party's name is read the same way, in Task 5's single rule.

- [ ] **Step 1: Write the failing test,** `composition.contacts.test.ts`, through `createAppHarness`: rename a person who is a resident of p1 with `editContact`; `units.residents("p1")`, `accounts.parties("p1")` and the unit's row in the Units view emit the new name without another subscribe; the installment schedule's row for that resident shows it; the journal view's posting line shows it.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** The accounts simulator already follows `residentsOf` as a stream, so it needs nothing for residents. Check that each presenter that holds parties re-emits, and fix the one that does not.
- [ ] **Step 4: Run** `pnpm gate:full:quiet` and the legacy-import suite with both env vars. Expected: PASS, parity unchanged.
- [ ] **Step 5: Commit** `feat(contacts): a resident's name is its contact's, wherever it is read`.

### Task 5: A building's suppliers

**Files:**
- Modify: `packages/domain/src/ports/buildingsPort.ts`, its contract; `simulators/buildingsSimulator.ts`, `accountsSimulator.ts`, `journalSimulator.ts`, `installmentsSimulator.ts`, `seededParties.ts`; `useCases/validateBuilding.ts`; `packages/client-core/src/composition.ts`, its contacts test.

**Interfaces:**
- Consumes: Task 4.
- Produces:
  - `BuildingsPort.addSupplier(buildingId: string, contactId: string | null): Promise<Result>`, refused `no-contact` or `already-supplier` (detail the contact's name), by `validateSupplier(buildingId: string, contactId: string | null, links: SupplierLink[], name: string): Result`; `removeSupplier(buildingId: string, contactId: string): Promise<Result>`. `suppliers()` emits after each. `BuildingsSimulator` gains `currentLinks(): SupplierLink[]` and `links$`.
  - In `seededParties.ts`, replacing `seededSuppliers` in all three simulators: `periodSuppliers(period: SuppliersInput): SupplierParty[]`, with `SuppliersInput { buildingId; links: SupplierLink[]; invoices: Invoice[]; entries: JournalEntry[]; contacts: Contact[] }`. It answers the building's linked contacts plus any contact with an invoice or a supplier counterpart in the period, each once, by contact id, named by `nameOf`.
  - The accounts, journal and installments simulators each take a `suppliersOf(periodId)` reader wired in `composition.ts`, left out the seed's. The accounts simulator's is a stream, so `parties()` re-emits on a rename, a new link and a new invoice.

- [ ] **Step 1: Write the failing tests** in the contract (add, duplicate refused, remove, emission) and in `composition.contacts.test.ts`:
  - a new link's contact appears in the invoice wizard's supplier choices for that building's periods, and not for the other building's;
  - it adds no row to the Accounts tree, and p1's and p36's tree figures do not move;
  - removing a link with invoices in p36 keeps the supplier in `parties("p36")` with its name, the Accounts tree does not throw, and the journal view still names it (Review Focus 5);
  - removing a link with nothing posted takes it out of the wizard's choices;
  - a renamed supplier shows its new name in the Accounts tree and the Journal (Review Focus 1).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Links start from `seed.supplierLinks`. Break the wiring cycle with closures, as `composition.ts` already does between the journal and the installments.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`, and the legacy-import suite with both env vars. Expected: PASS, parity unchanged.
- [ ] **Step 5: Commit** `feat(suppliers): add and remove a building's suppliers, and one rule for a period's suppliers`.

### Task 6: The contacts presenter

**Files:**
- Create: `packages/client-core/src/presenters/contactsPresenter.ts` and test; `packages/client-core/src/paging.ts` and test.
- Modify: `machines/journalGridMachine.ts` (takes `PageSize`, `PAGE_SIZES` and the page arithmetic from `paging.ts`), `composition.ts`, `index.ts`, `screens.ts` (`GridName` + `"contacts" | "connections"`, `SplitName` + `"contacts"`, `TabbedPanelName` + `"contacts"`).

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - `paging.ts`: `PageSize`, `PAGE_SIZES`, `pageCountOf(total: number, size: PageSize): number` (at least 1), `pageOfIndex(index: number, size: PageSize): number`, `clampPage(page: number, pageCount: number): number`.
  - `interface ContactsView { filter: ContactFilter; typedKeyword: string; categories: CategoryCount[]; allCount: number; rows: ContactView[]; page: number; pageSize: PageSize; pageCount: number; total: number; selected: ContactView | null; uses: ContactUsesView | null; connections: ConnectionView[] }`, with `CategoryCount { category: ContactCategory; count: number }`, `ContactUsesView` the four lists as building names, `ConnectionView { connection: ContactConnection; connected: ContactView }` by order.
  - `createContactsPresenter(ports: { contacts: ContactsPort; buildings: BuildingsPort })` with `view$: Observable<ContactsView | null>` and intents `typeKeyword(text)`, `search()`, `setFilter(patch: Partial<Omit<ContactFilter, "keyword">>)`, `reset()`, `setPage(page)`, `setPageSize(size)`, `select(id)`, `reveal(id)`. `reveal` shows the page holding the contact, selected; a filter that hides it goes back to `ALL_CONTACTS` first.

- [ ] **Step 1: Write the failing tests** (harness over the real seed):
  - 113 contacts, 12 pages at 10; the first row selected; page size 25 gives 5 pages and page 1;
  - unticking Companies lists 81, and goes back to page 1 from page 3;
  - a typed keyword filters nothing until `search()`; a category applies at once, and its count does not follow the other filters;
  - Building `c19` lists its residents, suppliers, and anyone on its invoices or entries;
  - `reset()` restores everything, the typed keyword included;
  - selecting a row a filter then hides selects the first row; nothing listed gives `selected: null`;
  - deleting the only contact of the last page lands on the page before, with a selection (Review Focus 4);
  - a renamed contact moves page and stays selected through `reveal` (Review Focus 1);
  - a selected contact's `uses` and `connections` follow it.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS, the Journal's tests unchanged.
- [ ] **Step 5: Commit** `feat(contacts): the contacts presenter: filters, categories, paging and selection`.

### Task 7: The dialogs' machines

**Files:**
- Create: `packages/client-core/src/machines/contactDialogMachines.ts` and test.
- Modify: `machines/buildingDialogMachines.ts`, `composition.ts`, `index.ts`.

**Interfaces:**
- Consumes: Task 2's validators, Task 3's and Task 5's ports, `createFormDialog`.
- Produces, in `AppMachines`:
  - `createContactDialog(spec: ContactDialogSpec, onAdded: (id: string) => void)`, with `ContactDialogSpec = { kind: "person" | "company"; editing: Contact | null }`. The form holds every field as typed, its addresses (`Address | null`) and its `rows: ContactRowDraft[]`, with `removeRow(index)`, `applyRow(index: number | null, row)` among its intents and `nextOrder` in its state. A new contact starts Active on `salutations[0]`. `kind` is fixed.
  - `createContactRowDialog(row: ContactRowDraft | null, nextOrder: number, apply: (row: ContactRowDraft) => void)`, which writes nothing, as `createAddressDialog`. A new row starts on `nextOrder` and Phone; changing the type changes a label still equal to the previous type's usual label.
  - `createCategoryDialog(editing: ContactCategory | null, onAdded)`; `createConnectionDialog(contactId: string, editing: ContactConnection | null)`, whose new row starts on the next free order; `createSupplierDialog(buildingId: string)`.

- [ ] **Step 1: Write the failing tests:** New Person has `canSave` false until Last name is filled; "Edit" on a company keeps `kind`; a row added, edited and removed changes nothing in the port until save, then saves in one `editContact` call; Cancel, by not saving, leaves the port as it was; a taken code gives the `contact-code-taken` verdict as typed; a new contact's `onAdded` gets its id; changing a new row's type to Email changes its label to "Email", and a label the person typed stays.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** `parseDate` reads the birth date as the other dialogs read dates, in the current year when typed without one.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(contacts): the contact, row, category, connection and supplier dialogs' machines`.

### Task 8: The screen: filters, categories, list and tabs

**Files:**
- Create:
  - `packages/client-react/src/ui/shell/SidebarFrame.tsx`;
  - `packages/client-react/src/ui/contacts/`: `FiltersSidebar.tsx`, `ContactFilters.tsx`, `ContactCategories.tsx`, `ContactsScreen.tsx` (thin reader), `ContactsPanel.tsx`, `ContactDetails.tsx`, `ConnectedContacts.tsx`, `columns.ts`, `labels.ts`, CSS, page objects and tests.
  - `packages/client-react/src/ui/Paging.tsx`, moved from `ui/journal/JournalPaging.tsx`.
- Modify:
  - `ui/shell/Sidebar.tsx` (its frame moves out), `Rail.tsx` (`label`, `title` props), `AppRoot.tsx`, `Screen.tsx`, `Sidebar.test.tsx` and `TopBar.test.tsx` (their placeholder example becomes Calendar);
  - `ui/contactLabels.ts`, `packages/react-bindings/src/createViewModel.ts` (`useContactsScreen`, `useContactsGrid`, `useConnectionsGrid`), its page and test;
  - `testids.ts`, `architecture.config.mts` (`compilerTracked`: `ContactsPanel`).

**Interfaces:**
- Consumes: Task 6's view and intents; `sidebarMachine` as it stands.
- Produces: `SidebarFrame({ width, open, maximized, railLabel, railTitle, onResize, onOpen, onClose, onRestore, children })`. `AppRoot` draws `Sidebar` for buildings and `FiltersSidebar` for contacts on the same machine. Print, PDF, Excel, `⟳` and Legend show the "not yet available" notice. `+ ▾`, `✎`, `−`, and the categories' `+ ✎ −` show the notice until Tasks 9–11 replace them.

- [ ] **Step 1: Write the failing tests** through page objects: the screen lists 10 of 113 with "Page 1 of 12 · 113 contacts total"; clicking a company shows COMPANY DATA and a person PERSONAL DATA; a contact with a resident shows RESIDENT OF and a contact with none leaves that fieldset out, while SUPPLIER OF THE FOLLOWING BUILDINGS shows "- None -"; an archived contact shows the archive icon; a typed keyword applies on Search and on Enter; Reset restores the list; a category filters at once; Connected Contacts shows "No connected contacts." and, on the seeded contact, its one row; below 1180px the rail reads FILTERS and opens the drawer; the sidebar keeps its width across the two modules.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** `✎` and `−` of categories are disabled on "- All -". `TreeGrid` draws the flat list, as `BuildingSuppliers` does.
- [ ] **Step 4: Run** `pnpm gate:full:quiet` and `pnpm visual`. Expected: PASS, goldens unchanged except where the Contacts placeholder was pictured; look at each that differs.
- [ ] **Step 5: Commit** `feat(contacts): the Contacts screen: filters, categories, list, details and connections`.

### Task 9: Categories on screen

**Files:**
- Create: `ui/contacts/CategoryDialog.tsx`, `contactReasons.ts` and test, page object and test.
- Modify: `ContactCategories.tsx`, `ContactsScreen.tsx`, `createViewModel.ts` (`useCategoryDialog`), `testids.ts`.

**Interfaces:**
- Consumes: Task 7's `createCategoryDialog`, `ConfirmAlert`, `FormDialogFrame`.
- Produces: `contactReasonText(reason: Rejected, name: string): string`, covering every code in Global Constraints, with an exhaustive test over the list. A new category is selected when it saves.

- [ ] **Step 1: Write the failing tests:** a taken name shows "Another category is named {name}"; `−` on a category with contacts asks, then shows "Move its {n} contacts to another category first."; a category moved to 0 by editing its last contact shows 0 and can be deleted, with the selection going back to "- All -".
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(contacts): add, edit and delete categories`.

### Task 10: Connected contacts on screen, and the picker moves

**Files:**
- Create: `ui/contacts/ConnectionDialog.tsx`, page object and test.
- Move: `ui/units/ContactPicker.tsx`, `.css`, `.page.tsx`, `.test.tsx` to `ui/contacts/`.
- Modify: `ConnectedContacts.tsx`, `OwnerDialog.tsx`, `ContactPicker.tsx` (offers active contacts only, while the contact it holds stays shown), `createViewModel.ts` (`useConnectionDialog`), `testids.ts`.

**Interfaces:**
- Consumes: Task 7's `createConnectionDialog`.

- [ ] **Step 1: Write the failing tests:** Add starts on the next free order; choosing the contact itself shows "A contact cannot be connected to itself"; an added row shows on this contact and not on the other; `−` asks "Remove {name} from this contact?"; an archived contact is not offered by the picker, and an owner already on an archived contact still shows its name.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(contacts): add, edit and delete connected contacts; pickers offer active contacts`.

### Task 11: The person and company dialogs, and delete

**Files:**
- Create: `ui/contacts/ContactDialog.tsx` (reader), `PersonFields.tsx`, `CompanyFields.tsx`, `ContactRowsField.tsx`, `ContactRowDialog.tsx`, `AddressField.tsx`, page object and tests.
- Modify: `ContactDetails.tsx`, `ContactsScreen.tsx`, `createViewModel.ts` (`useContactDialog`, `useContactRowDialog`), `testids.ts`, `architecture.config.mts` (`compilerTracked`: `ContactRowsField`).

**Interfaces:**
- Consumes: Task 7's machines, the existing `AddressDialog`, Task 9's `contactReasonText`, Task 6's `reveal`.
- Produces: `ContactDialog({ spec, onAdded, onSaved, onCancel })`, which Task 12 opens from the picker. `AddressField({ label, address, onChange })` draws `✎ ⊖ value` and opens `AddressDialog` over its own dialog. After a save the contact is revealed.

- [ ] **Step 1: Write the failing tests:**
  - New Person with a blank Last name keeps the button disabled; saved, the person is selected in the list;
  - a code of 16 characters shows "A code has at most 15 characters";
  - a row added through Add Contact shows in the form and on the sheet after Save, and Cancel on the person drops it;
  - `⊖` on an address clears it;
  - Edit Company shows Company name, Registered office and Tax domicile, and no Gender;
  - Status set to Archived shows the archive icon;
  - `−` on a resident asks "Delete {name}? This cannot be undone.", then shows "{name} is a resident of Saturno, so it cannot be deleted. Archive it instead.", and the row stays;
  - `−` on an unused contact removes it and selects the first row;
  - Review Focus 3: with three dialogs open, Escape closes only the top one, and focus returns to the button that opened it.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Follow the scroll and label sizes of `OwnerDialog` and the prototype's Edit Person; the legacy screenshot `01 anagrafiche 04` and `05` give the order of the fields.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(contacts): add, edit and delete people and companies, with their rows and addresses`.

### Task 12: Create in place, and Building Suppliers

**Files:**
- Create: `ui/buildingData/SupplierDialog.tsx`, page object and test.
- Modify: `ui/contacts/ContactPicker.tsx`, its page and test; `ui/units/OwnerDialog.tsx`, `UnitsDialogs.test.tsx`; `ui/buildingData/BuildingSuppliers.tsx`, `BuildingDataPanel.tsx`, `BuildingDataScreen.tsx`, their tests; `createViewModel.ts` (`useSupplierDialog`), `testids.ts`.

**Interfaces:**
- Consumes: Task 7's `createSupplierDialog`, Task 11's `ContactDialog`.
- Produces: `ContactPicker` gains `onCreated(id)`-driven buttons, drawn by a `creating: boolean` prop: New company, New person, Edit, Clear. It opens `ContactDialog` over the dialog it sits in, as a local "which dialog is open" state, and sets `value` to the new contact. With `fixed`, only Edit shows. The Connection dialog passes `creating={false}`.

- [ ] **Step 1: Write the failing tests:**
  - in Add Owner, New person, saved, chooses the new contact in the field; Cancel on that dialog changes nothing;
  - Review Focus 2: New person saved, then Cancel on Add Owner: the contact is listed in Contacts, the unit has no new owner, and focus is back where it was;
  - Edit opens on the chosen contact, and a rename shows in the field;
  - Edit Owner shows Edit and not New;
  - Building Suppliers `+` adds a chosen contact to the list; a duplicate shows "{name} is already a supplier of this building";
  - `✎` opens Edit Company on the selected supplier; `−` asks, then removes it from the list and the contact stays in Contacts;
  - the supplier sheet shows every row, a Fax among them;
  - the notice "Suppliers are edited in Contacts…" is gone.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(contacts): create a contact in place; add, edit and remove a building's suppliers`.

### Task 13: Goldens and the end-to-end spec

**Files:**
- Modify: `packages/client-react/tests/visual/scenarios.ts`, `registry.tsx`, `seeding.ts`; goldens; `packages/e2e/src/testing/test.ts`.
- Create: `packages/e2e/src/sim/contacts.spec.ts`, `packages/e2e/src/pages/Contacts.page.ts`.

- [ ] **Step 1: Add the scenarios.** Pages: `contacts-1280-light`, a company selected; `contacts-1920-dark`. Components: `contact-filters`, `contact-categories`, `contacts-list-archived`, `contact-details-person`, `contact-details-company`, `connected-contacts`, `contact-dialog-person`, `contact-dialog-company`, `contact-dialog-refused`, `contact-row-dialog`, `category-dialog-taken`, `connection-dialog`, `supplier-dialog`, `contact-picker-buttons`, `building-suppliers-rows`.
- [ ] **Step 2: Run** `pnpm visual:update`, open every new image and check it shows what its name says; `git status` lists only those, plus `building-suppliers` and `owner-dialog-*` where the sheet's rows and the picker's buttons meant a change. Say why each changed golden changed.
- [ ] **Step 3: Write the e2e spec** on the simulator: find a contact by keyword, rename it, and see the new name on Units; from Add Owner, add a person and see the owner on the unit. Run `pnpm e2e --mode sim`. Expected: PASS.
- [ ] **Step 4: Run** `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 5: Commit** `test(visual): Contacts scenarios; e2e: rename a contact and add one in place`. The controller redraws the linux-x64 set.

### Task 14: STATUS and the parent design

**Files:** `docs/STATUS.md`, `docs/superpowers/specs/2026-10-11-app-v2-design.md`.

- [ ] **Step 1:** In STATUS: remove "Edit a building's suppliers"; in "The rest of the Buildings module for M2" leave only Calendar and say M2g is built; keep the "Linked Accounts" and default-contra entries; add to "Presenter robustness" that the contacts simulator's `uses$` recomputes on every change of any period's books, and that a live adapter answers it with one query; add to Known limits that contacts of the nine unseeded buildings show no building and can be deleted in the simulator. Set "Last updated".
- [ ] **Step 2:** In the parent design, the M2 row says Contacts is built, and the Ports table lists `ContactsPort`'s reads and writes, `uses()` among them.
- [ ] **Step 3: Run** `pnpm check:status`, `pnpm check:doc-links`, `pnpm gate:full:quiet`. Expected: PASS.
- [ ] **Step 4: Commit** `docs: STATUS and the parent design after M2g`.
