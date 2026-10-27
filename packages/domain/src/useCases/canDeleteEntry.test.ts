import { describe, expect, it } from "vitest";

import { cents } from "../entities/cents.ts";
import type { EntryKind, JournalEntry } from "../entities/journal.ts";
import { must } from "../support/must.ts";
import { createSeedAllocationSource } from "../testing/createSeedAllocationSource.ts";
import { canDeleteEntry, DELETABLE_KINDS } from "./canDeleteEntry.ts";

describe("canDeleteEntry", () => {
  it("accepts the kinds M2a, M2b and M2c write, and M2e's budget allocation", () => {
    expect(DELETABLE_KINDS).toEqual([
      "generic",
      "directPaymentCash",
      "directPaymentBank",
      "withholdingPayment",
      "invoice",
      "invoicePayment",
      "openingBalances",
      "collection",
      "budgetAllocation",
    ]);

    for (const kind of DELETABLE_KINDS) {
      expect(canDeleteEntry(createEntry("e1", kind, null), [])).toEqual({
        ok: true,
      });
    }
  });

  it("accepts a payment and an opening entry", () => {
    const payment = createEntry("e2", "invoicePayment", "li1");

    expect(canDeleteEntry(payment, [payment])).toEqual({ ok: true });
    expect(
      canDeleteEntry(createEntry("e3", "openingBalances", null), [payment]),
    ).toEqual({ ok: true });
  });

  it("refuses a registration a payment names, and accepts one no payment names", () => {
    const registration = createEntry("e1", "invoice", "li1");
    const entries = [
      registration,
      createEntry("e2", "invoicePayment", "li2"),
      createEntry("e3", "generic", "li1"),
    ];

    expect(canDeleteEntry(registration, entries)).toEqual({ ok: true });
    expect(
      canDeleteEntry(registration, [
        ...entries,
        createEntry("e4", "invoicePayment", "li1"),
      ]),
    ).toEqual({ ok: false, reason: "invoice-has-payments" });
  });

  it("a registration that names no invoice is not paid by a payment that names none", () => {
    const registration = createEntry("e1", "invoice", null);

    expect(
      canDeleteEntry(registration, [
        registration,
        createEntry("e2", "invoicePayment", null),
      ]),
    ).toEqual({ ok: true });
  });

  it("accepts Saturno 2011's budget allocation, tx5, as the legacy app did", () => {
    const tx5 = must(
      createSeedAllocationSource("p1").entries.find((entry) => {
        return entry.id === "tx5";
      }),
      "tx5",
    );

    expect(tx5.kind).toBe("budgetAllocation");
    expect(canDeleteEntry(tx5, [tx5])).toEqual({ ok: true });
  });

  it("refuses the kinds whose side effects are not modelled yet, naming the reason", () => {
    for (const kind of ["closingBalances", "individualExpense"] as const) {
      expect(canDeleteEntry(createEntry("e5", kind, null), [])).toEqual({
        ok: false,
        reason: "kind-not-deletable",
      });
    }
  });
});

function createEntry(
  id: string,
  kind: EntryKind,
  invoiceId: string | null,
): JournalEntry {
  return {
    id,
    periodId: "p1",
    number: 1,
    at: "2013-03-01T10:00:00",
    kind,
    description: id,
    postings: [
      {
        accountId: "la4",
        debit: cents(100),
        credit: cents(0),
        counterpart: { kind: "supplier", id: "md1" },
      },
      {
        accountId: "la2",
        debit: cents(0),
        credit: cents(100),
        counterpart: null,
      },
    ],
    invoiceId,
  };
}
