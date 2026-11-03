import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import type { Building } from "#/entities/building.ts";
import type { DeadlineDraft } from "#/useCases/calendar/validateDeadline.ts";

import { createSmallSeed } from "../testing/createSmallBooks.ts";
import { createCalendarSimulator } from "./calendarSimulator.ts";

describe("calendar simulator", () => {
  it("starts from an empty seed and numbers the first deadline ce1", async () => {
    const seed = createSmallSeed();
    const port = createCalendarSimulator(seed, () => {
      return seed.buildings;
    });

    expect(await firstValueFrom(port.deadlines())).toEqual([]);
    expect(await port.addDeadline(createDraft())).toEqual({
      ok: true,
      value: { id: "ce1" },
    });
  });

  it("judges a write against the buildings as they stand when it asks", async () => {
    const seed = createSmallSeed();
    let held: Building[] = [];
    const port = createCalendarSimulator(seed, () => {
      return held;
    });

    expect(await port.addDeadline(createDraft())).toEqual({
      ok: false,
      reason: "unknown-building",
      detail: "c1",
    });

    held = seed.buildings;

    expect(await port.addDeadline(createDraft())).toMatchObject({ ok: true });
  });
});

function createDraft(): DeadlineDraft {
  return {
    date: "2026-11-05",
    time: null,
    calendar: "general",
    buildingId: "c1",
    description: "Call the plumber",
    status: "new",
    priority: "low",
    notes: null,
  };
}
