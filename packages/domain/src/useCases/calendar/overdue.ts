import type {
  CalendarId,
  Deadline,
  DeadlineStatus,
} from "#/entities/deadline.ts";

/** A status as the Calendar shows it: the stored ones, and overdue. */
export type ShownStatus = DeadlineStatus | "overdue";

/** Which deadlines the Calendar shows: the calendars not hidden, and one building or, with null, all. */
export interface CalendarFilters {
  hidden: ReadonlySet<CalendarId>;
  buildingId: string | null;
}

/** Open (new) and its day before today: due today is not overdue, closed and cancelled never are. */
export function isOverdue(deadline: Deadline, today: string): boolean {
  return deadline.status === "new" && deadline.date < today;
}

export function shownStatus(deadline: Deadline, today: string): ShownStatus {
  return isOverdue(deadline, today) ? "overdue" : deadline.status;
}

/** Not in a hidden calendar; and, when a building is chosen, computed ones of it and typed ones tied to it. */
export function isShown(deadline: Deadline, filters: CalendarFilters): boolean {
  if (filters.hidden.has(deadline.calendar)) {
    return false;
  }

  return (
    filters.buildingId === null || deadline.buildingId === filters.buildingId
  );
}
