import { type ReactElement, useEffect, useRef, useState } from "react";

import type { MaximizeIntents, MaximizeState } from "@cl/client-core";
import type {
  AllocationMode,
  Rejected,
  Result,
  ThousandthTable,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";
import { type MachineView, useViewModel } from "@cl/react-bindings";

import { ConfirmAlert } from "../ConfirmAlert.tsx";
import { Splitter } from "../shell/Splitter.tsx";
import { TESTIDS } from "../testids.ts";
import { AllocationPanel } from "./AllocationPanel.tsx";
import { allocationReasonText } from "./allocationReasons.ts";
import { CoefficientsPanel } from "./CoefficientsPanel.tsx";
import {
  allocationColumnSpecs,
  COEFFICIENTS_COLUMN_SPECS,
  TABLES_COLUMN_SPECS,
} from "./columns.ts";
import { TableDialog } from "./TableDialog.tsx";
import { ThousandthTablesPanel } from "./ThousandthTablesPanel.tsx";

import "./TablesAllocationScreen.css";

/**
 * Thousandth Tables & Allocation: the period's tables beside the selected
 * table's coefficients, a splitter between them, and under a second splitter
 * the allocation. Reads the view model and hands plain props down. Which
 * dialog is open is this screen's own state: `+` and `✎` open the table
 * dialog, which closes when its write is accepted and selects the table it
 * wrote; `−` asks here, and shows a refusal in its question. The maximize
 * machine is the shell's, so a maximized Allocation, the only panel
 * that maximizes, also folds the sidebar. The two splits reach the
 * stylesheet as `--rows-split` and `--columns-split`, written in an effect as
 * the tree grid writes its template.
 */
export function TablesAllocationScreen({
  maximize,
}: TablesAllocationScreenProps): ReactElement {
  const {
    useAllocation,
    useCoefficientsGrid,
    useColumns,
    useSplit,
    useNotices,
  } = useViewModel();

  const {
    tables,
    selectedTableId,
    allocation,
    mode,
    chooseMode,
    selectTable,
    deleteTable,
    accountPath,
    setCoefficient,
  } = useAllocation();
  const coefficientsGrid = useCoefficientsGrid();
  const tablesColumns = useColumns(TABLES_COLUMN_SPECS);
  const coefficientsColumns = useColumns(COEFFICIENTS_COLUMN_SPECS);
  const rowsSplit = useSplit();
  const columnsSplit = useSplit();
  const { stub } = useNotices();
  const [dialog, setDialog] = useState<TablesDialog | null>(null);
  const [deleteRefusal, setDeleteRefusal] = useState<Rejected | null>(null);
  const screen = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const rowsRatio = rowsSplit.state.ratio;
  const columnsRatio = columnsSplit.state.ratio;
  const maximized = maximize.state.maximized;
  const accountColumns =
    allocation?.columns.map((column) => {
      return column.label;
    }) ?? [];

  useEffect(() => {
    screen.current?.style.setProperty("--rows-split", String(rowsRatio));
    screen.current?.style.setProperty("--columns-split", String(columnsRatio));
  }, [rowsRatio, columnsRatio]);

  function moveRowsSplitBy(deltaPx: number): void {
    // A splitter is dragged only on the screen it is drawn on.
    const { height } = must(
      screen.current,
      "the screen of the splitter",
    ).getBoundingClientRect();

    if (height > 0) {
      rowsSplit.setRatio(rowsRatio + deltaPx / height);
    }
  }

  function moveColumnsSplitBy(deltaPx: number): void {
    const { width } = must(
      top.current,
      "the row of the splitter",
    ).getBoundingClientRect();

    if (width > 0) {
      columnsSplit.setRatio(columnsRatio + deltaPx / width);
    }
  }

  function toggleMaximized(): void {
    maximize.toggle("bottom");
  }

  /** The selected table, which ✎ and − act on: they are enabled only with one. */
  function selectedTable(): ThousandthTable {
    return must(
      tables.find((view) => {
        return view.table.id === selectedTableId;
      }),
      "the selected table",
    ).table;
  }

  function openNew(): void {
    setDialog({ kind: "new" });
  }

  function openEdit(): void {
    setDialog({ kind: "edit", tableId: selectedTable().id });
  }

  function openDelete(): void {
    setDeleteRefusal(null);
    setDialog({ kind: "delete", table: selectedTable() });
  }

  function closeDialog(): void {
    setDialog(null);
  }

  function selectSaved(tableId: string): void {
    setDialog(null);
    selectTable(tableId);
  }

  function settleDelete(result: Result): void {
    if (result.ok) {
      setDialog(null);

      return;
    }

    setDeleteRefusal(result);
  }

  function confirmDeleteOf(table: ThousandthTable): () => void {
    return (): void => {
      // A click waits for nothing: the tables' stream redraws the panel, and
      // the verdict is shown when it arrives.
      void deleteTable(table.id).then(settleDelete).catch(reportUndeleted);
    };
  }

  function deleteErrorOf(table: ThousandthTable): string | null {
    return deleteRefusal === null
      ? null
      : allocationReasonText(deleteRefusal, {
          table: table.name,
          accountPath:
            deleteRefusal.detail === undefined
              ? undefined
              : accountPath(deleteRefusal.detail),
        });
  }

  function setSelectedCoefficient(
    unitId: string,
    text: string,
  ): Promise<Result> {
    // A coefficient is drawn, and so edited, only for a selected table.
    return setCoefficient(
      must(selectedTableId, "the table of the coefficient"),
      unitId,
      text,
    );
  }

  return (
    <div
      ref={screen}
      className="allocation-screen"
      data-testid={TESTIDS.tablesAllocationScreen}
      data-maximized={maximized ?? "none"}
    >
      <div ref={top} className="allocation-top">
        <div className="allocation-tables">
          <ThousandthTablesPanel
            tables={tables}
            selectedTableId={selectedTableId}
            template={tablesColumns.state.template}
            onSelect={selectTable}
            onResize={tablesColumns.resize}
            onAdd={openNew}
            onEdit={openEdit}
            onDelete={openDelete}
            onStub={stub}
          />
        </div>
        <Splitter direction="vertical" onDrag={moveColumnsSplitBy} />
        <div className="allocation-coefficients">
          <CoefficientsPanel
            // An editor belongs to the table it opened on: another table, or
            // another period's, starts the panel afresh.
            key={selectedTableId ?? ""}
            rows={coefficientsGrid.state.rows}
            template={coefficientsColumns.state.template}
            onToggle={coefficientsGrid.toggle}
            onExpandAll={coefficientsGrid.expandAll}
            onCollapseAll={coefficientsGrid.collapseAll}
            onResize={coefficientsColumns.resize}
            onSetCoefficient={setSelectedCoefficient}
            onStub={stub}
          />
        </div>
      </div>
      <Splitter direction="horizontal" onDrag={moveRowsSplitBy} />
      <div className="allocation-bottom">
        <AllocationArea
          // The columns machine reads its spec once: an allocation with
          // another count of accounts gets a machine of its own.
          key={accountColumns.length}
          columns={accountColumns}
          mode={mode}
          maximized={maximized === "bottom"}
          onChooseMode={chooseMode}
          onToggleMaximize={toggleMaximized}
          onStub={stub}
        />
      </div>
      {dialog?.kind === "new" || dialog?.kind === "edit" ? (
        <TableDialog
          // The dialog's machine is built for the table it opens on.
          key={dialog.kind === "edit" ? dialog.tableId : ""}
          editing={dialog.kind === "edit" ? dialog.tableId : null}
          onSaved={selectSaved}
          onCancel={closeDialog}
        />
      ) : null}
      {dialog?.kind === "delete" ? (
        <ConfirmAlert
          text={`Delete the table ${dialog.table.name}?`}
          error={deleteErrorOf(dialog.table)}
          onYes={confirmDeleteOf(dialog.table)}
          onNo={closeDialog}
        />
      ) : null}
    </div>
  );
}

export interface TablesAllocationScreenProps {
  /** The shell's: whether the Allocation fills the screen, shared with the sidebar's rail. */
  maximize: MachineView<MaximizeState, MaximizeIntents>;
}

/** The dialog over the screen: a new table, a table's edit, or the question before one goes. */
type TablesDialog = NewTableDialog | EditTableDialog | DeleteTableDialog;

interface NewTableDialog {
  kind: "new";
}

interface EditTableDialog {
  kind: "edit";
  tableId: string;
}

interface DeleteTableDialog {
  kind: "delete";
  table: ThousandthTable;
}

interface AllocationAreaProps {
  columns: string[];
  mode: AllocationMode;
  maximized: boolean;
  onChooseMode: (mode: AllocationMode) => void;
  onToggleMaximize: () => void;
  onStub: (label: string) => void;
}

/** The Allocation with its grid's rows and column widths, for one count of accounts. */
function AllocationArea({
  columns,
  mode,
  maximized,
  onChooseMode,
  onToggleMaximize,
  onStub,
}: AllocationAreaProps): ReactElement {
  const { useAllocationGrid, useColumns } = useViewModel();
  const grid = useAllocationGrid();
  const widths = useColumns(allocationColumnSpecs(columns.length));

  return (
    <AllocationPanel
      columns={columns}
      rows={grid.state.rows}
      mode={mode}
      template={widths.state.template}
      maximized={maximized}
      onChooseMode={onChooseMode}
      onToggle={grid.toggle}
      onExpandAll={grid.expandAll}
      onCollapseAll={grid.collapseAll}
      onResize={widths.resize}
      onToggleMaximize={onToggleMaximize}
      onStub={onStub}
    />
  );
}

/* v8 ignore next 3 -- the simulator answers every delete of a table it holds, and the alert asks only for the selected one: only a real store fails otherwise */
function reportUndeleted(error: unknown): void {
  console.error("the table was not deleted", error);
}
