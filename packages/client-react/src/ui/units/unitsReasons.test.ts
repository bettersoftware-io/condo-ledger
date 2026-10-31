import { describe, expect, it } from "vitest";

import { rejected } from "@cl/domain";

import { unitsReasonText } from "./unitsReasons.ts";

describe("unitsReasonText", () => {
  it.each([
    ["blank-code", "Enter a code"],
    ["blank-name", "Enter a name"],
    ["bad-dates", "The end date is before the start date"],
    ["group-not-empty", "Move or delete its units and groups first"],
    ["no-contact", "Choose a contact"],
    ["not-a-date", "Enter a date as day/month/year"],
    ["not-an-amount", "Enter an amount"],
    ["saving", "Saving…"],
  ])("words %s", (reason, text) => {
    expect(unitsReasonText(rejected(reason))).toBe(text);
  });

  it("names the group's code and name as typed when either is taken", () => {
    expect(
      unitsReasonText(rejected("group-taken", "A"), {
        code: "A",
        name: "Stairwell A",
      }),
    ).toBe("A group with code A or name Stairwell A is already in this group");
  });

  it("names the taken unit code from the detail", () => {
    expect(unitsReasonText(rejected("unit-code-taken", "A1"))).toBe(
      "Another unit of this period has the code A1",
    );
  });

  it("names the period's dates for dates outside it", () => {
    expect(
      unitsReasonText(rejected("outside-period"), {
        period: { start: "2011-01-01", end: "2011-12-31" },
      }),
    ).toBe("The dates must lie within the period (01/01/2011 - 31/12/2011)");
  });

  it("names the contact already living in the unit by their name", () => {
    expect(
      unitsReasonText(rejected("already-resident", "md7"), {
        contactName: (contactId: string): string => {
          return `contact ${contactId}`;
        },
      }),
    ).toBe("contact md7 already lives in this unit");
  });

  it("names the resident the journal or the installments hold", () => {
    expect(unitsReasonText(rejected("named-in-journal", "Resident"))).toBe(
      "Resident is named in the journal: delete those entries first",
    );
    expect(unitsReasonText(rejected("has-installments", "Resident"))).toBe(
      "Resident has installments: delete those first",
    );
  });

  it("falls back to the detail, then to nothing, when the subject is not given", () => {
    expect(unitsReasonText(rejected("group-taken", "A"))).toBe(
      "A group with code A or name A is already in this group",
    );
    expect(unitsReasonText(rejected("already-resident", "md7"))).toBe(
      "md7 already lives in this unit",
    );
    expect(unitsReasonText(rejected("outside-period"))).toBe(
      "The dates must lie within the period",
    );
    expect(unitsReasonText(rejected("unit-code-taken"))).toBe(
      "Another unit of this period has the code ",
    );
  });

  it("shows a reason no one words as it is", () => {
    expect(unitsReasonText(rejected("unknown-unit"))).toBe("unknown-unit");
  });
});
