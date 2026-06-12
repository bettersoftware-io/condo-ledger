import { describe, it, expect } from "vitest";
import { monthCells, shiftMonth, MONTHS, WEEKDAYS } from "./monthGridHelpers";

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
  it("a Monday-start month has zero leading padding", () => {
    const cells = monthCells("2018-01"); // 1 Jan 2018 is a Monday
    expect(cells[0]!.iso).toBe("2018-01-01");
    expect(cells[0]!.inMonth).toBe(true);
  });
  it("December trailing cells spill into January and are flagged outside", () => {
    const cells = monthCells("2011-12"); // 1 Dec 2011 is a Thursday → offset 3
    expect(cells[3]!.iso).toBe("2011-12-01");
    const jan1 = cells.find((c) => c.iso === "2012-01-01");
    expect(jan1?.inMonth).toBe(false);
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
