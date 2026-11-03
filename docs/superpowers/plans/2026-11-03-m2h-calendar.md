# M2h — Calendar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Calendar module: one month of every building's deadlines, the ones the books give (installments, supplier invoices) live and the ones the administrator enters, with overdue marking, two filters, and add, edit and delete.

**Architecture:**
- The seed gains the dump's 12 hand-entered deadlines; `CalendarPort` holds them and their writes.
- Pure use cases in `domain/src/useCases/calendar` work out the books' deadlines of a period, overdue, the month and the day.
- A calendar presenter in the core merges the port's deadlines with every period's; the client draws the month, the deadlines column and the dialog on the existing `Panel`, `Dialog`, `SidebarFrame` and form-dialog machinery.

**Tech Stack:**
- TypeScript, RxJS with `@rx-state/core`, React 19 with the React Compiler;
- Vitest, Playwright through the visual and e2e add-ons.

**Spec:** `docs/superpowers/specs/2026-11-03-m2h-calendar-design.md`. It is the authority. Its Sources section names the legacy files and the screenshot. `old/` is not in the worktree: read it in the project's checkout, `/Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/old`.

## Global Constraints

- **Where and how to work:**
  - Work in the worktree `../condo-ledger-worktrees/calendar`, branch `worktree-calendar`, and open one pull request at the end.
  - Every task ends with `pnpm fix`, then `pnpm gate:full:quiet` green, then a commit. A red gate is not a finished task.
  - `pnpm --filter X test -- <name>` does not filter in this repo. While iterating, run single files with vitest from the package.
- **AGENTS.md code rules hold everywhere:** function declarations and named object types; `#/` imports past one folder; no `useMemo`, `useCallback` or `memo`, and no inline styles; test ids in `packages/client-react/src/ui/testids.ts`, and UI tests through page objects; fake timers and no sleeps; fixture factories named `create…`, and tests before helpers in a test file; a line of an `index.ts` only with an importer through it (knip); colours as tokens in `client-react/src/index.css`.
- **The seed:** `legacySeed.generated.ts` is only rewritten by `pnpm --filter @cl/legacy-import gen:data`, then `gen:oracle-fixture`.
  - Run generators and dump-backed tests with `LEGACY_DUMP_DIR=/Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/old/db` and `DESIGN_ORACLE_DIR=/Users/csx/workarea/dev/github.com/bettersoftware-io/condo-ledger/docs/design/web/v1/reports/pozzetto`, and show that they ran, not skipped. Run `gate:full` without them.
  - Committed files never carry a person's real name, street, phone, email or tax code. Nothing from the legacy screenshots goes into a test, a spec or a golden.
- **Ids:** buildings `c1` (Saturno, period `p1`, 2023) and `c19` (Pozzetto, period `p36`, 2026). Hand-entered deadlines `ce<n>` from the legacy `calendarEvent.id`; a new one takes the highest number plus one. Computed ones `installment:<installmentId>` and `invoice:<invoiceId>`.
- **Domain values:** `type CalendarId = "installments" | "invoices" | "fiscal" | "policies" | "interventions" | "general"`; `type DeadlineStatus = "new" | "closed" | "cancelled"`; `type DeadlinePriority = "none" | "low" | "medium" | "high" | "critical"`. Calendar colours: installments `#9b59b6`, invoices `#2f6fed`, fiscal `#16a085`, policies `#e08a2b`, interventions `#cc3a3a`, general `#7f8c8d`. Priority dots: low `#2e9e5b`, medium `#e6b020`, high `#e08a2b`, critical `#d83a3a`, none drawn for none.
- **Exact copy (the spec's, and these):**
  - **Toolbar:** "Today", "Calendars", popover "SHOW CALENDARS" with "All" / "None"; "Building:", "— All —"; month title "November 2026"; weekdays "Mon" … "Sun"; "+N more".
  - **Calendar names:** "Installments", "Invoices", "Fiscal", "Policies", "Interventions", "General".
  - **Footer:** "View:", "Monthly", "Weekly", "List"; disabled tooltip "Not available yet".
  - **Column:** rail "DEADLINES"; panel "Deadlines for {d Month yyyy}" ("Deadlines for 2 November 2026"); columns `Time | St. | Pr. | Description`; "No deadlines on this day."; panel "Selected deadline details", rows "Description", "Date", "Calendar", "Building", "Status", "Priority", box "NOTES"; "No deadline selected."; "—" for no building.
  - **Status words:** "New", "Closed", "Cancelled", "Overdue"; marks ✦ (`--warn`), ✓ (`--ok`), ✕ (`--neg`), ! (`--neg`). **Priority words:** "None", "Low", "Medium", "High", "Critical".
  - **Disabled ✎ and − on a computed deadline:** "Worked out from the installment: change it in the Installment Schedule"; "Worked out from the invoice: change it in the Journal".
  - **Computed descriptions:** "{installment name} due, {building} {period name}"; "Invoice due {supplier} no. {number} of €{total}" (the total due to the supplier, in the session's amount format).
  - **Computed notes, one line each:** installment: "Management: {building} / {period name}", "Installment: {name}", "Due date: {dd/mm/yyyy}", "Amount: €{total}", "Paid: €{paid}", "Left to pay: €{remaining}"; invoice: "Management: …", "Supplier: {name}", "Invoice no.: {number}", "Invoice date: {dd/mm/yyyy}", "Due date: {dd/mm/yyyy}" plus " (assumed: 30 days after the invoice date)" when it had none, "Reason: {reason}", "Amount: €{total}", "Paid: …", "Left to pay: …".
  - **Dialog:** "Add Deadline" / "Edit Deadline" (460px); fields "Description", "Date", "Time", "Calendar", "Building" ("— None —"), "Status", "Priority", "Notes". **Question:** `Delete the deadline "{description}"? This cannot be undone.`
  - **Reasons** (domain codes, worded in `ui/calendar/calendarWords.ts`): `blank-description` "Enter a description"; `description-too-long` "A description has at most 255 characters"; `bad-date` "The date is not a date"; `bad-time` "The time is HH:MM, from 00:00 to 23:59"; `books-calendar` "Installments and Invoices hold only what the books say"; `unknown-building` "That building is not in the app".
- **Visual tier:** `host/`, `visual.pw.ts` and `playwright.config.ts` stay untouched; a dialog is a component scenario with `capture: "viewport"`; a native `<select>` draws its chosen text as ordinary text.

## Review Focus

1. **The books move, the Calendar follows:** deleting the collection that paid an installment reopens its deadline, adding it back closes it, deleting an invoice takes its deadline away, and the selected deadline stays selected while it exists (Task 4 tests).
2. **Months of four, five and six weeks** (February 2027, February 2026, November 2026): no week lost, `‹`/`›` across a year end, and 31 → 30 → 28 keeping the last day (Task 3 and Task 4 tests).
3. **Building filter on Saturno, then Add:** the dialog starts on Saturno; the new deadline shows under Saturno and "— All —", not Pozzetto (Task 5 and Task 8 tests).
4. **The selected deadline's calendar hidden:** the day list and the details let it go, showing it again brings it back (Task 4 test).
5. **Overdue at the edge:** due today is New, due yesterday and open is Overdue, closed or cancelled never (Task 3 test).

---

### Task 1: The hand-entered deadlines in the seed

**Files:**
- Create: `packages/domain/src/entities/deadline.ts`; `packages/legacy-import/src/project/deadlines.ts` and test; `packages/domain/src/simulators/seed/legacySeed.deadlines.test.ts`.
- Modify: `packages/domain/src/simulators/seed/legacySeed.ts` (`LegacySeed`, `LegacySeedData`, `loadLegacySeed`), `packages/domain/src/index.ts`; `packages/legacy-import/src/project/legacySeed.ts` and test; `src/translate/exact.ts` (and `patterns.ts` if a note needs one), `translateSeed.ts` and test; `src/shift/shiftSeed.ts` and test; `src/pseudonymise/pseudonymise.dump.test.ts`; every test seed factory that builds a whole `LegacySeedData`/`LegacySeed` (`deadlines: []`); `legacySeed.generated.ts` and the oracle fixtures (regenerated).

**Interfaces:**
- Produces:
  - `interface ManualDeadline { id: string; date: string; time: string | null; calendar: CalendarId; buildingId: string | null; description: string; status: DeadlineStatus; priority: DeadlinePriority; notes: string | null }`, with `CalendarId`, `DeadlineStatus` and `DeadlinePriority`, in `entities/deadline.ts`. (`CALENDARS` arrives in Task 2 with its first importer.)
  - `LegacySeed.deadlines: ManualDeadline[]` and the same in `LegacySeedData`, by id number.
  - `projectDeadlines(db: Db): ManualDeadline[]`.
  - `shiftLegacySeed` moves a record of `deadlines` with its `buildingId`'s building, or the full `atMost` when it has none. No other record class learns an exception.

- [ ] **Step 1: Write the failing tests.** `projectDeadlines`, on a synthetic db: a row at `2013-02-05 00:00:00` with `ignoreTime` 0 → `date: "2013-02-05", time: null`; a row at `10:30` → `time: "10:30"`; `layerId` null → `"general"`; status null → `"new"`; priority null and `"idle"` → `"none"`; `notes` `""` → `null`; ids `ce23`. `shiftLegacySeed`: a deadline with no building moves 13 years; one with `buildingId: "c1"` moves Saturno's 12. `legacySeed.deadlines.test.ts` on the committed seed: 12 deadlines; 11 in 2026-02 and 1 in 2026-08; all `general`, no building, no time; the status and priority counts the dump gives (count them from the dump, write them in). The privacy test covers `deadlines.description` and `deadlines.notes` and fails on a planted name and phone number.
- [ ] **Step 2: Run them:** they fail on the missing projection and field.
- [ ] **Step 3: Implement.** `projectDeadlines` reads `db.tables.calendarEvent` (pseudonymised already, `replaceText` redigits the phone). Add the 12 descriptions and the notes to `translate/exact.ts`, keyed field `deadlines.description` / `deadlines.notes`. Add `deadlines` to `projectLegacySeed`'s output and to every whole-seed factory.
- [ ] **Step 4: Regenerate** with `gen:data` then `gen:oracle-fixture`. `git diff` of the seed adds only `deadlines`; the fixtures do not change. Run the legacy-import suite with the dump and show the counts.
- [ ] **Step 5: Gate and commit** `feat(seed): the legacy calendar's hand-entered deadlines`.

### Task 2: The rules and the calendar port

**Files:**
- Create: `packages/domain/src/useCases/calendar/validateDeadline.ts` and test; `packages/domain/src/ports/calendarPort.ts`; `packages/domain/src/ports/__contracts__/CalendarPortContract.ts`; `packages/domain/src/simulators/calendarSimulator.ts`, `calendarSimulator.contract.test.ts`, `calendarSimulator.test.ts`.
- Modify: `packages/domain/src/index.ts`; `packages/client-core/src/composition.ts` (`AppPorts.calendar`, `createSimulatorPorts`); `packages/client-react/src/app/buildPorts.ts` only if it lists ports.

**Interfaces:**
- Produces:
  - `const CALENDARS: readonly CalendarId[]` in `entities/deadline.ts`, the order of Global Constraints; `const MANUAL_CALENDARS` (fiscal, policies, interventions, general).
  - `type DeadlineDraft = Omit<ManualDeadline, "id">`.
  - `validateDeadline(draft: DeadlineDraft, buildings: Building[]): Result`, reasons in Global Constraints, in this order: description, date, time, calendar, building. Description is trimmed before the checks; 255 characters pass, 256 refuse. Time `"00:00"`–`"23:59"`; `"24:00"`, `"9:30"`, `"12:60"` refuse. `bad-date` for `"2026-02-29"`, `"2026-13-01"`, `""`; `"2028-02-29"` passes. `books-calendar` for `installments` and `invoices`. `unknown-building` for an id no building has.
  - `interface CalendarPort { deadlines(): Observable<ManualDeadline[]>; addDeadline(draft: DeadlineDraft): Promise<ResultOf<Added>>; editDeadline(id: string, draft: DeadlineDraft): Promise<Result>; deleteDeadline(id: string): Promise<Result> }`. `deadlines()` by date, then time (none first), then id number.
  - `createCalendarSimulator(seed: LegacySeed, buildings: () => Building[]): CalendarPort`; it stores the trimmed description.
  - `AppPorts.calendar: CalendarPort`.

- [ ] **Step 1: Write the failing tests:** every refusal and boundary above; the contract (`CalendarPortContract(create)`, imported by the simulator's contract test): the seed's list, an add answering `ce<max+1>` and emitting, an edit, a delete, a refused write changing nothing and not emitting, an unknown id rejecting on edit and delete.
- [ ] **Step 2: Run them:** fail.
- [ ] **Step 3: Implement** the validator, the port, the simulator (a `BehaviorSubject` of the seed's deadlines, as `contactsSimulator`), and wire `calendar` in `createSimulatorPorts` with `buildings.currentBuildings`.
- [ ] **Step 4: Run them:** pass.
- [ ] **Step 5: Gate and commit** `feat(domain): the calendar port and its rules`.

### Task 3: Deadlines from the books, overdue, the month and the day

**Files:**
- Create in `packages/domain/src/useCases/calendar/`: `bookDeadlines.ts`, `overdue.ts`, `month.ts`, each with its test.
- Modify: `packages/domain/src/entities/deadline.ts`, `index.ts`; `useCases/openInvoices.ts` only to export what the rule shares.

**Interfaces:**
- Consumes: `itemBalances` (`useCases/installments.ts`), `invoiceTotals`, `paidOn` (`useCases/openInvoices.ts`), the withholding rate lookup the open invoices use (export it rather than copy it).
- Produces:
  - `interface InstallmentDeadline { source: "installment"; id; date; time: null; calendar: "installments"; buildingId; status: "new" | "closed"; priority: "none"; periodId; installmentId; installmentName; installmentNumber: number; total: Cents; paid: Cents; remaining: Cents }`.
  - `interface InvoiceDeadline { source: "invoice"; id; date; time: null; calendar: "invoices"; buildingId; status: "new" | "closed"; priority: "none"; periodId; invoiceId; supplierId; invoiceNumber: string; invoiceDate: string; reason: string; dueDateAssumed: boolean; total: Cents; paid: Cents; remaining: Cents }`.
  - `type Deadline = (ManualDeadline & { source: "manual" }) | InstallmentDeadline | InvoiceDeadline`; `manual(deadline: ManualDeadline): Deadline`.
  - `interface PeriodBooks { buildingId: string; periodId: string; installments: Installment[]; items: InstallmentItem[]; entries: JournalEntry[]; invoices: Invoice[]; withholdingTaxes: WithholdingTax[] }`; `bookDeadlines(books: PeriodBooks): Deadline[]`.
  - `isOverdue(deadline: Deadline, today: string): boolean`; `type ShownStatus = DeadlineStatus | "overdue"`; `shownStatus(deadline, today): ShownStatus`.
  - `interface CalendarFilters { hidden: ReadonlySet<CalendarId>; buildingId: string | null }`; `isShown(deadline, filters): boolean` (one building shows its computed ones and the manual ones tied to it; `null` shows all).
  - `interface MonthWeek { days: (string | null)[] }` (seven ISO dates, `null` for the months around); `weeksOf(month: string): MonthWeek[]` for `"YYYY-MM"`, Monday first.
  - `deadlinesOfDay(deadlines: Deadline[], day: string, filters): Deadline[]` in the spec's order: no time first then by time; installments, invoices, manual; installment number, invoice number (numeric when both read as numbers), description; `deadlinesByDay(deadlines, month, filters): Map<string, Deadline[]>` in the same order.
  - `addMonths(month: string, n: number): string`; `sameDayIn(day: string, month: string): string` (the day number, or the month's last).
- [ ] **Step 1: Write the failing tests:** an installment paid in full (closed), in part and not at all (new), all items zero (closed), its total, paid, remaining; an invoice paid, part paid; one with a due date and one without (`date` + 30 days, `dueDateAssumed: true`, across a month end and a year end); the ids; overdue for due yesterday open, today open (not), closed and cancelled after their day (not); the filter's three meanings and a hidden calendar; `weeksOf("2027-02")` has 4 weeks, `"2026-02"` 5, `"2026-11"` and `"2026-08"` 6; a day's order with all three sources and two times; `sameDayIn("2026-01-31", "2026-02")` → `"2026-02-28"`, `"2028-02"` → `"2028-02-29"`; `addMonths("2026-12", 1)` → `"2027-01"`, `addMonths("2026-01", -1)` → `"2025-12"`.
- [ ] **Step 2: Run them:** fail.
- [ ] **Step 3: Implement.** One rule for "paid": installments through `itemBalances`, invoices through the same totals and `paidOn` the open invoices use.
- [ ] **Step 4: Run them:** pass.
- [ ] **Step 5: Gate and commit** `feat(domain): the books' deadlines, overdue, months and days`.

### Task 4: The calendar presenter

**Files:**
- Create: `packages/client-core/src/presenters/calendarPresenter.ts` and test.
- Modify: `packages/client-core/src/composition.ts` (`AppPresenters.calendar`), `packages/react-bindings/src/createViewModel.ts` and its test, the bindings' index.

**Interfaces:**
- Consumes: Task 2's port; Task 3's use cases; `BuildingsPort.buildings()`, `InstallmentsPort.installments/items`, `JournalPort.entries/invoices`, `AccountsPort.withholdingTaxes`, `ContactsPort.contacts()` (a supplier's name is `nameOf` its contact); `todayOf(clock)`.
- Produces:
  - `interface CalendarView { today: string; month: string; weeks: MonthWeek[]; byDay: Map<string, Deadline[]>; day: string; dayDeadlines: Deadline[]; selected: Deadline | null; filters: CalendarFilters; buildings: Building[]; names: DeadlineNames }`, where `DeadlineNames` gives a building's name, a period's name and a supplier's name by id.
  - `interface CalendarPresenter { view$: Observable<CalendarView>; previousMonth(): void; nextMonth(): void; goToToday(): void; selectDay(day: string): void; selectDeadline(id: string): void; toggleCalendar(id: CalendarId): void; showAllCalendars(): void; showNoCalendars(): void; setBuilding(id: string | null): void; reveal(id: string, day: string): void }`.
  - `useCalendar()` and `useCalendarIntents()` in the view model.
- Rules: today is read from the clock when `view$` is first subscribed and again on `goToToday`. The month opens on today's, today selected, its first deadline selected. `previousMonth`/`nextMonth` keep the day number by `sameDayIn`. Selecting a day selects its first shown deadline. A selection holds while that id is shown; when it goes (a filter, a delete, the books), the day's first shown deadline is selected, or none. Every period of every building is read, as `usesOf` in `composition.ts` does, with one shared subscription.

- [ ] **Step 1: Write the failing tests** over `createAppHarness` with a clock inside Pozzetto 2026 (`fixedClock("2026-02-14T08:00:00Z")`): the month and the selected day; `‹` from `"2026-01"` → `"2025-12"`, `›` from 31 January → 28 February; Today after moving away; deleting the collection that paid installment 1 makes its deadline `new` and adding it back makes it `closed` (pick the entry from the seed; the test names it); deleting an invoice's registration takes its deadline away; the selected deadline survives the books emitting and goes when its calendar is hidden, coming back when it is shown; the Building filter on `c1` hides Pozzetto's; a manual deadline with `buildingId: "c1"` shows under `c1` and `null` only; `reveal` after an add moves the month and selects it.
- [ ] **Step 2: Run them:** fail.
- [ ] **Step 3: Implement** the presenter and wire it; add the hooks.
- [ ] **Step 4: Run them:** pass.
- [ ] **Step 5: Gate and commit** `feat(core): the calendar presenter`.

### Task 5: The deadline dialog's machine

**Files:**
- Create: `packages/client-core/src/machines/deadlineDialogMachine.ts` and test.
- Modify: `packages/client-core/src/composition.ts` (`AppMachines.createDeadlineDialog`), the view model.

**Interfaces:**
- Consumes: `createFormDialog`, as `contactDialogMachines.ts`; Task 2's port and validator; Task 4's `reveal`.
- Produces: `interface DeadlineDialogForm { description: string; date: string /* dd/mm/yyyy as typed */; time: string; calendar: CalendarId; buildingId: string | null; status: DeadlineStatus; priority: DeadlinePriority; notes: string }`; `createDeadlineDialog(spec: { mode: "add"; day: string; buildingId: string | null } | { mode: "edit"; deadline: ManualDeadline })`. Add opens on the day given, the filter's building, `general`, `new`, `none`. A save writes through the port and calls `reveal` with the saved id and date. A refusal stays open with its reason on its field.
- [ ] **Step 1: Write the failing tests:** each default; an edit opening on the deadline as it stands; a refused save naming its field; a saved add revealing the new id on its day; Cancel writing nothing.
- [ ] **Step 2–4:** fail, implement, pass.
- [ ] **Step 5: Gate and commit** `feat(core): the deadline dialog`.

### Task 6: The screen: toolbar, month and footer

**Files:**
- Create in `packages/client-react/src/ui/calendar/`: `CalendarScreen.tsx` (reads the view model), `CalendarToolbar.tsx`, `CalendarsPopover.tsx`, `MonthGrid.tsx`, `DayCell.tsx`, `ViewFooter.tsx`, `calendarWords.ts`, `CalendarScreen.page.tsx`, `CalendarScreen.module.css` and their tests.
- Modify: `ui/shell/Screen.tsx` (route the module), `ui/testids.ts`, `src/index.css` (the calendar and priority tokens), `architecture.config.mts` `compilerTracked` if `MonthGrid` depends on memoising its weeks.

**Interfaces:**
- Consumes: `useCalendar`, `useCalendarIntents`; Task 3's `shownStatus`.
- Produces: `calendarWords.ts` exports `descriptionOf(deadline: Deadline, names: DeadlineNames, locale: AmountLocale): string`, `notesOf(…): string | null`, `statusWord`, `priorityWord`, `calendarName`, `reasonText(reason: string): string`.
- [ ] **Step 1: Write the failing tests** through the page object: the title and Today; `‹`/`›`; the popover's count, All, None, one toggle; ⟳ doing what the other screens' ⟳ does; the Building select listing "— All —" then the buildings by name; a six-week month; a day cell's lines with marks, times and the calendar's colour class; "+N more" selecting the day; clicking a line selecting it; Weekly and List disabled with their tooltip. `calendarWords` tests for every computed description and note line, both languages' amount formats.
- [ ] **Step 2–4:** fail, implement, pass.
- [ ] **Step 5: Gate and commit** `feat(ui): the Calendar's month`.

### Task 7: The deadlines column

**Files:**
- Create in `ui/calendar/`: `DeadlinesColumn.tsx`, `DayList.tsx`, `DeadlineDetails.tsx`, their tests, and their part of the page object.
- Modify: `ui/shell/SidebarFrame.tsx` (a `side: "left" | "right"` prop, `"left"` by default) and test; `CalendarScreen.tsx`.

**Interfaces:**
- Consumes: Task 6's words; the column's split ratio and width through the existing splitter and frame machines.
- [ ] **Step 1: Write the failing tests:** "Deadlines for 2 November 2026"; the columns; the order; the empty sentence; the details' rows for a manual and a computed deadline ("—" for no building, the notes lines); "No deadline selected."; ✎ and − disabled with each tooltip on a computed one; the column as a rail ("DEADLINES") and as a drawer under 1180px.
- [ ] **Step 2–4:** fail, implement, pass.
- [ ] **Step 5: Gate and commit** `feat(ui): the deadlines column`.

### Task 8: Add, edit and delete on screen

**Files:**
- Create in `ui/calendar/`: `DeadlineDialog.tsx`, `DeleteDeadline.tsx`, tests, page object methods.
- Modify: `DayList.tsx` (the `+ ✎ −` buttons), `CalendarScreen.tsx`.

**Interfaces:**
- Consumes: Task 5's machine; the app's `Dialog`, `DateField`, form fields and `RadioField`.
- [ ] **Step 1: Write the failing tests:** + opens Add Deadline on the selected day; Building filter on Saturno then + opens it on Saturno and the saved deadline shows under Saturno and "— All —" and not Pozzetto; each reason's sentence on its field; ✎ edits; − asks the question, No keeps it, Yes deletes it and selects the day's first; focus returns to the button that opened the dialog.
- [ ] **Step 2–4:** fail, implement, pass.
- [ ] **Step 5: Gate and commit** `feat(ui): add, edit and delete a deadline`.

### Task 9: Goldens and the end-to-end spec

**Files:**
- Modify: `packages/client-react/tests/visual/scenarios.ts`, `seeding.ts`, `registry.tsx`; goldens `darwin-arm64` (linux from the workflow at the end).
- Create: `packages/e2e/src/sim/calendar.spec.ts`, `packages/e2e/src/pages/Calendar.page.ts`; modify `packages/e2e/src/testing/test.ts`.

**Interfaces:**
- Produces: `Scenario.module` takes `"calendar"`; `Scenario.today?: string`, given to `createAppHarness` as `fixedClock(\`${today}T08:00:00Z\`)`.
- [ ] **Step 1: Scenarios** (the spec's Tests section): day cells in each status and with "+N more" (component, props); the popover open; the day list and the details for a computed and a manual deadline (component); the column (section); the screen at 1280 light, 1280 dark and 1100 with the drawer, `today: "2026-02-14"`; the dialog with a refusal (viewport component).
- [ ] **Step 2:** `pnpm visual:update`, open every new image, check it shows what its name says; `pnpm visual` passes; `pnpm visual:coverage` lists no calendar file with untaken branches you can reach by a scenario.
- [ ] **Step 3: The e2e spec:** on a Pozzetto January installment's day, its deadline is Closed; delete the collection that paid it in the Journal; back on the Calendar it is open; add a deadline and see it on its day. `pnpm e2e --mode sim` passes.
- [ ] **Step 4: Gate and commit** `test: the Calendar's goldens and end-to-end spec`.

### Task 10: STATUS, IDEAS and the parent design

**Files:** `docs/STATUS.md`, `docs/IDEAS.md`, `docs/superpowers/specs/2026-10-11-app-v2-design.md`.

- [ ] **Step 1:** STATUS: remove the Calendar from "The rest of the Buildings module for M2"; add "Next, with no plan yet": **Week and List views of the Calendar**; add to the M3 notes that the Calendar reads every period's books in the client and a server may serve the computed deadlines. IDEAS: fiscal deadlines from the books (F24); opening the installment or invoice behind a deadline; reminders, repeats, printing. The parent design: the `CalendarPort` row reads "deadlines (hand-entered) | add, edit, delete a deadline", and the M2 row says the Calendar is built. Set "Last updated".
- [ ] **Step 2:** `pnpm check:status`, `pnpm check:doc-links`; gate and commit `docs: the Calendar in STATUS, IDEAS and the parent design`.
