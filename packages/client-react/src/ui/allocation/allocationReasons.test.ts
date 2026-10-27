import { describe, expect, it } from "vitest";

import { rejected } from "@cl/domain";

import { allocationReasonText } from "./allocationReasons.ts";

describe("allocationReasonText", () => {
  it("words a coefficient that does not read, or is negative", () => {
    expect(allocationReasonText(rejected("not-a-coefficient"))).toBe(
      "Enter a coefficient of zero or more, with at most 4 decimals",
    );
  });

  it("words the table dialog's refusals, naming the table typed", () => {
    expect(allocationReasonText(rejected("blank-name"))).toBe(
      "A table needs a name",
    );
    expect(
      allocationReasonText(rejected("name-taken"), { table: "Scale" }),
    ).toBe("A table named Scale already exists");
    expect(allocationReasonText(rejected("bad-order"))).toBe(
      "Enter the order as a whole number from 1",
    );
  });

  it("words a delete refused for a linked table, with the account's path", () => {
    expect(
      allocationReasonText(rejected("table-linked", "la28"), {
        table: "Proprietà",
        accountPath: "Total › Costs › Spese generali",
      }),
    ).toBe(
      "Proprietà allocates Total › Costs › Spese generali; unlink it first",
    );
  });

  it("names the account by its id when no path is given", () => {
    expect(allocationReasonText(rejected("unallocated-budget", "la43"))).toBe(
      "la43 has a budget but no table to allocate it",
    );
  });

  it("words the Budget allocation wizard's refusals", () => {
    expect(allocationReasonText(rejected("allocation-exists"))).toBe(
      "This period already has a budget allocation; delete it first",
    );
    expect(
      allocationReasonText(rejected("unallocated-budget", "la43"), {
        accountPath: "Total › Costs › Consumi",
      }),
    ).toBe("Total › Costs › Consumi has a budget but no table to allocate it");
    expect(allocationReasonText(rejected("no-budget"))).toBe(
      "There is no budget to allocate",
    );
    expect(allocationReasonText(rejected("blank-description"))).toBe(
      "A description is required",
    );
  });

  it.each([
    ["owners", "This period has no owners' account"],
    ["roundings", "This period has no roundings account"],
    [
      "budgetAllocation",
      "This period has no budget allocation revenue account",
    ],
  ])("words the missing %s account", (role, text) => {
    expect(allocationReasonText(rejected("missing-account", role))).toBe(text);
  });

  it("leaves the wizards' common reasons to their words, and any other as it is", () => {
    expect(allocationReasonText(rejected("saving"))).toBe("Saving…");
    expect(allocationReasonText(rejected("unheard-of"))).toBe("unheard-of");
  });
});
