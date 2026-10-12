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
              {column.header}
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
  header: string;
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
  /** One per column after the first. */
  cells: ReactNode[];
}

export interface TreeGridProps {
  /** The first is the tree column. */
  columns: TreeGridColumn[];
  /** grid-template-columns, from the columns machine. */
  template: string;
  rows: TreeGridRowData[];
  /** One per column; sticky bottom. */
  footer?: ReactNode[];
  emptyMessage: string;
  onToggle: (key: string) => void;
  onSelect: (key: string) => void;
  onResize: (index: number, px: number) => void;
}
