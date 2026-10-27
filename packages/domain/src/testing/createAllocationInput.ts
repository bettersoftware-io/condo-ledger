import type { Account, AccountType } from "../entities/account.ts";
import { cents } from "../entities/cents.ts";
import type { OwnerParty, Restriction } from "../entities/party.ts";
import type {
  Coefficient,
  LinkUse,
  RoleShares,
  TableLink,
} from "../entities/table.ts";
import type { Unit } from "../entities/unit.ts";
import type { AllocationInput } from "../useCases/allocation/share.ts";

/**
 * A period small enough to work every share out by hand. dt1 gives A1, A2, A3
 * 50, 30 and 20; dt2 gives them 0, 60 and 40. A1 has an owner (r1) and a
 * tenant (r2); A2 two co-owners at 60% and 40% (r3, r4); A3 an owner until 18
 * January (r5) and one from the 19th (r6). la10 "General" links dt1, 70% to
 * the owners and 30% to the tenants; its child la11 has no links of its own,
 * la12 links dt2 for the budget and dt1 for the final balance, owners only.
 * la20 is individual expenses, la30 a control account, and la40 a budgeted
 * account that nothing up its chain links.
 */
export function createAllocationInput(): AllocationInput {
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

/** la10's link: dt1 for both allocations, 70% to the owners and 30% to the tenants. */
export function createGeneralLink(): TableLink {
  return {
    ...createLink("el1", "la10", "dt1", "both"),
    roles: { 1: 7000, 2: null, 3: 3000, 4: null },
    present: { 1: true, 2: false, 3: true, 4: false },
  };
}

/** A link with all of the account, to the owners only. */
export function createLink(
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

/** An expense account of p1, named and ordered by its id. */
export function createAccount(
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

export function createCoefficient(
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
