import { describe, expect, it } from "vitest";

import { type LegacySeed, loadLegacySeed } from "@cl/domain";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";

import { mountBuildingData } from "./BuildingDataScreen.page.tsx";

describe("BuildingDataScreen", () => {
  it("draws the panel with its count of buildings and the design's headers", () => {
    const page = mountBuildingData("p1");

    expect(page.data.title()).toBe("Building Data");
    expect(page.meta()).toBe("2 buildings total");
    expect(page.data.grid.headers()).toEqual([
      "Code",
      "Building / Period",
      "Type",
      "Closed",
      "Period",
      "Liquidity",
      "Funds",
      "Budget",
      "Actual",
      "Prev. bal.",
      "Total due",
    ]);
  });

  it("lists the buildings by name, each over its period, the buildings on the zebra background", () => {
    const page = mountBuildingData("p1");

    expect(page.data.grid.rowLabels()).toEqual([
      "Pozzetto (Piazza Libertà, 74, 33045 Nimis)",
      "2013 (Ordinary)",
      "Saturno (Piazza del Duomo, 39, 33033 Codroipo)",
      "2011 (Ordinary)",
    ]);
    expect(page.isZebra(page.labelOf("c1"))).toBe(true);
    expect(page.isZebra("2011 (Ordinary)")).toBe(false);
    expect(page.data.grid.isAggregate(page.labelOf("c1"))).toBe(true);
    expect(page.typeOf(page.labelOf("c1"))).toBe("Building");
    expect(page.typeOf("2011 (Ordinary)")).toBe("Ordinary");
    expect(page.closedOf("2011 (Ordinary)")).toBe(false);
    expect(page.closedOf(page.labelOf("c1"))).toBeNull();
  });

  it("shows both periods' six figures and dates; the building rows leave them blank", () => {
    const page = mountBuildingData("p1");

    expect(page.data.grid.rowTexts("2011 (Ordinary)").slice(4)).toEqual([
      "01/01/2011 - 31/12/2011",
      "2,954.14",
      "1,750.00",
      "7,400.00",
      "2,455.19",
      "288.92",
      "2,744.11",
    ]);
    expect(page.data.grid.rowTexts("2013 (Ordinary)").slice(4)).toEqual([
      "01/01/2013 - 31/12/2013",
      "1,078.26",
      "0.00",
      "38,000.00",
      "34,887.71",
      "-6,250.99",
      "28,636.72",
    ]);
    const saturno = page.data.grid.rowTexts(page.labelOf("c1"));

    expect(saturno[0]).toBe("SAT");
    expect(saturno.slice(2)).toEqual(["🏢", "", "", "", "", "", "", "", ""]);
  });

  it("starts on the app's period; clicking Saturno's period row makes it the sidebar's", async () => {
    const page = mountBuildingData("p36");

    expect(page.data.grid.selectedLabels()).toEqual(["2013 (Ordinary)"]);
    expect(page.sheetValue("Name")).toBe("Pozzetto");

    await page.data.grid.clickRow("2011 (Ordinary)");

    expect(page.sidebarPeriod()).toBe("2011 (Ordinary)");
    expect(page.data.grid.selectedLabels()).toEqual(["2011 (Ordinary)"]);
    expect(page.sheetValue("Name")).toBe("Saturno");
  });

  it("a building row clicked shows its profile and leaves the sidebar's period", async () => {
    const page = mountBuildingData("p36");

    await page.data.grid.clickRow(page.labelOf("c1"));

    expect(page.data.grid.selectedLabels()).toEqual([page.labelOf("c1")]);
    expect(page.sheetValue("Building code")).toBe("SAT");
    expect(page.sidebarPeriod()).toBe("2013 (Ordinary)");
  });

  it("shows Saturno's profile: its code, status, type, address and construction date, then OTHER and NOTES", () => {
    const page = mountBuildingData("p1");

    expect(page.activeTab()).toBe("Building Profile");
    expect(page.sheetValue("Name")).toBe("Saturno");
    expect(page.sheetValue("Building code")).toBe("SAT");
    expect(page.sheetValue("Status")).toBe("✓ Active");
    expect(page.sheetValue("Type")).toBe("🏢 Building");
    expect(page.sheetValue("Address")).toBe(
      "Piazza del Duomo, 39, 33033 Codroipo",
    );
    expect(page.sheetValue("Tax code")).toBe("010027376");
    expect(page.sheetValue("Construction date")).toBe("20/05/1980");
    expect(page.sheetGroups()).toEqual(["OTHER", "NOTES"]);
    expect(page.sheetValue("Cadastral data")).toBe("---");
    expect(page.sheetValue("System ID")).toBe("1");
    expect(page.sheetValue("Created on")).toBe("14/04/2011 13:52:24");
    expect(page.sheetValue("Modified on")).toBe("18/12/2012 15:41:01");
    expect(page.profileNotes()).toBe("---");
  });

  it("Pozzetto's profile reads --- where it has no code or construction date", () => {
    const page = mountBuildingData("p36");

    expect(page.sheetValue("Building code")).toBe("---");
    expect(page.sheetValue("Construction date")).toBe("---");
    expect(page.sheetValue("System ID")).toBe("19");
  });

  it("lists Pozzetto's 12 suppliers with their categories, and the first's sheet shows its phone", async () => {
    const page = mountBuildingData("p36");

    await page.activateTab("Building Suppliers");

    expect(page.tabs.grid.headers()).toEqual([
      "Name / Company",
      "Contact category",
    ]);
    expect(page.tabs.grid.rowLabels()).toHaveLength(12);

    const first = page.supplierAt(0);

    expect(page.tabs.grid.rowTexts(first.name)).toEqual([
      first.name,
      "Antenna technician",
    ]);
    expect(page.tabs.grid.selectedLabels()).toEqual([first.name]);
    expect(page.sheetValue("Contact type")).toBe("🏢 Company");
    expect(page.sheetValue("Status")).toBe("✓ Active");
    expect(page.sheetGroups()).toEqual(["COMPANY DATA", "CONTACTS"]);
    expect(page.sheetValue("Company name")).toBe(first.companyName);
    expect(page.sheetValue("Phone")).toBe(first.phone);
    expect(first.phone).not.toBeNull();
  });

  it("a supplier clicked shows its sheet; a person reads --- where a company has data", async () => {
    const page = mountBuildingData("p36");

    await page.activateTab("Building Suppliers");

    const person = page.supplierAt(3);

    await page.tabs.grid.clickRow(person.name);

    expect(page.tabs.grid.selectedLabels()).toEqual([person.name]);
    expect(page.tabs.grid.rowTexts(person.name)[1]).toBe(
      "Condominium administration",
    );
    expect(page.sheetValue("Contact type")).toBe("👤 Person");
    expect(page.sheetValue("Company name")).toBe("---");
    expect(page.sheetValue("Phone")).toBe("---");
    expect(page.sheetValue("Email")).toBe("---");
  });

  it("an archived supplier reads Archived, and its tax domicile shows", async () => {
    const page = mountBuildingData("p36", createSeedWithArchivedSupplier());

    await page.activateTab("Building Suppliers");

    expect(page.sheetValue("Status")).toBe("Archived");
    expect(page.sheetValue("Tax domicile")).toBe("Via Roma, 1, 33100 Udine");
  });

  it("a building with no suppliers says so, and shows no sheet", async () => {
    const page = mountBuildingData("p1", createSeedWithoutSaturnoSuppliers());

    await page.activateTab("Building Suppliers");

    expect(page.tabs.grid.emptyMessage()).toBe(
      "This building has no suppliers.",
    );
    expect(page.sheetGroups()).toEqual([]);
  });

  it("the suppliers' tools say that suppliers are edited in Contacts", async () => {
    const page = mountBuildingData("p36");

    await page.activateTab("Building Suppliers");
    await page.tabs.clickTool("Add supplier");
    await page.tabs.clickTool("Edit supplier");
    await page.tabs.clickTool("Remove supplier");

    expect(page.toasts()).toEqual([
      "Suppliers are edited in Contacts, which is not yet available.",
      "Suppliers are edited in Contacts, which is not yet available.",
      "Suppliers are edited in Contacts, which is not yet available.",
    ]);
  });

  it("+▾ offers New building and New period, which say so, as − does", async () => {
    const page = mountBuildingData("p1");

    await page.data.clickTool("Add");

    expect(page.menuItems()).toEqual(["🏢New building", "📁New period"]);

    await page.closeMenu();

    expect(page.menuItems()).toEqual([]);

    await page.data.clickTool("Add");

    await page.chooseMenuItem("New building");
    await page.data.clickTool("Add");
    await page.chooseMenuItem("New period");
    await page.data.clickTool("Delete");

    expect(page.menuItems()).toEqual([]);
    expect(page.toasts()).toEqual([
      "New building: not yet available",
      "New period: not yet available",
      "Delete: not yet available",
    ]);
  });

  it("the profile's other tools, print, export and the Legend say so", async () => {
    const page = mountBuildingData("p1");

    await page.tabs.clickTool("Add building");
    await page.tabs.clickTool("Delete building");
    await page.tabs.clickTool("Print");
    await page.tabs.clickLegend();
    await page.data.clickTool("Refresh");

    expect(page.toasts()).toEqual([
      "Add building: not yet available",
      "Delete building: not yet available",
      "Print: not yet available",
      "Legend: not yet available",
      "Refresh: not yet available",
    ]);
  });

  it("collapses a building and expands it again, one by one and all at once", async () => {
    const page = mountBuildingData("p1");

    await page.data.grid.clickCaret(page.labelOf("c1"));

    expect(page.data.grid.rowLabels()).not.toContain("2011 (Ordinary)");

    await page.data.clickTool("Expand all");

    expect(page.data.grid.rowLabels()).toContain("2011 (Ordinary)");

    await page.data.clickTool("Collapse all");

    expect(page.data.grid.rowLabels()).toEqual([
      page.labelOf("c19"),
      page.labelOf("c1"),
    ]);
  });

  it("maximizes the Building Data panel, and its splitters move by the ratio once laid out", async () => {
    const page = mountBuildingData("p36");

    await page.clickMaximize();

    expect(page.maximized()).toBe("top");

    await page.clickMaximize();

    expect(page.maximized()).toBe("none");
    expect(page.splitRatio()).toBe(0.5);

    page.dragSplitter(100, 1000);

    expect(page.splitRatio()).toBeCloseTo(0.6);

    await page.activateTab("Building Suppliers");
    page.dragSuppliersSplitter(-100, 0);

    expect(page.suppliersRatio()).toBe(0.5);

    page.dragSuppliersSplitter(-100, 1000);

    expect(page.suppliersRatio()).toBeCloseTo(0.4);
  });
});

/** The real seed, Pozzetto's first supplier archived and given a tax domicile. */
function createSeedWithArchivedSupplier(): LegacySeed {
  const seed = loadLegacySeed(legacySeedData);

  return {
    ...seed,
    contacts: seed.contacts.map((contact) => {
      return contact.id === "md86"
        ? {
            ...contact,
            status: "archived",
            taxDomicile: {
              street: "Via Roma, 1",
              postcode: "33100",
              city: "Udine",
            },
          }
        : contact;
    }),
  };
}

/** The real seed, Saturno's suppliers unlinked. */
function createSeedWithoutSaturnoSuppliers(): LegacySeed {
  const seed = loadLegacySeed(legacySeedData);

  return {
    ...seed,
    supplierLinks: seed.supplierLinks.filter((link) => {
      return link.buildingId !== "c1";
    }),
  };
}
