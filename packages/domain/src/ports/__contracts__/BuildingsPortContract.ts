import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import type { Building } from "#/entities/building.ts";
import type {
  BuildingDraft,
  PeriodDraft,
} from "#/useCases/validateBuilding.ts";

import type { BuildingsPort } from "../buildingsPort.ts";

/** What an adapter's test supplies so the contract can drive it. */
export interface BuildingsPortHarness {
  port: BuildingsPort;
  /** What the port is expected to answer. */
  expected: Building[];
  /** A building with a period and another building, and its supplier contacts' ids. */
  buildingId: string;
  suppliers: string[];
  /** A building the port has no supplier link for. */
  unlinkedBuildingId: string;
  unknownBuildingId: string;
  /** Another building's name, and its code. */
  otherBuildingName: string;
  otherBuildingCode: string;
  /** A period of buildingId, and the name of another period of the same building. */
  periodId: string;
  otherPeriodName: string;
  unknownPeriodId: string;
  teardown: () => void;
}

export function describeBuildingsPortContract(
  label: string,
  createHarness: () => BuildingsPortHarness,
): void {
  describe(`${label} :: BuildingsPort contract`, () => {
    it("answers the buildings with their periods to each subscriber, at once", async () => {
      const { port, expected, teardown } = createHarness();

      try {
        expect(await firstValueFrom(port.buildings())).toEqual(expected);
        expect(await firstValueFrom(port.buildings())).toEqual(expected);
      } finally {
        teardown();
      }
    });

    it("answers at least one building, each with at least one period", async () => {
      const { port, teardown } = createHarness();

      try {
        const buildings = await firstValueFrom(port.buildings());

        expect(buildings.length).toBeGreaterThan(0);
        expect(
          buildings.every((building) => {
            return building.periods.length > 0;
          }),
        ).toBe(true);
      } finally {
        teardown();
      }
    });

    it("answers a building's supplier contacts, none for one with no link", async () => {
      const { port, buildingId, suppliers, unlinkedBuildingId, teardown } =
        createHarness();

      try {
        expect(await firstValueFrom(port.suppliers(buildingId))).toEqual(
          suppliers,
        );
        expect(
          await firstValueFrom(port.suppliers(unlinkedBuildingId)),
        ).toEqual([]);
      } finally {
        teardown();
      }
    });

    it("fails, naming the id, for a building it does not have", async () => {
      const { port, unknownBuildingId, unknownPeriodId, teardown } =
        createHarness();

      try {
        await expect(
          firstValueFrom(port.suppliers(unknownBuildingId)),
        ).rejects.toThrow(`missing: the building ${unknownBuildingId}`);
        await expect(
          port.editBuilding(unknownBuildingId, createBuildingDraft()),
        ).rejects.toThrow(`missing: the building ${unknownBuildingId}`);
        await expect(
          port.editPeriod(unknownPeriodId, createPeriodDraft()),
        ).rejects.toThrow(`missing: the period ${unknownPeriodId}`);
      } finally {
        teardown();
      }
    });

    it("emits the buildings once more after an accepted building edit, which keeps its periods", async () => {
      const { port, buildingId, teardown } = createHarness();
      const emitted: Building[][] = [];
      const subscription = port.buildings().subscribe((next) => {
        emitted.push(next);
      });

      try {
        const before = emitted[0] ?? [];

        const verdict = await port.editBuilding(buildingId, {
          ...createBuildingDraft(),
          name: "  Renamed  ",
          code: " ",
          notes: "n",
        });

        const after = emitted[emitted.length - 1] ?? [];

        expect(verdict).toEqual({ ok: true });
        expect(emitted).toHaveLength(2);
        expect(find(after, buildingId)).toMatchObject({
          name: "Renamed",
          code: null,
          notes: "n",
        });
        expect(find(after, buildingId).periods).toEqual(
          find(before, buildingId).periods,
        );
      } finally {
        subscription.unsubscribe();
        teardown();
      }
    });

    it("refuses a building edit with the reason, emitting nothing", async () => {
      const {
        port,
        buildingId,
        otherBuildingName,
        otherBuildingCode,
        teardown,
      } = createHarness();
      const emitted: Building[][] = [];
      const subscription = port.buildings().subscribe((next) => {
        emitted.push(next);
      });

      try {
        expect(
          await port.editBuilding(buildingId, {
            ...createBuildingDraft(),
            name: " ",
          }),
        ).toMatchObject({ ok: false, reason: "blank-name" });
        expect(
          await port.editBuilding(buildingId, {
            ...createBuildingDraft(),
            name: otherBuildingName,
          }),
        ).toMatchObject({ ok: false, reason: "building-name-taken" });
        expect(
          await port.editBuilding(buildingId, {
            ...createBuildingDraft(),
            code: otherBuildingCode,
          }),
        ).toMatchObject({ ok: false, reason: "building-code-taken" });
        expect(
          await port.editBuilding(buildingId, {
            ...createBuildingDraft(),
            address: { street: " ", postcode: "", city: "" },
          }),
        ).toMatchObject({ ok: false, reason: "blank-street" });
        expect(emitted).toHaveLength(1);
      } finally {
        subscription.unsubscribe();
        teardown();
      }
    });

    it("emits the buildings once more after an accepted period edit", async () => {
      const { port, buildingId, periodId, teardown } = createHarness();
      const emitted: Building[][] = [];
      const subscription = port.buildings().subscribe((next) => {
        emitted.push(next);
      });

      try {
        const verdict = await port.editPeriod(periodId, {
          ...createPeriodDraft(),
          name: "  Renamed  ",
          closed: true,
          notes: "n",
        });

        const period = find(
          emitted[emitted.length - 1] ?? [],
          buildingId,
        ).periods.find((candidate) => {
          return candidate.id === periodId;
        });

        expect(verdict).toEqual({ ok: true });
        expect(emitted).toHaveLength(2);
        expect(period).toMatchObject({
          name: "Renamed",
          closed: true,
          notes: "n",
          start: "2013-01-01",
          end: "2013-12-31",
        });
      } finally {
        subscription.unsubscribe();
        teardown();
      }
    });

    it("refuses a period edit with the reason, emitting nothing", async () => {
      const { port, periodId, otherPeriodName, teardown } = createHarness();
      const emitted: Building[][] = [];
      const subscription = port.buildings().subscribe((next) => {
        emitted.push(next);
      });

      try {
        expect(
          await port.editPeriod(periodId, { ...createPeriodDraft(), name: "" }),
        ).toMatchObject({ ok: false, reason: "blank-name" });
        expect(
          await port.editPeriod(periodId, {
            ...createPeriodDraft(),
            name: otherPeriodName,
          }),
        ).toMatchObject({ ok: false, reason: "period-name-taken" });
        expect(
          await port.editPeriod(periodId, {
            ...createPeriodDraft(),
            start: "2013-12-31",
            end: "2013-01-01",
          }),
        ).toMatchObject({ ok: false, reason: "bad-dates" });
        expect(emitted).toHaveLength(1);
      } finally {
        subscription.unsubscribe();
        teardown();
      }
    });
  });
}

function find(buildings: Building[], buildingId: string): Building {
  const found = buildings.find((building) => {
    return building.id === buildingId;
  });

  if (found === undefined) {
    throw new Error(`the contract's building ${buildingId} is not listed`);
  }

  return found;
}

function createBuildingDraft(): BuildingDraft {
  return {
    name: "Edited",
    code: "ED",
    status: "active",
    type: "building",
    address: null,
    taxCode: null,
    constructionDate: null,
    cadastralData: null,
    notes: null,
  };
}

function createPeriodDraft(): PeriodDraft {
  return {
    name: "Edited",
    type: "ordinary",
    closed: false,
    start: "2013-01-01",
    end: "2013-12-31",
    notes: null,
  };
}
