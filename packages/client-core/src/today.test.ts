import { describe, expect, it } from "vitest";

import { fixedClock } from "@cl/domain";

import { todayOf } from "./today.ts";

describe("todayOf", () => {
  it("is the Rome date of the clock's moment", () => {
    expect(todayOf(fixedClock("2026-10-14T08:00:00Z"))).toBe("2026-10-14");
  });

  it("is already the next day in Rome late in the evening", () => {
    expect(todayOf(fixedClock("2026-10-14T22:30:00Z"))).toBe("2026-10-15");
  });
});
