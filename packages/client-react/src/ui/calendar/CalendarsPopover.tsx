import { ChevronDown, LayoutGrid } from "lucide-react";
import { type ReactElement, useState } from "react";

import { CALENDARS, type CalendarId } from "@cl/domain";

import { TESTIDS } from "../testids.ts";
import { CalendarsMenu } from "./CalendarsMenu.tsx";

import "./CalendarToolbar.css";

/**
 * The Calendars button (▦, its label, a badge counting the calendars shown,
 * ▾) and the menu it opens (`CalendarsMenu`). Whether it is open is this
 * view's own state. Takes only props, so the compiler memoizes it.
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
      <CalendarsMenu
        open={open}
        hidden={hidden}
        onToggle={onToggle}
        onAll={onAll}
        onNone={onNone}
        onClose={closePopover}
      />
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
