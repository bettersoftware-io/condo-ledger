import type { ReactElement } from "react";

import type { DeadlineNames } from "@cl/client-core";
import { type Deadline, shownStatus } from "@cl/domain";

import { useLocale } from "../amountLocale.ts";
import { TESTIDS } from "../testids.ts";
import {
  dayTitle,
  descriptionOf,
  statusMark,
  statusWord,
} from "./calendarWords.ts";

import "./calendarColours.css";
import "./MonthGrid.css";

/**
 * One day of the month: its number top right (today ringed, the selected day
 * on --sel), then a line per deadline in the day list's order, each with its
 * calendar's bar, its status mark, its time and its description cut with a
 * tooltip. More than three lines leave two and "+N more", which selects the
 * day. A button under the lines fills the cell and selects the day; a line
 * selects its deadline. A day of the months around is blank. Takes only props, so the
 * compiler memoizes it.
 */
export function DayCell({
  day,
  weekday,
  deadlines,
  today,
  selected,
  selectedId,
  names,
  onSelectDay,
  onSelectDeadline,
}: DayCellProps): ReactElement {
  const locale = useLocale();

  if (day === null) {
    return (
      <div
        className="day-cell"
        data-testid={TESTIDS.dayCell}
        data-weekday={weekday}
        data-blank="true"
      />
    );
  }

  const shown =
    deadlines.length > MAX_LINES
      ? deadlines.slice(0, MAX_LINES - 1)
      : deadlines;
  const more = deadlines.length - shown.length;
  // A function declaration is hoisted above the check, so it does not see `day` narrowed.
  const date = day;

  function selectDay(): void {
    onSelectDay(date);
  }

  function selectDeadlineOf(id: string): () => void {
    return (): void => {
      onSelectDeadline(id, date);
    };
  }

  return (
    <div
      className="day-cell"
      data-testid={TESTIDS.dayCell}
      data-day={day}
      data-weekday={weekday}
      data-selected={selected}
      data-today={day === today}
      data-empty={deadlines.length === 0}
    >
      <button
        type="button"
        className="day-cell-select"
        aria-label={dayTitle(day)}
        aria-pressed={selected}
        aria-current={day === today ? "date" : undefined}
        onClick={selectDay}
      >
        <span className="day-number" data-testid={TESTIDS.dayNumber}>
          {Number(day.slice(8, 10))}
        </span>
      </button>
      <div className="day-lines">
        {shown.map((deadline) => {
          const status = shownStatus(deadline, today);
          const description = descriptionOf(deadline, names, locale);

          return (
            <button
              key={deadline.id}
              type="button"
              className={`day-line calendar-${deadline.calendar}`}
              data-testid={TESTIDS.dayLine}
              data-calendar={deadline.calendar}
              aria-pressed={selected && deadline.id === selectedId}
              title={description}
              onClick={selectDeadlineOf(deadline.id)}
            >
              <span
                className="calendar-mark"
                data-testid={TESTIDS.calendarMark}
                data-status={status}
                title={statusWord(status)}
              >
                {statusMark(status)}
              </span>
              {deadline.time === null ? null : (
                <span className="day-line-time">{deadline.time}</span>
              )}
              <span className="day-line-text">{description}</span>
            </button>
          );
        })}
        {more > 0 ? (
          <button
            type="button"
            className="day-more"
            data-testid={TESTIDS.dayMore}
            onClick={selectDay}
          >
            +{more} more
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** The lines a cell draws before it gives the rest to "+N more". */
const MAX_LINES = 3;

export interface DayCellProps {
  /** The ISO day; null for a day of the months around, drawn blank. */
  day: string | null;
  /** 0 for Monday to 6 for Sunday: Saturday and Sunday are tinted. */
  weekday: number;
  /** The day's shown deadlines, in the day list's order. */
  deadlines: readonly Deadline[];
  /** Rome's today, ISO: ringed, and what overdue is judged against. */
  today: string;
  /** Whether this is the selected day. */
  selected: boolean;
  /** The selected deadline's id: its line is drawn selected on the selected day. */
  selectedId: string | null;
  names: DeadlineNames;
  onSelectDay: (day: string) => void;
  /** A line's deadline and its day. */
  onSelectDeadline: (id: string, day: string) => void;
}
