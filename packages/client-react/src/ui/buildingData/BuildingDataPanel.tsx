import { Printer, RotateCw } from "lucide-react";
import { type ReactElement, useState } from "react";

import type { TreeGridState } from "@cl/client-core";
import {
  type BuildingRow,
  type BuildingType,
  PERIOD_TYPE_WORDS,
  type PeriodType,
} from "@cl/domain";

import { MenuItem } from "../MenuItem.tsx";
import { Money } from "../Money.tsx";
import { Panel } from "../Panel.tsx";
import { PDF_GLYPH, XLS_GLYPH } from "../shell/icons.tsx";
import { Popover } from "../shell/Popover.tsx";
import { Toolbar } from "../Toolbar.tsx";
import { ToolbarButton } from "../ToolbarButton.tsx";
import { ToolbarDivider } from "../ToolbarDivider.tsx";
import { TreeGrid, type TreeGridRowData } from "../TreeGrid.tsx";
import { TESTIDS } from "../testids.ts";
import { BUILDING_DATA_COLUMNS } from "./columns.ts";
import {
  BUILDING_TYPE_ICONS,
  BUILDING_TYPE_LABELS,
  PERIOD_TYPE_ICONS,
} from "./labels.ts";

import "./BuildingDataPanel.css";

/**
 * Building Data: every building, bold on the zebra background, over its
 * periods, with a period's type, whether it is closed, its dates and its six
 * figures. A click selects any row. The toolbar edits the selected building
 * or period; New building, New period and − post their notice, as print,
 * export and refresh do. Which menu is open is this view's own state. Takes
 * only props, so the compiler memoizes it.
 */
export function BuildingDataPanel({
  rows,
  selectedKey,
  buildingCount,
  template,
  maximized,
  canEdit,
  onSelect,
  onToggle,
  onExpandAll,
  onCollapseAll,
  onResize,
  onToggleMaximize,
  onEdit,
  onStub,
}: BuildingDataPanelProps): ReactElement {
  const [menuOpen, setMenuOpen] = useState(false);

  function stubbing(label: string): () => void {
    return (): void => {
      setMenuOpen(false);
      onStub(label);
    };
  }

  function openMenu(): void {
    setMenuOpen(true);
  }

  function closeMenu(): void {
    setMenuOpen(false);
  }

  return (
    <div
      className="building-data-panel"
      data-testid={TESTIDS.buildingDataPanel}
    >
      <Panel
        title="Building Data"
        meta={`${buildingCount} buildings total`}
        maximized={maximized}
        onToggleMaximize={onToggleMaximize}
      >
        <div className="building-data-body">
          <Toolbar>
            <div className="building-data-menu-anchor">
              <ToolbarButton
                label="Add"
                icon="+"
                text="▾"
                tone="ok"
                menuOpen={menuOpen}
                onClick={openMenu}
              />
              <Popover open={menuOpen} label="Add" onClose={closeMenu}>
                <MenuItem
                  label="New building"
                  icon="🏢"
                  onClick={stubbing("New building")}
                />
                <MenuItem
                  label="New period"
                  icon="📁"
                  onClick={stubbing("New period")}
                />
              </Popover>
            </div>
            <ToolbarButton
              label="Edit"
              icon="✎"
              tone="muted"
              iconOnly
              disabled={!canEdit}
              onClick={onEdit}
            />
            <ToolbarButton
              label="Delete"
              icon="−"
              tone="neg"
              iconOnly
              onClick={stubbing("Delete")}
            />
            <ToolbarDivider />
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
            <span className="building-data-spacer" />
            <ToolbarButton
              label="Refresh"
              icon={<RotateCw size={13} />}
              tone="muted"
              iconOnly
              onClick={stubbing("Refresh")}
            />
          </Toolbar>
          <div className="building-data-grid">
            <TreeGrid
              columns={BUILDING_DATA_COLUMNS}
              template={template}
              rows={rows.map((row) => {
                return rowDataOf(row, selectedKey);
              })}
              emptyMessage="No building yet."
              onToggle={onToggle}
              onSelect={onSelect}
              onResize={onResize}
            />
          </div>
        </div>
      </Panel>
    </div>
  );
}

type GridRow = TreeGridState<BuildingRow>["rows"][number];

export interface BuildingDataPanelProps {
  /** The grid machine's rows. */
  rows: GridRow[];
  /** The selected row's key; null with none. */
  selectedKey: string | null;
  buildingCount: number;
  /** grid-template-columns, from the columns machine. */
  template: string;
  /** Whether the panel fills the screen. */
  maximized: boolean;
  /** There is a building or a period selected to edit. */
  canEdit: boolean;
  onSelect: (key: string) => void;
  onToggle: (key: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onResize: (index: number, px: number) => void;
  onToggleMaximize: () => void;
  /** Edits the selected building or period. */
  onEdit: () => void;
  /** A tool that is not built yet, by name. */
  onStub: (label: string) => void;
}

/** A building's row is bold on the zebra background and leaves the period's cells blank; a period's carries its type, Closed, dates and figures. */
function rowDataOf(row: GridRow, selectedKey: string | null): TreeGridRowData {
  const { node } = row;
  const building = node.kind === "building";
  const { figures } = node;

  return {
    key: row.key,
    depth: row.depth,
    hasChildren: row.hasChildren,
    expanded: row.expanded,
    selected: row.key === selectedKey,
    emphasis: building,
    zebra: building,
    icon: (
      <span className="building-data-icon">
        {building ? "🏢" : node.closed === true ? "🔒" : "📁"}
      </span>
    ),
    label: node.label,
    leading: [
      <span key="code" className="building-data-code" data-emphasis={building}>
        {node.code}
      </span>,
    ],
    cells: [
      typeIconOf(node),
      <span key="closed" className="building-data-closed">
        {node.closed === null ? null : (
          <input
            type="checkbox"
            aria-label="Closed"
            checked={node.closed}
            disabled
          />
        )}
      </span>,
      <span key="dates" className="building-data-dates">
        {node.dates}
      </span>,
      <Money key="liquidity" cents={figures?.liquidity ?? null} />,
      <Money key="funds" cents={figures?.funds ?? null} />,
      <Money key="budget" cents={figures?.budget ?? null} />,
      <Money key="actual" cents={figures?.actual ?? null} />,
      <Money key="previous" cents={figures?.previousBalance ?? null} />,
      <Money key="due" cents={figures?.due ?? null} />,
    ],
  };
}

/** A row's type, a building's or a period's (their names do not overlap), as an icon. */
const TYPE_ICONS: Record<BuildingType | PeriodType, string> = {
  ...BUILDING_TYPE_ICONS,
  ...PERIOD_TYPE_ICONS,
};

/** A row's type in words. */
const TYPE_WORDS: Record<BuildingType | PeriodType, string> = {
  ...BUILDING_TYPE_LABELS,
  ...PERIOD_TYPE_WORDS,
};

/** The Type column: the building's or the period's type as an icon, its words as the tooltip. */
function typeIconOf(node: BuildingRow): ReactElement {
  return (
    <span
      key="type"
      className="building-data-type"
      title={TYPE_WORDS[node.type]}
      data-testid={TESTIDS.buildingTypeIcon}
    >
      {TYPE_ICONS[node.type]}
    </span>
  );
}
