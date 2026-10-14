import { describe, expect, it } from "vitest";

import { mountSidebar } from "./Sidebar.page.tsx";

describe("Sidebar", () => {
  it("lists the buildings' periods and marks the selected", () => {
    const page = mountSidebar();

    expect(page.buildingLabels()).toEqual(["Pozzetto (Building)"]);
    expect(page.periodLabels()).toEqual(["2013 (Ordinary)", "2014 (Ordinary)"]);
    expect(page.selectedPeriod()).toBe("2013 (Ordinary)");
  });

  it("selecting a period changes the app-wide selection", async () => {
    const page = mountSidebar();

    await page.clickPeriod("2014 (Ordinary)");

    expect(page.appPeriodId()).toBe("p2");
    expect(page.selectedPeriod()).toBe("2014 (Ordinary)");
  });

  it("collapses and expands a building's periods", async () => {
    const page = mountSidebar();

    await page.toggleBuilding("Pozzetto (Building)");

    expect(page.periodLabels()).toEqual([]);

    await page.toggleBuilding("Pozzetto (Building)");

    expect(page.periodLabels()).toEqual(["2013 (Ordinary)", "2014 (Ordinary)"]);
  });

  it("lists the six menu items with Accounts active", () => {
    const page = mountSidebar();

    expect(page.menuLabels()).toEqual([
      "Building Data & Suppliers",
      "Units, Owners & Personal Balance",
      "Thousandth Tables & Allocation",
      "Accounts, Ledgers & Balance",
      "Journal & Daybook",
      "Installment Schedule",
    ]);
    expect(page.activeMenu()).toBe("Accounts, Ledgers & Balance");
  });

  it("selecting a menu item changes the navigation", async () => {
    const page = mountSidebar();

    await page.clickMenu("Journal & Daybook");

    expect(page.appMenu()).toBe("journal");
    expect(page.activeMenu()).toBe("Journal & Daybook");
  });

  it("says the management tools are not yet available", async () => {
    const page = mountSidebar();

    await page.clickTool("Add management");
    await page.clickTool("Edit management");
    await page.clickTool("Delete management");
    await page.clickTool("Refresh");

    expect(page.toasts()).toEqual([
      "Add management: not yet available",
      "Edit management: not yet available",
      "Delete management: not yet available",
      "Refresh: not yet available",
    ]);
  });

  it("dragging the splitter changes the width within 180–440", () => {
    const page = mountSidebar();

    expect(page.width()).toBe(272);

    page.dragSplitter(40);

    expect(page.width()).toBe(312);

    page.dragSplitter(500);

    expect(page.width()).toBe(440);

    page.dragSplitter(-1000);

    expect(page.width()).toBe(180);
  });

  it("a drag of several moves ends at the width of the last one", () => {
    const page = mountSidebar();

    page.dragSplitterThrough([40, 100, 70]);

    expect(page.width()).toBe(342);
  });

  it("the rail opens the drawer and the scrim closes it", async () => {
    const page = mountSidebar();

    expect(page.isDrawerOpen()).toBe(false);

    await page.clickRail();

    expect(page.isDrawerOpen()).toBe(true);

    await page.clickScrim();

    expect(page.isDrawerOpen()).toBe(false);
  });

  it("with a panel maximized, the rail restores it", async () => {
    const page = mountSidebar({ maximized: true });

    expect(page.isMaximized()).toBe(true);

    await page.clickRail();

    expect(page.isMaximized()).toBe(false);
    expect(page.isDrawerOpen()).toBe(false);
  });

  it("the main area shows the Accounts screen on its menu item, a placeholder elsewhere", async () => {
    const page = mountSidebar();

    expect(page.screenTitle()).toBe("Accounts, Ledgers & Balance");

    await page.clickMenu("Journal & Daybook");

    expect(page.screenTitle()).toBe("Journal & Daybook");
  });

  it("maximizing the Accounts panel folds the sidebar, and the rail restores both", async () => {
    const page = mountSidebar();

    await page.maximizePanel();

    expect(page.isMaximized()).toBe(true);
    expect(page.accountsMaximized()).toBe("top");

    await page.clickRail();

    expect(page.isMaximized()).toBe(false);
    expect(page.accountsMaximized()).toBe("none");
  });
});
