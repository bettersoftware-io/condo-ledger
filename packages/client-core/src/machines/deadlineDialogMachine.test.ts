import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import { fixedClock, type ManualDeadline } from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import { createAppHarness } from "#/testing/appHarness.ts";
import { disposeAfterEach } from "#/testing/disposeAfterEach.ts";

describe("the deadline dialog", () => {
  it("opens a new deadline on the day given, the filter's building, General, New, no priority", () => {
    const { app } = createAppHarness(undefined, CLOCK);
    const machine = track(
      app.machines.createDeadlineDialog({
        mode: "add",
        day: "2026-02-20",
        buildingId: "c1",
      }),
    );

    expect(machine.state$.getValue()).toMatchObject({
      editing: null,
      canSave: false,
      field: "description",
      form: {
        description: "",
        date: "20/02/2026",
        time: "",
        calendar: "general",
        buildingId: "c1",
        status: "new",
        priority: "none",
        notes: "",
      },
    });
    expect(machine.state$.getValue().buildings.length).toBeGreaterThan(0);
  });

  it("tells the date the typed one reads as, and none while it does not read", () => {
    const { app } = createAppHarness(undefined, CLOCK);
    const machine = track(
      app.machines.createDeadlineDialog({
        mode: "add",
        day: "2026-02-20",
        buildingId: null,
      }),
    );

    expect(machine.state$.getValue().dateRead).toBe("2026-02-20");

    machine.intents.edit({ date: "5/3" });

    expect(machine.state$.getValue().dateRead).toBe("2026-03-05");

    machine.intents.edit({ date: "31/02/2026" });

    expect(machine.state$.getValue().dateRead).toBeNull();
  });

  it("opens an edit on the deadline as it stands", async () => {
    const { app, ports } = createAppHarness(undefined, CLOCK);
    const deadline = await firstDeadline(ports.calendar.deadlines());
    const machine = track(
      app.machines.createDeadlineDialog({ mode: "edit", deadline }),
    );
    const state = machine.state$.getValue();

    expect(state).toMatchObject({
      editing: deadline.id,
      canSave: true,
      field: null,
      verdict: { ok: true },
    });
    expect(state.form).toEqual({
      description: deadline.description,
      date: `${deadline.date.slice(8)}/${deadline.date.slice(5, 7)}/${deadline.date.slice(0, 4)}`,
      time: deadline.time ?? "",
      calendar: deadline.calendar,
      buildingId: deadline.buildingId,
      status: deadline.status,
      priority: deadline.priority,
      notes: deadline.notes ?? "",
    });
  });

  it("names the field each refusal belongs to, and writes nothing", async () => {
    const { app, ports } = createAppHarness(undefined, CLOCK);
    const before = await firstValueFrom(ports.calendar.deadlines());
    const machine = track(
      app.machines.createDeadlineDialog({
        mode: "add",
        day: "2026-02-20",
        buildingId: null,
      }),
    );

    machine.intents.edit({ description: "Lift inspection" });

    expect(machine.state$.getValue()).toMatchObject({
      field: null,
      canSave: true,
    });

    const cases = [
      [
        { description: "  ", date: "20/02/2026" },
        "blank-description",
        "description",
      ],
      [{ description: "x".repeat(256) }, "description-too-long", "description"],
      [{ description: "Lift", date: "31/02/2026" }, "bad-date", "date"],
      [{ date: "20/02/2026", time: "25:00" }, "bad-time", "time"],
      [{ time: "", calendar: "installments" }, "books-calendar", "calendar"],
      [
        { calendar: "general", buildingId: "nope" },
        "unknown-building",
        "buildingId",
      ],
    ] as const;

    for (const [patch, reason, field] of cases) {
      machine.intents.edit(patch);

      expect(machine.state$.getValue()).toMatchObject({
        verdict: { ok: false, reason },
        field,
      });

      const saved = await machine.intents.save();

      expect(saved).toMatchObject({ ok: false, reason });
    }

    expect(machine.state$.getValue().saving).toBe(false);
    expect(await firstValueFrom(ports.calendar.deadlines())).toEqual(before);
  });

  it("a saved add writes through the port and reveals the new id on its day", async () => {
    const { app, ports } = createAppHarness(undefined, CLOCK);
    const calendarView = app.presenters.calendar.view$.subscribe();
    const machine = track(
      app.machines.createDeadlineDialog({
        mode: "add",
        day: "2026-02-20",
        buildingId: null,
      }),
    );

    machine.intents.edit({
      description: "Lift inspection",
      time: "09:30",
      notes: "  bring keys ",
      priority: "high",
    });

    expect((await machine.intents.save()).ok).toBe(true);

    const held = await firstValueFrom(ports.calendar.deadlines());
    const created = must(
      held.find((deadline) => {
        return deadline.description === "Lift inspection";
      }),
      "the saved deadline",
    );
    const id = created.id;

    expect(id).toMatch(/^ce\d+$/);
    expect(created).toEqual({
      id,
      date: "2026-02-20",
      time: "09:30",
      calendar: "general",
      buildingId: null,
      description: "Lift inspection",
      status: "new",
      priority: "high",
      notes: "bring keys",
    });

    const view = must(app.presenters.calendar.view$.getValue(), "the view");

    expect(view).toMatchObject({ month: "2026-02", day: "2026-02-20" });
    expect(view.selected?.id).toBe(id);
    calendarView.unsubscribe();
  });

  it("a saved edit writes the change and reveals the deadline on its new day", async () => {
    const { app, ports } = createAppHarness(undefined, CLOCK);
    const calendarView = app.presenters.calendar.view$.subscribe();
    const deadline = await firstDeadline(ports.calendar.deadlines());
    const machine = track(
      app.machines.createDeadlineDialog({ mode: "edit", deadline }),
    );

    machine.intents.edit({ date: "3/4", status: "closed" });

    expect((await machine.intents.save()).ok).toBe(true);

    const held = await firstValueFrom(ports.calendar.deadlines());

    expect(
      held.find((each) => {
        return each.id === deadline.id;
      }),
    ).toMatchObject({
      date: "2026-04-03",
      status: "closed",
    });
    expect(app.presenters.calendar.view$.getValue()).toMatchObject({
      month: "2026-04",
      day: "2026-04-03",
    });
    calendarView.unsubscribe();
  });

  it("Cancel is disposing: nothing is written", async () => {
    const { app, ports } = createAppHarness(undefined, CLOCK);
    const before = await firstValueFrom(ports.calendar.deadlines());
    const machine = app.machines.createDeadlineDialog({
      mode: "add",
      day: "2026-02-20",
      buildingId: null,
    });

    machine.intents.edit({ description: "Never saved" });
    machine.dispose();

    expect(await firstValueFrom(ports.calendar.deadlines())).toEqual(before);
  });
});

async function firstDeadline(
  deadlines$: ReturnType<
    ReturnType<typeof createAppHarness>["ports"]["calendar"]["deadlines"]
  >,
): Promise<ManualDeadline> {
  const deadlines = await firstValueFrom(deadlines$);

  return must(deadlines[0], "a seeded deadline");
}

const track = disposeAfterEach();

const CLOCK = fixedClock("2026-02-14T08:00:00Z");
