import { afterEach, describe, expect, it } from "vitest";

import {
  accepted,
  cents,
  type EntryAdded,
  type EntryDraft,
  type Invoice,
  openInvoices,
  type ResultOf,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import { amountText } from "#/amounts.ts";
import type { Books } from "#/presenters/booksPresenter.ts";
import { type AppHarness, createAppHarness } from "#/testing/appHarness.ts";
import { currentBooks, currentEntry } from "#/testing/harnessBooks.ts";

import { liquidityChoices } from "./choices.ts";
import {
  createInvoicePaymentWizard,
  type InvoicePaymentForm,
  type InvoicePaymentSummary,
  type OpenInvoiceRow,
} from "./invoicePaymentWizard.ts";
import type { WizardMachine } from "./wizard.ts";

afterEach(() => {
  for (const machine of created.splice(0)) {
    machine.dispose();
  }
});

describe("the Invoice payment wizard", () => {
  it("starts on step 1 of 3 with no invoice, the bank account chosen, and the eight open invoices by date", () => {
    const { machine, harness } = createWizard();
    const state = machine.state$.getValue();

    expect(state).toMatchObject({
      step: 1,
      firstStep: 1,
      stepCount: 3,
      editing: null,
      form: {
        invoiceId: null,
        accountId: "la156",
        amount: "",
        description: "",
        edited: [],
      },
      stepVerdict: { ok: false, reason: "no-invoice" },
      verdict: { ok: false, reason: "no-invoice" },
      summary: { remaining: null },
      preview: [],
    });
    expect(
      state.summary.open.map((row) => {
        return row.id;
      }),
    ).toEqual(["li19", "li20", "li21", "li49", "li50", "li36", "li23", "li22"]);

    const dates = state.summary.open.map((row) => {
      return row.date;
    });

    const li49: OpenInvoiceRow = {
      id: "li49",
      number: "2959",
      reason: invoiceOf(harness, "li49").reason,
      date: "2013-12-01",
      dueDate: null,
      supplier: supplierName(harness, "md78"),
      remaining: cents(37313),
      overdue: false,
    };

    expect(dates).toEqual([...dates].sort());
    expect(state.summary.open[3]).toEqual(li49);
  });

  it("offers the movable liquidity accounts, la154 and la156", () => {
    const { machine, harness } = createWizard();
    const liquidity = liquidityChoices(currentBooks(harness));

    expect(
      liquidity.map((choice) => {
        return choice.key;
      }),
    ).toEqual(["la154", "la156"]);
    expect(machine.state$.getValue().choices).toEqual(liquidity);
  });

  it("with no cash account, the liquidity accounts are those under the bank account's parent; with neither, none", () => {
    const books = currentBooks(harnessOnP36());

    expect(
      liquidityChoices(withoutRoles(books, ["cash"])).map((choice) => {
        return choice.key;
      }),
    ).toEqual(["la156"]);
    expect(liquidityChoices(withoutRoles(books, ["cash", "bank"]))).toEqual([]);
  });

  it("choosing an invoice prefills its remaining amount and the description Payment of invoice {number} — {supplier}", () => {
    const { machine, harness } = createWizard();

    machine.intents.edit({ invoiceId: "li49" });

    expect(machine.state$.getValue()).toMatchObject({
      form: {
        invoiceId: "li49",
        amount: "373.13",
        description: `Payment of invoice 2959 — ${supplierName(harness, "md78")}`,
        edited: ["invoiceId"],
      },
      summary: { remaining: 37313 },
      stepVerdict: { ok: true },
      verdict: { ok: true },
    });

    machine.intents.edit({ invoiceId: "li50" });

    expect(machine.state$.getValue()).toMatchObject({
      form: {
        amount: "63.80",
        description: `Payment of invoice 3163 — ${supplierName(harness, "md78")}`,
      },
      summary: { remaining: 6380 },
    });
  });

  it("an amount and a description the person typed stay when the invoice changes", () => {
    const { machine } = createWizard();

    machine.intents.edit({ invoiceId: "li49" });
    machine.intents.edit({ amount: "50", description: "Acconto" });
    machine.intents.edit({ invoiceId: "li50" });

    expect(machine.state$.getValue().form).toMatchObject({
      invoiceId: "li50",
      amount: "50",
      description: "Acconto",
      edited: ["invoiceId", "amount", "description"],
    });
  });

  it("step 1 is no-invoice until an open invoice is chosen; a settled one is no invoice, and owes nothing", () => {
    const { machine } = createWizard();

    machine.intents.next();
    expect(machine.state$.getValue().step).toBe(1);

    machine.intents.edit({ invoiceId: "li45" });
    expect(machine.state$.getValue()).toMatchObject({
      stepVerdict: { ok: false, reason: "no-invoice" },
      summary: { remaining: 0 },
    });

    machine.intents.edit({ invoiceId: "li-none" });
    expect(machine.state$.getValue().summary.remaining).toBeNull();

    machine.intents.edit({ invoiceId: "li49" });
    machine.intents.next();
    expect(machine.state$.getValue().step).toBe(2);
  });

  it("step 2 names the liquidity account, then the amount, then an amount one cent above the remaining one", () => {
    const { machine } = createWizard();

    machine.intents.edit({ invoiceId: "li49" });
    machine.intents.next();

    expect(stepReasonAfter(machine, { accountId: null })).toBe(
      "no-liquidity-account",
    );
    expect(stepReasonAfter(machine, { accountId: "la219" })).toBe(
      "no-liquidity-account",
    );
    expect(stepReasonAfter(machine, { accountId: "la154", amount: "x" })).toBe(
      "not-an-amount",
    );
    expect(stepReasonAfter(machine, { amount: "0" })).toBe("not-an-amount");
    expect(stepReasonAfter(machine, { amount: "-5" })).toBe("not-an-amount");
    expect(stepReasonAfter(machine, { amount: "373,13" })).toBe(
      "not-an-amount",
    );
    expect(stepReasonAfter(machine, { amount: "373.14" })).toBe(
      "over-remaining",
    );
    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "over-remaining",
    });
    expect(stepReasonAfter(machine, { amount: "373.13" })).toBeNull();
    expect(stepReasonAfter(machine, { amount: "0.01" })).toBeNull();
  });

  it("a blank description is step 3's: step 2 passes it and still sees an amount above the remaining one; step 3 and the save refuse it", async () => {
    const { machine } = createWizard();

    machine.intents.edit({ invoiceId: "li49", description: " " });
    machine.intents.next();

    expect(machine.state$.getValue().stepVerdict).toEqual({ ok: true });
    expect(stepReasonAfter(machine, { amount: "373.14" })).toBe(
      "over-remaining",
    );

    machine.intents.edit({ amount: "373.13" });
    machine.intents.next();

    expect(machine.state$.getValue()).toMatchObject({
      step: 3,
      stepVerdict: { ok: false, reason: "blank-description" },
    });
    expect(await machine.intents.save()).toEqual({
      ok: false,
      reason: "blank-description",
    });
  });

  it("previews the supplier debited on the suppliers account and the liquidity account credited", () => {
    const { machine, harness } = createWizard();

    machine.intents.edit({ invoiceId: "li49", accountId: "la154" });

    const preview = machine.state$.getValue().preview;

    expect(
      preview.map((line) => {
        return [line.debit, line.credit];
      }),
    ).toEqual([
      [37313, 0],
      [0, 37313],
    ]);
    expect(preview[0]?.path).toMatch(
      new RegExp(` › ${escaped(supplierName(harness, "md78"))}$`),
    );
    expect(preview[1]?.path).toMatch(/Cassa contanti$/);
  });

  it("paid in two tranches: the first leaves the rest open, the second settles it", async () => {
    const harness = harnessOnP36();
    const first = wizardOn(harness);

    first.intents.edit({ invoiceId: "li49", amount: "100" });

    const saved = await first.intents.save();

    expect(saved.ok).toBe(true);
    expect(currentEntry(harness, saved.ok ? saved.value.id : "")).toMatchObject(
      {
        kind: "invoicePayment",
        invoiceId: "li49",
        description: `Payment of invoice 2959 — ${supplierName(harness, "md78")}`,
        postings: [
          {
            accountId: "la157",
            debit: 10000,
            credit: 0,
            counterpart: { kind: "supplier", id: "md78" },
          },
          { accountId: "la156", debit: 0, credit: 10000, counterpart: null },
        ],
      },
    );

    const second = wizardOn(harness);

    expect(
      second.state$.getValue().summary.open.find((row) => {
        return row.id === "li49";
      })?.remaining,
    ).toBe(27313);

    second.intents.edit({ invoiceId: "li49" });
    expect(second.state$.getValue().form.amount).toBe("273.13");
    expect((await second.intents.save()).ok).toBe(true);

    const open = wizardOn(harness).state$.getValue().summary.open;

    expect(open).toHaveLength(7);
    expect(
      open.some((row) => {
        return row.id === "li49";
      }),
    ).toBe(false);
  });

  it("a remaining amount another payment made stale is refused by the port as over-remaining (Review Focus 3)", async () => {
    const harness = harnessOnP36();
    const machine = wizardOn(harness);

    machine.intents.edit({ invoiceId: "li49" });

    const elsewhere = await harness.ports.journal.addEntry("p36", {
      kind: "invoicePayment",
      description: "Paid elsewhere",
      invoiceId: "li49",
      postings: [
        {
          accountId: "la157",
          debit: cents(37313),
          credit: cents(0),
          counterpart: { kind: "supplier", id: "md78" },
        },
        {
          accountId: "la156",
          debit: cents(0),
          credit: cents(37313),
          counterpart: null,
        },
      ],
    });

    expect(elsewhere.ok).toBe(true);
    expect(await machine.intents.save()).toEqual({
      ok: false,
      reason: "over-remaining",
    });
    expect(machine.state$.getValue().saving).toBe(false);
    expect(machine.state$.getValue().summary.remaining).toBe(0);
  });

  it("after a refused save the remaining amount is what the invoice owes now, and the grid is the books as they stand", async () => {
    const harness = harnessOnP36();
    const machine = wizardOn(harness);

    machine.intents.edit({ invoiceId: "li49" });

    expect(machine.state$.getValue().summary.remaining).toBe(37313);

    const elsewhere = await harness.ports.journal.addEntry("p36", {
      kind: "invoicePayment",
      description: "Paid in part elsewhere",
      invoiceId: "li49",
      postings: [
        {
          accountId: "la157",
          debit: cents(10000),
          credit: cents(0),
          counterpart: { kind: "supplier", id: "md78" },
        },
        {
          accountId: "la156",
          debit: cents(0),
          credit: cents(10000),
          counterpart: null,
        },
      ],
    });

    expect(elsewhere.ok).toBe(true);
    expect(machine.state$.getValue().summary.remaining).toBe(37313);
    expect(await machine.intents.save()).toEqual({
      ok: false,
      reason: "over-remaining",
    });

    const state = machine.state$.getValue();

    expect(state.summary.remaining).toBe(27313);
    expect(
      state.summary.open.find((row) => {
        return row.id === "li49";
      })?.remaining,
    ).toBe(27313);
    expect(state.form.amount).toBe("373.13");
    expect(state.verdict).toEqual({ ok: false, reason: "over-remaining" });
  });

  it("a new payment is written through the write it is given, with its invoice on the draft", async () => {
    const harness = harnessOnP36();
    const drafts: EntryDraft[] = [];

    function write(draft: EntryDraft): Promise<ResultOf<EntryAdded>> {
      drafts.push(draft);

      return Promise.resolve(accepted({ id: "new1" }));
    }

    const machine = createInvoicePaymentWizard(
      currentBooks(harness),
      harness.ports.clock,
      write,
      null,
    );

    created.push(machine);
    machine.intents.edit({ invoiceId: "li19" });

    expect(await machine.intents.save()).toEqual(accepted({ id: "new1" }));
    expect(drafts[0]).toMatchObject({
      kind: "invoicePayment",
      invoiceId: "li19",
      postings: [{ debit: 71918 }, { credit: 71918 }],
    });
  });

  it("an invoice due before today is overdue; one due today, later or never is not", () => {
    const harness = harnessOnP36();
    const books = currentBooks(harness);
    const li19 = invoiceOf(harness, "li19");
    const machine = createInvoicePaymentWizard(
      {
        ...books,
        invoices: [
          ...books.invoices,
          createInvoice(li19, "li901", "2026-10-13"),
          createInvoice(li19, "li902", "2026-10-14"),
          createInvoice(li19, "li903", "2027-01-01"),
        ],
      },
      harness.ports.clock,
      neverWrite,
      null,
    );

    created.push(machine);

    const rows = machine.state$.getValue().summary.open;

    expect(
      rows.slice(0, 4).map((row) => {
        return [row.id, row.dueDate, row.overdue];
      }),
    ).toEqual([
      ["li901", "2026-10-13", true],
      ["li902", "2026-10-14", false],
      ["li903", "2027-01-01", false],
      ["li19", null, false],
    ]);
  });

  it("with no suppliers account, a chosen invoice is refused for it", () => {
    const harness = harnessOnP36();
    const machine = createInvoicePaymentWizard(
      withoutRoles(currentBooks(harness), ["suppliers"]),
      harness.ports.clock,
      neverWrite,
      null,
    );

    created.push(machine);
    machine.intents.edit({ invoiceId: "li49" });

    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: false, reason: "no-suppliers-account" },
      preview: [],
    });
  });

  it("with no books: no choices, no invoices, no account", () => {
    const harness = harnessOnP36();
    const machine = createInvoicePaymentWizard(
      null,
      harness.ports.clock,
      neverWrite,
      null,
    );

    created.push(machine);
    machine.intents.edit({ invoiceId: "li49" });

    expect(machine.state$.getValue()).toMatchObject({
      choices: [],
      form: { accountId: null, amount: "", description: "" },
      verdict: { ok: false, reason: "no-invoice" },
      summary: { open: [], remaining: null },
    });
  });
});

describe("editing an invoice payment", () => {
  it("a seeded payment opens at step 2 on its invoice, its amount, its account and its description", () => {
    const { machine, harness } = editPayment();
    const entry = currentEntry(harness, "tx198");

    expect(machine.state$.getValue()).toMatchObject({
      step: 2,
      firstStep: 2,
      editing: "tx198",
      form: {
        invoiceId: "li45",
        accountId: "la156",
        amount: "348.17",
        description: entry.description,
      },
      verdict: { ok: true },
      stepVerdict: { ok: true },
    });

    machine.intents.back();

    expect(machine.state$.getValue().step).toBe(2);
  });

  it("the amount may rise to the invoice's remaining amount plus its own, and no further", () => {
    const { machine, harness } = editPayment();
    const books = currentBooks(harness);
    const left =
      openInvoices(books.invoices, books.entries, books.withholdingTaxes).find(
        (open) => {
          return open.invoice.id === "li45";
        },
      )?.remaining ?? 0;
    const most = left + 34817;

    expect(machine.state$.getValue().summary.remaining).toBe(most);
    expect(stepReasonAfter(machine, { amount: amountText(cents(most)) })).toBe(
      null,
    );
    expect(
      stepReasonAfter(machine, { amount: amountText(cents(most + 1)) }),
    ).toBe("over-remaining");
  });

  it("its invoice does not change, nor do the amount and the description follow it", () => {
    const { machine } = editPayment();

    machine.intents.edit({ invoiceId: "li49" });

    expect(machine.state$.getValue().form).toMatchObject({
      invoiceId: "li45",
      amount: "348.17",
    });
  });

  it("saving rewrites the payment in place, and the invoice owes the difference", async () => {
    const { machine, harness } = editPayment();
    const before = currentEntry(harness, "tx198");

    machine.intents.edit({ amount: "300", accountId: "la154" });

    expect(await machine.intents.save()).toEqual(accepted({ id: "tx198" }));
    expect(currentEntry(harness, "tx198")).toMatchObject({
      number: before.number,
      at: before.at,
      kind: "invoicePayment",
      invoiceId: "li45",
      postings: [
        { accountId: "la157", debit: 30000 },
        { accountId: "la154", credit: 30000 },
      ],
    });

    const books = currentBooks(harness);

    expect(
      openInvoices(books.invoices, books.entries, books.withholdingTaxes).find(
        (open) => {
          return open.invoice.id === "li45";
        },
      )?.remaining,
    ).toBe(4817);
  });

  it("an entry with no invoice is not edited here", () => {
    const harness = harnessOnP36();
    const entry = must(
      currentBooks(harness).entries.find((candidate) => {
        return candidate.invoiceId === null;
      }),
      "an entry with no invoice",
    );

    expect(() => {
      return createInvoicePaymentWizard(
        currentBooks(harness),
        harness.ports.clock,
        neverWrite,
        entry,
      );
    }).toThrow();
  });
});

interface CreatedWizard {
  machine: WizardMachine<InvoicePaymentForm, InvoicePaymentSummary>;
  harness: AppHarness;
}

/** The harness on p36, with a wizard for a new payment built through the application. */
function createWizard(): CreatedWizard {
  const harness = harnessOnP36();

  return { machine: wizardOn(harness), harness };
}

/** The wizard editing tx198: the bank's payment of md78's invoice li45. */
function editPayment(): CreatedWizard {
  const harness = harnessOnP36();
  const machine = harness.app.machines.createInvoicePaymentWizard("tx198");

  created.push(machine);

  return { machine, harness };
}

/** A new payment's wizard over the books as they stand now. */
function wizardOn(
  harness: AppHarness,
): WizardMachine<InvoicePaymentForm, InvoicePaymentSummary> {
  const machine = harness.app.machines.createInvoicePaymentWizard(null);

  created.push(machine);

  return machine;
}

function harnessOnP36(): AppHarness {
  const harness = createAppHarness();

  harness.app.presenters.buildings.selectPeriod("p36");

  return harness;
}

/** The current step's reason after the patch; null when it passes. */
function stepReasonAfter(
  machine: WizardMachine<InvoicePaymentForm, InvoicePaymentSummary>,
  patch: Partial<InvoicePaymentForm>,
): string | null {
  machine.intents.edit(patch);

  const verdict = machine.state$.getValue().stepVerdict;

  return verdict.ok ? null : verdict.reason;
}

/** A copy of the invoice with its own id and a due date. */
function createInvoice(source: Invoice, id: string, dueDate: string): Invoice {
  return { ...source, id, dueDate };
}

/** The books with no account playing these roles. */
function withoutRoles(books: Books, roles: string[]): Books {
  return {
    ...books,
    accounts: books.accounts.map((account) => {
      return account.role !== null && roles.includes(account.role)
        ? { ...account, role: null }
        : account;
    }),
  };
}

function invoiceOf(harness: AppHarness, id: string): Invoice {
  return must(
    currentBooks(harness).invoices.find((invoice) => {
      return invoice.id === id;
    }),
    `the invoice ${id}`,
  );
}

function supplierName(harness: AppHarness, id: string): string {
  return must(
    currentBooks(harness).parties.find((party) => {
      return party.id === id;
    }),
    `the supplier ${id}`,
  ).name;
}

function neverWrite(): Promise<ResultOf<EntryAdded>> {
  return Promise.resolve(accepted({ id: "never" }));
}

function escaped(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const created: WizardMachine<InvoicePaymentForm, InvoicePaymentSummary>[] = [];
