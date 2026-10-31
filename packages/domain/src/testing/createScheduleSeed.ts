import type { Account } from "#/entities/account.ts";
import { cents } from "#/entities/cents.ts";
import type { Counterpart, Posting } from "#/entities/journal.ts";
import type { OwnerParty, Party } from "#/entities/party.ts";
import type { LegacySeed } from "#/simulators/seed/legacySeed.ts";
import { must } from "#/support/must.ts";

import { createUnit } from "./createAllocationInput.ts";
import { createTwoPeriodSeed } from "./createTwoPeriodSeed.ts";

/**
 * The two-period seed with schedules to write to.
 *
 * p1 gains a second installment, Rata 2 due 2013-06-30, nothing paid on it
 * (ii3, 300.00 for r1; ii4, 200.00 for r3), and a collection, e10, paying
 * 100.00 of r1's ii1 on Rata 1.
 *
 * p3, 2015, has books and no installments: owners r31 (A01), r32 (A02) and
 * r33 (B01); an opening entry, tx31, where r31 owes 50.00 and r33 is 20.00 in
 * credit (units uA01, uA02 and uB01); a budget allocation entry, tx32, sharing 1,000.00 as 600.00 to r31,
 * 300.00 to r32, 99.99 to r33 and 0.01 to roundings. Two installments of 50%
 * each, to the cent, plan as r31 350.00 and 300.00, r32 150.00 and 150.00,
 * r33 30.00 and 50.00.
 */
export function createScheduleSeed(): LegacySeed {
  const seed = createTwoPeriodSeed();
  const building = must(seed.buildings[0], "the seed's building");
  const firstPeriod = must(building.periods[0], "the seed's first period");
  const firstParties = must(seed.parties[0], "p1's parties");
  const owner = must(firstParties.parties.find(isOwner), "an owner of p1");

  return {
    ...seed,
    buildings: [
      {
        ...building,
        periods: [
          ...building.periods,
          {
            ...firstPeriod,
            id: "p3",
            name: "2015",
            start: "2015-01-01",
            end: "2015-12-31",
          },
        ],
      },
    ],
    units: [
      ...seed.units,
      ...["A01", "A02", "B01"].map((code) => {
        return { ...createUnit(`u${code}`, code), periodId: "p3" };
      }),
    ],
    accounts: [...seed.accounts, ...createEmptyPeriodAccounts(seed.accounts)],
    entries: [
      ...seed.entries,
      {
        id: "e10",
        periodId: "p1",
        number: 10,
        at: "2013-04-02T10:00:00",
        kind: "collection",
        description: "Incasso Rossi: Rata 1",
        postings: [
          createPosting("la1", 10000, 0, null),
          {
            ...createPosting("la5", 0, 10000, ownerOf("r1")),
            installmentItemId: "ii1",
          },
        ],
        invoiceId: null,
      },
      {
        id: "tx31",
        periodId: "p3",
        number: 1,
        at: "2015-01-02T10:00:00",
        kind: "openingBalances",
        description: "Opening balances",
        postings: [
          createPosting("y5", 5000, 0, ownerOf("r31")),
          createPosting("y5", 0, 2000, ownerOf("r33")),
          createPosting("y3", 0, 3000, null),
        ],
        invoiceId: null,
      },
      {
        id: "tx32",
        periodId: "p3",
        number: 2,
        at: "2015-01-10T10:00:00",
        kind: "budgetAllocation",
        description: "Riparto preventivo",
        postings: [
          createPosting("y5", 60000, 0, ownerOf("r31")),
          createPosting("y5", 30000, 0, ownerOf("r32")),
          createPosting("y5", 9999, 0, ownerOf("r33")),
          createPosting("y6", 1, 0, null),
          createPosting("y30", 0, 100000, null),
        ],
        invoiceId: null,
      },
    ],
    parties: [
      ...seed.parties,
      {
        periodId: "p3",
        parties: [
          createOwner(owner, "r31", "Verdi Luca", "A01"),
          createOwner(owner, "r32", "Neri Paola", "A02"),
          createOwner(owner, "r33", "Gialli Carla", "B01"),
        ],
      },
    ],
    installments: [
      ...seed.installments,
      {
        id: "in2",
        periodId: "p1",
        number: 2,
        name: "Rata 2",
        dueDate: "2013-06-30",
        locked: false,
      },
    ],
    installmentItems: [
      ...seed.installmentItems,
      {
        id: "ii3",
        installmentId: "in2",
        residentId: "r1",
        amount: cents(30000),
      },
      {
        id: "ii4",
        installmentId: "in2",
        residentId: "r3",
        amount: cents(20000),
      },
    ],
  };
}

/** p3's cash, funds, owners, roundings and income accounts: p1's, renamed y… and moved. */
function createEmptyPeriodAccounts(accounts: Account[]): Account[] {
  const renamed: [string, string][] = [
    ["la1", "y1"],
    ["la3", "y3"],
    ["la5", "y5"],
    ["la6", "y6"],
    ["la30", "y30"],
  ];

  return renamed.map(([from, to]) => {
    const account = must(
      accounts.find((candidate) => {
        return candidate.id === from;
      }),
      `p1's account ${from}`,
    );

    return {
      ...account,
      id: to,
      periodId: "p3",
      parentId: null,
    };
  });
}

function createOwner(
  like: OwnerParty,
  id: string,
  name: string,
  unitCode: string,
): OwnerParty {
  return {
    ...like,
    id,
    personId: `md${id.slice(1)}`,
    name,
    unitCode,
    unitId: `u${unitCode}`,
    startingBalance: cents(0),
  };
}

function createPosting(
  accountId: string,
  debit: number,
  credit: number,
  counterpart: Counterpart | null,
): Posting {
  return {
    accountId,
    debit: cents(debit),
    credit: cents(credit),
    counterpart,
  };
}

function ownerOf(id: string): Counterpart {
  return { kind: "owner", id };
}

function isOwner(party: Party): party is OwnerParty {
  return party.kind === "owner";
}
