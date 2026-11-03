# M2h — Calendar — design

Part of M2 in the parent design,
[2026-10-11-app-v2-design.md](2026-10-11-app-v2-design.md): "… → Contacts →
Calendar", the last screen of M2. Written the way M2e to M2g were: from the
legacy application's code and screenshots, the design prototype and the data.

## Intent

The Calendar tab is a placeholder. An administrator runs several buildings,
and each one has dates that cannot slip: installments the owners must pay,
supplier invoices the building must pay, insurance renewals, boiler
inspections, assemblies. Today they are scattered across the Installment
Schedule and the Journal of each period, or not in the app at all.

The Calendar puts them on one month, for every building or one, and says at a
glance what is done, what is coming and what is late. Most of these dates are
already in the books. They must come from there, live: a deadline that has to
be ticked off by hand next to the payment that settled it is a second record
that drifts.

## Sources

- **The legacy app:** the generic calendar in
  `old/flex/src/it/jtime/components/view/calendar` (month view, day list,
  details, add and edit popups) and its model and VOs beside it; the server in
  `old/flex/php/services/it/jtime/components/CalendarDAO.php`, overridden by
  `old/flex/php/services/it/jtime/condominium/CondominiumCalendarDAO.php`,
  which adds the deadlines worked out from the books; the hard-coded calendars
  in `old/flex/src/it/jtime/condominium/helpers/MainHelper.as:470-485`. The
  condominium build is pictured in
  `old/screenshots/presentazione Davide/01 - calendario.png`.
- **The prototype:** `docs/design/web/v1/README.md` section 1 and
  `Condomini.dc.html`. It is the look. Its data is drawn by hand, and it draws
  no dialog for a deadline.
- **Where they differ**, the legacy app decides what the screen does and the
  prototype how it looks. The prototype's calendar colours win over the legacy
  ones.

The screenshots and `old/` hold real names and are not in git. Nothing of them
goes into a spec, a test or a golden.

## What the legacy app did

- **One month on screen.** Monday first. A day lists its deadlines, each a line
  in its calendar's colour with a status mark. Clicking a day lists its
  deadlines on the right; the selected one shows its details and notes below.
  Week and List were drawn and disabled.
- **Deadlines worked out from the books**, computed by the server every time,
  never stored:
  - every installment's due date, closed once the deposits cover it;
  - every supplier invoice's due date, closed once nothing is left to pay; an
    invoice with no due date was taken as due 30 days after its date.

  They could not be edited or deleted; the buttons silently did nothing.
- **Hand-entered deadlines:** a description (required), a date (required, no
  time), a status (new, closed, cancelled), a priority (idle, low, medium,
  high, critical), notes. No calendar field, so every one landed in General.
  Delete asked first.
- **Six calendars, fixed in code:** Installments, Invoices, Fiscal, Policies,
  Interventions, General. Nothing filled Fiscal, Policies or Interventions.
  Each could be hidden; the filter applied to the month only.
- **A building filter** in the later build, "— All —" or one building. Only the
  computed deadlines knew their building.
- No reminders, repeats, printing, drag and drop, or overdue marking.

## What the data holds

The seed's dump (`it-jtime-condominium.all.sql`) holds 12 hand-entered
deadlines: 11 in February 2013 and one in August 2013, all at midnight with no
time of their own, none in a calendar, none tied to a building. Eight belong
to the firm and four to no firm (notices to the residents). Statuses: new,
closed and cancelled; priorities from low to critical, some none. Several
carry notes, one with a phone number. The calendar tables of layers and of
links to buildings are empty.

The seed's dates are moved forward ([STATUS](../../STATUS.md), "The seed's
dates are moved a fixed number of years"): Pozzetto's books are 2026 and
Saturno's 2023, so Pozzetto's 12 installments and its invoices fall through
2026, and the hand-entered deadlines land in February and August 2026. No
seeded invoice has a due date, so each one's deadline falls 30 days after its
own date.

## Scope

In:

- The Calendar screen: the month, the Calendars and Building filters, the
  day's deadlines and the selected one's details.
- The deadlines worked out from the books, live.
- Add, edit and delete a hand-entered deadline.
- Overdue: a deadline still open after its day is marked as late.
- The 12 hand-entered deadlines in the seed.

Out, with where each goes:

- **Week and List views:** drawn, switched off (STATUS, Next).
- **Fiscal deadlines worked out from the books** (withholding payments of the
  F24): nothing in the legacy app did it (IDEAS).
- **Opening the installment or invoice behind a computed deadline** on its own
  screen (IDEAS).
- **Reminders, repeats, printing:** never in the legacy app (IDEAS, if anyone
  asks).

## The screen

The layout is the prototype's: the month (flex 1) | splitter | the deadlines
column, 404px by default, collapsible to a vertical "DEADLINES" rail, a drawer
under 1180px as the Contacts sidebar is.

### Toolbar

`‹` month `›` (26×24, chevrons `--acc`), the month title (13px/600, min-width
128, centred), **Today**, a divider, the **Calendars** button, and on the
right **Building: — All — ▾** and ⟳.

- The Calendar opens on the current month, today selected.
- `‹` and `›` move one month and select the same day number, the month's last
  when the month is shorter.
- **Today** goes back to the current month and selects today.
- **Calendars** (▦ + label + a count badge of those shown + ▾) opens a 218px
  popover: "SHOW CALENDARS", an All / None link, and one checkbox row per
  calendar with its 9×9 colour square. All six start shown. The choice holds
  while the app is open and is not saved.
- **Building**: "— All —", then the buildings by name. It draws its value as
  text over the control, as the app's other selects do.
- **⟳** does what it does on the other screens.

Both filters apply to the month and to the day's list. "— All —" shows every
deadline. One building shows that building's computed deadlines and the
hand-entered deadlines tied to it; a hand-entered deadline tied to no building
shows under "— All —" only.

### The month

A weekday header (Mon to Sun; Saturday and Sunday tinted as in the prototype),
then one row per week the month touches, four to six; the rows share the
height. Days of the months around it are blank.

A day cell: the day number top right (today ringed in `--acc`, the selected
cell on `--sel`, weekend days tinted), then one 10px line per deadline:
`border-left: 2px solid {calendar colour}`, the status mark, the time if it has
one, the description. Lines run in the day list's order. When they do not fit,
the cell ends with "+N more", which selects the day. Clicking a cell selects
its day; clicking a line selects that day and that deadline.

### Status marks

| Status | Mark | Colour |
|---|---|---|
| Closed | ✓ | `--ok` |
| Cancelled | ✕ | `--neg` |
| Overdue | ! | `--neg` |
| New | ✦ | `--warn` |

**Overdue** is never stored. A deadline is overdue when its status is New and
its day is before today (Rome's today, from the clock). A deadline due today is
not overdue yet. Closed and cancelled ones never are.

### Footer

"View: ● Monthly ○ Weekly ○ List", 11.5px, Monthly active in `--acc` 600.
Weekly and List are disabled, with the tooltip "Not available yet".

### Deadlines for {d Month yyyy}

The column's top panel. Toolbar `+ ✎ −`; grid `Time | St. | Pr. |
Description` (header on `--zebra`, 10.5px), the prototype's column widths. A
row: the time (tabular, `--txd`; empty for one with no time), the status mark,
the priority dot (9px), the description (11.5px, cut with a tooltip). Rows run
by time, those with no time first; then installments, invoices, hand-entered;
then installment number, invoice number, or description. Selecting a day selects its first deadline. Empty: "No deadlines
on this day." centred, 12px `--txd`.

`+` adds a deadline on the selected day. `✎` and `−` act on the selected one.
On a computed deadline they are disabled, and their tooltip says why: "Worked
out from the installment: change it in the Installment Schedule", or "… from
the invoice: change it in the Journal".

### Selected deadline details

Below a horizontal splitter (40% by default, as the prototype). Rows on a
`84px 1fr` grid: Description, Date (with the time when it has one), Calendar
(its colour square and name), Building ("—" when none), Status (mark and word),
Priority (dot and word). Then the NOTES box (`--zebra`, border `--bd2`, r6,
11.5px/1.55, `white-space: pre-line`). With nothing selected the panel says
"No deadline selected."

A computed deadline's notes are written from the books, as the legacy
screenshot shows:

- **Installment:** the building and period, the installment's name and due
  date, its total, what is paid and what is left.
- **Invoice:** the building and period, the supplier, the invoice's number,
  date and reason, its due date (with "assumed: 30 days after the invoice
  date" when it has none), its total due to the supplier, what is paid and
  what is left.

## Calendars

Fixed, as in the legacy app, and named in the domain. Colours from the
prototype:

| Calendar | Colour | Filled by |
|---|---|---|
| Installments | `#9b59b6` | the books |
| Invoices | `#2f6fed` | the books |
| Fiscal | `#16a085` | the user |
| Policies | `#e08a2b` | the user |
| Interventions | `#cc3a3a` | the user |
| General | `#7f8c8d` | the user |

A hand-entered deadline goes in Fiscal, Policies, Interventions or General.
Installments and Invoices hold only what the books say.

## Deadlines worked out from the books

For every period of every building:

- **One per installment**, on its due date, in Installments. Its description:
  "{installment name} due, {building} {period name}". Closed when every item
  of the installment is paid in full (what the collections paid, as the
  Installment Schedule reads it); New otherwise. An installment whose items
  are all zero is closed.
- **One per supplier invoice**, in Invoices, on its due date, or 30 days after
  its date when it has none. Its description: "Invoice due {supplier} no.
  {number} of {total due to the supplier}". Closed when its payments leave
  nothing to pay (as the open invoices of the Invoice payment wizard are
  judged); New otherwise.

They have no time and no priority. They change the moment the books do: a
collection that pays an installment's last item closes it, a deleted payment
opens it again, a moved due date moves it, a deleted installment or invoice
takes it away.

## Hand-entered deadlines

### The dialog

**Add Deadline** and **Edit Deadline**, on the app's form dialog:

| Field | Required | Default on Add |
|---|---|---|
| Description | yes, at most 255 characters after trimming | empty |
| Date | yes, a real date | the selected day |
| Time | no, HH:MM | empty |
| Calendar | yes: Fiscal, Policies, Interventions, General | General |
| Building | no: "— None —" or a building | the Building filter's building, or none |
| Status | yes: New, Closed, Cancelled | New |
| Priority | yes: None, Low, Medium, High, Critical | None |
| Notes | no | empty |

A refusal names the field, in the words the other dialogs use. A save selects
the deadline and moves the month to it.

### Delete

`−` asks: "Delete the deadline "{description}"? This cannot be undone." Yes
deletes it; the day's first deadline is then selected. Nothing refuses a
delete.

### Priority

| Priority | Dot |
|---|---|
| None | none drawn |
| Low | `#2e9e5b` |
| Medium | `#e6b020` |
| High | `#e08a2b` |
| Critical | `#d83a3a` |

The legacy app had both "no priority" and "idle"; both are None here.

## Domain

**`Deadline`**, one union on `source`:

- what every deadline has: `id`, `date` ("YYYY-MM-DD"), `time` ("HH:MM" or
  `null`), `calendar`, `buildingId` (`string | null`), `status`
  (`"new" | "closed" | "cancelled"`), `priority`
  (`"none" | "low" | "medium" | "high" | "critical"`);
- `source: "manual"`, with the `description` and `notes` the user typed;
- `source: "installment"`, with `periodId`, `installmentId`, and the figures
  its notes and description need;
- `source: "invoice"`, with `periodId`, `invoiceId`, whether the due date was
  assumed, and the figures.

A computed deadline's `id` names its source (`installment:<id>`,
`invoice:<id>`), so a selection survives the books emitting again. It has no
description or notes in the domain: their words carry amounts and dates in the
session's language, so `client-react` writes them from the figures, in
`ui/calendar/calendarWords.ts`. Nothing below the UI orders or matches by
those words: the day's order above uses the installment and invoice numbers.

Pure use cases in `packages/domain/src/useCases/calendar`:

- `bookDeadlines(periodBooks, today)`: the computed deadlines of one period,
  from its installments, items, entries, invoices and withholding taxes,
  using `itemBalances` and the invoice totals and payments the open invoices
  use. One rule for "paid", shared, not copied.
- `isOverdue(deadline, today)`.
- `deadlinesOfMonth(deadlines, month, filters)` and `deadlinesOfDay(…)`, in
  the order above.
- `validateDeadline(draft, buildings)`, with the Units validators' shape.

## Ports

**`CalendarPort`** holds the hand-entered deadlines only:

- `deadlines(): Observable<ManualDeadline[]>`
- `addDeadline(draft): Promise<ResultOf<{ id }>>`
- `editDeadline(id, draft): Promise<Result>`
- `deleteDeadline(id): Promise<Result>`

Each write is judged by `validateDeadline`, and the read emits again after an
accepted one. An id the port does not have rejects, as the other ports do.

The computed deadlines come from the ports that already hold the books
(installments, journal, accounts), combined in the core. Nothing new holds
them, so nothing can drift. The parent design's `CalendarPort` row ("layers,
events") becomes this: the calendars are fixed in the domain, and the events
the books give are not the port's.

## Core and client

- A **calendar presenter** owns the month, the selected day and deadline, both
  filters, today, and the merged deadlines: the port's and every period's
  `bookDeadlines`. It reads every period of every building, so a write in any
  period reaches it.
- Dialog machines follow `contactDialogMachines.ts`, on `createFormDialog`.
- `ui/calendar/` holds the screen, its panels and the dialog. `shell/Screen.tsx`
  routes the module. The deadlines column uses the frame the Contacts sidebar
  uses for its rail and drawer, on the right. A screen reads the view model and
  hands plain props down.
- The words of computed descriptions and notes, and of refusals, go in
  `ui/calendar/calendarWords.ts`, as `ui/contacts/contactReasons.ts`.
- **Today** is read from the clock when the Calendar first opens and again on
  the Today button, as the wizards read it when they open. The screen does not
  move at midnight on its own; the next Today does.

## Seed

`projectDeadlines` takes every `calendarEvent` row: the 12, the four with no
firm included.

- **Date and time:** the date part. A time of 00:00 with `ignoreTime` off, as on
  every row, is no time.
- **Calendar:** General for every row (`layerId` is null on all).
- **Building:** none for every row.
- **Status and priority:** as stored; a missing status is New, a missing or
  `idle` priority is None.
- **Description and notes:** through the pseudonymiser and the translation
  gate, as every other text. The privacy test must cover both fields and fail
  on a planted name or phone number.
- **The date shift:** a deadline with a building moves with that building; one
  with none moves the full `SEED_YEAR_SHIFT`. `shiftLegacySeed` refuses a dated
  record with no period today, so it learns this rule rather than a way round
  it.
- `gen:data`, then the oracle fixtures, change nothing else: only `deadlines`
  is new in the seed.

## Tests

- The use cases: an installment paid in full, in part, not at all, all zero;
  an invoice paid, part paid, with and without a due date (the 30 days); a
  deadline due yesterday, today, tomorrow, closed or cancelled after its day;
  the filters' combinations; the order of a day; every refusal of
  `validateDeadline` and each boundary (255 and 256 characters, 23:59 and
  24:00, 29 February in a leap year and not).
- The port's contract, against the simulator: the list, each write, an emission
  after a write, a refusal changing nothing, an unknown id rejecting.
- The presenter: month navigation across a year, the same-day rule into a
  shorter month, Today, a selection that survives the books emitting, a
  deleted collection reopening a closed installment's deadline and adding it
  back closing it again, a deleted invoice taking its deadline away, both
  filters. (No single seeded collection closes an open installment: each has
  several unpaid residents.)
- Components through page objects: the screen, the toolbar and its popover,
  the day list, the details, the dialog, the column as a rail and as a drawer.
- Legacy-import: the projection, the counts above, the privacy test, the
  unchanged parts of the seed.
- Visual goldens: a day cell in each state and with "+N more", the Calendars
  popover, the day list and the details for a computed and a hand-entered
  deadline (components); the column (section); the whole screen at the sizes
  used elsewhere, light and dark, and the dialog. The harness's clock is after
  every seeded period, so the Calendar's scenarios name their own today inside
  Pozzetto 2026, with a field of `Scenario`, rather than move it for every
  screen.
- End to end, one spec in `packages/e2e/src/sim`: see a paid January
  installment of Pozzetto closed, delete a collection that paid it in the
  Journal, and see the deadline open again on the Calendar; add a deadline and
  see it on its day.

## Review focus (what a person would expect)

1. Recording a collection, deleting it, or moving an installment's due date
   changes the Calendar at once, without reopening it, and the selected
   deadline stays selected when it still exists.
2. A month of six weeks (August 2026 starts on a Saturday, November 2026 on
   a Sunday) and one of four (February 2027 starts on a Monday): the grid
   fits, no week is lost, and the rows share the height.
3. A day with more deadlines than fit: the cell shows what fits and
   "+N more", and the day list shows all. The seed holds no such day (the
   fullest hold two), so a component golden and a test add them.
4. Building filter on Saturno, then Add: the dialog starts on Saturno, and the
   new deadline shows under Saturno and under "— All —", and not under
   Pozzetto.
5. The deadline selected, then its calendar hidden in the popover: the day list
   and the details let it go, and showing it again brings it back.
6. Today's own deadlines are not overdue; tomorrow they are, if still open.
7. A long description cuts in the cell and the list with a tooltip, and wraps
   in the details.

## Calls to check

Mine, not yours, unless you say otherwise:

1. The computed deadlines are worked out in the client from the books the app
   already reads, not by a port of their own as the legacy server did. When the
   server arrives (M3) it may serve them; the screen would not change.
2. A hand-entered deadline goes in Fiscal, Policies, Interventions or General,
   never Installments or Invoices.
3. Both filters apply to the day's list too, where the legacy app filtered the
   month only.
4. Overdue covers hand-entered deadlines as well as computed ones.
5. Status and priority are required, with New and None as defaults, where the
   legacy dialog allowed none.
6. `‹` and `›` keep the day number; the legacy app cleared the selection.
7. The four deadlines with no firm are imported with the rest.
8. The edit and delete buttons say why they are disabled on a computed
   deadline, where the legacy app silently did nothing.
9. The prototype's colours, not the legacy ones.
10. A Today button, which the legacy app had not.
11. Today is read when the Calendar opens and on Today, not at midnight by a
    timer.

## What is left to the builder

The order of the work; the split between presenter and machines; the exact
wording of a sentence that does not appear above; the icons within the design's
set; how many lines fit in a day cell before "+N more"; the exact `Scenario`
field that sets a scenario's today.
