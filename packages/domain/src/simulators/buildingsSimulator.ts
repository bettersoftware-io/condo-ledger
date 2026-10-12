import { type Observable, of } from "rxjs";

import type { Building } from "#/entities/building.ts";
import type { BuildingsPort } from "#/ports/buildingsPort.ts";

import type { LegacySeed } from "./seed/legacySeed.ts";

/** The seed's buildings, answered to anyone who asks. */
export function createBuildingsSimulator(seed: LegacySeed): BuildingsPort {
  return {
    buildings: (): Observable<Building[]> => {
      return of(seed.buildings);
    },
  };
}
