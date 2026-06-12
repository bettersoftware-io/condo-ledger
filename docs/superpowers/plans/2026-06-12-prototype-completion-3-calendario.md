# Prototype Completion — Plan 3: Calendario Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `CalendarioStub` with a working Calendario module — month grid with colored event chips, day list + event details panel, add/edit/remove event dialogs, month navigation and Competenza/Tutte filter — backed by a new calendar slice in the mock store and runtime (spec §5.1 + §5.3 of `docs/superpowers/specs/2026-06-11-prototype-completion-design.md`).

**Architecture:** Same ports-and-adapters shape as Plans 1–2: domain types in `@cl/application`, a `calendarEvents$` BehaviorSubject slice in `MockStore`, react-rxjs binds in `createAppRuntime`, presentational components that never import the store. The calendar is **studio-wide** (the legacy `calendarEvent` table has no condominium FK), so unlike the Condomini streams it is NOT gated on `selection$`: the runtime filters events by the **visible month** (`calendarMonth$`), and the "Competenza" toolbar filter narrows by `periodId` against the current selection at presentation level. Calendar layers (legacy `calendarLayer`) are a static fixture — no layer CRUD (YAGNI).

**Tech Stack:** React 18 + TS strict (`noUncheckedIndexedAccess`), react-rxjs `bind()` per factory call, Radix dialog via the existing `WizardDialog`, CSS modules, Vitest + RTL.

**Branch:** `feat/prototype-complete` (continue on it; do NOT merge — Plan 4 follows).

---

## Context for implementers (read once)

- Monorepo: `pnpm`. Run web tests with `pnpm --filter @cl/web exec vitest run <path>` (single file) or `pnpm --filter @cl/web test` (suite). Typecheck: `pnpm -r typecheck`. The suite is currently **148 tests / 35 files — keep it green**.
- `@cl/application` (`packages/application/src/`) holds DTO types (`types.ts`) and ports (`ports.ts`). `apps/web` implements them in `src/mock/MockStore.ts` (BehaviorSubject per collection, fixtures from `src/mock/fixtures.ts`) and `src/runtime/createAppRuntime.ts` (react-rxjs `bind()` per factory call — **no module-level singletons**; every `bind` gets a default value so reads resolve without `<Subscribe>`).
- Components get everything via `const rt = useAppRuntime()` — hooks for reads, `rt.commands.*` for writes. **Never import MockStore or fixtures from a component.**
- Dialog conventions (Plan 2): `WizardDialog` from `src/components/common/WizardDialog.tsx`; single-step dialogs pass one step and `submitLabel="Salva"`; `onSubmit: () => void | boolean` where returning `false` keeps the dialog open (used as `try { command } catch (e) { toast(...); return false; }`); per-open state seeding via `useEffect` keyed on `open`.
- Unique ids: deterministic slug + `-2`/`-3` suffix loop against existing ids. **Never** `Date.now()` / `randomUUID()`.
- All user-facing strings in Italian. Toolbar buttons that aren't implemented call `toast("Non disponibile nel prototipo")` — no silent no-ops.
- jsdom quirks: drive `<input type="date">` with `fireEvent.change(input, { target: { value: "2011-04-09" } })` (userEvent typing into date inputs is unreliable). Buttons/selects/text fields work fine with `userEvent`. Vitest serves CSS-module class names un-scoped, so `element.className` contains the literal class (e.g. `weekend`).
- Commits end with:

```
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

## File map

| File | Responsibility |
|---|---|
| `packages/application/src/types.ts` (modify) | `CalendarPriority`, `CalendarStatus`, `CalendarLayer`, `CalendarEvent` |
| `packages/application/src/ports.ts` (modify) | calendar CRUD commands, data-source reads, runtime hooks |
| `apps/web/src/mock/fixtures.ts` (modify) | `calendarLayers`, `calendarEvents` exports; installment-column `expiry` backfill |
| `apps/web/src/mock/fixtures.test.ts` (modify) | cross-module alignment tests |
| `apps/web/src/mock/MockStore.ts` (modify) | `calendarEvents$` subject, reads, 3 commands |
| `apps/web/src/mock/MockStore.test.ts` (modify) | command tests |
| `apps/web/src/runtime/createAppRuntime.ts` (modify) | `calendarMonth$`, `selectedDay$`, event/layer binds |
| `apps/web/src/runtime/runtime.test.tsx` (modify) | slice tests |
| `apps/web/src/modules/calendario/monthGrid.ts` (create) | pure date math: 42 Monday-first cells, month shift, Italian labels |
| `apps/web/src/modules/calendario/monthGrid.test.ts` (create) | date-math unit tests |
| `apps/web/src/modules/calendario/labels.ts` (create) | Italian status/priority display maps |
| `apps/web/src/modules/calendario/MonthGrid.tsx` + `.module.css` (create) | CSS-grid month view, chips, tints, day selection |
| `apps/web/src/modules/calendario/MonthGrid.test.tsx` (create) | component tests |
| `apps/web/src/modules/calendario/DayPanel.tsx` + `.module.css` (create) | day list (Ora/Descrizione/Stato/Priorità) + details card |
| `apps/web/src/modules/calendario/DayPanel.test.tsx` (create) | component tests |
| `apps/web/src/modules/calendario/EventDialog.tsx` (create) | add/edit dialog + `uniqueEventId` |
| `apps/web/src/modules/calendario/EventDialog.test.tsx` (create) | dialog tests |
| `apps/web/src/modules/calendario/CalendarioModule.tsx` + `.module.css` (create) | assembly: toolbar, filter, grid + panel layout, remove command |
| `apps/web/src/modules/calendario/CalendarioModule.test.tsx` (create) | integration tests (incl. spec's "calendar add-event appears in the month cell") |
| `apps/web/src/components/layout/AppShell.tsx` (modify) | mount `CalendarioModule`, drop the stub import |
| `apps/web/src/modules/CalendarioStub.tsx` (delete) | replaced |
| `apps/web/README.md` (modify) | Plan 3 capabilities section |

Design decisions locked in (do not relitigate in-task):
- **Default visible month is `"2011-04"`** — the fixtures live in 2010–2011, and April 2011 is the richest demo month (5 events). A real backend would default to the current month; this is a documented prototype choice.
- `setCalendarMonth` **clears the selected day** (a day of another month must not stay selected).
- Selected *event* (for the details card and Modifica/Rimuovi) is module-local `useState` — it is presentation state, like Giornale's page number.
- New events created through the dialog carry **no `periodId`** (studio-wide), so they show under "Tutte" but not under "Competenza" — matches the legacy notion that competenza links come from data, not manual entry. `editCalendarEvent` merges patches, so editing never drops an existing `periodId`.

---

### Task 1: Calendar domain types and port contracts

**Files:**
- Modify: `packages/application/src/types.ts` (append at end, after `WithholdingPaymentInput`)
- Modify: `packages/application/src/ports.ts`

- [ ] **Step 1: Add the calendar types**

Append to `packages/application/src/types.ts`:

```ts
/** ---- Calendario (Plan 3) ---- */
export type CalendarPriority = "idle" | "low" | "medium" | "high" | "critical"; // legacy enum
export type CalendarStatus = "new" | "closed" | "cancelled";                    // values seen in the dump
export interface CalendarLayer { id: Id; name: string; color: string /* CSS color for chips */; }
export interface CalendarEvent {
  id: Id;
  date: string;            // ISO yyyy-mm-dd
  time?: string;           // "HH:mm"; omitted = all-day (legacy ignoreTime)
  description: string;
  layerId: Id;
  status: CalendarStatus;
  priority: CalendarPriority;
  notes?: string;
  periodId?: Id;           // competenza link to an accounting period (drives the Competenza filter)
}
```

- [ ] **Step 2: Extend the ports**

In `packages/application/src/ports.ts`:

1. Add `CalendarLayer, CalendarEvent` to the type-import list from `./types`.
2. Append inside `CrudCommands` (after `setFunctionalAccount`):

```ts
  addCalendarEvent(event: CalendarEvent): void;
  editCalendarEvent(id: Id, patch: Partial<CalendarEvent>): void;
  removeCalendarEvent(id: Id): void;
```

3. Append inside `MockDataSource` (after `periodSummaries()`):

```ts
  /** static layer registry (legacy calendarLayer); no CRUD in the prototype */
  calendarLayers(): Observable<CalendarLayer[]>;
  /** studio-wide event list; month filtering happens in the runtime */
  calendarEvents(): Observable<CalendarEvent[]>;
```

4. Append inside `AppRuntime` (after `selectRow`):

```ts
  /** ---- Calendario slice (Plan 3) ---- */
  useCalendarMonth(): string;            // visible month, "yyyy-mm"
  setCalendarMonth(ym: string): void;    // also clears the selected day
  useSelectedDay(): string | null;       // ISO date of the picked day cell
  selectDay(iso: string | null): void;
  useCalendarLayers(): CalendarLayer[];
  useCalendarEvents(): CalendarEvent[];  // events of the visible month, date+time sorted
  /** unfiltered list — id-uniqueness pool for the add dialog (month slice would miss collisions) */
  useAllCalendarEvents(): CalendarEvent[];
```

- [ ] **Step 3: Typecheck — expect ONE deliberate failure**

Run: `pnpm -r typecheck`
Expected: `@cl/application` itself passes, but `@cl/web` FAILS — `MockStore` no longer implements `MockDataSource` and `createAppRuntime` no longer satisfies `AppRuntime`. That's the contract doing its job; Tasks 3–4 make it pass. **Do not stub the implementations in this task.**

- [ ] **Step 4: Commit**

```bash
git add packages/application/src/types.ts packages/application/src/ports.ts
git commit -m "feat(application): calendar event/layer types + port contracts (Plan 3)"
```

> Note for the controller: Tasks 1–4 form one type-driven sequence (contract → fixtures → store → runtime). `pnpm -r typecheck` is only expected fully green again after Task 4; per-package checks and the web test suite stay usable throughout because vitest doesn't gate on the application package's declarations.

---

### Task 2: Calendar fixtures + installment expiries + alignment tests

**Files:**
- Modify: `apps/web/src/mock/fixtures.ts`
- Test: `apps/web/src/mock/fixtures.test.ts`

The fixture set must echo dates that already exist elsewhere so cross-module data reads true (spec §5.1): every F24 `scadenza` and every installment-column `expiry` has a calendar event on the same date with the same `periodId`. Several descriptions are lifted from the legacy dump (`old/db/calendarEvent.sql`).

- [ ] **Step 1: Write the failing alignment tests**

Append to `apps/web/src/mock/fixtures.test.ts` (inside the file, as a new top-level `describe`):

```ts
describe("calendar fixtures", () => {
  it("event ids are unique and every event references a known layer", () => {
    const ids = fx.calendarEvents.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of fx.calendarEvents)
      expect(fx.calendarLayers.some((l) => l.id === e.layerId), e.id).toBe(true);
  });
  it("every F24 deadline has a calendar event on the same date and period", () => {
    for (const [periodId, rows] of Object.entries(fx.f24sByPeriod))
      for (const f of rows)
        expect(
          fx.calendarEvents.some((e) => e.date === f.scadenza && e.periodId === periodId),
          `${periodId} ${f.scadenza}`,
        ).toBe(true);
  });
  it("every installment expiry has a calendar event on the same date and period", () => {
    for (const [periodId, inst] of Object.entries(fx.installmentsByPeriod))
      for (const col of inst.columns) {
        expect(col.expiry, `${periodId} ${col.id} needs an expiry`).toBeTruthy();
        expect(
          fx.calendarEvents.some((e) => e.date === col.expiry && e.periodId === periodId),
          `${periodId} ${col.expiry}`,
        ).toBe(true);
      }
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm --filter @cl/web exec vitest run src/mock/fixtures.test.ts`
Expected: FAIL — `fx.calendarEvents` / `fx.calendarLayers` don't exist yet.

- [ ] **Step 3: Add the fixtures**

In `apps/web/src/mock/fixtures.ts`:

1. Add `CalendarLayer, CalendarEvent` to the type-import list from `@cl/application`.
2. Backfill expiries in `installmentsByPeriod` — **change ONLY the `columns` lines, leave headers exactly as they are** (`"Rata 1"` etc.; RateSection tests match them verbatim):

```ts
  // sat-2011:
  columns: [
    { id: "r1", header: "Rata 1", expiry: "2011-02-28" },
    { id: "r2", header: "Rata 2", expiry: "2011-04-30" },
    { id: "r3", header: "Rata 3", expiry: "2011-08-31" },
  ],
  // poz-2010:
  columns: [
    { id: "r1", header: "Rata 1", expiry: "2010-03-31" },
    { id: "r2", header: "Rata 2", expiry: "2010-09-30" },
  ],
```

3. Append at the end of the file:

```ts
/** ---- Calendario (Plan 3) ---- */
export const calendarLayers: CalendarLayer[] = [
  { id: "lay-scad", name: "Scadenze", color: "#c0392b" },
  { id: "lay-assem", name: "Assemblee", color: "#2e6da4" },
  { id: "lay-manut", name: "Manutenzioni", color: "#3d8b40" },
  { id: "lay-studio", name: "Studio", color: "#7f8c8d" },
];

/** Studio-wide agenda. Dates mirror f24sByPeriod scadenze and installment expiries
 * (guarded by fixtures.test.ts) so Calendario, Dati and Rate tell one story.
 * Several descriptions echo the legacy dump (old/db/calendarEvent.sql). */
export const calendarEvents: CalendarEvent[] = [
  // — Saturno 2011 —
  { id: "ev-f24-sat-1", date: "2011-01-16", description: "F24 Ritenute d'acconto 2010 conguaglio",
    layerId: "lay-scad", status: "closed", priority: "high", periodId: "sat-2011" },
  { id: "ev-f24-sat-2", date: "2011-04-16", description: "F24 Ritenute d'acconto 1° trim.",
    layerId: "lay-scad", status: "new", priority: "critical", periodId: "sat-2011" },
  { id: "ev-rata1-sat", date: "2011-02-28", description: "Scadenza Rata 1 — Condominio Saturno",
    layerId: "lay-scad", status: "closed", priority: "medium", periodId: "sat-2011" },
  { id: "ev-rata2-sat", date: "2011-04-30", description: "Scadenza Rata 2 — Condominio Saturno",
    layerId: "lay-scad", status: "new", priority: "medium", periodId: "sat-2011" },
  { id: "ev-rata3-sat", date: "2011-08-31", description: "Scadenza Rata 3 — Condominio Saturno",
    layerId: "lay-scad", status: "new", priority: "medium", periodId: "sat-2011" },
  { id: "ev-assem-sat", date: "2011-04-21", time: "18:00", description: "Assemblea ordinaria — Condominio Saturno",
    layerId: "lay-assem", status: "new", priority: "critical", periodId: "sat-2011",
    notes: "Ordine del giorno: approvazione bilancio preventivo 2011, nomina revisore." },
  { id: "ev-cald-sat", date: "2011-04-05", time: "09:30", description: "Revisione caldaia — Condominio Saturno",
    layerId: "lay-manut", status: "new", priority: "medium", periodId: "sat-2011" },
  // — Pozzetto 2010 —
  { id: "ev-f24-poz", date: "2010-07-16", description: "F24 Ritenute d'acconto",
    layerId: "lay-scad", status: "closed", priority: "high", periodId: "poz-2010" },
  { id: "ev-rata1-poz", date: "2010-03-31", description: "Scadenza Rata 1 — Condominio Pozzetto",
    layerId: "lay-scad", status: "closed", priority: "medium", periodId: "poz-2010" },
  { id: "ev-rata2-poz", date: "2010-09-30", description: "Scadenza Rata 2 — Condominio Pozzetto",
    layerId: "lay-scad", status: "closed", priority: "medium", periodId: "poz-2010" },
  { id: "ev-assem-poz", date: "2010-09-24", time: "18:30", description: "Assemblea del condominio Pozzetto",
    layerId: "lay-assem", status: "closed", priority: "critical", periodId: "poz-2010" },
  // — Studio-wide (nessuna competenza) —
  { id: "ev-polizza", date: "2011-04-12", description: "Scadenza polizza assicurativa n. 8274 Assicurazioni del Varmo S.p.A.",
    layerId: "lay-studio", status: "new", priority: "critical" },
  { id: "ev-ferie", date: "2011-08-13", description: "Chiusura studio per ferie",
    layerId: "lay-studio", status: "new", priority: "low",
    notes: "Lo studio resterà chiuso dal 13/8 al 26/8. Per urgenze: 347-2115474." },
];
```

April 2011 — the default demo month — thus holds 5 events: caldaia (05), polizza (12), F24 (16), assemblea (21), Rata 2 (30). August 2011 holds 2 (Rata 3, ferie). March 2011 holds none.

- [ ] **Step 4: Run the fixture tests AND the rate-section regression**

Run: `pnpm --filter @cl/web exec vitest run src/mock/fixtures.test.ts src/sections/rate/RateSection.test.tsx`
Expected: all PASS (headers untouched, so Rate tests still find "Rata 1").

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/mock/fixtures.ts apps/web/src/mock/fixtures.test.ts
git commit -m "feat(web): calendar layers/events fixtures aligned with F24 + rate expiries"
```

---

### Task 3: MockStore calendar slice

**Files:**
- Modify: `apps/web/src/mock/MockStore.ts`
- Test: `apps/web/src/mock/MockStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/mock/MockStore.test.ts` (the file already defines the `latest` helper at the top):

```ts
describe("calendar slice", () => {
  it("serves layers and events from fixtures", () => {
    const s = new MockStore();
    expect(latest(s.calendarLayers()).map((l) => l.id))
      .toEqual(["lay-scad", "lay-assem", "lay-manut", "lay-studio"]);
    expect(latest(s.calendarEvents()).some((e) => e.id === "ev-assem-sat")).toBe(true);
  });
  it("addCalendarEvent appends and re-emits", () => {
    const s = new MockStore();
    const seen: number[] = [];
    const sub = s.calendarEvents().subscribe((e) => seen.push(e.length));
    s.addCalendarEvent({ id: "ev-x", date: "2011-04-09", description: "Sopralluogo tetto",
      layerId: "lay-manut", status: "new", priority: "low" });
    sub.unsubscribe();
    expect(seen.at(-1)).toBe(seen[0]! + 1);
  });
  it("addCalendarEvent rejects an unknown layer and leaves state untouched", () => {
    const s = new MockStore();
    const before = latest(s.calendarEvents()).length;
    expect(() => s.addCalendarEvent({ id: "ev-bad", date: "2011-04-09", description: "X",
      layerId: "lay-nope", status: "new", priority: "low" })).toThrow("Calendario sconosciuto");
    expect(latest(s.calendarEvents())).toHaveLength(before);
  });
  it("editCalendarEvent merges the patch and keeps the competenza link", () => {
    const s = new MockStore();
    s.editCalendarEvent("ev-assem-sat", { description: "Assemblea straordinaria", status: "cancelled" });
    const e = latest(s.calendarEvents()).find((x) => x.id === "ev-assem-sat")!;
    expect(e.description).toBe("Assemblea straordinaria");
    expect(e.status).toBe("cancelled");
    expect(e.periodId).toBe("sat-2011"); // patch without periodId must not drop it
  });
  it("removeCalendarEvent drops the event", () => {
    const s = new MockStore();
    s.removeCalendarEvent("ev-ferie");
    expect(latest(s.calendarEvents()).some((e) => e.id === "ev-ferie")).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/mock/MockStore.test.ts`
Expected: FAIL — `calendarLayers` / `calendarEvents` / commands are not implemented.

- [ ] **Step 3: Implement the slice**

In `apps/web/src/mock/MockStore.ts`:

1. Add `of` to the rxjs value-import (`import { BehaviorSubject, combineLatest, map, of, type Observable } from "rxjs";`) and `CalendarLayer, CalendarEvent` to the `@cl/application` type-import list.
2. Add the subject after `private functional$ = …`:

```ts
  private calendar$ = new BehaviorSubject<CalendarEvent[]>(fx.calendarEvents);
```

3. Add the reads next to the other read methods (after `periodSummaries()`):

```ts
  calendarLayers(): Observable<CalendarLayer[]> { return of(fx.calendarLayers); } // static registry
  calendarEvents(): Observable<CalendarEvent[]> { return this.calendar$.asObservable(); }
```

4. Add the commands in the CRUD block (after `setFunctionalAccount`):

```ts
  addCalendarEvent(event: CalendarEvent): void {
    if (!fx.calendarLayers.some((l) => l.id === event.layerId))
      throw new Error(`Calendario sconosciuto: ${event.layerId}`);
    this.calendar$.next([...this.calendar$.getValue(), event]);
  }
  editCalendarEvent(id: Id, patch: Partial<CalendarEvent>): void {
    this.calendar$.next(this.calendar$.getValue().map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  removeCalendarEvent(id: Id): void {
    this.calendar$.next(this.calendar$.getValue().filter((e) => e.id !== id));
  }
```

- [ ] **Step 4: Run the store tests**

Run: `pnpm --filter @cl/web exec vitest run src/mock/MockStore.test.ts`
Expected: PASS (all, including the pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/mock/MockStore.ts apps/web/src/mock/MockStore.test.ts
git commit -m "feat(web): MockStore calendar slice — reads + add/edit/remove with layer guard"
```

---

### Task 4: Runtime calendar slice

**Files:**
- Modify: `apps/web/src/runtime/createAppRuntime.ts`
- Test: `apps/web/src/runtime/runtime.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/runtime/runtime.test.tsx` (it already imports `render, screen, act` and the providers):

```tsx
function CalendarProbe() {
  const rt = useAppRuntime();
  const ym = rt.useCalendarMonth();
  const events = rt.useCalendarEvents();
  const all = rt.useAllCalendarEvents();
  const day = rt.useSelectedDay();
  return (
    <div>
      <button onClick={() => rt.selectDay("2011-04-21")}>day</button>
      <button onClick={() => rt.setCalendarMonth("2011-08")}>aug</button>
      <span data-testid="ym">{ym}</span>
      <span data-testid="n">{events.length}</span>
      <span data-testid="all">{all.length}</span>
      <span data-testid="first">{events[0]?.id ?? "none"}</span>
      <span data-testid="day">{day ?? "none"}</span>
    </div>
  );
}

test("calendar slice: demo month default, events filtered and date-sorted", () => {
  render(<AppRuntimeProvider><CalendarProbe /></AppRuntimeProvider>);
  expect(screen.getByTestId("ym")).toHaveTextContent("2011-04");
  expect(screen.getByTestId("n")).toHaveTextContent("5");
  expect(screen.getByTestId("all")).toHaveTextContent("13"); // full fixture list, unfiltered
  expect(screen.getByTestId("first")).toHaveTextContent("ev-cald-sat"); // 2011-04-05 sorts first
});

test("calendar slice: month change refilters and clears the selected day", async () => {
  render(<AppRuntimeProvider><CalendarProbe /></AppRuntimeProvider>);
  await act(async () => { screen.getByText("day").click(); });
  expect(screen.getByTestId("day")).toHaveTextContent("2011-04-21");
  await act(async () => { screen.getByText("aug").click(); });
  expect(screen.getByTestId("ym")).toHaveTextContent("2011-08");
  expect(screen.getByTestId("n")).toHaveTextContent("2"); // Rata 3 + ferie
  expect(screen.getByTestId("day")).toHaveTextContent("none");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/runtime/runtime.test.tsx`
Expected: FAIL — the hooks don't exist on the runtime.

- [ ] **Step 3: Implement the slice**

In `apps/web/src/runtime/createAppRuntime.ts`:

1. Add `combineLatest` to the rxjs import: `import { BehaviorSubject, combineLatest, of, switchMap, map } from "rxjs";`
2. After the `selectedRows$` block, add the subjects and binds:

```ts
  // Calendario slice. Studio-wide (not gated on selection$): the legacy agenda
  // spans all condominiums; the month is the unit of fetching. "2011-04" is the
  // demo default — fixtures live in 2010-2011 (a real adapter would use today).
  const calendarMonth$ = new BehaviorSubject<string>("2011-04");
  const selectedDay$ = new BehaviorSubject<string | null>(null);
  const [useCalendarMonth] = bind(calendarMonth$, "2011-04");
  const [useSelectedDay] = bind(selectedDay$, null);
  const [useCalendarLayers] = bind(data.calendarLayers(), []);
  const [useAllCalendarEvents] = bind(data.calendarEvents(), []);
  const [useCalendarEvents] = bind(
    combineLatest([calendarMonth$, data.calendarEvents()]).pipe(
      map(([ym, events]) => events
        .filter((e) => e.date.startsWith(`${ym}-`))
        .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""))),
    ),
    [],
  );
```

3. Add to the returned object (after `selectRow`):

```ts
    useCalendarMonth,
    setCalendarMonth: (ym) => { calendarMonth$.next(ym); selectedDay$.next(null); },
    useSelectedDay,
    selectDay: (iso) => selectedDay$.next(iso),
    useCalendarLayers,
    useCalendarEvents,
    useAllCalendarEvents,
```

- [ ] **Step 4: Run the runtime tests, then the FULL typecheck**

Run: `pnpm --filter @cl/web exec vitest run src/runtime/runtime.test.tsx`
Expected: PASS.

Run: `pnpm -r typecheck`
Expected: PASS across all packages — the Task-1 contract is now fully implemented.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/runtime/createAppRuntime.ts apps/web/src/runtime/runtime.test.tsx
git commit -m "feat(web): runtime calendar slice — month state, day selection, month-filtered events"
```

---

### Task 5: Month-grid date math + Italian labels

**Files:**
- Create: `apps/web/src/modules/calendario/monthGrid.ts`
- Create: `apps/web/src/modules/calendario/labels.ts`
- Test: `apps/web/src/modules/calendario/monthGrid.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/modules/calendario/monthGrid.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { monthCells, shiftMonth, MONTHS, WEEKDAYS } from "./monthGrid";

describe("monthCells", () => {
  it("April 2011 grid starts Monday 28 March and holds 42 cells", () => {
    const cells = monthCells("2011-04");
    expect(cells).toHaveLength(42);
    expect(cells[0]!.iso).toBe("2011-03-28");   // April 1st 2011 is a Friday → 4 leading cells
    expect(cells[0]!.inMonth).toBe(false);
    expect(cells[4]!.iso).toBe("2011-04-01");
    expect(cells[4]!.inMonth).toBe(true);
    expect(cells[4]!.day).toBe(1);
    expect(cells[41]!.iso).toBe("2011-05-08");
  });
  it("flags Saturdays and Sundays as weekend", () => {
    const cells = monthCells("2011-04");
    expect(cells[5]!.iso).toBe("2011-04-02");   // Saturday
    expect(cells[5]!.weekend).toBe(true);
    expect(cells[6]!.weekend).toBe(true);       // Sunday
    expect(cells[7]!.weekend).toBe(false);      // Monday
  });
  it("handles leap February", () => {
    const feb29 = monthCells("2012-02").find((c) => c.iso === "2012-02-29");
    expect(feb29?.inMonth).toBe(true);
  });
});

describe("shiftMonth", () => {
  it("crosses year boundaries both ways", () => {
    expect(shiftMonth("2011-01", -1)).toBe("2010-12");
    expect(shiftMonth("2010-12", 1)).toBe("2011-01");
  });
});

it("Italian month and weekday labels", () => {
  expect(MONTHS[3]).toBe("Aprile");
  expect(WEEKDAYS[0]).toBe("Lunedì");
  expect(WEEKDAYS[6]).toBe("Domenica");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/modules/calendario/monthGrid.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the helpers**

Create `apps/web/src/modules/calendario/monthGrid.ts`:

```ts
import { addMonths } from "../../recompute/dates";

export interface MonthCell { iso: string; day: number; inMonth: boolean; weekend: boolean; }

// Static labels: deterministic across Node ICU builds (Intl month names vary by ICU data).
export const WEEKDAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
export const MONTHS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

/** 42 cells (6 fixed weeks), Monday-first, covering the whole `ym` ("yyyy-mm") month plus padding. */
export function monthCells(ym: string): MonthCell[] {
  const [y = 0, m = 1] = ym.split("-").map(Number);
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1, 1 - offset + i));
    const wd = (d.getUTCDay() + 6) % 7;
    return {
      iso: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === m - 1,
      weekend: wd >= 5,
    };
  });
}

/** "yyyy-mm" shifted by `delta` months (delegates to the shared addMonths). */
export function shiftMonth(ym: string, delta: number): string {
  return addMonths(`${ym}-01`, delta).slice(0, 7);
}
```

Create `apps/web/src/modules/calendario/labels.ts`:

```ts
import type { CalendarPriority, CalendarStatus } from "@cl/application";

export const STATUS_LABELS: Record<CalendarStatus, string> = {
  new: "Nuova", closed: "Chiusa", cancelled: "Annullata",
};
export const PRIORITY_LABELS: Record<CalendarPriority, string> = {
  idle: "Nessuna", low: "Bassa", medium: "Media", high: "Alta", critical: "Critica",
};
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @cl/web exec vitest run src/modules/calendario/monthGrid.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/calendario/monthGrid.ts apps/web/src/modules/calendario/labels.ts apps/web/src/modules/calendario/monthGrid.test.ts
git commit -m "feat(web): month-grid date math (Monday-first 42 cells) + Italian calendar labels"
```

---

### Task 6: MonthGrid component

**Files:**
- Create: `apps/web/src/modules/calendario/MonthGrid.tsx`
- Create: `apps/web/src/modules/calendario/MonthGrid.module.css`
- Test: `apps/web/src/modules/calendario/MonthGrid.test.tsx`

Purely presentational — all data via props, so tests need no providers. `todayIso` is injectable for determinism; the production default uses the real clock.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/modules/calendario/MonthGrid.test.tsx`:

```tsx
import { render, fireEvent, within } from "@testing-library/react";
import { vi } from "vitest";
import type { CalendarEvent, CalendarLayer } from "@cl/application";
import { MonthGrid } from "./MonthGrid";

const layers: CalendarLayer[] = [{ id: "lay-scad", name: "Scadenze", color: "#c0392b" }];
const events: CalendarEvent[] = [
  { id: "e1", date: "2011-04-16", description: "F24 Ritenute", layerId: "lay-scad", status: "new", priority: "high" },
];

const grid = (over: Partial<Parameters<typeof MonthGrid>[0]> = {}) =>
  render(<MonthGrid ym="2011-04" events={events} layers={layers} selectedDay={null}
    onSelectDay={() => {}} todayIso="2011-04-13" {...over} />);

test("renders 42 day cells and the weekday headers", () => {
  const { container, getByText } = grid();
  expect(container.querySelectorAll("[data-iso]")).toHaveLength(42);
  expect(getByText("Lunedì")).toBeInTheDocument();
  expect(getByText("Domenica")).toBeInTheDocument();
});

test("places the event chip in its day cell", () => {
  const { container } = grid();
  const cell = container.querySelector('[data-iso="2011-04-16"]') as HTMLElement;
  expect(within(cell).getByText("F24 Ritenute")).toBeInTheDocument();
});

test("clicking a day reports its ISO date", () => {
  const onSelectDay = vi.fn();
  const { container } = grid({ onSelectDay });
  fireEvent.click(container.querySelector('[data-iso="2011-04-21"]')!);
  expect(onSelectDay).toHaveBeenCalledWith("2011-04-21");
});

test("weekend, today, selected and outside cells get marker classes", () => {
  const { container } = grid({ selectedDay: "2011-04-21" });
  expect(container.querySelector('[data-iso="2011-04-02"]')!.className).toMatch(/weekend/);
  expect(container.querySelector('[data-iso="2011-04-13"]')!.className).toMatch(/today/);
  expect(container.querySelector('[data-iso="2011-04-21"]')!.className).toMatch(/selected/);
  expect(container.querySelector('[data-iso="2011-03-28"]')!.className).toMatch(/outside/);
});

test("more than three events collapse into a +N altre marker", () => {
  const many: CalendarEvent[] = ["a", "b", "c", "d"].map((s) => ({
    id: `e-${s}`, date: "2011-04-08", description: `Evento ${s}`,
    layerId: "lay-scad", status: "new", priority: "low",
  }));
  const { container } = grid({ events: many });
  const cell = container.querySelector('[data-iso="2011-04-08"]') as HTMLElement;
  expect(within(cell).getByText("+1 altre")).toBeInTheDocument();
  expect(within(cell).queryByText("Evento d")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/modules/calendario/MonthGrid.test.tsx`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement the component**

Create `apps/web/src/modules/calendario/MonthGrid.tsx`:

```tsx
import type { CalendarEvent, CalendarLayer } from "@cl/application";
import { WEEKDAYS, monthCells } from "./monthGrid";
import styles from "./MonthGrid.module.css";

const MAX_CHIPS = 3;

export function MonthGrid({ ym, events, layers, selectedDay, onSelectDay, todayIso }: {
  ym: string; events: CalendarEvent[]; layers: CalendarLayer[];
  selectedDay: string | null; onSelectDay: (iso: string) => void;
  /** injectable for tests; defaults to the real current date */
  todayIso?: string;
}) {
  const today = todayIso ?? new Date().toISOString().slice(0, 10);
  const colorOf = (layerId: string) => layers.find((l) => l.id === layerId)?.color ?? "#7f8c8d";
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  return (
    <div className={styles.grid}>
      {WEEKDAYS.map((w) => <div key={w} className={styles.weekday}>{w}</div>)}
      {monthCells(ym).map((c) => {
        const dayEvents = byDay.get(c.iso) ?? [];
        const cls = [
          styles.cell,
          c.inMonth ? "" : styles.outside,
          c.weekend ? styles.weekend : "",
          c.iso === today ? styles.today : "",
          c.iso === selectedDay ? styles.selected : "",
        ].filter(Boolean).join(" ");
        return (
          <div key={c.iso} data-iso={c.iso} className={cls} onClick={() => onSelectDay(c.iso)}>
            <span className={styles.dayNum}>{c.day}</span>
            {dayEvents.slice(0, MAX_CHIPS).map((e) => (
              <span key={e.id} className={styles.chip}
                style={{ background: colorOf(e.layerId) }} title={e.description}>
                {e.description}
              </span>
            ))}
            {dayEvents.length > MAX_CHIPS &&
              <span className={styles.more}>+{dayEvents.length - MAX_CHIPS} altre</span>}
          </div>
        );
      })}
    </div>
  );
}
```

Create `apps/web/src/modules/calendario/MonthGrid.module.css`:

```css
.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background: var(--border, #cfd6dd);
  border: 1px solid var(--border, #cfd6dd);
  flex: 1;
  min-width: 0;
}
.weekday {
  background: var(--panel-header, #e8edf2);
  padding: 4px 6px;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
}
.cell {
  background: #fff;
  min-height: 84px;
  padding: 2px 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
  overflow: hidden;
}
.cell:hover { background: #f4f8fc; }
.outside { background: #f4f4f4; color: #9aa3ab; }
.weekend { background: #fdf3ee; }
.weekend.outside { background: #f6efec; }
.today { box-shadow: inset 0 0 0 2px #e3a008; }
.selected { box-shadow: inset 0 0 0 2px var(--accent, #2e6da4); background: #e9f2fa; }
.dayNum { font-size: 12px; font-weight: 600; align-self: flex-end; }
.chip {
  color: #fff;
  border-radius: 3px;
  padding: 1px 4px;
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.more { font-size: 11px; color: #5a6570; }
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @cl/web exec vitest run src/modules/calendario/MonthGrid.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/calendario/MonthGrid.tsx apps/web/src/modules/calendario/MonthGrid.module.css apps/web/src/modules/calendario/MonthGrid.test.tsx
git commit -m "feat(web): MonthGrid — 6-week CSS grid, layer-coloured chips, weekend/today/selected tints"
```

---

### Task 7: DayPanel — day list + event details

**Files:**
- Create: `apps/web/src/modules/calendario/DayPanel.tsx`
- Create: `apps/web/src/modules/calendario/DayPanel.module.css`
- Test: `apps/web/src/modules/calendario/DayPanel.test.tsx`

Mirrors the legacy right panel: "Elenco scadenze del dd/mm/yyyy" list (Ora, Descrizione, Stato, Priorità) above a "Dettagli scadenza" card. Presentational; the module owns which event is selected.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/modules/calendario/DayPanel.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import type { CalendarEvent, CalendarLayer } from "@cl/application";
import { DayPanel } from "./DayPanel";

const layers: CalendarLayer[] = [{ id: "lay-assem", name: "Assemblee", color: "#2e6da4" }];
const events: CalendarEvent[] = [
  { id: "e1", date: "2011-04-21", time: "18:00", description: "Assemblea ordinaria",
    layerId: "lay-assem", status: "new", priority: "critical", notes: "Approvazione bilancio." },
  { id: "e2", date: "2011-04-22", description: "Altro evento", layerId: "lay-assem", status: "closed", priority: "low" },
];

test("lists only the selected day's events with time, status and priority labels", () => {
  render(<DayPanel day="2011-04-21" events={events} layers={layers} selectedEventId={null} onSelectEvent={() => {}} />);
  expect(screen.getByText("Elenco scadenze del 21/04/2011")).toBeInTheDocument();
  expect(screen.getByText("18:00")).toBeInTheDocument();
  expect(screen.getByText("Assemblea ordinaria")).toBeInTheDocument();
  expect(screen.getByText("Nuova")).toBeInTheDocument();
  expect(screen.getByText("Critica")).toBeInTheDocument();
  expect(screen.queryByText("Altro evento")).not.toBeInTheDocument();
});

test("clicking a row selects the event", () => {
  const onSelectEvent = vi.fn();
  render(<DayPanel day="2011-04-21" events={events} layers={layers} selectedEventId={null} onSelectEvent={onSelectEvent} />);
  fireEvent.click(screen.getByText("Assemblea ordinaria"));
  expect(onSelectEvent).toHaveBeenCalledWith("e1");
});

test("details card shows layer name, date+time and notes of the selected event", () => {
  render(<DayPanel day="2011-04-21" events={events} layers={layers} selectedEventId="e1" onSelectEvent={() => {}} />);
  expect(screen.getByText("Assemblee")).toBeInTheDocument();          // layer resolved by name
  expect(screen.getByText("21/04/2011 18:00")).toBeInTheDocument();
  expect(screen.getByText("Approvazione bilancio.")).toBeInTheDocument();
});

test("without a selected day it prompts; without a selected event the card is a placeholder", () => {
  render(<DayPanel day={null} events={events} layers={layers} selectedEventId={null} onSelectEvent={() => {}} />);
  expect(screen.getByText("Seleziona un giorno dal calendario")).toBeInTheDocument();
  expect(screen.getByText("Nessuna scadenza selezionata.")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/modules/calendario/DayPanel.test.tsx`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement the component**

Create `apps/web/src/modules/calendario/DayPanel.tsx`:

```tsx
import type { CalendarEvent, CalendarLayer } from "@cl/application";
import { FormCard, FieldGroup, Field } from "../../components/layout/FormCard";
import { formatItDate } from "../../recompute/dates";
import { STATUS_LABELS, PRIORITY_LABELS } from "./labels";
import styles from "./DayPanel.module.css";

export function DayPanel({ day, events, layers, selectedEventId, onSelectEvent }: {
  day: string | null;
  /** the visible month's events; the panel narrows to `day` itself */
  events: CalendarEvent[];
  layers: CalendarLayer[];
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
}) {
  const dayEvents = events.filter((e) => e.date === day);
  const sel = events.find((e) => e.id === selectedEventId) ?? null;
  const layerName = (id: string) => layers.find((l) => l.id === id)?.name ?? "—";
  return (
    <div className={styles.panel}>
      <div className={styles.title}>
        {day ? `Elenco scadenze del ${formatItDate(day)}` : "Seleziona un giorno dal calendario"}
      </div>
      <table className={styles.list}>
        <thead>
          <tr><th>Ora</th><th>Descrizione</th><th>Stato</th><th>Priorità</th></tr>
        </thead>
        <tbody>
          {dayEvents.map((e) => (
            <tr key={e.id} className={e.id === selectedEventId ? styles.rowSelected : ""}
              onClick={() => onSelectEvent(e.id)}>
              <td>{e.time ?? "—"}</td>
              <td>{e.description}</td>
              <td>{STATUS_LABELS[e.status]}</td>
              <td>{PRIORITY_LABELS[e.priority]}</td>
            </tr>
          ))}
          {day && dayEvents.length === 0 &&
            <tr><td colSpan={4} className={styles.empty}>Nessuna scadenza.</td></tr>}
        </tbody>
      </table>
      <div className={styles.title}>Dettagli scadenza</div>
      {sel ? (
        <FormCard>
          <FieldGroup>
            <Field label="Descrizione" value={sel.description} />
            <Field label="Data" value={`${formatItDate(sel.date)}${sel.time ? ` ${sel.time}` : ""}`} />
            <Field label="Calendario" value={layerName(sel.layerId)} />
            <Field label="Stato" value={STATUS_LABELS[sel.status]} />
            <Field label="Priorità" value={PRIORITY_LABELS[sel.priority]} />
            <Field label="Note" value={sel.notes ?? "—"} />
          </FieldGroup>
        </FormCard>
      ) : (
        <p className={styles.empty}>Nessuna scadenza selezionata.</p>
      )}
    </div>
  );
}
```

Create `apps/web/src/modules/calendario/DayPanel.module.css`:

```css
.panel {
  width: 320px;
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: auto;
}
.title {
  background: var(--panel-header, #e8edf2);
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 600;
}
.list { border-collapse: collapse; width: 100%; font-size: 12px; }
.list th {
  text-align: left;
  border-bottom: 1px solid var(--border, #cfd6dd);
  padding: 3px 6px;
  font-weight: 600;
}
.list td { padding: 3px 6px; border-bottom: 1px solid #eef1f4; }
.list tbody tr { cursor: pointer; }
.list tbody tr:hover { background: #f4f8fc; }
.rowSelected { background: #e9f2fa; }
.rowSelected:hover { background: #e9f2fa; }
.empty { color: #5a6570; font-size: 12px; padding: 4px 6px; margin: 0; }
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @cl/web exec vitest run src/modules/calendario/DayPanel.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/calendario/DayPanel.tsx apps/web/src/modules/calendario/DayPanel.module.css apps/web/src/modules/calendario/DayPanel.test.tsx
git commit -m "feat(web): DayPanel — per-day scadenze list + dettagli card"
```

---

### Task 8: EventDialog (add/edit) + uniqueEventId

**Files:**
- Create: `apps/web/src/modules/calendario/EventDialog.tsx`
- Test: `apps/web/src/modules/calendario/EventDialog.test.tsx`

Single-step `WizardDialog` (`submitLabel="Salva"`), Plan-2 conventions: per-open seeding effect, veto-close on command throw, slug-suffix unique id. Add → `addCalendarEvent` (no `periodId`: manual entries are studio-wide); edit → `editCalendarEvent` with a patch that intentionally omits `periodId` so the merge preserves the competenza link.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/modules/calendario/EventDialog.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CalendarEvent, CalendarLayer } from "@cl/application";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { ToastProvider } from "../../components/common/Toast";
import { EventDialog, uniqueEventId } from "./EventDialog";

const layers: CalendarLayer[] = [{ id: "lay-scad", name: "Scadenze", color: "#c0392b" }];

const renderDialog = (editing: CalendarEvent | null) => render(
  <AppRuntimeProvider><ToastProvider>
    <EventDialog open onOpenChange={() => {}} layers={layers} events={[]}
      editing={editing} defaultDate="2011-04-01" />
  </ToastProvider></AppRuntimeProvider>,
);

test("uniqueEventId slugs the description and suffixes duplicates", () => {
  expect(uniqueEventId("Revisione caldaia!", [])).toBe("ev-revisione-caldaia");
  const existing = [{ id: "ev-revisione-caldaia" }, { id: "ev-revisione-caldaia-2" }];
  expect(uniqueEventId("Revisione caldaia", existing)).toBe("ev-revisione-caldaia-3");
  expect(uniqueEventId("???", [])).toBe("ev-evento");
});

test("empty description blocks the save with an Italian message", async () => {
  renderDialog(null);
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  expect(await screen.findByText("Inserire una descrizione")).toBeInTheDocument();
});

test("add mode seeds the default date; edit mode seeds the event", () => {
  renderDialog(null);
  expect(screen.getByLabelText("Data")).toHaveValue("2011-04-01");
});

test("edit mode seeds every field from the event", () => {
  renderDialog({
    id: "ev-x", date: "2011-04-21", time: "18:00", description: "Assemblea",
    layerId: "lay-scad", status: "new", priority: "critical", notes: "ODG",
  });
  expect(screen.getByLabelText("Descrizione")).toHaveValue("Assemblea");
  expect(screen.getByLabelText("Data")).toHaveValue("2011-04-21");
  expect(screen.getByLabelText("Ora")).toHaveValue("18:00");
  expect(screen.getByLabelText("Priorità")).toHaveValue("critical");
  expect(screen.getByLabelText("Note")).toHaveValue("ODG");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/modules/calendario/EventDialog.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the dialog**

Create `apps/web/src/modules/calendario/EventDialog.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { CalendarEvent, CalendarLayer, CalendarPriority, CalendarStatus } from "@cl/application";
import { WizardDialog } from "../../components/common/WizardDialog";
import { TextField, DateField, SelectField } from "../../components/forms/fields";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { useToast } from "../../components/common/Toast";
import { STATUS_LABELS, PRIORITY_LABELS } from "./labels";

/** Deterministic unique id: slug of the description + -2/-3… suffix against existing ids. */
export function uniqueEventId(description: string, existing: { id: string }[]): string {
  const slug = "ev-" +
    (description.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "evento");
  let id = slug;
  let n = 2;
  while (existing.some((e) => e.id === id)) id = `${slug}-${n++}`;
  return id;
}

export function EventDialog({ open, onOpenChange, layers, events, editing, defaultDate }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  layers: CalendarLayer[];
  /** the FULL event list (rt.useAllCalendarEvents) — id-uniqueness pool; the month slice would miss cross-month collisions */
  events: CalendarEvent[];
  /** event being edited, or null to add */
  editing: CalendarEvent | null;
  /** seed date for new events (the selected day, or the 1st of the visible month) */
  defaultDate: string;
}) {
  const rt = useAppRuntime();
  const toast = useToast();
  const [descrizione, setDescrizione] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [layerId, setLayerId] = useState("");
  const [status, setStatus] = useState<CalendarStatus>("new");
  const [priority, setPriority] = useState<CalendarPriority>("medium");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setDescrizione(editing?.description ?? "");
    setDate(editing?.date ?? defaultDate);
    setTime(editing?.time ?? "");
    setLayerId(editing?.layerId ?? layers[0]?.id ?? "");
    setStatus(editing?.status ?? "new");
    setPriority(editing?.priority ?? "medium");
    setNotes(editing?.notes ?? "");
  }, [open, editing, defaultDate, layers]);

  const submit = (): boolean => {
    const patch = {
      description: descrizione.trim(), date, layerId, status, priority,
      time: time || undefined, notes: notes.trim() || undefined,
    };
    try {
      if (editing) rt.commands.editCalendarEvent(editing.id, patch); // periodId omitted → preserved
      else rt.commands.addCalendarEvent({ id: uniqueEventId(patch.description, events), ...patch });
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Operazione non riuscita");
      return false;
    }
  };

  return (
    <WizardDialog
      open={open} onOpenChange={onOpenChange}
      title={editing ? "Modifica scadenza" : "Aggiungi scadenza"} submitLabel="Salva"
      onSubmit={submit}
      steps={[{
        title: "Dettagli",
        validate: () => {
          if (!descrizione.trim()) return "Inserire una descrizione";
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Inserire una data valida";
          return null;
        },
        content: (
          <>
            <TextField label="Descrizione" value={descrizione} onChange={setDescrizione} />
            <DateField label="Data" value={date} onChange={setDate} />
            <TextField label="Ora" value={time} onChange={setTime} type="time" />
            <SelectField label="Calendario" value={layerId} onChange={setLayerId}
              options={layers.map((l) => ({ value: l.id, label: l.name }))} />
            <SelectField label="Stato" value={status} onChange={(v) => setStatus(v as CalendarStatus)}
              options={(Object.keys(STATUS_LABELS) as CalendarStatus[])
                .map((s) => ({ value: s, label: STATUS_LABELS[s] }))} />
            <SelectField label="Priorità" value={priority} onChange={(v) => setPriority(v as CalendarPriority)}
              options={(Object.keys(PRIORITY_LABELS) as CalendarPriority[])
                .map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))} />
            <TextField label="Note" value={notes} onChange={setNotes} />
          </>
        ),
      }]}
    />
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @cl/web exec vitest run src/modules/calendario/EventDialog.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/calendario/EventDialog.tsx apps/web/src/modules/calendario/EventDialog.test.tsx
git commit -m "feat(web): EventDialog — add/edit scadenza with slug ids and veto-close"
```

---

### Task 9: CalendarioModule assembly + AppShell swap + integration tests

**Files:**
- Create: `apps/web/src/modules/calendario/CalendarioModule.tsx`
- Create: `apps/web/src/modules/calendario/CalendarioModule.module.css`
- Modify: `apps/web/src/components/layout/AppShell.tsx`
- Delete: `apps/web/src/modules/CalendarioStub.tsx`
- Test: `apps/web/src/modules/calendario/CalendarioModule.test.tsx`

Wires runtime + components: toolbar (Aggiungi/Modifica/Rimuovi + honest Stampa/PDF stubs; month nav, year/month selects and the Competenza/Tutte filter in `toolbarRight`), MonthGrid left, DayPanel right. Includes the spec §6 required test "calendar add-event appears in the month cell".

- [ ] **Step 1: Write the failing integration tests**

Create `apps/web/src/modules/calendario/CalendarioModule.test.tsx`:

```tsx
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRuntimeProvider } from "../../runtime/AppRuntimeProvider";
import { ToastProvider } from "../../components/common/Toast";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { CalendarioModule } from "./CalendarioModule";

function Inner() {
  const rt = useAppRuntime();
  return (
    <>
      <button onClick={() => rt.select({ condominiumId: "sat", accountingPeriodId: "sat-2011" })}>sel-sat</button>
      <CalendarioModule />
    </>
  );
}
const setup = () => render(
  <AppRuntimeProvider><ToastProvider><Inner /></ToastProvider></AppRuntimeProvider>,
);

test("opens on the demo month with fixture chips and a count", async () => {
  setup();
  expect(await screen.findByText("Assemblea ordinaria — Condominio Saturno")).toBeInTheDocument();
  expect(screen.getByText(/5 scadenze nel mese/)).toBeInTheDocument();
});

test("month navigation refilters the grid", async () => {
  setup();
  await screen.findByText("Assemblea ordinaria — Condominio Saturno");
  await userEvent.click(screen.getByLabelText("Mese precedente"));
  expect(screen.queryByText("Assemblea ordinaria — Condominio Saturno")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Mese")).toHaveValue("03");
  await userEvent.selectOptions(screen.getByLabelText("Mese"), "08");
  expect(await screen.findByText("Chiusura studio per ferie")).toBeInTheDocument();
});

test("adding an event makes its chip appear in the month cell", async () => {
  const { container } = setup();
  await userEvent.click(screen.getByLabelText("Aggiungi scadenza"));
  await userEvent.type(screen.getByLabelText("Descrizione"), "Sopralluogo tetto");
  fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2011-04-09" } });
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  const cell = container.querySelector('[data-iso="2011-04-09"]') as HTMLElement;
  expect(await within(cell).findByText("Sopralluogo tetto")).toBeInTheDocument();
});

test("competenza filter narrows the month to the selected period's events", async () => {
  setup();
  await screen.findByText("Scadenza polizza assicurativa n. 8274 Assicurazioni del Varmo S.p.A."); // studio-wide event visible
  await userEvent.click(screen.getByText("sel-sat"));
  await userEvent.selectOptions(screen.getByLabelText("Mostra"), "competenza");
  expect(screen.queryByText("Scadenza polizza assicurativa n. 8274 Assicurazioni del Varmo S.p.A.")).not.toBeInTheDocument();
  expect(screen.getByText("Assemblea ordinaria — Condominio Saturno")).toBeInTheDocument();
  expect(screen.getByText(/4 scadenze nel mese/)).toBeInTheDocument();
});

test("day click fills the list; row click fills the details and feeds Modifica", async () => {
  const { container } = setup();
  await screen.findByText("Assemblea ordinaria — Condominio Saturno");
  fireEvent.click(container.querySelector('[data-iso="2011-04-21"]')!);
  expect(await screen.findByText("Elenco scadenze del 21/04/2011")).toBeInTheDocument();
  fireEvent.click(screen.getByText("18:00"));                     // unique to the day-list row
  expect(screen.getByText("Assemblee")).toBeInTheDocument();      // details card layer name
  await userEvent.click(screen.getByLabelText("Modifica scadenza"));
  expect(screen.getByLabelText("Descrizione")).toHaveValue("Assemblea ordinaria — Condominio Saturno");
  await userEvent.clear(screen.getByLabelText("Descrizione"));
  await userEvent.type(screen.getByLabelText("Descrizione"), "Assemblea straordinaria");
  await userEvent.click(screen.getByRole("button", { name: "Salva" }));
  // appears both as a chip and as the day-list row → use findAllByText
  expect((await screen.findAllByText("Assemblea straordinaria")).length).toBeGreaterThan(0);
});

test("Rimuovi is disabled until an event is selected, then deletes it", async () => {
  const { container } = setup();
  await screen.findByText("Revisione caldaia — Condominio Saturno");
  expect(screen.getByLabelText("Rimuovi scadenza")).toBeDisabled();
  fireEvent.click(container.querySelector('[data-iso="2011-04-05"]')!);
  fireEvent.click(await screen.findByText("09:30"));
  await userEvent.click(screen.getByLabelText("Rimuovi scadenza"));
  expect(screen.queryByText("Revisione caldaia — Condominio Saturno")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @cl/web exec vitest run src/modules/calendario/CalendarioModule.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the module**

Create `apps/web/src/modules/calendario/CalendarioModule.tsx`:

```tsx
import { useState } from "react";
import { SectionPanel } from "../../components/layout/SectionPanel";
import { MonthGrid } from "./MonthGrid";
import { DayPanel } from "./DayPanel";
import { EventDialog } from "./EventDialog";
import { MONTHS, shiftMonth } from "./monthGrid";
import { useAppRuntime } from "../../runtime/useAppRuntime";
import { useToast } from "../../components/common/Toast";
import styles from "./CalendarioModule.module.css";

type Filter = "tutte" | "competenza";
const YEARS = ["2009", "2010", "2011", "2012", "2013"]; // fixture era

export function CalendarioModule() {
  const rt = useAppRuntime();
  const toast = useToast();
  const ym = rt.useCalendarMonth();
  const day = rt.useSelectedDay();
  const layers = rt.useCalendarLayers();
  const monthEvents = rt.useCalendarEvents();
  const allEvents = rt.useAllCalendarEvents();
  const periodId = rt.useSelection().accountingPeriodId ?? null;
  const [filter, setFilter] = useState<Filter>("tutte");
  const [eventId, setEventId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"add" | "edit" | null>(null);
  const stub = () => toast("Non disponibile nel prototipo");

  const events = filter === "competenza"
    ? monthEvents.filter((e) => e.periodId === periodId)
    : monthEvents;
  const selected = events.find((e) => e.id === eventId) ?? null;

  const setMonth = (next: string) => { rt.setCalendarMonth(next); setEventId(null); };
  const selectDay = (iso: string) => { rt.selectDay(iso); setEventId(null); };

  const [year = "2011", month = "04"] = ym.split("-");
  const actions = [
    { icon: "add", label: "Aggiungi scadenza", primary: true, onClick: () => setDialog("add") },
    { icon: "edit", label: "Modifica scadenza", disabled: !selected, onClick: () => setDialog("edit") },
    { icon: "remove", label: "Rimuovi scadenza", disabled: !selected,
      onClick: () => { if (selected) { rt.commands.removeCalendarEvent(selected.id); setEventId(null); } } },
    { sep: true, icon: "", label: "" },
    { icon: "print", label: "Stampa", onClick: stub },
    { icon: "pdf", label: "PDF", onClick: stub },
  ];

  return (
    <SectionPanel
      title="Calendario" actions={actions} count={events.length} countNoun="scadenze nel mese"
      legend={<div>Le scadenze sono colorate per calendario; «Competenza» mostra solo quelle dell'esercizio selezionato nei Condomini.</div>}
      toolbarRight={
        <span className={styles.controls}>
          <button className={styles.navBtn} aria-label="Mese precedente"
            onClick={() => setMonth(shiftMonth(ym, -1))}>‹</button>
          <label>Mese{" "}
            <select value={month} onChange={(e) => setMonth(`${year}-${e.target.value}`)}>
              {MONTHS.map((m, i) =>
                <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
            </select>
          </label>
          <label>Anno{" "}
            <select value={year} onChange={(e) => setMonth(`${e.target.value}-${month}`)}>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <button className={styles.navBtn} aria-label="Mese successivo"
            onClick={() => setMonth(shiftMonth(ym, 1))}>›</button>
          <label>Mostra{" "}
            <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              <option value="tutte">Tutte le scadenze</option>
              <option value="competenza">Competenza</option>
            </select>
          </label>
        </span>
      }
    >
      <div className={styles.layout}>
        <MonthGrid ym={ym} events={events} layers={layers} selectedDay={day} onSelectDay={selectDay} />
        <DayPanel day={day} events={events} layers={layers} selectedEventId={eventId} onSelectEvent={setEventId} />
      </div>
      <EventDialog
        open={dialog !== null} onOpenChange={(o) => { if (!o) setDialog(null); }}
        layers={layers} events={allEvents}
        editing={dialog === "edit" ? selected : null}
        defaultDate={day ?? `${ym}-01`}
      />
    </SectionPanel>
  );
}
```

Create `apps/web/src/modules/calendario/CalendarioModule.module.css`:

```css
.layout {
  display: flex;
  gap: 8px;
  height: 100%;
  min-height: 0;
}
.controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.navBtn {
  border: 1px solid var(--border, #cfd6dd);
  background: #fff;
  border-radius: 3px;
  padding: 1px 8px;
  cursor: pointer;
}
```

Update `apps/web/src/components/layout/AppShell.tsx`: replace the stub import

```tsx
import { CalendarioModule } from "../../modules/calendario/CalendarioModule";
```

(removing the `CalendarioStub` import line) and change the mount to `{module === "calendario" && <CalendarioModule />}`. Then delete the stub:

```bash
git rm apps/web/src/modules/CalendarioStub.tsx
```

(`AnagraficheStub` and `Stub.module.css` stay — Plan 4 replaces them.)

- [ ] **Step 4: Run the module tests, then the FULL suite + typecheck + build**

Run: `pnpm --filter @cl/web exec vitest run src/modules/calendario/CalendarioModule.test.tsx`
Expected: PASS (6 tests).

Run: `pnpm --filter @cl/web test`
Expected: ~178 tests, all green (previous 148 + ~30 new across Tasks 2–9).

Run: `pnpm -r typecheck && pnpm --filter @cl/web build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A apps/web/src
git commit -m "feat(web): Calendario module — month grid, day panel, event CRUD, competenza filter"
```

---

### Task 10: README — Calendario capabilities

**Files:**
- Modify: `apps/web/README.md`

- [ ] **Step 1: Document the module**

In `apps/web/README.md`, after the "Section capabilities (Plan 2)" section, add:

```markdown
## Calendario (Plan 3)

Studio-wide agenda replacing the former stub (legacy `Calendar.mxml`):

- **Month grid** — 6 fixed weeks, Monday-first; events as chips coloured by calendar layer
  (Scadenze / Assemblee / Manutenzioni / Studio); weekend, today and selected-day tinting.
- **Right panel** — per-day list (Ora, Descrizione, Stato, Priorità) and a read-only
  "Dettagli scadenza" card for the selected event.
- **Toolbar** — Aggiungi / Modifica / Rimuovi scadenza (add/edit via single-step dialog with
  veto-close on errors), month prev/next plus Mese/Anno selects, and the
  Tutte/Competenza filter (Competenza = only events linked to the accounting period
  currently selected in Condomini).
- **Fixtures read true across modules** — calendar dates mirror the F24 deadlines (Dati)
  and the installment expiries (Rate); `fixtures.test.ts` guards the alignment.
- Default visible month is **April 2011** (the fixture era's richest month) — a real
  adapter would default to the current month.
```

- [ ] **Step 2: Verify the suite one more time**

Run: `pnpm --filter @cl/web test && pnpm -r typecheck`
Expected: green.

- [ ] **Step 3: Commit**

```bash
git add apps/web/README.md
git commit -m "docs(web): README — Plan 3 Calendario capabilities"
```

---

## Plan self-review (already performed by the author)

- **Spec coverage (§5.1):** month grid w/ ~42 cells, chips by layer, weekend/today tint, day selection → Tasks 5–6; right panel day list + details form → Task 7; toolbar month nav + month/year picker, add/edit/delete dialog, Competenza/Tutte filter → Tasks 8–9; fixtures tied to Saturno/Pozzetto deadlines → Task 2. §5.3 runtime slice → Task 4. §6 "calendar add-event appears in the month cell" → Task 9 test 3. §4 success criteria (no stub module, all buttons act or toast) → Task 9.
- **Deliberately out of scope (consistent with the Plan-2 deferral list):** layer CRUD, week/day views (legacy had icons; not in spec), event drag-and-drop, promotion of the Competenza filter / selected-event into the runtime, replacing the `useSelectedRow(CondominiSection)` type with a wider key set.
- **Type consistency check:** `CalendarEvent`/`CalendarLayer` names match across types → ports → store → runtime → components; `uniqueEventId(description, existing)` matches its test; `shiftMonth`/`monthCells`/`MONTHS`/`WEEKDAYS` exports match imports in Tasks 6 and 9.
