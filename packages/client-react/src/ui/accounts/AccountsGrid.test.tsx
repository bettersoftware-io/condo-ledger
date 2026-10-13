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

  it("draws a group's row bold and Total on the root's background", () => {
    const page = mountAccountsGrid();

    expect(page.isBold("Spese generali")).toBe(true);
    expect(page.isBold("Fondi")).toBe(false);
    expect(page.isZebra("Total")).toBe(true);
    expect(page.isZebra("Patrimonial")).toBe(false);
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

  it("shows the domain's reason for a negative budget", async () => {
    const page = mountAccountsGrid();
    await page.clickCaret("Spese generali");

    await page.clickBudget("Ascensore");
    await page.typeBudget("-5");
    await page.pressEnter();

    expect(page.budgetError()).toBe("a budget cannot be negative");
    expect(page.cellsOf("Spese generali")[3]).toBe("1,500.00");
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
