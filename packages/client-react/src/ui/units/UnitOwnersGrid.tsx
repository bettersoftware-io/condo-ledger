import type { ReactElement } from "react";

import type { TreeGridState } from "@cl/client-core";
import type { OwnersRow } from "@cl/domain";

import { useLocale } from "../amountLocale.ts";
import { formatCoefficient } from "../format.ts";
import { TreeGrid, type TreeGridRowData } from "../TreeGrid.tsx";
import { UNIT_OWNERS_COLUMNS } from "./columns.ts";
import { ShareBar } from "./ShareBar.tsx";

import "./UnitOwnersGrid.css";

/**
 * The Unit Owners tab: the unit's period "Full period" on the zebra
 * background, a sub-head per role, a row per resident with Out ticked when
 * they leave before the end, their days, their share as a bar and their
 * combined coefficient with six decimals. A click on a resident selects them;
 * the head and the sub-heads do not select. Takes only props, so the
 * compiler memoizes it.
 */
export function UnitOwnersGrid({
  rows,
  template,
  selectedResidentId,
  onSelect,
  onToggle,
  onResize,
}: UnitOwnersGridProps): ReactElement {
  const locale = useLocale();

  function selectRow(key: string): void {
    const clicked = rows.find((row) => {
      return row.key === key;
    });

    if (clicked !== undefined && clicked.node.residentId !== null) {
      onSelect(key);
    }
  }

  function rowDataOf(row: GridRow): TreeGridRowData {
    const { node } = row;
    const { residentId, coefficient, share } = node;

    return {
      key: row.key,
      depth: row.depth,
      hasChildren: row.hasChildren,
      expanded: row.expanded,
      selected: residentId !== null && residentId === selectedResidentId,
      emphasis: node.kind !== "resident",
      zebra: node.kind === "period",
      icon:
        ICONS[node.kind] === "" ? null : (
          <span className="unit-owners-icon">{ICONS[node.kind]}</span>
        ),
      label: node.label,
      cells: [
        <span key="scenario" className="unit-owners-text">
          {node.scenario}
        </span>,
        <span key="out" className="unit-owners-out">
          {node.out ? "✓" : ""}
        </span>,
        <span key="restriction" className="unit-owners-text">
          {node.restriction}
        </span>,
        <span key="days" className="unit-owners-text">
          {node.days}
        </span>,
        share === null ? (
          <span key="share" />
        ) : (
          <ShareBar key="share" share={share} />
        ),
        <span key="coefficient" className="unit-owners-coefficient">
          {coefficient === null ? "" : formatCoefficient(coefficient, locale)}
        </span>,
      ],
    };
  }

  return (
    <TreeGrid
      columns={UNIT_OWNERS_COLUMNS}
      template={template}
      rows={rows.map(rowDataOf)}
      emptyMessage="No owners."
      onToggle={onToggle}
      onSelect={selectRow}
      onResize={onResize}
    />
  );
}

type GridRow = TreeGridState<OwnersRow>["rows"][number];

export interface UnitOwnersGridProps {
  /** The grid machine's rows of the selected unit's owners. */
  rows: GridRow[];
  /** grid-template-columns, from the columns machine. */
  template: string;
  /** The resident the Units screen selects; null with none. */
  selectedResidentId: string | null;
  /** Selects a resident by their row's key, the key of their row in the Units grid too. */
  onSelect: (key: string) => void;
  onToggle: (key: string) => void;
  onResize: (index: number, px: number) => void;
}

/** The period's head, a role's sub-head; a resident has none. */
const ICONS: Record<OwnersRow["kind"], string> = {
  period: "🗓",
  role: "👥",
  resident: "",
};
