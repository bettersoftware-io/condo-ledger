import { describe, expect, it } from "vitest";

import { cents } from "../entities/cents.ts";
import type { JournalEntry } from "../entities/journal.ts";
import { createSmallBooks } from "../testing/createSmallBooks.ts";
import { type AccountNode, buildAccountTree } from "./accountTree.ts";
import { ledgerOf, pathOf } from "./ledger.ts";

describe("ledgerOf", () => {
  it("lists a leaf's postings in date and number order with a running debit-minus-credit balance", () => {
    const ledger = ledgerOf(root(), "la4@assets/md2", entries());

    expect(
      ledger.lines.map((line) => {
        return [line.number, line.debit, line.credit, line.balance];
      }),
    ).toEqual([
      [2, 0, 20000, -20000],
      [3, 20000, 0, 0],
    ]);
    expect([ledger.totalDebit, ledger.totalCredit, ledger.balance]).toEqual([
      20000, 20000, 0,
    ]);
  });

  it("gives a grouping the union of its subtree's postings in the same order", () => {
    const ledger = ledgerOf(root(), "la10", entries());

    expect(
      ledger.lines.map((line) => {
        return [line.number, line.postingPath];
      }),
    ).toEqual([
      [9, "Total › Patrimonial › (Assets) › Liquidità › Cassa"],
      [3, "Total › Patrimonial › (Assets) › Liquidità › Banca"],
      [5, "Total › Patrimonial › (Assets) › Liquidità › Cassa"],
      [6, "Total › Patrimonial › (Assets) › Liquidità › Cassa"],
      [8, "Total › Patrimonial › (Assets) › Liquidità › Cassa"],
      [8, "Total › Patrimonial › (Assets) › Liquidità › Banca"],
    ]);
    expect(ledger.balance).toBe(15099);
  });

  it("orders by date before entry number: entry 9 comes first in the cash ledger", () => {
    const ledger = ledgerOf(root(), "la1", entries());

    expect(
      ledger.lines.map((line) => {
        return line.number;
      }),
    ).toEqual([9, 5, 6, 8]);
    expect(ledger.lines[0]).toMatchObject({
      debit: 100,
      credit: 0,
      balance: 100,
    });
  });

  it("keeps a zero posting as a 0.00 line that leaves the balance unchanged", () => {
    const ledger = ledgerOf(root(), "la1", entries());
    const last = ledger.lines.at(-1);

    expect(last).toMatchObject({
      number: 8,
      debit: 0,
      credit: 0,
      balance: 35099,
    });
  });

  it("carries the entry's description and date-time", () => {
    const [first] = ledgerOf(root(), "la21", entries()).lines;

    expect(first).toMatchObject({
      entryId: "e1",
      at: "2013-01-10T10:00:00",
      description: "Fattura Alfa",
    });
  });

  it("is empty with zero totals for a leaf nothing was posted to", () => {
    expect(ledgerOf(root(), "la3", entries())).toEqual({
      lines: [],
      totalDebit: 0,
      totalCredit: 0,
      balance: 0,
    });
  });

  it("gives a counterpart-less posting on a control account to its none row", () => {
    const withNone: JournalEntry[] = [
      ...entries(),
      {
        id: "e10",
        periodId: "p1",
        number: 10,
        at: "2013-04-01T10:00:00",
        kind: "generic",
        description: "Senza controparte",
        invoiceId: null,
        postings: [
          {
            accountId: "la4",
            debit: cents(500),
            credit: cents(0),
            counterpart: null,
          },
        ],
      },
    ];
    const books = createSmallBooks();
    const tree = buildAccountTree(books.accounts, withNone, books.parties);

    const none = ledgerOf(tree, "la4@assets/none", withNone);
    const supplier = ledgerOf(tree, "la4@assets/md2", withNone);

    expect(none.lines).toHaveLength(1);
    expect(none.lines[0]).toMatchObject({ entryId: "e10", balance: 500 });
    expect(supplier.lines).toHaveLength(2);
  });

  it("gives a counterpart-less posting on an owners account to its none residency", () => {
    const withNone: JournalEntry[] = [
      {
        id: "e11",
        periodId: "p1",
        number: 11,
        at: "2013-04-02T10:00:00",
        kind: "generic",
        description: "Senza condomino",
        invoiceId: null,
        postings: [
          {
            accountId: "la5",
            debit: cents(700),
            credit: cents(0),
            counterpart: null,
          },
        ],
      },
    ];
    const books = createSmallBooks();
    const tree = buildAccountTree(books.accounts, withNone, books.parties);

    const ledger = ledgerOf(tree, "la5@assets/none/none", withNone);

    expect(ledger.lines).toHaveLength(1);
    expect(ledger.balance).toBe(700);
  });

  it("lists one residency's postings, none of another's, on an owners account", () => {
    const ledger = ledgerOf(root(), "la5@liabilities/md11/r3", entries());

    expect(
      ledger.lines.map((line) => {
        return [line.number, line.balance];
      }),
    ).toEqual([
      [4, 30000],
      [5, -5000],
    ]);
  });

  it("breaks a tie on the date-time by entry number", () => {
    const books = createSmallBooks();
    const tied: JournalEntry[] = books.entries
      .filter((entry) => {
        return entry.number === 5 || entry.number === 6;
      })
      .map((entry) => {
        return { ...entry, at: "2013-03-01T10:00:00" };
      })
      .reverse();

    const ledger = ledgerOf(root(), "la1", tied);

    expect(
      ledger.lines.map((line) => {
        return line.number;
      }),
    ).toEqual([5, 6]);
  });

  it("throws for an unknown key", () => {
    expect(() => {
      return ledgerOf(root(), "nope", entries());
    }).toThrow("missing: the node nope");
  });

  it("names a node by its path from Total", () => {
    expect(pathOf(root(), "la21")).toBe(
      "Total › Costs › Spese generali › Ascensore",
    );
    expect(pathOf(root(), "total")).toBe("Total");
  });
});

function root(): AccountNode {
  const books = createSmallBooks();

  return buildAccountTree(books.accounts, books.entries, books.parties);
}

function entries(): JournalEntry[] {
  return createSmallBooks().entries;
}
