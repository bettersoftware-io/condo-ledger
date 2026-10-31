import { Printer, RotateCw } from "lucide-react";
import { type ReactElement, useState } from "react";

import type { TreeGridState } from "@cl/client-core";
import type { UnitsRow } from "@cl/domain";

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
import { UNITS_COLUMNS } from "./columns.ts";
import { UNIT_TYPE_LABELS } from "./labels.ts";

import "./UnitsPanel.css";

/**
 * Units, Owners & Personal Balance: the period, its groups, their units and
 * the residents of a unit with more than one, then Rounding error, with each
 * row's unit columns and money. A click selects any row. The toolbar groups
 * by unit only (drawn, as on the other screens), offers a new group, unit or
 * owner (an owner only with a unit selected), edits and deletes the selected
 * row when it can, opens and closes the tree, and draws print, export and
 * refresh, which post their notice. Which menu is
 * open is this view's own state. Takes only props, so the compiler memoizes
 * it.
 */
export function UnitsPanel({
  rows,
  selectedKey,
  unitCount,
  template,
  maximized,
  onSelect,
  onToggle,
  onExpandAll,
  onCollapseAll,
  onResize,
  onToggleMaximize,
  canAdd,
  canAddOwner,
  canEdit,
  canDelete,
  onAdd,
  onEdit,
  onDelete,
  onStub,
}: UnitsPanelProps): ReactElement {
  const [menuOpen, setMenuOpen] = useState(false);

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

  function adding(what: UnitsAddition): () => void {
    return (): void => {
      setMenuOpen(false);
      onAdd(what);
    };
  }

  return (
    <div className="units-panel" data-testid={TESTIDS.unitsPanel}>
      <Panel
        title="Units, Owners & Personal Balance"
        meta={unitCount === null ? "" : `${unitCount} units total`}
        maximized={maximized}
        onToggleMaximize={onToggleMaximize}
      >
        <div className="units-panel-body">
          <Toolbar>
            <span className="units-group-by" data-testid={TESTIDS.unitsGroupBy}>
              Group by: <strong>By unit</strong>
            </span>
            <ToolbarDivider />
            <div className="units-menu-anchor">
              <ToolbarButton
                label="Add"
                icon="+"
                text="▾"
                tone="ok"
                disabled={!canAdd}
                menuOpen={menuOpen}
                onClick={openMenu}
              />
              <Popover open={menuOpen} label="Add" onClose={closeMenu}>
                <MenuItem
                  label="New group"
                  icon="📁"
                  onClick={adding("group")}
                />
                <MenuItem label="New unit" icon="🏠" onClick={adding("unit")} />
                <MenuItem
                  label="New owner"
                  icon="👤"
                  disabled={!canAddOwner}
                  onClick={adding("owner")}
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
              disabled={!canDelete}
              onClick={onDelete}
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
            <span className="units-toolbar-spacer" />
            <ToolbarButton
              label="Refresh"
              icon={<RotateCw size={13} />}
              tone="muted"
              iconOnly
              onClick={stubbing("Refresh")}
            />
          </Toolbar>
          <div className="units-panel-grid">
            <TreeGrid
              columns={UNITS_COLUMNS}
              template={template}
              rows={rows.map((row) => {
                return rowDataOf(row, selectedKey);
              })}
              emptyMessage="No period is selected."
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

/** What `+▾` adds. */
export type UnitsAddition = "group" | "unit" | "owner";

type GridRow = TreeGridState<UnitsRow>["rows"][number];

export interface UnitsPanelProps {
  /** The grid machine's rows. */
  rows: GridRow[];
  /** The selected row's key; null with none. */
  selectedKey: string | null;
  /** The period's count of units; null while there is no period. */
  unitCount: number | null;
  /** grid-template-columns, from the columns machine. */
  template: string;
  /** Whether the panel fills the screen. */
  maximized: boolean;
  onSelect: (key: string) => void;
  onToggle: (key: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onResize: (index: number, px: number) => void;
  onToggleMaximize: () => void;
  /** There is a period to add a group or a unit to. */
  canAdd: boolean;
  /** There is a unit to add an owner to. */
  canAddOwner: boolean;
  /** The selected row can be edited: a group, a unit or a resident. */
  canEdit: boolean;
  /** The selected row can be deleted: a group with nothing in it, a unit or a resident. */
  canDelete: boolean;
  onAdd: (what: UnitsAddition) => void;
  /** Edits the selected row. */
  onEdit: () => void;
  /** Deletes the selected row. */
  onDelete: () => void;
  /** A tool that is not built yet, by name. */
  onStub: (label: string) => void;
}

/** A row's icon: the building, a group, the unit by its type, a resident; the rounding row has none. */
const ICONS: Record<UnitsRow["icon"], string> = {
  building: "🏢",
  group: "📁",
  apartment: "🏠",
  shop: "🏪",
  premises: "🏪",
  garage: "🅿️",
  owner: "👤",
  rounding: "",
};

/** The root, the groups and a unit with residents are aggregates, bold; the root and the groups on the zebra background. */
function rowDataOf(row: GridRow, selectedKey: string | null): TreeGridRowData {
  const { node } = row;
  const heading = node.kind === "root" || node.kind === "group";
  const emphasis = heading || row.hasChildren;

  return {
    key: row.key,
    depth: row.depth,
    hasChildren: row.hasChildren,
    expanded: row.expanded,
    selected: row.key === selectedKey,
    emphasis,
    zebra: heading,
    icon: iconOf(ICONS[node.icon]),
    label: node.label,
    cells: [
      <span key="floor" className="units-text">
        {node.floor}
      </span>,
      <span key="interior" className="units-text">
        {node.interior}
      </span>,
      <span key="sub-unit" className="units-text">
        {node.subUnit}
      </span>,
      <span key="type" className="units-text">
        {node.type === null ? "" : UNIT_TYPE_LABELS[node.type]}
      </span>,
      <span key="restriction" className="units-text">
        {node.restriction}
      </span>,
      <Money key="previous" cents={node.previousBalance} emphasis={emphasis} />,
      <Money key="budget" cents={node.budget} emphasis={emphasis} />,
      <Money key="actual" cents={node.actual} emphasis={emphasis} />,
      <Money key="due" cents={node.due} emphasis={emphasis} />,
      <Money key="paid" cents={node.paid} emphasis={emphasis} />,
      <Money key="overdue" cents={node.overdue} emphasis={emphasis} />,
      <Money key="adjustment" cents={node.adjustment} emphasis={emphasis} />,
    ],
  };
}

/** The glyph with its gap before the label; nothing for none. */
function iconOf(glyph: string): ReactElement | null {
  return glyph === "" ? null : <span className="units-icon">{glyph}</span>;
}
