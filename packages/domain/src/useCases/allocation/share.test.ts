import { describe, expect, it } from "vitest";

import type { Account, AccountType } from "#/entities/account.ts";
import { type Cents, cents } from "#/entities/cents.ts";
import type { OwnerParty, Restriction } from "#/entities/party.ts";
import type {
  Coefficient,
  LinkUse,
  RoleShares,
  TableLink,
} from "#/entities/table.ts";
import type { Unit } from "#/entities/unit.ts";

import { type AllocationInput, legacyRound, shareOf } from "./share.ts";

// The fixture: dt1 gives A1, A2, A3 50, 30 and 20; dt2 gives them 0, 60 and 40.
// A1 has an owner (r1) and a tenant (r2); A2 two co-owners at 60% and 40%
// (r3, r4); A3 an owner until 18 January (r5) and one from the 19th (r6).
// la10 "General" links dt1, 70% to the owners and 30% to the tenants; its
// child la11 has no links of its own, la12 links dt2 for the budget and dt1
// for the final balance, owners only.

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

function createAllocationInput(): AllocationInput {
  return {
    period: { start: "2013-01-01", end: "2013-12-31" },
    accounts: [
      createAccount("la1", null, "grouping", null, []),
      createAccount("la10", "la1", "grouping", null, [createGeneralLink()]),
      createAccount("la11", "la10", "regular", 100000, []),
      createAccount("la12", "la10", "regular", 50000, [
        createLink("el2", "la12", "dt2", "budget"),
        createLink("el3", "la12", "dt1", "finalBalance"),
      ]),
      createAccount("la20", "la1", "controlUnitResident", null, []),
      createAccount("la30", "la1", "control", null, []),
      createAccount("la40", null, "regular", 10000, []),
    ],
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
      createCoefficient("dt1", "u1", 500000),
      createCoefficient("dt1", "u2", 300000),
      createCoefficient("dt1", "u3", 200000),
      createCoefficient("dt2", "u1", 0),
      createCoefficient("dt2", "u2", 600000),
      createCoefficient("dt2", "u3", 400000),
    ],
    units: [
      createUnit("u1", "A1"),
      createUnit("u2", "A2"),
      createUnit("u3", "A3"),
    ],
    residents: [
      createResident("r1", "u1", "PR", null, null),
      createResident("r2", "u1", "CO", null, null),
      createResident("r3", "u2", "PR", 600000, null),
      createResident("r4", "u2", "PR", 400000, null),
      createResident("r5", "u3", "PR", 1000000, {
        from: null,
        to: "2013-01-18",
      }),
      createResident("r6", "u3", "PR", 1000000, {
        from: "2013-01-19",
        to: null,
      }),
    ],
    balances: new Map([
      ["la11", cents(80000)],
      ["la12", cents(20000)],
    ]),
    individual: new Map([["la20", new Map([["r1", cents(1234)]])]]),
  };
}

function createGeneralLink(): TableLink {
  return {
    ...createLink("el1", "la10", "dt1", "both"),
    roles: { 1: 7000, 2: null, 3: 3000, 4: null },
    present: { 1: true, 2: false, 3: true, 4: false },
  };
}

function createLink(
  id: string,
  accountId: string,
  tableId: string,
  use: LinkUse,
): TableLink {
  const roles: RoleShares = { 1: null, 2: null, 3: null, 4: null };

  return {
    id,
    accountId,
    tableId,
    use,
    percentage: null,
    roles,
    present: { 1: true, 2: false, 3: false, 4: false },
  };
}

function createAccount(
  id: string,
  parentId: string | null,
  type: AccountType,
  budget: number | null,
  links: TableLink[],
): Account {
  return {
    id,
    periodId: "p1",
    parentId,
    name: id,
    order: Number(id.slice(2)),
    nature: "expenses",
    type,
    role: null,
    budget: budget === null ? null : cents(budget),
    abbreviation: null,
    links,
  };
}

function createCoefficient(
  tableId: string,
  unitId: string,
  value: number,
): Coefficient {
  return { tableId, unitId, value };
}

function createUnit(id: string, code: string): Unit {
  return { id, periodId: "p1", code, groupId: null, restriction: null };
}

function createResident(
  id: string,
  unitId: string,
  role: string,
  share: number | null,
  ownRestriction: Restriction | null,
): OwnerParty {
  return {
    kind: "owner",
    id,
    personId: `person-${id}`,
    name: `Owner ${id}`,
    unitCode: unitId,
    unitId,
    startingBalance: cents(0),
    role,
    share,
    restriction: ownRestriction,
    ownRestriction,
  };
}
