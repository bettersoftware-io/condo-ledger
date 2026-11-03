import type { Cents } from "./cents.ts";

/** The calendars a deadline belongs to: two hold only what the books say, four hold what a person typed. */
export type CalendarId =
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

/** The calendars a person may type a deadline into: the other two are worked out from the books. */
export const MANUAL_CALENDARS: readonly CalendarId[] = [
  "fiscal",
  "policies",
  "interventions",
  "general",
];

/** A deadline worked out from an installment of a period's schedule: its due date, what is paid on it. */
export interface InstallmentDeadline {
  source: "installment";
  /** `installment:<installmentId>`. */
  id: string;
  date: string;
  time: null;
  calendar: "installments";
  buildingId: string;
  status: "new" | "closed";
  priority: "none";
  periodId: string;
  installmentId: string;
  installmentName: string;
  installmentNumber: number;
  total: Cents;
  paid: Cents;
  remaining: Cents;
}

/** A deadline worked out from an invoice: its due date, or 30 days after its date when it has none. */
export interface InvoiceDeadline {
  source: "invoice";
  /** `invoice:<invoiceId>`. */
  id: string;
  date: string;
  time: null;
  calendar: "invoices";
  buildingId: string;
  status: "new" | "closed";
  priority: "none";
  periodId: string;
  invoiceId: string;
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: string;
  reason: string;
  dueDateAssumed: boolean;
  /** What is due to the supplier. */
  total: Cents;
  paid: Cents;
  remaining: Cents;
}

/** Any deadline the Calendar shows: a typed one, or one the books work out. */
export type Deadline =
  | (ManualDeadline & { source: "manual" })
  | InstallmentDeadline
  | InvoiceDeadline;

/** A typed deadline, as the Calendar holds it among the others. */
export function manual(deadline: ManualDeadline): Deadline {
  return { ...deadline, source: "manual" };
}
