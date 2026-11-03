import { describe, expect, it } from "vitest";

import { cents } from "#/entities/cents.ts";
import type { Installment, InstallmentItem } from "#/entities/installment.ts";
import { type Invoice, rate } from "#/entities/invoice.ts";
import type { JournalEntry } from "#/entities/journal.ts";

import { bookDeadlines, type PeriodBooks } from "./bookDeadlines.ts";

describe("bookDeadlines: installments", () => {
  it("closes an installment paid in full, with its total, paid and remaining", () => {
    const books = createBooks({
      items: [createItem("i1", "in1", 10000), createItem("i2", "in1", 5000)],
      entries: [
        createCollection("t1", "i1", 10000),
        createCollection("t2", "i2", 5000),
      ],
    });

    expect(bookDeadlines(books)).toEqual([
      {
        source: "installment",
        id: "installment:in1",
        date: "2026-03-10",
        time: null,
        calendar: "installments",
        buildingId: "c19",
        status: "closed",
        priority: "none",
        periodId: "p36",
        installmentId: "in1",
        installmentName: "Rata 1",
        installmentNumber: 1,
        total: 15000,
        paid: 15000,
        remaining: 0,
      },
    ]);
  });

  it("keeps an installment paid in part or not at all new", () => {
    const part = createBooks({
      items: [createItem("i1", "in1", 10000), createItem("i2", "in1", 5000)],
      entries: [createCollection("t1", "i1", 10000)],
    });
    const none = createBooks({ items: [createItem("i1", "in1", 10000)] });

    expect(bookDeadlines(part)[0]).toMatchObject({
      status: "new",
      total: 15000,
      paid: 10000,
      remaining: 5000,
    });
    expect(bookDeadlines(none)[0]).toMatchObject({
      status: "new",
      total: 10000,
      paid: 0,
      remaining: 10000,
    });
  });

  it("closes an installment whose items are all zero", () => {
    const books = createBooks({ items: [createItem("i1", "in1", 0)] });

    expect(bookDeadlines(books)[0]).toMatchObject({
      status: "closed",
      total: 0,
      remaining: 0,
    });
  });
});

describe("bookDeadlines: invoices", () => {
  it("closes an invoice its payments settle, its total what is due to the supplier", () => {
    const books = createBooks({
      installments: [],
      invoices: [createInvoice({ id: "li1", taxable: 30000 })],
      entries: [createPayment("t1", "li1", 30000)],
    });

    expect(bookDeadlines(books)).toEqual([
      {
        source: "invoice",
        id: "invoice:li1",
        date: "2026-04-01",
        time: null,
        calendar: "invoices",
        buildingId: "c19",
        status: "closed",
        priority: "none",
        periodId: "p36",
        invoiceId: "li1",
        supplierId: "md1",
        invoiceNumber: "7",
        invoiceDate: "2026-03-01",
        reason: "Pulizie",
        dueDateAssumed: false,
        total: 30000,
        paid: 30000,
        remaining: 0,
      },
    ]);
  });

  it("keeps an invoice paid in part new", () => {
    const books = createBooks({
      installments: [],
      invoices: [createInvoice({ id: "li1", taxable: 30000 })],
      entries: [createPayment("t1", "li1", 10000)],
    });

    expect(bookDeadlines(books)[0]).toMatchObject({
      status: "new",
      total: 30000,
      paid: 10000,
      remaining: 20000,
    });
  });

  it("takes the total net of the withholding, as the open invoices do", () => {
    const books = createBooks({
      installments: [],
      invoices: [
        createInvoice({ id: "li1", taxable: 10000, withholdingCode: "RA" }),
      ],
      withholdingTaxes: [
        {
          periodId: "p36",
          code: "RA",
          name: "Ritenuta",
          rate: rate(2000),
          accountId: "la167",
        },
      ],
    });

    expect(bookDeadlines(books)[0]).toMatchObject({ total: 8000 });
  });

  it("puts an invoice with no due date 30 days after its date, and says so", () => {
    const books = createBooks({
      installments: [],
      invoices: [
        createInvoice({ id: "a", dueDate: null, date: "2026-03-01" }),
        createInvoice({ id: "b", dueDate: null, date: "2026-01-15" }),
        createInvoice({ id: "c", dueDate: null, date: "2026-12-10" }),
      ],
    });
    const deadlines = bookDeadlines(books);

    expect(
      deadlines.map((deadline) => {
        return [
          deadline.date,
          deadline.source === "invoice" && deadline.dueDateAssumed,
        ];
      }),
    ).toEqual([
      ["2026-03-31", true],
      ["2026-02-14", true],
      ["2027-01-09", true],
    ]);
  });
});

function createBooks(parts: Partial<PeriodBooks>): PeriodBooks {
  return {
    buildingId: "c19",
    periodId: "p36",
    installments: [createInstallment()],
    items: [],
    entries: [],
    invoices: [],
    withholdingTaxes: [],
    ...parts,
  };
}

function createInstallment(): Installment {
  return {
    id: "in1",
    periodId: "p36",
    number: 1,
    name: "Rata 1",
    dueDate: "2026-03-10",
    locked: false,
  };
}

function createItem(
  id: string,
  installmentId: string,
  amount: number,
): InstallmentItem {
  return { id, installmentId, residentId: "rA", amount: cents(amount) };
}

function createCollection(
  id: string,
  itemId: string,
  credit: number,
): JournalEntry {
  return {
    id,
    periodId: "p36",
    number: 1,
    at: "2026-03-01T10:00:00",
    kind: "collection",
    description: "",
    invoiceId: null,
    postings: [
      {
        accountId: "owners",
        debit: cents(0),
        credit: cents(credit),
        counterpart: { kind: "owner", id: "rA" },
        installmentItemId: itemId,
      },
    ],
  };
}

function createPayment(
  id: string,
  invoiceId: string,
  amount: number,
): JournalEntry {
  return {
    id,
    periodId: "p36",
    number: 2,
    at: "2026-03-05T10:00:00",
    kind: "invoicePayment",
    description: "Pagamento",
    invoiceId,
    postings: [
      {
        accountId: "la157",
        debit: cents(amount),
        credit: cents(0),
        counterpart: { kind: "supplier", id: "md1" },
      },
      {
        accountId: "la156",
        debit: cents(0),
        credit: cents(amount),
        counterpart: null,
      },
    ],
  };
}

interface InvoiceParts {
  id: string;
  taxable?: number;
  date?: string;
  dueDate?: string | null;
  withholdingCode?: string | null;
}

function createInvoice(parts: InvoiceParts): Invoice {
  return {
    id: parts.id,
    periodId: "p36",
    entryId: `tx-${parts.id}`,
    supplierId: "md1",
    number: "7",
    reason: "Pulizie",
    date: parts.date ?? "2026-03-01",
    dueDate: parts.dueDate === undefined ? "2026-04-01" : parts.dueDate,
    costAccountId: "la21",
    taxable: cents(parts.taxable ?? 10000),
    socialSecurityRate: rate(0),
    vatRate: rate(0),
    nonTaxable: cents(0),
    withholdingCode: parts.withholdingCode ?? null,
    withholdingOnSocialSecurity: false,
  };
}
