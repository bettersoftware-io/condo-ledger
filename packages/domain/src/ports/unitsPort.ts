import type { Observable } from "rxjs";

import type { OwnerParty } from "#/entities/party.ts";
import type { Result, ResultOf } from "#/entities/result.ts";
import type { Unit, UnitGroup } from "#/entities/unit.ts";
import type {
  GroupDraft,
  ResidencyDraft,
  UnitDraft,
} from "#/useCases/validateUnits.ts";

/** What adding a group, a unit or a resident answers: the id the port gave it. */
export interface Added {
  id: string;
}

/**
 * A period's units, the groups they sit in and the residents of each unit:
 * the one source every other reader of them follows. A write is judged by
 * validateGroup, validateGroupDelete, validateUnit, validateUnitDelete,
 * validateResidency and validateResidencyDelete, and the reads emit again
 * after an accepted write. A command rejects for an id the port does not have.
 */
export interface UnitsPort {
  /** Errors with "missing: the period <id>" for a period the port does not have. */
  units(periodId: string): Observable<Unit[]>;
  /** Errors as units() does. */
  groups(periodId: string): Observable<UnitGroup[]>;
  /** Every residency of the period's units, owners and tenants. Errors as units() does. */
  residents(periodId: string): Observable<OwnerParty[]>;
  /** In `parentId`, or at the top of the building when null. */
  addGroup(
    periodId: string,
    parentId: string | null,
    draft: GroupDraft,
  ): Promise<ResultOf<Added>>;
  editGroup(groupId: string, draft: GroupDraft): Promise<Result>;
  /** Refused while a unit or a group is in it: it takes nothing with it. */
  deleteGroup(groupId: string): Promise<Result>;
  /** In `groupId`, or at the top of the building when null. */
  addUnit(
    periodId: string,
    groupId: string | null,
    draft: UnitDraft,
  ): Promise<ResultOf<Added>>;
  /** A new code or new dates reach the unit's residents too. */
  editUnit(unitId: string, draft: UnitDraft): Promise<Result>;
  /** Takes the unit's residents with it; refused while one of them may not go. */
  deleteUnit(unitId: string): Promise<Result>;
  /**
   * The resident is named after the draft's contact, for the unit's code;
   * its dates are its own, else its unit's; its share is empty. Rejects for a
   * contact the port does not have.
   */
  addResident(unitId: string, draft: ResidencyDraft): Promise<ResultOf<Added>>;
  /** Rejects as addResident() does. */
  editResident(residentId: string, draft: ResidencyDraft): Promise<Result>;
  deleteResident(residentId: string): Promise<Result>;
}
