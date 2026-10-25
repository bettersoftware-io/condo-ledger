import { describe, expect, it } from "vitest";

import { mountInstallmentSchedule } from "./InstallmentScheduleScreen.page.tsx";

describe("InstallmentScheduleScreen", () => {
  it("heads p36's grid with the README's columns and one per installment", () => {
    const page = mountInstallmentSchedule("p36");

    expect(page.title()).toBe("Installment Schedule");
    expect(page.grid.headers()).toEqual([
      "Groups / Units / Owners",
      "Role",
      "Restr. period",
      "Days",
      "Prev. bal.",
      "Total budget",
      "Total due",
      ...Array.from({ length: 12 }, (_, index) => {
        return `${index + 1} 20/${String(index + 1).padStart(2, "0")}/2013`;
      }),
      "Total inst.",
      "Paid",
      "Inst. bal.",
      "Overdue",
    ]);
  });

  it("the root row carries p36's totals, as the printed schedule", () => {
    const page = mountInstallmentSchedule("p36");
    const [root = ""] = page.grid.rowLabels();
    const texts = page.grid.rowTexts(root);

    expect(texts.slice(4, 7)).toEqual(["-6,250.99", "38,000.00", "31,749.01"]);
    expect(texts.slice(-4)).toEqual([
      "33,591.88",
      "21,825.98",
      "11,765.90",
      "11,765.90",
    ]);
    expect(page.grid.isAggregate(root)).toBe(true);
  });

  it("A04 holds its two residents in residency order, each with its restriction and days", () => {
    const page = mountInstallmentSchedule("p36");
    const leaving = page.labelOfResident("r167");
    const arriving = page.labelOfResident("r166");

    expect(page.grid.childrenOf("A04")).toEqual([leaving, arriving]);
    expect(page.grid.rowTexts(leaving).slice(1, 4)).toEqual([
      "PR",
      "start of FY - 18/01/2013",
      "18/365",
    ]);
    expect(page.grid.rowTexts(arriving).slice(1, 4)).toEqual([
      "PR",
      "19/01/2013 - end of FY",
      "347/365",
    ]);
  });

  it("colours a cell by its settlement: ii789, part paid, is partial", () => {
    const page = mountInstallmentSchedule("p36");
    const r188 = page.labelOfResident("r188");

    expect(page.grid.cell(r188, "9 20/09/2013").status()).toBe("partial");
    expect(page.grid.cell(r188, "8 20/08/2013").status()).toBe("settled");
    expect(page.grid.cell(r188, "10 20/10/2013").status()).toBe("unsettled");
  });

  it("marks p1's locked installment in its header", () => {
    const page = mountInstallmentSchedule("p1");

    expect(page.grid.headers().slice(7, 10)).toEqual([
      "1 🔒 15/03/2011",
      "2 15/07/2011",
      "3 15/12/2011",
    ]);
  });

  it("an unpaid zero item edited to 10.00 shows it, and the row's Total inst. grows by it", async () => {
    const page = mountInstallmentSchedule("p36");
    const r162 = page.labelOfResident("r162");
    const cell = page.grid.cell(r162, "1 20/01/2013");
    const totalAt = page.grid.headers().indexOf("Total inst.");

    expect(cell.text()).toBe("0.00");
    expect(page.grid.rowTexts(r162)[totalAt]).toBe("826.61");

    await cell.click();
    await cell.type("10.00");
    await cell.pressEnter();

    expect(cell.text()).toBe("10.00");
    expect(page.grid.rowTexts(r162)[totalAt]).toBe("836.61");
    expect(cell.status()).toBe("unsettled");
  });

  it("offers no edit on the paid item ii789, and its tooltip says why", () => {
    const page = mountInstallmentSchedule("p36");
    const cell = page.grid.cell(page.labelOfResident("r188"), "9 20/09/2013");

    expect(cell.isEditable()).toBe(false);
    expect(cell.title()).toBe(
      "A collection has paid this amount: delete that collection first.",
    );
  });

  it("the Delete menu lists only the unlocked installments", async () => {
    const page = mountInstallmentSchedule("p1");

    await page.toolbar.clickTool("Delete installments");

    expect(page.toolbar.menuItems()).toEqual([
      'Delete "Rata nr. 2"',
      'Delete "Rata nr. 3"',
    ]);
  });

  it("deleting an unpaid installment asks first, then removes its column", async () => {
    const page = mountInstallmentSchedule("p36");

    await page.toolbar.clickTool("Delete installments");
    await page.toolbar.clickMenuItem('Delete "Rata 12"');

    expect(page.confirmText()).toBe(
      "Delete the installment “Rata 12”? This cannot be undone.",
    );

    await page.confirmYes();

    expect(page.confirmOpen()).toBe(false);
    expect(page.grid.headers()).not.toContain("12 20/12/2013");
    expect(page.grid.headers()).toContain("11 20/11/2013");
  });

  it("deleting a paid installment is refused with the reason, and No keeps it", async () => {
    const page = mountInstallmentSchedule("p36");

    await page.toolbar.clickTool("Delete installments");
    await page.toolbar.clickMenuItem('Delete "Rata 1"');
    await page.confirmYes();

    expect(page.confirmOpen()).toBe(true);
    expect(page.confirmError()).toBe(
      "A collection has paid part of this installment: delete that collection first.",
    );

    await page.confirmNo();

    expect(page.confirmOpen()).toBe(false);
    expect(page.grid.headers()).toContain("1 20/01/2013");
  });

  it("advance, adjustment, print, export and refresh show the not-built-yet notice", async () => {
    const page = mountInstallmentSchedule("p36");

    await page.toolbar.clickTool("Add installments");
    await page.toolbar.clickMenuItem("Create advance installment");
    await page.toolbar.clickTool("Add installments");
    await page.toolbar.clickMenuItem("Create adjustment installment");
    await page.toolbar.clickTool("Print schedule");

    expect(page.toasts()).toEqual([
      "Create advance installment: not yet available",
      "Create adjustment installment: not yet available",
      "Print schedule: not yet available",
    ]);
  });

  it("Create budget installments and an Edit item open their own dialogs, not the notice", async () => {
    const page = mountInstallmentSchedule("p36");

    await page.toolbar.clickTool("Add installments");
    await page.toolbar.clickMenuItem("Create budget installments");
    await page.toolbar.clickTool("Edit installments");

    expect(page.toolbar.menuItems()).toHaveLength(12);

    await page.toolbar.clickMenuItem('Edit "Rata 1"');

    expect(page.toolbar.menuItems()).toEqual([]);
    expect(page.toasts()).toEqual([]);
  });

  it("collapses a unit through its caret, and every node through the toolbar", async () => {
    const page = mountInstallmentSchedule("p36");
    const all = page.grid.rowLabels();

    await page.grid.clickCaret("A04");

    expect(page.grid.childrenOf("A04")).toEqual([]);

    await page.toolbar.clickTool("Collapse all");

    expect(page.grid.rowLabels()).toEqual(all.slice(0, 1));

    await page.toolbar.clickTool("Expand all");

    expect(page.grid.rowLabels()).toEqual(all);
  });

  it("maximizes its panel", async () => {
    const page = mountInstallmentSchedule("p36");

    expect(page.maximized()).toBe("none");

    await page.clickMaximize();

    expect(page.maximized()).toBe("top");
  });
});
