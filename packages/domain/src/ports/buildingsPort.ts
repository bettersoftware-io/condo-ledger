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
 * validateBuilding, validateAddress, validatePeriod and validateSupplier:
 * `buildings()` emits again after an accepted edit, and `suppliers()` after a
 * supplier added or removed.
 */
export interface BuildingsPort {
  buildings(): Observable<Building[]>;
  /** The ids of the building's supplier contacts, and again whenever they change. Errors with "missing: the building <id>" for a building the port does not have. */
  suppliers(buildingId: string): Observable<string[]>;
  /** Links a contact to the building. Refused "no-contact" for a null one, "already-supplier" with the contact's name for one it has. Rejects for a building or a contact the port does not have. */
  addSupplier(buildingId: string, contactId: string | null): Promise<Result>;
  /** Removes the link, not the contact: what is posted in the building's periods keeps its name. Rejects for a building or a link the port does not have. */
  removeSupplier(buildingId: string, contactId: string): Promise<Result>;
  /** Stamps `modifiedOn` from the clock. Refused with the validator's reason. Rejects for a building the port does not have. */
  editBuilding(buildingId: string, draft: BuildingDraft): Promise<Result>;
  /** Refused with validatePeriod's reason. Rejects for a period the port does not have. */
  editPeriod(periodId: string, draft: PeriodDraft): Promise<Result>;
}
