import { describe, expect, it } from "vitest";

import { mountJournalScreen } from "../JournalScreen.page.tsx";

describe("the journal wizards", () => {
  it("Direct purchase with cash: pick a cost account, type an amount, save; the entry lands selected in the grid", async () => {
    const page = mountJournalScreen();
    const wizard = await page.openWizard("Direct purchase with cash");

    expect(wizard.title()).toBe("Direct Purchase with Cash");
    expect(wizard.contextLine()).toBe("Building / Period: Pozzetto / 2013");
    expect(wizard.fieldValue("Description")).toBe("Direct cash purchase");
    expect(wizard.isSaveDisabled()).toBe(true);
    expect(wizard.message()).toBeNull();

    await wizard.pick("Costs › Spese generali › Pulizie");
    expect(wizard.message()).toBe("Enter an amount");

    await wizard.fill("Amount", "23.50");
    expect(wizard.message()).toBeNull();
    expect(wizard.previewRows()).toEqual([
      ["1", "Costs › Spese generali › Pulizie", "23.50", ""],
      ["2", "Patrimonial › (Assets) › Liquidità › Cassa", "", "23.50"],
    ]);
    expect(wizard.paidFrom()).toBe("Paid from: Cassa");
    expect(wizard.isSaveDisabled()).toBe(false);

    await wizard.save();

    expect(page.dialogOpen()).toBe(false);
    expect(page.entryLabels()).toHaveLength(10);
    expect(page.isSelected("Direct cash purchase")).toBe(true);
    expect(page.rowTexts()[9]).toEqual([
      "14/10/2026 10:00",
      "10",
      "Direct cash purchase",
      "23.50",
      "23.50",
      "0.00",
    ]);
  });

  it.each([
    ["Direct purchase via bank", "Direct Purchase via Default Bank Account"],
    ["Withholding-tax payment", "Withholding-tax Payment to Tax Authority"],
    [
      "Direct payment to multiple cost accounts",
      "Direct payment to multiple cost accounts",
    ],
    ["Generic entry", "Add Accounting Entry"],
  ])("%s carries the design's title", async (menuLabel, title) => {
    const page = mountJournalScreen();
    const wizard = await page.openWizard(menuLabel);

    expect(wizard.title()).toBe(title);
  });

  it("the new entry is in the Accounts ledger of its account", async () => {
    const page = mountJournalScreen();
    const wizard = await page.openWizard("Direct purchase via bank");

    expect(wizard.paidFrom()).toBe("Paid from: Banca");

    await wizard.pick("Costs › Spese generali › Ascensore");
    await wizard.fill("Amount", "100");
    await wizard.save();

    expect(await page.ledgerOf(["Spese generali", "Ascensore"])).toContainEqual(
      [
        "14/10/2026 10:00",
        "10",
        "Direct purchase via bank account",
        "Total › Costs › Spese generali › Ascensore",
        "100.00",
        "0.00",
        "460.18",
      ],
    );
  });

  it("Withholding-tax payment in a period with no tax account offers none and cannot save", async () => {
    const page = mountJournalScreen();
    const wizard = await page.openWizard("Withholding-tax payment");

    expect(wizard.fieldValue("Description")).toBe("Withholding payment");
    expect(wizard.paidFrom()).toBe("Paid from: Banca");
    expect(wizard.isSaveDisabled()).toBe(true);
    expect(wizard.message()).toBeNull();
  });

  it("the withholding's description follows the tax account chosen, until it is edited", async () => {
    const page = mountJournalScreen({ taxAccounts: true });
    const wizard = await page.openWizard("Withholding-tax payment");

    await wizard.pick("Patrimonial › (Liabilities) › Ritenute 1019");
    await wizard.fill("Amount", "7.59");
    await wizard.pick("Patrimonial › (Liabilities) › Ritenute 1020");

    expect(wizard.fieldValue("Description")).toBe(
      "Withholding payment (Ritenute 1020)",
    );
    expect(wizard.previewRows()).toEqual([
      ["1", "Patrimonial › (Liabilities) › Ritenute 1020", "7.59", ""],
      ["2", "Patrimonial › (Assets) › Liquidità › Banca", "", "7.59"],
    ]);

    await wizard.fill("Description", "Ritenute di marzo");
    await wizard.pick("Patrimonial › (Liabilities) › Ritenute 1019");

    expect(wizard.fieldValue("Description")).toBe("Ritenute di marzo");
  });

  it("a period with no cash account says so in place of Paid from, and cannot save", async () => {
    const page = mountJournalScreen({ withoutRole: "cash" });
    const wizard = await page.openWizard("Direct purchase with cash");

    expect(wizard.paidFrom()).toBe("This period has no cash account");
    expect(wizard.isSaveDisabled()).toBe(true);

    await wizard.pick("Costs › Spese generali › Pulizie");

    expect(wizard.message()).toBe("This period has no cash account");
  });

  it("a period with no bank account says so in the bank wizards", async () => {
    const page = mountJournalScreen({ withoutRole: "bank" });
    const direct = await page.openWizard("Direct purchase via bank");

    expect(direct.paidFrom()).toBe("This period has no default bank account");

    await direct.fill("Amount", "5");

    expect(direct.message()).toBe("This period has no default bank account");

    await direct.cancel();
    const multi = await page.openWizard(
      "Direct payment to multiple cost accounts",
    );

    expect(multi.paidFrom()).toBe("This period has no default bank account");

    await multi.fill("Amount paid", "5");

    expect(multi.message()).toBe("This period has no default bank account");
    expect(multi.isSaveDisabled()).toBe(true);
  });

  it("Direct payment to multiple cost accounts: the lines must add up", async () => {
    const page = mountJournalScreen();
    const wizard = await page.openWizard(
      "Direct payment to multiple cost accounts",
    );

    expect(wizard.paidFrom()).toBe("Paid from: Banca");

    await wizard.fill("Amount paid", "100");
    await wizard.select(0, "Costs › Spese generali › Ascensore");
    await wizard.fillLine(0, "amount", "60");
    await wizard.addLine();
    await wizard.select(1, "Costs › Spese generali › Pulizie");
    await wizard.fillLine(1, "amount", "30");

    expect(wizard.message()).toBe("The lines must add up to the amount paid");
    expect(wizard.linesTotal()).toBe("90.00");
    expect(wizard.isSaveDisabled()).toBe(true);

    await wizard.fillLine(1, "amount", "40");

    expect(wizard.message()).toBeNull();
    expect(wizard.linesTotal()).toBe("100.00");
    expect(wizard.isSaveDisabled()).toBe(false);
    expect(wizard.previewRows()).toEqual([
      ["1", "Costs › Spese generali › Ascensore", "60.00", ""],
      ["2", "Costs › Spese generali › Pulizie", "40.00", ""],
      ["3", "Patrimonial › (Assets) › Liquidità › Banca", "", "100.00"],
    ]);

    await wizard.save();

    expect(page.isSelected("Direct purchase via bank account")).toBe(true);
    expect(page.rowTexts()[9]?.slice(2)).toEqual([
      "Direct purchase via bank account",
      "100.00",
      "100.00",
      "0.00",
    ]);
  });

  it("a cost line added and removed leaves the lines as they were; the description is the person's", async () => {
    const page = mountJournalScreen();
    const wizard = await page.openWizard(
      "Direct payment to multiple cost accounts",
    );

    await wizard.fill("Description", "Spese varie");
    await wizard.fill("Amount paid", "60");
    await wizard.select(0, "Costs › Spese generali › Ascensore");
    await wizard.fillLine(0, "amount", "60");
    await wizard.addLine();

    expect(wizard.message()).toBe("Choose an account");

    await wizard.removeLine();

    expect(wizard.message()).toBeNull();
    expect(wizard.previewRows()).toHaveLength(2);

    await wizard.select(0, "Choose an account…");

    expect(wizard.message()).toBe("Choose an account");
    expect(wizard.previewRows()).toEqual([]);

    await wizard.select(0, "Costs › Spese generali › Pulizie");
    await wizard.save();

    expect(page.isSelected("Spese varie")).toBe(true);
  });

  it("a generic line added and removed takes its balance with it", async () => {
    const page = mountJournalScreen();
    const wizard = await page.openWizard("Generic entry");

    await wizard.fillLine(0, "debit", "12");
    await wizard.addLine();
    await wizard.fillLine(1, "debit", "3");

    expect(wizard.lineBalances()).toEqual(["12.00", "15.00"]);

    await wizard.removeLine();

    expect(wizard.lineBalances()).toEqual(["12.00"]);
    expect(wizard.totals()).toEqual(["12.00", "0.00", "12.00"]);
  });

  it("Generic entry: a balanced entry with a party line, the balance running in the grid", async () => {
    const page = mountJournalScreen();
    const wizard = await page.openWizard("Generic entry");
    const supplier = page.rowChoiceLabel("la4", "md1");

    expect(wizard.title()).toBe("Add Accounting Entry");
    expect(supplier).toBe(
      "Patrimonial › (Liabilities) › Fornitori › Alfa s.n.c.",
    );

    await wizard.fill("Description", "Nota di credito");
    await wizard.select(0, supplier);
    await wizard.fillLine(0, "debit", "50");
    expect(wizard.message()).toBe(UNBALANCED);
    expect(wizard.lineBalances()).toEqual(["50.00"]);

    await wizard.addLine();
    await wizard.select(1, "Costs › Spese generali › Ascensore");
    await wizard.fillLine(1, "credit", "50");

    expect(wizard.message()).toBeNull();
    expect(wizard.lineBalances()).toEqual(["50.00", "0.00"]);
    expect(wizard.totals()).toEqual(["50.00", "50.00", "0.00"]);
    expect(wizard.previewRows()).toEqual([
      [
        "1",
        "Patrimonial › (Liabilities) › Fornitori › Alfa s.n.c.",
        "50.00",
        "",
      ],
      ["2", "Costs › Spese generali › Ascensore", "", "50.00"],
    ]);

    await wizard.save();

    expect(page.isSelected("Nota di credito")).toBe(true);

    await page.clickCaret("Nota di credito");
    expect(page.rowTexts()[10]?.slice(2)).toEqual([
      "Total › Patrimonial › Fornitori › Alfa s.n.c.",
      "50.00",
      "0.00",
      "50.00",
    ]);
  });

  it("a generic entry with no description says the design's sentence", async () => {
    const page = mountJournalScreen();
    const wizard = await page.openWizard("Generic entry");

    await wizard.select(0, "Costs › Spese generali › Ascensore");

    expect(wizard.message()).toBe(UNBALANCED);
    expect(wizard.isSaveDisabled()).toBe(true);
  });

  it("a line with both a debit and a credit is refused in the wizard's words", async () => {
    const page = mountJournalScreen();
    const wizard = await page.openWizard("Generic entry");

    await wizard.fill("Description", "Doppia");
    await wizard.select(0, "Costs › Spese generali › Ascensore");
    await wizard.fillLine(0, "debit", "10");
    await wizard.fillLine(0, "credit", "5");

    expect(wizard.message()).toBe("A line is either a debit or a credit");
    expect(wizard.isSaveDisabled()).toBe(true);

    await wizard.fillLine(0, "debit", "");
    await wizard.fillLine(0, "credit", "");

    expect(wizard.message()).toBe("Enter an amount above zero");
  });

  it("Cancel and Escape close without saving; a reopened wizard starts clean", async () => {
    const page = mountJournalScreen();
    const first = await page.openWizard("Direct purchase with cash");

    await first.pick("Costs › Spese generali › Pulizie");
    await first.fill("Amount", "23.50");
    await first.cancel();

    expect(page.dialogOpen()).toBe(false);
    expect(page.entryLabels()).toHaveLength(9);

    const second = await page.openWizard("Direct purchase with cash");

    expect(second.fieldValue("Amount")).toBe("");
    expect(second.previewRows()).toEqual([]);

    await second.pressEscape();
    expect(page.dialogOpen()).toBe(false);
    expect(page.entryLabels()).toHaveLength(9);
  });

  it("a refusal no wizard words is shown as the store gave it", async () => {
    const page = mountJournalScreen();
    page.refuseNextAdd("period-closed");
    const wizard = await page.openWizard("Generic entry");

    await wizard.fill("Description", "Chiusa");
    await wizard.select(0, "Costs › Spese generali › Ascensore");
    await wizard.fillLine(0, "debit", "1");
    await wizard.addLine();
    await wizard.select(1, "Patrimonial › (Assets) › Liquidità › Cassa");
    await wizard.fillLine(1, "credit", "1");
    await wizard.save();

    expect(wizard.message()).toBe("period-closed");
  });

  it("a save the port refuses shows the reason and keeps the dialog, until the next edit", async () => {
    const page = mountJournalScreen();
    page.refuseNextAdd("unbalanced");
    const wizard = await page.openWizard("Direct purchase with cash");

    await wizard.pick("Costs › Spese generali › Pulizie");
    await wizard.fill("Amount", "23.50");
    await wizard.save();

    expect(page.dialogOpen()).toBe(true);
    expect(wizard.message()).toBe(UNBALANCED);
    expect(page.entryLabels()).toHaveLength(9);

    await wizard.fill("Amount", "23.5");

    expect(wizard.message()).toBeNull();

    await wizard.save();

    expect(page.dialogOpen()).toBe(false);
    expect(page.entryLabels()).toHaveLength(10);
  });
});

const UNBALANCED =
  "The entry must balance — the transaction balance must be 0 and a description is required.";
