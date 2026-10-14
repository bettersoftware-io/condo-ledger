import { describe, expect, it } from "vitest";

import { mountAccountsScreen } from "./AccountsScreen.page.tsx";

describe("AccountsScreen", () => {
  it("shows the chart of accounts over the account's details", () => {
    const page = mountAccountsScreen();

    expect(page.title()).toBe("Accounts, Ledgers & Balance");
    expect(page.tabs()).toEqual(["Account Details", "Ledger"]);
    expect(page.activeTab()).toBe("Account Details");
    expect(page.showsDetails()).toBe(true);
    expect(page.showsLedger()).toBe(false);
  });

  it("the Ledger tab shows the ledger in place of the details", async () => {
    const page = mountAccountsScreen();

    await page.activateTab("Ledger");

    expect(page.activeTab()).toBe("Ledger");
    expect(page.showsLedger()).toBe(true);
    expect(page.showsDetails()).toBe(false);
  });

  it("the splitter moves the split by the drag over the screen's height", () => {
    const page = mountAccountsScreen();

    expect(page.splitRatio()).toBe(0.5);

    page.dragSplitter(60, 600);

    expect(page.splitRatio()).toBeCloseTo(0.6);

    page.dragSplitter(-120, 600);

    expect(page.splitRatio()).toBeCloseTo(0.4);
  });

  it("a drag of several moves ends at the split of the last one", () => {
    const page = mountAccountsScreen();

    page.dragSplitterThrough([60, 120, 90], 600);

    expect(page.splitRatio()).toBeCloseTo(0.65);
  });

  it("a screen with no height yet leaves the split alone", () => {
    const page = mountAccountsScreen();

    page.dragSplitter(60, 0);

    expect(page.splitRatio()).toBe(0.5);
  });

  it("maximize fills the screen with the chart, and restores it", async () => {
    const page = mountAccountsScreen();

    expect(page.maximized()).toBe("none");
    expect(page.maximizeLabel()).toBe("Maximize");

    await page.clickMaximize();

    expect(page.maximized()).toBe("top");
    expect(page.maximizeLabel()).toBe("Restore");

    await page.clickMaximize();

    expect(page.maximized()).toBe("none");
  });

  it("has the prototype's tools, and the ones not built yet say so", async () => {
    const page = mountAccountsScreen();

    expect(page.toolLabels()).toEqual([
      "Configure functional accounts",
      "Add account",
      "Edit account",
      "Delete account",
      "Expand all",
      "Collapse all",
      "Print balances",
      "Export to PDF",
      "Export to Excel",
    ]);

    await page.clickTool("Configure functional accounts");
    await page.clickTool("Add account");
    await page.clickTool("Edit account");
    await page.clickTool("Delete account");
    await page.clickTool("Print balances");
    await page.clickTool("Export to PDF");
    await page.clickTool("Export to Excel");

    expect(page.toasts()).toEqual([
      "Configure functional accounts: not yet available",
      "Add account: not yet available",
      "Edit account: not yet available",
      "Delete account: not yet available",
      "Print balances: not yet available",
      "Export to PDF: not yet available",
      "Export to Excel: not yet available",
    ]);
  });
});
