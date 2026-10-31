import { describe, expect, it } from "vitest";

import type { LegacySeed } from "@cl/domain";
import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";

import { mountUnits } from "./UnitsScreen.page.tsx";

describe("UnitsScreen", () => {
  it("draws the panel with its count of units, the design's headers and the formulas as tooltips", () => {
    const page = mountUnits("p1");

    expect(page.units.title()).toBe("Units, Owners & Personal Balance");
    expect(page.meta()).toBe("8 units total");
    expect(page.units.grid.headers()).toEqual([
      "Groups / Units / Owners",
      "Floor",
      "Int.",
      "Sub.",
      "Type",
      "Restr. period",
      "Prev. bal.",
      "Budget",
      "Actual",
      "Total due",
      "Paid",
      "Overdue",
      "Adjustment",
    ]);
    expect(page.headerTooltip("Total due")).toBe(
      "Previous balance + actual share",
    );
    expect(page.headerTooltip("Overdue")).toBe(
      "Installments due before today, not yet paid",
    );
    expect(page.headerTooltip("Adjustment")).toBe(
      "Total due − installments issued: positive asks for more, negative is a refund",
    );
    expect(page.headerTooltip("Budget")).toBeNull();
  });

  it("lists Saturno's root, A with A1…A4, B with B1…B4, and Rounding error last", () => {
    const page = mountUnits("p1");
    const keys = [
      "root",
      "group:ug1",
      "unit:u1",
      "unit:u2",
      "unit:u3",
      "unit:u4",
      "group:ug2",
      "unit:u5",
      "unit:u6",
      "unit:u7",
      "unit:u8",
      "rounding",
    ];
    const labels = page.units.grid.rowLabels();
    const visible = labels.filter((label) => {
      return keys.map(page.labelOf).includes(label);
    });

    expect(visible).toEqual(keys.map(page.labelOf));
    expect(labels.at(-1)).toBe("Rounding error");
    expect(page.labelOf("root")).toBe(
      "Saturno / 2011 (Piazza del Duomo, 39, 33033 Codroipo)",
    );
    expect(page.labelOf("group:ug1")).toMatch(/^A - /u);
    expect(page.labelOf("unit:u1")).toMatch(/^A1 - /u);
    expect(page.labelOf("unit:u8")).toMatch(/^B4 - /u);
    expect(page.units.grid.childrenOf(page.labelOf("group:ug2"))).toEqual(
      ["unit:u5", "unit:u6", "unit:u7", "unit:u8"].map(page.labelOf),
    );
  });

  it("draws the root and the groups bold on the zebra background, each row with its icon", () => {
    const page = mountUnits("p1");
    const root = page.labelOf("root");
    const group = page.labelOf("group:ug1");
    const shop = page.labelOf("unit:u1");

    expect(page.units.grid.isAggregate(root)).toBe(true);
    expect(page.isZebra(root)).toBe(true);
    expect(page.units.grid.isAggregate(group)).toBe(true);
    expect(page.isZebra(group)).toBe(true);
    expect(page.isZebra(shop)).toBe(false);
    expect(page.iconOf(root)).toBe("🏢");
    expect(page.iconOf(group)).toBe("📁");
    expect(page.iconOf(shop)).toBe("🏪");
    expect(page.iconOf(page.labelOf("unit:u5"))).toBe("🅿️");
    expect(page.iconOf("Rounding error")).toBe("");
  });

  it("A1 is a shop on floor 1 for May 2011; the root carries the period and the books' totals", () => {
    const page = mountUnits("p1");
    const a1 = page.units.grid.rowTexts(page.labelOf("unit:u1"));

    expect(a1[1]).toBe("1");
    expect(a1[4]).toBe("Shop");
    expect(a1[5]).toBe("01/05/2011 - 31/05/2011");
    expect(page.units.grid.rowTexts(page.labelOf("root")).slice(1)).toEqual([
      "",
      "",
      "",
      "",
      "01/01/2011 - 31/12/2011",
      "288.92",
      "7,400.00",
      "2,455.19",
      "2,744.11",
      "3,279.97",
      "4,408.95",
      "-4,944.81",
    ]);
  });

  it("starts on A1; selecting B1 shows its profile, its owners and tenants, and ends the breadcrumb with B1", async () => {
    const page = mountUnits("p1");
    const b1 = page.labelOf("unit:u5");

    expect(page.units.grid.selectedLabels()).toEqual([page.labelOf("unit:u1")]);
    expect(page.breadcrumb()).toBe(
      "Buildings › Saturno › 2011 (Ordinary) › Units, Owners & Personal Balance › A1",
    );

    await page.units.grid.clickRow(b1);

    expect(page.units.grid.selectedLabels()).toEqual([b1]);
    expect(page.breadcrumb()).toMatch(
      / › Units, Owners & Personal Balance › B1$/u,
    );
    expect(page.currentCrumb()).toBe("B1");
    expect(page.activeTab()).toBe("Unit Profile");
    expect(page.profileValue("Location")).toBe("Garages");
    expect(page.profileValue("Code")).toBe("B1");
    expect(page.profileValue("Floor")).toBe("-1");
    expect(page.profileValue("Interior")).toBe("1");
    expect(page.profileValue("Sub-unit")).toBe("---");
    expect(page.profileValue("Start date")).toBe("---");
    expect(page.profileValue("End date")).toBe("---");
    expect(page.profileValue("Type")).toBe("Garage");
    expect(page.profileValue("Cadastral data")).toBe("---");
    expect(page.profileGroups()).toEqual([
      "IDENTIFICATION DATA",
      "RESTRICTED PERIOD",
      "ADDITIONAL DATA",
      "NOTES",
    ]);

    await page.activateTab("Unit Owners");

    expect(page.tabs.grid.headers()).toEqual([
      "Periods / Roles / Owners",
      "Owner relationship scenario",
      "Out",
      "Restr. period",
      "Days",
      "% Share",
      "Comb. coeff.",
    ]);
    expect(page.tabs.grid.rowLabels()).toEqual([
      "Full period",
      "Owners",
      page.ownerLabelOf("r6"),
      "Tenants",
      page.ownerLabelOf("r7"),
    ]);
    expect(page.tabs.grid.rowTexts("Full period").slice(1)).toEqual([
      "Standard (owner/tenant)",
      "",
      "",
      "365/365",
      "",
      "",
    ]);
    expect(page.isOwnersZebra("Full period")).toBe(true);
  });

  it("shows A1's own dates on its profile", () => {
    const page = mountUnits("p1");

    expect(page.profileValue("Start date")).toBe("01/05/2011");
    expect(page.profileValue("End date")).toBe("31/05/2011");
    expect(page.profileValue("Location")).toBe("Stairwell A");
  });

  it("the root, a group and the rounding row show no unit and add no crumb", async () => {
    const page = mountUnits("p1");

    for (const key of ["root", "group:ug2", "rounding"]) {
      await page.units.grid.clickRow(page.labelOf(key));

      expect(page.hint()).toBe("Select a unit.");
    }

    expect(page.currentCrumb()).toBe("Units, Owners & Personal Balance");

    await page.units.grid.clickRow(page.labelOf("group:ug2"));

    expect(page.currentCrumb()).toBe("B");
  });

  it("Pozzetto A04's Unit Owners: 347/365 and 18/365, 0.950685 and 0.049315, the outgoing owner ticked", async () => {
    const page = mountUnits("p36");

    await page.units.grid.clickRow(page.labelOf("unit:u137"));
    await page.activateTab("Unit Owners");

    const staying = page.tabs.grid.rowTexts(page.ownerLabelOf("r166"));
    const leaving = page.tabs.grid.rowTexts(page.ownerLabelOf("r167"));

    expect(staying.slice(2)).toEqual([
      "",
      "19/01/2013 - end of FY",
      "347/365",
      "100%",
      "0.950685",
    ]);
    expect(leaving.slice(2)).toEqual([
      "✓",
      "start of FY - 18/01/2013",
      "18/365",
      "100%",
      "0.049315",
    ]);
    expect(page.shareFillOf(page.ownerLabelOf("r166"))).toBe("100%");
  });

  it("an owner clicked in Unit Owners is the one the Units grid selects", async () => {
    const page = mountUnits("p36");

    await page.units.grid.clickRow(page.labelOf("unit:u137"));
    await page.activateTab("Unit Owners");
    await page.tabs.grid.clickRow(page.ownerLabelOf("r167"));

    expect(page.units.grid.selectedLabels()).toEqual([
      page.labelOf("resident:r167"),
    ]);
    expect(page.tabs.grid.selectedLabels()).toEqual([
      page.ownerLabelOf("r167"),
    ]);
    expect(page.currentCrumb()).toBe("A04");

    await page.tabs.grid.clickRow("Owners");

    expect(page.units.grid.selectedLabels()).toEqual([
      page.labelOf("resident:r167"),
    ]);
  });

  it("collapses and expands the whole tree, and a group by its caret", async () => {
    const page = mountUnits("p1");
    const root = page.labelOf("root");

    await page.units.clickTool("Collapse all");

    expect(page.units.grid.rowLabels()).toEqual([root]);

    await page.units.clickTool("Expand all");
    await page.units.grid.clickCaret(page.labelOf("group:ug1"));

    expect(page.units.grid.childrenOf(root)).toEqual([
      page.labelOf("group:ug1"),
      page.labelOf("group:ug2"),
      "Rounding error",
    ]);
    expect(page.units.grid.childrenOf(page.labelOf("group:ug1"))).toEqual([]);
  });

  it("groups by unit, and offers a new group, unit and owner", async () => {
    const page = mountUnits("p1");

    expect(page.groupBy()).toBe("Group by: By unit");
    expect(page.units.toolLabels()).toEqual([
      "Add",
      "Edit",
      "Delete",
      "Expand all",
      "Collapse all",
      "Print",
      "Export to PDF",
      "Export to Excel",
      "Refresh",
    ]);

    await page.units.clickTool("Add");

    expect(page.menuItems()).toEqual([
      "📁New group",
      "🏠New unit",
      "👤New owner",
    ]);

    await page.closeMenu();

    expect(page.menuItems()).toEqual([]);
    expect(page.toasts()).toEqual([]);
  });

  it("print, PDF, XLS, refresh and the Legend say they are not yet available", async () => {
    const page = mountUnits("p1");

    for (const tool of [
      "Print",
      "Export to PDF",
      "Export to Excel",
      "Refresh",
    ]) {
      await page.units.clickTool(tool);
    }

    for (const tool of ["Print", "Export to PDF", "Export to Excel"]) {
      await page.tabs.clickTool(tool);
    }

    await page.tabs.clickLegend();

    expect(page.toasts()).toEqual([
      "Print: not yet available",
      "Export to PDF: not yet available",
      "Export to Excel: not yet available",
      "Refresh: not yet available",
      "Print: not yet available",
      "Export to PDF: not yet available",
      "Export to Excel: not yet available",
      "Legend: not yet available",
    ]);
  });

  it("the add, edit and delete tools say so until their dialogs arrive", async () => {
    const page = mountUnits("p1");

    await page.units.clickTool("Add");
    await page.chooseMenuItem("New group");
    await page.units.clickTool("Add");
    await page.chooseMenuItem("New unit");
    await page.units.clickTool("Add");
    await page.chooseMenuItem("New owner");
    await page.units.clickTool("Edit");
    await page.units.clickTool("Delete");

    expect(page.tabs.toolLabels()).toEqual([
      "Add owner",
      "Edit unit",
      "Delete unit",
      "Print",
      "Export to PDF",
      "Export to Excel",
    ]);

    await page.tabs.clickTool("Add owner");
    await page.tabs.clickTool("Edit unit");
    await page.tabs.clickTool("Delete unit");
    await page.activateTab("Unit Owners");

    expect(page.tabs.toolLabels().slice(0, 3)).toEqual([
      "Add owner",
      "Edit owner",
      "Remove owner",
    ]);

    await page.tabs.clickTool("Edit owner");
    await page.tabs.clickTool("Remove owner");

    expect(page.toasts()).toEqual([
      "New group: not yet available",
      "New unit: not yet available",
      "New owner: not yet available",
      "Edit: not yet available",
      "Delete: not yet available",
      "Add owner: not yet available",
      "Edit unit: not yet available",
      "Delete unit: not yet available",
      "Edit owner: not yet available",
      "Remove owner: not yet available",
    ]);
  });

  it("maximize fills the screen with the Units panel, and restores it", async () => {
    const page = mountUnits("p1");

    expect(page.maximized()).toBe("none");

    await page.clickMaximize();

    expect(page.maximized()).toBe("top");

    await page.clickMaximize();

    expect(page.maximized()).toBe("none");
  });

  it("the splitter moves the share between the panels, and a screen of no height leaves it", () => {
    const page = mountUnits("p1");

    expect(page.splitRatio()).toBe(0.5);

    page.dragSplitter(60, 600);

    expect(page.splitRatio()).toBeCloseTo(0.6);

    page.dragSplitter(60, 0);

    expect(page.splitRatio()).toBeCloseTo(0.6);
  });

  it("with no period, the grid says so and the bottom panel shows no unit", () => {
    const page = mountUnits(null, createSeedWithoutBuildings());

    expect(page.units.grid.emptyMessage()).toBe("No period is selected.");
    expect(page.meta()).toBe("");
    expect(page.hint()).toBe("Select a unit.");
  });
});

function createSeedWithoutBuildings(): LegacySeed {
  return { ...createSmallSeed(), buildings: [] };
}
