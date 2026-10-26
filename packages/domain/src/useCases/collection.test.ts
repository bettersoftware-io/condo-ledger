import { describe, expect, it } from "vitest";

import type { Account } from "../entities/account.ts";
import { type Cents, cents } from "../entities/cents.ts";
import type { Installment, InstallmentItem } from "../entities/installment.ts";
import { collectionPostings, settleOldestFirst } from "./collection.ts";
import type { ItemBalance } from "./installments.ts";

describe("settleOldestFirst", () => {
  it("pays the first item in full and the next one partly", () => {
    const result = settleOldestFirst(cents(12000), createOpen());

    expect(settlementsOf(result)).toEqual([
      ["iiA1", 10000],
      ["iiB1", 2000],
    ]);
  });

  it("settles every item when the amount is exactly what is owed", () => {
    const result = settleOldestFirst(cents(18000), createOpen());

    expect(settlementsOf(result)).toEqual([
      ["iiA1", 10000],
      ["iiB1", 5000],
      ["iiA2", 3000],
    ]);
  });

  it("stops at the item an amount fits exactly, taking no zero line for the next", () => {
    const result = settleOldestFirst(cents(10000), createOpen());

    expect(settlementsOf(result)).toEqual([["iiA1", 10000]]);
  });

  it("pays an item only what it still owes, not its full amount", () => {
    const open = createOpen();
    const first = open[0];

    if (first === undefined) {
      throw new Error("no open item");
    }

    open[0] = { ...first, paid: cents(4000), remaining: cents(6000) };

    expect(settlementsOf(settleOldestFirst(cents(7000), open))).toEqual([
      ["iiA1", 6000],
      ["iiB1", 1000],
    ]);
  });

  it("rejects an amount one cent above the total as over-owed", () => {
    const result = settleOldestFirst(cents(18001), createOpen());

    expect(result).toEqual({ ok: false, reason: "over-owed" });
  });

  it("gives no settlement for zero", () => {
    const result = settleOldestFirst(cents(0), createOpen());

    expect(result).toEqual({ ok: true, value: [] });
  });
});

describe("collectionPostings", () => {
  it("debits the account with the total, then credits the owners account once per settlement", () => {
    const settled = settleOldestFirst(cents(12000), createOpen());
    const settlements = settled.ok ? settled.value : [];

    const result = collectionPostings("la156", settlements, createAccounts());

    expect(result).toEqual({
      ok: true,
      value: [
        {
          accountId: "la156",
          debit: 12000,
          credit: 0,
          counterpart: null,
        },
        {
          accountId: "la9",
          debit: 0,
          credit: 10000,
          counterpart: { kind: "owner", id: "rA" },
          installmentItemId: "iiA1",
        },
        {
          accountId: "la9",
          debit: 0,
          credit: 2000,
          counterpart: { kind: "owner", id: "rB" },
          installmentItemId: "iiB1",
        },
      ],
    });
  });

  it("uses the owners account of the period of the account, not another period's", () => {
    const accounts = [
      createAccount("la200", "p1", "owners"),
      ...createAccounts(),
    ];
    const settled = settleOldestFirst(cents(100), createOpen());
    const settlements = settled.ok ? settled.value : [];

    const result = collectionPostings("la156", settlements, accounts);

    expect(result.ok && result.value[1]?.accountId).toBe("la9");
  });

  it("rejects no-owners-account when the period has no owners account", () => {
    const settled = settleOldestFirst(cents(100), createOpen());
    const settlements = settled.ok ? settled.value : [];
    const accounts = createAccounts().filter((account) => {
      return account.role !== "owners";
    });

    const result = collectionPostings("la156", settlements, accounts);

    expect(result).toEqual({ ok: false, reason: "no-owners-account" });
  });

  it("rejects no-owners-account for an account the chart does not have", () => {
    const result = collectionPostings("la999", [], createAccounts());

    expect(result).toEqual({ ok: false, reason: "no-owners-account" });
  });
});

function settlementsOf(
  result: ReturnType<typeof settleOldestFirst>,
): [string, number][] {
  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.value.map((settlement) => {
    return [settlement.item.id, settlement.amount];
  });
}

function createAccount(
  id: string,
  periodId: string,
  role: Account["role"],
): Account {
  return {
    id,
    periodId,
    parentId: null,
    name: id,
    order: 1,
    nature: "assets",
    type: "regular",
    role,
    budget: null,
    abbreviation: null,
    links: [],
  };
}

function createAccounts(): Account[] {
  return [
    createAccount("la156", "p36", "bank"),
    createAccount("la9", "p36", "owners"),
  ];
}

function createBalance(
  id: string,
  residentId: string,
  amount: number,
  due: string,
  number: number,
): ItemBalance {
  const installment: Installment = {
    id: `in${number}`,
    periodId: "p36",
    number,
    name: `Rata ${number}`,
    dueDate: due,
    locked: false,
  };

  const item: InstallmentItem = {
    id,
    installmentId: installment.id,
    residentId,
    amount: cents(amount),
  };
  const owed: Cents = cents(amount);

  return { item, installment, paid: cents(0), remaining: owed };
}

function createOpen(): ItemBalance[] {
  return [
    createBalance("iiA1", "rA", 10000, "2013-01-20", 1),
    createBalance("iiB1", "rB", 5000, "2013-01-20", 1),
    createBalance("iiA2", "rA", 3000, "2013-02-20", 2),
  ];
}
