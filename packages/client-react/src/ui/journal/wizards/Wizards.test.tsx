import { describe, expect, it } from "vitest";

import {
  mountJournalScreen,
  mountJournalWizard,
} from "../JournalScreen.page.tsx";

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
    expect(wizard.choices()).toEqual([]);
    expect(wizard.paidFrom()).toBe("Paid from: Banca");
    expect(wizard.isSaveDisabled()).toBe(true);
    expect(wizard.message()).toBeNull();
  });

  it("the withholding's description follows the tax account chosen, until it is edited", async () => {
    const page = mountJournalScreen({ taxAccounts: true });
    const wizard = await page.openWizard("Withholding-tax payment");

    expect(wizard.choices()).toEqual([
      "Patrimonial › (Liabilities) › Ritenute 1019",
      "Patrimonial › (Liabilities) › Ritenute 1020",
    ]);

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

    expect(wizard.message()).toBeNull();
    expect(wizard.paidFrom()).toBe("This period has no cash account");
    expect(wizard.isSaveDisabled()).toBe(true);
  });

  it("a period with no bank account says so in the bank wizards", async () => {
    const page = mountJournalScreen({ withoutRole: "bank" });
    const direct = await page.openWizard("Direct purchase via bank");

    expect(direct.paidFrom()).toBe("This period has no default bank account");

    await direct.fill("Amount", "5");

    expect(direct.message()).toBeNull();
    expect(direct.paidFrom()).toBe("This period has no default bank account");
    expect(direct.isSaveDisabled()).toBe(true);

    await direct.cancel();
    const multi = await page.openWizard(
      "Direct payment to multiple cost accounts",
    );

    expect(multi.paidFrom()).toBe("This period has no default bank account");

    await multi.fill("Amount paid", "5");

    expect(multi.message()).toBeNull();
    expect(multi.paidFrom()).toBe("This period has no default bank account");
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

    expect(wizard.shownAccounts()).toEqual([
      "Costs › Spese generali › Ascensore",
    ]);

    await wizard.select(0, "Choose an account…");

    expect(wizard.shownAccounts()).toEqual(["Choose an account…"]);
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

  it("a negative amount is refused in plain words", async () => {
    const page = mountJournalScreen();
    const wizard = await page.openWizard("Direct purchase with cash");

    await wizard.pick("Costs › Spese generali › Pulizie");
    await wizard.fill("Amount", "-5");

    expect(wizard.message()).toBe("An amount cannot be negative");
    expect(wizard.isSaveDisabled()).toBe(true);
  });

  it("a negative line in a generic entry is refused in the same words", async () => {
    const page = mountJournalScreen();
    const wizard = await page.openWizard("Generic entry");

    await wizard.fill("Description", "Storno");
    await wizard.select(0, "Costs › Spese generali › Ascensore");
    await wizard.fillLine(0, "debit", "-5");

    expect(wizard.message()).toBe("An amount cannot be negative");
    expect(wizard.isSaveDisabled()).toBe(true);
  });

  it.each(["Direct purchase with cash", "Direct purchase via bank"])(
    "%s with a blank description asks for one, in its own words",
    async (menuLabel) => {
      const page = mountJournalScreen();
      const wizard = await page.openWizard(menuLabel);

      await wizard.pick("Costs › Spese generali › Pulizie");
      await wizard.fill("Amount", "5");
      await wizard.fill("Description", "");

      expect(wizard.message()).toBe("A description is required");
      expect(wizard.isSaveDisabled()).toBe(true);
    },
  );

  it("the multi-cost payment with a blank description asks for one, in its own words", async () => {
    const page = mountJournalScreen();
    const wizard = await page.openWizard(
      "Direct payment to multiple cost accounts",
    );

    await wizard.fill("Amount paid", "60");
    await wizard.select(0, "Costs › Spese generali › Ascensore");
    await wizard.fillLine(0, "amount", "60");
    await wizard.fill("Description", "");

    expect(wizard.message()).toBe("A description is required");
    expect(wizard.isSaveDisabled()).toBe(true);
  });

  it("a save on books the period has left is refused in plain words", async () => {
    const page = mountJournalScreen();
    page.refuseNextAdd("unknown-account");
    const wizard = await page.openWizard("Direct purchase with cash");

    await wizard.pick("Costs › Spese generali › Pulizie");
    await wizard.fill("Amount", "23.50");
    await wizard.save();

    expect(page.dialogOpen()).toBe(true);
    expect(wizard.message()).toBe(
      "The period changed while this was open: cancel and open it again",
    );
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

describe("the New invoice wizard", () => {
  it("fill step 1, Next, see the totals with Total due to supplier, save: the entry lands selected in the grid", async () => {
    const page = mountJournalScreen({ invoices: true });
    const wizard = await page.openWizard("New invoice");

    expect(wizard.title()).toBe("New Invoice Entry — Step 1: Select supplier");
    expect(wizard.hasBack()).toBe(false);
    expect(wizard.isNextDisabled()).toBe(true);
    expect(wizard.fieldValue("Invoice date")).toBe("31/12/2013");

    await wizard.choose("Supplier", "Beta S.p.A.");

    expect(wizard.fieldValue("Invoice reason")).toBe("Pulizie scale");
    expect(wizard.isNextDisabled()).toBe(true);
    expect(wizard.message()).toBe("Enter the invoice number");

    await wizard.fill("Invoice number", "56");

    expect(wizard.message()).toBeNull();
    expect(wizard.isNextDisabled()).toBe(false);

    await wizard.next();

    expect(wizard.title()).toBe(
      "New Invoice Entry — Step 2: Calculate withholding",
    );
    expect(wizard.hasBack()).toBe(true);

    await wizard.pick("Professional w/ register");
    await wizard.choose("Withholding tax", "1019 — Ritenuta 4%");
    await wizard.fill("Taxable amount", "182.37");

    expect(wizard.calcRows()).toEqual([
      ["Social security withholding", "7.29"],
      ["Invoice taxable", "189.66"],
      ["Total VAT", "37.93"],
      ["Total invoice", "227.59"],
      ["Withholding taxable", "189.66"],
      ["Withholding tax", "7.59"],
      ["Total due to supplier", "220.00"],
    ]);
    expect(wizard.fieldValue("Description")).toBe(
      "Invoice 56 — Beta S.p.A.: Pulizie scale",
    );
    expect(wizard.previewRows()).toEqual([
      ["1", "Costs › Spese generali › Pulizie", "227.59", ""],
      ["2", "Patrimonial › (Assets) › Fornitori › Beta S.p.A.", "", "220.00"],
      ["3", "Patrimonial › (Liabilities) › Ritenute 1019", "", "7.59"],
    ]);

    await wizard.save();

    expect(page.dialogOpen()).toBe(false);
    expect(page.isSelected("Invoice 56 — Beta S.p.A.: Pulizie scale")).toBe(
      true,
    );
  });

  it("the Professional w/ register pill sets social security to 4; With non-subject amounts shows the non-taxable amount", async () => {
    const page = mountJournalScreen({ invoices: true });
    const wizard = await page.openWizard("New invoice");

    await wizard.choose("Supplier", "Beta S.p.A.");
    await wizard.fill("Invoice number", "56");
    await wizard.next();

    expect(wizard.fieldValue("Social security withholding")).toBe("0");

    await wizard.pick("Professional w/ register");

    expect(wizard.fieldValue("Social security withholding")).toBe("4");
    expect(() => {
      return wizard.fieldValue("Non-taxable amount");
    }).toThrow();

    await wizard.pick("With non-subject amounts");

    expect(wizard.fieldValue("Social security withholding")).toBe("4");
    expect(wizard.fieldValue("Non-taxable amount")).toBe("0");
  });

  it("a number the supplier already has in the period is warned under the number, and does not stop Next", async () => {
    const page = mountJournalScreen({ invoices: true });
    const wizard = await page.openWizard("New invoice");

    await wizard.choose("Supplier", "Alfa s.n.c.");
    await wizard.fill("Invoice number", "101");

    expect(wizard.duplicateWarning()).toBe(
      "Alfa s.n.c. already has an invoice 101 in this period.",
    );
    expect(wizard.isNextDisabled()).toBe(false);

    await wizard.fill("Invoice number", "102");

    expect(wizard.duplicateWarning()).toBeNull();
  });

  it("every field is the person's to change, and the entry is written as typed", async () => {
    const page = mountJournalScreen({ invoices: true });
    const wizard = await page.openWizard("New invoice");

    await wizard.choose("Supplier", "Alfa s.n.c.");
    await wizard.fill("Invoice number", "7");
    await wizard.fill("Invoice reason", "Revisione");
    await wizard.choose("Cost account", "Costs › Spese generali › Pulizie");
    await wizard.fill("Invoice date", "3/5");
    await wizard.fill("Invoice due date", "3/6/2013");
    await wizard.next();
    await wizard.pick("With non-subject amounts");
    await wizard.fill("Taxable amount", "100");
    await wizard.fill("Total VAT", "10");
    await wizard.fill("Non-taxable amount", "5");

    expect(wizard.calcRows()).toEqual([
      ["Social security withholding", "0.00"],
      ["Invoice taxable", "100.00"],
      ["Total VAT", "10.00"],
      ["Total invoice", "115.00"],
      ["Withholding taxable", "100.00"],
      ["Withholding tax", "0.00"],
      ["Total due to supplier", "115.00"],
    ]);

    await wizard.fill("Social security withholding", "4");
    await wizard.check("Apply withholding on social security");

    expect(wizard.isChecked("Apply withholding on social security")).toBe(true);
    expect(wizard.calcRows()[4]).toEqual(["Withholding taxable", "104.00"]);

    await wizard.fill("Description", "Revisione impianto");
    await wizard.back();

    expect(wizard.fieldValue("Invoice date")).toBe("3/5");
    expect(wizard.fieldValue("Invoice reason")).toBe("Revisione");

    await wizard.next();
    await wizard.save();

    expect(page.isSelected("Revisione impianto")).toBe(true);
  });

  it("an invoice saved with no due date waits to be paid, its Due blank", async () => {
    const page = mountJournalScreen({ invoices: true });
    const invoice = await page.openWizard("New invoice");

    await invoice.choose("Supplier", "Beta S.p.A.");
    await invoice.fill("Invoice number", "56");
    await invoice.next();
    await invoice.fill("Taxable amount", "50");
    await invoice.save();

    const payment = await page.openWizard("Invoice payment");

    expect(payment.openInvoices()).toEqual([
      [
        "101",
        "Manutenzione ascensore",
        "10/01/2013",
        "10/02/2013",
        "Alfa s.n.c.",
        "360.18",
      ],
      ["56", "Pulizie scale", "31/12/2013", "", "Beta S.p.A.", "60.00"],
    ]);
    expect(payment.overdueInvoices()).toEqual(["101"]);
  });

  it("a due date before the invoice date is refused in plain words", async () => {
    const page = mountJournalScreen({ invoices: true });
    const wizard = await page.openWizard("New invoice");

    await wizard.choose("Supplier", "Alfa s.n.c.");
    await wizard.fill("Invoice number", "102");
    await wizard.fill("Invoice due date", "1/1");

    expect(wizard.message()).toBe(
      "The due date cannot be before the invoice date",
    );
    expect(wizard.isNextDisabled()).toBe(true);
  });
});

describe("the Invoice payment wizard", () => {
  it("lists the open invoices with what remains, the overdue due date marked", async () => {
    const page = mountJournalScreen({ invoices: true });
    const wizard = await page.openWizard("Invoice payment");

    expect(wizard.title()).toBe("Invoice Payment — Step 1: Select invoice");
    expect(wizard.openInvoices()).toEqual([
      [
        "101",
        "Manutenzione ascensore",
        "10/01/2013",
        "10/02/2013",
        "Alfa s.n.c.",
        "360.18",
      ],
    ]);
    expect(wizard.overdueInvoices()).toEqual(["101"]);
    expect(wizard.emptyText()).toBeNull();
    expect(wizard.isNextDisabled()).toBe(true);
  });

  it("choose one, Next: the amount is prefilled under the tranche note; Next, Save: the entry lands selected", async () => {
    const page = mountJournalScreen({ invoices: true });
    const wizard = await page.openWizard("Invoice payment");

    await wizard.pick("Invoice 101 — Alfa s.n.c.");
    await wizard.next();

    expect(wizard.title()).toBe(
      "Invoice Payment — Step 2: Liquidity account and amount",
    );
    expect(wizard.fieldValue("Amount to pay")).toBe("360.18");
    expect(wizard.trancheNote()).toBe(
      "You may pay an invoice in several tranches: enter an amount lower than the invoice total to settle it partially; the remainder can be paid later.",
    );
    expect(wizard.choices()).toEqual([
      "Patrimonial › (Assets) › Liquidità › Cassa",
      "Patrimonial › (Assets) › Liquidità › Banca",
    ]);

    await wizard.next();

    expect(wizard.title()).toBe("Invoice Payment — Step 3: Description");
    expect(wizard.fieldValue("Description")).toBe(
      "Payment of invoice 101 — Alfa s.n.c.",
    );

    await wizard.back();
    await wizard.pick("Patrimonial › (Assets) › Liquidità › Cassa");
    await wizard.next();

    expect(wizard.previewRows()[1]).toEqual([
      "2",
      "Patrimonial › (Assets) › Liquidità › Cassa",
      "",
      "360.18",
    ]);

    await wizard.back();
    await wizard.pick("Patrimonial › (Assets) › Liquidità › Banca");
    await wizard.next();

    expect(wizard.previewRows()).toEqual([
      [
        "1",
        "Patrimonial › (Liabilities) › Fornitori › Alfa s.n.c.",
        "360.18",
        "",
      ],
      ["2", "Patrimonial › (Assets) › Liquidità › Banca", "", "360.18"],
    ]);

    await wizard.fill("Description", "Saldo fattura 101");
    await wizard.save();

    expect(page.dialogOpen()).toBe(false);
    expect(page.isSelected("Saldo fattura 101")).toBe(true);
  });

  it("an amount above what remains says what the invoice still owes, and Next waits", async () => {
    const page = mountJournalScreen({ invoices: true });
    const wizard = await page.openWizard("Invoice payment");

    await wizard.pick("Invoice 101 — Alfa s.n.c.");
    await wizard.next();
    await wizard.fill("Amount to pay", "1360.18");

    expect(wizard.message()).toBe("The invoice still owes 360.18.");
    expect(wizard.isNextDisabled()).toBe(true);

    await wizard.fill("Amount to pay", "100");

    expect(wizard.message()).toBeNull();
    expect(wizard.isNextDisabled()).toBe(false);
  });

  it("a payment made elsewhere while it is open: the save is refused with what the invoice owes now", async () => {
    const page = mountJournalScreen({ invoices: true });
    const wizard = await page.openWizard("Invoice payment");

    await wizard.pick("Invoice 101 — Alfa s.n.c.");
    await wizard.next();
    await page.payElsewhere("li1", "md1", 10000);
    await wizard.next();
    await wizard.save();

    expect(page.dialogOpen()).toBe(true);
    expect(wizard.message()).toBe("The invoice still owes 260.18.");
  });

  it("with no open invoice the grid says so", async () => {
    const page = mountJournalScreen();
    const wizard = await page.openWizard("Invoice payment");

    expect(wizard.openInvoices()).toEqual([]);
    expect(wizard.emptyText()).toBe("No invoice is waiting to be paid.");
  });
});

describe("the wizards' keyboard", () => {
  it("each invoice step puts the focus on its first required empty field; Enter is Next only while Next is enabled", async () => {
    const page = mountJournalScreen({ invoices: true });
    const wizard = await page.openWizard("New invoice");

    expect(wizard.focusedLabel()).toBe("Supplier");

    await wizard.choose("Supplier", "Beta S.p.A.");
    await wizard.fill("Invoice number", "");
    await wizard.pressEnter();

    expect(wizard.title()).toBe("New Invoice Entry — Step 1: Select supplier");

    await wizard.fill("Invoice number", "56");
    await wizard.pressEnter();

    expect(wizard.title()).toBe(
      "New Invoice Entry — Step 2: Calculate withholding",
    );
    expect(wizard.focusedLabel()).toBe("Taxable amount");

    await wizard.fill("Taxable amount", "50");
    await wizard.fill("Description", "");
    await wizard.back();

    expect(wizard.focusedLabel()).toBe("Supplier");

    await wizard.next();

    expect(wizard.focusedLabel()).toBe("Description");
  });

  it("each payment step puts the focus on its first field to fill; Enter on the last step saves", async () => {
    const page = mountJournalScreen({ invoices: true });
    const wizard = await page.openWizard("Invoice payment");

    expect(wizard.focusedLabel()).toBe("Invoice 101 — Alfa s.n.c.");

    await wizard.pick("Invoice 101 — Alfa s.n.c.");
    await wizard.next();

    expect(wizard.focusedLabel()).toBe("Amount to pay");

    await wizard.pressEnter();

    expect(wizard.title()).toBe("Invoice Payment — Step 3: Description");
    expect(wizard.focusedLabel()).toBe("Description");

    await wizard.pressEnter();

    expect(page.dialogOpen()).toBe(false);
    expect(page.isSelected("Payment of invoice 101 — Alfa s.n.c.")).toBe(true);
  });

  it("Enter in the one-step wizards saves once the entry can be saved", async () => {
    const page = mountJournalScreen();
    const wizard = await page.openWizard("Direct purchase with cash");

    expect(wizard.focusedLabel()).toBe("Amount");

    await wizard.fill("Amount", "5");
    await wizard.pressEnter();

    expect(page.dialogOpen()).toBe(true);

    await wizard.pick("Costs › Spese generali › Pulizie");
    await wizard.fill("Amount", "5");
    await wizard.pressEnter();

    expect(page.dialogOpen()).toBe(false);
  });
});

describe("editing an invoice and a payment", () => {
  it("the title reads Edit New Invoice Entry; a paid invoice's supplier is locked, with the reason", () => {
    const wizard = mountJournalWizard(
      { wizard: "invoice", editing: "e2" },
      { invoices: true },
    );

    expect(wizard.title()).toBe(
      "Edit New Invoice Entry — Step 1: Select supplier",
    );
    expect(wizard.isLocked("Supplier")).toBe(true);
    expect(wizard.supplierNote()).toBe(
      "This invoice has payments: its supplier cannot change.",
    );
    expect(wizard.focusedLabel()).toBe("Invoice number");
  });

  it("an open invoice's supplier can change, and has no note", () => {
    const wizard = mountJournalWizard(
      { wizard: "invoice", editing: "e1" },
      { invoices: true },
    );

    expect(wizard.isLocked("Supplier")).toBe(false);
    expect(wizard.supplierNote()).toBeNull();
  });

  it("lowering Taxable below what was paid says what the payments total", async () => {
    const wizard = mountJournalWizard(
      { wizard: "invoice", editing: "e2" },
      { invoices: true },
    );

    await wizard.next();

    expect(wizard.fieldValue("Taxable amount")).toBe("166.67");

    await wizard.fill("Taxable amount", "100");

    expect(wizard.message()).toBe("Payments already made total 200.00.");
    expect(wizard.isSaveDisabled()).toBe(true);
  });

  it("a payment's edit starts on step 2, with no Back to the invoice it pays", async () => {
    const wizard = mountJournalWizard(
      { wizard: "invoicePayment", editing: "e3" },
      { invoices: true },
    );

    expect(wizard.title()).toBe(
      "Edit Invoice Payment — Step 2: Liquidity account and amount",
    );
    expect(wizard.hasBack()).toBe(false);
    expect(wizard.fieldValue("Amount to pay")).toBe("200.00");

    await wizard.next();

    expect(wizard.hasBack()).toBe(true);
  });
});

describe("the Opening balances wizard", () => {
  it("lists the assets, the liabilities and each resident; the transaction balance is in --neg while not zero", async () => {
    const page = mountJournalScreen();
    const wizard = await page.openWizard("Opening balances");

    expect(wizard.title()).toBe("Opening Balances Entry");
    expect(wizard.fieldValue("Description")).toBe("Opening balances");
    expect(wizard.openingRows()).toEqual([
      [CASSA, "", ""],
      [BANCA, "", ""],
      [FONDI, "", ""],
      [ROSSI_A01, "", ""],
      [ROSSI_A02, "", ""],
      [BIANCHI_B01, "", ""],
    ]);
    expect(wizard.openingBalance()).toBe("0.00");
    expect(wizard.isBalanceNegative()).toBe(false);

    await wizard.fillOpening(CASSA, "debit", "1,250.50");

    expect(wizard.openingBalance()).toBe("1,250.50");
    expect(wizard.isBalanceNegative()).toBe(true);
    expect(wizard.isSaveDisabled()).toBe(true);

    await wizard.fillOpening(FONDI, "credit", "1250.50");

    expect(wizard.openingBalance()).toBe("0.00");
    expect(wizard.isBalanceNegative()).toBe(false);
    expect(wizard.previewRows()).toEqual([
      ["1", CASSA, "1,250.50", ""],
      ["2", FONDI, "", "1,250.50"],
    ]);

    await wizard.save();

    expect(page.dialogOpen()).toBe(false);
    expect(page.isSelected("Opening balances")).toBe(true);
  });

  it("the search narrows the rows by label, whatever the case", async () => {
    const page = mountJournalScreen();
    const wizard = await page.openWizard("Opening balances");

    await wizard.searchOpening("rossi");

    expect(wizard.openingRows().map(labelOf)).toEqual([ROSSI_A01, ROSSI_A02]);

    await wizard.searchOpening("");

    expect(wizard.openingRows()).toHaveLength(6);
  });

  it("Show only rows with an amount narrows the rows to those with one", async () => {
    const page = mountJournalScreen();
    const wizard = await page.openWizard("Opening balances");

    await wizard.fillOpening(BANCA, "debit", "10");
    await wizard.fillOpening(ROSSI_A02, "credit", "10");
    await wizard.fillOpening(FONDI, "debit", "0");
    await wizard.check("Show only rows with an amount");

    expect(wizard.isChecked("Show only rows with an amount")).toBe(true);
    expect(wizard.openingRows()).toEqual([
      [BANCA, "10", ""],
      [ROSSI_A02, "", "10"],
    ]);

    await wizard.check("Show only rows with an amount");

    expect(wizard.openingRows()).toHaveLength(6);
  });

  it("Enter in a Debit or Credit field moves to the next row's Debit field; Tab keeps its native order", async () => {
    const page = mountJournalScreen();
    const wizard = await page.openWizard("Opening balances");

    await wizard.focusOpening(CASSA, "debit");
    await wizard.pressEnter();

    expect(wizard.focusedLabel()).toBe(`${BANCA} debit`);
    expect(page.dialogOpen()).toBe(true);

    await wizard.pressTab();

    expect(wizard.focusedLabel()).toBe(`${BANCA} credit`);

    await wizard.pressTab();

    expect(wizard.focusedLabel()).toBe(`${FONDI} debit`);

    await wizard.focusOpening(FONDI, "credit");
    await wizard.pressEnter();

    expect(wizard.focusedLabel()).toBe(`${ROSSI_A01} debit`);
  });

  it("an amount below zero names its row, and the entry cannot be saved", async () => {
    const page = mountJournalScreen();
    const wizard = await page.openWizard("Opening balances");

    await wizard.fillOpening(BANCA, "debit", "-50");

    expect(wizard.message()).toBe(
      `Enter an amount of zero or more for ${BANCA}`,
    );
    expect(wizard.isSaveDisabled()).toBe(true);
  });

  it("a blank description is refused with the design's sentence", async () => {
    const page = mountJournalScreen();
    const wizard = await page.openWizard("Opening balances");

    await wizard.fillOpening(CASSA, "debit", "10");
    await wizard.fillOpening(FONDI, "credit", "10");
    await wizard.fill("Description", "");

    expect(wizard.message()).toBe(UNBALANCED);
    expect(wizard.isSaveDisabled()).toBe(true);
  });

  it("once the period has an opening, the menu item edits it, with its own lines", async () => {
    const page = mountJournalScreen();
    const first = await page.openWizard("Opening balances");

    await first.fillOpening(BANCA, "debit", "500");
    await first.fillOpening(BIANCHI_B01, "credit", "500");
    await first.save();

    const wizard = await page.openWizard("Opening balances");

    expect(wizard.title()).toBe("Edit Opening Balances Entry");
    expect(wizard.openingRows()).toEqual([
      [CASSA, "", ""],
      [BANCA, "500.00", ""],
      [FONDI, "", ""],
      [ROSSI_A01, "", ""],
      [ROSSI_A02, "", ""],
      [BIANCHI_B01, "", "500.00"],
    ]);

    await wizard.fillOpening(BANCA, "debit", "600");
    await wizard.fillOpening(BIANCHI_B01, "credit", "600");
    await wizard.save();

    expect(page.entryLabels()).toHaveLength(10);
    expect(page.rowTexts()[9]?.slice(1)).toEqual([
      "10",
      "Opening balances",
      "600.00",
      "600.00",
      "0.00",
    ]);
  });
});

const UNBALANCED =
  "The entry must balance — the transaction balance must be 0 and a description is required.";

const CASSA = "Patrimonial › (Assets) › Liquidità › Cassa";
const BANCA = "Patrimonial › (Assets) › Liquidità › Banca";
const FONDI = "Patrimonial › (Liabilities) › Fondi";
const ROSSI_A01 = "Condòmini › Rossi Mario › A01";
const ROSSI_A02 = "Condòmini › Rossi Mario › A02";
const BIANCHI_B01 = "Condòmini › Bianchi Anna › B01";

function labelOf(row: string[]): string {
  return row[0] ?? "";
}
