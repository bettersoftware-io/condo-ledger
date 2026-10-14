import { type ReactElement, useRef, useState } from "react";

import type {
  MaximizeIntents,
  MaximizeState,
  WizardName,
} from "@cl/client-core";
import type { Result } from "@cl/domain";
import { type MachineView, useViewModel } from "@cl/react-bindings";

import { Panel } from "../Panel.tsx";
import { TESTIDS } from "../testids.ts";
import { JOURNAL_COLUMN_SPECS } from "./columns.ts";
import { DeleteEntryConfirm } from "./DeleteEntryConfirm.tsx";
import { JournalGrid } from "./JournalGrid.tsx";
import { JournalToolbar } from "./JournalToolbar.tsx";
import { DirectPaymentWizard } from "./wizards/DirectPaymentWizard.tsx";
import { GenericEntryWizard } from "./wizards/GenericEntryWizard.tsx";
import { MultiCostPaymentWizard } from "./wizards/MultiCostPaymentWizard.tsx";
import type { WizardProps } from "./wizards/WizardDialog.tsx";

import "./JournalScreen.css";

/**
 * Journal & Daybook: the period's entries by number, a page at a time, with
 * the dialog open over them. Reads the view model and hands plain props down.
 * The maximize machine is the shell's, so a maximized panel also folds the
 * sidebar. When a dialog closes, the focus goes back to the grid; a saved
 * entry is revealed there, selected.
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
  const columns = useColumns(JOURNAL_COLUMN_SPECS);
  const { stub } = useNotices();
  const deleteEntry = useDeleteEntry();
  const [deleteError, setDeleteError] = useState<string | null>(null);
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
    setDeleteError(null);
    dialog.openDelete();
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

    setDeleteError(reasonText(result.reason));
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
            canDelete={selected !== null}
            page={grid.state.page}
            pageCount={grid.state.pageCount}
            pageSize={grid.state.pageSize}
            onSearch={grid.setSearch}
            onAdd={dialog.openWizard}
            onStub={stub}
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
              searching={grid.state.search.trim() !== ""}
              onToggle={grid.toggle}
              onSelect={grid.select}
              onResize={columns.resize}
            />
          </div>
        </div>
      </Panel>
      {open?.kind === "delete" && selected !== null ? (
        <DeleteEntryConfirm
          description={selected.description}
          error={deleteError}
          onYes={confirmDelete}
          onNo={closeDialog}
        />
      ) : null}
      {open?.kind === "wizard" ? (
        <JournalWizard
          key={open.wizard}
          wizard={open.wizard}
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

/** The wizard the dialog machine names. Each mounts its own machine, so a wizard opened again starts clean. */
function JournalWizard({
  wizard,
  onSaved,
  onCancel,
}: JournalWizardProps): ReactElement {
  switch (wizard) {
    case "directPaymentCash":
    case "directPaymentBank":
    case "withholdingPayment":
      return (
        <DirectPaymentWizard
          kind={wizard}
          onSaved={onSaved}
          onCancel={onCancel}
        />
      );
    case "multiCostPayment":
      return <MultiCostPaymentWizard onSaved={onSaved} onCancel={onCancel} />;
    case "genericEntry":
      return <GenericEntryWizard onSaved={onSaved} onCancel={onCancel} />;
  }
}

interface JournalWizardProps extends WizardProps {
  wizard: WizardName;
}

/** The domain's reasons as the person reads them; a reason not listed here is shown as it is. */
const DELETE_REASONS: Readonly<Record<string, string>> = {
  "kind-not-deletable":
    "This kind of entry is removed through its own flow, which is not built yet.",
};

function reasonText(reason: string): string {
  return DELETE_REASONS[reason] ?? reason;
}

/* v8 ignore next 3 -- only a real journal store can fail to answer; the simulator always does */
function reportFailed(error: unknown): void {
  console.error("the entry was not deleted", error);
}
