import { describe, expect, it } from "vitest";

import { fixedClock } from "./fixedClock.ts";

describe("fixedClock", () => {
  it("always answers the same moment", () => {
    const clock = fixedClock("2026-10-14T08:00:00Z");

    expect(clock.now().toISOString()).toBe("2026-10-14T08:00:00.000Z");
    expect(clock.now()).not.toBe(clock.now());
  });

  it("refuses a text that is not a moment", () => {
    expect(() => {
      return fixedClock("not a moment");
    }).toThrow("not a moment: not a moment");
  });
});
