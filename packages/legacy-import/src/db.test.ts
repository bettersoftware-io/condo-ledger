import { describe, it, expect } from "vitest";
import { buildDb } from "./db.ts";
import type { Tables } from "./loadRows.ts";

const tables: Tables = {
  condominium: [
    { id: "1", code: "SAT", name: "Saturno", status: "active", type: "regular", address: null, taxCode: "TC1", vatNumber: null, parentCondominiumId: null },
    { id: "9", code: null, name: "Pozzetto x test", status: "active", type: "regular", address: null, taxCode: null, vatNumber: null, parentCondominiumId: null },
    { id: "7", code: "EMP", name: "Empty", status: "active", type: "regular", address: null, taxCode: null, vatNumber: null, parentCondominiumId: null },
  ],
  accountingPeriod: [
    { id: "1", condominiumId: "1", name: "2011", type: "ordinary", status: "opened", startDate: "2011-01-01", endDate: "2011-12-31" },
    { id: "9", condominiumId: "9", name: "2012", type: "ordinary", status: "opened", startDate: "2012-01-01", endDate: "2012-12-31" },
    { id: "70", condominiumId: "7", name: "2012", type: "ordinary", status: "opened", startDate: "2012-01-01", endDate: "2012-12-31" },
  ],
  unit: [{ id: "100", accountingPeriodId: "1", code: "A01", name: "Alberi", unitTypeId: "1", unitGroupId: null, floor: "T", innerNumber: "1", subordinateNumber: null, periodRestrictionStartDate: null, periodRestrictionEndDate: null }],
};

describe("buildDb selection", () => {
  it("keeps real condominiums with ≥1 unit, drops test/code-null-numbered-dupe and empty ones", () => {
    const db = buildDb(tables);
    const ids = db.condominiums.map((c) => c.id);
    expect(ids).toEqual(["1"]); // SAT kept; "Pozzetto x test" (name has test) + "Empty" (0 units) dropped
    expect(db.periodsOf("1").map((p) => p.id)).toEqual(["1"]);
  });

  it("keeps code-null buildings with units and super-condos, drops numbered dupes and test rows", () => {
    const fixture: Tables = {
      condominium: [
        // Real code-null building with units — must be KEPT (Pozzetto-19 regression guard)
        { id: "19", code: null, name: "Pozzetto", status: "active", type: "regular", address: null, taxCode: null, vatNumber: null, parentCondominiumId: null },
        // Super-condominium with no periods/units — must be KEPT (Sole-13 regression guard)
        { id: "13", code: "SOL", name: "Sole", status: "active", type: "super", address: null, taxCode: "TC2", vatNumber: null, parentCondominiumId: null },
        // Regular building with 0 units — must be DROPPED
        { id: "30", code: "ZER", name: "Zerounits", status: "active", type: "regular", address: null, taxCode: null, vatNumber: null, parentCondominiumId: null },
        // Building with "test" in the name — must be DROPPED
        { id: "31", code: null, name: "Pozzetto x test", status: "active", type: "regular", address: null, taxCode: null, vatNumber: null, parentCondominiumId: null },
        // Code-null numbered duplicate — must be DROPPED
        { id: "20", code: null, name: "Pozzetto 2", status: "active", type: "regular", address: null, taxCode: null, vatNumber: null, parentCondominiumId: null },
      ],
      accountingPeriod: [
        { id: "100", condominiumId: "19", name: "2020", type: "ordinary", status: "opened", startDate: "2020-01-01", endDate: "2020-12-31" },
        { id: "101", condominiumId: "30", name: "2020", type: "ordinary", status: "opened", startDate: "2020-01-01", endDate: "2020-12-31" },
        { id: "102", condominiumId: "20", name: "2020", type: "ordinary", status: "opened", startDate: "2020-01-01", endDate: "2020-12-31" },
        { id: "103", condominiumId: "31", name: "2020", type: "ordinary", status: "opened", startDate: "2020-01-01", endDate: "2020-12-31" },
      ],
      unit: [
        { id: "200", accountingPeriodId: "100", code: "P01", name: "Unit1", unitTypeId: "1", unitGroupId: null, floor: "1", innerNumber: "1", subordinateNumber: null, periodRestrictionStartDate: null, periodRestrictionEndDate: null },
        { id: "201", accountingPeriodId: "102", code: "P02", name: "Unit2", unitTypeId: "1", unitGroupId: null, floor: "1", innerNumber: "2", subordinateNumber: null, periodRestrictionStartDate: null, periodRestrictionEndDate: null },
        { id: "202", accountingPeriodId: "103", code: "P03", name: "Unit3", unitTypeId: "1", unitGroupId: null, floor: "1", innerNumber: "3", subordinateNumber: null, periodRestrictionStartDate: null, periodRestrictionEndDate: null },
      ],
    };

    const db = buildDb(fixture);
    const ids = new Set(db.condominiums.map((c) => String(c.id)));

    // Kept: code-null building with units (19) + super-condo (13)
    expect(ids.has("19")).toBe(true);  // Pozzetto: code=null but has units
    expect(ids.has("13")).toBe(true);  // Sole: type=super, no direct units

    // Dropped: 0-unit regular (30), test-named (31), code-null numbered dupe (20)
    expect(ids.has("30")).toBe(false);
    expect(ids.has("31")).toBe(false);
    expect(ids.has("20")).toBe(false);

    expect(ids).toEqual(new Set(["13", "19"]));
  });
});
