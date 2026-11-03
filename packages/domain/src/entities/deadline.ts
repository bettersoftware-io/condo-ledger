/** The calendars a deadline belongs to: two hold only what the books say, four hold what a person typed. */
type CalendarId =
  | "installments"
  | "invoices"
  | "fiscal"
  | "policies"
  | "interventions"
  | "general";

export type DeadlineStatus = "new" | "closed" | "cancelled";

export type DeadlinePriority = "none" | "low" | "medium" | "high" | "critical";

/** A deadline someone typed in: a day, perhaps a time, a calendar, perhaps a building. */
export interface ManualDeadline {
  /** `ce<n>`, from the legacy calendar event's number. */
  id: string;
  /** ISO day, `2026-02-05`. */
  date: string;
  /** `HH:MM`, or null for a deadline with no time of day. */
  time: string | null;
  calendar: CalendarId;
  /** The building it is tied to, or null for one that belongs to the whole studio. */
  buildingId: string | null;
  description: string;
  status: DeadlineStatus;
  priority: DeadlinePriority;
  notes: string | null;
}
