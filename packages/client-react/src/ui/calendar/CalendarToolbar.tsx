import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import type { ReactElement } from "react";

import type { CalendarId } from "@cl/domain";

import { ToolbarButton } from "../ToolbarButton.tsx";
import { ToolbarDivider } from "../ToolbarDivider.tsx";
import { TESTIDS } from "../testids.ts";
import { type ValueOption, ValueSelect } from "../ValueSelect.tsx";
import { CalendarsPopover } from "./CalendarsPopover.tsx";
import { monthTitle } from "./calendarWords.ts";

import "./CalendarToolbar.css";

/**
 * The month's toolbar: `‹` the month `›`, Today, the Calendars filter, and
 * on the right the Building select (its value drawn as text over it) and ⟳.
 * Takes only props, so the compiler memoizes it.
 */
export function CalendarToolbar({
  month,
  hidden,
  buildings,
  buildingId,
  onPrevious,
  onNext,
  onToday,
  onToggleCalendar,
  onAllCalendars,
  onNoCalendars,
  onBuilding,
  onRefresh,
}: CalendarToolbarProps): ReactElement {
  function chooseBuilding(value: string): void {
    onBuilding(value === ALL ? null : value);
  }

  const buildingOptions: ValueOption<string>[] = [
    { value: ALL, label: ALL_LABEL },
    ...buildings.map((building) => {
      return { value: building.id, label: building.name };
    }),
  ];

  return (
    <div className="calendar-toolbar" data-testid={TESTIDS.calendarToolbar}>
      <span className="calendar-step">
        <ToolbarButton
          label="Previous month"
          icon={<ChevronLeft size={15} />}
          iconOnly
          onClick={onPrevious}
        />
      </span>
      <span
        className="calendar-month-title"
        data-testid={TESTIDS.calendarMonthTitle}
      >
        {monthTitle(month)}
      </span>
      <span className="calendar-step">
        <ToolbarButton
          label="Next month"
          icon={<ChevronRight size={15} />}
          iconOnly
          onClick={onNext}
        />
      </span>
      <ToolbarButton label="Today" onClick={onToday} />
      <ToolbarDivider />
      <CalendarsPopover
        hidden={hidden}
        onToggle={onToggleCalendar}
        onAll={onAllCalendars}
        onNone={onNoCalendars}
      />
      <span className="calendar-toolbar-spacer" />
      <span className="calendar-building-label" aria-hidden="true">
        Building:
      </span>
      <span className="calendar-building">
        <ValueSelect
          label="Building"
          options={buildingOptions}
          value={buildingId ?? ALL}
          onChange={chooseBuilding}
        />
      </span>
      <ToolbarButton
        label="Refresh"
        icon={<RotateCw size={13} />}
        tone="muted"
        iconOnly
        onClick={onRefresh}
      />
    </div>
  );
}

/** A building of the select. */
interface BuildingChoice {
  id: string;
  name: string;
}

export interface CalendarToolbarProps {
  /** `YYYY-MM`. */
  month: string;
  /** The calendars hidden. */
  hidden: ReadonlySet<CalendarId>;
  /** The Building select's choices after "— All —", in order. */
  buildings: BuildingChoice[];
  /** The building chosen; null for all. */
  buildingId: string | null;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onToggleCalendar: (id: CalendarId) => void;
  onAllCalendars: () => void;
  onNoCalendars: () => void;
  /** A building's id; null for all. */
  onBuilding: (buildingId: string | null) => void;
  onRefresh: () => void;
}

/** The value of "— All —". */
const ALL = "all";

const ALL_LABEL = "— All —";
