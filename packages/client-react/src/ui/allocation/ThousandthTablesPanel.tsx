import { Printer } from "lucide-react";
import type { ReactElement } from "react";

import type { TableView } from "@cl/client-core";

import { Panel } from "../Panel.tsx";
import { PDF_GLYPH, XLS_GLYPH } from "../shell/icons.tsx";
import { Toolbar } from "../Toolbar.tsx";
import { ToolbarButton } from "../ToolbarButton.tsx";
import { ToolbarDivider } from "../ToolbarDivider.tsx";
import { TreeGrid, type TreeGridRowData } from "../TreeGrid.tsx";
import { TESTIDS } from "../testids.ts";
import { Coefficient } from "./Coefficient.tsx";
import { TABLES_COLUMNS } from "./columns.ts";
import { LegendButton } from "./LegendButton.tsx";

import "./allocationPanels.css";
import "./ThousandthTablesPanel.css";

/**
 * Thousandth Tables: the period's tables in order, each with the group its
 * coefficients are limited to, a blank counter and its total. A click
 * selects a table, and the selection drives the coefficients. `+` asks for
 * a new table; `✎` and `−` ask to edit and to delete the selected one, and
 * wait for a selection. Print and the exports post a notice through `onStub`
 * with their name until they are built. Takes only props, so the compiler
 * memoizes it.
 */
export function ThousandthTablesPanel({
  tables,
  selectedTableId,
  template,
  onSelect,
  onResize,
  onAdd,
  onEdit,
  onDelete,
  onStub,
}: ThousandthTablesPanelProps): ReactElement {
  const noSelection = selectedTableId === null;

  function stubbing(label: string): () => void {
    return (): void => {
      onStub(label);
    };
  }

  return (
    <div
      className="allocation-panel"
      data-testid={TESTIDS.thousandthTablesPanel}
    >
      <Panel title="Thousandth Tables" meta={<LegendButton onStub={onStub} />}>
        <div className="allocation-panel-body">
          <div className="allocation-panel-grid">
            <TreeGrid
              columns={TABLES_COLUMNS}
              template={template}
              rows={tables.map((view) => {
                return rowDataOf(view, selectedTableId);
              })}
              emptyMessage="This period has no thousandth table."
              // A flat list: no row has a caret to toggle.
              onToggle={onSelect}
              onSelect={onSelect}
              onResize={onResize}
            />
          </div>
          <div className="allocation-panel-foot">
            <Toolbar>
              <ToolbarButton
                label="New Thousandth Table"
                icon="+"
                tone="ok"
                iconOnly
                onClick={onAdd}
              />
              <ToolbarButton
                label="Edit Thousandth Table"
                icon="✎"
                tone="muted"
                iconOnly
                disabled={noSelection}
                onClick={onEdit}
              />
              <ToolbarButton
                label="Delete Thousandth Table"
                icon="−"
                tone="neg"
                iconOnly
                disabled={noSelection}
                onClick={onDelete}
              />
              <ToolbarDivider />
              <ToolbarButton
                label="Print"
                icon={<Printer size={14} />}
                tone="muted"
                iconOnly
                onClick={stubbing("Print")}
              />
              <ToolbarButton
                label="Export to PDF"
                icon={PDF_GLYPH}
                iconOnly
                onClick={stubbing("Export to PDF")}
              />
              <ToolbarButton
                label="Export to Excel"
                icon={XLS_GLYPH}
                iconOnly
                onClick={stubbing("Export to Excel")}
              />
            </Toolbar>
          </div>
        </div>
      </Panel>
    </div>
  );
}

export interface ThousandthTablesPanelProps {
  /** The period's tables, in order. */
  tables: TableView[];
  selectedTableId: string | null;
  /** grid-template-columns, from the columns machine. */
  template: string;
  onSelect: (tableId: string) => void;
  onResize: (index: number, px: number) => void;
  /** `+`: a new table. */
  onAdd: () => void;
  /** `✎`: the selected table's edit. */
  onEdit: () => void;
  /** `−`: the selected table's deletion. */
  onDelete: () => void;
  /** A tool that is not built yet, by name. */
  onStub: (label: string) => void;
}

/** A table's row: flat, its total plain. */
function rowDataOf(
  view: TableView,
  selectedTableId: string | null,
): TreeGridRowData {
  return {
    key: view.table.id,
    depth: 0,
    hasChildren: false,
    expanded: false,
    selected: view.table.id === selectedTableId,
    emphasis: false,
    zebra: false,
    icon: null,
    label: view.table.name,
    cells: [
      <span key="restriction" className="allocation-text tables-text">
        {view.restriction}
      </span>,
      <span key="counter" className="allocation-text tables-text" />,
      <Coefficient key="total" value={view.total} />,
    ],
  };
}
