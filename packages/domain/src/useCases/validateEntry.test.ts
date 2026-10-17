import { describe, expect, it } from "vitest";

import type { Account } from "../entities/account.ts";
import { cents } from "../entities/cents.ts";
import {
  type Invoice,
  type InvoiceTerms,
  rate,
  type WithholdingTax,
} from "../entities/invoice.ts";
import type {
  EntryDraft,
  EntryKind,
  JournalEntry,
  Posting,
} from "../entities/journal.ts";
import type { ResultOf } from "../entities/result.ts";
import { createSmallBooks } from "../testing/createSmallBooks.ts";
import { invoicePostings } from "./invoice.ts";
import { type EntryContext, validateEntry } from "./validateEntry.ts";

describe("validateEntry", () => {
  it("accepts a balanced draft on leaves, with a party on a control account", () => {
    expect(
      validateEntry(
        createDraft([
          createLine("la21", 1000, 0),
          createLine("la4", 0, 1000, "md1"),
        ]),
        createContext(),
      ),
    ).toEqual({ ok: true });
  });

  it.each([
    [
      "blank-description",
      createDraft(
        [createLine("la21", 1000, 0), createLine("la1", 0, 1000)],
        "  ",
      ),
    ],
    ["no-postings", createDraft([])],
    [
      "unknown-account",
      createDraft([createLine("la99", 1000, 0), createLine("la1", 0, 1000)]),
    ],
    [
      "not-a-leaf",
      createDraft([createLine("la20", 1000, 0), createLine("la1", 0, 1000)]),
    ],
    [
      "empty-line",
      createDraft([createLine("la21", 0, 0), createLine("la1", 0, 0)]),
    ],
    ["both-sides", createDraft([createLine("la21", 1000, 1000)])],
    [
      "negative",
      createDraft([createLine("la21", -1000, 0), createLine("la1", 0, -1000)]),
    ],
    [
      "counterpart-required",
      createDraft([createLine("la21", 1000, 0), createLine("la4", 0, 1000)]),
    ],
    [
      "counterpart-not-allowed",
      createDraft([
        createLine("la21", 1000, 0, "md1"),
        createLine("la1", 0, 1000),
      ]),
    ],
    [
      "unbalanced",
      createDraft([createLine("la21", 1000, 0), createLine("la1", 0, 900)]),
    ],
  ])("refuses %s", (reason, candidate) => {
    expect(validateEntry(candidate, createContext())).toEqual({
      ok: false,
      reason,
    });
  });

  it("checks the reasons in the spec's order: a blank description on an unbalanced draft is blank-description", () => {
    expect(
      validateEntry(
        createDraft([createLine("la21", 1000, 0)], ""),
        createContext(),
      ),
    ).toEqual({ ok: false, reason: "blank-description" });
  });

  it("an owner residency on the owners control account is a counterpart too", () => {
    expect(
      validateEntry(
        createDraft([
          createLine("la1", 500, 0),
          createOwnerLine("la5", 0, 500, "r3"),
        ]),
        createContext(),
      ),
    ).toEqual({ ok: true });
  });

  describe("invoices, payments and the opening", () => {
    it("accepts a registration whose postings are its terms' postings", () => {
      expect(
        validateEntry(createRegistration(createTerms()), createContext()),
      ).toEqual({ ok: true });
    });

    it("accepts a payment of what the invoice still owes", () => {
      expect(
        validateEntry(createPaymentDraft("li1", 6000), createContext()),
      ).toEqual({ ok: true });
    });

    it("refuses invoice-required: a registration without terms", () => {
      const { kind, description, postings } = createRegistration(createTerms());

      expect(
        validateEntry({ kind, description, postings }, createContext()),
      ).toEqual({ ok: false, reason: "invoice-required" });
    });

    it("refuses invoice-required: a payment that names no invoice", () => {
      const { kind, description, postings } = createPaymentDraft("li1", 6000);

      expect(
        validateEntry({ kind, description, postings }, createContext()),
      ).toEqual({ ok: false, reason: "invoice-required" });
    });

    it("refuses invoice-not-allowed: terms or an invoice on a kind that takes neither", () => {
      const generic = createDraft([
        createLine("la21", 1000, 0),
        createLine("la1", 0, 1000),
      ]);

      expect(
        validateEntry({ ...generic, invoiceId: "li1" }, createContext()),
      ).toEqual({ ok: false, reason: "invoice-not-allowed" });
      expect(
        validateEntry({ ...generic, invoice: createTerms() }, createContext()),
      ).toEqual({ ok: false, reason: "invoice-not-allowed" });
      expect(
        validateEntry(
          { ...createPaymentDraft("li1", 6000), invoice: createTerms() },
          createContext(),
        ),
      ).toEqual({ ok: false, reason: "invoice-not-allowed" });
      expect(
        validateEntry(
          { ...createRegistration(createTerms()), invoiceId: "li1" },
          createContext(),
        ),
      ).toEqual({ ok: false, reason: "invoice-not-allowed" });
    });

    it("refuses unknown-supplier: terms naming a supplier the period does not have", () => {
      expect(
        validateEntry(
          createRegistration(createTerms({ supplierId: "md9" })),
          createContext(),
        ),
      ).toEqual({ ok: false, reason: "unknown-supplier" });
    });

    it("refuses unknown-supplier: a resident is no supplier", () => {
      expect(
        validateEntry(
          {
            ...createRegistration(createTerms()),
            invoice: createTerms({ supplierId: "r1" }),
          },
          createContext(),
        ),
      ).toEqual({ ok: false, reason: "unknown-supplier" });
    });

    it("refuses unknown-withholding: a code the period's catalogue does not have", () => {
      expect(
        validateEntry(
          {
            ...createRegistration(createTerms()),
            invoice: createTerms({ withholdingCode: "9999" }),
          },
          createContext(),
        ),
      ).toEqual({ ok: false, reason: "unknown-withholding" });
    });

    it("refuses postings-disagree: the cost debited one cent less than the terms imply", () => {
      expect(
        validateEntry(
          {
            ...createRegistration(createTerms()),
            postings: [
              createLine("la21", 11999, 0),
              createLine("la4", 0, 9999, "md1"),
              createLine("la7", 0, 2000),
            ],
          },
          createContext(),
        ),
      ).toEqual({ ok: false, reason: "postings-disagree" });
    });

    it("refuses postings-disagree: terms on a cost account the period does not have", () => {
      expect(
        validateEntry(
          {
            ...createRegistration(createTerms()),
            invoice: createTerms({ costAccountId: "la99" }),
          },
          createContext(),
        ),
      ).toEqual({ ok: false, reason: "postings-disagree" });
    });

    it("refuses unknown-invoice: a payment of an invoice the period does not have", () => {
      expect(
        validateEntry(createPaymentDraft("li99", 100), createContext()),
      ).toEqual({ ok: false, reason: "unknown-invoice" });
    });

    it("refuses wrong-supplier: a payment debiting another supplier than the invoice's", () => {
      expect(
        validateEntry(createPaymentDraft("li1", 100, "md2"), createContext()),
      ).toEqual({ ok: false, reason: "wrong-supplier" });
    });

    it("refuses wrong-supplier: a payment debiting no supplier at all", () => {
      expect(
        validateEntry(
          {
            ...createPaymentDraft("li1", 100),
            postings: [createLine("la21", 100, 0), createLine("la2", 0, 100)],
          },
          createContext(),
        ),
      ).toEqual({ ok: false, reason: "wrong-supplier" });
    });

    it("a payment of an invoice with nothing withheld may pay its whole total", () => {
      expect(
        validateEntry(createPaymentDraft("li2", 12000), createContext()),
      ).toEqual({ ok: true });
      expect(
        validateEntry(createPaymentDraft("li2", 12001), createContext()),
      ).toEqual({ ok: false, reason: "over-remaining" });
    });

    it("refuses over-remaining on an add: one cent above what the invoice still owes", () => {
      expect(
        validateEntry(createPaymentDraft("li1", 6001), createContext()),
      ).toEqual({ ok: false, reason: "over-remaining" });
    });

    it("refuses over-remaining on an edit, where the payment's own amount is added back", () => {
      expect(
        validateEntry(
          createPaymentDraft("li1", 10000),
          createContext({ replacing: "pay1" }),
        ),
      ).toEqual({ ok: true });
      expect(
        validateEntry(
          createPaymentDraft("li1", 10001),
          createContext({ replacing: "pay1" }),
        ),
      ).toEqual({ ok: false, reason: "over-remaining" });
      expect(
        validateEntry(createPaymentDraft("li1", 10000), createContext()),
      ).toEqual({ ok: false, reason: "over-remaining" });
    });

    it("refuses supplier-has-payments: an edit of a paid registration that changes the supplier", () => {
      expect(
        validateEntry(
          createRegistration(createTerms({ supplierId: "md2" })),
          createContext({ replacing: "inv1" }),
        ),
      ).toEqual({ ok: false, reason: "supplier-has-payments" });
    });

    it("accepts a change of supplier on a registration no payment names", () => {
      expect(
        validateEntry(
          createRegistration(createTerms({ supplierId: "md2" })),
          createContext({ replacing: "inv1", withoutPayment: true }),
        ),
      ).toEqual({ ok: true });
    });

    it("refuses below-paid: an edit of a registration that now owes less than its payments paid", () => {
      expect(
        validateEntry(
          createRegistration(createTerms({ taxable: cents(3999) })),
          createContext({ replacing: "inv1" }),
        ),
      ).toEqual({ ok: false, reason: "below-paid" });
      expect(
        validateEntry(
          createRegistration(createTerms({ taxable: cents(4000) })),
          createContext({ replacing: "inv1" }),
        ),
      ).toEqual({ ok: true });
    });

    it("refuses opening-exists on an add, and accepts the edit of that same opening", () => {
      const opening: EntryDraft = {
        kind: "openingBalances",
        description: "Opening balances",
        postings: [
          createLine("la2", 5000, 0),
          createOwnerLine("la5", 0, 5000, "r1"),
        ],
      };

      expect(validateEntry(opening, createContext())).toEqual({
        ok: false,
        reason: "opening-exists",
      });
      expect(
        validateEntry(opening, createContext({ replacing: "op1" })),
      ).toEqual({ ok: true });
      expect(
        validateEntry(opening, createContext({ withoutOpening: true })),
      ).toEqual({ ok: true });
    });

    it("keeps M2a's reasons first: a blank description on a payment of an unknown invoice is blank-description", () => {
      expect(
        validateEntry(
          { ...createPaymentDraft("li99", 100), description: " " },
          createContext(),
        ),
      ).toEqual({ ok: false, reason: "blank-description" });
    });
  });
});

/** What a test changes in the context: the entry an edit rewrites, and what the period leaves out. */
interface ContextParts {
  replacing?: string;
  withoutPayment?: boolean;
  withoutOpening?: boolean;
}

/**
 * The small books with a tax leaf (la7) withholding code 1040 at 20%; the
 * invoice li1 of supplier md1 (taxable 100.00, VAT 20%, 20% withheld: it owes
 * the supplier 100.00), registered by inv1 and paid 40.00 by pay1; the
 * invoice li2, the same with nothing withheld (owing 120.00), whose
 * registration the context leaves out; and an opening entry, op1.
 */
function createContext(parts: ContextParts = {}): EntryContext {
  const small = createSmallBooks();
  const accounts = [...small.accounts, createTaxLeaf()];
  const withholdingTaxes = [createWithholding()];
  const terms = createTerms();
  const invoice: Invoice = {
    ...terms,
    id: "li1",
    periodId: "p1",
    entryId: "inv1",
  };

  const registration = createEntry(
    "inv1",
    "invoice",
    "li1",
    postingsOf(invoicePostings(terms, withholdingTaxes, accounts)),
  );

  const payment = createEntry("pay1", "invoicePayment", "li1", [
    createLine("la4", 4000, 0, "md1"),
    createLine("la2", 0, 4000),
  ]);

  const opening = createEntry("op1", "openingBalances", null, [
    createLine("la2", 1000, 0),
    createOwnerLine("la5", 0, 1000, "r1"),
  ]);

  return {
    accounts,
    parties: small.parties,
    withholdingTaxes,
    invoices: [
      invoice,
      {
        ...createTerms({ number: "8", withholdingCode: null }),
        id: "li2",
        periodId: "p1",
        entryId: "inv2",
      },
    ],
    entries: [
      ...small.entries,
      registration,
      ...(parts.withoutPayment === true ? [] : [payment]),
      ...(parts.withoutOpening === true ? [] : [opening]),
    ],
    replacing: parts.replacing ?? null,
  };
}

function createTerms(changes: Partial<InvoiceTerms> = {}): InvoiceTerms {
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
    ...changes,
  };
}

/** A registration of the terms, with the postings the terms imply on the context's books. */
function createRegistration(terms: InvoiceTerms): EntryDraft {
  const context = createContext();

  return {
    kind: "invoice",
    description: "Invoice 7",
    postings: postingsOf(
      invoicePostings(terms, context.withholdingTaxes, context.accounts),
    ),
    invoice: terms,
  };
}

function createPaymentDraft(
  invoiceId: string,
  amount: number,
  supplierId = "md1",
): EntryDraft {
  return {
    kind: "invoicePayment",
    description: "Payment of invoice 7",
    postings: [
      createLine("la4", amount, 0, supplierId),
      createLine("la2", 0, amount),
    ],
    invoiceId,
  };
}

function createTaxLeaf(): Account {
  return {
    id: "la7",
    periodId: "p1",
    parentId: null,
    name: "Ritenute",
    order: 7,
    nature: "liabilities",
    type: "regular",
    role: "tax",
    budget: null,
  };
}

function createWithholding(): WithholdingTax {
  return {
    periodId: "p1",
    code: "1040",
    name: "Lavoratori autonomi",
    rate: rate(2000),
    accountId: "la7",
  };
}

function createEntry(
  id: string,
  kind: EntryKind,
  invoiceId: string | null,
  postings: Posting[],
): JournalEntry {
  return {
    id,
    periodId: "p1",
    number: 10,
    at: "2013-04-23T10:00:00",
    kind,
    description: id,
    postings,
    invoiceId,
  };
}

function postingsOf(result: ResultOf<Posting[]>): Posting[] {
  if (!result.ok) {
    throw new Error(
      `missing: the fixture's invoice postings (${result.reason})`,
    );
  }

  return result.value;
}

function createDraft(postings: Posting[], description = "Spesa"): EntryDraft {
  return { kind: "generic", description, postings };
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

function createOwnerLine(
  accountId: string,
  debit: number,
  credit: number,
  residentId: string,
): Posting {
  return {
    accountId,
    debit: cents(debit),
    credit: cents(credit),
    counterpart: { kind: "owner", id: residentId },
  };
}
