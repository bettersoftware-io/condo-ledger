import type { ReactElement } from "react";

import { useViewModel } from "@cl/react-bindings";

import { Panel } from "../Panel.tsx";
import { TESTIDS } from "../testids.ts";
import { CalendarToolbar } from "./CalendarToolbar.tsx";
import { MonthGrid } from "./MonthGrid.tsx";
import { ViewFooter } from "./ViewFooter.tsx";

import "./CalendarScreen.css";

/**
 * The Calendar: the month, with its toolbar and the views' footer, beside
 * the deadlines column. Reads the view model and hands plain props down.
 * Clicking a line of the selected day selects its deadline; a line of
 * another day reveals it, which selects its day too.
 */
export function CalendarScreen(): ReactElement {
  const { useCalendar, useCalendarIntents, useNotices } = useViewModel();
  const view = useCalendar();
  const {
    previousMonth,
    nextMonth,
    goToToday,
    selectDay,
    selectDeadline,
    toggleCalendar,
    showAllCalendars,
    showNoCalendars,
    setBuilding,
    reveal,
  } = useCalendarIntents();
  const { stub } = useNotices();

  function refresh(): void {
    stub("Refresh");
  }

  function chooseDeadline(id: string, day: string): void {
    if (day === view?.day) {
      selectDeadline(id);
    } else {
      reveal(id, day);
    }
  }

  return (
    <div className="calendar-screen" data-testid={TESTIDS.calendarScreen}>
      <div className="calendar-month">
        <Panel title="Calendar">
          {view === null ? null : (
            <div className="calendar-month-body">
              <CalendarToolbar
                month={view.month}
                hidden={view.filters.hidden}
                buildings={view.buildings}
                buildingId={view.filters.buildingId}
                onPrevious={previousMonth}
                onNext={nextMonth}
                onToday={goToToday}
                onToggleCalendar={toggleCalendar}
                onAllCalendars={showAllCalendars}
                onNoCalendars={showNoCalendars}
                onBuilding={setBuilding}
                onRefresh={refresh}
              />
              <MonthGrid
                weeks={view.weeks}
                byDay={view.byDay}
                today={view.today}
                day={view.day}
                selectedId={view.selected?.id ?? null}
                names={view.names}
                onSelectDay={selectDay}
                onSelectDeadline={chooseDeadline}
              />
              <ViewFooter />
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
