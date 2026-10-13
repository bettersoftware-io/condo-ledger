import type { Observable } from "rxjs";

import type { Building } from "#/entities/building.ts";

/**
 * The administrator's buildings with their accounting periods. The selection
 * among them is the application's, not the port's.
 */
export interface BuildingsPort {
  buildings(): Observable<Building[]>;
}
