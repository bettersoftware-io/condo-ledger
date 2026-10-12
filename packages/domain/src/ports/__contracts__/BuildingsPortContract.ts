import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import type { Building } from "#/entities/building.ts";

import type { BuildingsPort } from "../buildingsPort.ts";

/** What an adapter's test supplies so the contract can drive it. */
export interface BuildingsPortHarness {
  port: BuildingsPort;
  /** What the port is expected to answer. */
  expected: Building[];
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
  });
}
