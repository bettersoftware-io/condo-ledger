import { Printer, RotateCw } from "lucide-react";
import { type ReactElement, useState } from "react";

import type { AllocationGridState } from "@cl/client-core";
import type { AllocationMode } from "@cl/domain";

import { MenuItem } from "../MenuItem.tsx";
import { Money } from "../Money.tsx";
import { Panel } from "../Panel.tsx";
import { PDF_GLYPH, XLS_GLYPH } from "../shell/icons.tsx";
import { Popover } from "../shell/Popover.tsx";
import { Toolbar } from "../Toolbar.tsx";
import { ToolbarButton } from "../ToolbarButton.tsx";
import { ToolbarDivider } from "../ToolbarDivider.tsx";
import {
  TreeGrid,
  type TreeGridColumn,
  type TreeGridRowData,
} from "../TreeGrid.tsx";
import { TESTIDS } from "../testids.ts";
import {
  ALLOCATION_LEADING_COLUMNS,
  ALLOCATION_TRAILING_COLUMNS,
} from "./columns.ts";
import { LegendButton } from "./LegendButton.tsx";

import "./AllocationPanel.css";
import "./allocationPanels.css";

/**
 * Allocation: the period, its groups, their units and the residents, one
 * column per account, then Total, Prev. bal., Total due and Paid; Roundings
 * last, italic. The mode button names the allocation shown and opens a menu
 * of the two. The grouping and Include installments are drawn disabled, as
 * the legacy app drew them. Rows do not select. Which menu is open is this
 * view's own state. Takes only props, so the compiler memoizes it.
 */
export function AllocationPanel({
  columns,
  rows,
  mode,
  template,
  maximized,
  onChooseMode,
  onToggle,
  onExpandAll,
  onCollapseAll,
  onResize,
  onToggleMaximize,
  onStub,
}: AllocationPanelProps): ReactElement {
  const [menuOpen, setMenuOpen] = useState(false);
  const gridColumns: TreeGridColumn[] = [
    ...ALLOCATION_LEADING_COLUMNS,
    ...columns.map((label): TreeGridColumn => {
      return { header: label, align: "right" };
    }),
    ...ALLOCATION_TRAILING_COLUMNS,
  ];

  function stubbing(label: string): () => void {
    return (): void => {
      onStub(label);
    };
  }

  function openMenu(): void {
    setMenuOpen(true);
  }

  function closeMenu(): void {
    setMenuOpen(false);
  }

  function choosing(next: AllocationMode): () => void {
    return (): void => {
      setMenuOpen(false);
      onChooseMode(next);
    };
  }

  return (
    <div className="allocation-panel" data-testid={TESTIDS.allocationPanel}>
      <Panel
        title="Allocation"
        meta={<LegendButton onStub={onStub} />}
        maximized={maximized}
        onToggleMaximize={onToggleMaximize}
      >
        <div className="allocation-panel-body">
          <Toolbar>
            <div className="allocation-mode-anchor">
              <button
                type="button"
                className="allocation-mode"
                data-testid={TESTIDS.allocationMode}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={openMenu}
              >
                {MODE_LABELS[mode]}{" "}
                <span className="allocation-caret" aria-hidden="true">
                  ▾
                </span>
              </button>
              <Popover
                open={menuOpen}
                label="Allocation"
                width="wide"
                onClose={closeMenu}
              >
                <MenuItem
                  label="Budget allocation"
                  onClick={choosing("budget")}
                />
                <MenuItem
                  label="Final-balance allocation"
                  onClick={choosing("finalBalance")}
                />
              </Popover>
            </div>
            <DisabledChip caption="Group rows by" value="By unit" />
            <DisabledChip caption="Group cols by" value="By account" />
            <label className="toolbar-checkbox allocation-installments">
              <input type="checkbox" defaultChecked disabled />
              Include installments
            </label>
            <span className="allocation-spacer" />
            <ToolbarButton
              label="Refresh"
              icon={<RotateCw size={13} />}
              tone="muted"
              iconOnly
              onClick={stubbing("Refresh")}
            />
          </Toolbar>
          <div className="allocation-panel-grid">
            <TreeGrid
              columns={gridColumns}
              template={template}
              rows={rows.map(rowDataOf)}
              emptyMessage="No period is selected."
              onToggle={onToggle}
              // Rows do not select: a click on one does nothing.
              onSelect={ignore}
              onResize={onResize}
            />
          </div>
          <div className="allocation-panel-foot">
            <Toolbar>
              <ToolbarButton
                label="Expand all"
                icon="⊞"
                tone="muted"
                iconOnly
                onClick={onExpandAll}
              />
              <ToolbarButton
                label="Collapse all"
                icon="⊟"
                tone="muted"
                iconOnly
                onClick={onCollapseAll}
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

type GridRow = AllocationGridState["rows"][number];

export interface AllocationPanelProps {
  /** The account columns' headings, in order. */
  columns: string[];
  /** The grid machine's rows of the allocation shown. */
  rows: GridRow[];
  mode: AllocationMode;
  /** grid-template-columns, from the columns machine. */
  template: string;
  /** Whether the panel fills the screen. */
  maximized: boolean;
  onChooseMode: (mode: AllocationMode) => void;
  onToggle: (key: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onResize: (index: number, px: number) => void;
  onToggleMaximize: () => void;
  /** A tool that is not built yet, by name. */
  onStub: (label: string) => void;
}

/** The mode button's words: the README's names, the legacy's Preventivo and Consuntivo. */
const MODE_LABELS: Record<AllocationMode, string> = {
  budget: "Budget",
  finalBalance: "Final balance",
};

interface DisabledChipProps {
  caption: string;
  value: string;
}

/** A choice the legacy app drew and never let change: its caption, then its value on a disabled chip. */
function DisabledChip({ caption, value }: DisabledChipProps): ReactElement {
  return (
    <span className="allocation-chip-group">
      <span className="allocation-chip-caption">{caption}:</span>
      <button
        type="button"
        className="allocation-chip"
        aria-label={caption}
        disabled
      >
        {value}{" "}
        <span className="allocation-caret" aria-hidden="true">
          ▾
        </span>
      </button>
    </span>
  );
}

/** The root, a group and a unit with residents are aggregates, bold; the root and the groups on the zebra background. Roundings stands aside, italic. */
function rowDataOf(row: GridRow): TreeGridRowData {
  const { node } = row;
  const emphasis = row.hasChildren;

  return {
    key: row.key,
    depth: row.depth,
    hasChildren: row.hasChildren,
    expanded: row.expanded,
    selected: false,
    emphasis,
    zebra: node.kind === "root" || node.kind === "group",
    icon: null,
    label: node.label,
    tone: node.kind === "roundings" ? "aside" : undefined,
    cells: [
      <span key="role" className="allocation-text">
        {node.role}
      </span>,
      <span key="restriction" className="allocation-text">
        {node.restriction}
      </span>,
      <span key="days" className="allocation-text">
        {node.days}
      </span>,
      ...node.amounts.map((amount, index) => {
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: one amount per account column, in the columns' fixed order
          <Money key={index} cents={amount} emphasis={emphasis} />
        );
      }),
      <Money key="total" cents={node.total} emphasis={emphasis} />,
      <Money key="previous" cents={node.previousBalance} emphasis={emphasis} />,
      <Money key="due" cents={node.due} emphasis={emphasis} />,
      <Money key="paid" cents={node.paid} emphasis={emphasis} />,
    ],
  };
}

function ignore(): void {
  // Nothing: see the grid's onSelect.
}
