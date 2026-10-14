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
        createDraft([
          createLine("la21", 1000, 0),
          createLine("la4", 0, 1000, "md1"),
        ]),
        createAccounts(),
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
    expect(validateEntry(candidate, createAccounts())).toEqual({
      ok: false,
      reason,
    });
  });

  it("checks the reasons in the spec's order: a blank description on an unbalanced draft is blank-description", () => {
    expect(
      validateEntry(
        createDraft([createLine("la21", 1000, 0)], ""),
        createAccounts(),
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
        createAccounts(),
      ),
    ).toEqual({ ok: true });
  });
});

function createAccounts(): Account[] {
  return createSmallBooks().accounts;
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
