import { Check } from "lucide-react";
import type { ReactElement } from "react";

import { CALENDARS, type CalendarId } from "@cl/domain";

import { Popover } from "../shell/Popover.tsx";
import { calendarName } from "./calendarWords.ts";

import "./CalendarToolbar.css";
import "./calendarColours.css";

/**
 * The popover the Calendars button opens, 218px under it: "Show calendars",
 * All and None, then a row per calendar with its box and colour square. A
 * row shows or hides its calendar and the menu stays open. Takes only props,
 * so the compiler memoizes it.
 */
export function CalendarsMenu({
  open,
  hidden,
  onToggle,
  onAll,
  onNone,
  onClose,
}: CalendarsMenuProps): ReactElement {
  function toggling(id: CalendarId): () => void {
    return (): void => {
      onToggle(id);
    };
  }

  return (
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
      onClose={onClose}
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
  );
}

export interface CalendarsMenuProps {
  open: boolean;
  /** The calendars hidden; every other one is shown. */
  hidden: ReadonlySet<CalendarId>;
  onToggle: (id: CalendarId) => void;
  onAll: () => void;
  onNone: () => void;
  onClose: () => void;
}
