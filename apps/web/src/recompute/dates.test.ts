import { describe, it, expect } from "vitest";
import { addMonths, formatItDate } from "./dates";

describe("dates", () => {
  it("addMonths advances ISO dates, clamping the day", () => {
    expect(addMonths("2011-01-31", 1)).toBe("2011-02-28");
    expect(addMonths("2011-03-15", 4)).toBe("2011-07-15");
  });
  it("formatItDate renders dd/mm/yyyy", () => {
    expect(formatItDate("2011-07-15")).toBe("15/07/2011");
  });
});
