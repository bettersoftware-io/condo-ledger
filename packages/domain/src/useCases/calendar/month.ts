import type { Deadline } from "#/entities/deadline.ts";

import { type CalendarFilters, isShown } from "./overdue.ts";

/** Seven ISO days of a week, Monday first; null for a day of the months around. */
export interface MonthWeek {
  days: (string | null)[];
}

const DAY_MS = 86_400_000;
const SOURCE_ORDER: Record<Deadline["source"], number> = {
  installment: 0,
  invoice: 1,
  manual: 2,
};

/** The weeks of a `YYYY-MM` month, Monday first. */
export function weeksOf(month: string): MonthWeek[] {
  const { year, monthIndex } = parseMonth(month);
  const first = Date.UTC(year, monthIndex, 1);
  const length = daysIn(year, monthIndex);
  const offset = (new Date(first).getUTCDay() + 6) % 7;
  const weeks: MonthWeek[] = [];

  for (let start = 1 - offset; start <= length; start += 7) {
    const days: (string | null)[] = [];

    for (let day = start; day < start + 7; day += 1) {
      days.push(
        day >= 1 && day <= length ? iso(first + (day - 1) * DAY_MS) : null,
      );
    }

    weeks.push({ days });
  }

  return weeks;
}

/** The month n months after (before, when negative) a `YYYY-MM` one. */
export function addMonths(month: string, n: number): string {
  const { year, monthIndex } = parseMonth(month);
  const index = year * 12 + monthIndex + n;

  return `${pad(Math.floor(index / 12), 4)}-${pad((index % 12) + 1, 2)}`;
}

/** The same day number in another month, or its last day when it has fewer. */
export function sameDayIn(day: string, month: string): string {
  const { year, monthIndex } = parseMonth(month);
  const number = Math.min(Number(day.slice(8, 10)), daysIn(year, monthIndex));

  return `${month}-${pad(number, 2)}`;
}

/** The ISO day n days after (before, when negative) an ISO one. */
export function addDays(day: string, n: number): string {
  return iso(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS);
}

/** The deadlines shown on a day, in order: no time first, then by time; installments, invoices, typed; then by number or description. */
export function deadlinesOfDay(
  deadlines: Deadline[],
  day: string,
  filters: CalendarFilters,
): Deadline[] {
  return deadlines
    .filter((deadline) => {
      return deadline.date === day && isShown(deadline, filters);
    })
    .sort(compareWithinDay);
}

/** The shown deadlines of a month by day, each day in the order of `deadlinesOfDay`. */
export function deadlinesByDay(
  deadlines: Deadline[],
  month: string,
  filters: CalendarFilters,
): Map<string, Deadline[]> {
  const byDay = new Map<string, Deadline[]>();

  for (const deadline of deadlines) {
    if (!deadline.date.startsWith(`${month}-`) || !isShown(deadline, filters)) {
      continue;
    }

    byDay.set(deadline.date, [...(byDay.get(deadline.date) ?? []), deadline]);
  }

  for (const list of byDay.values()) {
    list.sort(compareWithinDay);
  }

  return byDay;
}

function compareWithinDay(a: Deadline, b: Deadline): number {
  return (
    compareTimes(a.time, b.time) ||
    SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] ||
    compareInside(a, b)
  );
}

function compareTimes(a: string | null, b: string | null): number {
  if (a === null || b === null) {
    return (a === null ? 0 : 1) - (b === null ? 0 : 1);
  }

  return a.localeCompare(b);
}

function compareInside(a: Deadline, b: Deadline): number {
  if (a.source === "installment" && b.source === "installment") {
    return a.installmentNumber - b.installmentNumber;
  }

  if (a.source === "invoice" && b.source === "invoice") {
    return compareNumbers(a.invoiceNumber, b.invoiceNumber);
  }

  if (a.source === "manual" && b.source === "manual") {
    return a.description.localeCompare(b.description, "it");
  }

  return 0;
}

function compareNumbers(a: string, b: string): number {
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
    return Number(a) - Number(b);
  }

  return a.localeCompare(b);
}

interface YearMonth {
  year: number;
  monthIndex: number;
}

function parseMonth(month: string): YearMonth {
  return {
    year: Number(month.slice(0, 4)),
    monthIndex: Number(month.slice(5, 7)) - 1,
  };
}

function daysIn(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function iso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}
