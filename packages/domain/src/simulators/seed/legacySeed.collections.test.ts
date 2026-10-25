import { describe, expect, it } from "vitest";

import type { Installment, InstallmentItem } from "#/entities/installment.ts";
import type { JournalEntry, Posting } from "#/entities/journal.ts";
import type { OwnerParty, Party } from "#/entities/party.ts";
import { must } from "#/support/must.ts";
import { settleOldestFirst } from "#/useCases/collection.ts";
import {
  type ItemBalance,
  itemBalances,
  owedBy,
} from "#/useCases/installments.ts";

import { legacySeedData } from "./legacySeed.generated.ts";
import { loadLegacySeed } from "./legacySeed.ts";

describe("the seed's installments", () => {
  it("gives Pozzetto 2013 twelve installments, numbered by due date, one on the 20th of each month", () => {
    expect(
      installmentsOf("p36").map((installment) => {
        return [installment.number, installment.dueDate];
      }),
    ).toEqual(
      Array.from({ length: 12 }, (_, index) => {
        return [index + 1, `2013-${String(index + 1).padStart(2, "0")}-20`];
      }),
    );
  });

  it.each([
    ["p36", 324, 150],
    ["p1", 30, 1],
  ])("gives %s %i items, %i of them zero", (periodId, count, zero) => {
    const items = itemsOf(periodId);

    expect(items).toHaveLength(count);
    expect(
      items.filter((item) => {
        return item.amount === 0;
      }),
    ).toHaveLength(zero);
  });

  it("gives Saturno 2011 three installments, numbered by due date", () => {
    expect(
      installmentsOf("p1").map((installment) => {
        return [installment.number, installment.dueDate];
      }),
    ).toEqual([
      [1, "2011-03-15"],
      [2, "2011-07-15"],
      [3, "2011-12-15"],
    ]);
  });

  it.each(["p36", "p1"])(
    "in %s, every item's resident is a resident of the period",
    (periodId) => {
      const residents = new Set(
        partiesOf(periodId)
          .filter((party) => {
            return party.kind === "owner";
          })
          .map((party) => {
            return party.id;
          }),
      );

      for (const item of itemsOf(periodId)) {
        expect(residents.has(item.residentId)).toBe(true);
      }
    },
  );
});

describe("the seed's collections", () => {
  it("names one item of its own resident and period on every owners-account credit of a collection, 111 lines in all", () => {
    const lines = seed.entries.flatMap((entry) => {
      return entry.kind === "collection"
        ? entry.postings
            .filter((posting) => {
              return isOwnersCredit(posting);
            })
            .map((posting) => {
              return { entry, posting };
            })
        : [];
    });

    expect(lines).toHaveLength(111);

    for (const { entry, posting } of lines) {
      const item = must(
        itemsOf(entry.periodId).find((candidate) => {
          return candidate.id === posting.installmentItemId;
        }),
        `the item of a line of ${entry.id}`,
      );

      expect(posting.counterpart).toEqual({
        kind: "owner",
        id: item.residentId,
      });
    }
  });

  it("names an item on no other line", () => {
    const named = seed.entries.flatMap((entry) => {
      return entry.postings
        .filter((posting) => {
          return (
            posting.installmentItemId !== undefined &&
            !(entry.kind === "collection" && isOwnersCredit(posting))
          );
        })
        .map(() => {
          return entry.id;
        });
    });

    expect(named).toEqual([]);
  });

  it.each([
    ["p36", 2182598, 1176590, [95, 1, 78]],
    ["p1", 327997, 440895, [7, 2, 20]],
  ])(
    "in %s at period end, the collections have paid %i and %i remains; non-zero items fully, partly and not paid: %j",
    (periodId, paid, remaining, counts) => {
      const balances = balancesOf(periodId, entriesOf(periodId));
      const open = balances.filter((balance) => {
        return balance.item.amount > 0;
      });

      expect([sum(balances, "paid"), sum(balances, "remaining")]).toEqual([
        paid,
        remaining,
      ]);
      expect([
        open.filter((balance) => {
          return balance.remaining === 0;
        }).length,
        open.filter((balance) => {
          return balance.paid > 0 && balance.remaining > 0;
        }).length,
        open.filter((balance) => {
          return balance.paid === 0;
        }).length,
      ]).toEqual(counts);
    },
  );

  it("leaves Pozzetto 2013's ii789 the one item partly paid, 141.24 of 179.38", () => {
    expect(
      balancesOf("p36", entriesOf("p36"))
        .filter((balance) => {
          return balance.paid > 0 && balance.remaining > 0;
        })
        .map((balance) => {
          return [balance.item.id, balance.paid, balance.item.amount];
        }),
    ).toEqual([["ii789", 14124, 17938]]);
  });

  it("settles each Pozzetto 2013 collection, and Saturno 2011's tx166 and tx168, oldest first over what its person owed before it, into its own lines", () => {
    const entries = [
      ...collectionsOf("p36"),
      entryById("tx166"),
      entryById("tx168"),
    ];

    expect(entries).toHaveLength(38);
    expect(
      entries.map((entry) => {
        return [entry.id, settledLines(entry)];
      }),
    ).toEqual(
      entries.map((entry) => {
        return [entry.id, writtenLines(entry)];
      }),
    );
  });
});

/** The period's collections in number order. */
function collectionsOf(periodId: string): JournalEntry[] {
  return entriesOf(periodId)
    .filter((entry) => {
      return entry.kind === "collection";
    })
    .sort((a, b) => {
      return a.number - b.number;
    });
}

function entryById(id: string): JournalEntry {
  return must(
    seed.entries.find((entry) => {
      return entry.id === id;
    }),
    `the entry ${id}`,
  );
}

/** The entry's debit amount settled oldest first over what its person owed before it (the entries numbered before it), or the reason it is refused. */
function settledLines(entry: JournalEntry): Line[] | string {
  const resident = must(
    writtenCredits(entry)[0]?.counterpart?.id,
    `the resident of ${entry.id}`,
  );

  const person = must(
    partiesOf(entry.periodId)
      .filter((party): party is OwnerParty => {
        return party.kind === "owner";
      })
      .find((party) => {
        return party.id === resident;
      }),
    `the resident ${resident}`,
  );

  const amount = must(
    entry.postings.find((posting) => {
      return posting.debit > 0;
    }),
    `the debit of ${entry.id}`,
  ).debit;

  const before = entriesOf(entry.periodId).filter((candidate) => {
    return candidate.number < entry.number;
  });

  const settled = settleOldestFirst(
    amount,
    owedBy(
      person.personId,
      partiesOf(entry.periodId),
      balancesOf(entry.periodId, before),
    ),
  );

  return settled.ok
    ? settled.value.map((settlement) => {
        return { itemId: settlement.item.id, amount: settlement.amount };
      })
    : settled.reason;
}

function writtenLines(entry: JournalEntry): Line[] {
  return writtenCredits(entry).map((posting) => {
    return {
      itemId: must(posting.installmentItemId, `an item on ${entry.id}`),
      amount: posting.credit,
    };
  });
}

function writtenCredits(entry: JournalEntry): Posting[] {
  return entry.postings.filter((posting) => {
    return isOwnersCredit(posting);
  });
}

function isOwnersCredit(posting: Posting): boolean {
  return posting.credit > 0 && ownersAccounts.has(posting.accountId);
}

function balancesOf(periodId: string, entries: JournalEntry[]): ItemBalance[] {
  return itemBalances(itemsOf(periodId), installmentsOf(periodId), entries);
}

function sum(balances: ItemBalance[], field: "paid" | "remaining"): number {
  let total = 0;

  for (const balance of balances) {
    total += balance[field];
  }

  return total;
}

function installmentsOf(periodId: string): Installment[] {
  return seed.installments.filter((installment) => {
    return installment.periodId === periodId;
  });
}

function itemsOf(periodId: string): InstallmentItem[] {
  const ids = new Set(
    installmentsOf(periodId).map((installment) => {
      return installment.id;
    }),
  );

  return seed.installmentItems.filter((item) => {
    return ids.has(item.installmentId);
  });
}

function entriesOf(periodId: string): JournalEntry[] {
  return seed.entries.filter((entry) => {
    return entry.periodId === periodId;
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

/** What one collection line pays: an item and an amount. */
interface Line {
  itemId: string;
  amount: number;
}

const seed = loadLegacySeed(legacySeedData);

const ownersAccounts = new Set(
  seed.accounts
    .filter((account) => {
      return account.role === "owners";
    })
    .map((account) => {
      return account.id;
    }),
);
