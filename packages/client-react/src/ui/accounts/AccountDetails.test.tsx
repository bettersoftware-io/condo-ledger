import { describe, expect, it } from "vitest";

import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";

import { mountAccountDetails } from "./AccountDetails.page.tsx";

describe("AccountDetails", () => {
  it("shows a cost account with its path, attributes and balances", async () => {
    const page = mountAccountDetails();

    await page.select("la21");

    expect(page.valueOf("Account")).toBe(
      "Total › Costs › Spese generali › Ascensore",
    );
    expect(page.toneOf("Account")).toBe("accent");
    expect(page.valueOf("Account type")).toBe("Movable");
    expect(page.valueOf("Account nature")).toBe("Cost");
    expect(page.valueOf("Default contra-account")).toBe(PARENT);
    expect(page.valueOf("Period restriction")).toBe(PARENT);

    expect(page.hasGroup("COST ACCOUNT ATTRIBUTES")).toBe(true);
    expect(page.valueOf("Allocation restriction on a group")).toBe(PARENT);
    expect(page.valueOf("Allocation on ownership change")).toBe(
      "By accrual days (uses parent account settings)",
    );
    expect(page.valueOf("Default tax deduction")).toBe(
      "- uses parent account settings -",
    );
    expect(page.valueOf("Next-period budget calculation")).toBe(
      "110% of budget (uses parent account settings)",
    );
    expect(
      page.checkboxOf("Separate tables for budget & final balance"),
    ).toEqual({ checked: false, disabled: true });
    expect(
      page.textOf("ALLOCATION TABLES (USES PARENT ACCOUNT SETTINGS)"),
    ).toBe("No tables linked — uses parent account settings.");

    expect(page.valueOf("Debit")).toBe("360.18");
    expect(page.toneOf("Debit")).toBe("mono");
    expect(page.valueOf("Credit")).toBe("0.00");
    expect(page.toneOf("Credit")).toBe("mono");
    expect(page.valueOf("Balance")).toBe("360.18");
    expect(page.toneOf("Balance")).toBe("num");
    expect(page.valueOf("Budget")).toBe("1,000.00");
    expect(page.toneOf("Budget")).toBe("mono");
    expect(page.valueOf("System ID")).toBe("21");
    expect(page.toneOf("System ID")).toBe("mono");
    expect(page.valueOf("Created on")).toBe("---");
    expect(page.toneOf("Created on")).toBe("muted");
  });

  it("shows Total without the cost attributes and with no system id", () => {
    const page = mountAccountDetails();

    expect(page.valueOf("Account")).toBe("Total");
    expect(page.valueOf("Account type")).toBe("Non-movable / grouping");
    expect(page.hasGroup("COST ACCOUNT ATTRIBUTES")).toBe(false);
    expect(
      page.hasGroup("ALLOCATION TABLES (USES PARENT ACCOUNT SETTINGS)"),
    ).toBe(false);
    expect(page.labels()).not.toContain(
      "Separate tables for budget & final balance",
    );
    expect(page.valueOf("Budget")).toBe("1,500.00");
    expect(page.valueOf("System ID")).toBe("—");
  });

  it("shows --- for an account with no budget", async () => {
    const page = mountAccountDetails();

    await page.select("la3");

    expect(page.valueOf("Budget")).toBe("---");
    expect(page.toneOf("Budget")).toBe("muted");
  });

  it("shows nothing before a period is chosen", () => {
    const page = mountAccountDetails({ ...createSmallSeed(), buildings: [] });

    expect(page.labels()).toEqual([]);
  });
});

const PARENT = "-None- (uses parent account settings)";
