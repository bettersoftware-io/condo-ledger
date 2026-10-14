import { describe, expect, it } from "vitest";

import { cents } from "../entities/cents.ts";
import type { JournalEntry } from "../entities/journal.ts";
import { createSmallBooks } from "../testing/createSmallBooks.ts";
import { type AccountNode, buildAccountTree } from "./accountTree.ts";
import { journalOf } from "./journal.ts";

describe("journalOf", () => {
  it("lists the entries in number order with their totals and kind", () => {
    const views = journalOf(root(), entries());

    expect(
      views.map((view) => {
        return [view.number, view.kind, view.debit, view.credit];
      }),
    ).toEqual([
      [1, "invoice", 36018, 36018],
      [2, "invoice", 20000, 20000],
      [3, "invoicePayment", 20000, 20000],
      [4, "budgetAllocation", 100000, 100000],
      [5, "collection", 35000, 35000],
      [6, "generic", 1, 1],
      [7, "individualExpense", 1500, 1500],
      [8, "generic", 0, 0],
      [9, "generic", 100, 100],
    ]);
    expect(views[0]).toMatchObject({
      id: "e1",
      at: "2013-01-10T10:00:00",
      description: "Fattura Alfa",
    });
  });

  it("writes a plain leaf's path through the tree, side level included", () => {
    expect(postingsOf(9)).toEqual([
      [
        "la1",
        "Total › Patrimonial › (Assets) › Liquidità › Cassa",
        100,
        0,
        100,
      ],
      ["la30", "Total › Revenue › Da condòmini", 0, 100, 0],
    ]);
  });

  it("writes a control row's path without the side level, with the party and the unit", () => {
    expect(postingsOf(1)[1]).toEqual([
      "la4/md1",
      "Total › Patrimonial › Fornitori › Alfa s.n.c.",
      0,
      36018,
      0,
    ]);
    expect(postingsOf(4)[0]).toEqual([
      "la5/md10/r1",
      "Total › Patrimonial › Condòmini › Rossi Mario › A01",
      60000,
      0,
      60000,
    ]);
  });

  it("a fixed-nature control account has no side to drop", () => {
    expect(postingsOf(7)[0]).toEqual([
      "la23/md10/r2",
      "Total › Costs › Spese individuali › Rossi Mario › A02",
      1500,
      0,
      1500,
    ]);
  });

  it("runs the balance within the entry, debit minus credit, ending at zero", () => {
    expect(
      postingsOf(4).map((line) => {
        return line[4];
      }),
    ).toEqual([60000, 70000, 100000, 0]);
  });

  it("keeps a zero posting as a line that leaves the balance unchanged", () => {
    expect(
      postingsOf(8).map((line) => {
        return [line[2], line[3], line[4]];
      }),
    ).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });

  it("throws, naming the account, for a posting no node of the tree owns", () => {
    const stray: JournalEntry = {
      ...(entries()[0] as JournalEntry),
      id: "stray",
      number: 10,
      postings: [
        {
          accountId: "la20",
          debit: cents(1),
          credit: cents(0),
          counterpart: null,
        },
      ],
    };

    expect(() => {
      return journalOf(root(), [...entries(), stray]);
    }).toThrow("missing: the node of the posting on la20");
  });
});

function root(): AccountNode {
  const books = createSmallBooks();

  return buildAccountTree(books.accounts, books.entries, books.parties);
}

function entries(): JournalEntry[] {
  return createSmallBooks().entries;
}

function postingsOf(
  number: number,
): [string, string, number, number, number][] {
  const view = journalOf(root(), entries()).find((candidate) => {
    return candidate.number === number;
  });

  if (view === undefined) {
    throw new Error(`missing: the entry ${number}`);
  }

  return view.postings.map((line) => {
    return [line.key, line.path, line.debit, line.credit, line.balance];
  });
}
