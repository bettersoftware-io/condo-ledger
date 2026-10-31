import { describe, expect, it } from "vitest";

import { type Building, type Period, periodLabelText } from "./building.ts";

describe("periodLabelText", () => {
  it("reads '{building} / {period} ({address})'", () => {
    expect(
      periodLabelText(
        createBuilding({
          street: "Via Roma, 1",
          postcode: "33100",
          city: "Udine",
        }),
        createPeriod(),
      ),
    ).toBe("Pozzetto / 2013 (Via Roma, 1, 33100 Udine)");
  });

  it("leaves out the address of a building that has none", () => {
    expect(periodLabelText(createBuilding(null), createPeriod())).toBe(
      "Pozzetto / 2013",
    );
  });
});

function createBuilding(address: Building["address"]): Building {
  return {
    id: "c1",
    name: "Pozzetto",
    code: null,
    type: "building",
    status: "active",
    address,
    taxCode: null,
    constructionDate: null,
    cadastralData: null,
    notes: null,
    createdOn: "2011-01-01 00:00:00",
    modifiedOn: "2011-01-01 00:00:00",
    periods: [],
  };
}

function createPeriod(): Period {
  return {
    id: "p1",
    name: "2013",
    type: "ordinary",
    start: "2013-01-01",
    end: "2013-12-31",
    closed: false,
    notes: null,
  };
}
