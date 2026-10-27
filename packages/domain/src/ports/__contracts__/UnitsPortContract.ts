import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import type { UnitsPort } from "../unitsPort.ts";

/** What an adapter's test supplies so the contract can drive it. */
export interface UnitsPortHarness {
  port: UnitsPort;
  /** A period with units and groups. */
  periodId: string;
  unknownPeriodId: string;
  teardown: () => void;
}

export function describeUnitsPortContract(
  label: string,
  createHarness: () => UnitsPortHarness,
): void {
  describe(`${label} :: UnitsPort contract`, () => {
    it("answers a period's units, all of that period", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        const units = await firstValueFrom(port.units(periodId));

        expect(units.length).toBeGreaterThan(0);
        expect(
          units.every((unit) => {
            return unit.periodId === periodId;
          }),
        ).toBe(true);
      } finally {
        teardown();
      }
    });

    it("answers a period's groups, all of that period, each unit's group among them", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        const groups = await firstValueFrom(port.groups(periodId));
        const ids = new Set(
          groups.map((group) => {
            return group.id;
          }),
        );
        const units = await firstValueFrom(port.units(periodId));

        expect(groups.length).toBeGreaterThan(0);
        expect(
          groups.every((group) => {
            return group.periodId === periodId;
          }),
        ).toBe(true);
        expect(
          units.every((unit) => {
            return unit.groupId === null || ids.has(unit.groupId);
          }),
        ).toBe(true);
      } finally {
        teardown();
      }
    });

    it("fails, naming the id, for a period it does not have", async () => {
      const { port, unknownPeriodId, teardown } = createHarness();

      try {
        await expect(
          firstValueFrom(port.units(unknownPeriodId)),
        ).rejects.toThrow(`missing: the period ${unknownPeriodId}`);
        await expect(
          firstValueFrom(port.groups(unknownPeriodId)),
        ).rejects.toThrow(`missing: the period ${unknownPeriodId}`);
      } finally {
        teardown();
      }
    });
  });
}
