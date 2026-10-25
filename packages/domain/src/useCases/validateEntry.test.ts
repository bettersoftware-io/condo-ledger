import { describe, expect, it } from "vitest";

import type { Account } from "../entities/account.ts";
import { cents } from "../entities/cents.ts";
import type { Installment, InstallmentItem } from "../entities/installment.ts";
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

  describe("a collection's installment items", () => {
    it("accepts a collection paying part of an item, and the lines of one item together up to what it owes", () => {
      expect(
        validateEntry(
          createCollection([createItemLine("ii1", 2000)]),
          createContext(),
        ),
      ).toEqual({ ok: true });
      expect(
        validateEntry(
          createCollection([
            createItemLine("ii1", 3000),
            createItemLine("ii1", 4000),
          ]),
          createContext(),
        ),
      ).toEqual({ ok: true });
    });

    it("refuses an item on a line that is not an owners credit of a collection, with item-not-allowed", () => {
      const item = createItemLine("ii1", 1000);
      const draft = createCollection([item]);

      expect(
        validateEntry({ ...draft, kind: "generic" }, createContext()),
      ).toEqual({ ok: false, reason: "item-not-allowed" });
      expect(
        validateEntry(
          {
            ...draft,
            postings: [
              { ...createLine("la1", 1000, 0), installmentItemId: "ii1" },
              item,
            ],
          },
          createContext(),
        ),
      ).toEqual({ ok: false, reason: "item-not-allowed" });
      expect(
        validateEntry(
          {
            ...draft,
            postings: [
              createLine("la1", 0, 1000),
              {
                ...createOwnerLine("la5", 1000, 0, "r1"),
                installmentItemId: "ii1",
              },
            ],
          },
          createContext(),
        ),
      ).toEqual({ ok: false, reason: "item-not-allowed" });
    });

    it("refuses an owners credit of a collection with no item, with item-required", () => {
      const draft = createCollection([createItemLine("ii1", 1000)]);
      const [debit] = draft.postings;

      expect(
        validateEntry(
          {
            ...draft,
            postings: [
              ...draft.postings,
              createOwnerLine("la5", 0, 500, "r1"),
              createLine("la1", 500, 0),
            ],
          },
          createContext(),
        ),
      ).toEqual({ ok: false, reason: "item-required" });
      expect(debit).toBeDefined();
    });

    it("answers unknown-item for an item the period does not have, or whose installment it does not have", () => {
      expect(
        validateEntry(
          createCollection([createItemLine("ii99", 1000)]),
          createContext(),
        ),
      ).toEqual({ ok: false, reason: "unknown-item" });
      expect(
        validateEntry(
          createCollection([createItemLine("ii3", 1000, "r1")]),
          createContext(),
        ),
      ).toEqual({ ok: false, reason: "unknown-item" });
    });

    it("answers wrong-resident for a counterpart that is not the item's resident", () => {
      expect(
        validateEntry(
          createCollection([createItemLine("ii1", 1000, "r2")]),
          createContext(),
        ),
      ).toEqual({ ok: false, reason: "wrong-resident" });
    });

    it("answers over-remaining-item for lines on one item that together exceed it, and for one that exceeds it alone", () => {
      expect(
        validateEntry(
          createCollection([createItemLine("ii1", 7001)]),
          createContext(),
        ),
      ).toEqual({ ok: false, reason: "over-remaining-item" });
      expect(
        validateEntry(
          createCollection([
            createItemLine("ii1", 4000),
            createItemLine("ii1", 3001),
          ]),
          createContext(),
        ),
      ).toEqual({ ok: false, reason: "over-remaining-item" });
      expect(
        validateEntry(
          createCollection([
            createItemLine("ii1", 4000),
            createItemLine("ii2", 5000),
          ]),
          createContext(),
        ),
      ).toEqual({ ok: true });
    });

    it("on an edit, adds back what the entry itself pays on the item", () => {
      const draft = createCollection([createItemLine("ii1", 10000)]);

      expect(validateEntry(draft, createContext())).toEqual({
        ok: false,
        reason: "over-remaining-item",
      });
      expect(
        validateEntry(draft, createContext({ replacing: "col1" })),
      ).toEqual({ ok: true });
      expect(
        validateEntry(
          createCollection([createItemLine("ii1", 10001)]),
          createContext({ replacing: "col1" }),
        ),
      ).toEqual({ ok: false, reason: "over-remaining-item" });
    });

    it("checks the item rules after opening-exists and M2a's reasons", () => {
      const draft = createCollection([createItemLine("ii99", 1000)]);

      expect(
        validateEntry({ ...draft, description: " " }, createContext()),
      ).toEqual({ ok: false, reason: "blank-description" });
      expect(
        validateEntry({ ...draft, kind: "openingBalances" }, createContext()),
      ).toEqual({ ok: false, reason: "opening-exists" });
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

  const collected = createEntry("col1", "collection", null, [
    createLine("la1", 3000, 0),
    { ...createItemLine("ii1", 3000) },
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
      collected,
      ...(parts.withoutPayment === true ? [] : [payment]),
      ...(parts.withoutOpening === true ? [] : [opening]),
    ],
    installments: createInstallments(),
    installmentItems: createInstallmentItems(),
    replacing: parts.replacing ?? null,
  };
}

/** The installment in1 of p1, and in9 of another period. */
function createInstallments(): Installment[] {
  return [
    { id: "in1", periodId: "p1", number: 1, name: "I", dueDate: "2013-03-31" },
    { id: "in9", periodId: "p2", number: 1, name: "X", dueDate: "2013-03-31" },
  ];
}

/** ii1 owes r1 100.00 (collection col1 has paid 30.00 of it), ii2 owes r2 50.00; ii3 belongs to an installment the period lacks. */
function createInstallmentItems(): InstallmentItem[] {
  return [
    { id: "ii1", installmentId: "in1", residentId: "r1", amount: cents(10000) },
    { id: "ii2", installmentId: "in1", residentId: "r2", amount: cents(5000) },
    { id: "ii3", installmentId: "in7", residentId: "r1", amount: cents(1000) },
  ];
}

/** A collection into the cash account la1, the credit lines given. */
function createCollection(credits: Posting[]): EntryDraft {
  const total = credits.reduce((sum, line) => {
    return sum + line.credit;
  }, 0);

  return {
    kind: "collection",
    description: "Collection",
    postings: [createLine("la1", total, 0), ...credits],
  };
}

/** A credit on the owners account naming the item, from its resident unless another is given. */
function createItemLine(
  itemId: string,
  amount: number,
  residentId = itemId === "ii2" ? "r2" : "r1",
): Posting {
  return {
    ...createOwnerLine("la5", 0, amount, residentId),
    installmentItemId: itemId,
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
