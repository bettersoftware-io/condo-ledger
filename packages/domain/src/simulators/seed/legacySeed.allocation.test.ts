import { describe, expect, it } from "vitest";

import type { Account } from "#/entities/account.ts";
import type { OwnerParty } from "#/entities/party.ts";
import type { Coefficient, ThousandthTable } from "#/entities/table.ts";
import type { Unit, UnitGroup } from "#/entities/unit.ts";
import { must } from "#/support/must.ts";

import { legacySeedData } from "./legacySeed.generated.ts";
import { loadLegacySeed } from "./legacySeed.ts";

describe("the seed's allocation data: Saturno 2011 (p1)", () => {
  it("has five tables in order: Property, General residents, Stairs restricted to group A, Water budget, Water actual", () => {
    expect(
      tablesOf("p1").map((table) => {
        return [table.id, table.name, table.order, table.restrictionGroupId];
      }),
    ).toEqual([
      ["dt1", "Proprietà", 1, null],
      ["dt2", "Generale residenti", 2, null],
      ["dt3", "Scale", 3, groupA().id],
      ["dt4", "Acqua preventivo", 4, null],
      ["dt5", "Acqua consuntivo", 5, null],
    ]);
  });

  it("has 36 coefficients, A1's in Property 100 (1000000 ten-thousandths)", () => {
    const a1 = unitOf("p1", "A1");

    expect(coefficientsOf("p1")).toHaveLength(36);
    expect(
      seed.coefficients.find((coefficient) => {
        return coefficient.tableId === "dt1" && coefficient.unitId === a1.id;
      })?.value,
    ).toBe(1000000);
  });

  it("has the groups A and B and eight units, A1 to A4 in A and B1 to B4 in B", () => {
    const groups = groupsOf("p1");
    const b = must(
      groups.find((group) => {
        return group.code === "B";
      }),
      "group B",
    );

    expect(
      groups.map((group) => {
        return [group.code, group.parentId];
      }),
    ).toEqual([
      ["A", null],
      ["B", null],
    ]);
    expect(
      unitsOf("p1").map((unit) => {
        return [unit.code, unit.groupId];
      }),
    ).toEqual([
      ["A1", groupA().id],
      ["A2", groupA().id],
      ["A3", groupA().id],
      ["A4", groupA().id],
      ["B1", b.id],
      ["B2", b.id],
      ["B3", b.id],
      ["B4", b.id],
    ]);
  });

  it("gives la49, the revenue its budget allocation credits, the role budgetAllocation", () => {
    expect(accountOf("la49").role).toBe("budgetAllocation");
  });

  it("links the Water account to el84 for the budget and el85 for the final balance", () => {
    const water = must(
      seed.accounts.find((account) => {
        return account.links.some((link) => {
          return link.id === "el84";
        });
      }),
      "the account linked by el84",
    );

    expect(
      water.links.map((link) => {
        return [link.id, link.tableId, link.use];
      }),
    ).toEqual([
      ["el84", "dt4", "budget"],
      ["el85", "dt5", "finalBalance"],
    ]);
  });
});

describe("the seed's allocation data: Pozzetto 2013 (p36)", () => {
  it("has 12 tables, 216 coefficients, 18 units and no groups", () => {
    expect([
      tablesOf("p36").length,
      coefficientsOf("p36").length,
      unitsOf("p36").length,
      groupsOf("p36").length,
    ]).toEqual([12, 216, 18, 0]);
  });

  it("gives r166 and r167 (A04) their own dates either side of the owner change, and no other owner of p36 any", () => {
    const own = new Map([
      ["r166", { from: "2013-01-19", to: null }],
      ["r167", { from: null, to: "2013-01-18" }],
    ]);

    expect(
      ownersOf("p36").map((owner) => {
        return [owner.id, owner.ownRestriction];
      }),
    ).toEqual(
      ownersOf("p36").map((owner) => {
        return [owner.id, own.get(owner.id) ?? null];
      }),
    );
  });

  it("abbreviates la172 Generali PR and links it to dt14, 100% on the owners' role", () => {
    const account = accountOf("la172");

    expect(account.abbreviation).toBe("Generali PR");
    expect(
      account.links.map((link) => {
        return [link.tableId, link.roles[1], link.present[1]];
      }),
    ).toEqual([["dt14", 10000, true]]);
  });
});

describe("the seed's owners and units", () => {
  it("names a unit of its own period on every owner party", () => {
    const strays = seed.parties.flatMap((list) => {
      const units = new Set(
        unitsOf(list.periodId).map((unit) => {
          return unit.id;
        }),
      );

      return list.parties.filter((party) => {
        return party.kind === "owner" && !units.has(party.unitId);
      });
    });

    expect(seed.units.length).toBeGreaterThan(0);
    expect(strays).toEqual([]);
  });
});

const seed = loadLegacySeed(legacySeedData);

function tablesOf(periodId: string): ThousandthTable[] {
  return seed.tables.filter((table) => {
    return table.periodId === periodId;
  });
}

function coefficientsOf(periodId: string): Coefficient[] {
  const tables = new Set(
    tablesOf(periodId).map((table) => {
      return table.id;
    }),
  );

  return seed.coefficients.filter((coefficient) => {
    return tables.has(coefficient.tableId);
  });
}

function unitsOf(periodId: string): Unit[] {
  return seed.units.filter((unit) => {
    return unit.periodId === periodId;
  });
}

function unitOf(periodId: string, code: string): Unit {
  return must(
    unitsOf(periodId).find((unit) => {
      return unit.code === code;
    }),
    `the unit ${code} of ${periodId}`,
  );
}

function groupsOf(periodId: string): UnitGroup[] {
  return seed.unitGroups.filter((group) => {
    return group.periodId === periodId;
  });
}

function groupA(): UnitGroup {
  return must(
    groupsOf("p1").find((group) => {
      return group.code === "A";
    }),
    "group A of p1",
  );
}

function accountOf(id: string): Account {
  return must(
    seed.accounts.find((account) => {
      return account.id === id;
    }),
    `the account ${id}`,
  );
}

function ownersOf(periodId: string): OwnerParty[] {
  return must(
    seed.parties.find((list) => {
      return list.periodId === periodId;
    }),
    `the parties of ${periodId}`,
  ).parties.filter((party) => {
    return party.kind === "owner";
  });
}
