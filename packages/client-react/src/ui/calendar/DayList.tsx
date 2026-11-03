import type { ReactElement } from "react";

import type { DeadlineNames } from "@cl/client-core";
import { type Deadline, shownStatus } from "@cl/domain";

import { useLocale } from "../amountLocale.ts";
import { TESTIDS } from "../testids.ts";
import {
  descriptionOf,
  priorityWord,
  statusMark,
  statusWord,
} from "./calendarWords.ts";

import "./calendarColours.css";
import "./DeadlinesColumn.css";

/**
 * The selected day's deadlines: a grid of time, status mark, priority dot
 * and description (cut, with the whole of it as a tooltip), in the order the
 * presenter gives. Selecting a row selects its deadline. A day with none
 * says so. Takes only props, so the compiler memoizes it.
 */
export function DayList({
  deadlines,
  selectedId,
  today,
  names,
  onSelect,
}: DayListProps): ReactElement {
  const locale = useLocale();

  function select(id: string): () => void {
    return (): void => {
      onSelect(id);
    };
  }

  return (
    <div className="day-list" data-testid={TESTIDS.dayList}>
      <div className="day-list-header">
        <span>Time</span>
        <span className="day-list-centred">St.</span>
        <span className="day-list-centred">Pr.</span>
        <span>Description</span>
      </div>
      <div className="day-list-body">
        {deadlines.map((deadline) => {
          const status = shownStatus(deadline, today);
          const description = descriptionOf(deadline, names, locale);

          return (
            <button
              key={deadline.id}
              type="button"
              className="day-list-row"
              data-testid={TESTIDS.dayListRow}
              aria-pressed={deadline.id === selectedId}
              onClick={select(deadline.id)}
            >
              <span className="day-list-time">{deadline.time ?? ""}</span>
              <span
                className="calendar-mark day-list-centred"
                data-testid={TESTIDS.calendarMark}
                data-status={status}
                title={statusWord(status)}
              >
                {statusMark(status)}
              </span>
              <span className="day-list-centred">
                {deadline.priority === "none" ? null : (
                  <span
                    className="priority-dot"
                    data-testid={TESTIDS.priorityDot}
                    data-priority={deadline.priority}
                    title={priorityWord(deadline.priority)}
                  />
                )}
              </span>
              <span className="day-list-text" title={description}>
                {description}
              </span>
            </button>
          );
        })}
        {deadlines.length === 0 ? (
          <div className="day-list-empty" data-testid={TESTIDS.dayListEmpty}>
            No deadlines on this day.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export interface DayListProps {
  /** The day's shown deadlines, in order. */
  deadlines: Deadline[];
  selectedId: string | null;
  /** The ISO day that counts as today, for a deadline's overdue mark. */
  today: string;
  names: DeadlineNames;
  onSelect: (id: string) => void;
}
