# M2g — Contacts — design

Part of M2 in the parent design,
[2026-10-11-app-v2-design.md](2026-10-11-app-v2-design.md): "… → Building
Data & Units → Contacts → Calendar". Written the way M2e and M2f were: from the
legacy application's code and screenshots, the design prototype and the data.

## Intent

The Contacts tab is a placeholder. Everywhere else in the app a contact is
only something to pick: Add Owner picks from those the app knows, and Building
Suppliers shows them read-only with a notice that they are edited in Contacts.

The administrator needs one place to find a person or a company, see what they
are to which building, correct their details, add a new one and retire an old
one. A corrected name has to be right everywhere at once. That is the whole
point of a registry, and today the app copies names around.

## Sources

- **The legacy app:** `old/flex/src/it/jtime/components/view/masterData` with
  its condominium overrides in `condominium/view/masterData`, the server in
  `old/flex/php/services/it/jtime/components/MasterDataDAO.php`, and the
  screenshots `old/screenshots/beta/01 anagrafiche 01…09`. A contact is
  `masterData` there, with `person` and `company` beside it.
- **The prototype:** `docs/design/web/v1/README.md` section 8, the Filters
  sidebar and Edit Person; `Condomini.dc.html`. It is the look. Most of its
  Contacts buttons do nothing, and it draws only one edit dialog.
- **Where they differ**, the legacy app decides what the screen does and the
  prototype how it looks. The prototype's "pending" status icon is the legacy
  app's Archived: the legacy status list and the database have only active and
  archived.

The screenshots and `old/` hold real names and are not in git. Nothing of
them goes into a spec, a test or a golden.

## What the data holds

From the dump the seed is built from (`it-jtime-condominium.all.sql`):

| | Dump | Seed today |
|---|---|---|
| Contacts | 113: 81 people, 32 companies; 111 active, 2 archived | 48 |
| Categories | 34, 19 in use | names only, on the contact |
| Phone, email and web rows | 47 on 19 contacts; 15 contacts have two or more | the first phone and first email |
| Connected contacts | 1 row | none |
| Contacts with a code | 29, all different | 20 |
| Used by nothing at all | 4 | 0 |

Most contacts hold a name, a category and a salutation, and little else. The
screens must read well for a contact with almost nothing filled in.

## Scope

In:

- The Contacts screen: filters, categories, the paged list, the Contact
  Details and Connected Contacts tabs.
- Add, edit and delete a person or a company, with phone, email and web rows.
- Add, edit and delete a category.
- Add, edit and delete a connected contact.
- Building Suppliers becomes editable: add and remove a supplier, edit its
  contact.
- The contact picker creates and edits a contact in place.
- One source for a contact's name: a rename reaches every screen.
- The seed grows to every contact in the dump, with the fields below.

Out:

- **Linked Accounts**, and with it the Account role filter. They are sign-in:
  logins, passwords, profiles, activation mail. They arrive with M3 and its
  real sign-in, as does the legacy refusal to delete the contact you are signed
  in with. `docs/STATUS.md` keeps them under M3.
- **Variations** (dated history of a contact). The tables are empty and the
  prototype does not show them.
- **Bank coordinates, occupation, middle name, citizenship.** No row in the
  dump uses them, and the prototype does not show them.
- **File attachments, emailing a form, fiscal treatments.** Not reachable in
  the final condominium app.
- **Address autofill** from the tables of Italian places, and the province,
  region and country fields. An address here stays what Buildings already
  uses: street, postcode, city.
- **Print, PDF and Excel.** They were switched off in the final legacy source.
  The buttons are drawn and say "not yet available", as on the Journal.
- **Merge and duplicate detection.** Neither source has them.
- **Selecting several rows at once, and sorting by column.** One row, by name.
  The prototype has neither. *(My call.)*

## The screen

Module tab Contacts, breadcrumb `Contacts`. The Filters sidebar takes the
place of the Management sidebar. It is the same frame with other content, on
the same `sidebarMachine`: one width and one open state, shared by both, so the
drag and the compact-mode drawer come with it. Its rail reads FILTERS. To its
right, the
Contact List above and a two-tab panel below, with a splitter and the maximize
of the other screens.

### Filter Contacts

Checkboxes **Natural persons** and **Companies**, both ticked; **Keyword**;
**Building** ("- All -", then each building); **Status** ("- All -", Active,
Archived); **Search** and **Reset**.

- Keyword holds what is typed and applies on Search or Enter. A checkbox, a
  select or a category applies at once. *(My call: the legacy app mixed the
  two; this is what the buttons in the design imply.)*
- Keyword matches, as "contains", ignoring case and accents: code, first name,
  last name, company name, tax code, VAT number.
- Neither checkbox ticked lists nothing, with "No contact matches."
- Building lists a contact who is a resident of any of its periods, a supplier
  of it, on an invoice of it, or the counterpart of a journal posting of it.
- Reset ticks both boxes, empties Keyword, sets both selects to All and the
  category to All.
- Any change of filter goes back to page 1.

### Contact Categories

A card under the filters: toolbar `+ ✎ −`, a spacer, `⟳`; then "- All -" with
the total, then each category with its count, by name, the empty ones included.
The counts are of all contacts and do not follow the other filters.

- Selecting a row filters the list. `✎` and `−` are disabled on "- All -".
- `+` and `✎` open **Add Category** and **Edit Category**: Name\*, at most 63
  characters. Refused: blank; the name of another category, ignoring case.
- `−` asks to confirm. Refused while a contact is in the category, with
  "Move its {n} contacts to another category first."
- The legacy category also has a code and an order. Neither is shown anywhere
  and the list is by name, so neither is kept. *(My call.)*
- `⟳` says "not yet available", as on the Journal.

### Contact List

Toolbar: the paging group `« ‹ › »`, Print, PDF and Excel stubs, then on the
right "Page 1 of 12 · 113 contacts total", the page size and `⟳`. Page sizes as
the Journal's: 10, 25, 50, 100; 10 by default.

Grid: `Name / Company | Code | Type | St. | Reference address | Tax code | VAT
no. | Lng. | Category`, by name then id. Code mono; Type an icon for person or
company; St. the check for Active, the archive icon for Archived; Lng. a flag
when a language is set. A column with nothing shows `---`.

**Reference address:** for a person, office, else residence, else domicile,
else postal; for a company, registered office, else tax domicile, else postal.

The first row is selected on opening. When the selected row leaves the list,
through a filter, a page or a delete, the first row of the page is selected.
With no row, the panel below says "No contact matches."

### Contact Details tab

Toolbar: `+ ▾` (New person, New company), `✎`, `−`, the stubs, the Legend.

The sheet: Contact type, Status, Code. Then one of:

- PERSONAL DATA: First name, Last name, Gender, Birth date, Birth place,
  Office address, Residence address, Domicile address.
- COMPANY DATA: Company name, Registered office, Tax domicile.

Then CONTACTS, every row as label and value, in order. Then SUPPLIER OF THE
FOLLOWING BUILDINGS, or "- None -". Then RESIDENT OF, ON INVOICES OF and IN
ENTRIES OF, each shown only when it has a building. *(My call: the prototype
draws one list, the legacy sheet four. The other three are what stops a delete,
so the person should be able to see them.)* Then USEFUL DATA: Salutation, Tax
code, VAT number, Category, Postal address, Language. Then NOTES.

### Connected Contacts tab

Toolbar `+ ✎ −`. Grid: `Order | Relationship | Name | Code | Type | St. |
Reference address | Tax code | VAT no.`, by order. "No connected contacts."
when empty.

A connection belongs to the contact it is shown on, as in the legacy app: it
says that another contact is, for this one, its "Managing director", say. It
shows on this contact only, not on the other.

**Add** and **Edit Connected Contact**: Contact\* (the picker, without its
create buttons), Relationship\* (free text, at most 127 characters), Order\*
(a whole number from 1; a new row starts on the next free one). Refused: no
contact; the contact itself; the same contact with the same relationship
twice. `−` asks to confirm.

## Person and company dialogs

**Add** and **Edit Person**, width 560:

- Status\* (default Active), Code.
- PERSONAL DATA: First name, Last name\*, Gender (Male, Female, Unspecified),
  Birth date, Birth place, Office address, Residence address, Domicile address.
- CONTACTS, with `⊕` on the legend: each row with `✎ ⊖`.
- USEFUL DATA: Salutation, Tax code, VAT number, Contact category, Postal
  address, Language.
- NOTES.

**Add** and **Edit Company**, which the prototype does not draw, the same frame:
Status\*, Code; COMPANY DATA: Company name\*, Registered office, Tax domicile;
then CONTACTS, USEFUL DATA and NOTES as above. A contact's type does not change
once it exists.

An address opens the existing Address dialog and has `⊖` to clear it. Birth
place is plain text, because it is a town rather than a street. *(My call.)*
Salutation is a select of the nine legacy salutations, in English, or none; a
new contact starts on the one 104 of the 113 contacts use. Language is a select
of Italian and English, or none. Contact category is a select, or none.

**Refused:**

- Last name or Company name blank.
- Code longer than 15 characters, or the code of another contact, ignoring
  case. A blank code is allowed. Codes are typed: nothing generates one.
- A birth date that is not a date.

As in the legacy app, a tax code and a VAT number have no format check.

### Contact rows

The nested **Add** and **Edit Contact** dialog, width 460: Order\*, Contact
type\* (Phone, Email, Website, Instant messaging, Certified email), Label\*,
Value\*. A new row starts on the next free order, with the type's usual label.
Order is a whole number from 1. The rows belong to the form: nothing is written
until the person dialog is saved, as with an address. `⊖` removes a row without
asking, as Cancel on the dialog brings it back.

## Delete

`−` on Contact Details asks to confirm, naming the contact: "Delete {name}?
This cannot be undone."

Refused, with a sentence that says why and what to do, while the contact is:

- a resident of a unit in any period;
- a supplier of a building;
- on an invoice;
- the counterpart of a journal posting.

For example: "{name} is a resident of Saturno, so it cannot be deleted. Archive
it instead." The legacy app left this to the database and showed its raw error.

A delete takes the contact's rows and every connection on either end with it.

The legacy app also held a contact as an account's default contra. The app's
accounts have no such field yet (Account Details shows "from parent"), so that
use cannot stop a delete until they do. `docs/STATUS.md` keeps it as a known
limit.

Archiving is an edit of Status. An archived contact stays where it is used and
shows the archive icon in the list. The pickers offer active contacts only; the
contact already on an owner or a supplier stays shown. *(My call: the legacy
picker offered archived contacts too.)*

## Building Suppliers

The tab's `+ ✎ −` stop showing their notice:

- `+` opens **Add Supplier**: Contact\*, the picker with its create buttons.
  Refused: no contact; already a supplier of this building.
- `✎` opens Edit Person or Edit Company for the selected supplier.
- `−` asks to confirm, then removes the link, not the contact. A supplier with
  invoices in the building can be removed: it stops being offered for a new
  invoice, and its existing invoices and postings stay and keep its name.

The supplier sheet shows every contact row, as the legacy one did, not only
the first phone and email.

A new invoice's Supplier list is the period's suppliers, as M2b built it: the
building's suppliers, plus anyone with an invoice or a posting in the period.
So a company has to be a supplier of the building before it can be invoiced
there, and Add Supplier is one step away. The legacy field searched every
contact, owners included. *(My call: nobody in the data is both an owner and a
supplier, and a short list is the better picker. It is the one change from
the legacy app here that a person will feel.)*

## The contact picker

`ContactPicker`, in Add Owner and Add Supplier, gains the legacy buttons beside
the field: **New company**, **New person**, **Edit**, **Clear**. New opens the
add dialog over the one that is open, and the new contact is chosen when it
saves; Cancel changes nothing. Edit needs a chosen contact. Edit Owner keeps
the contact fixed, as M2f did, and offers Edit only.

## Domain

**`Contact`** becomes a union on `kind`, with what both share:

- `id`, `status`, `code`, `categoryId` (`string | null`), `salutation`,
  `taxCode`, `vatNumber`, `postalAddress`, `language` (`"it" | "en" | null`),
  `notes`, `rows: ContactRow[]`.
- A person: `firstName`, `lastName`, `gender` (`"m" | "f" | null`),
  `birthDate`, `birthPlace`, `officeAddress`, `residenceAddress`,
  `domicileAddress`.
- A company: `companyName`, `registeredOffice`, `taxDomicile`.

`nameOf(contact)` gives what `name` holds today: last name then first name for
a person, the company name for a company. `phone` and `email` go; their readers
take the rows. `referenceAddressOf(contact)` is the rule above.

**`ContactRow`**: `id`, `type` (`"phone" | "email" | "web" | "im" | "pec"`),
`label`, `value`, `order`. **`ContactCategory`**: `id`, `name`.
**`ContactConnection`**: `id`, `contactId` (the contact it shows on),
`connectedId`, `relationship`, `order`.

Validators, pure, in `useCases`, with the Units validators' shape:
`validateContact`, `validateContactRow`, `validateContactDelete`,
`validateCategory`, `validateCategoryDelete`, `validateConnection`.

`validateContactDelete` takes where the contact is used: **`contactUsesOf`**, a
pure use case over the residents, supplier links, invoices and journal entries
of every period. It answers the four lists of buildings the sheet shows and the
Building filter reads. A supplier counterpart's id is the contact's. An owner
counterpart's id is a residency's, so it reaches the contact through that
resident's `personId`. That can only add to IN ENTRIES OF, never to the
refusal, because the residency already stops the delete.

**Ids.** A contact keeps the seed's form, `md<n>`; a new one takes the next
number. A supplier's party id and its counterpart id are its contact's id, as
now, so a new supplier works with no mapping.

## Ports

**`ContactsPort`** keeps `contacts()` and gains `categories()`,
`connections(contactId)`, and the writes `addContact(draft)`,
`editContact(id, draft)`, `deleteContact(id)`, `addCategory`, `editCategory`,
`deleteCategory`, `addConnection`, `editConnection`, `deleteConnection`.
`addContact` answers the new id. Each write is judged by its validator, and the
reads emit again after an accepted one.

**`BuildingsPort`** gains `addSupplier(buildingId, contactId)` and
`removeSupplier(buildingId, contactId)`.

**One source for a name.** A party's name is the contact's name when it is
read. Journal entries and invoices already hold ids, so they need no change.
This is new work, not a reuse. `unitsSimulator` reads `contactsOf()` once, when
a resident is added, and `residents$` is held and seeded once, so a rename
emits nothing. `residents()` has to combine the held residents with the
contacts, and `AccountsPort.parties()` has to emit on a rename too. The
accounts, journal and installments simulators each keep `seededSuppliers` today,
and all three must read the same names. The name in the seed's parties is then
a detail of the generator that no reader sees.

The contacts simulator owns the contacts. It needs the other ports' data to
judge a delete, and they need its names, so they meet through readers wired in
`composition.ts`, the way `UnitsReaders` already does.

**Suppliers of a period.** One rule, in one place, read by the accounts, journal
and installments simulators: a period's suppliers are the building's supplier
links, plus any contact with an invoice or a supplier posting in that period.
The links live in the buildings simulator, starting from `seed.supplierLinks`,
so any of them can be removed. A removed supplier with nothing in a period
leaves that period's list; one with postings stays, so its past entries keep
their name. The Building Suppliers tab shows the links alone.

A supplier with nothing posted adds no row to the Suppliers account in the
Accounts tree, and no seeded figure moves.

## Core and client

- A **contacts presenter** owns the list: filters, category, paging, selection,
  and the sheet's contact with its uses and connections. It also resolves
  `categoryId` to a name for the screens that show one. The filtering and the
  matching are pure functions in `packages/domain/src/useCases/contacts`.
- The page sizes and paging come from the Journal's. Share them rather than
  repeat them, and name the shared part for what it is.
- Dialog machines follow `unitDialogMachines.ts`, on `createFormDialog`. The
  contact form holds its rows and its addresses, so `saveNow` writes the whole
  draft in one call.
- `ui/contacts/` holds the screen and its dialogs. `AppRoot` draws the Filters
  sidebar for the contacts module, on the same frame as `Sidebar`, with the
  rail's label as a prop. `ContactPicker` moves from `ui/units/` to
  `ui/contacts/` now that it has two owners, and `shell/Screen.tsx` routes the
  module. A screen reads the view model and hands plain props down, as the
  others do.
- `Dialog` already stacks: a key in an inner dialog is that dialog's alone, and
  the focus returns when it goes. Address over Edit Building proves two levels;
  this needs three.
- Reason words go in a `contactReasons.ts`, as `unitsReasons.ts`.

## Seed

`projectContacts` takes every row of `masterData`, not only the parties of the
two seeded buildings: the 113, the archived and the four with no studio
included. It adds the fields above, every contact row, every category
(`contactCategories`), the salutations and the connected-contact row
(`contactConnections`). Its `from` and `to` map as in the legacy tab: `to` is
the contact it shows on.

- Translate the labels (Telefono → Phone, Sito Web → Website, Cellulare →
  Mobile, Numero verde → Toll-free), the nine salutations and every category
  name not yet translated, in `translate/exact.ts`. The three rows
  with test labels are kept as they are, as data.
- `pseudonymise` already rewrites these tables. The privacy test must cover
  every new field, and must fail on a planted name, street or phone.
- `gen:data`, then the oracle fixtures, must change nothing else: the books,
  the parties and the allocations stay byte-identical. Only `contacts`,
  `contactCategories`, `contactConnections` and `salutations` change. A failure
  here means a fault in the projection, not a fixture to redraw.
- `supplierLinks` stays the two seeded buildings'. The nine unseeded buildings
  are not in the app, so their contacts show "- None -", appear under no
  Building filter, and can be deleted because nothing in the seed uses them.
  That is a limit of the seed, not a rule.

## Tests

- Validators and `contactUsesOf`: every refusal, and a value on each boundary:
  a 15 and a 16 character code, a code that differs only in case, a blank code,
  the last contact in a category.
- The contacts port's contract: lists, each write, emission after a write, a
  refusal changing nothing, a delete taking rows and both ends of connections.
  It runs against the simulator.
- Across simulators: a rename reaches a resident, a supplier, and the parties
  of the journal and the installments; a new supplier link reaches the invoice
  wizard's choices and adds no row to the Accounts tree; a removed link leaves
  past postings named, and takes a supplier with nothing posted off the list.
- The presenter: filter combinations, the Building filter's four meanings,
  paging at the edges, selection following a filter and a delete.
- Components through page objects: the screen, each dialog, the sidebar in
  compact mode, the picker's buttons.
- Legacy-import: the projection, the counts in the table above, the privacy
  test, the unchanged parts of the seed.
- Visual goldens: filters and categories (component); the list and each tab
  (section); the whole screen at the sizes used elsewhere, and each dialog.
- End to end, one spec in `packages/e2e/src/sim`: find a contact, rename it, and
  see the new name on Units; add a person from Add Owner.

## Review focus (what a person would expect)

1. A renamed contact is right on Units, Building Suppliers, the Journal, the
   Installment Schedule and every wizard, with no reload. A name the list sorts
   by moves to its new place, and stays selected.
2. Save a new person from Add Owner, then Cancel the owner: the contact exists,
   nothing else changed, and the owner dialog is gone cleanly.
3. A dialog over a dialog over a dialog (Add Owner → New person → Add Contact
   row): Escape and Tab act on the top one only, and focus comes back to the
   button that opened it.
4. Deleting the last contact on the last page, or filtering down to nothing,
   leaves a sensible page and selection, never an empty grid on "page 3 of 2".
5. A category at 0 after its last contact moves shows 0 and can be deleted; the
   count changes at once.
6. Accents and case in search: "citta" finds "Città"; a keyword with only spaces
   finds everything.
7. A long company name or address: the grid cuts it with a tooltip, the sheet
   wraps it.

## Calls to check

Mine, not yours, unless you say otherwise:

1. The invoice's Supplier list stays the building's suppliers, where the legacy
   field searched every contact.
2. Pickers offer active contacts only.
3. Keyword applies on Search or Enter; everything else applies at once.
4. The sheet shows four lists of buildings, not the prototype's one.
5. Office address stays on the sheet and in the person dialog, though the
   prototype leaves it out: it is the first choice for the Reference address.
6. A category keeps only its name.
7. Birth place is plain text.
8. A connection shows on one contact only, as in the legacy app.
9. No multi-select and no column sorting.
10. Page sizes are the Journal's (10, 25, 50, 100), not the legacy 10, 20, All.

## What is left to the builder

The order of the work; the split between presenter and machines; the exact
wording of a sentence that does not appear above; the icons within the design's
set; how the sidebar's width is shared between the two sidebars, provided
neither loses it.
