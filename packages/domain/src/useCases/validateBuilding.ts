import type { Address } from "../entities/address.ts";
import type {
  Building,
  BuildingType,
  PeriodType,
  RecordStatus,
} from "../entities/building.ts";
import type { OwnerParty, Restriction } from "../entities/party.ts";
import { ok, type Result, rejected } from "../entities/result.ts";
import type { Unit } from "../entities/unit.ts";
import type { PeriodDates } from "./schedule.ts";

/** What the building dialog hands the port. */
export interface BuildingDraft {
  name: string;
  code: string | null;
  status: RecordStatus;
  type: BuildingType;
  address: Address | null;
  taxCode: string | null;
  constructionDate: string | null;
  cadastralData: string | null;
  notes: string | null;
}

/** What the period dialog hands the port. */
export interface PeriodDraft {
  name: string;
  type: PeriodType;
  closed: boolean;
  start: string;
  end: string;
  notes: string | null;
}

/**
 * Whether a building may be saved: `editing` is its id. The reasons are
 * checked in this order: a blank name, a name another building has, a code
 * another building has (a blank code is allowed). Names and codes compare
 * trimmed and by case.
 */
export function validateBuilding(
  draft: BuildingDraft,
  buildings: Building[],
  editing: string,
): Result {
  const name = draft.name.trim();

  if (name === "") {
    return rejected("blank-name");
  }

  const others = buildings.filter((building) => {
    return building.id !== editing;
  });

  const nameTaken = others.some((building) => {
    return same(building.name, name);
  });

  if (nameTaken) {
    return rejected("building-name-taken", name);
  }

  const code = (draft.code ?? "").trim();
  const codeTaken =
    code !== "" &&
    others.some((building) => {
      return same(building.code ?? "", code);
    });

  return codeTaken ? rejected("building-code-taken", code) : ok();
}

/**
 * Whether a period of `building` may be saved with these dates: `editing` is
 * its id. The reasons are checked in this order: a blank name, a name
 * another period of the building has, an end before the start, and a
 * restricted unit or resident (the detail is the unit's code, or the
 * resident's name) whose dates the new ones would cut.
 */
export function validatePeriod(
  draft: PeriodDraft,
  building: Building,
  editing: string,
  units: Unit[],
  residents: OwnerParty[],
): Result {
  const name = draft.name.trim();

  if (name === "") {
    return rejected("blank-name");
  }

  const taken = building.periods.some((period) => {
    return period.id !== editing && same(period.name, name);
  });

  if (taken) {
    return rejected("period-name-taken", name);
  }

  if (draft.end < draft.start) {
    return rejected("bad-dates");
  }

  const cutUnit = units.find((unit) => {
    return cuts(unit.restriction, draft);
  });

  if (cutUnit !== undefined) {
    return rejected("period-excludes", cutUnit.code);
  }

  const cutResident = residents.find((resident) => {
    return cuts(resident.ownRestriction, draft);
  });

  return cutResident === undefined
    ? ok()
    : rejected("period-excludes", cutResident.name);
}

/** Whether an address may be saved: it needs a street. */
export function validateAddress(address: Address): Result {
  return address.street.trim() === "" ? rejected("blank-street") : ok();
}

function same(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function cuts(restriction: Restriction | null, dates: PeriodDates): boolean {
  if (restriction === null) {
    return false;
  }

  const { from, to } = restriction;

  return (
    (from !== null && (from < dates.start || from > dates.end)) ||
    (to !== null && (to < dates.start || to > dates.end))
  );
}
