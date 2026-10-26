import { describe, expect, it } from "vitest";

import { cents } from "../entities/cents.ts";
import type { Installment, InstallmentItem } from "../entities/installment.ts";
import type { EntryKind, JournalEntry } from "../entities/journal.ts";
import type { OwnerParty } from "../entities/party.ts";
import { type ItemBalance, itemBalances, owedBy } from "./installments.ts";

describe("itemBalances", () => {
  it("sums the collection credits naming an item, across tranches", () => {
    const { items, installments } = createSchedule();
    const entries = [
      createEntry("c1", "collection", "iiA1", 4000),
      createEntry("c2", "collection", "iiA1", 6000),
    ];

    const balance = balanceOf(
      "iiA1",
      itemBalances(items, installments, entries),
    );

    expect(balance.paid).toBe(10000);
    expect(balance.remaining).toBe(0);
    expect(balance.installment.id).toBe("in1");
    expect(balance.item.id).toBe("iiA1");
  });

  it("does not count a credit naming the item on another kind of entry", () => {
    const { items, installments } = createSchedule();
    const entries = [
      createEntry("g1", "generic", "iiA1", 4000),
      createEntry("c1", "collection", "iiA1", 1000),
    ];

    const balance = balanceOf(
      "iiA1",
      itemBalances(items, installments, entries),
    );

    expect(balance.paid).toBe(1000);
    expect(balance.remaining).toBe(9000);
  });

  it("does not count a debit, nor a credit naming another item", () => {
    const { items, installments } = createSchedule();
    const entry = createEntry("c1", "collection", "iiB1", 500);
    entry.postings.push({
      accountId: "la156",
      debit: cents(900),
      credit: cents(0),
      counterpart: null,
      installmentItemId: "iiA1",
    });

    const balances = itemBalances(items, installments, [entry]);

    expect(balanceOf("iiA1", balances).paid).toBe(0);
    expect(balanceOf("iiB1", balances).paid).toBe(500);
  });

  it("leaves out an item whose installment the schedule does not have", () => {
    const { items, installments } = createSchedule();
    const orphan = createItem("iiZ", "in9", "rA", 100);

    const balances = itemBalances([...items, orphan], installments, []);

    expect(ids(balances)).not.toContain("iiZ");
    expect(balances).toHaveLength(items.length);
  });

  it("gives a zero item remaining zero", () => {
    const { items, installments } = createSchedule();

    const balance = balanceOf("iiB2", itemBalances(items, installments, []));

    expect(balance.paid).toBe(0);
    expect(balance.remaining).toBe(0);
  });
});

describe("owedBy", () => {
  it("lists the open items of every residency of the person, oldest first", () => {
    const { items, installments, parties } = createSchedule();
    const balances = itemBalances(items, installments, []);

    const owed = owedBy("mdX", parties, balances);

    expect(ids(owed)).toEqual(["iiA1", "iiB1", "iiA2"]);
  });

  it("orders by installment number when due dates are equal, then by unit code", () => {
    const { items, installments, parties } = createSchedule();
    const tied = [
      ...installments,
      {
        id: "in3",
        periodId: "p36",
        number: 3,
        name: "Rata 3",
        dueDate: "2013-01-20",
        locked: false,
      },
      {
        id: "in0",
        periodId: "p36",
        number: 0,
        name: "Rata 0",
        dueDate: "2013-01-20",
        locked: false,
      },
    ];

    const more: InstallmentItem[] = [
      ...items,
      createItem("iiA3", "in3", "rA", 100),
      createItem("iiB0", "in0", "rB", 100),
    ];
    const balances = itemBalances(more, tied, []);

    const owed = owedBy("mdX", parties, balances);

    expect(ids(owed)).toEqual(["iiB0", "iiA1", "iiB1", "iiA3", "iiA2"]);
  });

  it("drops the items already paid in full", () => {
    const { items, installments, parties } = createSchedule();
    const entries = [createEntry("c1", "collection", "iiA1", 10000)];
    const balances = itemBalances(items, installments, entries);

    expect(ids(owedBy("mdX", parties, balances))).toEqual(["iiB1", "iiA2"]);
  });
});

function ids(balances: ItemBalance[]): string[] {
  return balances.map((balance) => {
    return balance.item.id;
  });
}

function balanceOf(itemId: string, balances: ItemBalance[]): ItemBalance {
  const found = balances.find((balance) => {
    return balance.item.id === itemId;
  });

  if (found === undefined) {
    throw new Error(`no balance for ${itemId}`);
  }

  return found;
}

interface Schedule {
  installments: Installment[];
  items: InstallmentItem[];
  parties: OwnerParty[];
}

function createItem(
  id: string,
  installmentId: string,
  residentId: string,
  amount: number,
): InstallmentItem {
  return { id, installmentId, residentId, amount: cents(amount) };
}

function createOwner(
  id: string,
  personId: string,
  unitCode: string,
): OwnerParty {
  return {
    kind: "owner",
    id,
    personId,
    name: id,
    unitCode,
    unitId: `u${unitCode}`,
    startingBalance: cents(0),
    role: "PR",
    share: null,
    restriction: null,
    ownRestriction: null,
  };
}

function createEntry(
  id: string,
  kind: EntryKind,
  itemId: string,
  credit: number,
): JournalEntry {
  return {
    id,
    periodId: "p36",
    number: 1,
    at: "2013-01-21T10:00:00",
    kind,
    description: "",
    invoiceId: null,
    postings: [
      {
        accountId: "owners",
        debit: cents(0),
        credit: cents(credit),
        counterpart: { kind: "owner", id: "rA" },
        installmentItemId: itemId,
      },
    ],
  };
}

function createSchedule(): Schedule {
  return {
    installments: [
      {
        id: "in1",
        periodId: "p36",
        number: 1,
        name: "Rata 1",
        dueDate: "2013-01-20",
        locked: false,
      },
      {
        id: "in2",
        periodId: "p36",
        number: 2,
        name: "Rata 2",
        dueDate: "2013-02-20",
        locked: false,
      },
    ],
    items: [
      createItem("iiA1", "in1", "rA", 10000),
      createItem("iiB1", "in1", "rB", 5000),
      createItem("iiA2", "in2", "rA", 3000),
      createItem("iiB2", "in2", "rB", 0),
      createItem("iiC1", "in1", "rC", 7000),
    ],
    parties: [
      createOwner("rA", "mdX", "A1"),
      createOwner("rB", "mdX", "B1"),
      createOwner("rC", "mdY", "C1"),
    ],
  };
}
