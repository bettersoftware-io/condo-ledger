import { describe, expect, it } from "vitest";

import {
  type ContactRow,
  type ContactView,
  type LegacySeed,
  loadLegacySeed,
} from "@cl/domain";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";

import {
  type BuildingDataScreenPage,
  mountBuildingData,
} from "./BuildingDataScreen.page.tsx";

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
    expect(page.sheetValue("Company name")).toBe(first.name);
    expect(page.sheetValue("Phone")).toBe(firstPhoneOf(first));
    expect(firstPhoneOf(first)).not.toBeNull();
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
    expect(page.sheetLabels()).not.toContain("Phone");
    expect(page.sheetLabels()).not.toContain("Email");
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

  it("the suppliers' tools no longer say that suppliers are edited in Contacts", async () => {
    const page = mountBuildingData("p36");

    await page.activateTab("Building Suppliers");
    await page.tabs.clickTool("Add supplier");

    expect(page.dialog.title()).toBe("Add Supplier");

    await page.dialog.cancel();
    await page.tabs.clickTool("Edit supplier");

    expect(page.dialog.title()).toMatch(/^Edit /);
    expect(page.toasts()).toEqual([]);
  });

  it("+ adds a chosen contact to the suppliers, and the contact picker offers its New and Edit buttons", async () => {
    const page = mountBuildingData("p36");
    const added = firstContactOutsideSuppliers(page);

    await page.activateTab("Building Suppliers");
    await page.tabs.clickTool("Add supplier");

    expect(page.dialog.title()).toBe("Add Supplier");
    expect(page.dialog.saveLabel()).toBe("+ Add");
    expect(page.dialog.requiredUnannounced()).toEqual([]);
    expect(page.dialog.pickerTools()).toEqual([
      "New company",
      "New person",
      "Edit contact",
      "Clear",
    ]);
    expect(page.dialog.isSaveDisabled()).toBe(true);

    await page.dialog.fill("Contact", added);
    await page.dialog.chooseContact(added);
    await page.dialog.save();

    expect(page.dialog.isShown()).toBe(false);
    expect(page.supplierNames()).toContain(added);
    expect(page.tabs.grid.rowLabels()).toContain(added);
  });

  it("a contact that is already a supplier is refused by name", async () => {
    const page = mountBuildingData("p36");
    const supplier = page.supplierAt(0).name;

    await page.activateTab("Building Suppliers");
    await page.tabs.clickTool("Add supplier");
    await page.dialog.fill("Contact", supplier);
    await page.dialog.chooseContact(supplier);

    expect(page.dialog.message()).toBe(
      `${supplier} is already a supplier of this building`,
    );
    expect(page.dialog.isSaveDisabled()).toBe(true);
  });

  it("a company made from Add Supplier is chosen, and added as a supplier", async () => {
    const page = mountBuildingData("p36");

    await page.activateTab("Building Suppliers");
    await page.tabs.clickTool("Add supplier");
    await page.dialog.clickPickerTool("New company");
    await page.contactDialog.fill("Company name", "Zzyzx Srl");
    await page.contactDialog.save();

    expect(page.dialog.fieldValue("Contact")).toBe("Zzyzx Srl");

    await page.dialog.save();

    expect(page.supplierNames()).toContain("Zzyzx Srl");
  });

  it("✎ opens Edit Company on the selected supplier, and a rename is in the list", async () => {
    const page = mountBuildingData("p36");
    const company = page.supplierAt(0);

    expect(company.kind).toBe("company");

    await page.activateTab("Building Suppliers");
    await page.tabs.grid.clickRow(company.name);
    await page.tabs.clickTool("Edit supplier");

    expect(page.dialog.title()).toBe("Edit Company");

    await page.dialog.fill("Company name", "Zzyzx Srl");
    await page.dialog.save();

    expect(page.dialog.isShown()).toBe(false);
    expect(page.supplierNames()).toContain("Zzyzx Srl");
    expect(page.tabs.grid.rowLabels()).toContain("Zzyzx Srl");
  });

  it("✎ and − wait for a supplier to be selected", async () => {
    const page = mountBuildingData("p1", createSeedWithoutSaturnoSuppliers());

    await page.activateTab("Building Suppliers");

    expect(page.tabs.isToolDisabled("Edit supplier")).toBe(true);
    expect(page.tabs.isToolDisabled("Remove supplier")).toBe(true);
    expect(page.tabs.isToolDisabled("Add supplier")).toBe(false);
  });

  it("− asks, then removes the link and leaves the contact in Contacts", async () => {
    const page = mountBuildingData("p36");
    const { name } = page.supplierAt(0);

    await page.activateTab("Building Suppliers");
    await page.tabs.grid.clickRow(name);
    await page.tabs.clickTool("Remove supplier");

    expect(page.confirmText()).toBe(
      `Remove ${name} from this building's suppliers?`,
    );

    await page.confirmYes();

    expect(page.confirmText()).toBeNull();
    expect(page.supplierNames()).not.toContain(name);
    expect(page.tabs.grid.rowLabels()).not.toContain(name);
    expect(page.hasContactNamed(name)).toBe(true);
  });

  it("a refused removal keeps the question open and says why", async () => {
    const page = mountBuildingData("p36");
    const { name } = page.supplierAt(0);

    page.refuseRemovals("on-invoice", "Pozzetto");
    await page.activateTab("Building Suppliers");
    await page.tabs.grid.clickRow(name);
    await page.tabs.clickTool("Remove supplier");
    await page.confirmYes();

    expect(page.confirmError()).toBe(
      `${name} is on an invoice of Pozzetto, so it cannot be deleted. Archive it instead.`,
    );
    expect(page.supplierNames()).toContain(name);
  });

  it("a supplier with no contact rows draws no CONTACTS fieldset", async () => {
    const page = mountBuildingData("p36", createSeedWithSupplierRows([]));

    await page.activateTab("Building Suppliers");

    expect(page.sheetGroups()).not.toContain("CONTACTS");
  });

  it("the supplier's sheet shows every contact row, in order, a Fax among them, and the email's value in the accent", async () => {
    const page = mountBuildingData("p36", createSeedWithSupplierRows());

    await page.activateTab("Building Suppliers");

    expect(page.sheetLabels().slice(-3)).toEqual(["Office", "Fax", "Email"]);
    expect(page.sheetValue("Office")).toBe("0432 000001");
    expect(page.sheetValue("Fax")).toBe("0432 000002");
    expect(page.sheetValue("Email")).toBe("zzyzx@example.test");
    expect(page.sheetTone("Email")).toBe("accent");
    expect(page.sheetTone("Fax")).toBeNull();
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

/** The real seed, Pozzetto's first supplier given a fax between its phone and its email, listed out of order. */
function createSeedWithSupplierRows(
  rows: ContactRow[] = [
    createRow("mr-t3", "email", "Email", "zzyzx@example.test", 3),
    createRow("mr-t2", "phone", "Fax", "0432 000002", 2),
    createRow("mr-t1", "phone", "Office", "0432 000001", 1),
  ],
): LegacySeed {
  const seed = loadLegacySeed(legacySeedData);

  return {
    ...seed,
    contacts: seed.contacts.map((contact) => {
      return contact.id === "md86"
        ? {
            ...contact,
            rows,
          }
        : contact;
    }),
  };
}

function createRow(
  id: string,
  type: ContactRow["type"],
  label: string,
  value: string,
  order: number,
): ContactRow {
  return { id, type, label, value, order };
}

/** The name of an active contact that is not a supplier of the building shown. */
function firstContactOutsideSuppliers(page: BuildingDataScreenPage): string {
  const suppliers = page.supplierNames();
  const name = page.contactNames().find((candidate) => {
    return !suppliers.includes(candidate);
  });

  if (name === undefined) {
    throw new Error("missing: a contact that is not a supplier");
  }

  return name;
}

function firstPhoneOf(supplier: ContactView): string | null {
  return (
    supplier.contact.rows.find((row) => {
      return row.type === "phone";
    })?.value ?? null
  );
}
