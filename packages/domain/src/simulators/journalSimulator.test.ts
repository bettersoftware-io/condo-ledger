import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import { cents } from "#/entities/cents.ts";
import { type InvoiceTerms, rate } from "#/entities/invoice.ts";
import type { EntryDraft, Posting } from "#/entities/journal.ts";
import type { ClockPort } from "#/ports/clockPort.ts";

import { createTwoPeriodSeed } from "../testing/createTwoPeriodSeed.ts";
import { fixedClock } from "./fixedClock.ts";
import { createJournalSimulator } from "./journalSimulator.ts";

describe("journal simulator", () => {
  it("answers a period's entries in number order, however the seed holds them", async () => {
    const seed = createTwoPeriodSeed();
    const held = seed.entries
      .filter((entry) => {
        return entry.periodId === "p1";
      })
      .map((entry) => {
        return entry.number;
      });

    const answered = (
      await firstValueFrom(
        createJournalSimulator(seed, createClock()).entries("p1"),
      )
    ).map((entry) => {
      return entry.number;
    });

    expect(held).not.toEqual(answered);
    expect(answered).toEqual(
      [...held].sort((a, b) => {
        return a - b;
      }),
    );
  });

  it("leaves another period's entries out", async () => {
    const entries = await firstValueFrom(
      createJournalSimulator(createTwoPeriodSeed(), createClock()).entries(
        "p1",
      ),
    );

    expect(
      entries.some((entry) => {
        return entry.id === "x-e1";
      }),
    ).toBe(false);
  });

  it("stamps a new entry with the clock, on the Rome wall clock", async () => {
    const port = createJournalSimulator(
      createTwoPeriodSeed(),
      fixedClock("2013-07-01T15:05:51Z"),
    );

    const result = await port.addEntry("p1", createDraft());
    const entries = await firstValueFrom(port.entries("p1"));

    expect(result).toEqual({ ok: true, value: { id: "new1" } });
    expect(entries.at(-1)).toMatchObject({
      id: "new1",
      number: 10,
      at: "2013-07-01T17:05:51",
      invoiceId: null,
    });
  });

  it("writes a registration's invoice with it: newInv<n>, the period, the entry, the terms", async () => {
    const port = createJournalSimulator(createTwoPeriodSeed(), createClock());

    const result = await port.addEntry("p1", createInvoiceDraft(createTerms()));
    const invoices = await firstValueFrom(port.invoices("p1"));

    expect(result).toEqual({ ok: true, value: { id: "new1" } });
    expect(invoices).toEqual([
      { ...createTerms(), id: "newInv1", periodId: "p1", entryId: "new1" },
    ]);
    expect((await firstValueFrom(port.entries("p1"))).at(-1)?.invoiceId).toBe(
      "newInv1",
    );
    expect(await firstValueFrom(port.invoices("p2"))).toEqual([]);
  });

  it("keeps the invoice a payment names on the entry it writes", async () => {
    const port = createJournalSimulator(createTwoPeriodSeed(), createClock());

    await port.addEntry("p1", createInvoiceDraft(createTerms()));
    await port.addEntry("p1", createPaymentDraft("newInv1", 4000));

    expect((await firstValueFrom(port.entries("p1"))).at(-1)).toMatchObject({
      id: "new2",
      kind: "invoicePayment",
      invoiceId: "newInv1",
    });
  });

  it("judges a registration against the period's parties: a supplier it does not have is refused", async () => {
    const port = createJournalSimulator(createTwoPeriodSeed(), createClock());

    expect(
      await port.addEntry(
        "p1",
        createInvoiceDraft({ ...createTerms(), supplierId: "md9" }),
      ),
    ).toEqual({ ok: false, reason: "unknown-supplier" });
    expect(await firstValueFrom(port.invoices("p1"))).toEqual([]);
  });

  it("rewrites a registration's terms with its lines, keeping the invoice's id and entry", async () => {
    const port = createJournalSimulator(createTwoPeriodSeed(), createClock());
    const terms = {
      ...createTerms(),
      taxable: cents(20000),
      reason: "Pulizie",
    };
    const seen: number[] = [];

    await port.addEntry("p1", createInvoiceDraft(createTerms()));
    port.invoices("p1").subscribe((invoices) => {
      seen.push(invoices.length);
    });

    expect(await port.replaceEntry("new1", createInvoiceDraft(terms))).toEqual({
      ok: true,
    });
    expect(await firstValueFrom(port.invoices("p1"))).toEqual([
      { ...terms, id: "newInv1", periodId: "p1", entryId: "new1" },
    ]);
    expect((await firstValueFrom(port.entries("p1"))).at(-1)).toMatchObject({
      id: "new1",
      invoiceId: "newInv1",
      postings: createInvoiceDraft(terms).postings,
    });
    expect(seen).toEqual([1, 1]);
  });

  it("rewrites a payment with the invoice its draft names", async () => {
    const port = createJournalSimulator(createTwoPeriodSeed(), createClock());

    await port.addEntry("p1", createInvoiceDraft(createTerms()));
    await port.addEntry("p1", createInvoiceDraft(createTerms()));
    await port.addEntry("p1", createPaymentDraft("newInv1", 4000));

    expect(
      await port.replaceEntry("new3", createPaymentDraft("newInv2", 10000)),
    ).toEqual({ ok: true });
    expect((await firstValueFrom(port.entries("p1"))).at(-1)).toMatchObject({
      id: "new3",
      invoiceId: "newInv2",
    });
  });

  it("judges a replacement without the entry it replaces: a payment may grow to what the invoice owed before it", async () => {
    const port = createJournalSimulator(createTwoPeriodSeed(), createClock());

    await port.addEntry("p1", createInvoiceDraft(createTerms()));
    await port.addEntry("p1", createPaymentDraft("newInv1", 4000));

    expect(
      await port.replaceEntry("new2", createPaymentDraft("newInv1", 10001)),
    ).toEqual({ ok: false, reason: "over-remaining" });
    expect(
      await port.replaceEntry("new2", createPaymentDraft("newInv1", 10000)),
    ).toEqual({ ok: true });
  });

  it("refuses a second opening entry in the period, and accepts the edit of the first", async () => {
    const port = createJournalSimulator(createTwoPeriodSeed(), createClock());

    expect(await port.addEntry("p1", createOpeningDraft(500))).toEqual({
      ok: true,
      value: { id: "new1" },
    });
    expect(await port.addEntry("p1", createOpeningDraft(700))).toEqual({
      ok: false,
      reason: "opening-exists",
    });
    expect(await port.replaceEntry("new1", createOpeningDraft(700))).toEqual({
      ok: true,
    });
  });

  it("deleting a registration removes its invoice, and no other", async () => {
    const port = createJournalSimulator(createTwoPeriodSeed(), createClock());

    await port.addEntry("p1", createInvoiceDraft(createTerms()));
    await port.addEntry("p1", createInvoiceDraft(createTerms()));

    expect(await port.deleteEntry("new1")).toEqual({ ok: true });
    expect(
      (await firstValueFrom(port.invoices("p1"))).map((invoice) => {
        return invoice.id;
      }),
    ).toEqual(["newInv2"]);
  });

  it("deleting an entry that is no registration leaves the invoices as they were", async () => {
    const port = createJournalSimulator(createTwoPeriodSeed(), createClock());

    await port.addEntry("p1", createInvoiceDraft(createTerms()));
    await port.addEntry("p1", createPaymentDraft("newInv1", 4000));
    const before = await firstValueFrom(port.invoices("p1"));

    expect(await port.deleteEntry("new2")).toEqual({ ok: true });
    expect(await firstValueFrom(port.invoices("p1"))).toBe(before);
  });

  it("numbers from 1 in a period whose entries carry no positive number", async () => {
    const port = createJournalSimulator(
      createTwoPeriodSeed(),
      fixedClock("2026-01-01T00:00:00Z"),
    );

    await port.addEntry("p2", {
      ...createDraft(),
      postings: [createLine("x1", 100, 0), createLine("x4", 0, 100, "md1")],
    });

    expect(
      (await firstValueFrom(port.entries("p2"))).map((entry) => {
        return entry.number;
      }),
    ).toEqual([0, 1]);
  });

  it("two deletes renumber twice: the last entry ends two numbers lower", async () => {
    const port = createJournalSimulator(createTwoPeriodSeed(), createClock());

    await port.deleteEntry("e6");
    await port.deleteEntry("e8");

    const numbers = (await firstValueFrom(port.entries("p1"))).map((entry) => {
      return [entry.id, entry.number];
    });

    expect(numbers).toEqual([
      ["e1", 1],
      ["e2", 2],
      ["e3", 3],
      ["e4", 4],
      ["e5", 5],
      ["e7", 6],
      ["e9", 7],
    ]);
  });
});

function createDraft(): EntryDraft {
  return {
    kind: "generic",
    description: "Spesa in contanti",
    postings: [createLine("la21", 1200, 0), createLine("la1", 0, 1200)],
  };
}

function createLine(
  accountId: string,
  debit: number,
  credit: number,
  supplierId?: string,
): Posting {
  return {
    accountId,
    debit: cents(debit),
    credit: cents(credit),
    counterpart:
      supplierId === undefined ? null : { kind: "supplier", id: supplierId },
  };
}

/** Supplier md1's invoice for the lift: taxable 100.00, VAT 20%, 20% withheld on la7. */
function createTerms(): InvoiceTerms {
  return {
    supplierId: "md1",
    number: "7",
    reason: "Ascensore",
    date: "2013-04-23",
    dueDate: null,
    costAccountId: "la21",
    taxable: cents(10000),
    socialSecurityRate: rate(0),
    vatRate: rate(2000),
    nonTaxable: cents(0),
    withholdingCode: "1040",
    withholdingOnSocialSecurity: false,
  };
}

/** A registration of the terms: the cost takes the gross, the supplier 5/6 of it and la7 the rest (20% of the taxable, 1/6 of the gross). */
function createInvoiceDraft(terms: InvoiceTerms): EntryDraft {
  const total = (terms.taxable * 6) / 5;
  const withheld = terms.taxable / 5;

  return {
    kind: "invoice",
    description: `Invoice ${terms.number}`,
    postings: [
      createLine(terms.costAccountId, total, 0),
      createLine("la4", 0, total - withheld, terms.supplierId),
      createLine("la7", 0, withheld),
    ],
    invoice: terms,
  };
}

function createPaymentDraft(invoiceId: string, amount: number): EntryDraft {
  return {
    kind: "invoicePayment",
    description: "Payment",
    postings: [
      createLine("la4", amount, 0, "md1"),
      createLine("la2", 0, amount),
    ],
    invoiceId,
  };
}

function createOpeningDraft(amount: number): EntryDraft {
  return {
    kind: "openingBalances",
    description: "Opening balances",
    postings: [createLine("la2", amount, 0), createLine("la3", 0, amount)],
  };
}

function createClock(): ClockPort {
  return fixedClock("2026-10-14T08:00:00Z");
}
