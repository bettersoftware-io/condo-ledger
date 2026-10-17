import { describe, expect, it } from "vitest";

import { mountJournalScreen } from "./JournalScreen.page.tsx";

describe("JournalScreen", () => {
  it("shows the period's entries by number, with the count in the meta", () => {
    const page = mountJournalScreen();

    expect(page.title()).toBe("Journal");
    expect(page.meta()).toBe("9 entries total");
    expect(page.entryLabels()).toEqual([
      "Fattura Alfa",
      "Fattura Beta",
      "Pagamento Beta",
      "Riparto",
      "Incasso Bianchi",
      "Arrotondamento",
      "Spesa individuale",
      "Movimento nullo",
      "Fuori ordine",
    ]);
    expect(page.rowTexts()[0]).toEqual([
      "10/01/2013 10:00",
      "1",
      "Fattura Alfa",
      "360.18",
      "360.18",
      "0.00",
    ]);
  });

  it("draws each entry with its kind's icon", () => {
    const page = mountJournalScreen();

    expect(page.iconOf("Fattura Alfa")).toBe("invoice");
    expect(page.iconOf("Riparto")).toBe("budgetAllocation");
    expect(page.iconOf("Incasso Bianchi")).toBe("collection");
    expect(page.iconOf("Arrotondamento")).toBe("generic");
  });

  it("a caret opens the entry's postings with their running balance, the last one not bold", async () => {
    const page = mountJournalScreen();

    await page.clickCaret("Riparto");

    expect(page.isExpanded("Riparto")).toBe(true);
    expect(
      page
        .rowTexts()
        .slice(4, 8)
        .map((cells) => {
          return cells.slice(2);
        }),
    ).toEqual([
      [
        "Total › Patrimonial › Condòmini › Rossi Mario › A01",
        "600.00",
        "0.00",
        "600.00",
      ],
      [
        "Total › Patrimonial › Condòmini › Rossi Mario › A02",
        "100.00",
        "0.00",
        "700.00",
      ],
      [
        "Total › Patrimonial › Condòmini › Bianchi Anna › B01",
        "300.00",
        "0.00",
        "1,000.00",
      ],
      ["Total › Revenue › Da condòmini", "0.00", "1,000.00", "0.00"],
    ]);
    expect(page.rowTexts()[4]?.slice(0, 2)).toEqual(["", ""]);
    expect(page.isPostingBold(2)).toBe(true);
    expect(page.isPostingBold(3)).toBe(false);

    await page.clickCaret("Riparto");

    expect(page.isExpanded("Riparto")).toBe(false);
    expect(page.rowTexts()).toHaveLength(9);
  });

  it("a click on an entry or on one of its postings selects the entry and enables delete", async () => {
    const page = mountJournalScreen();

    expect(page.isToolDisabled("Delete entry")).toBe(true);

    await page.clickCaret("Riparto");
    await page.clickPostingRow(1);

    expect(page.isSelected("Riparto")).toBe(true);
    expect(page.isPostingSelected(1)).toBe(false);
    expect(page.isToolDisabled("Delete entry")).toBe(false);

    await page.clickRow("Fattura Beta");

    expect(page.isSelected("Fattura Beta")).toBe(true);
    expect(page.isSelected("Riparto")).toBe(false);
  });

  it("expand all opens every entry, collapse all closes them", async () => {
    const page = mountJournalScreen();

    await page.clickTool("Expand all");

    expect(page.isExpanded("Fattura Alfa")).toBe(true);
    expect(page.isExpanded("Fuori ordine")).toBe(true);

    await page.clickTool("Collapse all");

    expect(page.isExpanded("Fattura Alfa")).toBe(false);
    expect(page.rowTexts()).toHaveLength(9);
  });

  it("search narrows the entries and says so when nothing matches", async () => {
    const page = mountJournalScreen();

    await page.search("fattura");
    expect(page.entryLabels()).toEqual(["Fattura Alfa", "Fattura Beta"]);

    await page.search("zzz");
    expect(page.emptyMessage()).toBe("No entry matches.");
  });

  it("a period with no entry says so", () => {
    const page = mountJournalScreen({ empty: true });

    expect(page.meta()).toBe("0 entries total");
    expect(page.emptyMessage()).toBe("No entry in this period.");
  });

  it("pages at the chosen size", async () => {
    const page = mountJournalScreen({ extraEntries: 3 });

    expect(page.pageText()).toBe("Page 1 of 2");
    expect(page.pageSizeText()).toBe("10 ▾");
    expect(page.toolMenu("Page size")).toBe("menu closed");

    await page.clickTool("Page size");

    expect(page.toolMenu("Page size")).toBe("menu open");
    expect(page.menuItems()).toEqual(["10", "25", "50", "100"]);

    await page.clickMenuItem("25");

    expect(page.menuItems()).toEqual([]);
    expect(page.pageSizeText()).toBe("25 ▾");
    expect(page.pageText()).toBe("Page 1 of 1");
    expect(page.entryLabels()).toHaveLength(12);
    expect(page.isToolDisabled("Next page")).toBe(true);
  });

  it("previous and next move a page at a time, each disabled at its end", async () => {
    const page = mountJournalScreen({ extraEntries: 3 });

    expect(page.isToolDisabled("Previous page")).toBe(true);
    expect(page.isToolDisabled("Next page")).toBe(false);

    await page.nextPage();

    expect(page.pageText()).toBe("Page 2 of 2");
    expect(page.entryLabels()).toEqual(["Extra 11", "Extra 12"]);
    expect(page.isToolDisabled("Next page")).toBe(true);
    expect(page.isToolDisabled("Previous page")).toBe(false);

    await page.previousPage();

    expect(page.pageText()).toBe("Page 1 of 2");
    expect(page.entryLabels()).toHaveLength(10);
  });

  it("has the design's tools; the ones not built yet say so", async () => {
    const page = mountJournalScreen();

    expect(page.toolLabels()).toEqual([
      "Add transaction",
      "Edit entry",
      "Delete entry",
      "Expand all",
      "Collapse all",
      "Print journal",
      "Export to PDF",
      "Export to Excel",
      "Previous page",
      "Next page",
      "Page size",
      "Refresh",
    ]);

    await page.clickTool("Edit entry");
    await page.clickTool("Print journal");
    await page.clickTool("Export to PDF");
    await page.clickTool("Export to Excel");
    await page.clickTool("Refresh");

    expect(page.toasts()).toEqual([
      "Edit entry: not yet available",
      "Print journal: not yet available",
      "Export to PDF: not yet available",
      "Export to Excel: not yet available",
      "Refresh: not yet available",
    ]);
  });

  it("the Add transaction menu lists the ten wizards; a stubbed one posts a notice", async () => {
    const page = mountJournalScreen();

    expect(page.toolMenu("Add transaction")).toBe("menu closed");

    await page.openAddMenu();

    expect(page.toolMenu("Add transaction")).toBe("menu open");
    expect(page.menuItems()).toEqual([
      "New invoice",
      "Record collection",
      "Invoice payment",
      "Direct purchase via bank",
      "Direct purchase with cash",
      "Withholding-tax payment",
      "Opening balances",
      "Budget allocation",
      "Generic entry",
      "Direct payment to multiple cost accounts",
    ]);

    await page.clickMenuItem("Record collection");

    expect(page.toasts()).toEqual(["Record collection: not yet available"]);
    expect(page.dialogOpen()).toBe(false);
    expect(page.menuItems()).toEqual([]);
  });

  it("Escape closes a menu, choosing nothing", async () => {
    const page = mountJournalScreen();

    await page.openAddMenu();
    await page.pressEscape();

    expect(page.menuItems()).toEqual([]);
    expect(page.toolMenu("Add transaction")).toBe("menu closed");

    await page.clickTool("Page size");
    await page.pressEscape();

    expect(page.menuItems()).toEqual([]);
    expect(page.pageSizeText()).toBe("10 ▾");
    expect(page.toasts()).toEqual([]);
  });

  it("a built wizard posts no notice, and the menu closes", async () => {
    const page = mountJournalScreen();

    await page.openAddMenu();
    await page.clickMenuItem("Generic entry");

    expect(page.toasts()).toEqual([]);
    expect(page.menuItems()).toEqual([]);
  });

  it("a generic entry saved from the Add menu is selected in the grid and posted in its account's ledger", async () => {
    const page = mountJournalScreen();
    const wizard = await page.openWizard("Generic entry");

    await wizard.fill("Description", "Spesa ascensore");
    await wizard.select(0, "Costs › Spese generali › Ascensore");
    await wizard.fillLine(0, "debit", "70");
    await wizard.addLine();
    await wizard.select(1, "Patrimonial › (Assets) › Liquidità › Cassa");
    await wizard.fillLine(1, "credit", "70");
    await wizard.save();

    expect(page.dialogOpen()).toBe(false);
    expect(page.isSelected("Spesa ascensore")).toBe(true);
    expect(page.rowTexts()[9]?.slice(1)).toEqual([
      "10",
      "Spesa ascensore",
      "70.00",
      "70.00",
      "0.00",
    ]);
    expect(await page.ledgerOf(["Spese generali", "Ascensore"])).toContainEqual(
      [
        "14/10/2026 10:00",
        "10",
        "Spesa ascensore",
        "Total › Costs › Spese generali › Ascensore",
        "70.00",
        "0.00",
        "430.18",
      ],
    );
  });

  it("delete asks, and Yes removes the entry and closes the numbering", async () => {
    const page = mountJournalScreen();

    await page.clickRow("Arrotondamento");
    await page.clickTool("Delete entry");

    expect(page.confirmText()).toBe('Delete the entry "Arrotondamento"?');
    expect(page.confirmError()).toBeNull();

    await page.confirmYes();

    expect(page.confirmOpen()).toBe(false);
    expect(page.gridHasFocus()).toBe(true);
    expect(page.entryLabels()).toHaveLength(8);
    expect(page.entryLabels()).not.toContain("Arrotondamento");
    expect(page.rowTexts()[5]?.[1]).toBe("6");
    expect(page.isToolDisabled("Delete entry")).toBe(true);
  });

  it("a refused delete keeps the alert open with the reason and the entry in the grid", async () => {
    const page = mountJournalScreen();

    await page.clickRow("Incasso Bianchi");
    await page.clickTool("Delete entry");
    await page.confirmYes();

    expect(page.confirmOpen()).toBe(true);
    expect(page.confirmError()).toBe(
      "This kind of entry is removed through its own flow, which is not built yet.",
    );
    expect(page.entryLabels()).toHaveLength(9);
    expect(page.isSelected("Incasso Bianchi")).toBe(true);

    await page.confirmNo();
    expect(page.confirmOpen()).toBe(false);

    await page.clickTool("Delete entry");
    expect(page.confirmError()).toBeNull();
  });

  it("No and Escape close the alert, deleting nothing, and hand the focus back to the grid", async () => {
    const page = mountJournalScreen();

    await page.clickRow("Arrotondamento");
    await page.clickTool("Delete entry");
    await page.confirmNo();
    expect(page.confirmOpen()).toBe(false);
    expect(page.gridHasFocus()).toBe(true);

    await page.clickTool("Delete entry");
    expect(page.gridHasFocus()).toBe(false);

    await page.pressEscape();
    expect(page.confirmOpen()).toBe(false);
    expect(page.gridHasFocus()).toBe(true);
    expect(page.entryLabels()).toHaveLength(9);
  });

  it("maximize fills the screen with the journal, and restores it", async () => {
    const page = mountJournalScreen();

    expect(page.maximized()).toBe("none");

    await page.clickMaximize();

    expect(page.maximized()).toBe("top");

    await page.clickMaximize();

    expect(page.maximized()).toBe("none");
  });
});
