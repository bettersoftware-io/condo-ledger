import { describe, expect, it } from "vitest";

import { cents } from "#/entities/cents.ts";
import type { Installment, InstallmentItem } from "#/entities/installment.ts";
import type { OwnerParty } from "#/entities/party.ts";
import type { UnitGroup } from "#/entities/unit.ts";
import { must } from "#/support/must.ts";
import {
  createAllocationInput,
  createUnit,
} from "#/testing/createAllocationInput.ts";
import { createSeedUnitsBooks } from "#/testing/createSeedUnitsBooks.ts";

import { type UnitsBooks, type UnitsRow, unitsListOf } from "./unitsList.ts";

describe("unitsListOf on the seed", () => {
  it("heads Saturno with the building label and the period's dates, over group A, group B, then the rounding row", () => {
    const books = createSeedUnitsBooks("p1");
    const list = unitsListOf(books, TODAY);

    expect(list.unitCount).toBe(8);
    expect(list.root).toMatchObject({
      key: "root",
      kind: "root",
      label: books.buildingLabel,
      icon: "building",
      restriction: "01/01/2011 - 31/12/2011",
      unitId: null,
      residentId: null,
      groupId: null,
      type: null,
    });
    expect(
      list.root.children.map((row) => {
        return [row.key, row.kind, row.icon];
      }),
    ).toEqual([
      ["group:ug1", "group", "group"],
      ["group:ug2", "group", "group"],
      ["rounding", "rounding", "rounding"],
    ]);
    expect(list.root.children[2]?.label).toBe("Rounding error");
  });

  it("labels a group with its code, name and address", () => {
    const group = must(
      unitsListOf(createSeedUnitsBooks("p1"), TODAY).root.children[0],
      "group A",
    );

    expect(group).toMatchObject({
      label: "A - Stairwell A (Piazza del Duomo, 39/a, 33033 Codroipo)",
      groupId: "ug1",
      restriction: "",
    });
    expect(
      group.children.map((row) => {
        return row.key;
      }),
    ).toEqual(["unit:u1", "unit:u2", "unit:u3", "unit:u4"]);
  });

  it("draws Saturno A1, a unit with one owner, as one row carrying the unit and the owner", () => {
    const books = createSeedUnitsBooks("p1");
    const a1 = rowWithKey(unitsListOf(books, TODAY).root, "unit:u1");

    expect(a1).toMatchObject({
      kind: "unit",
      label: `A1 - ${residentNamed(books, "r1").name} (PR)`,
      icon: "shop",
      unitId: "u1",
      residentId: "r1",
      groupId: "ug1",
      floor: "1",
      interior: "1",
      subUnit: "",
      type: "shop",
      restriction: "01/05/2011 - 31/05/2011",
      children: [],
    });
  });

  it("draws Pozzetto A04 over its two owners, each with their own dates", () => {
    const books = createSeedUnitsBooks("p36");
    const a04 = rowWithKey(unitsListOf(books, TODAY).root, "unit:u137");
    const r166 = residentNamed(books, "r166");
    const r167 = residentNamed(books, "r167");

    expect(a04).toMatchObject({
      kind: "unit",
      label: `A04 - ${r167.name}, ${r166.name}`,
      icon: "apartment",
      unitId: "u137",
      residentId: null,
      groupId: null,
      type: "apartment",
      restriction: "",
    });
    expect(
      a04.children.map((row) => {
        return [
          row.key,
          row.kind,
          row.label,
          row.icon,
          row.unitId,
          row.restriction,
          row.type,
        ];
      }),
    ).toEqual([
      [
        "resident:r167",
        "resident",
        `${r167.name} (PR 100%)`,
        "owner",
        "u137",
        "start of FY - 18/01/2013",
        null,
      ],
      [
        "resident:r166",
        "resident",
        `${r166.name} (PR 100%)`,
        "owner",
        "u137",
        "19/01/2013 - end of FY",
        null,
      ],
    ]);
  });

  it("halves an owner's Budget and Actual when a second owner without a percentage moves in, the unit's total unchanged", () => {
    const books = createSeedUnitsBooks("p1");
    const before = rowWithKey(unitsListOf(books, TODAY).root, "unit:u3");
    const owner = residentNamed(books, "r4");
    const newcomer: OwnerParty = {
      ...owner,
      id: "r-new-1",
      startingBalance: cents(0),
    };

    const after = rowWithKey(
      unitsListOf(withResident(books, newcomer), TODAY).root,
      "unit:u3",
    );

    expect(
      after.children.map((row) => {
        return [row.residentId, row.budget, row.actual];
      }),
    ).toEqual([
      ["r4", 108716, 36828],
      ["r-new-1", 108716, 36828],
    ]);
    expect(after.budget).toBe(before.budget);
    expect(after.actual).toBe(before.actual);
  });

  it("gives an owner who moves in after the first one leaves the whole share for their own days", () => {
    const books = createSeedUnitsBooks("p1");
    const owner = residentNamed(books, "r5");
    const leaving: OwnerParty = {
      ...owner,
      restriction: { from: null, to: "2011-06-30" },
      ownRestriction: { from: null, to: "2011-06-30" },
    };

    const arriving: OwnerParty = {
      ...owner,
      id: "r-new-1",
      startingBalance: cents(0),
      restriction: { from: "2011-07-01", to: null },
      ownRestriction: { from: "2011-07-01", to: null },
    };
    const before = rowWithKey(unitsListOf(books, TODAY).root, "unit:u4");
    const after = rowWithKey(
      unitsListOf(
        withResident(replaceResident(books, leaving), arriving),
        TODAY,
      ).root,
      "unit:u4",
    );
    const [first, second] = after.children;

    // Each share is rounded to the cent link by link, as the legacy rounds it.
    expect(
      Math.abs(must(first, "r5").budget - (before.budget * 181) / 365),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(
        must(second, "the newcomer").budget - (before.budget * 184) / 365,
      ),
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(after.budget - before.budget)).toBeLessThanOrEqual(1);
  });
});

describe("unitsListOf", () => {
  it("labels a unit by its name when it has one, and by its code alone when no one lives in it", () => {
    const books = createSmallBooks();
    books.units = books.units.map((unit) => {
      return unit.id === "u2" ? { ...unit, name: "Portineria" } : unit;
    });
    books.units.push(createUnit("u4", "Z1"));
    books.allocation.input.units = books.units;

    const { root } = unitsListOf(books, "2013-06-30");

    expect(rowWithKey(root, "unit:u2").label).toBe("A2 - Portineria");
    expect(rowWithKey(root, "unit:u4")).toMatchObject({
      label: "Z1",
      previousBalance: 0,
      budget: 0,
      actual: 0,
      due: 0,
      paid: 0,
      overdue: 0,
      adjustment: 0,
      children: [],
    });
  });

  it("shows the unit's own dates on the row of a unit with one resident, not the resident's", () => {
    const books = createSmallBooks();
    books.units = books.units.map((unit) => {
      return unit.id === "u2"
        ? { ...unit, restriction: { from: "2013-03-01", to: null } }
        : unit;
    });
    books.allocation.input.units = books.units;
    books.allocation.input.residents = books.allocation.input.residents
      .filter((resident) => {
        return resident.id !== "r4";
      })
      .map((resident) => {
        return resident.id === "r3"
          ? {
              ...resident,
              share: null,
              ownRestriction: { from: "2013-04-01", to: "2013-09-30" },
            }
          : resident;
      });
    books.schedule.parties = books.allocation.input.residents;

    expect(
      rowWithKey(unitsListOf(books, "2013-06-30").root, "unit:u2"),
    ).toMatchObject({
      residentId: "r3",
      restriction: "01/03/2013 - end of FY",
    });
  });

  it("lists a unit's owners before its tenants, whatever order they were added in", () => {
    const books = createSmallBooks();
    books.allocation.input.residents.reverse();

    expect(
      rowWithKey(unitsListOf(books, "2013-06-30").root, "unit:u1").children.map(
        (row) => {
          return row.label;
        },
      ),
    ).toEqual(["Owner r1 (PR)", "Owner r2 (CO)"]);
  });

  it("counts as overdue what the items due before today still owe, and adjusts by every item issued", () => {
    const { root } = unitsListOf(createSmallBooks(), "2013-06-30");
    const r1 = rowWithKey(root, "resident:r1");

    expect(r1).toMatchObject({ overdue: 10000, paid: 0 });
    expect(r1.adjustment).toBe(r1.due - 15000);
    expect(root).toMatchObject({ overdue: 10000 });
  });

  it("nests a group's subgroups before its units, and labels a group without an address by its code and name", () => {
    const books = createSmallBooks();
    books.groups = [
      createGroup("ug1", "A", null),
      createGroup("ug2", "A1", "ug1"),
    ];
    books.allocation.groups = books.groups;
    books.units = books.units.map((unit) => {
      return { ...unit, groupId: unit.id === "u1" ? "ug1" : "ug2" };
    });
    books.allocation.input.units = books.units;

    const { root } = unitsListOf(books, "2013-06-30");
    const group = rowWithKey(root, "group:ug1");

    expect(group.label).toBe("A - Group A");
    expect(
      group.children.map((row) => {
        return row.key;
      }),
    ).toEqual(["group:ug2", "unit:u1"]);
    expect(group.budget).toBe(
      rowWithKey(root, "group:ug2").budget + rowWithKey(root, "unit:u1").budget,
    );
  });
});

const TODAY = "2026-10-30";

function rowWithKey(root: UnitsRow, key: string): UnitsRow {
  return must(
    flatten(root).find((row) => {
      return row.key === key;
    }),
    `the row ${key}`,
  );
}

function flatten(row: UnitsRow): UnitsRow[] {
  return [row, ...row.children.flatMap(flatten)];
}

function residentNamed(books: UnitsBooks, id: string): OwnerParty {
  return must(
    books.allocation.input.residents.find((resident) => {
      return resident.id === id;
    }),
    id,
  );
}

/** The books with one more resident, in the allocation and the schedule alike. */
function withResident(books: UnitsBooks, resident: OwnerParty): UnitsBooks {
  return {
    ...books,
    allocation: {
      ...books.allocation,
      input: {
        ...books.allocation.input,
        residents: [...books.allocation.input.residents, resident],
      },
    },
    schedule: {
      ...books.schedule,
      parties: [...books.schedule.parties, resident],
    },
  };
}

/** The books with a resident's record replaced by this one, by id. */
function replaceResident(books: UnitsBooks, resident: OwnerParty): UnitsBooks {
  return {
    ...books,
    allocation: {
      ...books.allocation,
      input: {
        ...books.allocation.input,
        residents: books.allocation.input.residents.map((party) => {
          return party.id === resident.id ? resident : party;
        }),
      },
    },
    schedule: {
      ...books.schedule,
      parties: books.schedule.parties.map((party) => {
        return party.id === resident.id ? resident : party;
      }),
    },
  };
}

/**
 * createAllocationInput's period as the Units grid reads it, with no entries:
 * Rata 1 (due 2013-03-01) asks r1 for 100.00 and Rata 2 (due 2013-06-30) for
 * 50.00, nothing paid.
 */
function createSmallBooks(): UnitsBooks {
  const input = createAllocationInput();
  const installments: Installment[] = [
    createInstallment("in1", 1, "2013-03-01"),
    createInstallment("in2", 2, "2013-06-30"),
  ];

  const items: InstallmentItem[] = [
    { id: "ii1", installmentId: "in1", residentId: "r1", amount: cents(10000) },
    { id: "ii2", installmentId: "in2", residentId: "r1", amount: cents(5000) },
  ];

  return {
    allocation: { input, groups: [], entries: [], periodLabel: "Small 2013" },
    schedule: {
      periodLabel: "Small 2013",
      period: input.period,
      accounts: input.accounts,
      parties: input.residents,
      units: input.units,
      groups: [],
      entries: [],
      installments,
      installmentItems: items,
    },
    units: input.units,
    groups: [],
    buildingLabel: "Small / 2013",
  };
}

function createInstallment(
  id: string,
  number: number,
  dueDate: string,
): Installment {
  return {
    id,
    periodId: "p1",
    number,
    name: `Rata ${number}`,
    dueDate,
    locked: false,
  };
}

function createGroup(
  id: string,
  code: string,
  parentId: string | null,
): UnitGroup {
  return {
    id,
    periodId: "p1",
    code,
    name: `Group ${code}`,
    parentId,
    address: null,
    notes: null,
  };
}
