import { describe, expect, it } from "vitest";

import { mountAccountsGrid } from "./AccountsGrid.page.tsx";

describe("AccountsGrid", () => {
  it("starts with Total and the five levels open, amounts formatted", () => {
    const page = mountAccountsGrid();

    expect(page.labels()).toEqual([
      "Total",
      "Patrimonial",
      "(Assets)",
      "Liquidità",
      "Fornitori",
      "Condòmini",
      "Arrotondamenti",
      "(Liabilities)",
      "Fondi",
      "Fornitori",
      "Condòmini",
      "Costs",
      "Spese generali",
      "Spese individuali",
      "Revenue",
      "Da condòmini",
    ]);
    expect(page.cellsOf("Total")).toEqual([
      "2,126.19",
      "2,126.19",
      "0.00",
      "1,500.00",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
    expect(page.cellsOf("Spese generali").slice(0, 4)).toEqual([
      "560.18",
      "0.00",
      "560.18",
      "1,500.00",
    ]);
    expect(page.cellsOf("Fondi").slice(0, 4)).toEqual([
      "0.00",
      "0.00",
      "0.00",
      "",
    ]);
  });

  it("draws an aggregate's label bold and its amounts at the regular weight, as the legacy grid does", () => {
    const page = mountAccountsGrid();

    expect(page.labelIsBold("Total")).toBe(true);
    expect(page.labelIsBold("Spese generali")).toBe(true);
    expect(page.anyAmountIsBold("Total")).toBe(false);
    expect(page.anyAmountIsBold("Spese generali")).toBe(false);
    expect(page.labelIsBold("Fondi")).toBe(false);
    expect(page.anyAmountIsBold("Fondi")).toBe(false);
  });

  it("stripes every other visible row by its place, Total like any other", async () => {
    const page = mountAccountsGrid();

    expect(page.isStriped("Total")).toBe(true);
    expect(page.isStriped("Patrimonial")).toBe(false);
    expect(page.isStriped("(Assets)")).toBe(true);
    expect(page.isStriped("(Liabilities)")).toBe(false);
    expect(page.isStriped("Fondi")).toBe(true);
    expect(page.isStriped("Costs")).toBe(false);

    await page.toggleHideEmpty();

    expect(page.isStriped("(Liabilities)")).toBe(false);
    expect(page.isStriped("Costs")).toBe(true);
  });

  it("selecting a row selects the account app-wide", async () => {
    const page = mountAccountsGrid();

    expect(page.selectedLabel()).toBe("Total");

    await page.clickRow("Fondi");

    expect(page.selectedLabel()).toBe("Fondi");
    expect(page.appSelectedKey()).toBe("la3");
  });

  it("the caret opens and closes a row without selecting it", async () => {
    const page = mountAccountsGrid();

    await page.clickCaret("Liquidità");

    expect(page.labels()).toContain("Cassa");
    expect(page.selectedLabel()).toBe("Total");

    await page.clickCaret("Liquidità");

    expect(page.labels()).not.toContain("Cassa");
  });

  it("search narrows to the matches with their ancestors", async () => {
    const page = mountAccountsGrid();

    await page.search("asc");

    expect(page.labels()).toEqual([
      "Total",
      "Costs",
      "Spese generali",
      "Ascensore",
    ]);
  });

  it("says so when nothing matches", async () => {
    const page = mountAccountsGrid();

    await page.search("zzz");

    expect(page.labels()).toEqual([]);
    expect(page.emptyMessage()).toBe("No account matches.");
  });

  it("hide-empty removes Fondi", async () => {
    const page = mountAccountsGrid();

    await page.toggleHideEmpty();

    expect(page.labels()).not.toContain("Fondi");
    expect(page.labels()).toHaveLength(15);

    await page.toggleHideEmpty();

    expect(page.labels()).toContain("Fondi");
  });

  it("expand all shows every row, collapse all only Total", async () => {
    const page = mountAccountsGrid();

    await page.expandAll();

    expect(page.labels()).toEqual([
      "Total",
      "Patrimonial",
      "(Assets)",
      "Liquidità",
      "Cassa",
      "Banca",
      "Fornitori",
      "Beta S.p.A.",
      "Condòmini",
      "Rossi Mario",
      "A01",
      "A02",
      "Arrotondamenti",
      "Rossi Mario",
      "A01",
      "(Liabilities)",
      "Fondi",
      "Fornitori",
      "Alfa s.n.c.",
      "Condòmini",
      "Bianchi Anna",
      "B01",
      "Costs",
      "Spese generali",
      "Ascensore",
      "Pulizie",
      "Spese individuali",
      "Rossi Mario",
      "A02",
      "Revenue",
      "Da condòmini",
    ]);

    await page.collapseAll();

    expect(page.labels()).toEqual(["Total"]);
  });

  it("draws each account's glyph, folders tinted by nature", async () => {
    const page = mountAccountsGrid();

    expect(page.iconOf("Total")).toBe("root");
    expect(page.iconOf("Patrimonial")).toBe("folder");
    expect(page.natureOf("Patrimonial")).toBe("none");
    expect(page.drawsOpenFolder("Patrimonial")).toBe(true);
    expect(page.iconOf("Liquidità")).toBe("folder");
    expect(page.drawsOpenFolder("Liquidità")).toBe(false);
    expect(page.natureOf("(Assets)")).toBe("assets");
    expect(page.natureOf("(Liabilities)")).toBe("liabilities");
    expect(page.natureOf("Costs")).toBe("expenses");
    expect(page.natureOf("Revenue")).toBe("income");
    expect(page.iconOf("Fornitori")).toBe("suppliers");
    expect(page.iconOf("Condòmini")).toBe("owners");
    expect(page.iconOf("Arrotondamenti")).toBe("roundings");
    expect(page.iconOf("Fondi")).toBe("document");

    await page.expandAll();

    expect(page.iconOf("Cassa")).toBe("cash");
    expect(page.iconOf("Banca")).toBe("bank");
    expect(page.natureOf("Rossi Mario")).toBe("assetsOrLiabilities");
  });

  it("commits a budget and the tree shows it, rolled up", async () => {
    const page = mountAccountsGrid();
    await page.clickCaret("Spese generali");

    await page.clickBudget("Ascensore");

    expect(page.budgetText()).toBe("1,000.00");

    await page.typeBudget("1,200.00");
    await page.pressEnter();

    expect(page.budgetError()).toBeNull();
    expect(page.cellsOf("Ascensore")[3]).toBe("1,200.00");
    expect(page.cellsOf("Spese generali")[3]).toBe("1,700.00");
    expect(page.cellsOf("Total")[3]).toBe("1,700.00");
  });

  it("a click on a budget opens its editor and selects its row too", async () => {
    const page = mountAccountsGrid();
    await page.clickCaret("Spese generali");

    await page.clickBudget("Ascensore");

    expect(page.budgetText()).toBe("1,000.00");
    expect(page.selectedLabel()).toBe("Ascensore");
    expect(page.appSelectedKey()).toBe("la21");
  });

  it("shows the rejection for text that is not an amount and writes nothing", async () => {
    const page = mountAccountsGrid();
    await page.clickCaret("Spese generali");

    await page.clickBudget("Ascensore");
    await page.typeBudget("abc");
    await page.pressEnter();

    expect(page.budgetError()).toBe("not an amount");
    expect(page.cellsOf("Spese generali")[3]).toBe("1,500.00");

    await page.pressEscape();

    expect(page.cellsOf("Ascensore")[3]).toBe("1,000.00");
  });

  it("commits a negative budget, as the legacy books hold them, drawn red", async () => {
    const page = mountAccountsGrid();
    await page.clickCaret("Spese generali");

    await page.clickBudget("Ascensore");
    await page.typeBudget("-5");
    await page.pressEnter();

    expect(page.budgetError()).toBeNull();
    expect(page.cellsOf("Ascensore")[3]).toBe("-5.00");
    expect(page.amountTonesOf("Ascensore")[3]).toBe("neg");
    expect(page.cellsOf("Spese generali")[3]).toBe("495.00");
    expect(page.cellsOf("Total")[3]).toBe("495.00");

    await page.clickBudget("Pulizie");
    await page.typeBudget("-1,200.00");
    await page.pressEnter();

    expect(page.budgetError()).toBeNull();
    expect(page.cellsOf("Pulizie")[3]).toBe("-1,200.00");
    expect(page.cellsOf("Spese generali")[3]).toBe("-1,205.00");
    expect(page.amountTonesOf("Spese generali")[3]).toBe("neg");
  });

  it("shows the store's reason when it refuses a budget, and the budget stays", async () => {
    const page = mountAccountsGrid();
    await page.clickCaret("Spese generali");
    page.refuseBudgets("not-a-leaf");

    await page.clickBudget("Ascensore");
    await page.typeBudget("1,200.00");
    await page.pressEnter();

    expect(page.budgetError()).toBe("not-a-leaf");
    expect(page.cellsOf("Spese generali")[3]).toBe("1,500.00");

    await page.pressEscape();

    expect(page.cellsOf("Ascensore")[3]).toBe("1,000.00");
  });

  it("leaving a budget cell unchanged writes nothing and shows no error", async () => {
    const page = mountAccountsGrid();
    await page.clickCaret("Spese generali");

    await page.clickBudget("Ascensore");
    await page.blurBudget();

    expect(page.budgetError()).toBeNull();
    expect(page.cellsOf("Ascensore")[3]).toBe("1,000.00");
    expect(page.cellsOf("Spese generali")[3]).toBe("1,500.00");
    expect(page.budgetWrites()).toBe(0);
  });

  it("a verdict that arrives after another row's editor opened leaves that editor open", async () => {
    const page = mountAccountsGrid();
    await page.clickCaret("Spese generali");
    page.holdBudgetVerdicts();

    await page.clickBudget("Ascensore");
    await page.typeBudget("1,200.00");
    await page.pressEnter();
    await page.clickBudget("Pulizie");
    await page.releaseBudgetVerdicts();

    expect(page.budgetText()).toBe("500.00");
    expect(page.budgetError()).toBeNull();
    expect(page.cellsOf("Ascensore")[3]).toBe("1,200.00");
    expect(page.budgetWrites()).toBe(1);
  });

  it("Escape cancels", async () => {
    const page = mountAccountsGrid();
    await page.clickCaret("Spese generali");

    await page.clickBudget("Ascensore");
    await page.typeBudget("999");
    await page.pressEscape();

    expect(page.budgetError()).toBeNull();
    expect(page.cellsOf("Ascensore")[3]).toBe("1,000.00");
    expect(page.cellsOf("Spese generali")[3]).toBe("1,500.00");
  });

  it("lays its columns out by the chart's spec, the first flexible up to 680px", () => {
    const page = mountAccountsGrid();

    expect(page.template()).toBe(
      "minmax(360px,1fr) 100px 100px 100px 90px 130px 44px 170px 110px 44px 210px 56px 64px",
    );

    page.resizeColumn(1, 150);

    expect(page.template()).toBe(
      "minmax(360px,1fr) 150px 100px 100px 90px 130px 44px 170px 110px 44px 210px 56px 64px",
    );

    page.resizeColumn(0, 9999);

    expect(page.template()).toBe(
      "680px 150px 100px 100px 90px 130px 44px 170px 110px 44px 210px 56px 64px",
    );
  });
});
