import { describe, expect, it } from "vitest";

import type { AccountRole } from "#/entities/account.ts";
import type { Unit } from "#/entities/unit.ts";
import { must } from "#/support/must.ts";

import { legacySeedData } from "./legacySeed.generated.ts";
import { loadLegacySeed } from "./legacySeed.ts";

describe("the seed's buildings, units, contacts and account roles", () => {
  it("gives Saturno its code, type, status, construction date and address", () => {
    expect(buildingProfile("c1")).toEqual({
      code: "SAT",
      type: "building",
      status: "active",
      constructionDate: "1980-05-20",
      address: {
        street: "Piazza del Duomo, 39",
        postcode: "33033",
        city: "Codroipo",
      },
    });
  });

  it("gives Pozzetto no code and an address", () => {
    expect(buildingProfile("c19")).toEqual({
      code: null,
      type: "building",
      status: "active",
      constructionDate: null,
      address: {
        street: "Piazza Libertà, 74",
        postcode: "33045",
        city: "Nimis",
      },
    });
  });

  it("gives Saturno 2011's units their floor, interior, sub-unit and type", () => {
    expect(unitsOf("p1")).toEqual([
      ["A1", "1", "1", null, "shop"],
      ["A2", "1", "2", "a", "shop"],
      ["A3", "1", "3", null, "apartment"],
      ["A4", "1", "4", null, "apartment"],
      ["B1", "-1", "1", null, "garage"],
      ["B2", "-1", "2", null, "garage"],
      ["B3", "-1", "3", null, "garage"],
      ["B4", "-1", "4", null, "garage"],
    ]);
  });

  it("gives each of Saturno 2011's groups an address", () => {
    expect(
      seed.unitGroups
        .filter((group) => {
          return group.periodId === "p1";
        })
        .map((group) => {
          return [group.id, group.address !== null];
        }),
    ).toEqual([
      ["ug1", true],
      ["ug2", true],
    ]);
  });

  it("gives Pozzetto 2013's units a type and no floor, interior or sub-unit", () => {
    const apartments = Array.from({ length: 16 }, (_, index) => {
      return [
        `A${String(index + 1).padStart(2, "0")}`,
        null,
        null,
        null,
        "apartment",
      ];
    });

    expect(unitsOf("p36")).toEqual([
      ...apartments,
      ["A17", null, null, null, "premises"],
      ["A18", null, null, null, "premises"],
    ]);
  });

  it.each([
    ["c1", 6],
    ["c19", 12],
  ])("links %s to %i suppliers", (buildingId, count) => {
    expect(
      seed.supplierLinks.filter((link) => {
        return link.buildingId === buildingId;
      }),
    ).toHaveLength(count);
  });

  it("holds the contact of every supplier link and of every owner", () => {
    const contactIds = new Set(
      seed.contacts.map((contact) => {
        return contact.id;
      }),
    );

    const named = [
      ...seed.supplierLinks.map((link) => {
        return link.contactId;
      }),
      ...seed.parties.flatMap((list) => {
        return list.parties.flatMap((party) => {
          return party.kind === "owner" ? [party.personId] : [];
        });
      }),
    ];

    expect(
      named.filter((id) => {
        return !contactIds.has(id);
      }),
    ).toEqual([]);
  });

  it.each([["p1"], ["p36"]])(
    "gives %s one top-level liquidity account and one top-level funds account",
    (periodId) => {
      expect([
        rolesOf(periodId, "liquidity"),
        rolesOf(periodId, "funds"),
      ]).toEqual([[null], [null]]);
    },
  );
});

const seed = loadLegacySeed(legacySeedData);

/** The profile fields a building's test reads. */
interface BuildingProfile {
  code: string | null;
  type: string;
  status: string;
  constructionDate: string | null;
  address: unknown;
}

function buildingProfile(id: string): BuildingProfile {
  const building = must(
    seed.buildings.find((candidate) => {
      return candidate.id === id;
    }),
    `the building ${id}`,
  );

  return {
    code: building.code,
    type: building.type,
    status: building.status,
    constructionDate: building.constructionDate,
    address: building.address,
  };
}

function unitsOf(periodId: string): (string | null)[][] {
  return seed.units
    .filter((unit) => {
      return unit.periodId === periodId;
    })
    .map((unit: Unit) => {
      return [unit.code, unit.floor, unit.interior, unit.subUnit, unit.type];
    });
}

/** The parent of each of the period's accounts with the role. */
function rolesOf(periodId: string, role: AccountRole): (string | null)[] {
  return seed.accounts
    .filter((account) => {
      return account.periodId === periodId && account.role === role;
    })
    .map((account) => {
      return account.parentId;
    });
}
