import { type ReactElement, useRef, useState } from "react";

import type { MaximizeIntents, MaximizeState } from "@cl/client-core";
import type { Result } from "@cl/domain";
import { type MachineView, useViewModel } from "@cl/react-bindings";

import { Panel } from "../Panel.tsx";
import { TESTIDS } from "../testids.ts";
import { JOURNAL_COLUMN_SPECS } from "./columns.ts";
import { DeleteEntryConfirm } from "./DeleteEntryConfirm.tsx";
import { JournalGrid } from "./JournalGrid.tsx";
import { JournalToolbar } from "./JournalToolbar.tsx";
import { JournalWizard } from "./JournalWizard.tsx";

import "./JournalScreen.css";

/**
 * Journal & Daybook: the period's entries by number, a page at a time, with
 * the dialog open over them. Reads the view model and hands plain props down.
 * The maximize machine is the shell's, so a maximized panel also folds the
 * sidebar. ✎ and a double click on an entry open its edit. When a dialog
 * closes, the focus goes back to the grid; a saved entry is revealed there,
 * selected.
 */
export function JournalScreen({ maximize }: JournalScreenProps): ReactElement {
  const {
    useJournalEntries,
    useJournalGrid,
    useJournalDialog,
    useColumns,
    useNotices,
    useDeleteEntry,
  } = useViewModel();
  const entries = useJournalEntries();
  const grid = useJournalGrid();
  const dialog = useJournalDialog();
  const columns = useColumns("journal", JOURNAL_COLUMN_SPECS);
  const { stub } = useNotices();
  const deleteEntry = useDeleteEntry();
  const [deleteRefusal, setDeleteRefusal] = useState<string | null>(null);
  const gridArea = useRef<HTMLDivElement>(null);
  const maximized = maximize.state.maximized;
  const selected =
    entries.find((entry) => {
      return entry.id === grid.state.selectedId;
    }) ?? null;
  const open = dialog.state.open;

  function toggleMaximized(): void {
    maximize.toggle("top");
  }

  function openDelete(): void {
    setDeleteRefusal(null);
    dialog.openDelete();
  }

  /** The tool is enabled only while an entry is selected. */
  function editSelected(): void {
    if (selected !== null) {
      dialog.openEdit(selected.id);
    }
  }

  function closeDialog(): void {
    dialog.close();
    gridArea.current?.focus();
  }

  function revealSaved(id: string): void {
    closeDialog();
    grid.reveal(id);
  }

  /** The alert is drawn only while an entry is selected: the selection is what Yes deletes. */
  function confirmDelete(): void {
    if (selected !== null) {
      // A click waits for nothing: the entry leaves the grid on the
      // presenter's stream, and the verdict is shown when it arrives.
      void deleteEntry(selected.id).then(settleDelete).catch(reportFailed);
    }
  }

  function settleDelete(result: Result): void {
    if (result.ok) {
      closeDialog();

      return;
    }

    setDeleteRefusal(result.reason);
  }

  return (
    <div
      className="journal-screen"
      data-testid={TESTIDS.journalScreen}
      data-maximized={maximized ?? "none"}
    >
      <Panel
        title="Journal"
        meta={`${entries.length} entries total`}
        maximized={maximized === "top"}
        onToggleMaximize={toggleMaximized}
      >
        <div className="journal-body">
          <JournalToolbar
            search={grid.state.search}
            editable={selected?.editable ?? null}
            canDelete={selected !== null}
            page={grid.state.page}
            pageCount={grid.state.pageCount}
            pageSize={grid.state.pageSize}
            onSearch={grid.setSearch}
            onAdd={dialog.openWizard}
            onStub={stub}
            onEdit={editSelected}
            onDelete={openDelete}
            onExpandAll={grid.expandAll}
            onCollapseAll={grid.collapseAll}
            onPage={grid.setPage}
            onPageSize={grid.setPageSize}
          />
          <div
            ref={gridArea}
            className="journal-grid"
            data-testid={TESTIDS.journalGrid}
            tabIndex={-1}
          >
            <JournalGrid
              rows={grid.state.rows}
              template={columns.state.template}
              searching={grid.state.searching}
              onToggle={grid.toggle}
              onSelect={grid.select}
              onEdit={dialog.openEdit}
              onResize={columns.resize}
            />
          </div>
        </div>
      </Panel>
      {open?.kind === "delete" && selected !== null ? (
        <DeleteEntryConfirm
          description={selected.description}
          reason={deleteRefusal}
          onYes={confirmDelete}
          onNo={closeDialog}
        />
      ) : null}
      {open?.kind === "wizard" ? (
        <JournalWizard
          key={`${open.wizard}:${open.editing ?? "new"}`}
          wizard={open.wizard}
          editing={open.editing}
          onSaved={revealSaved}
          onCancel={closeDialog}
        />
      ) : null}
    </div>
  );
}

export interface JournalScreenProps {
  /** The shell's: whether the journal fills the screen, shared with the sidebar's rail. */
  maximize: MachineView<MaximizeState, MaximizeIntents>;
}

/* v8 ignore next 3 -- only a real journal store can fail to answer; the simulator always does */
function reportFailed(error: unknown): void {
  console.error("the entry was not deleted", error);
}
