import { type ReactElement, useEffect, useRef, useState } from "react";

import { useViewModel } from "@cl/react-bindings";

import { Panel } from "../Panel.tsx";
import { SidebarFrame } from "../shell/SidebarFrame.tsx";
import { Splitter } from "../shell/Splitter.tsx";
import { TESTIDS } from "../testids.ts";
import { useDialogWrite } from "../useDialogWrite.ts";
import { dayTitle } from "./calendarWords.ts";
import { DayList } from "./DayList.tsx";
import { DeadlineDetails } from "./DeadlineDetails.tsx";
import { DeadlineDialog } from "./DeadlineDialog.tsx";
import { DeadlinesToolbar } from "./DeadlinesToolbar.tsx";
import { DeleteDeadline } from "./DeleteDeadline.tsx";

import "./DeadlinesColumn.css";

/**
 * The Calendar's right-hand column, in the shell's frame mirrored: the
 * selected day's deadlines over the selected deadline's details, sharing the
 * column by a split ratio (40% for the list at first). Reads the Calendar
 * and the column's own width and drawer, and hands plain props down. The
 * toolbar's + opens the Add Deadline dialog on the selected day and the
 * Building filter's building, ✎ the Edit one on the selected deadline, and −
 * asks before deleting it. ✎ and − are disabled on a deadline worked out from
 * the books, so only a typed one reaches them.
 */
export function DeadlinesColumn({
  maximized,
  onRestore,
}: DeadlinesColumnProps): ReactElement {
  const { useCalendar, useCalendarIntents, useDeadlinesColumn, useSplit } =
    useViewModel();
  const view = useCalendar();
  const { selectDeadline, deleteDeadline } = useCalendarIntents();
  const column = useDeadlinesColumn();
  const split = useSplit("calendar");
  const [open, setOpen] = useState<OpenDialog>(null);
  const deletion = useDialogWrite(close, "the deadline was not deleted");
  const body = useRef<HTMLDivElement>(null);
  const ratio = split.state.ratio;
  // Only a typed deadline reaches ✎ and −: the buttons are disabled on the others.
  const selected = view?.selected ?? null;
  const typed = selected?.source === "manual" ? selected : null;

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
    setOpen("add");
  }

  function edit(): void {
    setOpen("edit");
  }

  function remove(): void {
    setOpen("delete");
  }

  function close(): void {
    setOpen(null);
  }

  function confirmDelete(): void {
    if (typed !== null) {
      deletion.run(() => {
        return deleteDeadline(typed.id);
      });
    }
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
      {view !== null && open === "add" ? (
        <DeadlineDialog
          spec={{
            mode: "add",
            day: view.day,
            buildingId: view.filters.buildingId,
          }}
          onSaved={close}
          onCancel={close}
        />
      ) : null}
      {typed !== null && open === "edit" ? (
        <DeadlineDialog
          spec={{ mode: "edit", deadline: typed }}
          onSaved={close}
          onCancel={close}
        />
      ) : null}
      {typed !== null && open === "delete" ? (
        <DeleteDeadline
          description={typed.description}
          onYes={confirmDelete}
          onNo={close}
        />
      ) : null}
    </SidebarFrame>
  );
}

/** Which dialog is open over the column; null for none. */
type OpenDialog = "add" | "edit" | "delete" | null;

export interface DeadlinesColumnProps {
  /** A panel of the main area fills the screen: the rail stands in for the column. */
  maximized: boolean;
  onRestore: () => void;
}
