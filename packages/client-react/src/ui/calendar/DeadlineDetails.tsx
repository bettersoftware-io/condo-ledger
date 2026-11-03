import type { ReactElement, ReactNode } from "react";

import type { DeadlineNames } from "@cl/client-core";
import { type Deadline, shownStatus } from "@cl/domain";

import { useLocale } from "../amountLocale.ts";
import { formatDate } from "../format.ts";
import { TESTIDS } from "../testids.ts";
import {
  calendarName,
  descriptionOf,
  notesOf,
  priorityWord,
  statusMark,
  statusWord,
} from "./calendarWords.ts";

import "./calendarColours.css";
import "./DeadlinesColumn.css";

/**
 * The selected deadline, row by row: Description, Date (with its time),
 * Calendar (its colour square and name), Building, Status and Priority; then
 * the NOTES box. With nothing selected it says so. Takes only props, so the
 * compiler memoizes it.
 */
export function DeadlineDetails({
  deadline,
  today,
  names,
}: DeadlineDetailsProps): ReactElement {
  const locale = useLocale();

  if (deadline === null) {
    return (
      <div
        className="deadline-details deadline-details-empty"
        data-testid={TESTIDS.deadlineDetails}
      >
        No deadline selected.
      </div>
    );
  }

  const status = shownStatus(deadline, today);
  const notes = notesOf(deadline, names, locale);

  return (
    <div className="deadline-details" data-testid={TESTIDS.deadlineDetails}>
      <DetailRow label="Description">
        {descriptionOf(deadline, names, locale)}
      </DetailRow>
      <DetailRow label="Date">
        {formatDate(deadline.date)}
        {deadline.time === null ? "" : ` ${deadline.time}`}
      </DetailRow>
      <DetailRow label="Calendar">
        <span className={`deadline-value calendar-${deadline.calendar}`}>
          <span className="calendar-square" />
          {calendarName(deadline.calendar)}
        </span>
      </DetailRow>
      <DetailRow label="Building">
        {deadline.buildingId === null
          ? "—"
          : names.buildingName(deadline.buildingId)}
      </DetailRow>
      <DetailRow label="Status">
        <span className="deadline-value">
          <span
            className="calendar-mark"
            data-testid={TESTIDS.calendarMark}
            data-status={status}
          >
            {statusMark(status)}
          </span>
          {statusWord(status)}
        </span>
      </DetailRow>
      <DetailRow label="Priority">
        <span className="deadline-value">
          {deadline.priority === "none" ? null : (
            <span
              className="priority-dot"
              data-testid={TESTIDS.priorityDot}
              data-priority={deadline.priority}
            />
          )}
          {priorityWord(deadline.priority)}
        </span>
      </DetailRow>
      <div className="deadline-notes" data-testid={TESTIDS.deadlineNotes}>
        <div className="deadline-notes-label">NOTES</div>
        <div className="deadline-notes-text">{notes ?? ""}</div>
      </div>
    </div>
  );
}

function DetailRow({ label, children }: DetailRowProps): ReactElement {
  return (
    <div
      className="deadline-details-row"
      data-testid={TESTIDS.deadlineDetailsRow}
    >
      <span className="deadline-details-label">{label}</span>
      <span className="deadline-details-value">{children}</span>
    </div>
  );
}

export interface DeadlineDetailsProps {
  deadline: Deadline | null;
  /** The ISO day that counts as today, for the overdue status. */
  today: string;
  names: DeadlineNames;
}

interface DetailRowProps {
  label: string;
  children: ReactNode;
}
