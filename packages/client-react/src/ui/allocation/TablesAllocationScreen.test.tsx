import { describe, expect, it } from "vitest";

import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";

import {
  mountTablesAllocation,
  type TablesAllocationScreenPage,
} from "./TablesAllocationScreen.page.tsx";

describe("TablesAllocationScreen", () => {
  it("draws the three panels with the design's headers on the Thousandth Tables menu", () => {
    const page = mountTablesAllocation("p1");

    expect(page.titles()).toEqual([
      "Thousandth Tables",
      "Table Coefficients",
      "Allocation",
    ]);
    expect(page.tables.grid.headers()).toEqual([
      "Name",
      "Restriction on",
      "Counter",
      "Total",
    ]);
    expect(page.coefficients.grid.headers()).toEqual([
      "Unit",
      "Period",
      "Coefficient",
    ]);
    expect(page.allocation.grid.headers()).toEqual([
      "Groups / Units / Owners",
      "Role",
      "Restr. period",
      "Days",
      "Spese generali",
      "Generali residenti",
      "Spese scala",
      "Spese ascensore",
      "Consumi",
      "Spese personali",
      "Total",
      "Prev. bal.",
      "Total due",
      "Paid",
    ]);
  });

  it("lists p1's five tables in order, Proprietà selected with its Total", () => {
    const page = mountTablesAllocation("p1");

    expect(page.tables.grid.rowLabels()).toEqual([
      "Proprietà",
      "Generale residenti",
      "Scale",
      "Acqua preventivo",
      "Acqua consuntivo",
    ]);
    expect(page.tables.grid.rowTexts("Proprietà")).toEqual([
      "Proprietà",
      "",
      "",
      "1,000.0000",
    ]);
    expect(page.tables.grid.rowTexts("Scale")[1]).toBe("Scala A");
    expect(page.tables.grid.selectedLabels()).toEqual(["Proprietà"]);
  });

  it("shows Proprietà's coefficients under groups A and B, each group the sum of its units", () => {
    const page = mountTablesAllocation("p1");
    const units = ["u1", "u2", "u3", "u4"].map(page.labelOfUnit);

    expect(page.coefficients.grid.childrenOf("A - Scala A")).toEqual(units);
    expect(page.coefficients.grid.childrenOf("B - Box")).toEqual(
      ["u5", "u6", "u7", "u8"].map(page.labelOfUnit),
    );
    expect(page.coefficients.grid.rowTexts("A - Scala A")).toEqual([
      "A - Scala A",
      "",
      "920.0000",
    ]);
    expect(page.coefficients.grid.isAggregate("A - Scala A")).toBe(true);
    expect(page.coefficients.grid.rowTexts(units[1] ?? "")).toEqual([
      units[1],
      "27/05/2011 - end of FY",
      "170.0000",
    ]);
  });

  it("a table clicked shows its own coefficients: Scale, limited to group A", async () => {
    const page = mountTablesAllocation("p1");

    await page.tables.grid.clickRow("Scale");

    expect(page.tables.grid.selectedLabels()).toEqual(["Scale"]);
    expect(page.coefficients.grid.rowLabels()).toEqual([
      "A - Scala A",
      ...["u1", "u2", "u3", "u4"].map(page.labelOfUnit),
    ]);
  });

  it("the Allocation's root row carries p1's budget in its six columns, and Roundings ends it", () => {
    const page = mountTablesAllocation("p1");
    const [root = "", ...rest] = page.allocation.grid.rowLabels();

    expect(page.allocation.grid.rowTexts(root).slice(1)).toEqual([
      "",
      "01/01/2011 - 31/12/2011",
      "",
      "2,800.00",
      "1,300.00",
      "950.00",
      "1,900.00",
      "450.00",
      "0.00",
      "7,400.00",
      "288.92",
      "7,688.92",
      "3,279.97",
    ]);
    expect(page.allocation.grid.isAggregate(root)).toBe(true);
    expect(rest.at(-1)).toBe("Roundings");
    expect(page.allocation.grid.rowTexts("Roundings").slice(4)).toEqual([
      "0.00",
      "0.00",
      "0.00",
      "0.00",
      "0.01",
      "0.00",
      "0.01",
      "",
      "",
      "",
    ]);
    expect(page.allocation.grid.isAside("Roundings")).toBe(true);
  });

  it("draws the grouping and Include installments disabled, as the legacy app did", () => {
    const page = mountTablesAllocation("p1");

    expect(page.allocation.disabledControls()).toEqual([
      "Group rows by",
      "Group cols by",
      "Include installments",
    ]);
    expect(page.allocation.modeText()).toBe("Budget ▾");
  });

  it("the mode menu switches to the final balance, and the root Total follows", async () => {
    const page = mountTablesAllocation("p1");

    await page.allocation.clickMode();

    expect(page.allocation.menuItems()).toEqual([
      "Budget allocation",
      "Final-balance allocation",
    ]);

    await page.allocation.chooseMenuItem("Final-balance allocation");

    const [root = ""] = page.allocation.grid.rowLabels();

    expect(page.allocation.modeText()).toBe("Final balance ▾");
    expect(page.allocation.menuItems()).toEqual([]);
    expect(page.allocation.grid.rowTexts(root)[10]).toBe("2,455.19");
  });

  it("A1's coefficient in Proprietà edited to 200 moves the table's Total and A1's share", async () => {
    const page = mountTablesAllocation("p1");
    const a1 = page.labelOfUnit("u1");
    const resident = page.labelOfResident("r1");

    expect(page.allocation.grid.rowTexts(resident)[4]).toBe("280.00");

    await page.coefficients.clickCoefficient(a1);

    expect(page.coefficients.editorText()).toBe("100.0000");

    await page.coefficients.typeCoefficient("200");
    await page.coefficients.pressEnter();

    expect(page.coefficients.editorOpen()).toBe(false);
    expect(page.coefficients.grid.rowTexts(a1)[2]).toBe("200.0000");
    expect(page.coefficients.grid.rowTexts("A - Scala A")[2]).toBe(
      "1,020.0000",
    );
    expect(page.tables.grid.rowTexts("Proprietà")[3]).toBe("1,100.0000");
    expect(page.allocation.grid.rowTexts(resident)[4]).toBe("509.09");
  });

  it("a negative coefficient is refused in its editor, and nothing moves", async () => {
    const page = mountTablesAllocation("p1");
    const a1 = page.labelOfUnit("u1");
    const resident = page.labelOfResident("r1");

    await page.coefficients.clickCoefficient(a1);
    await page.coefficients.typeCoefficient("-1");
    await page.coefficients.pressEnter();

    expect(page.coefficients.editorError()).toBe(
      "Enter a coefficient of zero or more, with at most 4 decimals",
    );
    expect(page.tables.grid.rowTexts("Proprietà")[3]).toBe("1,000.0000");
    expect(page.coefficients.grid.rowTexts("A - Scala A")[2]).toBe("920.0000");
    expect(page.allocation.grid.rowTexts(resident)[4]).toBe("280.00");

    await page.coefficients.pressEscape();

    expect(page.coefficients.editorOpen()).toBe(false);
    expect(page.coefficients.grid.rowTexts(a1)[2]).toBe("100.0000");
  });

  it("switching the language keeps the text typed in an open editor, and redraws the cells", async () => {
    const page = mountTablesAllocation("p1");
    const a1 = page.labelOfUnit("u1");

    await page.pickLanguage("it");
    await page.coefficients.clickCoefficient(a1);

    expect(page.coefficients.editorText()).toBe("100,0000");

    await page.coefficients.typeCoefficient("12,5");

    expect(page.tables.grid.rowTexts("Proprietà")[3]).toBe("1.000,0000");

    await page.pickLanguage("en");

    expect(page.coefficients.editorText()).toBe("12,5");
    expect(page.tables.grid.rowTexts("Proprietà")[3]).toBe("1,000.0000");
    expect(page.coefficients.grid.rowTexts("A - Scala A")[2]).toBe("920.0000");
  });

  it("a refused editor does not survive a switch to another table: nothing is written into it", async () => {
    const page = mountTablesAllocation("p1");
    const a1 = page.labelOfUnit("u1");

    await page.coefficients.clickCoefficient(a1);
    await page.coefficients.typeCoefficient("abc");
    await page.tables.grid.clickRow("Scale");

    expect(page.tables.grid.selectedLabels()).toEqual(["Scale"]);
    expect(page.coefficients.editorOpen()).toBe(false);
    expect(page.coefficients.grid.rowTexts(a1)[2]).toBe("100.0000");
    expect(page.tables.grid.rowTexts("Scale")[3]).toBe("1,000.0000");
  });

  it("an editor opened in one language and left untouched writes nothing after a switch to another", async () => {
    const page = mountTablesAllocation("p1");
    const a1 = page.labelOfUnit("u1");

    await page.pickLanguage("it");
    await page.coefficients.clickCoefficient(a1);
    await page.pickLanguage("en");
    await page.coefficients.blur();

    expect(page.coefficients.editorOpen()).toBe(false);
    expect(page.coefficients.editorError()).toBeNull();
    expect(page.coefficients.grid.rowTexts(a1)[2]).toBe("100.0000");
  });

  it("+ adds a table: Test comes last, selected, with a coefficient of 0 for every unit", async () => {
    const page = mountTablesAllocation("p1");

    await page.tables.clickTool("New Thousandth Table");

    expect(page.tableDialog.title()).toBe("New Thousandth Table");

    await page.tableDialog.fill("Name", "Test");
    await page.tableDialog.save();

    expect(page.tableDialog.isShown()).toBe(false);
    expect(page.tables.grid.rowLabels().at(-1)).toBe("Test");
    expect(page.tables.grid.selectedLabels()).toEqual(["Test"]);
    expect(page.tables.grid.rowTexts("Test")[3]).toBe("0.0000");
    expect(page.coefficientTexts()).toEqual(
      Array.from({ length: 10 }, () => {
        return "0.0000";
      }),
    );
  });

  it("✎ edits the selected table: Test renamed Test 2 with order 1 moves first", async () => {
    const page = mountTablesAllocation("p1");

    await addTable(page, "Test");
    await page.tables.clickTool("Edit Thousandth Table");

    expect(page.tableDialog.title()).toBe("Edit Thousandth Table");
    expect(page.tableDialog.fieldValue("Name")).toBe("Test");

    await page.tableDialog.fill("Name", "Test 2");
    await page.tableDialog.fill("Order", "1");
    await page.tableDialog.save();

    expect(page.tableDialog.isShown()).toBe(false);
    expect(page.tables.grid.rowLabels()[0]).toBe("Test 2");
    expect(page.tables.grid.selectedLabels()).toEqual(["Test 2"]);
  });

  it("− deletes the selected table once confirmed, and No keeps it", async () => {
    const page = mountTablesAllocation("p1");

    await addTable(page, "Test");
    await page.tables.clickTool("Delete Thousandth Table");

    expect(page.confirmText()).toBe("Delete the table Test?");

    await page.confirmNo();

    expect(page.confirmOpen()).toBe(false);
    expect(page.tables.grid.rowLabels()).toContain("Test");

    await page.tables.clickTool("Delete Thousandth Table");
    await page.confirmYes();

    expect(page.confirmOpen()).toBe(false);
    expect(page.tables.grid.rowLabels()).not.toContain("Test");
    expect(page.tables.grid.selectedLabels()).toEqual(["Proprietà"]);
  });

  it("− on a table an account allocates through is refused, naming the account", async () => {
    const page = mountTablesAllocation("p1");

    await page.tables.clickTool("Delete Thousandth Table");

    expect(page.confirmText()).toBe("Delete the table Proprietà?");

    await page.confirmYes();

    expect(page.confirmOpen()).toBe(true);
    expect(page.confirmError()).toBe(
      "Proprietà allocates Total › Costs › Spese generali; unlink it first",
    );
    expect(page.tables.grid.rowLabels()).toContain("Proprietà");

    await page.cancelDialog();

    expect(page.confirmOpen()).toBe(false);
  });

  it("Cancel closes the table dialog and changes nothing", async () => {
    const page = mountTablesAllocation("p1");

    await page.tables.clickTool("Edit Thousandth Table");
    await page.tableDialog.fill("Name", "Renamed");
    await page.tableDialog.cancel();

    expect(page.tableDialog.isShown()).toBe(false);
    expect(page.tables.grid.rowLabels()[0]).toBe("Proprietà");
  });

  it("on p36, A04 holds its two residents with their days", () => {
    const page = mountTablesAllocation("p36");
    const leaving = page.labelOfResident("r167");
    const arriving = page.labelOfResident("r166");

    expect(page.allocation.grid.childrenOf("A04")).toEqual([leaving, arriving]);
    expect(page.allocation.grid.rowTexts(leaving).slice(1, 4)).toEqual([
      "PR",
      "start of FY - 18/01/2013",
      "18/365",
    ]);
    expect(page.allocation.grid.rowTexts(arriving).slice(1, 4)).toEqual([
      "PR",
      "19/01/2013 - end of FY",
      "347/365",
    ]);
  });

  it("print, PDF, XLS, refresh and the legends post a notice", async () => {
    const page = mountTablesAllocation("p1");

    await page.tables.clickTool("Print");
    await page.tables.clickTool("Export to PDF");
    await page.tables.clickTool("Export to Excel");
    await page.coefficients.clickTool("Refresh");
    await page.allocation.clickTool("Refresh");
    await page.allocation.clickLegend();

    expect(page.toasts()).toEqual([
      "Print: not yet available",
      "Export to PDF: not yet available",
      "Export to Excel: not yet available",
      "Refresh: not yet available",
      "Refresh: not yet available",
      "Legend: not yet available",
    ]);
  });

  it("expand and collapse all work on each tree alone", async () => {
    const page = mountTablesAllocation("p1");

    await page.coefficients.clickTool("Collapse all");

    expect(page.coefficients.grid.rowLabels()).toEqual([
      "A - Scala A",
      "B - Box",
    ]);
    expect(page.allocation.grid.rowLabels().length).toBeGreaterThan(2);

    await page.allocation.clickTool("Collapse all");

    expect(page.allocation.grid.rowLabels()).toHaveLength(1);

    await page.allocation.clickTool("Expand all");
    await page.coefficients.clickTool("Expand all");

    expect(page.allocation.grid.rowLabels()).toContain("Roundings");
    expect(page.coefficients.grid.rowLabels()).toHaveLength(10);
  });

  it("maximizes the Allocation, folding the tables, and restores it", async () => {
    const page = mountTablesAllocation("p1");

    expect(page.maximized()).toBe("none");

    await page.allocation.clickMaximize();

    expect(page.maximized()).toBe("bottom");
    expect(page.allocation.maximizeLabel()).toBe("Restore");

    await page.allocation.clickMaximize();

    expect(page.maximized()).toBe("none");
  });

  it("the splitters share the screen, each within a fifth and four fifths", () => {
    const page = mountTablesAllocation("p1");

    expect(page.splitRatios()).toEqual({ rows: 0.5, columns: 0.5 });

    page.dragRowsSplitter(60, 600);
    page.dragColumnsSplitter(-150, 1000);

    expect(page.splitRatios().rows).toBeCloseTo(0.6);
    expect(page.splitRatios().columns).toBeCloseTo(0.35);

    page.dragRowsSplitter(600, 600);

    expect(page.splitRatios().rows).toBe(0.8);
  });

  it("a splitter dragged before the screen has a size changes nothing", () => {
    const page = mountTablesAllocation("p1");

    page.dragRowsSplitter(60, 0);
    page.dragColumnsSplitter(60, 0);

    expect(page.splitRatios()).toEqual({ rows: 0.5, columns: 0.5 });
  });

  it("with no period, each panel says what it lacks", () => {
    const page = mountTablesAllocation(null, {
      ...createSmallSeed(),
      buildings: [],
    });

    expect(page.tables.grid.emptyMessage()).toBe(
      "This period has no thousandth table.",
    );
    expect(page.coefficients.grid.emptyMessage()).toBe("No table is selected.");
    expect(page.allocation.grid.emptyMessage()).toBe("No period is selected.");
    expect(page.allocation.grid.headers()).toHaveLength(8);
    expect(page.tables.isToolDisabled("Edit Thousandth Table")).toBe(true);
    expect(page.tables.isToolDisabled("Delete Thousandth Table")).toBe(true);
  });
});

async function addTable(
  page: TablesAllocationScreenPage,
  name: string,
): Promise<void> {
  await page.tables.clickTool("New Thousandth Table");
  await page.tableDialog.fill("Name", name);
  await page.tableDialog.save();
}
