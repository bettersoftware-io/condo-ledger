import type { Building } from "#/entities/building.ts";
import { MANUAL_CALENDARS, type ManualDeadline } from "#/entities/deadline.ts";
import { ok, type Result, rejected } from "#/entities/result.ts";

const DESCRIPTION_MAX = 255;

/** A deadline as the dialog holds it, before the port gives it an id. */
export type DeadlineDraft = Omit<ManualDeadline, "id">;

/**
 * Whether a deadline may be saved. The reasons are checked in this order: a
 * blank description (trimmed), one over 255 characters, a date that is not a
 * day of the calendar, a time that is not `HH:MM` from 00:00 to 23:59, a
 * calendar the books fill (`books-calendar`), a building the app does not
 * have.
 */
export function validateDeadline(
  draft: DeadlineDraft,
  buildings: Building[],
): Result {
  const description = draft.description.trim();

  if (description === "") {
    return rejected("blank-description");
  }

  if (description.length > DESCRIPTION_MAX) {
    return rejected("description-too-long");
  }

  if (!isDay(draft.date)) {
    return rejected("bad-date");
  }

  if (draft.time !== null && !isTime(draft.time)) {
    return rejected("bad-time");
  }

  if (!MANUAL_CALENDARS.includes(draft.calendar)) {
    return rejected("books-calendar");
  }

  if (
    draft.buildingId !== null &&
    !buildings.some((building) => {
      return building.id === draft.buildingId;
    })
  ) {
    return rejected("unknown-building", draft.buildingId);
  }

  return ok();
}

/** An ISO day that exists: `2028-02-29` does, `2026-02-29` does not. */
function isDay(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (match === null) {
    return false;
  }

  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
