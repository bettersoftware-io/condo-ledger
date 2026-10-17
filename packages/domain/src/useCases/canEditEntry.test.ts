import { describe, expect, it } from "vitest";

import type { EntryKind, JournalEntry } from "../entities/journal.ts";
import { canEditEntry } from "./canEditEntry.ts";

describe("canEditEntry", () => {
  it.each([
    "generic",
    "directPaymentCash",
    "directPaymentBank",
    "withholdingPayment",
    "invoice",
    "invoicePayment",
    "openingBalances",
  ] as const)("accepts %s", (kind) => {
    expect(canEditEntry(createEntry(kind))).toEqual({ ok: true });
  });

  it.each([
    "collection",
    "budgetAllocation",
    "closingBalances",
    "individualExpense",
  ] as const)("refuses %s with kind-not-editable", (kind) => {
    expect(canEditEntry(createEntry(kind))).toEqual({
      ok: false,
      reason: "kind-not-editable",
    });
  });
});

function createEntry(kind: EntryKind): JournalEntry {
  return {
    id: "e1",
    periodId: "p1",
    number: 1,
    at: "2013-03-01T10:00:00",
    kind,
    description: "Entry",
    postings: [],
    invoiceId: null,
  };
}
