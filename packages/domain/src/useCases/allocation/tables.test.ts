import { describe, expect, it } from "vitest";

import type { OwnerParty } from "#/entities/party.ts";
import type { ThousandthTable } from "#/entities/table.ts";
import type { Unit, UnitGroup } from "#/entities/unit.ts";
import { legacySeedData } from "#/simulators/seed/legacySeed.generated.ts";
import { loadLegacySeed } from "#/simulators/seed/legacySeed.ts";
import { must } from "#/support/must.ts";
import {
  createAllocationInput,
  createCoefficient,
} from "#/testing/createAllocationInput.ts";

import {
  type CoefficientNode,
  coefficientsTreeOf,
  tableTotalsOf,
} from "./tables.ts";

describe("tableTotalsOf", () => {
  it("gives Pozzetto 2013's twelve tables the totals of the legacy report, none of them forced to 1,000", () => {
    const tables = periodTables("p36");

    expect(
      tables.map((table) => {
        return tableTotalsOf(seed.coefficients, tables).get(table.id);
      }),
    ).toEqual([
      10000000, 8240000, 8620000, 9990, 27575900, 67710000, 118770000,
      2288100000, 1458794530000, 3770000, 12100000, 180000,
    ]);
  });

  it("gives a table with no coefficients 0", () => {
    const table = createTable("dt9", null);

    expect(tableTotalsOf([], [table])).toEqual(new Map([["dt9", 0]]));
  });
});

describe("coefficientsTreeOf, Saturno 2011 (p1)", () => {
  it("shows only group A for Stairs, its restriction, worth 1,000 in all", () => {
    const tree = saturnoTree("dt3");

    expect(
      tree.map((node) => {
        return [node.key, node.kind, node.value];
      }),
    ).toEqual([["group:ug1", "group", 10000000]]);
    expect(
      must(tree[0], "group A").children.map((node) => {
        return [node.key, node.kind, node.period, node.value];
      }),
    ).toEqual([
      ["unit:u1", "unit", "01/05/2011 - 31/05/2011", 1000000],
      ["unit:u2", "unit", "27/05/2011 - end of FY", 1500000],
      ["unit:u3", "unit", "start of FY - 27/05/2011", 3000000],
      ["unit:u4", "unit", "", 4500000],
    ]);
  });

  it("shows both groups for Property, each worth the sum of its units", () => {
    const tree = saturnoTree("dt1");

    expect(
      tree.map((node) => {
        return [node.key, node.label, node.period, node.value];
      }),
    ).toEqual([
      ["group:ug1", "A - Scala A", "", 9200000],
      ["group:ug2", "B - Box", "", 800000],
    ]);
  });

  it("labels a unit with its code and its residents' names", () => {
    const b1 = must(must(saturnoTree("dt1")[1], "group B").children[0], "B1");
    const names = owners("p1")
      .filter((owner) => {
        return owner.unitCode === "B1";
      })
      .map((owner) => {
        return owner.name;
      });

    expect(names).toHaveLength(2);
    expect(b1.label).toBe(`B1 - ${names.join(", ")}`);
    expect(b1.children).toEqual([]);
  });
});

describe("coefficientsTreeOf", () => {
  it("puts subgroups, then units, under a group, both by code, and the units of no group after the groups", () => {
    const input = createAllocationInput();
    const groups = [
      createGroup("ug1", "B", null),
      createGroup("ug2", "A", "ug1"),
    ];

    const units: Unit[] = [
      ...input.units.map((unit) => {
        return { ...unit, groupId: unit.id === "u3" ? null : "ug1" };
      }),
      {
        id: "u4",
        periodId: "p1",
        code: "A0",
        groupId: "ug2",
        restriction: null,
      },
    ].reverse();

    const tree = coefficientsTreeOf(
      createTable("dt1", null),
      units,
      groups,
      [...input.coefficients, createCoefficient("dt1", "u4", 70000)],
      input.residents,
    );

    expect(tree.map(shapeOf)).toEqual([
      [
        "group:ug1",
        "B - Group B",
        870000,
        [
          ["group:ug2", "A - Group A", 70000, [["unit:u4", "A0", 70000, []]]],
          ["unit:u1", "A1 - Owner r1, Owner r2", 500000, []],
          ["unit:u2", "A2 - Owner r3, Owner r4", 300000, []],
        ],
      ],
      ["unit:u3", "A3 - Owner r5, Owner r6", 200000, []],
    ]);
  });

  it("gives a unit with no coefficient in the table 0", () => {
    const input = createAllocationInput();
    const tree = coefficientsTreeOf(
      createTable("dt2", null),
      input.units,
      [],
      input.coefficients.filter((coefficient) => {
        return coefficient.unitId !== "u2";
      }),
      [],
    );

    expect(
      tree.map((node) => {
        return [node.label, node.value];
      }),
    ).toEqual([
      ["A1", 0],
      ["A2", 0],
      ["A3", 400000],
    ]);
  });
});

function saturnoTree(tableId: string): CoefficientNode[] {
  const table = must(
    periodTables("p1").find((candidate) => {
      return candidate.id === tableId;
    }),
    tableId,
  );

  return coefficientsTreeOf(
    table,
    seed.units.filter((unit) => {
      return unit.periodId === "p1";
    }),
    seed.unitGroups.filter((group) => {
      return group.periodId === "p1";
    }),
    seed.coefficients,
    owners("p1"),
  );
}

function periodTables(periodId: string): ThousandthTable[] {
  return seed.tables.filter((table) => {
    return table.periodId === periodId;
  });
}

function owners(periodId: string): OwnerParty[] {
  return must(
    seed.parties.find((list) => {
      return list.periodId === periodId;
    }),
    `the parties of ${periodId}`,
  ).parties.filter((party) => {
    return party.kind === "owner";
  });
}

function createTable(
  id: string,
  restrictionGroupId: string | null,
): ThousandthTable {
  return {
    id,
    periodId: "p1",
    name: id,
    order: 1,
    notes: "",
    restrictionGroupId,
  };
}

function createGroup(
  id: string,
  code: string,
  parentId: string | null,
): UnitGroup {
  return { id, periodId: "p1", code, name: `Group ${code}`, parentId };
}

function shapeOf(node: CoefficientNode): unknown[] {
  return [node.key, node.label, node.value, node.children.map(shapeOf)];
}

const seed = loadLegacySeed(legacySeedData);
