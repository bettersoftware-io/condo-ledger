import { afterEach, describe, expect, it } from "vitest";

import {
  accepted,
  type ClockPort,
  type EntryAdded,
  type EntryDraft,
  fixedClock,
  type Invoice,
  openInvoices,
  type ResultOf,
  rate,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import { type AppHarness, createAppHarness } from "#/testing/appHarness.ts";
import { createAmountTexts } from "#/testing/createAmountTexts.ts";
import { currentBooks, currentEntry } from "#/testing/harnessBooks.ts";

import {
  createInvoiceWizard,
  type InvoiceForm,
  type InvoicePreset,
  type InvoiceSummary,
  SUPPLIER_GROUP,
  WITHHOLDING_GROUP,
} from "./invoiceWizard.ts";
import type { WizardMachine } from "./wizard.ts";

afterEach(() => {
  for (const machine of created.splice(0)) {
    machine.dispose();
  }
});

describe("the New invoice wizard", () => {
  it("starts on step 1 of 2 with no supplier, the period's last day as the date, VAT 20 and no withholding", () => {
    const { machine } = createWizard();

    expect(machine.state$.getValue()).toMatchObject({
      step: 1,
      stepCount: 2,
      editing: null,
      form: {
        supplierId: null,
        number: "",
        reason: "",
        date: "31/12/2013",
        dueDate: "",
        costAccountId: null,
        taxable: "",
        socialSecurityRate: "0",
        vatRate: "20",
        nonTaxable: "0",
        withholdingCode: null,
        withholdingOnSocialSecurity: false,
        description: "",
        preset: "company",
        edited: [],
      },
      stepVerdict: { ok: false, reason: "no-supplier" },
      verdict: { ok: false, reason: "no-supplier" },
      summary: {
        totals: null,
        supplierLocked: false,
        paid: 0,
        duplicate: false,
        nonTaxableShown: false,
        date: "2013-12-31",
        dueDate: null,
      },
      preview: [],
    });
  });

  it("the summary reads the dates as typed, in the period's year; a date that reads as none is null", () => {
    const { machine } = createWizard();

    machine.intents.edit({ date: "23/4", dueDate: "5/6/2014" });

    expect(machine.state$.getValue().summary).toMatchObject({
      date: "2013-04-23",
      dueDate: "2014-06-05",
    });

    machine.intents.edit({ date: "31/2", dueDate: "" });

    expect(machine.state$.getValue().summary).toMatchObject({
      date: null,
      dueDate: null,
    });
  });

  it("offers the period's suppliers by name, its expense leaves and its withholding codes", () => {
    const { machine, harness } = createWizard();
    const choices = machine.state$.getValue().choices;
    const suppliers = choices.filter((choice) => {
      return choice.group === SUPPLIER_GROUP;
    });

    const codes = choices.filter((choice) => {
      return choice.group === WITHHOLDING_GROUP;
    });

    const names = suppliers.map((choice) => {
      return choice.label;
    });

    expect(
      suppliers.map((choice) => {
        return choice.key;
      }),
    ).toContain("md78");
    expect(names).toEqual(
      [...names].sort((a, b) => {
        return a.localeCompare(b);
      }),
    );
    expect(suppliers).toHaveLength(
      currentBooks(harness).parties.filter((party) => {
        return party.kind === "supplier";
      }).length,
    );
    expect(
      choices.some((choice) => {
        return choice.key === "la219" && choice.label.endsWith("Ascensore");
      }),
    ).toBe(true);
    expect(
      choices.some((choice) => {
        return choice.key.startsWith("r");
      }),
    ).toBe(false);
    expect(
      codes.map((choice) => {
        return choice.key;
      }),
    ).toEqual(["1004", "1019", "1020", "1040"]);
  });

  it("choosing md78 prefills from its most recent invoice in the period: cost account, VAT, withholding and reason", () => {
    const { machine } = createWizard();

    machine.intents.edit({ supplierId: "md78" });

    expect(machine.state$.getValue().form).toMatchObject({
      supplierId: "md78",
      costAccountId: "la219",
      socialSecurityRate: "0",
      vatRate: "20",
      withholdingCode: "1020",
      withholdingOnSocialSecurity: false,
      reason: "controllo ascensori",
      preset: "company",
      description: "",
    });
    expect(machine.state$.getValue().stepVerdict).toEqual({
      ok: false,
      reason: "no-number",
    });
  });

  it("the description reads Invoice {number} — {supplier}: {reason} once a number is typed, and follows the fields", () => {
    const { machine, harness } = createWizard();
    const name = supplierName(harness, "md78");

    machine.intents.edit({ supplierId: "md78" });
    machine.intents.edit({ number: "12" });

    expect(machine.state$.getValue().form.description).toBe(
      `Invoice 12 — ${name}: controllo ascensori`,
    );

    machine.intents.edit({ reason: "verifica biennale" });

    expect(machine.state$.getValue().form.description).toBe(
      `Invoice 12 — ${name}: verifica biennale`,
    );
  });

  it("the description stops following once the person edits it", () => {
    const { machine } = createWizard();

    machine.intents.edit({ supplierId: "md78", number: "12" });
    machine.intents.edit({ description: "Fattura ascensori" });
    machine.intents.edit({ number: "13" });

    expect(machine.state$.getValue().form.description).toBe(
      "Fattura ascensori",
    );
  });

  it("after an edit of the cost account, another supplier keeps that cost account and takes the rest from its own last invoice", () => {
    const { machine } = createWizard();

    machine.intents.edit({ supplierId: "md78" });
    machine.intents.edit({ costAccountId: "la174" });
    machine.intents.edit({ supplierId: "md81" });

    expect(machine.state$.getValue().form).toMatchObject({
      supplierId: "md81",
      costAccountId: "la174",
      withholdingCode: "1019",
      vatRate: "20",
    });
    expect(machine.state$.getValue().form.edited).toEqual([
      "supplierId",
      "costAccountId",
    ]);
    expect(machine.state$.getValue().form.reason).not.toBe(
      "controllo ascensori",
    );
  });

  it("a supplier with no earlier invoice gets VAT 20, social security 0 and no withholding (Review Focus 4)", () => {
    const { machine } = createWizard();

    machine.intents.edit({ supplierId: "md78" });
    machine.intents.edit({ vatRate: "10" });
    machine.intents.edit({ supplierId: "md86" });

    expect(machine.state$.getValue().form).toMatchObject({
      supplierId: "md86",
      vatRate: "10",
      socialSecurityRate: "0",
      withholdingCode: null,
      withholdingOnSocialSecurity: false,
      costAccountId: null,
      reason: "",
    });

    machine.intents.edit({ supplierId: "md78" });
    machine.intents.edit({ supplierId: "md86" });

    expect(machine.state$.getValue().form.vatRate).toBe("10");
  });

  it("a supplier with no earlier invoice and nothing edited gets VAT 20", () => {
    const { machine } = createWizard();

    machine.intents.edit({ supplierId: "md78" });
    machine.intents.edit({ supplierId: "md86" });

    expect(machine.state$.getValue().form).toMatchObject({
      vatRate: "20",
      socialSecurityRate: "0",
      withholdingCode: null,
    });
  });

  it("with a clock inside the period, the date starts at today", () => {
    const { machine } = createWizard(fixedClock("2013-05-10T08:00:00Z"));

    expect(machine.state$.getValue().form.date).toBe("10/05/2013");
  });

  it("the period's first and last days are inside it; the day before is not", () => {
    expect(
      createWizard(fixedClock("2013-01-01T08:00:00Z")).machine.state$.getValue()
        .form.date,
    ).toBe("01/01/2013");
    expect(
      createWizard(fixedClock("2013-12-31T08:00:00Z")).machine.state$.getValue()
        .form.date,
    ).toBe("31/12/2013");
    expect(
      createWizard(fixedClock("2012-12-31T08:00:00Z")).machine.state$.getValue()
        .form.date,
    ).toBe("31/12/2013");
  });

  it("taxable 2,588.05 with code 1019 is due 3,002.14 to the supplier, read as M2a's amounts are (Review Focus 1)", () => {
    const { machine } = createWizard();

    machine.intents.edit({ supplierId: "md81", taxable: "2,588.05" });

    expect(machine.state$.getValue().form.withholdingCode).toBe("1019");
    expect(machine.state$.getValue().summary.totals).toEqual({
      socialSecurity: 0,
      invoiceTaxable: 258805,
      vat: 51761,
      total: 310566,
      withholdingBase: 258805,
      withholding: 10352,
      dueToSupplier: 300214,
    });
  });

  it("the Italian form 2.588,05 is not an amount, as M2a decided for 1,23", () => {
    const { machine } = createWizard();

    machine.intents.edit({ supplierId: "md81", number: "5" });
    machine.intents.edit({ taxable: "2.588,05" });

    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: false, reason: "not-an-amount" },
      summary: { totals: null },
    });
  });

  it("step 1 names each missing field in turn, then the dates", () => {
    const { machine } = createWizard();

    function reason(): string | null {
      const verdict = machine.state$.getValue().stepVerdict;

      return verdict.ok ? null : verdict.reason;
    }

    expect(reason()).toBe("no-supplier");
    machine.intents.edit({ supplierId: "md86" });
    expect(reason()).toBe("no-number");
    machine.intents.edit({ number: " " });
    expect(reason()).toBe("no-number");
    machine.intents.edit({ number: "7" });
    expect(reason()).toBe("no-reason");
    machine.intents.edit({ reason: "  " });
    expect(reason()).toBe("no-reason");
    machine.intents.edit({ reason: "antenna" });
    expect(reason()).toBe("no-cost-account");
    machine.intents.edit({ costAccountId: "la157" });
    expect(reason()).toBe("no-cost-account");
    machine.intents.edit({ costAccountId: "la219" });
    expect(reason()).toBeNull();
    machine.intents.edit({ date: "31/2" });
    expect(reason()).toBe("not-a-date");
    machine.intents.edit({ date: "23/4", dueDate: "soon" });
    expect(reason()).toBe("not-a-date");
    machine.intents.edit({ dueDate: "22/4" });
    expect(reason()).toBe("due-before-date");
    machine.intents.edit({ dueDate: "23/4" });
    expect(reason()).toBeNull();
  });

  it("a supplier the period does not have is no supplier", () => {
    const { machine } = createWizard();

    machine.intents.edit({ supplierId: "r162" });

    expect(machine.state$.getValue().stepVerdict).toEqual({
      ok: false,
      reason: "no-supplier",
    });
  });

  it("Next waits for step 1, and step 2 names an amount, then a rate", () => {
    const { machine } = createWizard();

    machine.intents.next();
    expect(machine.state$.getValue().step).toBe(1);

    machine.intents.edit({ supplierId: "md78", number: "12" });
    machine.intents.next();

    expect(machine.state$.getValue()).toMatchObject({
      step: 2,
      stepVerdict: { ok: false, reason: "not-an-amount" },
    });

    machine.intents.edit({ taxable: "-5" });
    expect(machine.state$.getValue().stepVerdict).toEqual({
      ok: false,
      reason: "not-an-amount",
    });

    machine.intents.edit({ taxable: "100", nonTaxable: "x" });
    expect(machine.state$.getValue().stepVerdict).toEqual({
      ok: false,
      reason: "not-an-amount",
    });

    machine.intents.edit({ nonTaxable: "", vatRate: "abc" });
    expect(machine.state$.getValue().stepVerdict).toEqual({
      ok: false,
      reason: "not-a-rate",
    });

    machine.intents.edit({ vatRate: "20", socialSecurityRate: "-4" });
    expect(machine.state$.getValue().stepVerdict).toEqual({
      ok: false,
      reason: "not-a-rate",
    });

    machine.intents.edit({ socialSecurityRate: "4" });
    expect(machine.state$.getValue().stepVerdict).toEqual({ ok: true });
  });

  it("previews the cost debited, the supplier credited and the withholding credited, as paths", () => {
    const { machine, harness } = createWizard();

    machine.intents.edit({ supplierId: "md81", number: "5", taxable: "100" });

    const preview = machine.state$.getValue().preview;

    expect(
      preview.map((line) => {
        return [line.debit, line.credit];
      }),
    ).toEqual([
      [12000, 0],
      [0, 11600],
      [0, 400],
    ]);
    expect(preview[1]?.path).toMatch(
      new RegExp(` › ${escaped(supplierName(harness, "md81"))}$`),
    );
    expect(preview[0]?.path).not.toMatch(/^Total/);
  });

  it("a supplier with no posting in the period is previewed under its account, by name", () => {
    const harness = createP36Harness();
    const books = currentBooks(harness);
    const machine = createInvoiceWizard(
      createAmountTexts(),
      {
        ...books,
        parties: [
          ...books.parties,
          { kind: "supplier", id: "md999", name: "Fornitore nuovo" },
        ],
      },
      harness.ports.clock,
      () => {
        return Promise.resolve(accepted({ id: "never" }));
      },
      null,
    );

    created.push(machine);
    machine.intents.edit({
      supplierId: "md999",
      number: "5",
      reason: "antenna",
      costAccountId: "la219",
      taxable: "100",
    });

    const preview = machine.state$.getValue().preview;

    expect(machine.state$.getValue().verdict).toEqual({ ok: true });
    expect(preview).toHaveLength(2);
    expect(preview[1]).toMatchObject({ debit: 0, credit: 12000 });
    expect(preview[1]?.path).toMatch(/^Patrimonial › .+ › Fornitore nuovo$/);
  });

  it("an unknown withholding code is refused, and has no totals", () => {
    const { machine } = createWizard();

    machine.intents.edit({
      supplierId: "md81",
      number: "5",
      taxable: "100",
      withholdingCode: "9999",
    });

    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: false, reason: "unknown-withholding" },
      summary: { totals: null },
      preview: [],
    });
  });

  it("a blank description is the domain's to refuse", () => {
    const { machine } = createWizard();

    machine.intents.edit({
      supplierId: "md81",
      number: "5",
      taxable: "100",
      description: " ",
    });

    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "blank-description",
    });
  });

  it("the Professional w/ register pill sets social security 4 and the flag on", () => {
    const { machine } = createWizard();

    machine.intents.edit({ supplierId: "md78" });
    machine.intents.edit({ preset: "professionalWithRegister" });

    expect(machine.state$.getValue().form).toMatchObject({
      preset: "professionalWithRegister",
      socialSecurityRate: "4",
      withholdingOnSocialSecurity: true,
      nonTaxable: "0",
      withholdingCode: "1020",
    });
    expect(machine.state$.getValue().summary.nonTaxableShown).toBe(false);

    machine.intents.edit({ supplierId: "md81" });

    expect(machine.state$.getValue().form).toMatchObject({
      preset: "professionalWithRegister",
      socialSecurityRate: "4",
      withholdingOnSocialSecurity: true,
    });
  });

  it("a picked pill stays when the supplier changes, whatever the prefill matches", () => {
    const { machine } = createWizard();

    machine.intents.edit({ preset: "nonSubject" });
    machine.intents.edit({ supplierId: "md78" });

    expect(machine.state$.getValue()).toMatchObject({
      form: { preset: "nonSubject", socialSecurityRate: "0" },
      summary: { nonTaxableShown: true },
    });
  });

  it("among a supplier's invoices of one day, the prefill takes the highest number, read as a number", () => {
    const harness = createP36Harness();
    const books = currentBooks(harness);
    const li50 = must(
      books.invoices.find((invoice) => {
        return invoice.id === "li50";
      }),
      "the invoice li50",
    );

    const machine = createInvoiceWizard(
      createAmountTexts(),
      {
        ...books,
        invoices: [
          ...books.invoices,
          { ...li50, id: "li900", number: "400", reason: "pulsantiera" },
        ],
      },
      harness.ports.clock,
      () => {
        return Promise.resolve(accepted({ id: "never" }));
      },
      null,
    );

    created.push(machine);
    machine.intents.edit({ supplierId: "md78" });

    expect(li50.number).toBe("3163");
    expect(machine.state$.getValue().form.reason).toBe("controllo ascensori");
  });

  it("the Company and Professional w/o register pills clear social security, the flag and the non-taxable amount", () => {
    const { machine } = createWizard();

    machine.intents.edit({ preset: "professionalWithRegister" });
    machine.intents.edit({ preset: "nonSubject" });
    machine.intents.edit({ nonTaxable: "5" });
    machine.intents.edit({ preset: "professionalWithoutRegister" });

    expect(machine.state$.getValue().form).toMatchObject({
      socialSecurityRate: "0",
      withholdingOnSocialSecurity: false,
      nonTaxable: "0",
    });

    machine.intents.edit({ preset: "professionalWithRegister" });
    machine.intents.edit({ preset: "company" });

    expect(machine.state$.getValue().form).toMatchObject({
      socialSecurityRate: "0",
      withholdingOnSocialSecurity: false,
      nonTaxable: "0",
    });
  });

  it("the With non-subject amounts pill shows the non-taxable field and keeps the fields as they were", () => {
    const { machine } = createWizard();

    machine.intents.edit({ preset: "professionalWithRegister" });
    machine.intents.edit({ preset: "nonSubject" });

    expect(machine.state$.getValue()).toMatchObject({
      form: { socialSecurityRate: "4", withholdingOnSocialSecurity: true },
      summary: { nonTaxableShown: true },
    });
  });

  it("the pill starts on the one the prefilled fields match", () => {
    expect(presetAfter({ supplierId: "md78" })).toBe("company");
    expect(
      presetAfter({ socialSecurityRate: "4" }, { supplierId: "md78" }),
    ).toBe("nonSubject");
    expect(
      presetAfter(
        { socialSecurityRate: "4", withholdingOnSocialSecurity: true },
        { supplierId: "md78" },
      ),
    ).toBe("professionalWithRegister");
    expect(
      presetAfter(
        { withholdingOnSocialSecurity: true },
        { supplierId: "md78" },
      ),
    ).toBe("company");
    expect(presetAfter({ nonTaxable: "1" }, { supplierId: "md78" })).toBe(
      "nonSubject",
    );
    expect(presetAfter({ supplierId: "md82" })).toBe("company");
  });

  it("a number the supplier already has in the period is a warning, not a refusal", async () => {
    const { machine } = createWizard();

    machine.intents.edit({ supplierId: "md78", number: "2959" });

    expect(machine.state$.getValue().summary.duplicate).toBe(true);

    machine.intents.edit({ number: " 2960 " });
    expect(machine.state$.getValue().summary.duplicate).toBe(false);

    machine.intents.edit({ number: " 2959 ", taxable: "100" });
    expect(machine.state$.getValue()).toMatchObject({
      summary: { duplicate: true },
      verdict: { ok: true },
    });
    expect((await machine.intents.save()).ok).toBe(true);
  });

  it("another supplier's number is no duplicate", () => {
    const { machine } = createWizard();

    machine.intents.edit({ supplierId: "md81", number: "2959" });

    expect(machine.state$.getValue().summary.duplicate).toBe(false);
  });

  it("a save lands with the next number and the fixed stamp, with its invoice, which is now open", async () => {
    const { machine, harness } = createWizard();

    machine.intents.edit({
      supplierId: "md78",
      number: "4001",
      date: "23/4",
      dueDate: "23/5/2013",
      taxable: "2,588.05",
    });

    const saved = await machine.intents.save();

    expect(saved.ok).toBe(true);

    const id = saved.ok ? saved.value.id : "";
    const books = currentBooks(harness);

    expect(currentEntry(harness, id)).toMatchObject({
      number: 141,
      at: "2026-10-14T10:00:00",
      kind: "invoice",
      description: `Invoice 4001 — ${supplierName(harness, "md78")}: controllo ascensori`,
    });

    const invoice = must(
      books.invoices.find((candidate) => {
        return candidate.entryId === id;
      }),
      "the new invoice",
    );

    expect(invoice).toMatchObject({
      supplierId: "md78",
      number: "4001",
      date: "2013-04-23",
      dueDate: "2013-05-23",
      costAccountId: "la219",
      taxable: 258805,
      socialSecurityRate: 0,
      vatRate: 2000,
      nonTaxable: 0,
      withholdingCode: "1020",
      withholdingOnSocialSecurity: false,
    });
    expect(
      openInvoices(books.invoices, books.entries, books.withholdingTaxes).map(
        (open) => {
          return open.invoice.id;
        },
      ),
    ).toContain(invoice.id);

    const edit = harness.app.machines.createInvoiceWizard(id);

    created.push(edit);
    expect(edit.state$.getValue().form).toMatchObject({
      date: "23/04/2013",
      dueDate: "23/05/2013",
      taxable: "2588.05",
    });
  });

  it("a new invoice is added through the write it is given, with its terms on the draft", async () => {
    const harness = createP36Harness();
    const drafts: EntryDraft[] = [];

    function write(draft: EntryDraft): Promise<ResultOf<EntryAdded>> {
      drafts.push(draft);

      return Promise.resolve(accepted({ id: "new1" }));
    }

    const machine = createInvoiceWizard(
      createAmountTexts(),
      currentBooks(harness),
      harness.ports.clock,
      write,
      null,
    );

    created.push(machine);
    machine.intents.edit({
      supplierId: "md81",
      number: "5",
      taxable: "100",
      nonTaxable: "",
    });

    expect(await machine.intents.save()).toEqual(accepted({ id: "new1" }));
    expect(drafts[0]).toMatchObject({
      kind: "invoice",
      invoice: { supplierId: "md81", nonTaxable: 0, dueDate: null },
    });
  });

  it("with no books: no choices, no date, and no supplier", () => {
    const machine = createInvoiceWizard(
      createAmountTexts(),
      null,
      fixedClock("2013-05-10T08:00:00Z"),
      () => {
        return Promise.resolve(accepted({ id: "never" }));
      },
      null,
    );

    created.push(machine);
    machine.intents.edit({ supplierId: "md78", taxable: "100" });

    expect(machine.state$.getValue()).toMatchObject({
      choices: [],
      form: { date: "", costAccountId: null, reason: "" },
      verdict: { ok: false, reason: "no-supplier" },
      summary: { duplicate: false, paid: 0 },
    });
  });
});

describe("editing an invoice", () => {
  it("a seeded paid invoice opens on its terms, its supplier locked, its payments' total shown", () => {
    const { machine, harness, invoice } = createPaidInvoiceEdit();
    const entry = currentEntry(harness, invoice.entryId);

    expect(machine.state$.getValue()).toMatchObject({
      editing: invoice.entryId,
      step: 1,
      form: {
        supplierId: "md76",
        number: "74",
        reason: invoice.reason,
        date: "01/04/2013",
        dueDate: "",
        costAccountId: "la174",
        taxable: "397.80",
        socialSecurityRate: "0",
        vatRate: "20",
        nonTaxable: "0.00",
        withholdingCode: "1040",
        withholdingOnSocialSecurity: false,
        description: entry.description,
        preset: "company",
      },
      verdict: { ok: true },
      summary: {
        supplierLocked: true,
        paid: 39780,
        duplicate: false,
      },
    });
  });

  it("the locked supplier does not change", () => {
    const { machine } = createPaidInvoiceEdit();

    machine.intents.edit({ supplierId: "md78" });

    expect(machine.state$.getValue().form).toMatchObject({
      supplierId: "md76",
      costAccountId: "la174",
    });
  });

  it("lowering Taxable until the amount due is below what was paid is below-paid", () => {
    const { machine } = createPaidInvoiceEdit();

    machine.intents.edit({ taxable: "397.79" });

    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: false, reason: "below-paid" },
      summary: { paid: 39780 },
    });
  });

  it("saving it rewrites the registration in place, with its invoice", async () => {
    const { machine, harness, invoice } = createPaidInvoiceEdit();
    const before = currentEntry(harness, invoice.entryId);
    const count = currentBooks(harness).entries.length;

    machine.intents.edit({ reason: "Amministrazione" });

    expect(await machine.intents.save()).toEqual(
      accepted({ id: invoice.entryId }),
    );
    expect(currentBooks(harness).entries).toHaveLength(count);
    expect(currentEntry(harness, invoice.entryId)).toMatchObject({
      number: before.number,
      at: before.at,
      kind: "invoice",
    });
    expect(
      currentBooks(harness).invoices.find((candidate) => {
        return candidate.id === invoice.id;
      }),
    ).toMatchObject({ reason: "Amministrazione", entryId: invoice.entryId });
  });

  it("an open invoice's supplier is not locked, and its edited fields are not prefilled over", () => {
    const harness = createP36Harness();
    const books = currentBooks(harness);
    const open = must(
      openInvoices(books.invoices, books.entries, books.withholdingTaxes).find(
        (candidate) => {
          return candidate.paid === 0;
        },
      ),
      "an unpaid invoice",
    );

    const machine = harness.app.machines.createInvoiceWizard(
      open.invoice.entryId,
    );

    created.push(machine);

    expect(machine.state$.getValue().summary).toMatchObject({
      supplierLocked: false,
      paid: 0,
    });

    machine.intents.edit({ supplierId: "md86" });

    expect(machine.state$.getValue().form).toMatchObject({
      supplierId: "md86",
      costAccountId: open.invoice.costAccountId,
      reason: open.invoice.reason,
      description: currentEntry(harness, open.invoice.entryId).description,
    });
  });

  it("an invoice's own number is no duplicate of itself", () => {
    const { machine } = createPaidInvoiceEdit();

    expect(machine.state$.getValue().summary.duplicate).toBe(false);
  });

  it("an entry with no invoice is not edited here", () => {
    const harness = createP36Harness();
    const entry = must(
      currentBooks(harness).entries.find((candidate) => {
        return candidate.invoiceId === null;
      }),
      "an entry with no invoice",
    );

    expect(() => {
      return createInvoiceWizard(
        createAmountTexts(),
        currentBooks(harness),
        harness.ports.clock,
        () => {
          return Promise.resolve(accepted({ id: "never" }));
        },
        entry,
      );
    }).toThrow();
  });
});

/** The harness on p36, with a wizard for a new invoice built through the application. */
describe("rates in the session's language", () => {
  it("in Italian, the VAT rate reads 21,5 and refuses 21.5", async () => {
    const { machine } = await createItalianStepTwo();

    machine.intents.edit({ vatRate: "21,5" });

    expect(machine.state$.getValue().verdict).toEqual({ ok: true });
    expect(machine.state$.getValue().summary.totals?.vat).toBe(21500);

    machine.intents.edit({ vatRate: "21.5" });

    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: false, reason: "not-a-rate" },
      summary: { totals: null },
    });
  });

  it("in Italian, the social security rate reads 4,5 and refuses 4.5", async () => {
    const { machine } = await createItalianStepTwo();

    machine.intents.edit({ socialSecurityRate: "4,5" });

    expect(machine.state$.getValue().verdict).toEqual({ ok: true });
    expect(machine.state$.getValue().summary.totals?.socialSecurity).toBe(4500);

    machine.intents.edit({ socialSecurityRate: "4.5" });

    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "not-a-rate",
    });
  });

  it("in Italian, a supplier's last rates are prefilled with a decimal comma", () => {
    const harness = createP36Harness();
    const books = currentBooks(harness);
    const machine = createInvoiceWizard(
      createAmountTexts("it-IT"),
      {
        ...books,
        invoices: books.invoices.map((invoice) => {
          return invoice.supplierId === "md78"
            ? {
                ...invoice,
                vatRate: rate(2150),
                socialSecurityRate: rate(450),
              }
            : invoice;
        }),
      },
      harness.ports.clock,
      () => {
        return Promise.resolve(accepted({ id: "never" }));
      },
      null,
    );

    created.push(machine);
    machine.intents.edit({ supplierId: "md78" });

    expect(machine.state$.getValue().form).toMatchObject({
      vatRate: "21,5",
      socialSecurityRate: "4,5",
    });
  });
});

/** The wizard on p36 in Italian, step 1 filled for md81, a taxable of 1.000,00 and no withholding. */
async function createItalianStepTwo(): Promise<CreatedWizard> {
  const harness = createP36Harness();

  await harness.app.presenters.session.setLanguage("it");

  const machine = harness.app.machines.createInvoiceWizard(null);

  created.push(machine);
  machine.intents.edit({ supplierId: "md81", number: "5" });
  machine.intents.edit({
    taxable: "1.000,00",
    withholdingCode: null,
    withholdingOnSocialSecurity: false,
  });

  return { machine, harness };
}

function createWizard(clock?: ClockPort): CreatedWizard {
  const harness = createP36Harness(clock);
  const machine = harness.app.machines.createInvoiceWizard(null);

  created.push(machine);

  return { machine, harness };
}

interface EditedInvoice extends CreatedWizard {
  invoice: Invoice;
}

/** The wizard editing li3: md76's invoice 74, paid in full. */
function createPaidInvoiceEdit(): EditedInvoice {
  const harness = createP36Harness();
  const invoice = must(
    currentBooks(harness).invoices.find((candidate) => {
      return candidate.id === "li3";
    }),
    "the invoice li3",
  );
  const machine = harness.app.machines.createInvoiceWizard(invoice.entryId);

  created.push(machine);

  return { machine, harness, invoice };
}

function createP36Harness(clock?: ClockPort): AppHarness {
  const harness = createAppHarness(undefined, clock);

  harness.app.presenters.buildings.selectPeriod("p36");

  return harness;
}

/** The pill after these edits, one after the other. */
function presetAfter(...patches: Partial<InvoiceForm>[]): InvoicePreset {
  const { machine } = createWizard();

  for (const patch of patches) {
    machine.intents.edit(patch);
  }

  return machine.state$.getValue().form.preset;
}

function supplierName(harness: AppHarness, id: string): string {
  return must(
    currentBooks(harness).parties.find((party) => {
      return party.id === id;
    }),
    `the supplier ${id}`,
  ).name;
}

function escaped(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const created: WizardMachine<InvoiceForm, InvoiceSummary>[] = [];

interface CreatedWizard {
  machine: WizardMachine<InvoiceForm, InvoiceSummary>;
  harness: AppHarness;
}
