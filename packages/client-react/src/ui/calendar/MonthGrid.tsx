import type { ReactElement } from "react";

import type { DeadlineNames } from "@cl/client-core";
import type { Deadline, MonthWeek } from "@cl/domain";

import { TESTIDS } from "../testids.ts";
import { WEEKDAYS } from "./calendarWords.ts";
import { DayCell } from "./DayCell.tsx";

import "./MonthGrid.css";

/**
 * The month: the weekday header, Monday first, then one row per week the
 * month touches, four to six, sharing the height. Takes only props, so the
 * compiler memoizes it.
 */
export function MonthGrid({
  weeks,
  byDay,
  today,
  day,
  selectedId,
  names,
  onSelectDay,
  onSelectDeadline,
}: MonthGridProps): ReactElement {
  return (
    <div className="month-grid" data-testid={TESTIDS.monthGrid}>
      <div className="month-weekdays">
        {WEEKDAYS.map((name, index) => {
          return (
            <div
              key={name}
              className="month-weekday"
              data-testid={TESTIDS.weekday}
              data-weekday={index}
            >
              {name}
            </div>
          );
        })}
      </div>
      <div className="month-weeks">
        {weeks.map((week) => {
          return (
            <div
              key={weekKey(week)}
              className="month-week"
              data-testid={TESTIDS.monthWeek}
            >
              {week.days.map((date, index) => {
                return (
                  <DayCell
                    // A blank day is keyed by its place: the week's key tells weeks apart.
                    key={date ?? `blank-${index}`}
                    day={date}
                    weekday={index}
                    deadlines={date === null ? NONE : (byDay.get(date) ?? NONE)}
                    today={today}
                    selected={date === day}
                    selectedId={selectedId}
                    names={names}
                    onSelectDay={onSelectDay}
                    onSelectDeadline={onSelectDeadline}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface MonthGridProps {
  weeks: MonthWeek[];
  /** The month's shown deadlines by ISO day, each in the day list's order. */
  byDay: Map<string, Deadline[]>;
  today: string;
  /** The selected day. */
  day: string;
  /** The selected deadline's id; null with none. */
  selectedId: string | null;
  names: DeadlineNames;
  onSelectDay: (day: string) => void;
  onSelectDeadline: (id: string, day: string) => void;
}

const NONE: readonly Deadline[] = [];

/** A week by its first day of the month: every week has one. */
function weekKey(week: MonthWeek): string {
  return (
    week.days.find((date) => {
      return date !== null;
    }) ?? "none"
  );
}
