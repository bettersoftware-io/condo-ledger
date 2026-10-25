import { describe, expect, it } from "vitest";

import type { OwnerParty, Restriction } from "#/entities/party.ts";
import { must } from "#/support/must.ts";

import { legacySeedData } from "./legacySeed.generated.ts";
import { loadLegacySeed } from "./legacySeed.ts";

describe("the seed's residents: roles and period restrictions", () => {
  it("restricts Pozzetto 2013's A04 residents to either side of the owner change, and no other resident of p36", () => {
    const restricted = new Map<string, Restriction>([
      ["r166", { from: "2013-01-19", to: null }],
      ["r167", { from: null, to: "2013-01-18" }],
    ]);

    expect(restrictionsOf("p36")).toEqual(
      ownersOf("p36").map((owner) => {
        return [owner.id, restricted.get(owner.id) ?? null];
      }),
    );
  });

  it("gives Saturno 2011's residents their unit's restriction: A1, A2 and A3, and no other unit", () => {
    const byUnit = new Map<string, Restriction>([
      ["A1", { from: "2011-05-01", to: "2011-05-31" }],
      ["A2", { from: "2011-05-27", to: null }],
      ["A3", { from: null, to: "2011-05-27" }],
    ]);

    expect(restrictionsOf("p1")).toEqual(
      ownersOf("p1").map((owner) => {
        return [owner.id, byUnit.get(owner.unitCode) ?? null];
      }),
    );
    expect(
      ownersOf("p1")
        .filter((owner) => {
          return byUnit.has(owner.unitCode);
        })
        .map((owner) => {
          return owner.id;
        }),
    ).toEqual(["r1", "r2", "r3", "r4"]);
  });

  it.each([
    ["p36", ["r188"]],
    ["p1", ["r3", "r7"]],
  ])(
    "in %s, the tenants %j are CO and every other resident PR",
    (periodId, tenants) => {
      expect(
        ownersOf(periodId).map((owner) => {
          return [owner.id, owner.role];
        }),
      ).toEqual(
        ownersOf(periodId).map((owner) => {
          return [owner.id, tenants.includes(owner.id) ? "CO" : "PR"];
        }),
      );
    },
  );

  it("gives every owner party of every period a role", () => {
    const owners = seed.parties.flatMap((list) => {
      return list.parties.filter((party) => {
        return party.kind === "owner";
      });
    });

    expect(owners.length).toBeGreaterThan(0);
    expect(
      owners.filter((owner) => {
        return owner.role.trim() === "";
      }),
    ).toEqual([]);
  });
});

describe("the seed's installments: locks", () => {
  it("locks Saturno 2011's first installment, in1, and no other installment of p1 or p36", () => {
    const schedules = seed.installments.filter((installment) => {
      return installment.periodId === "p1" || installment.periodId === "p36";
    });

    expect(
      schedules.map((installment) => {
        return [installment.id, installment.locked];
      }),
    ).toEqual(
      schedules.map((installment) => {
        return [installment.id, installment.id === "in1"];
      }),
    );
    expect(schedules).toHaveLength(15);
  });
});

const seed = loadLegacySeed(legacySeedData);

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

function restrictionsOf(periodId: string): [string, Restriction | null][] {
  return ownersOf(periodId).map((owner) => {
    return [owner.id, owner.restriction];
  });
}
