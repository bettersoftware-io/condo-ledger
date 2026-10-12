import type { LegacySeed } from "#/simulators/seed/legacySeed.ts";

import { createSmallSeed } from "./createSmallBooks.ts";

/**
 * The small seed with a second period, p2, holding one account and one entry
 * of its own, and p1's entries in reverse number order: what a simulator must
 * filter by period and sort.
 */
export function createTwoPeriodSeed(): LegacySeed {
  const seed = createSmallSeed();
  const building = seed.buildings[0];
  const account = seed.accounts[0];
  const entry = seed.entries[0];
  const firstPeriod = building?.periods[0];

  if (
    building === undefined ||
    firstPeriod === undefined ||
    account === undefined ||
    entry === undefined
  ) {
    throw new Error("missing: the small seed's first building, account, entry");
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
    accounts: [...seed.accounts, { ...account, id: "x1", periodId: "p2" }],
    entries: [
      { ...entry, id: "x-e1", periodId: "p2", number: 0 },
      ...[...seed.entries].reverse(),
    ],
  };
}
