import { type ReactElement, useEffect, useRef } from "react";

import { useViewModel } from "@cl/react-bindings";

import { Panel } from "../Panel.tsx";
import { SidebarFrame } from "../shell/SidebarFrame.tsx";
import { Splitter } from "../shell/Splitter.tsx";
import { TESTIDS } from "../testids.ts";
import { dayTitle } from "./calendarWords.ts";
import { DayList } from "./DayList.tsx";
import { DeadlineDetails } from "./DeadlineDetails.tsx";
import { DeadlinesToolbar } from "./DeadlinesToolbar.tsx";

import "./DeadlinesColumn.css";

/**
 * The Calendar's right-hand column, in the shell's frame mirrored: the
 * selected day's deadlines over the selected deadline's details, sharing the
 * column by a split ratio (40% for the list at first). Reads the Calendar
 * and the column's own width and drawer, and hands plain props down. The
 * toolbar's + ✎ − are drawn here; their actions arrive with the dialog.
 */
export function DeadlinesColumn({
  maximized,
  onRestore,
}: DeadlinesColumnProps): ReactElement {
  const {
    useCalendar,
    useCalendarIntents,
    useDeadlinesColumn,
    useSplit,
    useNotices,
  } = useViewModel();
  const view = useCalendar();
  const { selectDeadline } = useCalendarIntents();
  const column = useDeadlinesColumn();
  const split = useSplit("calendar");
  const { stub } = useNotices();
  const body = useRef<HTMLDivElement>(null);
  const ratio = split.state.ratio;

  useEffect(() => {
    body.current?.style.setProperty("--split-ratio", String(ratio));
  }, [ratio]);

  function moveSplitBy(deltaPx: number): void {
    const height = body.current?.getBoundingClientRect().height ?? 0;

    if (height > 0) {
      split.setRatio(ratio + deltaPx / height);
    }
  }

  function add(): void {
    stub("Add deadline");
  }

  function edit(): void {
    stub("Edit deadline");
  }

  function remove(): void {
    stub("Delete deadline");
  }

  return (
    <SidebarFrame
      width={column.state.width}
      open={column.state.open}
      maximized={maximized}
      side="right"
      railLabel="DEADLINES"
      railTitle="Open deadlines"
      onResize={column.resize}
      onOpen={column.open}
      onClose={column.close}
      onRestore={onRestore}
    >
      <div
        ref={body}
        className="deadlines-column"
        data-testid={TESTIDS.deadlinesColumn}
      >
        {view === null ? null : (
          <>
            <div className="deadlines-top">
              <Panel title={`Deadlines for ${dayTitle(view.day)}`}>
                <div className="deadlines-top-body">
                  <DeadlinesToolbar
                    selected={view.selected}
                    onAdd={add}
                    onEdit={edit}
                    onDelete={remove}
                  />
                  <DayList
                    deadlines={view.dayDeadlines}
                    selectedId={view.selected?.id ?? null}
                    today={view.today}
                    names={view.names}
                    onSelect={selectDeadline}
                  />
                </div>
              </Panel>
            </div>
            <Splitter direction="horizontal" onDrag={moveSplitBy} />
            <div className="deadlines-bottom">
              <Panel title="Selected deadline details">
                <DeadlineDetails
                  deadline={view.selected}
                  today={view.today}
                  names={view.names}
                />
              </Panel>
            </div>
          </>
        )}
      </div>
    </SidebarFrame>
  );
}

export interface DeadlinesColumnProps {
  /** A panel of the main area fills the screen: the rail stands in for the column. */
  maximized: boolean;
  onRestore: () => void;
}
