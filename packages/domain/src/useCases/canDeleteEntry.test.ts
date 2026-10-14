import { describe, expect, it } from "vitest";

import type { JournalEntry } from "../entities/journal.ts";
import { createSmallBooks } from "../testing/createSmallBooks.ts";
import { canDeleteEntry, DELETABLE_KINDS } from "./canDeleteEntry.ts";

describe("canDeleteEntry", () => {
  it("accepts the four kinds M2a writes", () => {
    expect(DELETABLE_KINDS).toEqual([
      "generic",
      "directPaymentCash",
      "directPaymentBank",
      "withholdingPayment",
    ]);

    for (const kind of DELETABLE_KINDS) {
      expect(canDeleteEntry({ ...createEntry("e6"), kind })).toEqual({
        ok: true,
      });
    }
  });

  it("refuses the kinds whose side effects are not modelled yet, naming the reason", () => {
    expect(canDeleteEntry(createEntry("e1"))).toEqual({
      ok: false,
      reason: "kind-not-deletable",
    });
    expect(canDeleteEntry(createEntry("e5"))).toEqual({
      ok: false,
      reason: "kind-not-deletable",
    });
  });
});

function createEntry(id: string): JournalEntry {
  const found = createSmallBooks().entries.find((candidate) => {
    return candidate.id === id;
  });

  if (found === undefined) {
    throw new Error(`missing: the entry ${id}`);
  }

  return found;
}
