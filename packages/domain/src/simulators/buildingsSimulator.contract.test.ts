import type { LegacySeed } from "#/simulators/seed/legacySeed.ts";

import { describeBuildingsPortContract } from "../ports/__contracts__/BuildingsPortContract.ts";
import { createSmallSeed } from "../testing/createSmallBooks.ts";
import { createBuildingsSimulator } from "./buildingsSimulator.ts";
import { fixedClock } from "./fixedClock.ts";

describeBuildingsPortContract("buildings simulator", () => {
  const seed = createTwoBuildingSeed();

  return {
    port: createBuildingsSimulator(seed, fixedClock("2026-10-31T10:00:00Z")),
    expected: seed.buildings,
    buildingId: "c1",
    suppliers: ["md1", "md2"],
    unlinkedBuildingId: "c2",
    unknownBuildingId: "c99",
    otherBuildingName: "Altro",
    otherBuildingCode: "ALT",
    periodId: "p1",
    otherPeriodName: "2014",
    unknownPeriodId: "p99",
    teardown: (): void => {},
  };
});

/** The small seed's building c1 with a second period, 2014, and a second building, c2 "Altro" (ALT), with a period of its own and no supplier. */
function createTwoBuildingSeed(): LegacySeed {
  const seed = createSmallSeed();
  const [first] = seed.buildings;

  if (first === undefined) {
    throw new Error("the small seed has a building");
  }

  const [period] = first.periods;

  if (period === undefined) {
    throw new Error("the small seed's building has a period");
  }

  return {
    ...seed,
    buildings: [
      {
        ...first,
        periods: [
          period,
          {
            ...period,
            id: "p2",
            name: "2014",
            start: "2014-01-01",
            end: "2014-12-31",
          },
        ],
      },
      {
        ...first,
        id: "c2",
        name: "Altro",
        code: "ALT",
        periods: [{ ...period, id: "p3" }],
      },
    ],
  };
}
