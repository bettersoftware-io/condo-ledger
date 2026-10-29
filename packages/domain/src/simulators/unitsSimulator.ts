import { type Observable, of } from "rxjs";

import type { Unit, UnitGroup } from "#/entities/unit.ts";
import type { UnitsPort } from "#/ports/unitsPort.ts";

import { missingPeriod } from "./missingPeriod.ts";
import type { LegacySeed } from "./seed/legacySeed.ts";

/** A period's units and groups. */
interface PeriodUnits {
  units: Unit[];
  groups: UnitGroup[];
}

/** The seed's units and groups, a period at a time. Throws on an unknown id: it never answers empty for a wrong key. */
export function createUnitsSimulator(seed: LegacySeed): UnitsPort {
  const periods = new Map<string, PeriodUnits>();

  for (const building of seed.buildings) {
    for (const period of building.periods) {
      periods.set(period.id, {
        units: seed.units.filter((unit) => {
          return unit.periodId === period.id;
        }),
        groups: seed.unitGroups.filter((group) => {
          return group.periodId === period.id;
        }),
      });
    }
  }

  return {
    units: (periodId: string): Observable<Unit[]> => {
      const held = periods.get(periodId);

      return held === undefined ? missingPeriod(periodId) : of(held.units);
    },
    groups: (periodId: string): Observable<UnitGroup[]> => {
      const held = periods.get(periodId);

      return held === undefined ? missingPeriod(periodId) : of(held.groups);
    },
  };
}
