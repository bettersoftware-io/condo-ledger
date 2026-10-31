import { describe, expect, it } from "vitest";

import { type Cents, cents } from "#/entities/cents.ts";
import type { OwnerParty, Restriction } from "#/entities/party.ts";
import type { TableLink } from "#/entities/table.ts";
import {
  createAccount,
  createAllocationInput,
  createCoefficient,
  createGeneralLink,
  createLink,
  createUnit,
} from "#/testing/createAllocationInput.ts";

import { type AllocationInput, legacyRound, shareOf } from "./share.ts";

// The fixture is createAllocationInput's: its doc says who pays what.

describe("legacyRound", () => {
  it("rounds a half up, toward +∞, as AS3's Math.round", () => {
    expect(legacyRound(0.125, 2)).toBe(0.13);
    expect(legacyRound(-0.125, 2)).toBe(-0.12);
  });

  it("takes 12 significant digits first, so 1.005 (100.49999… in cents) rounds to 1.01", () => {
    expect(legacyRound(1.005, 2)).toBe(1.01);
  });
});

describe("shareOf a grouping account", () => {
  it("sums its children, each rounded to the cent on its own", () => {
    // Each child is 0.35 of a budget ending in .10: 35.035 and 70.035, rounded
    // up one by one. Rounding the sum, 105.07, would give a cent less.
    const input = createAllocationInput();
    input.accounts = input.accounts.map((account) => {
      if (account.id === "la11") {
        return { ...account, budget: cents(10010) };
      }

      if (account.id === "la12") {
        return { ...account, budget: cents(20010), links: [] };
      }

      return account;
    });

    expect(shareOf(input, "budget", "la11", "r1")).toBe(3504);
    expect(shareOf(input, "budget", "la12", "r1")).toBe(7004);
    expect(shareOf(input, "budget", "la10", "r1")).toBe(10508);
  });

  it("adds its individual and control children too, down from the root", () => {
    const input = createAllocationInput();

    // la11 800.00 × 70% × 50% = 280.00; la12 200.00 × 50% = 100.00; la20 12.34.
    expect(shareOf(input, "finalBalance", "la1", "r1")).toBe(39234);
  });
});

describe("shareOf a regular account", () => {
  it("rounds each column to the cent before adding it to the account's share", () => {
    // A1's owner alone pays both columns of 100.10 × 50%: 35.035 and 15.015,
    // 35.04 + 15.02 one by one. Rounding their sum, 50.05, would give a cent less.
    const input = createAllocationInput();
    input.residents = input.residents.filter((resident) => {
      return resident.id !== "r2";
    });
    input.accounts = input.accounts.map((account) => {
      return account.id === "la11"
        ? { ...account, budget: cents(10010) }
        : account;
    });

    expect(shareOf(input, "budget", "la11", "r1")).toBe(5006);
  });

  it("takes the links of the nearest account up its chain that has any", () => {
    const input = createAllocationInput();
    input.accounts = input.accounts.map((account) => {
      return account.id === "la1"
        ? { ...account, links: [createLink("el9", "la1", "dt2", "both")] }
        : account;
    });

    // la11 has none: la10's dt1 gives A1's owner 1,000.00 × 70% × 50%.
    expect(shareOf(input, "budget", "la11", "r1")).toBe(35000);
    // la12 has its own: dt2 gives A1 nothing, where la10's would give 175.00.
    expect(shareOf(input, "budget", "la12", "r1")).toBe(0);
  });

  it("allocates nothing when no account up its chain has links", () => {
    expect(shareOf(createAllocationInput(), "budget", "la40", "r1")).toBe(0);
  });

  it("skips a link that serves the other allocation", () => {
    const input = createAllocationInput();

    // Budget: dt2 only, 500.00 × 60% × 60%; dt1 would add 90.00.
    expect(shareOf(input, "budget", "la12", "r3")).toBe(18000);
    // Final balance: dt1 only, 200.00 × 30% × 60%; dt2 would add 72.00.
    expect(shareOf(input, "finalBalance", "la12", "r3")).toBe(3600);
  });

  it("allocates on the account's balance in final-balance mode and its budget in budget mode", () => {
    const input = createAllocationInput();

    expect(shareOf(input, "budget", "la11", "r3")).toBe(18000);
    expect(shareOf(input, "finalBalance", "la11", "r3")).toBe(14400);
  });

  it("gives nothing to a unit whose coefficient is 0 or missing", () => {
    const input = createAllocationInput();

    expect(shareOf(input, "budget", "la12", "r1")).toBe(0);

    input.coefficients = input.coefficients.filter((coefficient) => {
      return !(coefficient.tableId === "dt2" && coefficient.unitId === "u1");
    });

    expect(shareOf(input, "budget", "la12", "r1")).toBe(0);
  });

  it("gives nothing through a table whose total is 0", () => {
    const input = createAllocationInput();
    input.coefficients = input.coefficients.map((coefficient) => {
      return coefficient.tableId === "dt2"
        ? { ...coefficient, value: 0 }
        : coefficient;
    });

    expect(shareOf(input, "budget", "la12", "r3")).toBe(0);
  });

  it("takes the link's percentage of the account", () => {
    const quarter = { ...createGeneralLink(), percentage: 2500 };
    const rest = { ...createGeneralLink(), id: "el4", percentage: 7500 };

    // 1,000.00 × 25% × 70% × 50%, then the other 75% through a second link.
    expect(shareOf(withGeneralLinks([quarter]), "budget", "la11", "r1")).toBe(
      8750,
    );
    expect(
      shareOf(withGeneralLinks([quarter, rest]), "budget", "la11", "r1"),
    ).toBe(35000);
  });
});

describe("shareOf, the role columns a resident is elected for", () => {
  it("with a tenant, charges the owner only priority 1 and the tenant priority 3", () => {
    const input = createAllocationInput();

    expect(shareOf(input, "budget", "la11", "r1")).toBe(35000);
    expect(shareOf(input, "budget", "la11", "r2")).toBe(15000);
  });

  it("without one, charges the owner priority 3 too", () => {
    const input = createAllocationInput();
    input.residents = input.residents.filter((resident) => {
      return resident.id !== "r2";
    });

    expect(shareOf(input, "budget", "la11", "r1")).toBe(50000);
  });

  it("never charges a tenant an owner's column", () => {
    expect(shareOf(createAllocationInput(), "budget", "la12", "r2")).toBe(0);
  });

  it("splits a PR 50% / CO 50% link evenly", () => {
    const input = withGeneralLinks([
      { ...createGeneralLink(), roles: { 1: 5000, 2: null, 3: 5000, 4: null } },
    ]);

    expect(shareOf(input, "budget", "la11", "r1")).toBe(25000);
    expect(shareOf(input, "budget", "la11", "r2")).toBe(25000);
  });

  it("charges all of a column that has a row with no percentage", () => {
    const input = withGeneralLinks([
      { ...createGeneralLink(), roles: { 1: null, 2: null, 3: 3000, 4: null } },
    ]);

    expect(shareOf(input, "budget", "la11", "r1")).toBe(50000);
  });

  it("reads a resident's priority from the role: NP, LE pay as PR, US, CF on priority 2, SC on 4", () => {
    const input = withGeneralLinks([
      {
        ...createGeneralLink(),
        roles: { 1: 1000, 2: 2000, 3: 3000, 4: 4000 },
        present: { 1: true, 2: true, 3: true, 4: true },
      },
    ]);

    // Alone in A1, each pays its own column and every later one.
    expect(shareAsRole(input, "NP")).toBe(50000);
    expect(shareAsRole(input, "LE")).toBe(50000);
    expect(shareAsRole(input, "US")).toBe(45000);
    expect(shareAsRole(input, "CF")).toBe(45000);
    expect(shareAsRole(input, "CO")).toBe(35000);
    expect(shareAsRole(input, "SC")).toBe(20000);
  });

  it("refuses a role it does not know", () => {
    const input = createAllocationInput();
    input.residents = input.residents.map((resident) => {
      return resident.id === "r1" ? { ...resident, role: "XX" } : resident;
    });

    expect(() => {
      return shareOf(input, "budget", "la11", "r1");
    }).toThrow("unknown role: XX");
  });
});

describe("shareOf, co-ownership", () => {
  it("gives co-owners with percentages those percentages", () => {
    const input = createAllocationInput();

    // A2's 300.00 on la11, 60% and 40% of it.
    expect(shareOf(input, "budget", "la11", "r3")).toBe(18000);
    expect(shareOf(input, "budget", "la11", "r4")).toBe(12000);
  });

  it("gives nothing to a co-owner with no percentage beside one who has one", () => {
    const input = withShares(createAllocationInput(), 600000, null);

    expect(shareOf(input, "budget", "la11", "r3")).toBe(18000);
    expect(shareOf(input, "budget", "la11", "r4")).toBe(0);
  });

  it("halves between co-owners with no percentage", () => {
    const input = withShares(createAllocationInput(), null, null);

    expect(shareOf(input, "budget", "la11", "r3")).toBe(15000);
    expect(shareOf(input, "budget", "la11", "r4")).toBe(15000);
  });

  it("halves between co-owners whose percentages are both 0", () => {
    const input = withShares(createAllocationInput(), 0, 0);

    expect(shareOf(input, "budget", "la11", "r3")).toBe(15000);
    expect(shareOf(input, "budget", "la11", "r4")).toBe(15000);
  });

  it("divides by the co-owners with no percentage when the others' are 0, as the legacy does", () => {
    const input = withShares(createAllocationInput(), 0, null);

    expect(shareOf(input, "budget", "la11", "r3")).toBe(30000);
    expect(shareOf(input, "budget", "la11", "r4")).toBe(30000);
  });

  it("counts an owner and a tenant of one unit apart", () => {
    const input = createAllocationInput();
    input.residents = input.residents.map((resident) => {
      return resident.id === "r1" ? { ...resident, share: 1000000 } : resident;
    });

    expect(shareOf(input, "budget", "la11", "r2")).toBe(15000);
  });
});

describe("shareOf, residency", () => {
  it("prorates a resident with own dates, 18/365 and 347/365", () => {
    const input = createAllocationInput();

    // A3's 200.00 on la11: 140.00 and 60.00, each × 18/365 and × 347/365.
    expect(shareOf(input, "budget", "la11", "r5")).toBe(690 + 296);
    expect(shareOf(input, "budget", "la11", "r6")).toBe(13310 + 5704);
  });

  it("does not prorate a resident restricted only by the unit's dates", () => {
    const input = createAllocationInput();
    const may: Restriction = { from: "2013-05-01", to: "2013-05-31" };
    input.units = input.units.map((unit) => {
      return unit.id === "u1" ? { ...unit, restriction: may } : unit;
    });
    input.residents = input.residents.map((resident) => {
      return resident.unitId === "u1"
        ? { ...resident, restriction: may }
        : resident;
    });

    expect(shareOf(input, "budget", "la11", "r1")).toBe(35000);
  });

  it("runs an open end of the resident's dates to the unit's, over the unit's days", () => {
    const input = createAllocationInput();
    input.units = input.units.map((unit) => {
      return unit.id === "u3"
        ? { ...unit, restriction: { from: "2013-01-02", to: "2013-01-31" } }
        : unit;
    });

    // 2–18 January of the unit's 2–31: 17/30 and 13/30.
    expect(shareOf(input, "budget", "la11", "r5")).toBe(7933 + 3400);
    expect(shareOf(input, "budget", "la11", "r6")).toBe(6067 + 2600);
  });

  it("fails, naming the resident and the unit, for own dates outside the unit's", () => {
    const input = createAllocationInput();
    input.units = input.units.map((unit) => {
      return unit.id === "u3"
        ? { ...unit, restriction: { from: "2013-02-01", to: null } }
        : unit;
    });

    // r5's own dates end on 18 January, before the unit's begin.
    expect(() => {
      return shareOf(input, "budget", "la11", "r5");
    }).toThrow("the dates of resident r5 lie within unit A3's");
  });
});

describe("shareOf, the other kinds of account", () => {
  it("charges an individual-expense account nothing in the budget, and the resident's own postings in the final balance", () => {
    const input = createAllocationInput();

    expect(shareOf(input, "budget", "la20", "r1")).toBe(0);
    expect(shareOf(input, "finalBalance", "la20", "r1")).toBe(1234);
    expect(shareOf(input, "finalBalance", "la20", "r3")).toBe(0);

    input.individual = new Map();

    expect(shareOf(input, "finalBalance", "la20", "r1")).toBe(0);
  });

  it("charges nothing on a control account", () => {
    const input = createAllocationInput();

    expect(shareOf(input, "budget", "la30", "r1")).toBe(0);
    expect(shareOf(input, "finalBalance", "la30", "r1")).toBe(0);
  });

  it("allocates nothing from an account with no budget or no balance", () => {
    const input = createAllocationInput();
    input.accounts = input.accounts.map((account) => {
      return account.id === "la11" ? { ...account, budget: null } : account;
    });
    input.balances = new Map();

    expect(shareOf(input, "budget", "la11", "r1")).toBe(0);
    expect(shareOf(input, "finalBalance", "la11", "r1")).toBe(0);
  });
});

describe("shareOf with successive owners", () => {
  it("splits a unit between two owners without a percentage, both for the whole period", () => {
    const input = createOneUnit([
      createOwner("a", null, null),
      createOwner("b", null, null),
    ]);

    expect(shareOf(input, "budget", "la1", "a")).toBe(50000);
    expect(shareOf(input, "budget", "la1", "b")).toBe(50000);
  });

  it("gives each of two owners whose dates do not overlap the whole share for their own days", () => {
    const input = createOneUnit([
      createOwner("out", null, { from: null, to: "2013-06-30" }),
      createOwner("in", null, { from: "2013-07-01", to: null }),
    ]);

    expect(shareOf(input, "budget", "la1", "out")).toBe(49589);
    expect(shareOf(input, "budget", "la1", "in")).toBe(50411);
  });

  it("does the same when the outgoing owner carries 100% and the incoming one none", () => {
    const input = createOneUnit([
      createOwner("out", 1000000, { from: null, to: "2013-06-30" }),
      createOwner("in", null, { from: "2013-07-01", to: null }),
    ]);

    expect(shareOf(input, "budget", "la1", "out")).toBe(49589);
    expect(shareOf(input, "budget", "la1", "in")).toBe(50411);
  });

  it("applies the legacy rule to owners whose dates overlap by one day", () => {
    const input = createOneUnit([
      createOwner("out", null, { from: null, to: "2013-07-01" }),
      createOwner("in", null, { from: "2013-07-01", to: null }),
    ]);

    // Half each of their days: 182 and 184 of 365.
    expect(shareOf(input, "budget", "la1", "out")).toBe(24932);
    expect(shareOf(input, "budget", "la1", "in")).toBe(25205);
  });

  it("gives each of two owners of a restricted unit whose dates do not overlap the whole share for their own days of the unit's", () => {
    const input = createOneUnit([
      createOwner("out", null, { from: null, to: "2013-04-30" }),
      createOwner("in", null, { from: "2013-05-01", to: null }),
    ]);
    input.units = input.units.map((unit) => {
      return { ...unit, restriction: { from: "2013-03-01", to: "2013-08-31" } };
    });

    // 61 and 123 of the unit's 184 days, March to August.
    expect(shareOf(input, "budget", "la1", "out")).toBe(33152);
    expect(shareOf(input, "budget", "la1", "in")).toBe(66848);
  });

  it("reads an owner without dates as the unit's, else the period's", () => {
    const input = createOneUnit([
      createOwner("whole", null, null),
      createOwner("late", null, { from: "2013-07-01", to: null }),
    ]);
    input.units = input.units.map((unit) => {
      return { ...unit, restriction: { from: "2013-03-01", to: null } };
    });

    // The first runs 1 March to 31 December, so they overlap: half each, the
    // newcomer for 184 of the unit's 306 days.
    expect(shareOf(input, "budget", "la1", "whole")).toBe(50000);
    expect(shareOf(input, "budget", "la1", "late")).toBe(30065);
  });
});

function shareAsRole(input: AllocationInput, role: string): Cents {
  const alone: AllocationInput = {
    ...input,
    residents: input.residents
      .filter((resident) => {
        return resident.id !== "r2";
      })
      .map((resident) => {
        return resident.id === "r1" ? { ...resident, role } : resident;
      }),
  };

  return shareOf(alone, "budget", "la11", "r1");
}

function withGeneralLinks(links: TableLink[]): AllocationInput {
  const input = createAllocationInput();
  input.accounts = input.accounts.map((account) => {
    return account.id === "la10" ? { ...account, links } : account;
  });

  return input;
}

function withShares(
  input: AllocationInput,
  r3: number | null,
  r4: number | null,
): AllocationInput {
  return {
    ...input,
    residents: input.residents.map((resident) => {
      if (resident.id === "r3") {
        return { ...resident, share: r3 };
      }

      return resident.id === "r4" ? { ...resident, share: r4 } : resident;
    }),
  };
}

function createOneUnit(residents: OwnerParty[]): AllocationInput {
  const base = createAllocationInput();

  return {
    ...base,
    accounts: [
      createAccount("la1", null, "regular", 100000, [
        createLink("el1", "la1", "dt1", "budget"),
      ]),
    ],
    coefficients: [createCoefficient("dt1", "u1", 1000)],
    units: [createUnit("u1", "A1")],
    residents,
  };
}

function createOwner(
  id: string,
  share: number | null,
  ownRestriction: Restriction | null,
): OwnerParty {
  return {
    kind: "owner",
    id,
    personId: `person-${id}`,
    name: id,
    unitCode: "A1",
    unitId: "u1",
    startingBalance: cents(0),
    role: "PR",
    share,
    restriction: ownRestriction,
    ownRestriction,
  };
}
