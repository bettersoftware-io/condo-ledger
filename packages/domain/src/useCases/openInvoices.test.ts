import { describe, expect, it } from "vitest";

import { cents } from "../entities/cents.ts";
import {
  type Invoice,
  rate,
  type WithholdingTax,
} from "../entities/invoice.ts";
import type { EntryKind, JournalEntry, Posting } from "../entities/journal.ts";
import { openInvoices, paidOn } from "./openInvoices.ts";

describe("openInvoices", () => {
  it("leaves out an invoice its payments settle, tranche by tranche", () => {
    const invoice = createInvoice({ id: "li1", taxable: 300214 });
    const payments = [
      createPayment("tx1", "li1", 100000),
      createPayment("tx2", "li1", 100000),
      createPayment("tx3", "li1", 100214),
    ];

    expect(openInvoices([invoice], payments, [])).toEqual([]);
  });

  it("keeps an invoice partly paid, with what it still owes", () => {
    const invoice = createInvoice({ id: "li1", taxable: 300214 });
    const payments = [
      createPayment("tx1", "li1", 100000),
      createPayment("tx2", "li1", 100000),
    ];

    expect(openInvoices([invoice], payments, [])).toEqual([
      {
        invoice,
        totals: expect.objectContaining({ dueToSupplier: 300214 }) as unknown,
        paid: 200000,
        remaining: 100214,
      },
    ]);
  });

  it("orders by due date, an invoice with none last, then by date, then by number", () => {
    const invoices = [
      createInvoice({ id: "a", dueDate: null, date: "2013-01-01" }),
      createInvoice({ id: "b", dueDate: "2013-03-01", date: "2013-02-01" }),
      createInvoice({
        id: "c",
        dueDate: "2013-02-01",
        date: "2013-01-20",
        number: "10",
      }),
      createInvoice({
        id: "d",
        dueDate: "2013-02-01",
        date: "2013-01-20",
        number: "9",
      }),
      createInvoice({ id: "e", dueDate: "2013-02-01", date: "2013-01-10" }),
      createInvoice({ id: "f", dueDate: null, date: "2012-12-01" }),
    ];

    expect(
      openInvoices(invoices, [], []).map((open) => {
        return open.invoice.id;
      }),
    ).toEqual(["e", "d", "c", "b", "f", "a"]);
  });

  it("does not count a payment of another invoice", () => {
    const invoices = [
      createInvoice({ id: "li1", taxable: 50000 }),
      createInvoice({ id: "li2", taxable: 20000 }),
    ];

    expect(
      openInvoices(invoices, [createPayment("tx1", "li2", 20000)], []).map(
        (open) => {
          return [open.invoice.id, open.paid, open.remaining];
        },
      ),
    ).toEqual([["li1", 0, 50000]]);
  });

  it("takes the withholding rate from the catalogue of the invoice's period", () => {
    const invoice = createInvoice({
      id: "li1",
      taxable: 258805,
      vatRate: rate(2000),
      withholdingCode: "1019",
    });

    const catalogue = [
      createWithholding("p2", "1019", 2000),
      createWithholding("p1", "1019", 400),
    ];

    expect(openInvoices([invoice], [], catalogue)[0]?.remaining).toBe(300214);
  });

  it("refuses an invoice whose withholding code its period's catalogue does not have, naming it", () => {
    const invoice = createInvoice({ id: "li1", withholdingCode: "1019" });

    expect(() => {
      return openInvoices(
        [invoice],
        [],
        [createWithholding("p2", "1019", 400)],
      );
    }).toThrow("missing: the withholding tax 1019 of the period p1");
  });
});

describe("paidOn", () => {
  it("sums the suppliers-account debits of the payments that name the invoice, and no other debit", () => {
    const entries = [
      createPayment("tx1", "li1", 100000),
      createPayment("tx2", "li1", 2500),
      createPayment("tx3", "li2", 7000),
      createEntry("tx4", "generic", "li1", [
        createPosting("la157", 9900, 0, true),
        createPosting("la156", 0, 9900, false),
      ]),
      createEntry("tx5", "invoicePayment", "li1", [
        createPosting("la157", 5000, 0, true),
        createPosting("la40", 150, 0, false),
        createPosting("la156", 0, 5150, false),
      ]),
    ];

    expect(paidOn("li1", entries)).toBe(107500);
  });
});

/** What differs between the fixture's invoices. */
interface InvoiceParts {
  id: string;
  taxable?: number;
  vatRate?: Invoice["vatRate"];
  date?: string;
  dueDate?: string | null;
  number?: string;
  withholdingCode?: string | null;
}

function createInvoice(parts: InvoiceParts): Invoice {
  return {
    id: parts.id,
    periodId: "p1",
    entryId: `tx-${parts.id}`,
    supplierId: "md1",
    number: parts.number ?? "1",
    reason: "Pulizie",
    date: parts.date ?? "2013-01-01",
    dueDate: parts.dueDate === undefined ? "2013-02-01" : parts.dueDate,
    costAccountId: "la21",
    taxable: cents(parts.taxable ?? 10000),
    socialSecurityRate: rate(0),
    vatRate: parts.vatRate ?? rate(0),
    nonTaxable: cents(0),
    withholdingCode: parts.withholdingCode ?? null,
    withholdingOnSocialSecurity: false,
  };
}

function createWithholding(
  periodId: string,
  code: string,
  hundredths: number,
): WithholdingTax {
  return {
    periodId,
    code,
    name: "Società di persone",
    rate: rate(hundredths),
    accountId: "la167",
  };
}

function createPayment(
  id: string,
  invoiceId: string,
  amount: number,
): JournalEntry {
  return createEntry(id, "invoicePayment", invoiceId, [
    createPosting("la157", amount, 0, true),
    createPosting("la156", 0, amount, false),
  ]);
}

function createEntry(
  id: string,
  kind: EntryKind,
  invoiceId: string,
  postings: Posting[],
): JournalEntry {
  return {
    id,
    periodId: "p1",
    number: 1,
    at: "2013-03-01T10:00:00",
    kind,
    description: "Pagamento",
    postings,
    invoiceId,
  };
}

function createPosting(
  accountId: string,
  debit: number,
  credit: number,
  withSupplier: boolean,
): Posting {
  return {
    accountId,
    debit: cents(debit),
    credit: cents(credit),
    counterpart: withSupplier ? { kind: "supplier", id: "md1" } : null,
  };
}
