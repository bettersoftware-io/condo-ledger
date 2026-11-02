import { describe, expect, it } from "vitest";

import { mountContactDialogAlone } from "./ContactForm.page.tsx";
import { mountContacts } from "./ContactsScreen.page.tsx";

describe("the person and company dialogs", () => {
  it("New Person keeps + Add disabled for a blank last name, and selects the person once saved", async () => {
    const page = mountContacts();

    await page.tabs.openAddMenu();
    await page.tabs.clickMenuItem("New person");

    expect(page.dialog.title()).toBe("New Person");
    expect(page.dialog.saveLabel()).toBe("+ Add");
    expect(page.dialog.requiredUnannounced()).toEqual([]);
    expect(page.dialog.legends()).toEqual([
      "PERSONAL DATA",
      "CONTACTS",
      "USEFUL DATA",
      "NOTES",
    ]);
    expect(page.dialog.chosen("Status")).toBe("Active");
    expect(page.dialog.isSaveDisabled()).toBe(true);

    await page.dialog.fill("First name", "Zeno");

    expect(page.dialog.isSaveDisabled()).toBe(true);

    await page.dialog.fill("Last name", "Zzyzx");

    expect(page.dialog.isSaveDisabled()).toBe(false);

    await page.dialog.save();

    expect(page.dialog.isShown()).toBe(false);
    expect(page.list.selectedLabels()).toEqual(["Zzyzx Zeno"]);
    expect(page.tabs.value("First name")).toBe("Zeno");
  });

  it("refuses a code of 16 characters, and the code of another contact", async () => {
    const page = mountContacts();

    await page.tabs.openAddMenu();
    await page.tabs.clickMenuItem("New person");
    await page.dialog.fill("Last name", "Zzyzx");
    await page.dialog.fill("Code", "ABCDEFGHIJKLMNOP");

    expect(page.dialog.message()).toBe("A code has at most 15 characters");
    // The form is taller than the screen, so the reason is by the buttons.
    expect(page.dialog.isMessageInFooter()).toBe(true);
    expect(page.dialog.isSaveDisabled()).toBe(true);

    const taken = page.list.rowTexts(page.list.rowLabels()[0] ?? "")[1] ?? "";

    await page.dialog.fill("Code", taken.toLowerCase());

    expect(page.dialog.message()).toBe(
      `Another contact has the code ${taken.toLowerCase()}`,
    );
  });

  it("reads a birth date typed short and shows what it read, and refuses one that is no date", async () => {
    const page = mountContacts();

    await page.tabs.openAddMenu();
    await page.tabs.clickMenuItem("New person");
    await page.dialog.fill("Last name", "Zzyzx");
    await page.dialog.fill("Birth date", "1/2");

    expect(page.form.birthDateRead()).toBe("01/02/2027");

    await page.dialog.fill("Birth date", "31/02/1980");

    expect(page.dialog.message()).toBe("The birth date is not a date");
    expect(page.form.birthDateRead()).toBeNull();
  });

  it("Edit Person opens on the contact as it stands, and saves a rename, a gender and a language", async () => {
    const page = mountContacts();
    const name = page.contactName("md59");

    await page.list.clickRow(name);
    await page.tabs.clickTool("Edit contact");

    expect(page.dialog.title()).toBe("Edit Person");
    expect(page.dialog.saveLabel()).toBe("✎ Save");
    expect(page.dialog.isSaveDisabled()).toBe(false);
    expect(page.form.gender()).toBe("Male");
    expect(page.dialog.chosen("Language")).toBe("- None -");

    await page.dialog.fill("Last name", "Zzyzx");
    await page.form.chooseGender("Female");
    await page.dialog.choose("Language", "Italian");
    await page.dialog.save();

    expect(page.dialog.isShown()).toBe(false);
    expect(page.list.selectedLabels().map(startsWithZzyzx)).toEqual([true]);
    expect(page.tabs.value("Last name")).toBe("Zzyzx");
    expect(page.tabs.value("Gender")).toBe("Female");
    expect(page.tabs.value("Language")).toBe("Italian");
  });

  it("every gender can be chosen with the radios, and Unspecified saves as none", async () => {
    const page = mountContacts();
    const name = page.contactName("md59");

    await page.list.clickRow(name);
    await page.tabs.clickTool("Edit contact");

    for (const gender of ["Female", "Unspecified", "Male"]) {
      await page.form.chooseGender(gender);

      expect(page.form.gender()).toBe(gender);
    }

    await page.form.chooseGender("Unspecified");
    await page.dialog.save();

    expect(page.tabs.value("Gender")).toBe("Unspecified");
  });

  it("Edit Person shows the contact's category with no Contacts screen under it", () => {
    const page = mountContactDialogAlone(CONTACT_WITH_CATEGORY);

    expect(page.dialog.chosen("Contact category")).toBe(
      page.categoryNameOf(page.categoryIdOf() ?? ""),
    );
  });

  it("Edit Company shows Company name, Registered office and Tax domicile, and no Gender", async () => {
    const page = mountContacts();

    await page.list.clickRow(page.contactName("md31"));
    await page.tabs.clickTool("Edit contact");

    expect(page.dialog.title()).toBe("Edit Company");
    expect(page.dialog.legends()).toEqual([
      "COMPANY DATA",
      "CONTACTS",
      "USEFUL DATA",
      "NOTES",
    ]);
    expect(page.dialog.fieldValue("Company name")).toBe(
      page.contactName("md31"),
    );
    expect(page.form.hasField("Registered office")).toBe(true);
    expect(page.form.hasField("Tax domicile")).toBe(true);
    expect(page.form.hasField("Gender")).toBe(false);
    expect(page.form.hasField("First name")).toBe(false);
  });

  it("a company's offices are set through the Address dialog and cleared with ⊖", async () => {
    const page = mountContacts();

    await page.list.clickRow(page.contactName("md31"));
    await page.tabs.clickTool("Edit contact");
    await page.form.editAddress("Registered office");
    await page.stacked.fill("Street and number", "Via Prova, 1");
    await page.stacked.save();
    await page.form.editAddress("Tax domicile");
    await page.stacked.fill("Street and number", "Via Prova, 2");
    await page.stacked.save();

    expect(page.form.address("Registered office")).toBe("Via Prova, 1");
    expect(page.form.address("Tax domicile")).toBe("Via Prova, 2");

    await page.form.removeAddress("Tax domicile");
    await page.dialog.save();

    expect(page.tabs.value("Registered office")).toBe("Via Prova, 1");
    expect(page.tabs.value("Tax domicile")).toBe("---");
  });

  it("USEFUL DATA and NOTES are saved: salutation, tax code, VAT number, category, postal address and language", async () => {
    const page = mountContacts();
    const category = page.categories.rows()[1]?.[0] ?? "";
    const name = page.contactName("md59");

    await page.list.clickRow(name);
    await page.tabs.clickTool("Edit contact");
    await page.dialog.choose("Salutation", "- None -");
    await page.dialog.fill("Tax code", "TAX-1");
    await page.dialog.fill("VAT number", "VAT-1");
    await page.dialog.choose("Contact category", category);
    await page.dialog.choose("Language", "English");
    await page.dialog.fill("Notes", "Prefers email");
    await page.form.editAddress("Postal address");
    await page.stacked.fill("Street and number", "Via Prova, 9");
    await page.stacked.save();
    await page.dialog.save();

    expect(page.tabs.value("Salutation", "USEFUL DATA")).toBe("---");
    expect(page.tabs.value("Tax code", "USEFUL DATA")).toBe("TAX-1");
    expect(page.tabs.value("VAT number", "USEFUL DATA")).toBe("VAT-1");
    expect(page.tabs.value("Category", "USEFUL DATA")).toBe(category);
    expect(page.tabs.value("Postal address", "USEFUL DATA")).toBe(
      "Via Prova, 9",
    );
    expect(page.tabs.value("Language", "USEFUL DATA")).toBe("English");

    await page.tabs.clickTool("Edit contact");
    await page.form.removeAddress("Postal address");
    await page.dialog.choose("Salutation", "Dear Sir");
    await page.form.chooseGender("Unspecified");

    expect(page.form.gender()).toBe("Unspecified");
    await page.dialog.choose("Language", "- None -");
    await page.dialog.choose("Contact category", "- None -");
    await page.dialog.save();

    expect(page.tabs.value("Postal address", "USEFUL DATA")).toBe("---");
    expect(page.tabs.value("Salutation", "USEFUL DATA")).toBe("Dear Sir");
    expect(page.tabs.value("Language", "USEFUL DATA")).toBe("---");
  });

  it("New Company is added once it has a name, and is selected", async () => {
    const page = mountContacts();

    await page.tabs.openAddMenu();
    await page.tabs.clickMenuItem("New company");

    expect(page.dialog.title()).toBe("New Company");
    expect(page.dialog.isSaveDisabled()).toBe(true);

    await page.dialog.fill("Company name", "Zzyzx Works");

    expect(page.dialog.isSaveDisabled()).toBe(false);

    await page.dialog.save();

    expect(page.list.selectedLabels()).toEqual(["Zzyzx Works"]);
    expect(page.tabs.legends()).toContain("COMPANY DATA");
  });

  it("Status set to Archived shows the archive icon in the list", async () => {
    const page = mountContacts();
    const name = page.contactName("md59");

    await page.list.clickRow(name);
    await page.tabs.clickTool("Edit contact");
    await page.dialog.choose("Status", "Archived");
    await page.dialog.save();

    expect(page.list.statusOf(name)).toEqual({
      status: "archived",
      hasIcon: true,
    });
  });

  it("an address is set through the Address dialog over the person, and ⊖ clears it", async () => {
    const page = mountContacts();

    await page.list.clickRow(page.contactName("md59"));
    await page.tabs.clickTool("Edit contact");

    expect(page.form.address("Residence address")).toBe("---");

    await page.form.editAddress("Residence address");

    expect(page.stacked.title()).toBe("Address");

    await page.stacked.fill("Street and number", "Via Prova, 7");
    await page.stacked.fill("City", "Udine");
    await page.stacked.save();

    expect(page.stacked.isShown()).toBe(false);
    expect(page.form.address("Residence address")).toBe("Via Prova, 7, Udine");

    await page.dialog.save();

    expect(page.tabs.value("Residence address")).toBe("Via Prova, 7, Udine");

    await page.tabs.clickTool("Edit contact");
    await page.form.removeAddress("Residence address");

    expect(page.form.address("Residence address")).toBe("---");

    await page.dialog.save();

    expect(page.tabs.value("Residence address")).toBe("---");
  });

  it("a row added through Add Contact shows in the form and on the sheet after Save", async () => {
    const page = mountContacts();

    await page.list.clickRow(page.contactName("md59"));
    await page.tabs.clickTool("Edit contact");
    await page.form.addRow();

    expect(page.stacked.title()).toBe("Add Contact");
    expect(page.stacked.requiredUnannounced()).toEqual([]);
    expect(page.stacked.fieldValue("Order")).toBe("1");
    expect(page.stacked.chosen("Contact type")).toBe("Phone");
    expect(page.stacked.fieldValue("Label")).toBe("Phone");
    expect(page.stacked.isSaveDisabled()).toBe(true);

    await page.stacked.fill("Value", "0432 000 000");
    await page.stacked.save();

    expect(page.stacked.isShown()).toBe(false);
    expect(page.form.rows()).toEqual([["Phone", "0432 000 000"]]);

    await page.dialog.save();

    expect(page.tabs.value("Phone", "CONTACTS")).toBe("0432 000 000");
  });

  it("Cancel on the person drops a row that was added, and ⊖ takes one out without asking", async () => {
    const page = mountContacts();

    await page.list.clickRow(page.contactName("md59"));
    await page.tabs.clickTool("Edit contact");
    await page.form.addRow();
    await page.stacked.fill("Value", "0432 000 000");
    await page.stacked.save();
    await page.dialog.cancel();
    await page.tabs.clickTool("Edit contact");

    expect(page.form.rows()).toEqual([]);

    await page.form.addRow();
    await page.stacked.choose("Contact type", "Email");

    expect(page.stacked.fieldValue("Label")).toBe("Email");

    await page.stacked.fill("Value", "prova@example.org");
    await page.stacked.save();
    await page.form.editRow(0);

    expect(page.stacked.title()).toBe("Edit Contact");
    expect(page.stacked.fieldValue("Value")).toBe("prova@example.org");

    await page.stacked.fill("Value", "altro@example.org");
    await page.stacked.save();

    expect(page.form.rows()).toEqual([["Email", "altro@example.org"]]);

    await page.form.removeRow(0);

    expect(page.form.rows()).toEqual([]);
  });

  it("refuses a row with a blank value or an order that is not a whole number", async () => {
    const page = mountContacts();

    await page.list.clickRow(page.contactName("md59"));
    await page.tabs.clickTool("Edit contact");
    await page.form.addRow();
    await page.stacked.fill("Value", "x");
    await page.stacked.fill("Order", "0");

    expect(page.stacked.message()).toBe("The order is a whole number from 1");
    expect(page.stacked.isSaveDisabled()).toBe(true);
  });

  it("Escape closes only the Address dialog over Edit Person, and the focus returns to the ✎ that opened it", async () => {
    const page = mountContacts();

    await page.list.clickRow(page.contactName("md59"));
    await page.tabs.clickTool("Edit contact");
    await page.form.editAddress("Office address");
    await page.pressEscape();

    expect(page.stacked.isShown()).toBe(false);
    expect(page.dialog.isShown()).toBe(true);
    expect(page.focusedLabel()).toBe("Edit Office address");

    await page.pressEscape();

    expect(page.dialog.isShown()).toBe(false);
    expect(page.focusedLabel()).toBe("Edit contact");
  });

  it("Escape closes only Add Contact over Edit Person, and the focus returns to the ⊕ that opened it", async () => {
    const page = mountContacts();

    await page.list.clickRow(page.contactName("md59"));
    await page.tabs.clickTool("Edit contact");
    await page.form.addRow();
    await page.stacked.fill("Value", "x");
    await page.pressEscape();

    expect(page.stacked.isShown()).toBe(false);
    expect(page.dialog.isShown()).toBe(true);
    expect(page.form.rows()).toEqual([]);
    expect(page.focusedLabel()).toBe("Add contact row");
  });
});

describe("deleting a contact", () => {
  it("asks to confirm, naming the contact, and removes an unused one and selects the first row", async () => {
    const page = mountContacts();
    const name = page.contactName("md59");
    const first = page.list.rowLabels()[0] ?? "";

    await page.list.clickRow(name);
    await page.tabs.clickTool("Delete contact");

    expect(page.confirmText()).toBe(`Delete ${name}? This cannot be undone.`);

    await page.confirmYes();

    expect(page.confirmText()).toBeNull();
    expect(page.list.rowLabels()).not.toContain(name);
    expect(page.list.selectedLabels()).toEqual([first]);
  });

  it("answers No by keeping the contact", async () => {
    const page = mountContacts();
    const name = page.contactName("md59");

    await page.list.clickRow(name);
    await page.tabs.clickTool("Delete contact");
    await page.confirmNo();

    expect(page.confirmText()).toBeNull();
    expect(page.list.rowLabels()).toContain(name);
  });

  it("says a resident cannot be deleted, and why, and the row stays", async () => {
    const page = mountContacts();
    const name = page.contactName("md104");

    await page.list.clickRow(name);
    await page.tabs.clickTool("Delete contact");
    await page.confirmYes();

    expect(page.confirmError()).toBe(
      `${name} is a resident of Pozzetto, so it cannot be deleted. Archive it instead.`,
    );
    expect(page.list.rowLabels()).toContain(name);

    await page.confirmNo();

    expect(page.list.rowLabels()).toContain(name);
  });
});

function startsWithZzyzx(label: string): boolean {
  return label.startsWith("Zzyzx");
}

// A person of the real seed that has a category.
const CONTACT_WITH_CATEGORY = "md104";
