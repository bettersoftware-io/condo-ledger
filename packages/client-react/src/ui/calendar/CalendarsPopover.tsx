import { Check, ChevronDown, LayoutGrid } from "lucide-react";
import { type ReactElement, useState } from "react";

import { CALENDARS, type CalendarId } from "@cl/domain";

import { Popover } from "../shell/Popover.tsx";
import { TESTIDS } from "../testids.ts";
import { calendarName } from "./calendarWords.ts";

import "./CalendarToolbar.css";
import "./calendarColours.css";

/**
 * The Calendars button (▦, its label, a badge counting the calendars shown,
 * ▾) and the 218px popover it opens: "Show calendars", All and None, then a
 * row per calendar with its box and colour square. A row shows or hides its
 * calendar and the popover stays open. Whether it is open is this view's
 * own state. Takes only props, so the compiler memoizes it.
 */
export function CalendarsPopover({
  hidden,
  onToggle,
  onAll,
  onNone,
}: CalendarsPopoverProps): ReactElement {
  const [open, setOpen] = useState(false);

  function openPopover(): void {
    setOpen(true);
  }

  function closePopover(): void {
    setOpen(false);
  }

  function toggling(id: CalendarId): () => void {
    return (): void => {
      onToggle(id);
    };
  }

  return (
    <div className="calendars-filter">
      <button
        type="button"
        className="calendars-button"
        data-testid={TESTIDS.calendarsButton}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={openPopover}
      >
        <LayoutGrid size={12} aria-hidden="true" />
        Calendars
        <span className="calendars-count" data-testid={TESTIDS.calendarsCount}>
          {CALENDARS.length - hidden.size}
        </span>
        <ChevronDown
          className="calendars-chevron"
          size={10}
          aria-hidden="true"
        />
      </button>
      <Popover
        open={open}
        label="Show calendars"
        action={
          <span className="calendars-all">
            <button
              type="button"
              className="calendars-link"
              role="menuitem"
              onClick={onAll}
            >
              All
            </button>
            <span aria-hidden="true">/</span>
            <button
              type="button"
              className="calendars-link"
              role="menuitem"
              onClick={onNone}
            >
              None
            </button>
          </span>
        }
        onClose={closePopover}
      >
        {CALENDARS.map((id) => {
          const shown = !hidden.has(id);

          return (
            <button
              key={id}
              type="button"
              className={`calendars-option calendar-${id}`}
              role="menuitemcheckbox"
              aria-checked={shown}
              onClick={toggling(id)}
            >
              <span className="calendars-box" aria-hidden="true">
                {shown ? <Check size={10} strokeWidth={3.5} /> : null}
              </span>
              <span className="calendar-square" aria-hidden="true" />
              <span className="calendars-option-name">{calendarName(id)}</span>
            </button>
          );
        })}
      </Popover>
    </div>
  );
}

export interface CalendarsPopoverProps {
  /** The calendars hidden; every other one is shown. */
  hidden: ReadonlySet<CalendarId>;
  onToggle: (id: CalendarId) => void;
  onAll: () => void;
  onNone: () => void;
}
