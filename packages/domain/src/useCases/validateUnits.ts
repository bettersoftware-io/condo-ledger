import type { Address } from "../entities/address.ts";
import type { Cents } from "../entities/cents.ts";
import type { InstallmentItem } from "../entities/installment.ts";
import type { JournalEntry } from "../entities/journal.ts";
import type { OwnerParty, Restriction } from "../entities/party.ts";
import { ok, type Result, rejected } from "../entities/result.ts";
import type { Unit, UnitGroup, UnitType } from "../entities/unit.ts";
import type { PeriodDates } from "./schedule.ts";

/** What the group dialog hands the port. */
export interface GroupDraft {
  code: string;
  name: string;
  address: Address | null;
  notes: string | null;
}

/** What the unit dialog hands the port. */
export interface UnitDraft {
  code: string;
  name: string | null;
  floor: string | null;
  interior: string | null;
  subUnit: string | null;
  restriction: Restriction | null;
  type: UnitType;
  cadastralData: string | null;
  notes: string | null;
}

/** What the owner dialog hands the port. */
export interface ResidencyDraft {
  contactId: string | null;
  role: "PR" | "CO" | "SC";
  startingBalance: Cents;
  ownRestriction: Restriction | null;
}

/**
 * Whether a group may be saved under `parentId`: `editing` is the edited
 * group's id, null for a new one. The reasons are checked in this order: a
 * blank code, a blank name, a code or a name a sibling already has (trimmed,
 * by case; the detail is the one that matched, the code first).
 */
export function validateGroup(
  draft: GroupDraft,
  parentId: string | null,
  groups: UnitGroup[],
  editing: string | null,
): Result {
  const code = draft.code.trim();
  const name = draft.name.trim();

  if (code === "") {
    return rejected("blank-code");
  }

  if (name === "") {
    return rejected("blank-name");
  }

  const siblings = groups.filter((group) => {
    return group.id !== editing && group.parentId === parentId;
  });

  if (
    siblings.some((group) => {
      return same(group.code, code);
    })
  ) {
    return rejected("group-taken", code);
  }

  return siblings.some((group) => {
    return same(group.name, name);
  })
    ? rejected("group-taken", name)
    : ok();
}

/** Whether a group may go: not while a unit or a group is in it. */
export function validateGroupDelete(
  groupId: string,
  groups: UnitGroup[],
  units: Unit[],
): Result {
  const holdsUnit = units.some((unit) => {
    return unit.groupId === groupId;
  });

  const holdsGroup = groups.some((group) => {
    return group.parentId === groupId;
  });

  return holdsUnit || holdsGroup ? rejected("group-not-empty") : ok();
}

/**
 * Whether a unit may be saved in a period with these dates: `editing` is the
 * edited unit's id. The reasons are checked in this order: a blank code, a
 * code another unit has, an end before the start, dates outside the period.
 */
export function validateUnit(
  draft: UnitDraft,
  units: Unit[],
  period: PeriodDates,
  editing: string | null,
): Result {
  const code = draft.code.trim();

  if (code === "") {
    return rejected("blank-code");
  }

  const taken = units.some((unit) => {
    return unit.id !== editing && same(unit.code, code);
  });

  if (taken) {
    return rejected("unit-code-taken", code);
  }

  return checkDates(draft.restriction, period);
}

/**
 * Whether a residency may be saved on a unit: `editing` is the edited
 * residency's id. The reasons are checked in this order: no contact, a
 * contact already living in the unit (the detail is the contact's id), an
 * end before the start, dates outside the period.
 */
export function validateResidency(
  draft: ResidencyDraft,
  unitId: string,
  residents: OwnerParty[],
  period: PeriodDates,
  editing: string | null,
): Result {
  if (draft.contactId === null) {
    return rejected("no-contact");
  }

  const living = residents.some((resident) => {
    return (
      resident.unitId === unitId &&
      resident.id !== editing &&
      resident.personId === draft.contactId
    );
  });

  if (living) {
    return rejected("already-resident", draft.contactId);
  }

  return checkDates(draft.ownRestriction, period);
}

/**
 * Whether a residency may go: not while a journal posting names it, and then
 * not while an installment item is theirs. The detail is the resident's name.
 */
export function validateResidencyDelete(
  resident: OwnerParty,
  entries: JournalEntry[],
  items: InstallmentItem[],
): Result {
  const named = entries.some((entry) => {
    return entry.postings.some((posting) => {
      return (
        posting.counterpart?.kind === "owner" &&
        posting.counterpart.id === resident.id
      );
    });
  });

  if (named) {
    return rejected("named-in-journal", resident.name);
  }

  const billed = items.some((item) => {
    return item.residentId === resident.id;
  });

  return billed ? rejected("has-installments", resident.name) : ok();
}

/** Whether a unit may go: the first refusal of its residents, else yes. */
export function validateUnitDelete(
  unitId: string,
  residents: OwnerParty[],
  entries: JournalEntry[],
  items: InstallmentItem[],
): Result {
  for (const resident of residents) {
    if (resident.unitId === unitId) {
      const result = validateResidencyDelete(resident, entries, items);

      if (!result.ok) {
        return result;
      }
    }
  }

  return ok();
}

function same(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function checkDates(
  restriction: Restriction | null,
  period: PeriodDates,
): Result {
  if (restriction === null) {
    return ok();
  }

  const { from, to } = restriction;

  if (from !== null && to !== null && to < from) {
    return rejected("bad-dates");
  }

  const outside =
    (from !== null && (from < period.start || from > period.end)) ||
    (to !== null && (to < period.start || to > period.end));

  return outside ? rejected("outside-period") : ok();
}
