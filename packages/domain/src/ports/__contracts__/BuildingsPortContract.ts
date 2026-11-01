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
  /** The name of the contact `suppliers[0]`. */
  firstSupplierName: string;
  /** A contact that is no supplier of buildingId. */
  otherContactId: string;
  unknownContactId: string;
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

    it("adds a supplier to a building, and its suppliers emit again", async () => {
      const { port, buildingId, suppliers, otherContactId, teardown } =
        createHarness();
      const emitted: string[][] = [];
      const subscription = port.suppliers(buildingId).subscribe((next) => {
        emitted.push(next);
      });

      try {
        expect(await port.addSupplier(buildingId, otherContactId)).toEqual({
          ok: true,
        });
        expect(emitted).toEqual([suppliers, [...suppliers, otherContactId]]);
      } finally {
        subscription.unsubscribe();
        teardown();
      }
    });

    it("adds to one building alone", async () => {
      const {
        port,
        buildingId,
        suppliers,
        unlinkedBuildingId,
        otherContactId,
        teardown,
      } = createHarness();

      try {
        await port.addSupplier(unlinkedBuildingId, otherContactId);

        expect(await firstValueFrom(port.suppliers(buildingId))).toEqual(
          suppliers,
        );
        expect(
          await firstValueFrom(port.suppliers(unlinkedBuildingId)),
        ).toEqual([otherContactId]);
      } finally {
        teardown();
      }
    });

    it("refuses no contact, and a contact already a supplier by its name, emitting nothing", async () => {
      const {
        port,
        buildingId,
        suppliers,
        firstSupplierName,
        unlinkedBuildingId,
        teardown,
      } = createHarness();
      const supplier = required(suppliers[0], "a supplier");
      const emitted: string[][] = [];
      const subscription = port.suppliers(buildingId).subscribe((next) => {
        emitted.push(next);
      });

      try {
        expect(await port.addSupplier(buildingId, null)).toEqual({
          ok: false,
          reason: "no-contact",
        });
        expect(await port.addSupplier(buildingId, supplier)).toEqual({
          ok: false,
          reason: "already-supplier",
          detail: firstSupplierName,
        });
        expect(emitted).toEqual([suppliers]);
        expect(await port.addSupplier(unlinkedBuildingId, supplier)).toEqual({
          ok: true,
        });
      } finally {
        subscription.unsubscribe();
        teardown();
      }
    });

    it("removes a supplier from a building, and its suppliers emit again", async () => {
      const { port, buildingId, suppliers, unlinkedBuildingId, teardown } =
        createHarness();
      const removed = required(suppliers[0], "a supplier");
      const emitted: string[][] = [];

      await port.addSupplier(unlinkedBuildingId, removed);

      const subscription = port.suppliers(buildingId).subscribe((next) => {
        emitted.push(next);
      });

      try {
        expect(await port.removeSupplier(buildingId, removed)).toEqual({
          ok: true,
        });
        expect(emitted).toEqual([suppliers, suppliers.slice(1)]);
        expect(
          await firstValueFrom(port.suppliers(unlinkedBuildingId)),
        ).toEqual([removed]);
      } finally {
        subscription.unsubscribe();
        teardown();
      }
    });

    it("rejects a supplier write for a building, a contact or a link it does not have", async () => {
      const {
        port,
        buildingId,
        suppliers,
        otherContactId,
        unknownBuildingId,
        unknownContactId,
        teardown,
      } = createHarness();
      const supplier = required(suppliers[0], "a supplier");

      try {
        await expect(
          port.addSupplier(unknownBuildingId, supplier),
        ).rejects.toThrow(`missing: the building ${unknownBuildingId}`);
        await expect(
          port.addSupplier(buildingId, unknownContactId),
        ).rejects.toThrow(`missing: the contact ${unknownContactId}`);
        await expect(
          port.removeSupplier(unknownBuildingId, supplier),
        ).rejects.toThrow(`missing: the building ${unknownBuildingId}`);
        await expect(
          port.removeSupplier(buildingId, otherContactId),
        ).rejects.toThrow(
          `missing: the supplier ${otherContactId} of ${buildingId}`,
        );
      } finally {
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

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new Error(`the contract's harness has no ${what}`);
  }

  return value;
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
