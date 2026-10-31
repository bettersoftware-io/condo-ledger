import type { Observable } from "rxjs";

import type { Building } from "#/entities/building.ts";
import type { Result } from "#/entities/result.ts";
import type {
  BuildingDraft,
  PeriodDraft,
} from "#/useCases/validateBuilding.ts";

/**
 * The administrator's buildings with their accounting periods. The selection
 * among them is the application's, not the port's. A write is judged by
 * validateBuilding, validateAddress and validatePeriod, and `buildings()`
 * emits again after an accepted one.
 */
export interface BuildingsPort {
  buildings(): Observable<Building[]>;
  /** The ids of the building's supplier contacts. Errors with "missing: the building <id>" for a building the port does not have. */
  suppliers(buildingId: string): Observable<string[]>;
  /** Stamps `modifiedOn` from the clock. Refused with the validator's reason. Rejects for a building the port does not have. */
  editBuilding(buildingId: string, draft: BuildingDraft): Promise<Result>;
  /** Refused with validatePeriod's reason. Rejects for a period the port does not have. */
  editPeriod(periodId: string, draft: PeriodDraft): Promise<Result>;
}
