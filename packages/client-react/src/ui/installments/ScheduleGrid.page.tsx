import { act, fireEvent, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import type { Result } from "@cl/domain";

import { polyfillPointerCapture } from "../shell/Splitter.page.tsx";
import { TESTIDS } from "../testids.ts";
import {
  type InstallmentCellPage,
  installmentCellIn,
} from "./InstallmentCell.page.tsx";
import { ScheduleGrid, type ScheduleGridProps } from "./ScheduleGrid.tsx";

type User = ReturnType<typeof userEvent.setup>;

/** What a test can do with, and ask of, the schedule's grid. */
export interface ScheduleGridPage {
  /** Each column's header, its lines joined by a space. */
  headers: () => string[];
  rowLabels: () => string[];
  /** The row's cells as texts, its label first. */
  rowTexts: (label: string) => string[];
  /** The labels of the rows one level under this one, as shown. */
  childrenOf: (label: string) => string[];
  /** Whether the row is drawn as an aggregate: bold, on the zebra background. */
  isAggregate: (label: string) => boolean;
  isSelected: (label: string) => boolean;
  clickRow: (label: string) => Promise<void>;
  clickCaret: (label: string) => Promise<void>;
  /** The installment cell of the row under this header. */
  cell: (label: string, header: string) => InstallmentCellPage;
  emptyMessage: () => string | null;
  /** The columns' layout, as written for the stylesheet. */
  template: () => string;
  /** Drags the boundary on the right of column `index` to the given width. */
  resizeColumn: (index: number, toPx: number) => void;
}

/** Mounts the grid alone; each cell's `editable` says whether a click edits it. */
export function mountScheduleGrid(
  props: Partial<ScheduleGridProps>,
): ScheduleGridPage {
  const user = userEvent.setup();
  const rendered = render(
    <ScheduleGrid
      rows={[]}
      installments={[]}
      template=""
      onToggle={vi.fn()}
      onResize={vi.fn()}
      onSetItemAmount={vi.fn()}
      {...props}
    />,
  );

  return scheduleGridIn(() => {
    return within(rendered.container).getByTestId(TESTIDS.treeGrid);
  }, user);
}

/** The grid wherever it is drawn: alone, or on the screen. */
export function scheduleGridIn(
  root: () => HTMLElement,
  user: User,
): ScheduleGridPage {
  function rows(): HTMLElement[] {
    return within(root()).queryAllByTestId(TESTIDS.treeGridRow);
  }

  function labelOf(row: HTMLElement): string {
    return row.querySelector(".tree-grid-text")?.textContent ?? "";
  }

  function depthOf(row: HTMLElement): number {
    return Number(row.getAttribute("data-depth"));
  }

  function rowOf(label: string): HTMLElement {
    const row = rows().find((candidate) => {
      return labelOf(candidate) === label;
    });

    if (row === undefined) {
      throw new Error(`No row labelled ${label}`);
    }

    return row;
  }

  function headerTexts(): string[] {
    return within(root())
      .getAllByRole("columnheader")
      .map((head) => {
        return head.textContent ?? "";
      });
  }

  function cellElement(label: string, header: string): HTMLElement {
    const index = headerTexts().indexOf(header);
    const cell = rowOf(label).children[index]?.querySelector<HTMLElement>(
      `[data-testid="${TESTIDS.installmentCell}"]`,
    );

    if (index < 0 || cell === null || cell === undefined) {
      throw new Error(`No installment cell under ${header} on ${label}`);
    }

    return cell;
  }

  return {
    headers: headerTexts,
    rowLabels: (): string[] => {
      return rows().map(labelOf);
    },
    rowTexts: (label: string): string[] => {
      return Array.from(rowOf(label).children).map((cell) => {
        return cell.textContent ?? "";
      });
    },
    childrenOf: (label: string): string[] => {
      const all = rows();
      const start = all.indexOf(rowOf(label));
      const depth = depthOf(rowOf(label));
      const children: string[] = [];

      for (const row of all.slice(start + 1)) {
        if (depthOf(row) <= depth) {
          break;
        }

        if (depthOf(row) === depth + 1) {
          children.push(labelOf(row));
        }
      }

      return children;
    },
    isAggregate: (label: string): boolean => {
      const row = rowOf(label);

      return (
        row.getAttribute("data-emphasis") === "true" &&
        row.getAttribute("data-zebra") === "true"
      );
    },
    isSelected: (label: string): boolean => {
      return rowOf(label).getAttribute("aria-selected") === "true";
    },
    clickRow: async (label: string): Promise<void> => {
      await user.click(rowOf(label));
    },
    clickCaret: async (label: string): Promise<void> => {
      await user.click(within(rowOf(label)).getByTestId(TESTIDS.treeGridCaret));
    },
    cell: (label: string, header: string): InstallmentCellPage => {
      return installmentCellIn(() => {
        return cellElement(label, header);
      }, user);
    },
    emptyMessage: (): string | null => {
      return root().querySelector(".tree-grid-empty")?.textContent ?? null;
    },
    template: (): string => {
      return root().style.getPropertyValue("--tree-grid-template");
    },
    resizeColumn: (index: number, toPx: number): void => {
      const handle = within(root()).getAllByTestId(TESTIDS.treeGridResize)[
        index
      ];

      if (handle === undefined) {
        throw new Error(`No boundary ${index}`);
      }

      polyfillPointerCapture();
      fireEvent.pointerDown(handle, { clientX: 0, pointerId: 1 });
      fireEvent.pointerMove(handle, { clientX: toPx, pointerId: 1 });
      fireEvent.pointerUp(handle, { clientX: toPx, pointerId: 1 });
    },
  };
}

/** Item writes whose verdicts wait until released. */
export interface HeldVerdicts {
  save: () => Promise<Result>;
  /** Hands every waiting write this verdict, and lets the grid draw it. */
  release: (result: Result) => Promise<void>;
}

export function holdVerdicts(): HeldVerdicts {
  const waiting: ((result: Result) => void)[] = [];

  return {
    save: async (): Promise<Result> => {
      return await new Promise<Result>((resolve) => {
        waiting.push(resolve);
      });
    },
    release: async (result: Result): Promise<void> => {
      await act(async () => {
        for (const resolve of waiting.splice(0)) {
          resolve(result);
        }

        await Promise.resolve();
      });
    },
  };
}
