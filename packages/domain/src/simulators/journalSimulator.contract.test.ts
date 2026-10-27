import { type Cents, cents } from "#/entities/cents.ts";
import { rate } from "#/entities/invoice.ts";
import type { EntryDraft } from "#/entities/journal.ts";

import { describeJournalPortContract } from "../ports/__contracts__/JournalPortContract.ts";
import { createTwoPeriodSeed } from "../testing/createTwoPeriodSeed.ts";
import { fixedClock } from "./fixedClock.ts";
import { createJournalSimulator } from "./journalSimulator.ts";

describeJournalPortContract("journal simulator", () => {
  const seed = createTwoPeriodSeed();

  return {
    port: createJournalSimulator(seed, fixedClock("2026-10-14T08:00:00Z")),
    periodId: "p1",
    unknownPeriodId: "p99",
    acceptedDraft: {
      kind: "generic",
      description: "Spesa in contanti",
      postings: [
        {
          accountId: "la21",
          debit: cents(1200),
          credit: cents(0),
          counterpart: null,
        },
        {
          accountId: "la1",
          debit: cents(0),
          credit: cents(1200),
          counterpart: null,
        },
      ],
    },
    refusedDraft: {
      kind: "generic",
      description: "Sbilanciata",
      postings: [
        {
          accountId: "la21",
          debit: cents(1200),
          credit: cents(0),
          counterpart: null,
        },
      ],
    },
    refusedReason: "unbalanced",
    deletableEntryId: "e6",
    undeletableEntryId: "e7",
    editableEntryId: "e6",
    uneditableEntryId: "e4",
    // Taxable 100.00, VAT 20%, 20% withheld on la7: the cost takes 120.00, the supplier is owed 100.00.
    invoiceDraft: {
      kind: "invoice",
      description: "Invoice 7 — Alfa s.n.c.: Ascensore",
      postings: [
        {
          accountId: "la21",
          debit: cents(12000),
          credit: cents(0),
          counterpart: null,
        },
        {
          accountId: "la4",
          debit: cents(0),
          credit: cents(10000),
          counterpart: { kind: "supplier", id: "md1" },
        },
        {
          accountId: "la7",
          debit: cents(0),
          credit: cents(2000),
          counterpart: null,
        },
      ],
      invoice: {
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
      },
    },
    openingDraft: {
      kind: "openingBalances",
      description: "Opening balances",
      postings: [
        {
          accountId: "la2",
          debit: cents(50000),
          credit: cents(0),
          counterpart: null,
        },
        {
          accountId: "la3",
          debit: cents(0),
          credit: cents(50000),
          counterpart: null,
        },
      ],
    },
    collectionDraft: createCollectionDraft(cents(20000), "Incasso Rossi"),
    overpayingDraft: createCollectionDraft(cents(50001), "Incasso eccessivo"),
    collectionItemId: "ii1",
    installments: seed.installments,
    installmentItems: seed.installmentItems,
    catalogue: seed.withholdingTaxes,
    suppliersAccountId: "la4",
    liquidityAccountId: "la2",
    teardown: (): void => {},
  };
});

/** A collection from r1 into the cash account la1, all on r1's item ii1 of the seed's schedule. */
function createCollectionDraft(amount: Cents, description: string): EntryDraft {
  return {
    kind: "collection",
    description,
    postings: [
      {
        accountId: "la1",
        debit: amount,
        credit: cents(0),
        counterpart: null,
      },
      {
        accountId: "la5",
        debit: cents(0),
        credit: amount,
        counterpart: { kind: "owner", id: "r1" },
        installmentItemId: "ii1",
      },
    ],
  };
}
