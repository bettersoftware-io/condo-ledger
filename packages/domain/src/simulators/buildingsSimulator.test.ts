import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import type { Building } from "#/entities/building.ts";
import type { Contact, SupplierLink } from "#/entities/contact.ts";
import type { ClockPort } from "#/ports/clockPort.ts";
import type { BuildingDraft } from "#/useCases/validateBuilding.ts";

import { createCompanyContact } from "../testing/createContacts.ts";
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

  it("holds the links from the seed's, and streams each change to all of them", async () => {
    const seed = createSmallSeed();
    const buildings = createBuildingsSimulator(seed, createClock());
    const emitted: SupplierLink[][] = [];
    const subscription = buildings.links$.subscribe((links) => {
      emitted.push(links);
    });

    expect(buildings.currentLinks()).toEqual(seed.supplierLinks);

    await buildings.addSupplier("c1", "md10");
    await buildings.addSupplier("c1", "md10");
    await buildings.removeSupplier("c1", "md1");

    const added = { buildingId: "c1", contactId: "md10" };
    const [, kept] = seed.supplierLinks;

    expect(emitted).toEqual([
      seed.supplierLinks,
      [...seed.supplierLinks, added],
      [kept, added],
    ]);
    expect(buildings.currentLinks()).toEqual([kept, added]);
    expect(seed.supplierLinks).toHaveLength(2);
    subscription.unsubscribe();
  });

  it("names a refused supplier by the contact as the reader answers it now", async () => {
    const buildings = createBuildingsSimulator(
      createSmallSeed(),
      createClock(),
      {
        contactsOf: (): Contact[] => {
          return [createCompanyContact("md1", "Renamed s.r.l.")];
        },
      },
    );

    expect(await buildings.addSupplier("c1", "md1")).toEqual({
      ok: false,
      reason: "already-supplier",
      detail: "Renamed s.r.l.",
    });
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

function createClock(): ClockPort {
  return fixedClock("2026-10-31T10:05:07Z");
}

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
