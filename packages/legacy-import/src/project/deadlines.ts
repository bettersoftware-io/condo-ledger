import type {
  DeadlinePriority,
  DeadlineStatus,
  ManualDeadline,
} from "@cl/domain";

import type { Db } from "../db.ts";
import type { Row } from "../loadRows.ts";

/** The dump's calendarEvent.priority, in the domain's words. "idle" is a priority the legacy form offered for none. */
const PRIORITIES: Readonly<Record<string, DeadlinePriority>> = {
  idle: "none",
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical",
};

const STATUSES: Readonly<Record<string, DeadlineStatus>> = {
  new: "new",
  closed: "closed",
  cancelled: "cancelled",
};

/**
 * The legacy calendar's hand-entered events (calendarEvent), by id number. All
 * go to General: the dump's layers are empty, so a row that names one stops
 * the generator rather than guess its calendar. None is tied to a building:
 * its studio is the firm, or nobody.
 */
export function projectDeadlines(db: Db): ManualDeadline[] {
  return db
    .rows("calendarEvent")
    .slice()
    .sort((a, b) => {
      return Number(a.id) - Number(b.id);
    })
    .map((row) => {
      return projectDeadline(row);
    });
}

function projectDeadline(row: Row): ManualDeadline {
  const id = `ce${String(row.id)}`;

  if (text(row.layerId) !== undefined) {
    throw new Error(
      `the calendar event ${id} is on the layer ${String(row.layerId)}, which the domain does not know`,
    );
  }

  const stamp = text(row.date);
  const match =
    stamp === undefined
      ? null
      : /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(stamp);

  if (match === null) {
    throw new Error(
      `the calendar event ${id} has no date: ${String(row.date)}`,
    );
  }

  const [, date = "", hours = "", minutes = ""] = match;
  const hasTime = !isSet(row.ignoreTime) && `${hours}:${minutes}` !== "00:00";

  return {
    id,
    date,
    time: hasTime ? `${hours}:${minutes}` : null,
    calendar: "general",
    buildingId: null,
    description: String(row.description).trim(),
    status: lookup(STATUSES, text(row.status), "new", "status", id),
    priority: lookup(PRIORITIES, text(row.priority), "none", "priority", id),
    notes: text(row.notes) ?? null,
  };
}

function lookup<T extends string>(
  table: Readonly<Record<string, T>>,
  written: string | undefined,
  fallback: T,
  what: string,
  id: string,
): T {
  if (written === undefined) {
    return fallback;
  }

  const value = Object.hasOwn(table, written) ? table[written] : undefined;

  if (value === undefined) {
    throw new Error(
      `the calendar event ${id} has the ${what} ${written}, which the domain does not know`,
    );
  }

  return value;
}

function isSet(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function text(value: unknown): string | undefined {
  return value === null || value === undefined || String(value).trim() === ""
    ? undefined
    : String(value).trim();
}
