import { cents } from "#/entities/cents.ts";
import type { LegacySeed } from "#/simulators/seed/legacySeed.ts";

import { createSmallSeed } from "./createSmallBooks.ts";

/**
 * The small seed with a second period, p2, holding books of its own (a cash
 * account and a suppliers account, one entry between them naming supplier
 * md1), and p1's entries in reverse number order: what a simulator must
 * filter by period and sort. p2's books are whole, so the chart of accounts
 * can be built from them too.
 */
export function createTwoPeriodSeed(): LegacySeed {
  const seed = createSmallSeed();
  const building = seed.buildings[0];
  const cash = seed.accounts.find((account) => {
    return account.id === "la1";
  });

  const suppliers = seed.accounts.find((account) => {
    return account.id === "la4";
  });
  const entry = seed.entries[0];
  const firstPeriod = building?.periods[0];

  if (
    building === undefined ||
    firstPeriod === undefined ||
    cash === undefined ||
    suppliers === undefined ||
    entry === undefined
  ) {
    throw new Error(
      "missing: the small seed's first building, cash and suppliers accounts, first entry",
    );
  }

  return {
    ...seed,
    buildings: [
      {
        ...building,
        periods: [
          ...building.periods,
          { ...firstPeriod, id: "p2", name: "2014" },
        ],
      },
    ],
    accounts: [
      ...seed.accounts,
      { ...cash, id: "x1", periodId: "p2", parentId: null },
      { ...suppliers, id: "x4", periodId: "p2" },
    ],
    entries: [
      {
        ...entry,
        id: "x-e1",
        periodId: "p2",
        number: 0,
        postings: [
          {
            accountId: "x1",
            debit: cents(36018),
            credit: cents(0),
            counterpart: null,
          },
          {
            accountId: "x4",
            debit: cents(0),
            credit: cents(36018),
            counterpart: { kind: "supplier", id: "md1" },
          },
        ],
      },
      ...[...seed.entries].reverse(),
    ],
  };
}
