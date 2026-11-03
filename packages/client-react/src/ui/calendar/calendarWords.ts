import type { AmountLocale, DeadlineNames } from "@cl/client-core";
import type {
  CalendarId,
  Cents,
  Deadline,
  DeadlinePriority,
  ShownStatus,
} from "@cl/domain";

import { formatCents, formatDate } from "../format.ts";
import { reasonText as wordedReason } from "../journal/wizards/reasons.ts";

const CALENDAR_NAMES: Readonly<Record<CalendarId, string>> = {
  installments: "Installments",
  invoices: "Invoices",
  fiscal: "Fiscal",
  policies: "Policies",
  interventions: "Interventions",
  general: "General",
};

const STATUS_WORDS: Readonly<Record<ShownStatus, string>> = {
  new: "New",
  closed: "Closed",
  cancelled: "Cancelled",
  overdue: "Overdue",
};

const STATUS_MARKS: Readonly<Record<ShownStatus, string>> = {
  new: "✦",
  closed: "✓",
  cancelled: "✕",
  overdue: "!",
};

const PRIORITY_WORDS: Readonly<Record<DeadlinePriority, string>> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** The month grid's header, Monday first. */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The deadline dialog's refusals, by the domain's reason. */
const REASONS: Readonly<Record<string, string>> = {
  "blank-description": "Enter a description",
  "description-too-long": "A description has at most 255 characters",
  "bad-date": "The date is not a date",
  "bad-time": "The time is HH:MM, from 00:00 to 23:59",
  "books-calendar": "Installments and Invoices hold only what the books say",
  "unknown-building": "That building is not in the app",
};

export function calendarName(id: CalendarId): string {
  return CALENDAR_NAMES[id];
}

export function statusWord(status: ShownStatus): string {
  return STATUS_WORDS[status];
}

/** ✦ new, ✓ closed, ✕ cancelled, ! overdue. */
export function statusMark(status: ShownStatus): string {
  return STATUS_MARKS[status];
}

export function priorityWord(priority: DeadlinePriority): string {
  return PRIORITY_WORDS[priority];
}

/** A `YYYY-MM` month as the toolbar titles it: `November 2026`. */
export function monthTitle(month: string): string {
  const name = MONTH_NAMES[Number(month.slice(5, 7)) - 1] ?? month;

  return `${name} ${month.slice(0, 4)}`;
}

/** An ISO day as the Calendar names it: `2 November 2026`. */
export function dayTitle(day: string): string {
  return `${Number(day.slice(8, 10))} ${monthTitle(day.slice(0, 7))}`;
}

/**
 * What a deadline is called: a typed one's own description; one worked out
 * from the books is written from its figures, its amount in the session's
 * format.
 */
export function descriptionOf(
  deadline: Deadline,
  names: DeadlineNames,
  locale: AmountLocale,
): string {
  switch (deadline.source) {
    case "manual":
      return deadline.description;
    case "installment":
      return `${deadline.installmentName} due, ${names.buildingName(deadline.buildingId)} ${names.periodName(deadline.periodId)}`;
    case "invoice":
      return `Invoice due ${names.supplierName(deadline.supplierId)} no. ${deadline.invoiceNumber} of ${euros(deadline.total, locale)}`;
  }
}

/**
 * A deadline's notes, one line each: a typed one's own, none when blank; one
 * worked out from the books is written from them, as the legacy screen did.
 */
export function notesOf(
  deadline: Deadline,
  names: DeadlineNames,
  locale: AmountLocale,
): string | null {
  switch (deadline.source) {
    case "manual":
      return deadline.notes === null || deadline.notes.trim() === ""
        ? null
        : deadline.notes;
    case "installment":
      return [
        management(deadline.buildingId, deadline.periodId, names),
        `Installment: ${deadline.installmentName}`,
        `Due date: ${formatDate(deadline.date)}`,
        ...figures(deadline.total, deadline.paid, deadline.remaining, locale),
      ].join("\n");
    case "invoice":
      return [
        management(deadline.buildingId, deadline.periodId, names),
        `Supplier: ${names.supplierName(deadline.supplierId)}`,
        `Invoice no.: ${deadline.invoiceNumber}`,
        `Invoice date: ${formatDate(deadline.invoiceDate)}`,
        `Due date: ${formatDate(deadline.date)}${deadline.dueDateAssumed ? " (assumed: 30 days after the invoice date)" : ""}`,
        `Reason: ${deadline.reason}`,
        ...figures(deadline.total, deadline.paid, deadline.remaining, locale),
      ].join("\n");
  }
}

/** A refusal of the deadline dialog as the person reads it; a reason no one words is shown as it is. */
export function reasonText(reason: string): string {
  return wordedReason(reason, REASONS);
}

function management(
  buildingId: string,
  periodId: string,
  names: DeadlineNames,
): string {
  return `Management: ${names.buildingName(buildingId)} / ${names.periodName(periodId)}`;
}

function figures(
  total: Cents,
  paid: Cents,
  remaining: Cents,
  locale: AmountLocale,
): string[] {
  return [
    `Amount: ${euros(total, locale)}`,
    `Paid: ${euros(paid, locale)}`,
    `Left to pay: ${euros(remaining, locale)}`,
  ];
}

function euros(amount: Cents, locale: AmountLocale): string {
  return `€${formatCents(amount, locale)}`;
}
