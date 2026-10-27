import { describe, expect, it } from "vitest";

import type { Account, AccountRole } from "../entities/account.ts";
import { cents } from "../entities/cents.ts";
import type { EntryKind, JournalEntry, Posting } from "../entities/journal.ts";
import type { OwnerParty, Party } from "../entities/party.ts";
import { legacySeedData } from "../simulators/seed/legacySeed.generated.ts";
import { loadLegacySeed } from "../simulators/seed/legacySeed.ts";
import { must } from "../support/must.ts";
import { budgetSharesOf, previousBalancesOf } from "./budgetShares.ts";

describe("budgetSharesOf", () => {
  it("finds nothing when the period has no budget allocation entry", () => {
    const entries = [
      createEntry("tx1", "generic", [
        createPosting("la5", 1000, 0, "rA"),
        createPosting("la6", 3, 0, "rA"),
      ]),
    ];

    const result = budgetSharesOf(entries, createAccounts());

    expect(result.found).toBe(false);
    expect([...result.shares]).toEqual([]);
    expect(result.roundings).toBe(0);
  });

  it("reads each resident's share as debit − credit on the owners account, and the roundings account's lines summed", () => {
    const entries = [
      createEntry("tx1", "generic", [createPosting("la5", 99999, 0, "rA")]),
      createEntry("tx2", "budgetAllocation", [
        createPosting("la5", 10000, 0, "rA"),
        createPosting("la5", 0, 250, "rA"),
        createPosting("la5", 0, 400, "rB"),
        createPosting("la5", 0, 7, null),
        createPosting("la6", 2, 0, "rA"),
        createPosting("la6", 0, 5, "rB"),
        createPosting("la9", 0, 9352, null),
      ]),
    ];

    const result = budgetSharesOf(entries, createAccounts());

    expect(result.found).toBe(true);
    expect([...result.shares]).toEqual([
      ["rA", 9750],
      ["rB", -400],
    ]);
    expect(result.roundings).toBe(-3);
  });

  it("gives Pozzetto 2013's residents the shares of tx291 and roundings of −0.54, adding up to the 38,000.00 budget", () => {
    const result = budgetSharesOf(entriesOf("p36"), accountsOf("p36"));

    expect(result.found).toBe(true);
    expect(result.shares.get("r162")).toBe(168731);
    expect(result.shares.get("r166")).toBe(89880);
    expect(result.roundings).toBe(-54);
    expect(sum([...result.shares.values()]) + result.roundings).toBe(3800000);
  });

  it("gives Saturno 2011 roundings of 0.01, adding up to the 7,400.00 budget", () => {
    const result = budgetSharesOf(entriesOf("p1"), accountsOf("p1"));

    expect(result.roundings).toBe(1);
    expect(sum([...result.shares.values()]) + result.roundings).toBe(740000);
  });
});

describe("previousBalancesOf", () => {
  it("reads each resident's lines on the owners account in the opening entry, debit − credit, and 0 for an owner without one", () => {
    const entries = [
      createEntry("tx1", "openingBalances", [
        createPosting("la5", 3000, 0, "rA"),
        createPosting("la5", 0, 500, "rA"),
        createPosting("la6", 70, 0, "rA"),
        createPosting("la9", 0, 2500, null),
      ]),
      createEntry("tx2", "generic", [createPosting("la5", 0, 800, "rB")]),
    ];

    const result = previousBalancesOf(
      entries,
      createAccounts(),
      createParties(),
    );

    expect([...result]).toEqual([
      ["rA", 2500],
      ["rB", 0],
    ]);
  });

  it("takes each owner's starting balance when the period has no opening entry", () => {
    const entries = [
      createEntry("tx2", "generic", [createPosting("la5", 0, 800, "rB")]),
    ];

    const result = previousBalancesOf(
      entries,
      createAccounts(),
      createParties(),
    );

    expect([...result]).toEqual([
      ["rA", 1200],
      ["rB", -300],
    ]);
  });

  it.each(["p36", "p1"])(
    "equals every owner's starting balance on the seed's %s, from its opening entry",
    (periodId) => {
      const result = previousBalancesOf(
        entriesOf(periodId),
        accountsOf(periodId),
        partiesOf(periodId),
      );

      expect([...result]).toEqual(
        ownersOf(periodId).map((owner) => {
          return [owner.id, owner.startingBalance];
        }),
      );
    },
  );
});

const seed = loadLegacySeed(legacySeedData);

function entriesOf(periodId: string): JournalEntry[] {
  return seed.entries.filter((entry) => {
    return entry.periodId === periodId;
  });
}

function accountsOf(periodId: string): Account[] {
  return seed.accounts.filter((account) => {
    return account.periodId === periodId;
  });
}

function partiesOf(periodId: string): Party[] {
  return must(
    seed.parties.find((list) => {
      return list.periodId === periodId;
    }),
    `the parties of ${periodId}`,
  ).parties;
}

function ownersOf(periodId: string): OwnerParty[] {
  return partiesOf(periodId).filter((party) => {
    return party.kind === "owner";
  });
}

function sum(values: number[]): number {
  return values.reduce((total, value) => {
    return total + value;
  }, 0);
}

function createAccounts(): Account[] {
  return [
    createAccount("la5", "owners"),
    createAccount("la6", "roundings"),
    createAccount("la9", null),
  ];
}

function createAccount(id: string, role: AccountRole | null): Account {
  return {
    id,
    periodId: "p1",
    parentId: null,
    name: id,
    order: 0,
    nature: "assetsOrLiabilities",
    type: role === null ? "regular" : "controlUnitResident",
    role,
    budget: null,
    abbreviation: null,
    links: [],
  };
}

function createParties(): Party[] {
  return [
    { kind: "supplier", id: "s1", name: "Supplier" },
    createOwner("rA", 1200),
    createOwner("rB", -300),
  ];
}

function createOwner(id: string, startingBalance: number): OwnerParty {
  return {
    kind: "owner",
    id,
    personId: `p${id}`,
    name: `Owner ${id}`,
    unitCode: "A1",
    unitId: "uA1",
    startingBalance: cents(startingBalance),
    role: "PR",
    share: null,
    restriction: null,
    ownRestriction: null,
  };
}

function createEntry(
  id: string,
  kind: EntryKind,
  postings: Posting[],
): JournalEntry {
  return {
    id,
    periodId: "p1",
    number: 1,
    at: "2011-01-01T00:00:00Z",
    kind,
    description: id,
    postings,
    invoiceId: null,
  };
}

function createPosting(
  accountId: string,
  debit: number,
  credit: number,
  residentId: string | null,
): Posting {
  return {
    accountId,
    debit: cents(debit),
    credit: cents(credit),
    counterpart: residentId === null ? null : { kind: "owner", id: residentId },
  };
}
