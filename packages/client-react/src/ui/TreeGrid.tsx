import { type ReactElement, type ReactNode, useEffect, useRef } from "react";

import { ResizeHandle } from "./ResizeHandle.tsx";
import { TreeGridRow } from "./TreeGridRow.tsx";
import { TESTIDS } from "./testids.ts";

import "./TreeGrid.css";

/**
 * A tree as CSS-grid rows. The column template comes from the columns machine
 * and is written as a CSS variable on the grid element in an effect: a
 * template is data the stylesheet cannot know, and this package writes no
 * inline style.
 */
export function TreeGrid({
  columns,
  template,
  rows,
  footer,
  emptyMessage,
  onToggle,
  onSelect,
  onActivate,
  onResize,
}: TreeGridProps): ReactElement {
  const grid = useRef<HTMLDivElement>(null);

  useEffect(() => {
    grid.current?.style.setProperty("--tree-grid-template", template);
  }, [template]);

  return (
    <div
      className="tree-grid"
      role="grid"
      ref={grid}
      data-testid={TESTIDS.treeGrid}
    >
      <div className="tree-grid-header" role="row">
        {columns.map((column, index) => {
          return (
            <div
              key={column.header}
              className="tree-grid-head"
              role="columnheader"
              data-align={column.align ?? "left"}
            >
              {column.content ?? column.header}
              {index > 0 ? (
                <ResizeHandle index={index - 1} onResize={onResize} />
              ) : null}
            </div>
          );
        })}
      </div>
      {rows.length === 0 ? (
        <div className="tree-grid-empty">{emptyMessage}</div>
      ) : null}
      {rows.map((row) => {
        return (
          <TreeGridRow
            key={row.key}
            row={row}
            columns={columns}
            onToggle={onToggle}
            onSelect={onSelect}
            onActivate={onActivate}
          />
        );
      })}
      {footer === undefined ? null : (
        <div
          className="tree-grid-footer"
          role="row"
          data-testid={TESTIDS.treeGridFooter}
        >
          {footer.map((cell, index) => {
            return (
              <div
                key={columns[index]?.header ?? index}
                role="gridcell"
                data-align={columns[index]?.align ?? "left"}
              >
                {cell}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface TreeGridColumn {
  /** The column's name: its text in the header, and its key. */
  header: string;
  /** Drawn in the header in place of `header` (two lines, say); `header` stays its key. */
  content?: ReactNode;
  align?: "left" | "right" | "center";
}

export interface TreeGridRowData {
  key: string;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  selected: boolean;
  /** Bold label (a node with children). */
  emphasis: boolean;
  /** The root row's background. */
  zebra: boolean;
  /** Drawn in the label cell before the text. */
  icon: ReactNode;
  label: string;
  /** Cells drawn before the label cell, one per leading column; the tree column follows these cells. */
  leading?: ReactNode[];
  /** One per column after the tree column. */
  cells: ReactNode[];
  /** A row that stands under another (a posting under its entry): small and dim. */
  tone?: "muted";
}

export interface TreeGridProps {
  /** The tree column is the one after the rows' leading cells (the first when they have none). */
  columns: TreeGridColumn[];
  /** grid-template-columns, from the columns machine. */
  template: string;
  rows: TreeGridRowData[];
  /** One per column; sticky bottom. */
  footer?: ReactNode[];
  emptyMessage: string;
  onToggle: (key: string) => void;
  onSelect: (key: string) => void;
  /** A double click on a row; nothing happens when left out. */
  onActivate?: (key: string) => void;
  onResize: (index: number, px: number) => void;
}
