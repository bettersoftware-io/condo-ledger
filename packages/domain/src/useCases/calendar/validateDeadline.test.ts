import { describe, expect, it } from "vitest";

import type { Building } from "#/entities/building.ts";
import { createSmallSeed } from "#/testing/createSmallBooks.ts";

import { type DeadlineDraft, validateDeadline } from "./validateDeadline.ts";

describe("validateDeadline", () => {
  it("accepts a complete draft, with or without a time and a building", () => {
    expect(validateDeadline(createDraft(), buildings())).toEqual({ ok: true });
    expect(
      validateDeadline(
        createDraft({ time: null, buildingId: null }),
        buildings(),
      ),
    ).toEqual({ ok: true });
  });

  it("refuses a blank description, after trimming", () => {
    expect(
      validateDeadline(createDraft({ description: "  \t " }), buildings()),
    ).toEqual({ ok: false, reason: "blank-description" });
  });

  it("takes 255 characters and refuses 256, counting the trimmed text", () => {
    expect(
      validateDeadline(
        createDraft({ description: ` ${"a".repeat(255)} ` }),
        buildings(),
      ),
    ).toEqual({ ok: true });
    expect(
      validateDeadline(
        createDraft({ description: "a".repeat(256) }),
        buildings(),
      ),
    ).toEqual({ ok: false, reason: "description-too-long" });
  });

  it.each(["2026-02-29", "2026-13-01", "", "2026-1-01", "2026-04-31"])(
    "refuses the date %j",
    (date) => {
      expect(validateDeadline(createDraft({ date }), buildings())).toEqual({
        ok: false,
        reason: "bad-date",
      });
    },
  );

  it("accepts a leap day", () => {
    expect(
      validateDeadline(createDraft({ date: "2028-02-29" }), buildings()),
    ).toEqual({ ok: true });
  });

  it.each(["00:00", "23:59", "09:30"])("accepts the time %s", (time) => {
    expect(validateDeadline(createDraft({ time }), buildings())).toEqual({
      ok: true,
    });
  });

  it.each(["24:00", "9:30", "12:60", "", "12:5", "ab:cd"])(
    "refuses the time %j",
    (time) => {
      expect(validateDeadline(createDraft({ time }), buildings())).toEqual({
        ok: false,
        reason: "bad-time",
      });
    },
  );

  it.each(["installments", "invoices"] as const)(
    "refuses the calendar %s",
    (calendar) => {
      expect(validateDeadline(createDraft({ calendar }), buildings())).toEqual({
        ok: false,
        reason: "books-calendar",
      });
    },
  );

  it.each(["fiscal", "policies", "interventions", "general"] as const)(
    "accepts the calendar %s",
    (calendar) => {
      expect(validateDeadline(createDraft({ calendar }), buildings())).toEqual({
        ok: true,
      });
    },
  );

  it("refuses a building the app does not have, naming it", () => {
    expect(
      validateDeadline(createDraft({ buildingId: "c-none" }), buildings()),
    ).toEqual({ ok: false, reason: "unknown-building", detail: "c-none" });
  });

  it("names the first refusal, in the order of the fields", () => {
    expect(
      validateDeadline(
        createDraft({
          description: "",
          date: "x",
          time: "x",
          calendar: "invoices",
          buildingId: "c-none",
        }),
        buildings(),
      ),
    ).toEqual({ ok: false, reason: "blank-description" });
    expect(
      validateDeadline(
        createDraft({ date: "x", time: "x", calendar: "invoices" }),
        buildings(),
      ),
    ).toEqual({ ok: false, reason: "bad-date" });
    expect(
      validateDeadline(
        createDraft({ time: "x", calendar: "invoices", buildingId: "c-none" }),
        buildings(),
      ),
    ).toEqual({ ok: false, reason: "bad-time" });
    expect(
      validateDeadline(
        createDraft({ calendar: "invoices", buildingId: "c-none" }),
        buildings(),
      ),
    ).toEqual({ ok: false, reason: "books-calendar" });
  });
});

function buildings(): Building[] {
  return createSmallSeed().buildings;
}

function createDraft(parts: Partial<DeadlineDraft> = {}): DeadlineDraft {
  return {
    date: "2026-11-05",
    time: "10:30",
    calendar: "fiscal",
    buildingId: "c1",
    description: "File the return",
    status: "new",
    priority: "none",
    notes: null,
    ...parts,
  };
}
