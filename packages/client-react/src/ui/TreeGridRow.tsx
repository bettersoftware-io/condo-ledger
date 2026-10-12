import { ChevronDown, ChevronRight } from "lucide-react";
import type { MouseEvent, ReactElement } from "react";

import type { TreeGridColumn, TreeGridRowData } from "./TreeGrid.tsx";
import { TESTIDS } from "./testids.ts";

import "./TreeGrid.css";

/** One row. Compiled by the React Compiler: the grid re-renders on every tree change and the rows that did not change are skipped. */
export function TreeGridRow({
  row,
  columns,
  onToggle,
  onSelect,
}: TreeGridRowProps): ReactElement {
  function select(): void {
    onSelect(row.key);
  }

  function toggle(event: MouseEvent<HTMLButtonElement>): void {
    event.stopPropagation();
    onToggle(row.key);
  }

  return (
    <div
      className="tree-grid-row"
      role="row"
      data-testid={TESTIDS.treeGridRow}
      data-depth={row.depth}
      data-zebra={row.zebra}
      data-emphasis={row.emphasis}
      aria-selected={row.selected}
      aria-expanded={row.hasChildren ? row.expanded : undefined}
      onClick={select}
    >
      <div role="gridcell" className="tree-grid-label">
        {indents(row.depth)}
        {row.hasChildren ? (
          <button
            type="button"
            className="tree-grid-caret"
            aria-label={row.expanded ? "Collapse" : "Expand"}
            onClick={toggle}
            data-testid={TESTIDS.treeGridCaret}
          >
            {row.expanded ? (
              <ChevronDown size={13} strokeWidth={3} />
            ) : (
              <ChevronRight size={13} strokeWidth={3} />
            )}
          </button>
        ) : (
          <span className="tree-grid-caret" />
        )}
        <span className="tree-grid-icon">{row.icon}</span>
        <span className="tree-grid-text">{row.label}</span>
      </div>
      {row.cells.map((cell, index) => {
        return (
          <div
            key={columns[index + 1]?.header ?? index}
            role="gridcell"
            data-align={columns[index + 1]?.align ?? "left"}
          >
            {cell}
          </div>
        );
      })}
    </div>
  );
}

function indents(depth: number): ReactElement[] {
  return Array.from({ length: depth }, (_, level) => {
    // biome-ignore lint/suspicious/noArrayIndexKey: a fixed run of identical spacers, never reordered
    return <span key={level} className="tree-grid-indent" />;
  });
}

export interface TreeGridRowProps {
  row: TreeGridRowData;
  columns: TreeGridColumn[];
  onToggle: (key: string) => void;
  onSelect: (key: string) => void;
}
