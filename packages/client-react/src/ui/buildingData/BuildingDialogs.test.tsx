import { describe, expect, it } from "vitest";

import { mountBuildingData } from "./BuildingDataScreen.page.tsx";

describe("the Building Data screen's dialogs", () => {
  it("the top ✎ on Saturno's row opens Edit Building on it, its required fields announced", async () => {
    const page = mountBuildingData("p1");

    await page.data.grid.clickRow(page.labelOf("c1"));
    await page.data.clickTool("Edit");

    expect(page.dialog.title()).toBe("Edit Building");
    expect(page.dialog.requiredUnannounced()).toEqual([]);
    expect(page.dialog.fieldValue("Name")).toBe("Saturno");
    expect(page.dialog.fieldValue("Building code")).toBe("SAT");
    expect(page.dialog.chosen("Status")).toBe("Active");
    expect(page.dialog.chosen("Type")).toBe("Building");
    expect(page.dialog.address()).toBe("Piazza del Duomo, 39, 33033 Codroipo");
    expect(page.dialog.fieldValue("Tax code")).toBe("010027376");
    expect(page.dialog.fieldValue("Construction date")).toBe("20/05/1980");
    expect(page.dialog.legends()).toEqual(["OTHER", "NOTES"]);
    expect(page.dialog.fieldValue("Cadastral data")).toBe("");
    expect(page.dialog.saveLabel()).toBe("✎ Save");
    expect(page.dialog.isSaveDisabled()).toBe(false);
  });

  it("Edit Building with a blank name keeps its OK disabled and says why", async () => {
    const page = mountBuildingData("p1");

    await page.tabs.clickTool("Edit building");
    await page.dialog.fill("Name", "");

    expect(page.dialog.isSaveDisabled()).toBe(true);
    expect(page.dialog.message()).toBe("Enter a name");
  });

  it("Edit Building refuses another building's name or code, and a date that does not read", async () => {
    const page = mountBuildingData("p36");

    await page.tabs.clickTool("Edit building");
    await page.dialog.fill("Name", "Saturno");

    expect(page.dialog.message()).toBe("Another building is named Saturno");
    expect(page.dialog.isSaveDisabled()).toBe(true);

    await page.dialog.fill("Name", "Pozzetto");
    await page.dialog.fill("Building code", "sat");

    expect(page.dialog.message()).toBe("Another building has the code sat");

    await page.dialog.fill("Building code", "");
    await page.dialog.fill("Construction date", "31/02");

    expect(page.dialog.message()).toBe("Enter a date as day/month/year");
  });

  it("Edit Building saves what the profile then shows, Modified on stamped", async () => {
    const page = mountBuildingData("p36");

    await page.tabs.clickTool("Edit building");
    await page.dialog.fill("Building code", "POZ");
    await page.dialog.choose("Status", "Archived");
    await page.dialog.choose("Type", "Residence");
    await page.dialog.fill("Construction date", "1/3/1975");
    await page.dialog.fill("Cadastral data", "Sheet 12");
    await page.dialog.fill("Notes", "Lift renewed");
    await page.dialog.save();

    expect(page.dialog.isShown()).toBe(false);
    expect(page.sheetValue("Building code")).toBe("POZ");
    expect(page.sheetValue("Status")).toBe("Archived");
    expect(page.sheetValue("Type")).toBe("🏘️ Residence");
    expect(page.sheetValue("Construction date")).toBe("01/03/1975");
    expect(page.sheetValue("Cadastral data")).toBe("Sheet 12");
    expect(page.sheetValue("Modified on")).toBe("14/10/2026 10:00:00");
    expect(page.profileNotes()).toBe("Lift renewed");
    expect(page.typeOf(page.labelOf("c19"))).toBe("Residence");
  });

  it("the Address dialog edits the building's address over Edit Building: a blank street keeps OK disabled and says so", async () => {
    const page = mountBuildingData("p36");

    await page.tabs.clickTool("Edit building");
    await page.dialog.editAddress();

    expect(page.addressDialog.title()).toBe("Address");
    expect(page.addressDialog.requiredUnannounced()).toEqual([]);
    expect(page.addressDialog.fieldValue("Street and number")).toBe(
      "Piazza Libertà, 74",
    );
    expect(page.addressDialog.fieldValue("Postcode")).toBe("33045");
    expect(page.addressDialog.fieldValue("City")).toBe("Nimis");

    await page.addressDialog.fill("Street and number", "");

    expect(page.addressDialog.isSaveDisabled()).toBe(true);
    expect(page.addressDialog.message()).toBe("Enter the street and number");

    await page.addressDialog.fill("Street and number", "Via Udine, 3");
    await page.addressDialog.save();

    expect(page.addressDialog.isShown()).toBe(false);
    expect(page.dialog.address()).toBe("Via Udine, 3, 33045 Nimis");

    await page.dialog.save();

    expect(page.sheetValue("Address")).toBe("Via Udine, 3, 33045 Nimis");
    expect(page.labelOf("c19")).toBe("Pozzetto (Via Udine, 3, 33045 Nimis)");
  });

  it("Cancel in the Address dialog leaves the address; ⊖ removes it, and the profile reads ---", async () => {
    const page = mountBuildingData("p36");

    await page.tabs.clickTool("Edit building");
    await page.dialog.editAddress();
    await page.addressDialog.fill("Street and number", "Via Udine, 3");
    await page.addressDialog.cancel();

    expect(page.addressDialog.isShown()).toBe(false);
    expect(page.dialog.address()).toBe("Piazza Libertà, 74, 33045 Nimis");

    await page.dialog.removeAddress();

    expect(page.dialog.address()).toBe("---");

    await page.dialog.editAddress();

    expect(page.addressDialog.saveLabel()).toBe("+ Add");
    expect(page.addressDialog.isSaveDisabled()).toBe(true);

    await page.addressDialog.cancel();
    await page.dialog.save();

    expect(page.sheetValue("Address")).toBe("---");
    expect(page.labelOf("c19")).toBe("Pozzetto");
  });

  it("the top ✎ on a period row opens Edit Management / Period on it", async () => {
    const page = mountBuildingData("p1");

    await page.data.clickTool("Edit");

    expect(page.dialog.title()).toBe("Edit Management / Period");
    expect(page.dialog.requiredUnannounced()).toEqual([]);
    expect(page.dialog.fieldValue("Management name")).toBe("2011");
    expect(page.dialog.chosen("Type")).toBe("Ordinary");
    expect(page.dialog.chosen("Status")).toBe("Open");
    expect(page.dialog.legends()).toEqual(["COMPETENCE PERIOD", "NOTES"]);
    expect(page.dialog.fieldValue("Start date")).toBe("01/01/2011");
    expect(page.dialog.fieldValue("End date")).toBe("31/12/2011");
  });

  it("Edit Management / Period refuses dates that cut A1's May, an end before the start, and a blank date", async () => {
    const page = mountBuildingData("p1");

    await page.data.clickTool("Edit");
    await page.dialog.fill("Start date", "01/06/2011");

    expect(page.dialog.message()).toBe(
      "A1 has dates outside these: change them first",
    );
    expect(page.dialog.isSaveDisabled()).toBe(true);

    await page.dialog.fill("Start date", "01/01/2011");
    await page.dialog.fill("End date", "01/01/2010");

    expect(page.dialog.message()).toBe("The end date is before the start date");

    await page.dialog.fill("End date", "");

    expect(page.dialog.message()).toBe("Enter a date as day/month/year");
    expect(page.dialog.isSaveDisabled()).toBe(true);
  });

  it("Edit Management / Period saves a new name, type and Closed: the grid and the sidebar show them", async () => {
    const page = mountBuildingData("p1");

    await page.data.clickTool("Edit");
    await page.dialog.fill("Management name", "2011 bis");
    await page.dialog.choose("Type", "Extraordinary");
    await page.dialog.choose("Status", "Closed");
    await page.dialog.fill("End date", "30/06/2011");
    await page.dialog.fill("Notes", "Closed early");
    await page.dialog.save();

    expect(page.dialog.isShown()).toBe(false);
    expect(page.closedOf("2011 bis (Extraordinary)")).toBe(true);
    expect(page.typeOf("2011 bis (Extraordinary)")).toBe("Extraordinary");
    expect(page.data.grid.rowTexts("2011 bis (Extraordinary)")[4]).toBe(
      "01/01/2011 - 30/06/2011",
    );
    expect(page.sidebarPeriod()).toBe("2011 bis (Extraordinary)");

    await page.data.clickTool("Edit");

    expect(page.dialog.fieldValue("Notes")).toBe("Closed early");
    expect(page.dialog.chosen("Status")).toBe("Closed");
  });

  it("a blank management name says so; the period keeps its own name", async () => {
    const page = mountBuildingData("p36");

    await page.data.clickTool("Edit");
    await page.dialog.fill("Management name", "");

    expect(page.dialog.message()).toBe("Enter a name");

    await page.dialog.fill("Management name", "2013");

    expect(page.dialog.message()).toBeNull();
    expect(page.dialog.isSaveDisabled()).toBe(false);
  });

  it("the sidebar's ✎ opens Edit Management / Period on the app's period", async () => {
    const page = mountBuildingData("p36");

    await page.clickSidebarEdit();

    expect(page.dialog.title()).toBe("Edit Management / Period");
    expect(page.dialog.fieldValue("Management name")).toBe("2013");

    await page.dialog.cancel();

    expect(page.dialog.isShown()).toBe(false);
  });
});
