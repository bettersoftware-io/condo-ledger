import type { OwnerParty, Restriction } from "#/entities/party.ts";
import type { Unit, UnitGroup } from "#/entities/unit.ts";

/** What sits directly under a group, or at the top when the group is null: its subgroups, then its units, each by code. */
export interface Level {
  groups: UnitGroup[];
  units: Unit[];
}

/** The subgroups and units of a group, or of the top of the building when `groupId` is null. */
export function levelOf(
  groupId: string | null,
  groups: UnitGroup[],
  units: Unit[],
): Level {
  return {
    groups: groups
      .filter((group) => {
        return group.parentId === groupId;
      })
      .sort(byCode),
    units: units
      .filter((unit) => {
        return unit.groupId === groupId;
      })
      .sort(byCode),
  };
}

/** A group's row label: "{code} - {name}". */
export function groupLabelOf(group: UnitGroup): string {
  return `${group.code} - ${group.name}`;
}

/** The unit's residents in residency order: by their own start, an open or absent start first, otherwise as given. */
export function residentsOf(
  residents: OwnerParty[],
  unitId: string,
): OwnerParty[] {
  return residents
    .filter((resident) => {
      return resident.unitId === unitId;
    })
    .sort((a, b) => {
      return compareText(startOf(a), startOf(b));
    });
}

/** "{from} - end of FY", "start of FY - {to}" or "{from} - {to}", dates as dd/mm/yyyy; blank for the whole period. */
export function restrictionTextOf(restriction: Restriction | null): string {
  const from = restriction?.from ?? null;
  const to = restriction?.to ?? null;

  if (from === null) {
    return to === null ? "" : `start of FY - ${dateText(to)}`;
  }

  return `${dateText(from)} - ${to === null ? "end of FY" : dateText(to)}`;
}

/** A group or a unit: both sort by their code. */
interface Coded {
  code: string;
}

function byCode(a: Coded, b: Coded): number {
  return compareText(a.code, b.code);
}

/** "" for an open or absent start, which sorts before every date. */
function startOf(resident: OwnerParty): string {
  return resident.ownRestriction?.from ?? "";
}

function compareText(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  return a > b ? 1 : 0;
}

/** "YYYY-MM-DD" as dd/mm/yyyy. */
function dateText(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}
