import { describe, expect, it } from "vitest";

import { type LegacySeed, loadLegacySeed } from "@cl/domain";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";

import {
  type ContactsScreenPage,
  mountContacts,
} from "./ContactsScreen.page.tsx";

describe("Contacts screen", () => {
  it("lists the first ten of the registry, with the page and the total", () => {
    const page = mountContacts();

    expect(page.list.title()).toBe("Contact List");
    expect(page.list.headers()).toEqual(TABLE_HEADERS);
    expect(page.list.rowLabels()).toHaveLength(10);
    expect(page.list.pageText()).toBe("Page 1 of 12 · 113 contacts total");
    expect(page.list.pageSizeText()).toBe("10 ▾");
    expect(page.breadcrumb()).toBe("Contacts");
  });

  it("draws a contact's code, type, status, address and category, and --- where there is nothing", () => {
    const page = mountContacts();
    const name = page.contactName(COMPANY_FIRST);

    expect(page.list.rowTexts(name)).toEqual([
      name,
      "ARZINO",
      "🏢",
      "✓",
      "Piazza XX Settembre, 84, 33019 Tricesimo",
      "---",
      "---",
      "",
      "Water supply",
    ]);
  });

  it("draws a person with its own type icon", () => {
    const page = mountContacts();

    expect(page.list.rowTexts(page.contactName(PERSON_RESIDENT))[2]).toBe("👤");
  });

  it("selects the first row on opening, and the row clicked after", async () => {
    const page = mountContacts();
    const [first, second] = page.list.rowLabels();

    expect(page.list.selectedLabels()).toEqual([first]);

    await page.list.clickRow(second ?? "");

    expect(page.list.selectedLabels()).toEqual([second]);
  });

  it("steps through the pages, disabling each step at its end", async () => {
    const page = mountContacts();

    expect(page.list.isStepDisabled("First page")).toBe(true);
    expect(page.list.isStepDisabled("Previous page")).toBe(true);
    expect(page.list.isStepDisabled("Next page")).toBe(false);

    await page.list.clickStep("Next page");

    expect(page.list.pageText()).toBe("Page 2 of 12 · 113 contacts total");

    await page.list.clickStep("Last page");

    expect(page.list.pageText()).toBe("Page 12 of 12 · 113 contacts total");
    expect(page.list.rowLabels()).toHaveLength(3);
    expect(page.list.isStepDisabled("Next page")).toBe(true);
    expect(page.list.isStepDisabled("Last page")).toBe(true);

    await page.list.clickStep("First page");

    expect(page.list.pageText()).toBe("Page 1 of 12 · 113 contacts total");
  });

  it("steps back a page", async () => {
    const page = mountContacts();

    await page.list.clickStep("Next page");
    await page.list.clickStep("Previous page");

    expect(page.list.pageText()).toBe("Page 1 of 12 · 113 contacts total");
  });

  it("offers the four page sizes, and Escape closes the menu choosing none", async () => {
    const page = mountContacts();

    expect(await page.list.openPageSizes()).toEqual([10, 25, 50, 100]);

    await page.pressEscape();

    expect(page.list.pageSizeOptions()).toEqual([]);
    expect(page.list.pageSizeText()).toBe("10 ▾");
  });

  it("lists as many as the page size says, from page 1", async () => {
    const page = mountContacts();

    await page.list.clickStep("Next page");
    await page.list.choosePageSize(25);

    expect(page.list.pageSizeText()).toBe("25 ▾");
    expect(page.list.pageText()).toBe("Page 1 of 5 · 113 contacts total");
    expect(page.list.rowLabels()).toHaveLength(25);
  });

  it("shows a company's COMPANY DATA and a person's PERSONAL DATA", async () => {
    const page = mountContacts();
    const company = page.contactName(COMPANY_FIRST);

    expect(page.tabs.active()).toBe("Contact Details");
    expect(page.tabs.value("Contact type")).toBe("🏢 Company");
    expect(page.tabs.value("Status")).toBe("✓ Active");
    expect(page.tabs.value("Code")).toBe("ARZINO");
    expect(page.tabs.legends()).toContain("COMPANY DATA");
    expect(page.tabs.legends()).not.toContain("PERSONAL DATA");
    expect(page.tabs.value("Company name", "COMPANY DATA")).toBe(company);
    expect(page.tabs.value("Registered office", "COMPANY DATA")).toBe(
      "Piazza XX Settembre, 84, 33019 Tricesimo",
    );
    expect(page.tabs.value("Tax domicile", "COMPANY DATA")).toBe("---");

    await page.list.clickRow(page.contactName(PERSON_OWNER));

    expect(page.tabs.value("Contact type")).toBe("👤 Person");
    expect(page.tabs.legends()).toContain("PERSONAL DATA");
    expect(page.tabs.legends()).not.toContain("COMPANY DATA");
    expect(page.tabs.value("Last name", "PERSONAL DATA")).not.toBe("---");
  });

  it("lists the contact's rows, and the useful data", () => {
    const page = mountContacts();

    expect(page.tabs.legends()).toEqual([
      "COMPANY DATA",
      "CONTACTS",
      "SUPPLIER OF THE FOLLOWING BUILDINGS",
      "USEFUL DATA",
      "NOTES",
    ]);
    expect(page.tabs.value("Phone", "CONTACTS")).toBe("+39 0432 922972");
    expect(page.tabs.value("Category", "USEFUL DATA")).toBe("Water supply");
    expect(page.tabs.value("Salutation", "USEFUL DATA")).toBe(
      "Dear Sir or Madam",
    );
    expect(page.tabs.value("Language", "USEFUL DATA")).toBe("---");
  });

  it("shows the buildings a supplier supplies, and - None - for a contact that supplies none", async () => {
    const page = mountContacts();

    expect(
      page.tabs.listIn("SUPPLIER OF THE FOLLOWING BUILDINGS").length,
    ).toBeGreaterThan(0);

    await page.list.clickRow(page.contactName(COMPANY_UNUSED));

    expect(page.tabs.listIn("SUPPLIER OF THE FOLLOWING BUILDINGS")).toEqual([
      "- None -",
    ]);
  });

  it("shows RESIDENT OF for a resident, and leaves the fieldset out for a contact that is none", async () => {
    const page = mountContacts();

    await page.list.clickRow(page.contactName(PERSON_RESIDENT));

    expect(page.tabs.legends()).toContain("RESIDENT OF");
    expect(page.tabs.listIn("RESIDENT OF").length).toBeGreaterThan(0);

    await page.list.clickRow(page.contactName(COMPANY_UNUSED));

    expect(page.tabs.legends()).not.toContain("RESIDENT OF");
    expect(page.tabs.legends()).not.toContain("ON INVOICES OF");
    expect(page.tabs.legends()).not.toContain("IN ENTRIES OF");
  });

  it("shows the archive icon on an archived contact, and the check on an active one", async () => {
    const page = mountContacts();

    await page.filters.chooseStatus("Archived");

    const archived = page.contactName(ARCHIVED);

    expect(page.list.statusOf(archived)).toEqual({
      status: "archived",
      hasIcon: true,
    });
    expect(page.tabs.value("Status")).toBe("Archived");

    await page.filters.chooseStatus("Active");

    expect(page.list.statusOf(page.list.rowLabels()[0] ?? "")).toEqual({
      status: "active",
      hasIcon: false,
    });
  });

  it("draws the flag of a language, named in its tooltip, and nothing without one", () => {
    const page = mountContacts(createSeedWithLanguages());
    const [first, second] = page.list.rowLabels();

    expect(page.list.languageOf(first ?? "")).toEqual({
      flag: "🇬🇧",
      name: "English",
    });
    expect(page.list.languageOf(second ?? "")).toEqual({
      flag: "🇮🇹",
      name: "Italian",
    });
    expect(page.list.languageOf(page.list.rowLabels()[2] ?? "")).toEqual({
      flag: "",
      name: null,
    });
    expect(page.tabs.value("Language", "USEFUL DATA")).toBe("English");
  });

  it("applies a typed keyword on Search, and not before", async () => {
    const page = mountContacts();

    await page.filters.typeKeyword("ARZINO");

    expect(page.list.pageText()).toBe("Page 1 of 12 · 113 contacts total");

    await page.filters.search();

    expect(page.list.rowLabels()).toEqual([page.contactName(COMPANY_FIRST)]);
    expect(page.list.pageText()).toBe("Page 1 of 1 · 1 contacts total");
    expect(page.filters.keyword()).toBe("ARZINO");
  });

  it("applies a typed keyword on Enter", async () => {
    const page = mountContacts();

    await page.filters.typeKeyword("arzino");
    await page.filters.pressEnterInKeyword();

    expect(page.list.rowLabels()).toEqual([page.contactName(COMPANY_FIRST)]);
  });

  it("applies a checkbox at once, and says nothing matches with both unticked", async () => {
    const page = mountContacts();

    await page.filters.togglePersons();

    expect(page.filters.isPersonsTicked()).toBe(false);
    expect(page.list.pageText()).not.toBe("Page 1 of 12 · 113 contacts total");
    expect(
      page.list.rowLabels().every((label) => {
        return page.list.rowTexts(label)[2] === "🏢";
      }),
    ).toBe(true);

    await page.filters.toggleCompanies();

    expect(page.list.rowLabels()).toEqual([]);
    expect(page.list.emptyMessage()).toBe("No contact matches.");
    expect(page.list.pageText()).toBe("Page 1 of 1 · 0 contacts total");
    expect(page.tabs.hint()).toBe("No contact matches.");
  });

  it("applies the Building and Status selects at once", async () => {
    const page = mountContacts();

    expect(page.filters.buildingOptions()[0]).toBe("- All -");
    expect(page.filters.buildingOptions().length).toBeGreaterThan(1);
    expect(page.filters.statusOptions()).toEqual([
      "- All -",
      "Active",
      "Archived",
    ]);

    await page.filters.chooseStatus("Archived");

    expect(page.list.pageText()).toBe("Page 1 of 1 · 2 contacts total");

    const building = page.filters.buildingOptions()[1] ?? "";

    await page.filters.chooseBuilding(building);

    expect(page.filters.building()).toBe(building);

    await page.filters.chooseStatus("- All -");
    await page.filters.chooseBuilding("- All -");

    expect(page.filters.building()).toBe("- All -");
    expect(page.filters.status()).toBe("- All -");
  });

  it("Reset restores the list, the boxes, the keyword and the selects", async () => {
    const page = mountContacts();

    await page.filters.typeKeyword("ARZINO");
    await page.filters.search();
    await page.filters.toggleCompanies();
    await page.filters.chooseStatus("Archived");
    await page.categories.click("Owner");
    await page.filters.reset();

    expect(page.filters.keyword()).toBe("");
    expect(page.filters.isPersonsTicked()).toBe(true);
    expect(page.filters.isCompaniesTicked()).toBe(true);
    expect(page.filters.status()).toBe("- All -");
    expect(page.filters.building()).toBe("- All -");
    expect(page.categories.selected()).toEqual(["- All -"]);
    expect(page.list.pageText()).toBe("Page 1 of 12 · 113 contacts total");
  });

  it("lists the categories by name with their counts, the empty ones too, under - All -", () => {
    const page = mountContacts();
    const rows = page.categories.rows();

    expect(page.categories.title()).toBe("Contact Categories");
    expect(rows[0]).toEqual(["- All -", "113"]);
    expect(rows).toHaveLength(35);
    expect(rows).toContainEqual(["Owner", "78"]);
    expect(rows).toContainEqual(["Taxes", "0"]);
    expect(page.categories.selected()).toEqual(["- All -"]);
  });

  it("a category filters at once, and the other filters leave its counts as they are", async () => {
    const page = mountContacts();

    await page.categories.click("Condominium administration");

    expect(page.categories.selected()).toEqual(["Condominium administration"]);
    expect(page.list.pageText()).toBe("Page 1 of 1 · 4 contacts total");

    await page.filters.toggleCompanies();

    expect(page.categories.rows()).toContainEqual([
      "Condominium administration",
      "4",
    ]);

    await page.categories.click("Taxes");

    expect(page.list.emptyMessage()).toBe("No contact matches.");

    await page.categories.click("- All -");

    expect(page.categories.selected()).toEqual(["- All -"]);
  });

  it("draws the category tools, with ✎ and − off on - All -", async () => {
    const page = mountContacts();

    expect(page.categories.toolLabels()).toEqual([
      "Add category",
      "Edit category",
      "Delete category",
      "Refresh",
    ]);
    expect(page.categories.isToolDisabled("Add category")).toBe(false);
    expect(page.categories.isToolDisabled("Edit category")).toBe(true);
    expect(page.categories.isToolDisabled("Delete category")).toBe(true);

    await page.categories.click("Owner");

    expect(page.categories.isToolDisabled("Edit category")).toBe(false);
    expect(page.categories.isToolDisabled("Delete category")).toBe(false);
  });

  it("says the categories' refresh is not yet available", async () => {
    const page = mountContacts();

    await page.categories.clickTool("Refresh");

    expect(page.toasts()).toEqual(["Refresh: not yet available"]);
  });

  it("adds a category through + and selects it, once the name is free", async () => {
    const page = mountContacts();

    await page.categories.clickTool("Add category");

    expect(page.dialog.title()).toBe("New Category");
    expect(page.dialog.requiredUnannounced()).toEqual([]);
    expect(page.dialog.fieldValue("Name")).toBe("");
    expect(page.dialog.saveLabel()).toBe("+ Add");
    expect(page.dialog.isSaveDisabled()).toBe(true);

    await page.dialog.fill("Name", "taxes");

    expect(page.dialog.message()).toBe("Another category is named taxes");
    expect(page.dialog.isSaveDisabled()).toBe(true);

    await page.dialog.fill("Name", "Chimney sweep");

    expect(page.dialog.message()).toBeNull();

    await page.dialog.save();

    expect(page.dialog.isShown()).toBe(false);
    expect(page.categories.rows()).toContainEqual(["Chimney sweep", "0"]);
    expect(page.categories.selected()).toEqual(["Chimney sweep"]);
    expect(page.list.emptyMessage()).toBe("No contact matches.");
  });

  it("refuses a blank name and a name of more than 63 characters", async () => {
    const page = mountContacts();

    await page.categories.clickTool("Add category");
    await page.dialog.fill("Name", "x");
    await page.dialog.fill("Name", "");

    expect(page.dialog.message()).toBe("Enter a name");
    expect(page.dialog.isSaveDisabled()).toBe(true);

    await page.dialog.fill("Name", "x".repeat(64));

    expect(page.dialog.message()).toBe("A name has at most 63 characters");
    expect(page.dialog.isSaveDisabled()).toBe(true);
  });

  it("cancels the dialog without adding anything", async () => {
    const page = mountContacts();

    await page.categories.clickTool("Add category");
    await page.dialog.fill("Name", "Chimney sweep");
    await page.dialog.cancel();

    expect(page.dialog.isShown()).toBe(false);
    expect(page.categories.rows()).toHaveLength(35);
  });

  it("edits the selected category's name through ✎ and keeps it selected", async () => {
    const page = mountContacts();

    await page.categories.click("Taxes");
    await page.categories.clickTool("Edit category");

    expect(page.dialog.title()).toBe("Edit Category");
    expect(page.dialog.fieldValue("Name")).toBe("Taxes");
    expect(page.dialog.saveLabel()).toBe("✎ Save");

    await page.dialog.fill("Name", "Duties");
    await page.dialog.save();

    expect(page.dialog.isShown()).toBe(false);
    expect(page.categories.rows()).toContainEqual(["Duties", "0"]);
    expect(page.categories.selected()).toEqual(["Duties"]);
  });

  it("asks before deleting a category, and a category with contacts is refused in the question", async () => {
    const page = mountContacts();

    await page.categories.click("Owner");
    await page.categories.clickTool("Delete category");

    expect(page.confirmText()).toBe("Delete the category Owner?");
    expect(page.confirmError()).toBeNull();

    await page.confirmYes();

    expect(page.confirmText()).toBe("Delete the category Owner?");
    expect(page.confirmError()).toBe(
      "Move its 78 contacts to another category first.",
    );

    await page.confirmNo();

    expect(page.confirmText()).toBeNull();
    expect(page.categories.rows()).toContainEqual(["Owner", "78"]);
    expect(page.categories.selected()).toEqual(["Owner"]);
  });

  it("words the refusal for one contact in the singular", async () => {
    const page = mountContacts();

    await page.categories.click("Gardener");
    await page.categories.clickTool("Delete category");
    await page.confirmYes();

    expect(page.confirmError()).toBe(
      "Move its contact to another category first.",
    );
  });

  it("deletes a category once its last contact has moved out, and goes back to - All -", async () => {
    const page = mountContacts();

    await page.categories.click("Gardener");
    await page.moveLastContactOut("Gardener");

    expect(page.categories.rows()).toContainEqual(["Gardener", "0"]);

    await page.categories.clickTool("Delete category");
    await page.confirmYes();

    expect(page.confirmText()).toBeNull();
    expect(
      page.categories.rows().map((row) => {
        return row[0];
      }),
    ).not.toContain("Gardener");
    expect(page.categories.selected()).toEqual(["- All -"]);
    expect(page.list.pageText()).toBe("Page 1 of 12 · 113 contacts total");
  });

  it("answers No to the question on Escape, and keeps the selection", async () => {
    const page = mountContacts();

    await page.categories.click("Gardener");
    await page.categories.clickTool("Delete category");
    await page.pressEscape();

    expect(page.confirmText()).toBeNull();
    expect(page.categories.selected()).toEqual(["Gardener"]);
  });

  it("says Print, PDF, Excel, Refresh and the Legend are not yet available", async () => {
    const page = mountContacts();

    await page.list.clickTool("Print");
    await page.list.clickTool("Export to PDF");
    await page.list.clickTool("Export to Excel");
    await page.list.clickTool("Refresh");
    await page.tabs.clickTool("Print");
    await page.tabs.clickLegend();

    expect(page.toasts()).toEqual([
      "Print: not yet available",
      "Export to PDF: not yet available",
      "Export to Excel: not yet available",
      "Refresh: not yet available",
      "Print: not yet available",
      "Legend: not yet available",
    ]);
  });

  it("offers New person and New company on +, and says they are not yet available for now", async () => {
    const page = mountContacts();

    expect(page.tabs.toolLabels()).toEqual([
      "Add contact",
      "Edit contact",
      "Delete contact",
      "Print",
      "Export to PDF",
      "Export to Excel",
    ]);
    expect(await page.tabs.openAddMenu()).toEqual([
      "New person",
      "New company",
    ]);

    await page.pressEscape();

    expect(page.tabs.addMenuItems()).toEqual([]);

    await page.tabs.openAddMenu();
    await page.tabs.clickMenuItem("New company");
    await page.tabs.clickTool("Edit contact");
    await page.tabs.clickTool("Delete contact");

    expect(page.toasts()).toEqual([
      "New company: not yet available",
      "Edit contact: not yet available",
      "Delete contact: not yet available",
    ]);
  });

  it("shows No connected contacts. for a contact with none, and the seeded contact's one row", async () => {
    const page = mountContacts();

    await page.tabs.activate("Connected Contacts");

    expect(page.tabs.active()).toBe("Connected Contacts");
    expect(page.tabs.connectedHeaders()).toEqual([
      "Order",
      "Relationship",
      "Name",
      "Code",
      "Type",
      "St.",
      "Reference address",
      "Tax code",
      "VAT no.",
    ]);
    expect(page.tabs.connectedEmpty()).toBe("No connected contacts.");
    expect(page.tabs.toolLabels().slice(0, 3)).toEqual([
      "Add connection",
      "Edit connection",
      "Delete connection",
    ]);

    // Found by the first word of its name, which narrows the list to a page.
    const name = page.contactName(WITH_CONNECTION);

    await page.filters.typeKeyword(name.split(" ")[0] ?? "");
    await page.filters.search();
    await page.list.clickRow(name);

    const [row] = page.tabs.connectedRows();

    expect(page.tabs.connectedRows()).toHaveLength(1);
    expect(row?.slice(0, 3)).toEqual([
      "1",
      "Employee",
      page.contactName(CONNECTED),
    ]);
    expect(page.tabs.connectedEmpty()).toBeNull();

    await page.tabs.clickConnectedRow(page.contactName(CONNECTED));

    expect(page.tabs.connectedRows()).toHaveLength(1);
    expect(page.list.selectedLabels()).toEqual([name]);
  });

  it("selects a connected row, the first on opening, and disables ✎ and − with no rows", async () => {
    const page = mountContacts();

    await page.tabs.activate("Connected Contacts");

    expect(page.tabs.isToolDisabled("Edit connection")).toBe(true);
    expect(page.tabs.isToolDisabled("Delete connection")).toBe(true);
    expect(page.tabs.isToolDisabled("Add connection")).toBe(false);

    await openConnectedContact(page);

    expect(page.tabs.connectedSelected()).toEqual([
      page.contactName(CONNECTED),
    ]);
    expect(page.tabs.isToolDisabled("Edit connection")).toBe(false);
    expect(page.tabs.isToolDisabled("Delete connection")).toBe(false);
  });

  it("adds a connection on the next free order, and shows it on this contact only", async () => {
    const page = mountContacts();

    await openConnectedContact(page);
    await page.tabs.clickTool("Add connection");

    expect(page.dialog.title()).toBe("Add Connected Contact");
    expect(page.dialog.fieldValue("Order")).toBe("2");
    expect(page.dialog.isSaveDisabled()).toBe(true);

    await page.dialog.fill("Contact", page.contactName(COMPANY_UNUSED));
    await page.dialog.chooseContact(page.contactName(COMPANY_UNUSED));
    await page.dialog.fill("Relationship", "Plumber");
    await page.dialog.save();

    expect(page.dialog.isShown()).toBe(false);
    expect(
      page.tabs.connectedRows().map((row) => {
        return row.slice(0, 3);
      }),
    ).toEqual([
      ["1", "Employee", page.contactName(CONNECTED)],
      ["2", "Plumber", page.contactName(COMPANY_UNUSED)],
    ]);

    const other = page.contactName(COMPANY_UNUSED);

    await page.filters.typeKeyword(other);
    await page.filters.search();
    await page.list.clickRow(other);

    expect(page.tabs.connectedEmpty()).toBe("No connected contacts.");
  });

  it("refuses a contact connected to itself, and the same relationship twice", async () => {
    const page = mountContacts();

    await openConnectedContact(page);
    await page.tabs.clickTool("Add connection");
    await page.dialog.fill("Contact", page.contactName(WITH_CONNECTION));
    await page.dialog.chooseContact(page.contactName(WITH_CONNECTION));
    await page.dialog.fill("Relationship", "Boss");

    expect(page.dialog.message()).toBe(
      "A contact cannot be connected to itself",
    );
    expect(page.dialog.isSaveDisabled()).toBe(true);

    await page.dialog.cancel();
    await page.tabs.clickTool("Add connection");
    await page.dialog.fill("Contact", page.contactName(CONNECTED));
    await page.dialog.chooseContact(page.contactName(CONNECTED));
    await page.dialog.fill("Relationship", "Employee");

    expect(page.dialog.message()).toBe(
      `${page.contactName(CONNECTED)} already has this relationship`,
    );
    expect(page.dialog.isSaveDisabled()).toBe(true);
  });

  it("does not offer an archived contact to connect", async () => {
    const page = mountContacts();

    await openConnectedContact(page);
    await page.tabs.clickTool("Add connection");
    await page.dialog.fill("Contact", page.contactName(ARCHIVED));

    expect(page.dialog.contactOptions()).toEqual([]);
    expect(page.dialog.noContactMatches()).toBe(true);
  });

  it("edits the selected connection through ✎, keeping its contact", async () => {
    const page = mountContacts();

    await openConnectedContact(page);
    await page.tabs.clickTool("Edit connection");

    expect(page.dialog.title()).toBe("Edit Connected Contact");
    expect(page.dialog.fieldValue("Contact")).toBe(page.contactName(CONNECTED));
    expect(page.dialog.fieldValue("Relationship")).toBe("Employee");

    await page.dialog.fill("Relationship", "Manager");
    await page.dialog.fill("Order", "3");
    await page.dialog.save();

    expect(page.dialog.isShown()).toBe(false);
    expect(page.tabs.connectedRows()[0]?.slice(0, 3)).toEqual([
      "3",
      "Manager",
      page.contactName(CONNECTED),
    ]);
  });

  it("asks before removing a connection, and removes it on Yes", async () => {
    const page = mountContacts();

    await openConnectedContact(page);
    await page.tabs.clickTool("Delete connection");

    expect(page.confirmText()).toBe(
      `Remove ${page.contactName(CONNECTED)} from this contact?`,
    );

    await page.confirmNo();

    expect(page.tabs.connectedRows()).toHaveLength(1);

    await page.tabs.clickTool("Delete connection");
    await page.confirmYes();

    expect(page.confirmText()).toBeNull();
    expect(page.tabs.connectedEmpty()).toBe("No connected contacts.");
    expect(page.tabs.isToolDisabled("Edit connection")).toBe(true);
  });

  it("keeps the tab in front while another contact is selected", async () => {
    const page = mountContacts();

    await page.tabs.activate("Connected Contacts");
    await page.list.clickRow(page.list.rowLabels()[1] ?? "");

    expect(page.tabs.active()).toBe("Connected Contacts");
  });

  it("maximizes the list over the tabs, and shares the height by the splitter", async () => {
    const page = mountContacts();

    expect(page.maximized()).toBe("none");

    await page.clickMaximize();

    expect(page.maximized()).toBe("top");

    await page.clickMaximize();

    expect(page.maximized()).toBe("none");
    expect(page.splitRatio()).toBe(0.5);

    page.dragSplitter(100, 1000);

    expect(page.splitRatio()).toBeCloseTo(0.6, 5);
  });
});

describe("Contacts sidebar", () => {
  it("replaces the Management sidebar, and its rail reads FILTERS", () => {
    const page = mountContacts();

    expect(page.filters.title()).toBe("Filter Contacts");
    expect(page.showsManagementSidebar()).toBe(false);
    expect(page.railText()).toContain("FILTERS");
  });

  it("opens as a drawer from the rail, and the scrim closes it", async () => {
    const page = mountContacts();

    expect(page.isDrawerOpen()).toBe(false);

    await page.clickRail();

    expect(page.isDrawerOpen()).toBe(true);

    await page.clickScrim();

    expect(page.isDrawerOpen()).toBe(false);
  });

  it("keeps its width across the two modules", async () => {
    const page = mountContacts();

    page.dragSidebar(60);

    expect(page.sidebarWidth()).toBe(332);

    await page.clickModule("Buildings");

    expect(page.showsManagementSidebar()).toBe(true);
    expect(page.sidebarWidth()).toBe(332);

    await page.clickModule("Contacts");

    expect(page.sidebarWidth()).toBe(332);
  });
});

/** The real seed with the first two contacts of the list given a language: English, then Italian. */
function createSeedWithLanguages(): LegacySeed {
  const seed = loadLegacySeed(legacySeedData);
  const languages = new Map<string, "it" | "en">([
    ["md17", "en"],
    ["md85", "it"],
  ]);

  return {
    ...seed,
    contacts: seed.contacts.map((contact) => {
      const language = languages.get(contact.id);

      return language === undefined ? contact : { ...contact, language };
    }),
  };
}

// Contacts of the real seed, by id. md17: a company, the first on the list,
// and a supplier. md104: a person, a resident. md31: a company that is
// nothing to any building. md59: a person that is nothing to any building.
// md18: archived. md12: has one connection, to md15.
const COMPANY_FIRST = "md17";

const PERSON_RESIDENT = "md104";

const COMPANY_UNUSED = "md31";

const PERSON_OWNER = "md59";

const ARCHIVED = "md18";

const WITH_CONNECTION = "md12";

const CONNECTED = "md15";

const TABLE_HEADERS = [
  "Name / Company",
  "Code",
  "Type",
  "St.",
  "Reference address",
  "Tax code",
  "VAT no.",
  "Lng.",
  "Category",
];

/** Finds the contact with a connection, selects it and opens the Connected Contacts tab. */
async function openConnectedContact(page: ContactsScreenPage): Promise<void> {
  const name = page.contactName(WITH_CONNECTION);

  await page.tabs.activate("Connected Contacts");
  await page.filters.typeKeyword(name.split(" ")[0] ?? "");
  await page.filters.search();
  await page.list.clickRow(name);
}
