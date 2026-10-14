import { describe, expect, it } from "vitest";

import type { Account } from "../entities/account.ts";
import { cents } from "../entities/cents.ts";
import type { EntryDraft, Posting } from "../entities/journal.ts";
import { createSmallBooks } from "../testing/createSmallBooks.ts";
import { validateEntry } from "./validateEntry.ts";

describe("validateEntry", () => {
  it("accepts a balanced draft on leaves, with a party on a control account", () => {
    expect(
      validateEntry(
        draft([line("la21", 1000, 0), line("la4", 0, 1000, "md1")]),
        accounts(),
      ),
    ).toEqual({ ok: true });
  });

  it.each([
    [
      "blank-description",
      draft([line("la21", 1000, 0), line("la1", 0, 1000)], "  "),
    ],
    ["no-postings", draft([])],
    ["unknown-account", draft([line("la99", 1000, 0), line("la1", 0, 1000)])],
    ["not-a-leaf", draft([line("la20", 1000, 0), line("la1", 0, 1000)])],
    ["empty-line", draft([line("la21", 0, 0), line("la1", 0, 0)])],
    ["both-sides", draft([line("la21", 1000, 1000)])],
    ["negative", draft([line("la21", -1000, 0), line("la1", 0, -1000)])],
    [
      "counterpart-required",
      draft([line("la21", 1000, 0), line("la4", 0, 1000)]),
    ],
    [
      "counterpart-not-allowed",
      draft([line("la21", 1000, 0, "md1"), line("la1", 0, 1000)]),
    ],
    ["unbalanced", draft([line("la21", 1000, 0), line("la1", 0, 900)])],
  ])("refuses %s", (reason, candidate) => {
    expect(validateEntry(candidate, accounts())).toEqual({
      ok: false,
      reason,
    });
  });

  it("checks the reasons in the spec's order: a blank description on an unbalanced draft is blank-description", () => {
    expect(
      validateEntry(draft([line("la21", 1000, 0)], ""), accounts()),
    ).toEqual({ ok: false, reason: "blank-description" });
  });

  it("an owner residency on the owners control account is a counterpart too", () => {
    expect(
      validateEntry(
        draft([line("la1", 500, 0), owed("la5", 0, 500, "r3")]),
        accounts(),
      ),
    ).toEqual({ ok: true });
  });
});

function accounts(): Account[] {
  return createSmallBooks().accounts;
}

function draft(postings: Posting[], description = "Spesa"): EntryDraft {
  return { kind: "generic", description, postings };
}

function line(
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

function owed(
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
