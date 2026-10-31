import { describe, expect, it } from "vitest";

import type { OwnerParty } from "../entities/party.ts";
import { legacySeedData } from "../simulators/seed/legacySeed.generated.ts";
import { loadLegacySeed } from "../simulators/seed/legacySeed.ts";
import { must } from "../support/must.ts";
import {
  type BuildingDraft,
  type PeriodDraft,
  validateAddress,
  validateBuilding,
  validatePeriod,
} from "./validateBuilding.ts";

describe("validateBuilding", () => {
  it("accepts the building as it is, and a new name and code", () => {
    expect(validateBuilding(createDraft({}), seed.buildings, "c19")).toEqual({
      ok: true,
    });
    expect(
      validateBuilding(
        createDraft({ name: "Giove", code: "GIO" }),
        seed.buildings,
        "c19",
      ),
    ).toEqual({ ok: true });
  });

  it("refuses a blank name", () => {
    expect(
      validateBuilding(createDraft({ name: "  " }), seed.buildings, "c19"),
    ).toEqual({ ok: false, reason: "blank-name" });
  });

  it("refuses the name of another building, trimmed and by case", () => {
    expect(
      validateBuilding(
        createDraft({ name: " saturno " }),
        seed.buildings,
        "c19",
      ),
    ).toEqual({ ok: false, reason: "building-name-taken", detail: "saturno" });
    expect(
      validateBuilding(createDraft({ name: "Saturno" }), seed.buildings, "c1"),
    ).toEqual({ ok: true });
  });

  it("refuses the code of another building, and lets a blank code be", () => {
    expect(
      validateBuilding(createDraft({ code: "sat" }), seed.buildings, "c19"),
    ).toEqual({ ok: false, reason: "building-code-taken", detail: "sat" });
    expect(
      validateBuilding(createDraft({ code: " " }), seed.buildings, "c19"),
    ).toEqual({ ok: true });
  });
});

describe("validatePeriod", () => {
  it("accepts the period as it is", () => {
    expect(validatePeriodOf("p1", {})).toEqual({ ok: true });
  });

  it("refuses a blank name", () => {
    expect(validatePeriodOf("p1", { name: " " })).toEqual({
      ok: false,
      reason: "blank-name",
    });
  });

  it("refuses the name of another period of the building, and keeps its own", () => {
    const building = must(seed.buildings[0], "building");
    const other = {
      ...building,
      periods: [
        ...building.periods,
        { ...must(building.periods[0], "period"), id: "px", name: "2012" },
      ],
    };

    expect(
      validatePeriod(
        createPeriodDraft({ name: " 2012 " }),
        other,
        "p1",
        [],
        [],
      ),
    ).toEqual({ ok: false, reason: "period-name-taken", detail: "2012" });
    expect(validatePeriod(createPeriodDraft({}), other, "p1", [], [])).toEqual({
      ok: true,
    });
  });

  it("refuses an end before the start", () => {
    expect(
      validatePeriodOf("p1", { start: "2011-12-31", end: "2011-01-01" }),
    ).toEqual({ ok: false, reason: "bad-dates" });
  });

  it("refuses dates that would cut a restricted unit, naming its code", () => {
    expect(
      validatePeriodOf("p1", { start: "2011-06-01", end: "2011-12-31" }),
    ).toEqual({ ok: false, reason: "period-excludes", detail: "A1" });
  });

  it("refuses dates that would cut a restricted resident, naming them", () => {
    const building = must(seed.buildings[1], "building");
    const units = seed.units.filter((unit) => {
      return unit.periodId === "p36";
    });
    const residents = pozzettoResidents();

    expect(
      validatePeriod(
        createPeriodDraft({
          name: "2013",
          start: "2013-02-01",
          end: "2013-12-31",
        }),
        building,
        "p36",
        units,
        residents,
      ),
    ).toEqual({
      ok: false,
      reason: "period-excludes",
      detail: must(
        residents.find((resident) => {
          return resident.id === "r166";
        }),
        "r166",
      ).name,
    });
  });
});

describe("validateAddress", () => {
  it("accepts a street, and refuses a blank one", () => {
    expect(
      validateAddress({ street: "Via Roma 1", postcode: null, city: null }),
    ).toEqual({ ok: true });
    expect(
      validateAddress({ street: "  ", postcode: "33033", city: "Codroipo" }),
    ).toEqual({ ok: false, reason: "blank-street" });
  });
});

const seed = loadLegacySeed(legacySeedData);

function validatePeriodOf(
  periodId: string,
  changes: Partial<PeriodDraft>,
): ReturnType<typeof validatePeriod> {
  const building = must(
    seed.buildings.find((candidate) => {
      return candidate.periods.some((period) => {
        return period.id === periodId;
      });
    }),
    "building",
  );

  const period = must(
    building.periods.find((candidate) => {
      return candidate.id === periodId;
    }),
    "period",
  );

  return validatePeriod(
    { ...createPeriodDraft({}), ...period, ...changes },
    building,
    periodId,
    seed.units.filter((unit) => {
      return unit.periodId === periodId;
    }),
    [],
  );
}

function pozzettoResidents(): OwnerParty[] {
  return ownersOf("p36");
}

function ownersOf(periodId: string): OwnerParty[] {
  const parties = must(
    seed.parties.find((held) => {
      return held.periodId === periodId;
    }),
    "parties",
  ).parties;

  return parties.flatMap((party) => {
    return party.kind === "owner" ? [party] : [];
  });
}

function createDraft(changes: Partial<BuildingDraft>): BuildingDraft {
  return {
    name: "Pozzetto",
    code: null,
    status: "active",
    type: "building",
    address: null,
    taxCode: null,
    constructionDate: null,
    cadastralData: null,
    notes: null,
    ...changes,
  };
}

function createPeriodDraft(changes: Partial<PeriodDraft>): PeriodDraft {
  return {
    name: "2011",
    type: "ordinary",
    closed: false,
    start: "2011-01-01",
    end: "2011-12-31",
    notes: null,
    ...changes,
  };
}
