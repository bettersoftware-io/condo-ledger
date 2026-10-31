import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import type { Building } from "#/entities/building.ts";
import type { BuildingDraft } from "#/useCases/validateBuilding.ts";

import { createSmallSeed } from "../testing/createSmallBooks.ts";
import { createBuildingsSimulator } from "./buildingsSimulator.ts";
import { fixedClock } from "./fixedClock.ts";

describe("buildings simulator", () => {
  it("stamps an accepted building edit from the clock on the Rome clock, and leaves a refused one unstamped", async () => {
    const buildings = createBuildingsSimulator(
      createSmallSeed(),
      fixedClock("2026-10-31T10:05:07Z"),
    );

    await buildings.editBuilding("c1", { ...createDraft(), name: " " });

    expect(modifiedOn(buildings.currentBuildings())).toBe(
      "2012-12-20 09:00:00",
    );

    await buildings.editBuilding("c1", createDraft());

    expect(modifiedOn(buildings.currentBuildings())).toBe(
      "2026-10-31 11:05:07",
    );
    expect((await firstValueFrom(buildings.buildings()))[0]?.createdOn).toBe(
      "2012-12-20 09:00:00",
    );
  });

  it("judges a period edit against the units and residents its readers answer when it asks", async () => {
    const seed = createSmallSeed();
    const restricted = {
      ...must(seed.units[0]),
      restriction: { from: "2013-03-01", to: null },
    };
    let units = [restricted];
    const buildings = createBuildingsSimulator(
      seed,
      fixedClock("2026-10-31T10:05:07Z"),
      {
        unitsOf: () => {
          return units;
        },
        residentsOf: () => {
          return [];
        },
      },
    );

    const draft = {
      name: "2013",
      type: "ordinary" as const,
      closed: false,
      start: "2013-04-01",
      end: "2013-12-31",
      notes: null,
    };

    expect(await buildings.editPeriod("p1", draft)).toEqual({
      ok: false,
      reason: "period-excludes",
      detail: restricted.code,
    });

    units = [];

    expect(await buildings.editPeriod("p1", draft)).toEqual({ ok: true });
  });
});

function must<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("the small seed has one");
  }

  return value;
}

function modifiedOn(buildings: Building[]): string | undefined {
  return buildings[0]?.modifiedOn;
}

function createDraft(): BuildingDraft {
  return {
    name: "Pozzetto",
    code: "POZ",
    status: "active",
    type: "building",
    address: null,
    taxCode: null,
    constructionDate: null,
    cadastralData: null,
    notes: null,
  };
}
