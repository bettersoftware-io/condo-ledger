import { describe, expect, it } from "vitest";

import { loadLegacySeed } from "@cl/domain";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";
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

  it("on p36, la173 shows the link it inherits from its grouping: General, PR/NP/LE 100%", async () => {
    const page = mountAccountDetails(loadLegacySeed(legacySeedData), "p36");

    await page.select("la173");

    expect(
      page.hasGroup("ALLOCATION TABLES (USES PARENT ACCOUNT SETTINGS)"),
    ).toBe(true);
    expect(page.tables.headers()).toEqual([
      "%",
      "Table",
      "PR/NP/LE",
      "US/CF",
      "CO",
      "SC",
      "Table restr. on group",
    ]);
    expect(page.tables.rows()).toEqual([
      ["-", "General", "100%", "-", "-", "-", "-None-"],
    ]);
    expect(
      page.checkboxOf("Separate tables for budget & final balance"),
    ).toEqual({ checked: false, disabled: true });
    expect(page.valueOf("Separate tables for budget & final balance")).toBe(
      "(uses parent account settings)",
    );
  });

  it("on p1, Water inherits two links, one for the budget and one for the final balance: separate tables", async () => {
    const page = mountAccountDetails(loadLegacySeed(legacySeedData), "p1");

    await page.select("la44");

    expect(
      page.checkboxOf("Separate tables for budget & final balance"),
    ).toEqual({ checked: true, disabled: true });
    expect(page.tables.rows().map(tableOf)).toEqual([
      "Water budget",
      "Water actual",
    ]);
  });

  it("an account's own links read as its own: no parent's settings", async () => {
    const page = mountAccountDetails(loadLegacySeed(legacySeedData), "p1");

    await page.select("la28");

    expect(page.hasGroup("ALLOCATION TABLES")).toBe(true);
    expect(
      page.hasGroup("ALLOCATION TABLES (USES PARENT ACCOUNT SETTINGS)"),
    ).toBe(false);
    expect(page.tables.rows().map(tableOf)).toEqual(["Property"]);
    expect(page.valueOf("Separate tables for budget & final balance")).toBe("");
  });

  it("an account with no link up its chain keeps the empty state", async () => {
    const page = mountAccountDetails(loadLegacySeed(legacySeedData), "p1");

    await page.select("la47");

    expect(
      page.textOf("ALLOCATION TABLES (USES PARENT ACCOUNT SETTINGS)"),
    ).toBe("No tables linked — uses parent account settings.");
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

function tableOf(row: string[]): string {
  return row[1] ?? "";
}
