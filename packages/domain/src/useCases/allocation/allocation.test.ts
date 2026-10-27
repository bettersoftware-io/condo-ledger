import { describe, expect, it } from "vitest";

import type { Account } from "#/entities/account.ts";
import { type Cents, cents } from "#/entities/cents.ts";
import type { JournalEntry, Posting } from "#/entities/journal.ts";
import type { Party } from "#/entities/party.ts";
import type { UnitGroup } from "#/entities/unit.ts";
import { must } from "#/support/must.ts";
import {
  createAccount,
  createAllocationInput,
  createCoefficient,
  createLink,
} from "#/testing/createAllocationInput.ts";

import {
  type Allocation,
  type AllocationBooks,
  type AllocationRow,
  type AllocationSource,
  allocationBooksOf,
  allocationOf,
} from "./allocation.ts";
import { type AllocationInput, type AllocationMode, shareOf } from "./share.ts";

// The fixture is createAllocationInput's: its columns are la1 (General, with
// la10 under it) and la40, a budget nothing links.

describe("allocationOf, the columns", () => {
  it("heads one column per top-level expense account, in account order, by its abbreviation or else its name", () => {
    const books = createBooks();
    books.input.accounts = [
      createAccount("la40", null, "regular", 10000, []),
      ...books.input.accounts
        .filter((account) => {
          return account.id !== "la40";
        })
        .map((account) => {
          return account.id === "la1"
            ? { ...account, abbreviation: "General" }
            : account;
        }),
    ];

    expect(allocationOf(books, "budget").columns).toEqual([
      { accountId: "la1", label: "General" },
      { accountId: "la40", label: "la40" },
    ]);
  });
});

describe("allocationOf, the Roundings row", () => {
  it("is each account's budget, its children's for a grouping account, minus what the residents were given", () => {
    const books = createBooks();
    books.input.accounts = withBudget(books.input.accounts, "la11", 100001);

    const allocation = allocationOf(books, "budget");

    // 1,000.01 shares out as 1,000.00: the cent left over is la1's rounding.
    expect(roundingsOf(allocation).amounts).toEqual([1, 10000]);
    expect(roundingsOf(allocation).total).toBe(10001);
    expect(roundingsOf(allocation).amounts[0]).toBe(
      150001 - residentsSum(books.input, "budget", "la1"),
    );
  });

  it("is each account's balance minus what the residents were given, in the final balance", () => {
    const books = createBooks();
    books.input.balances.set("la20", cents(1234));
    books.input.balances.set("la40", cents(5000));

    expect(roundingsOf(allocationOf(books, "finalBalance")).amounts).toEqual([
      0, 5000,
    ]);

    books.input.balances.delete("la20");

    expect(roundingsOf(allocationOf(books, "finalBalance")).amounts).toEqual([
      -1234, 5000,
    ]);
  });

  it("has no previous balance, due or paid, and closes the root", () => {
    const allocation = allocationOf(createBooks(), "budget");
    const roundings = roundingsOf(allocation);

    expect(roundings).toMatchObject({
      key: "roundings",
      kind: "roundings",
      label: "Roundings",
      role: "",
      restriction: "",
      days: "",
      previousBalance: null,
      due: null,
      paid: null,
      children: [],
    });
    expect(allocation.root.children.at(-1)).toBe(roundings);
  });
});

describe("allocationOf, the sums", () => {
  it("gives a group and the root the sums of their children, column by column, and the root the accounts' totals", () => {
    const allocation = allocationOf(createGroupedBooks(), "budget");
    const [a, b] = allocation.root.children;

    for (const row of [must(a, "group A"), must(b, "group B")]) {
      expect(row.amounts).toEqual(columnSums(row.children));
      expect(row.total).toBe(totalOf(row.children));
    }

    expect(allocation.root.amounts).toEqual(
      columnSums(allocation.root.children),
    );
    expect(allocation.root.amounts).toEqual([150000, 10000]);
    expect(allocation.root.total).toBe(160000);
  });

  it("gives a resident the share of each column and their sum as the Total", () => {
    const books = createBooks();
    const r3 = rowOf(allocationOf(books, "budget"), "resident:r3");

    expect(r3.amounts).toEqual([
      shareOf(books.input, "budget", "la1", "r3"),
      0,
    ]);
    expect(r3.amounts).toEqual([36000, 0]);
    expect(r3.total).toBe(36000);
  });

  it("adds each resident's previous balance and payments, a collection's debit less: due is the Total plus the previous balance", () => {
    const books = createBooks();
    books.entries = [
      createEntry("tx1", "collection", [
        ownerLine("r3", 0, 10000),
        ownerLine("r3", 0, 2500),
        ownerLine("r4", 0, 5000),
        ownerLine("r4", 1000, 0),
        { ...ownerLine("r4", 0, 99999), accountId: "la40" },
      ]),
      createEntry("tx2", "invoice", [ownerLine("r4", 0, 7777)]),
    ];
    books.input.residents = books.input.residents.map((resident) => {
      return resident.id === "r3"
        ? { ...resident, startingBalance: cents(-500) }
        : resident;
    });

    const allocation = allocationOf(books, "budget");

    expect(rowOf(allocation, "resident:r3")).toMatchObject({
      total: 36000,
      previousBalance: -500,
      due: 35500,
      paid: 12500,
    });
    expect(rowOf(allocation, "resident:r4")).toMatchObject({
      previousBalance: 0,
      due: 24000,
      paid: 4000,
    });
    expect(rowOf(allocation, "unit:u2")).toMatchObject({
      total: 60000,
      previousBalance: -500,
      due: 59500,
      paid: 16500,
    });
    expect(allocation.root).toMatchObject({
      total: 160000,
      previousBalance: -500,
      due: 159500,
      paid: 16500,
    });
  });

  it("reads the previous balances from the opening entry when there is one", () => {
    const books = createBooks();
    books.entries = [
      createEntry("tx1", "openingBalances", [ownerLine("r1", 4200, 0)]),
    ];

    const allocation = allocationOf(books, "budget");

    expect(rowOf(allocation, "resident:r1").previousBalance).toBe(4200);
    expect(rowOf(allocation, "resident:r2").previousBalance).toBe(0);
  });
});

describe("allocationOf, the accounts it cannot allocate", () => {
  it("names an account whose only table is all zeros, and leaves its whole budget in Roundings", () => {
    const books = createBooks();
    books.input.accounts = [
      ...books.input.accounts,
      createAccount("la50", null, "regular", 30000, [
        createLink("el5", "la50", "dt3", "both"),
      ]),
    ];
    books.input.coefficients = [
      ...books.input.coefficients,
      createCoefficient("dt3", "u1", 0),
      createCoefficient("dt3", "u2", 0),
      createCoefficient("dt3", "u3", 0),
    ];

    const allocation = allocationOf(books, "budget");

    expect(allocation.unallocated).toEqual(["la40", "la50"]);
    expect(roundingsOf(allocation).amounts).toEqual([0, 10000, 30000]);
    expect(rowOf(allocation, "resident:r1").amounts[2]).toBe(0);
  });

  it("names a budgeted account nothing links, and no account with nothing to allocate", () => {
    const books = createBooks();

    expect(allocationOf(books, "budget").unallocated).toEqual(["la40"]);
    expect(allocationOf(books, "finalBalance").unallocated).toEqual([]);

    books.input.balances.set("la40", cents(-300));

    expect(allocationOf(books, "finalBalance").unallocated).toEqual(["la40"]);
  });

  it("names an expense account only: a balance elsewhere is not the allocation's", () => {
    const books = createBooks();
    books.input.accounts = [
      ...books.input.accounts,
      { ...createAccount("la60", null, "regular", null, []), nature: "assets" },
    ];
    books.input.balances.set("la60", cents(5000));

    expect(allocationOf(books, "finalBalance").unallocated).toEqual([]);
    expect(allocationOf(books, "finalBalance").columns).toHaveLength(2);
  });
});

describe("allocationOf, the rows", () => {
  it("draws the period, its units in code order and their residents, then Roundings", () => {
    const books = createBooks();
    books.input.units = [...books.input.units].reverse();

    expect(shapeOf(allocationOf(books, "budget").root)).toEqual([
      "root Small 2013",
      [
        "unit A1",
        ["resident Owner r1", "resident Owner r2"],
        "unit A2",
        ["resident Owner r3 (PR 60%)", "resident Owner r4 (PR 40%)"],
        "unit A3",
        ["resident Owner r5 (PR 100%)", "resident Owner r6 (PR 100%)"],
        "roundings Roundings",
      ],
    ]);
  });

  it("draws groups by code, each with its subgroups and then its units, and the units of no group after them", () => {
    const books = createGroupedBooks();
    books.groups = [
      ...books.groups,
      createGroup("ug3", "C", "Cellars", "ug1"),
      createGroup("ug4", "0", "Lofts", "ug1"),
    ];
    books.input.units = books.input.units.map((unit) => {
      return unit.id === "u2" ? { ...unit, groupId: "ug4" } : unit;
    });
    books.input.units.push({
      id: "u4",
      periodId: "p1",
      code: "Z1",
      groupId: null,
      restriction: null,
    });

    const allocation = allocationOf(books, "budget");

    expect(shapeOf(allocation.root)).toEqual([
      "root Small 2013",
      [
        "group A - Stairs",
        [
          "unit A3",
          ["resident Owner r5 (PR 100%)", "resident Owner r6 (PR 100%)"],
        ],
        "group B - Garages",
        [
          "group 0 - Lofts",
          [
            "unit A2",
            ["resident Owner r3 (PR 60%)", "resident Owner r4 (PR 40%)"],
          ],
          "group C - Cellars",
          [],
          "unit A1",
          ["resident Owner r1", "resident Owner r2"],
        ],
        "unit Z1",
        [],
        "roundings Roundings",
      ],
    ]);
    expect(rowOf(allocation, "group:ug3")).toMatchObject({
      amounts: [0, 0],
      total: 0,
      previousBalance: 0,
      due: 0,
      paid: 0,
    });
    expect(rowOf(allocation, "unit:u4").amounts).toEqual([0, 0]);
  });

  it("orders a unit's residents by their own start, an open start first", () => {
    const books = createBooks();
    books.input.residents = [...books.input.residents].reverse();

    expect(childKeys(allocationOf(books, "budget"), "unit:u3")).toEqual([
      "resident:r5",
      "resident:r6",
    ]);
    expect(childKeys(allocationOf(books, "budget"), "unit:u1")).toEqual([
      "resident:r2",
      "resident:r1",
    ]);
  });

  it("draws a unit with one resident as that resident's row, labelled with the unit's code", () => {
    const books = createBooks();
    books.input.residents = books.input.residents.filter((resident) => {
      return resident.id !== "r2" && resident.id !== "r4";
    });

    const allocation = allocationOf(books, "budget");

    expect(rowOf(allocation, "resident:r1")).toMatchObject({
      kind: "resident",
      label: "A1 Owner r1",
      role: "PR",
      children: [],
    });
    expect(rowOf(allocation, "resident:r3").label).toBe("A2 Owner r3 (PR 60%)");
    expect(
      allocation.root.children.map((row) => {
        return row.key;
      }),
    ).toEqual(["resident:r1", "resident:r3", "unit:u3", "roundings"]);
  });

  it("writes the period's dates on the root, and the resident's own dates and days on a resident", () => {
    const allocation = allocationOf(createBooks(), "budget");

    expect(allocation.root).toMatchObject({
      key: "root",
      kind: "root",
      role: "",
      restriction: "01/01/2013 - 31/12/2013",
      days: "",
    });
    expect(rowOf(allocation, "resident:r5")).toMatchObject({
      restriction: "start of FY - 18/01/2013",
      days: "18/365",
    });
    expect(rowOf(allocation, "resident:r6")).toMatchObject({
      restriction: "19/01/2013 - end of FY",
      days: "347/365",
    });
    expect(rowOf(allocation, "resident:r1")).toMatchObject({
      restriction: "",
      days: "",
    });
  });

  it("writes a unit's dates on the unit's row, and on the one resident's row that stands for it", () => {
    const books = createBooks();
    const may = { from: "2013-05-01", to: "2013-05-31" };
    books.input.units = books.input.units.map((unit) => {
      return unit.id === "u1" || unit.id === "u2"
        ? { ...unit, restriction: may }
        : unit;
    });
    books.input.residents = books.input.residents
      .filter((resident) => {
        return resident.id !== "r4";
      })
      .map((resident) => {
        return resident.unitId === "u1" || resident.unitId === "u2"
          ? { ...resident, restriction: may }
          : resident;
      });

    const allocation = allocationOf(books, "budget");

    expect(rowOf(allocation, "unit:u1")).toMatchObject({
      restriction: "01/05/2013 - 31/05/2013",
      days: "31/365",
    });
    expect(rowOf(allocation, "resident:r1")).toMatchObject({
      restriction: "",
      days: "",
    });
    expect(rowOf(allocation, "resident:r3")).toMatchObject({
      restriction: "01/05/2013 - 31/05/2013",
      days: "31/365",
    });
  });

  it("gives a group and a unit no role, and a resident theirs", () => {
    const allocation = allocationOf(createGroupedBooks(), "budget");

    expect(rowOf(allocation, "group:ug1")).toMatchObject({
      kind: "group",
      role: "",
      restriction: "",
      days: "",
    });
    expect(rowOf(allocation, "unit:u1").role).toBe("");
    expect(rowOf(allocation, "resident:r2").role).toBe("CO");
  });
});

describe("allocationBooksOf", () => {
  it("takes the period's owners as its residents, and passes the rest through", () => {
    const source = createSource();
    const books = allocationBooksOf(source);

    expect(
      books.input.residents.map((resident) => {
        return resident.id;
      }),
    ).toEqual(["r1", "r2", "r3", "r4", "r5", "r6"]);
    expect(books).toMatchObject({
      periodLabel: "Small 2013",
      entries: source.entries,
      groups: source.groups,
      input: {
        period: source.period,
        accounts: source.accounts,
        tables: source.tables,
        coefficients: source.coefficients,
        units: source.units,
      },
    });
  });

  it("sums each account's postings, debit − credit, as its balance", () => {
    const books = allocationBooksOf(createSource());

    expect(books.input.balances).toEqual(
      new Map([
        ["la11", 80000],
        ["la16", -100000],
        ["la12", 20000],
        ["la20", 1234],
        ["la9", -1234],
      ]),
    );
  });

  it("sums each resident's postings on each individual-expense account, and nobody else's", () => {
    const source = createSource();
    source.entries.push(
      createEntry("tx3", "generic", [
        line("la20", 500, 0, { kind: "supplier", id: "s1" }),
        line("la20", 700, 0, null),
        line("la16", 0, 1200, { kind: "supplier", id: "s1" }),
      ]),
    );
    const books = allocationBooksOf(source);

    expect(books.input.individual).toEqual(
      new Map([
        ["la20", new Map([["r1", 1234]])],
        ["la9", new Map([["r1", -1234]])],
      ]),
    );
  });

  it("gives the final balance that the books' postings make", () => {
    const allocation = allocationOf(
      allocationBooksOf(createSource()),
      "finalBalance",
    );

    // la11's 800.00 and la12's 200.00 through dt1, and r1's own 12.34.
    expect(allocation.root.amounts).toEqual([101234, 0]);
    expect(roundingsOf(allocation).amounts).toEqual([0, 0]);
    expect(rowOf(allocation, "resident:r1").amounts).toEqual([39234, 0]);
  });
});

function createBooks(): AllocationBooks {
  const input = createAllocationInput();
  input.accounts = [...input.accounts, createOwnersAccount()];

  return {
    input,
    groups: [],
    entries: [],
    periodLabel: "Small 2013",
  };
}

/** A1 in B "Garages", A2 and A3 in A "Stairs": the groups' code order is not their ids'. */
function createGroupedBooks(): AllocationBooks {
  const books = createBooks();
  books.groups = [
    createGroup("ug1", "B", "Garages", null),
    createGroup("ug2", "A", "Stairs", null),
  ];
  books.input.units = books.input.units.map((unit) => {
    return { ...unit, groupId: unit.id === "u1" ? "ug1" : "ug2" };
  });

  return books;
}

function createGroup(
  id: string,
  code: string,
  name: string,
  parentId: string | null,
): UnitGroup {
  return { id, periodId: "p1", code, name, parentId };
}

function createOwnersAccount(): Account {
  return {
    ...createAccount("la9", null, "controlUnitResident", null, []),
    nature: "assetsOrLiabilities",
    role: "owners",
  };
}

function createEntry(
  id: string,
  kind: JournalEntry["kind"],
  postings: Posting[],
): JournalEntry {
  return {
    id,
    periodId: "p1",
    number: Number(id.slice(2)),
    at: "2013-03-01",
    kind,
    description: id,
    postings,
    invoiceId: null,
  };
}

function ownerLine(residentId: string, debit: number, credit: number): Posting {
  return {
    accountId: "la9",
    debit: cents(debit),
    credit: cents(credit),
    counterpart: { kind: "owner", id: residentId },
  };
}

/** The fixture's books as a source: a supplier, an invoice of la11 and la12, and r1's individual expense. */
function createSource(): AllocationSource {
  const input = createAllocationInput();
  const supplier: Party = { kind: "supplier", id: "s1", name: "Supplier" };
  const parties: Party[] = [supplier, ...input.residents];

  return {
    periodLabel: "Small 2013",
    period: input.period,
    accounts: [...input.accounts, createOwnersAccount()],
    parties,
    entries: [
      createEntry("tx1", "invoice", [
        line("la11", 80000, 0, null),
        line("la16", 0, 100000, { kind: "supplier", id: "s1" }),
        line("la12", 20000, 0, null),
      ]),
      createEntry("tx2", "individualExpense", [
        line("la20", 1234, 0, { kind: "owner", id: "r1" }),
        line("la9", 0, 1234, { kind: "owner", id: "r1" }),
      ]),
    ],
    tables: input.tables,
    coefficients: input.coefficients,
    units: input.units,
    groups: [],
  };
}

function line(
  accountId: string,
  debit: number,
  credit: number,
  counterpart: Posting["counterpart"],
): Posting {
  return {
    accountId,
    debit: cents(debit),
    credit: cents(credit),
    counterpart,
  };
}

function withBudget(
  accounts: Account[],
  accountId: string,
  budget: number,
): Account[] {
  return accounts.map((account) => {
    return account.id === accountId
      ? { ...account, budget: cents(budget) }
      : account;
  });
}

function residentsSum(
  input: AllocationInput,
  mode: AllocationMode,
  accountId: string,
): number {
  return input.residents.reduce((sum, resident) => {
    return sum + shareOf(input, mode, accountId, resident.id);
  }, 0);
}

function roundingsOf(allocation: Allocation): AllocationRow {
  return rowOf(allocation, "roundings");
}

function rowOf(allocation: Allocation, key: string): AllocationRow {
  return must(find([allocation.root], key), `the row ${key}`);
}

function find(rows: AllocationRow[], key: string): AllocationRow | undefined {
  for (const row of rows) {
    if (row.key === key) {
      return row;
    }

    const found = find(row.children, key);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

function childKeys(allocation: Allocation, key: string): string[] {
  return rowOf(allocation, key).children.map((row) => {
    return row.key;
  });
}

/** Each row as "{kind} {label}", followed by its children's when it has any. */
function shapeOf(row: AllocationRow): unknown[] {
  return [`${row.kind} ${row.label}`, row.children.flatMap(shapeOfChild)];
}

function shapeOfChild(row: AllocationRow): unknown[] {
  return row.kind === "unit" || row.kind === "group"
    ? shapeOf(row)
    : [`${row.kind} ${row.label}`];
}

function columnSums(rows: AllocationRow[]): Cents[] {
  const width = must(rows[0], "a row").amounts.length;

  return Array.from({ length: width }, (_, index) => {
    return cents(
      rows.reduce((sum, row) => {
        return sum + must(row.amounts[index], `${row.key}'s ${index}`);
      }, 0),
    );
  });
}

function totalOf(rows: AllocationRow[]): number {
  return rows.reduce((sum, row) => {
    return sum + row.total;
  }, 0);
}
