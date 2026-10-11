import { describe, expect, it } from "vitest";

import { LOAD_ORDER } from "../etl/order.ts";

describe("LOAD_ORDER", () => {
  it("places reference parents before operational children", () => {
    expect(LOAD_ORDER.indexOf("studio")).toBeLessThan(
      LOAD_ORDER.indexOf("masterData"),
    );
    expect(LOAD_ORDER.indexOf("condominium")).toBeLessThan(
      LOAD_ORDER.indexOf("unit"),
    );
    expect(LOAD_ORDER.indexOf("unit")).toBeLessThan(
      LOAD_ORDER.indexOf("unitPeriod"),
    );
    expect(LOAD_ORDER.indexOf("unitPeriod")).toBeLessThan(
      LOAD_ORDER.indexOf("unitResident"),
    );
  });
  it("has no duplicates", () => {
    expect(new Set(LOAD_ORDER).size).toBe(LOAD_ORDER.length);
  });
});
