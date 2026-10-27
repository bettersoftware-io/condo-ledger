import type { Observable } from "rxjs";

import type { Unit, UnitGroup } from "#/entities/unit.ts";

/** A period's units and the groups they sit in. Read only. */
export interface UnitsPort {
  /** Errors with "missing: the period <id>" for a period the port does not have. */
  units(periodId: string): Observable<Unit[]>;
  /** Errors as units() does. */
  groups(periodId: string): Observable<UnitGroup[]>;
}
