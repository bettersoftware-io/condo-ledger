import { describe, expect, it } from "vitest";

import type { OwnerParty } from "#/entities/party.ts";
import type { Unit } from "#/entities/unit.ts";
import { must } from "#/support/must.ts";
import { createSeedUnitsBooks } from "#/testing/createSeedUnitsBooks.ts";
import type { AllocationInput } from "#/useCases/allocation/share.ts";

import { type OwnersRow, unitOwnersOf } from "./unitOwners.ts";

describe("unitOwnersOf", () => {
  it("heads Pozzetto A04 with the full period, the standard scenario and 365/365 days", () => {
    expect(ownersOf("p36", "A04")).toMatchObject({
      key: "period:u137",
      kind: "period",
      label: "Full period",
      scenario: "Standard (owner/tenant)",
      out: false,
      restriction: "",
      days: "365/365",
      share: null,
      coefficient: null,
      residentId: null,
    });
  });

  it("lists A04's owners under one sub-head, the outgoing one first, with their days and compound coefficients", () => {
    const head = ownersOf("p36", "A04");
    const owners = must(head.children[0], "A04's owners");

    expect(head.children).toHaveLength(1);
    expect(owners).toMatchObject({
      key: "role:PR",
      kind: "role",
      label: "Owners",
      days: "",
      coefficient: null,
    });
    expect(
      owners.children.map((row) => {
        return [row.residentId, row.label, row.out, row.restriction, row.days];
      }),
    ).toEqual([
      [
        "r167",
        nameOf("p36", "r167"),
        true,
        "start of FY - 18/01/2013",
        "18/365",
      ],
      [
        "r166",
        nameOf("p36", "r166"),
        false,
        "19/01/2013 - end of FY",
        "347/365",
      ],
    ]);
    expect(owners.children[0]?.coefficient).toBeCloseTo(0.049315, 6);
    expect(owners.children[1]?.coefficient).toBeCloseTo(0.950685, 6);
    expect(owners.children[1]).toMatchObject({
      kind: "resident",
      key: "resident:r166",
      share: 1000000,
      scenario: "",
    });
  });

  it("gives A09's third owner a coefficient of 0, an empty share beside a 100% sibling", () => {
    const owners = must(ownersOf("p36", "A09").children[0], "A09's owners");

    expect(
      owners.children.map((row) => {
        return [row.residentId, row.share, row.coefficient];
      }),
    ).toEqual([
      ["r174", 1000000, 1],
      ["r175", null, 0],
      ["r176", null, 0],
    ]);
  });

  it("lists Saturno A2's owners, then its tenants", () => {
    expect(
      ownersOf("p1", "A2").children.map((row) => {
        return [row.label, row.children.length];
      }),
    ).toEqual([
      ["Owners", 1],
      ["Tenants", 1],
    ]);
  });

  it("counts a restricted unit's days over its own dates, and prorates nobody by them", () => {
    const head = ownersOf("p1", "A1");

    expect(head).toMatchObject({
      restriction: "01/05/2011 - 31/05/2011",
      days: "31/31",
    });
    expect(head.children[0]?.children[0]).toMatchObject({
      out: false,
      restriction: "",
      days: "",
      coefficient: 1,
    });
  });

  it("counts a dated resident's days against the unit's own dates", () => {
    const { input, unit } = unitIn("p1", "A1");
    const owner = must(residentsOf(input, unit)[0], "A1's owner");
    const dated: AllocationInput = {
      ...input,
      residents: input.residents.map((resident) => {
        return resident.id === owner.id
          ? { ...owner, ownRestriction: { from: "2011-05-11", to: null } }
          : resident;
      }),
    };

    const row = ownersOf("p1", "A1", dated).children[0]?.children[0];

    expect(row).toMatchObject({
      out: false,
      restriction: "11/05/2011 - end of FY",
      days: "21/31",
    });
    expect(row?.coefficient).toBeCloseTo(21 / 31, 6);
  });

  it("heads the subtenants as Subtenants, and a role it has no word for by its abbreviation", () => {
    const { input, unit } = unitIn("p1", "A4");
    const owner = must(residentsOf(input, unit)[0], "A4's owner");
    input.residents.push(
      { ...owner, id: "r-new-1", role: "SC" },
      { ...owner, id: "r-new-2", role: "NP" },
    );

    expect(
      ownersOf("p1", "A4", input).children.map((row) => {
        return row.label;
      }),
    ).toEqual(["Owners", "NP", "Subtenants"]);
  });
});

function ownersOf(
  periodId: string,
  code: string,
  input: AllocationInput = unitIn(periodId, code).input,
): OwnersRow {
  return unitOwnersOf(unitIn(periodId, code).unit, input);
}

interface UnitIn {
  input: AllocationInput;
  unit: Unit;
}

function unitIn(periodId: string, code: string): UnitIn {
  const { input } = createSeedUnitsBooks(periodId).allocation;

  return {
    input,
    unit: must(
      input.units.find((candidate) => {
        return candidate.code === code;
      }),
      `the unit ${code}`,
    ),
  };
}

function residentsOf(input: AllocationInput, unit: Unit): OwnerParty[] {
  return input.residents.filter((resident) => {
    return resident.unitId === unit.id;
  });
}

function nameOf(periodId: string, residentId: string): string {
  return must(
    createSeedUnitsBooks(periodId).allocation.input.residents.find(
      (resident) => {
        return resident.id === residentId;
      },
    ),
    residentId,
  ).name;
}
