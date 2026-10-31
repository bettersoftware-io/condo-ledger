import { describe, expect, it } from "vitest";

import { rejected } from "@cl/domain";

import { buildingReasonText } from "./buildingReasons.ts";

describe("buildingReasonText", () => {
  it.each([
    ["blank-name", "Enter a name"],
    ["blank-street", "Enter the street and number"],
    ["bad-dates", "The end date is before the start date"],
    ["not-a-date", "Enter a date as day/month/year"],
    ["saving", "Saving…"],
  ])("words %s", (reason, text) => {
    expect(buildingReasonText(rejected(reason))).toBe(text);
  });

  it.each([
    ["building-name-taken", "Pozzetto", "Another building is named Pozzetto"],
    ["building-code-taken", "SAT", "Another building has the code SAT"],
    [
      "period-name-taken",
      "2013",
      "This building has another period named 2013",
    ],
    ["period-excludes", "A1", "A1 has dates outside these: change them first"],
  ])("words %s with its detail", (reason, detail, text) => {
    expect(buildingReasonText(rejected(reason, detail))).toBe(text);
  });

  it("names a resident the dates would cut as it names a unit", () => {
    expect(
      buildingReasonText(rejected("period-excludes", "the resident")),
    ).toBe("the resident has dates outside these: change them first");
  });
});
