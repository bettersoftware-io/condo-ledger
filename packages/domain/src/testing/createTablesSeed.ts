import type { UnitGroup } from "#/entities/unit.ts";
import type { LegacySeed } from "#/simulators/seed/legacySeed.ts";

import { createCoefficient, createLink } from "./createAllocationInput.ts";
import { createTwoPeriodSeed } from "./createTwoPeriodSeed.ts";

/**
 * The two-period seed with thousandth tables. p1 has the units uA01, uA02 and
 * uB01, the groups ugA (holding the first two) and ugB, and two tables:
 * dt1 "Property" (order 1), which la21 links, and dt2 "Lift" (order 2),
 * which nothing links. dt1 gives the units 5, 3 and 2 thousandths, dt2 gives
 * them 0, 6 and 4. p2 has no units and no tables.
 */
export function createTablesSeed(): LegacySeed {
  const seed = createTwoPeriodSeed();

  return {
    ...seed,
    accounts: seed.accounts.map((account) => {
      return account.id === "la21"
        ? { ...account, links: [createLink("el1", "la21", "dt1", "budget")] }
        : account;
    }),
    units: seed.units.map((unit) => {
      return { ...unit, groupId: unit.code === "B01" ? "ugB" : "ugA" };
    }),
    unitGroups: [createGroup("ugA", "A"), createGroup("ugB", "B")],
    tables: [
      {
        id: "dt1",
        periodId: "p1",
        name: "Property",
        order: 1,
        notes: "",
        restrictionGroupId: null,
      },
      {
        id: "dt2",
        periodId: "p1",
        name: "Lift",
        order: 2,
        notes: "",
        restrictionGroupId: null,
      },
    ],
    coefficients: [
      createCoefficient("dt1", "uA01", 50000),
      createCoefficient("dt1", "uA02", 30000),
      createCoefficient("dt1", "uB01", 20000),
      createCoefficient("dt2", "uA01", 0),
      createCoefficient("dt2", "uA02", 60000),
      createCoefficient("dt2", "uB01", 40000),
    ],
  };
}

function createGroup(id: string, code: string): UnitGroup {
  return {
    id,
    periodId: "p1",
    code,
    name: code,
    parentId: null,
    address: null,
    notes: null,
  };
}
