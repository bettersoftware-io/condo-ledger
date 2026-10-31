import { describe, expect, it } from "vitest";

import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";

import { mountUnits } from "./UnitsScreen.page.tsx";

describe("the Units screen's dialogs", () => {
  it("New unit opens blank, an apartment, and + Add waits for a code", async () => {
    const page = mountUnits("p1");

    await page.units.clickTool("Add");
    await page.chooseMenuItem("New unit");

    expect(page.dialog.title()).toBe("New Unit");
    expect(page.dialog.requiredUnannounced()).toEqual([]);
    expect(page.dialog.legends()).toEqual([
      "IDENTIFICATION DATA",
      "RESTRICTED PERIOD",
      "ADDITIONAL DATA",
      "NOTES",
    ]);
    expect(page.dialog.fieldValue("Unit name")).toBe("");
    expect(page.dialog.fieldValue("Code")).toBe("");
    expect(page.dialog.chosen("Type")).toBe("Apartment");
    expect(page.dialog.saveLabel()).toBe("+ Add");
    expect(page.dialog.isSaveDisabled()).toBe(true);
    expect(page.dialog.message()).toBeNull();

    await page.dialog.fill("Floor", "3");

    expect(page.dialog.isSaveDisabled()).toBe(true);
    expect(page.dialog.message()).toBe("Enter a code");
  });

  it("refuses a code another unit has, and adds a free one to the selected unit's group", async () => {
    const page = mountUnits("p1");

    await page.units.clickTool("Add");
    await page.chooseMenuItem("New unit");
    await page.dialog.fill("Code", "A1");

    expect(page.dialog.message()).toBe(
      "Another unit of this period has the code A1",
    );
    expect(page.dialog.isSaveDisabled()).toBe(true);

    await page.dialog.fill("Code", "A5");
    await page.dialog.choose("Type", "Garage");

    expect(page.dialog.chosen("Type")).toBe("Garage");
    expect(page.dialog.isSaveDisabled()).toBe(false);

    await page.dialog.save();

    expect(page.dialog.isShown()).toBe(false);
    expect(page.units.grid.childrenOf(page.labelOf("group:ug1"))).toContain(
      page.labelOf("unit:u-new-1"),
    );
    expect(page.units.grid.rowTexts(page.labelOf("unit:u-new-1"))[4]).toBe(
      "Garage",
    );
  });

  it("refuses a date that does not read, an end before the start and dates outside the period", async () => {
    const page = mountUnits("p1");

    await page.units.clickTool("Add");
    await page.chooseMenuItem("New unit");
    await page.dialog.fill("Code", "A5");
    await page.dialog.fill("Start date", "x");

    expect(page.dialog.message()).toBe("Enter a date as day/month/year");

    await page.dialog.fill("Start date", "10/05/2011");
    await page.dialog.fill("End date", "1/5");

    expect(page.dialog.message()).toBe("The end date is before the start date");

    await page.dialog.fill("End date", "01/01/2012");

    expect(page.dialog.message()).toBe(
      "The dates must lie within the period (01/01/2011 - 31/12/2011)",
    );
    expect(page.dialog.isSaveDisabled()).toBe(true);
  });

  it("✎ opens Edit Unit on A1 as it stands, and ✎ Save writes it", async () => {
    const page = mountUnits("p1");

    await page.units.clickTool("Edit");

    expect(page.dialog.title()).toBe("Edit Unit");
    expect(page.dialog.fieldValue("Code")).toBe("A1");
    expect(page.dialog.fieldValue("Floor")).toBe("1");
    expect(page.dialog.chosen("Type")).toBe("Shop");
    expect(page.dialog.fieldValue("Start date")).toBe("01/05/2011");
    expect(page.dialog.fieldValue("End date")).toBe("31/05/2011");
    expect(page.dialog.saveLabel()).toBe("✎ Save");

    await page.dialog.fill("Notes", "Corner shop");
    await page.dialog.fill("Floor", "2");
    await page.dialog.pressEnter();

    expect(page.dialog.isShown()).toBe(false);
    expect(page.units.grid.rowTexts(page.labelOf("unit:u1"))[1]).toBe("2");
    expect(page.profileNotes()).toBe("Corner shop");
  });

  it("the bottom ✎ edits the unit on Unit Profile; Cancel closes without writing", async () => {
    const page = mountUnits("p1");

    await page.tabs.clickTool("Edit unit");

    expect(page.dialog.title()).toBe("Edit Unit");

    await page.dialog.fill("Floor", "9");
    await page.dialog.cancel();

    expect(page.dialog.isShown()).toBe(false);
    expect(page.units.grid.rowTexts(page.labelOf("unit:u1"))[1]).toBe("1");
  });

  it("New group at the top refuses a code or a name a sibling has, and adds Lift", async () => {
    const page = mountUnits("p1");

    await page.units.grid.clickRow(page.labelOf("root"));
    await page.units.clickTool("Add");
    await page.chooseMenuItem("New group");

    expect(page.dialog.title()).toBe("New Group");
    expect(page.dialog.requiredUnannounced()).toEqual([]);
    expect(page.dialog.address()).toBe("---");
    expect(page.dialog.legends()).toEqual(["NOTES"]);
    expect(page.dialog.isSaveDisabled()).toBe(true);

    await page.dialog.fill("Code", "A");
    await page.dialog.fill("Name", "Stairwell C");

    expect(page.dialog.message()).toBe(
      "A group with code A or name Stairwell C is already in this group",
    );

    await page.dialog.fill("Code", "C");
    await page.dialog.fill("Name", "");

    expect(page.dialog.message()).toBe("Enter a name");

    await page.dialog.fill("Name", "Lift");
    await page.dialog.fill("Notes", "The lift shaft");
    await page.dialog.save();

    expect(page.dialog.isShown()).toBe(false);
    expect(page.units.grid.childrenOf(page.labelOf("root"))).toContain(
      page.labelOf("group:ug-new-1"),
    );
    expect(page.labelOf("group:ug-new-1")).toBe("C - Lift");
  });

  it("✎ on group B opens Edit Group with its address, which ⊖ removes and ✎ says is not yet editable", async () => {
    const page = mountUnits("p1");

    await page.units.grid.clickRow(page.labelOf("group:ug2"));
    await page.units.clickTool("Edit");

    expect(page.dialog.title()).toBe("Edit Group");
    expect(page.dialog.fieldValue("Code")).toBe("B");
    expect(page.dialog.fieldValue("Name")).toBe("Garages");
    expect(page.dialog.address()).toBe(
      "Piazza del Duomo, 39/b, 33033 Codroipo",
    );

    await page.dialog.editAddress();

    expect(page.toasts()).toEqual(["Address: not yet available"]);

    await page.dialog.removeAddress();

    expect(page.dialog.address()).toBe("---");

    await page.dialog.save();

    expect(page.labelOf("group:ug2")).toBe("B - Garages");
  });

  it("deletes an empty group after asking; − is off on a group with units, the root and the rounding row", async () => {
    const page = mountUnits("p1");

    for (const key of ["group:ug1", "root", "rounding"]) {
      await page.units.grid.clickRow(page.labelOf(key));

      expect(page.units.isToolDisabled("Delete")).toBe(true);
    }

    await page.units.clickTool("Add");
    await page.chooseMenuItem("New group");
    await page.dialog.fill("Code", "C");
    await page.dialog.fill("Name", "Lift");
    await page.dialog.save();
    await page.units.grid.clickRow("C - Lift");
    await page.units.clickTool("Delete");

    expect(page.confirmText()).toBe("Delete the group C - Lift?");

    await page.confirmNo();

    expect(page.confirmText()).toBeNull();
    expect(page.units.grid.rowLabels()).toContain("C - Lift");

    await page.units.clickTool("Delete");
    await page.confirmYes();

    expect(page.confirmText()).toBeNull();
    expect(page.units.grid.rowLabels()).not.toContain("C - Lift");
  });

  it("asks before deleting a unit, and says why the journal keeps A1", async () => {
    const page = mountUnits("p1");
    const name = page.ownerLabelOf("r1");

    await page.units.clickTool("Delete");

    expect(page.confirmText()).toBe("Delete the unit A1?");

    await page.confirmYes();

    expect(page.confirmError()).toBe(
      `${name} is named in the journal: delete those entries first`,
    );

    await page.confirmNo();
    await page.tabs.clickTool("Delete unit");

    expect(page.confirmText()).toBe("Delete the unit A1?");
    expect(page.confirmError()).toBeNull();
  });

  it("removing r166 asks, then says the journal names them, and A04's row stays selected", async () => {
    const page = mountUnits("p36");
    const row = page.labelOf("resident:r166");

    await page.units.grid.clickRow(row);

    const name = page.ownerLabelOf("r166");

    await page.units.clickTool("Delete");

    expect(page.confirmText()).toBe(`Remove ${name} from A04?`);

    await page.confirmYes();

    expect(page.confirmError()).toBe(
      `${name} is named in the journal: delete those entries first`,
    );
    expect(page.units.grid.selectedLabels()).toEqual([row]);

    await page.confirmNo();
    await page.activateTab("Unit Owners");
    await page.tabs.clickTool("Remove owner");

    expect(page.confirmText()).toBe(`Remove ${name} from A04?`);
  });

  it("Edit Owner on p36 keeps the contact, the role and the balance the opening entry posted", async () => {
    const page = mountUnits("p36");

    await page.units.grid.clickRow(page.labelOf("resident:r166"));
    await page.activateTab("Unit Owners");
    await page.tabs.clickTool("Edit owner");

    expect(page.dialog.title()).toBe("Edit Owner");
    expect(page.dialog.requiredUnannounced()).toEqual([]);
    expect(page.dialog.fieldValue("Linked contact")).toBe(
      page.ownerLabelOf("r166"),
    );
    expect(page.dialog.isFieldDisabled("Linked contact")).toBe(true);
    expect(page.dialog.chosen("Role")).toBe("Owner (PR)");
    expect(page.dialog.isFieldDisabled("Role")).toBe(true);
    expect(page.dialog.isFieldDisabled("Previous balance")).toBe(true);
    expect(page.dialog.balanceNote()).toBe(
      "Posted in the opening entry: change it through the journal.",
    );
    expect(page.dialog.readOnlyValue("Co-ownership %")).toBe("100%");
    expect(page.dialog.legends()).toEqual(["RESTRICTED PERIOD"]);
    expect(page.dialog.fieldValue("Start date")).toBe("19/01/2013");
    expect(page.dialog.saveLabel()).toBe("✎ Save");
    expect(page.dialog.isSaveDisabled()).toBe(false);
  });

  it("the top ✎ on a resident edits that owner", async () => {
    const page = mountUnits("p36");

    await page.units.grid.clickRow(page.labelOf("resident:r167"));
    await page.units.clickTool("Edit");

    expect(page.dialog.title()).toBe("Edit Owner");
    expect(page.dialog.fieldValue("End date")).toBe("18/01/2013");
  });

  it("the contact picker filters by what is typed, and the owner chosen joins A3 in the grid", async () => {
    const page = mountUnits("p1");
    const name = page.contactName("md17");
    const typed = name.slice(0, 4).toLowerCase();

    await page.units.grid.clickRow(page.labelOf("unit:u3"));
    await page.tabs.clickTool("Add owner");

    expect(page.dialog.title()).toBe("Add Owner");
    expect(page.dialog.requiredUnannounced()).toEqual([]);
    expect(page.dialog.contactOptions()).toEqual([]);
    expect(page.dialog.chosen("Role")).toBe("Owner (PR)");
    expect(page.dialog.fieldValue("Previous balance")).toBe("0.00");
    expect(page.dialog.readOnlyValue("Co-ownership %")).toBe("");
    expect(page.dialog.isSaveDisabled()).toBe(true);

    await page.dialog.fill("Linked contact", typed);

    const offered = page.dialog.contactOptions();

    expect(offered).toContain(name);
    expect(offered.length).toBeLessThan(48);
    expect(
      offered.every((option) => {
        return option.toLowerCase().includes(typed);
      }),
    ).toBe(true);

    await page.dialog.chooseContact(name);

    expect(page.dialog.fieldValue("Linked contact")).toBe(name);
    expect(page.dialog.contactOptions()).toEqual([]);

    await page.dialog.choose("Role", "Tenant (CO)");
    await page.dialog.fill("Start date", "01/02/2012");

    expect(page.dialog.message()).toBe(
      "The dates must lie within the period (01/01/2011 - 31/12/2011)",
    );

    await page.dialog.fill("Start date", "1/3");
    await page.dialog.fill("End date", "31/12/2011");
    await page.dialog.save();

    expect(page.dialog.isShown()).toBe(false);
    expect(page.units.grid.childrenOf(page.labelOf("unit:u3"))).toContain(
      page.labelOf("resident:r-new-1"),
    );
    expect(page.labelOf("resident:r-new-1")).toContain(name);
  });

  it("says when no contact matches, and refuses a contact who already lives in the unit until another is typed", async () => {
    const page = mountUnits("p1");
    const name = page.contactName("md7");

    await page.units.grid.clickRow(page.labelOf("unit:u3"));
    await page.units.clickTool("Add");
    await page.chooseMenuItem("New owner");
    await page.dialog.fill("Linked contact", "zzzz");

    expect(page.dialog.noContactMatches()).toBe(true);
    expect(page.dialog.contactOptions()).toEqual([]);

    await page.dialog.fill("Linked contact", name);
    await page.dialog.chooseContact(name);

    expect(page.dialog.message()).toBe(`${name} already lives in this unit`);
    expect(page.dialog.isSaveDisabled()).toBe(true);

    await page.dialog.fill("Linked contact", name.slice(0, 3));

    expect(page.dialog.message()).toBe("Choose a contact");
  });

  it("takes a typed previous balance while the period has no opening entry", async () => {
    const page = mountUnits(null, createSmallSeed());
    const name = page.contactName("md1");

    await page.tabs.clickTool("Add owner");

    expect(page.dialog.isFieldDisabled("Previous balance")).toBe(false);
    expect(page.dialog.balanceNote()).toBeNull();

    await page.dialog.fill("Linked contact", name);
    await page.dialog.chooseContact(name);

    expect(page.dialog.isSaveDisabled()).toBe(true);

    await page.dialog.fill("Previous balance", "abc");

    expect(page.dialog.message()).toBe("Enter an amount");

    await page.dialog.fill("Previous balance", "12.50");
    await page.dialog.save();

    expect(page.dialog.isShown()).toBe(false);
    expect(page.labelOf("resident:r-new-1")).toContain(name);
  });

  it("with no unit selected, there is no owner to add, edit or remove", async () => {
    const page = mountUnits("p1");

    await page.units.grid.clickRow(page.labelOf("group:ug1"));
    await page.units.clickTool("Add");

    expect(page.isMenuItemDisabled("New owner")).toBe(true);

    await page.closeMenu();

    expect(page.tabs.isToolDisabled("Add owner")).toBe(true);
    expect(page.tabs.isToolDisabled("Edit unit")).toBe(true);
    expect(page.tabs.isToolDisabled("Delete unit")).toBe(true);

    await page.units.grid.clickRow(page.labelOf("root"));

    expect(page.units.isToolDisabled("Edit")).toBe(true);
  });

  it("on Unit Owners, a unit with residents but none selected has no owner to edit or remove", async () => {
    const page = mountUnits("p36");

    await page.units.grid.clickRow(page.labelOf("unit:u137"));
    await page.activateTab("Unit Owners");

    expect(page.tabs.isToolDisabled("Add owner")).toBe(false);
    expect(page.tabs.isToolDisabled("Edit owner")).toBe(true);
    expect(page.tabs.isToolDisabled("Remove owner")).toBe(true);
  });
});
