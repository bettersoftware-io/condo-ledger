import { describe, expect, it } from "vitest";

import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";

import { mountLedgerTab } from "./LedgerTab.page.tsx";

describe("LedgerTab", () => {
  it("lists a leaf's postings with the running balance and the totals", async () => {
    const page = mountLedgerTab();

    await page.select("la21");

    expect(page.rows()).toEqual([
      [
        "10/01/2013 10:00",
        "1",
        "Fattura Alfa",
        "Total › Costs › Spese generali › Ascensore",
        "360.18",
        "0.00",
        "360.18",
      ],
    ]);
    expect(page.footer()).toEqual([
      "",
      "",
      "",
      "Total:",
      "360.18",
      "0.00",
      "360.18",
    ]);
  });

  it("lists every posting under Total, which balances", () => {
    const page = mountLedgerTab();

    expect(page.rows()).toHaveLength(20);
    expect(page.rows()[0]).toEqual([
      "05/01/2013 10:00",
      "9",
      "Fuori ordine",
      "Total › Patrimonial › (Assets) › Liquidità › Cassa",
      "1.00",
      "0.00",
      "1.00",
    ]);
    expect(page.footer()).toEqual([
      "",
      "",
      "",
      "Total:",
      "2,126.19",
      "2,126.19",
      "0.00",
    ]);
  });

  it("says so when the account has no posting", async () => {
    const page = mountLedgerTab();

    await page.select("la3");

    expect(page.rows()).toEqual([]);
    expect(page.emptyMessage()).toBe("No posting on this account.");
    expect(page.footer()).toEqual([
      "",
      "",
      "",
      "Total:",
      "0.00",
      "0.00",
      "0.00",
    ]);
  });

  it("a click on a line selects nothing", async () => {
    const page = mountLedgerTab();

    await page.clickRow(0);

    expect(page.isSelected(0)).toBe(false);
  });

  it("has no lines and no totals before a period is chosen", () => {
    const page = mountLedgerTab({ ...createSmallSeed(), buildings: [] });

    expect(page.rows()).toEqual([]);
    expect(page.hasFooter()).toBe(false);
  });

  it("lays its columns out by the ledger's spec, the description flexible up to 640px", () => {
    const page = mountLedgerTab();

    expect(page.template()).toBe(
      "140px 48px minmax(200px,1fr) 180px 100px 100px 100px",
    );

    page.resizeColumn(2, 9999);

    expect(page.template()).toBe("140px 48px 640px 180px 100px 100px 100px");
  });
});
