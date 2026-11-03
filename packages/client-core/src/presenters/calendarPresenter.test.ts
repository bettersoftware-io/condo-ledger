import { firstValueFrom } from "rxjs";
import { describe, expect, it, onTestFinished } from "vitest";

import {
  type Building,
  type BuildingDraft,
  type ClockPort,
  type Deadline,
  fixedClock,
  type JournalEntry,
  loadLegacySeed,
  nameOf,
} from "@cl/domain";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";
import { must } from "@cl/domain/support/must.ts";
import type { DeadlineDraft } from "@cl/domain/useCases/calendar/validateDeadline.ts";

import { type AppHarness, createAppHarness } from "#/testing/appHarness.ts";

import {
  type CalendarPresenter,
  type CalendarView,
  createCalendarPresenter,
} from "./calendarPresenter.ts";

describe("the calendar presenter", () => {
  it("opens on today's month, today selected and its first deadline", () => {
    const { view } = createWatchedCalendar();

    expect(view()).toMatchObject({
      today: "2026-02-14",
      month: "2026-02",
      day: "2026-02-14",
    });
    expect(view().weeks).toHaveLength(5);
    expect(idsOf(view().dayDeadlines)).toEqual(["ce23"]);
    expect(view().selected?.id).toBe("ce23");
    expect(idsOf(view().byDay.get("2026-02-20") ?? [])).toEqual([
      "installment:in26",
      "ce19",
    ]);
    expect(
      view().buildings.map((building) => {
        return building.id;
      }),
    ).toEqual(["c19", "c1"]);
  });

  it("reads today when the view is first subscribed, and again on Today", () => {
    const clock = createMovingClock("2026-02-14T08:00:00Z");
    const { app } = createAppHarness(undefined, clock);

    clock.moveTo("2026-03-03T08:00:00Z");

    const { view, calendar } = watch(app.presenters.calendar);

    expect(view()).toMatchObject({ today: "2026-03-03", day: "2026-03-03" });

    clock.moveTo("2026-04-01T08:00:00Z");
    calendar.nextMonth();

    expect(view().today).toBe("2026-03-03");

    calendar.goToToday();

    expect(view()).toMatchObject({
      today: "2026-04-01",
      month: "2026-04",
      day: "2026-04-01",
    });
  });

  it("‹ from January 2026 goes to December 2025, keeping the day number", () => {
    const { view, calendar } = createWatchedCalendar();

    calendar.previousMonth();

    expect(view()).toMatchObject({ month: "2026-01", day: "2026-01-14" });

    calendar.previousMonth();

    expect(view()).toMatchObject({ month: "2025-12", day: "2025-12-14" });
  });

  it("› from 31 January goes to 28 February", () => {
    const { view, calendar } = createWatchedCalendar();

    calendar.previousMonth();
    calendar.selectDay("2026-01-31");
    calendar.nextMonth();

    expect(view()).toMatchObject({ month: "2026-02", day: "2026-02-28" });
    expect(view().selected?.id).toBe("ce13");
  });

  it("Today goes back to today's month and selects today", () => {
    const { view, calendar } = createWatchedCalendar();

    calendar.nextMonth();
    calendar.nextMonth();
    calendar.selectDay("2026-04-20");

    expect(view().selected?.id).toBe("installment:in28");

    calendar.goToToday();

    expect(view()).toMatchObject({ month: "2026-02", day: "2026-02-14" });
    expect(view().selected?.id).toBe("ce23");
  });

  it("selecting a day selects its first deadline; a deadline of it can be selected", () => {
    const { view, calendar } = createWatchedCalendar();

    calendar.selectDay("2026-02-20");

    expect(view().selected?.id).toBe("installment:in26");

    calendar.selectDeadline("ce19");

    expect(view().selected?.id).toBe("ce19");

    calendar.selectDay("2026-02-16");

    expect(view().dayDeadlines).toEqual([]);
    expect(view().selected).toBeNull();

    calendar.selectDay("2026-02-20");

    expect(view().selected?.id).toBe("installment:in26");
  });

  it("a month away and back selects the day's first deadline, not the one chosen before", () => {
    const { view, calendar } = createWatchedCalendar();

    calendar.selectDay("2026-02-20");
    calendar.selectDeadline("ce19");
    calendar.nextMonth();
    calendar.previousMonth();

    expect(view().day).toBe("2026-02-20");
    expect(view().selected?.id).toBe("installment:in26");
  });

  it("deleting the collection tx276 reopens Installment 1's deadline, and adding it back closes it", async () => {
    const { view, calendar, harness } = createWatchedCalendar();
    const collection = await entryOf(harness, "tx276");

    calendar.previousMonth();
    calendar.selectDay("2026-01-20");

    expect(view().selected).toMatchObject({
      id: "installment:in25",
      status: "closed",
    });

    expect((await harness.ports.journal.deleteEntry("tx276")).ok).toBe(true);

    expect(view().selected).toMatchObject({
      id: "installment:in25",
      status: "new",
    });

    expect(
      (
        await harness.ports.journal.addEntry("p36", {
          kind: collection.kind,
          description: collection.description,
          postings: collection.postings,
        })
      ).ok,
    ).toBe(true);

    expect(view().selected).toMatchObject({
      id: "installment:in25",
      status: "closed",
    });
  });

  it("deleting the registration tx122 takes invoice li19's deadline away", async () => {
    const { view, calendar, harness } = createWatchedCalendar();

    calendar.reveal("invoice:li19", "2026-04-30");

    expect(view().selected?.id).toBe("invoice:li19");

    expect((await harness.ports.journal.deleteEntry("tx122")).ok).toBe(true);

    expect(idsOf(view().dayDeadlines)).toEqual(["invoice:li20"]);
    expect(view().selected?.id).toBe("invoice:li20");
  });

  it("the selected deadline survives the books emitting", async () => {
    const { view, calendar, harness } = createWatchedCalendar();

    calendar.selectDay("2026-02-12");
    calendar.selectDeadline("invoice:li37");

    const before = must(view().selected, "the selected deadline");

    expect((await harness.ports.journal.deleteEntry("tx276")).ok).toBe(true);

    expect(view().selected).not.toBe(before);
    expect(view().selected?.id).toBe("invoice:li37");
  });

  it("the selected deadline goes when its calendar is hidden, and comes back when it is shown", () => {
    const { view, calendar } = createWatchedCalendar();

    calendar.selectDay("2026-02-20");
    calendar.selectDeadline("ce19");
    calendar.toggleCalendar("general");

    expect(view().filters.hidden).toEqual(new Set(["general"]));
    expect(idsOf(view().dayDeadlines)).toEqual(["installment:in26"]);
    expect(view().selected?.id).toBe("installment:in26");
    expect(view().byDay.has("2026-02-14")).toBe(false);

    calendar.toggleCalendar("general");

    expect(view().filters.hidden).toEqual(new Set());
    expect(view().selected?.id).toBe("ce19");
  });

  it("None hides every calendar and All shows them again", () => {
    const { view, calendar } = createWatchedCalendar();

    calendar.showNoCalendars();

    expect(view().filters.hidden).toEqual(
      new Set([
        "installments",
        "invoices",
        "fiscal",
        "policies",
        "interventions",
        "general",
      ]),
    );
    expect(view().byDay.size).toBe(0);
    expect(view().selected).toBeNull();

    calendar.showAllCalendars();

    expect(view().filters.hidden).toEqual(new Set());
    expect(view().selected?.id).toBe("ce23");
  });

  it("a deleted deadline lets the selection fall to the day's first", async () => {
    const { view, calendar } = createWatchedCalendar();

    calendar.selectDay("2026-02-20");
    calendar.selectDeadline("ce19");

    expect((await calendar.deleteDeadline("ce19")).ok).toBe(true);

    expect(view().selected?.id).toBe("installment:in26");
  });

  it("the Building filter on c1 hides Pozzetto's deadlines and the ones tied to no building", () => {
    const { view, calendar } = createWatchedCalendar();

    calendar.setBuilding("c1");

    expect(view().filters.buildingId).toBe("c1");
    expect(view().byDay.size).toBe(0);
    expect(view().selected).toBeNull();

    calendar.setBuilding("c19");

    expect(idsOf(view().byDay.get("2026-02-20") ?? [])).toEqual([
      "installment:in26",
    ]);

    calendar.setBuilding(null);

    expect(view().selected?.id).toBe("ce23");
  });

  it("a deadline tied to c1 shows under c1 and under every building, not under c19", async () => {
    const { view, calendar, harness } = createWatchedCalendar();
    const added = await harness.ports.calendar.addDeadline(
      createDraft({ date: "2026-02-16", buildingId: "c1" }),
    );
    const id = added.ok ? added.value.id : "";

    calendar.selectDay("2026-02-16");

    expect(idsOf(view().dayDeadlines)).toEqual([id]);

    calendar.setBuilding("c1");

    expect(idsOf(view().dayDeadlines)).toEqual([id]);

    calendar.setBuilding("c19");

    expect(view().dayDeadlines).toEqual([]);
  });

  it("reveal after an add moves the month to the deadline and selects it", async () => {
    const { view, calendar, harness } = createWatchedCalendar();
    const added = await harness.ports.calendar.addDeadline(
      createDraft({ date: "2026-05-20" }),
    );

    expect(added.ok).toBe(true);

    const id = added.ok ? added.value.id : "";

    calendar.reveal(id, "2026-05-20");

    expect(view()).toMatchObject({ month: "2026-05", day: "2026-05-20" });
    expect(idsOf(view().dayDeadlines)).toEqual(["installment:in29", id]);
    expect(view().selected?.id).toBe(id);
  });

  it("reveal shows the calendar of a deadline that its filter hides", async () => {
    const { view, calendar, harness } = createWatchedCalendar();
    const id = await addedId(harness, createDraft({ calendar: "fiscal" }));

    calendar.toggleCalendar("fiscal");
    calendar.reveal(id, "2026-02-16");

    expect(view().filters.hidden).toEqual(new Set());
    expect(view().selected?.id).toBe(id);
  });

  it("reveal sets the Building filter to All when it is another building's", async () => {
    const { view, calendar, harness } = createWatchedCalendar();
    const id = await addedId(harness, createDraft({ buildingId: null }));

    calendar.setBuilding("c1");
    calendar.reveal(id, "2026-02-16");

    expect(view().filters.buildingId).toBeNull();
    expect(view().selected?.id).toBe(id);
  });

  it("reveal keeps the filters that already show the deadline", async () => {
    const { view, calendar, harness } = createWatchedCalendar();
    const id = await addedId(harness, createDraft({ buildingId: "c1" }));

    calendar.toggleCalendar("policies");
    calendar.setBuilding("c1");
    calendar.reveal(id, "2026-02-16");

    expect(view().filters).toEqual({
      hidden: new Set(["policies"]),
      buildingId: "c1",
    });
    expect(view().selected?.id).toBe(id);
  });

  it("names a deadline's building, period and supplier", async () => {
    const { view, harness } = createWatchedCalendar();
    const contacts = await firstValueFrom(harness.ports.contacts.contacts());
    const supplier = must(
      contacts.find((contact) => {
        return contact.id === "md15";
      }),
      "the contact md15",
    );

    expect(view().names.buildingName("c19")).toBe("Pozzetto");
    expect(view().names.periodName("p36")).toBe("2026");
    expect(view().names.supplierName("md15")).toBe(nameOf(supplier));
    expect(view().names.buildingName("c404")).toBe("c404");
    expect(view().names.periodName("p404")).toBe("p404");
    expect(view().names.supplierName("md404")).toBe("md404");
  });

  it("with no building, shows the typed deadlines only", () => {
    const seed = loadLegacySeed(legacySeedData);
    const harness = createAppHarness(
      { ...seed, buildings: [] },
      fixedClock(POZZETTO_CLOCK),
    );
    const { view } = watch(harness.app.presenters.calendar);

    expect(view().buildings).toEqual([]);
    expect(idsOf(view().byDay.get("2026-02-20") ?? [])).toEqual(["ce19"]);
  });

  it("a renamed building is named anew, its periods' books not asked again", async () => {
    const harness = createAppHarness(undefined, fixedClock(POZZETTO_CLOCK));
    const asked: string[] = [];
    const { view, calendar } = watch(
      createCalendarPresenter(
        {
          ...harness.ports,
          installments: {
            ...harness.ports.installments,
            installments: (periodId: string) => {
              asked.push(periodId);

              return harness.ports.installments.installments(periodId);
            },
          },
        },
        harness.ports.clock,
      ),
    );

    expect(asked).toEqual(["p1", "p36"]);

    const pozzetto = must(
      view().buildings.find((building) => {
        return building.id === "c19";
      }),
      "Pozzetto",
    );

    calendar.selectDay("2026-02-20");

    expect(
      (
        await harness.ports.buildings.editBuilding("c19", {
          ...createBuildingDraft(pozzetto),
          name: "Pozzetto Due",
        })
      ).ok,
    ).toBe(true);

    expect(view().names.buildingName("c19")).toBe("Pozzetto Due");
    expect(idsOf(view().dayDeadlines)).toEqual(["installment:in26", "ce19"]);
    expect(asked).toEqual(["p1", "p36"]);
  });

  it("is null until subscribed, and intents before then start from today", () => {
    const harness = createAppHarness(undefined, fixedClock(POZZETTO_CLOCK));
    const { calendar } = harness.app.presenters;

    expect(calendar.view$.getValue()).toBeNull();

    calendar.nextMonth();

    const { view } = watch(calendar);

    expect(view()).toMatchObject({ month: "2026-03", day: "2026-03-14" });
  });
});

/** A clock a test moves by hand. */
interface MovingClock extends ClockPort {
  moveTo: (iso: string) => void;
}

/** The calendar presenter with a subscriber, and the latest view it saw. */
interface WatchedCalendar {
  calendar: CalendarPresenter;
  view: () => CalendarView;
}

interface WatchedHarness extends WatchedCalendar {
  harness: AppHarness;
}

/** The app's calendar presenter on the real seed, its clock inside Pozzetto 2026, watched until the test ends. */
function createWatchedCalendar(): WatchedHarness {
  const harness = createAppHarness(undefined, fixedClock(POZZETTO_CLOCK));

  return { ...watch(harness.app.presenters.calendar), harness };
}

function watch(calendar: CalendarPresenter): WatchedCalendar {
  const subscription = calendar.view$.subscribe();

  onTestFinished(() => {
    subscription.unsubscribe();
  });

  return {
    calendar,
    view: (): CalendarView => {
      return must(calendar.view$.getValue(), "the calendar view");
    },
  };
}

function createMovingClock(iso: string): MovingClock {
  let moment = new Date(iso);

  return {
    now: (): Date => {
      return moment;
    },
    moveTo: (next: string): void => {
      moment = new Date(next);
    },
  };
}

async function addedId(
  harness: AppHarness,
  draft: DeadlineDraft,
): Promise<string> {
  const added = await harness.ports.calendar.addDeadline(draft);

  return must(added.ok ? added.value.id : null, "the added deadline's id");
}

function createDraft(patch: Partial<DeadlineDraft>): DeadlineDraft {
  return {
    date: "2026-02-16",
    time: null,
    calendar: "general",
    buildingId: null,
    description: "Lift inspection",
    status: "new",
    priority: "none",
    notes: null,
    ...patch,
  };
}

function createBuildingDraft(building: Building): BuildingDraft {
  return {
    name: building.name,
    code: building.code,
    status: building.status,
    type: building.type,
    address: building.address,
    taxCode: building.taxCode,
    constructionDate: building.constructionDate,
    cadastralData: building.cadastralData,
    notes: building.notes,
  };
}

async function entryOf(harness: AppHarness, id: string): Promise<JournalEntry> {
  const entries = await firstValueFrom(harness.ports.journal.entries("p36"));

  return must(
    entries.find((entry) => {
      return entry.id === id;
    }),
    `the entry ${id}`,
  );
}

function idsOf(deadlines: Deadline[]): string[] {
  return deadlines.map((deadline) => {
    return deadline.id;
  });
}

/** Inside Pozzetto 2026 (c19, p36): 09:00 on 14 February in Rome. */
const POZZETTO_CLOCK = "2026-02-14T08:00:00Z";
