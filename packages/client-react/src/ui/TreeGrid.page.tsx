import { fireEvent, render, within } from "@testing-library/react";
import { vi } from "vitest";

import {
  TreeGrid,
  type TreeGridProps,
  type TreeGridRowData,
} from "./TreeGrid.tsx";
import { TESTIDS } from "./testids.ts";

/** What a test can do with, and ask of, a tree grid. */
export interface TreeGridPage {
  rowLabels: () => string[];
  depthOf: (label: string) => number;
  isExpanded: (label: string) => boolean;
  isSelected: (label: string) => boolean;
  indentCountOf: (label: string) => number;
  pressKeyOnCaret: (label: string, key: string) => void;
  pressKeyOnRow: (label: string, key: string) => void;
  hasCaret: (label: string) => boolean;
  caretLabel: (label: string) => string;
  clickCaret: (label: string) => void;
  clickRow: (label: string) => void;
  doubleClickRow: (label: string) => void;
  doubleClickCaret: (label: string) => void;
  moveOverBoundary: (index: number, byPx: number) => void;
  dragBoundary: (index: number, byPx: number, startWidthPx?: number) => void;
  emptyMessage: () => string | null;
  footerTexts: () => string[];
  cellTexts: (label: string) => string[];
  alignmentsOf: (label: string) => string[];
  toneOf: (label: string) => string | null;
  template: () => string;
  rerender: (props: Partial<TreeGridProps>) => void;
}

export function mountTreeGrid(props: Partial<TreeGridProps>): TreeGridPage {
  polyfillPointerCapture();
  const rendered = render(<TreeGrid {...withDefaults(props)} />);

  function rowOf(label: string): HTMLElement {
    const row = rendered
      .getAllByTestId(TESTIDS.treeGridRow)
      .find((candidate) => {
        return (
          candidate.querySelector(".tree-grid-text")?.textContent === label
        );
      });

    if (row === undefined) {
      throw new Error(`No row labelled ${label}`);
    }

    return row;
  }

  return {
    rowLabels: (): string[] => {
      return rendered.queryAllByTestId(TESTIDS.treeGridRow).map((row) => {
        return row.querySelector(".tree-grid-text")?.textContent ?? "";
      });
    },
    depthOf: (label: string): number => {
      return Number(rowOf(label).getAttribute("data-depth"));
    },
    isExpanded: (label: string): boolean => {
      return rowOf(label).getAttribute("aria-expanded") === "true";
    },
    isSelected: (label: string): boolean => {
      return rowOf(label).getAttribute("aria-selected") === "true";
    },
    indentCountOf: (label: string): number => {
      return within(rowOf(label)).queryAllByTestId(TESTIDS.treeGridIndent)
        .length;
    },
    pressKeyOnCaret: (label: string, key: string): void => {
      fireEvent.keyDown(
        within(rowOf(label)).getByTestId(TESTIDS.treeGridCaret),
        {
          key,
        },
      );
    },
    pressKeyOnRow: (label: string, key: string): void => {
      fireEvent.keyDown(rowOf(label), { key });
    },
    hasCaret: (label: string): boolean => {
      return within(rowOf(label)).queryByTestId(TESTIDS.treeGridCaret) !== null;
    },
    caretLabel: (label: string): string => {
      return (
        within(rowOf(label))
          .getByTestId(TESTIDS.treeGridCaret)
          .getAttribute("aria-label") ?? ""
      );
    },
    clickCaret: (label: string): void => {
      fireEvent.click(within(rowOf(label)).getByTestId(TESTIDS.treeGridCaret));
    },
    clickRow: (label: string): void => {
      fireEvent.click(rowOf(label));
    },
    doubleClickRow: (label: string): void => {
      fireEvent.doubleClick(rowOf(label));
    },
    doubleClickCaret: (label: string): void => {
      fireEvent.doubleClick(
        within(rowOf(label)).getByTestId(TESTIDS.treeGridCaret),
      );
    },
    moveOverBoundary: (index: number, byPx: number): void => {
      const handle = rendered.getAllByTestId(TESTIDS.treeGridResize)[index];

      if (handle === undefined) {
        throw new Error(`No boundary ${index}`);
      }

      fireEvent.pointerMove(handle, { clientX: 100 + byPx, pointerId: 1 });
    },
    dragBoundary: (index: number, byPx: number, startWidthPx = 0): void => {
      const handle = rendered.getAllByTestId(TESTIDS.treeGridResize)[index];

      if (handle === undefined) {
        throw new Error(`No boundary ${index}`);
      }

      const left = handle.parentElement?.previousElementSibling;

      if (left instanceof HTMLElement) {
        left.getBoundingClientRect = (): DOMRect => {
          return { width: startWidthPx } as DOMRect;
        };
      }

      fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 });
      fireEvent.pointerMove(handle, { clientX: 100 + byPx, pointerId: 1 });
      fireEvent.pointerUp(handle, { clientX: 100 + byPx, pointerId: 1 });
    },
    emptyMessage: (): string | null => {
      return (
        rendered.container.querySelector(".tree-grid-empty")?.textContent ??
        null
      );
    },
    cellTexts: (label: string): string[] => {
      return Array.from(rowOf(label).children).map((cell) => {
        return cell.textContent ?? "";
      });
    },
    alignmentsOf: (label: string): string[] => {
      return Array.from(rowOf(label).children).map((cell) => {
        return cell.getAttribute("data-align") ?? "left";
      });
    },
    toneOf: (label: string): string | null => {
      return rowOf(label).getAttribute("data-tone");
    },
    footerTexts: (): string[] => {
      const footer = rendered.queryByTestId(TESTIDS.treeGridFooter);
      return Array.from(footer?.children ?? []).map((cell) => {
        return cell.textContent ?? "";
      });
    },
    template: (): string => {
      return rendered
        .getByTestId(TESTIDS.treeGrid)
        .style.getPropertyValue("--tree-grid-template");
    },
    rerender: (next: Partial<TreeGridProps>): void => {
      rendered.rerender(<TreeGrid {...withDefaults({ ...props, ...next })} />);
    },
  };
}

export function createRow(
  key: string,
  overrides: Partial<TreeGridRowData> = {},
): TreeGridRowData {
  return {
    key,
    depth: 0,
    hasChildren: false,
    expanded: false,
    selected: false,
    emphasis: false,
    zebra: false,
    icon: null,
    label: key,
    cells: ["", ""],
    ...overrides,
  };
}

function withDefaults(props: Partial<TreeGridProps>): TreeGridProps {
  return {
    columns: [
      { header: "Accounts" },
      { header: "Debit", align: "right" },
      { header: "Credit", align: "right" },
    ],
    template: "minmax(200px,1fr) 100px 100px",
    rows: [
      createRow("Assets", {
        hasChildren: true,
        expanded: true,
        emphasis: true,
      }),
      createRow("Cash", { depth: 1 }),
    ],
    emptyMessage: "No accounts",
    onToggle: vi.fn(),
    onSelect: vi.fn(),
    onResize: vi.fn(),
    ...props,
  };
}

// jsdom has no pointer capture: a flag on the element stands in for it.
function polyfillPointerCapture(): void {
  const captured = new WeakSet<Element>();

  HTMLElement.prototype.setPointerCapture = function setPointerCapture(
    this: HTMLElement,
  ): void {
    captured.add(this);
  };

  HTMLElement.prototype.releasePointerCapture = function releasePointerCapture(
    this: HTMLElement,
  ): void {
    captured.delete(this);
  };

  HTMLElement.prototype.hasPointerCapture = function hasPointerCapture(
    this: HTMLElement,
  ): boolean {
    return captured.has(this);
  };
}
