import { type Address, addressTextOf } from "./address.ts";

export type PeriodType = "ordinary" | "extra" | "auxiliary";

export type BuildingType = "building" | "superBuilding" | "residence";

/** Whether a building or a contact is in use or kept for the record. */
export type RecordStatus = "active" | "archived";

/** One accounting period (a management) of a building. */
export interface Period {
  id: string;
  name: string;
  type: PeriodType;
  start: string;
  end: string;
  closed: boolean;
  notes: string | null;
}

/** A condominium with its accounting periods. */
export interface Building {
  id: string;
  name: string;
  code: string | null;
  type: BuildingType;
  status: RecordStatus;
  address: Address | null;
  taxCode: string | null;
  constructionDate: string | null;
  cadastralData: string | null;
  notes: string | null;
  /** When the building was entered, as "YYYY-MM-DD HH:mm:ss" in Rome time. */
  createdOn: string;
  /** When the building was last changed, as "YYYY-MM-DD HH:mm:ss" in Rome time. */
  modifiedOn: string;
  periods: Period[];
}

/** "{building} / {period} ({address})", without " ({address})" when the building has none. */
export function periodLabelText(building: Building, period: Period): string {
  const label = `${building.name} / ${period.name}`;

  return building.address === null
    ? label
    : `${label} (${addressTextOf(building.address)})`;
}
