import { within } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";

import { TESTIDS } from "../testids.ts";

type User = ReturnType<typeof userEvent.setup>;

/** What a test can do with, and ask of, the grid of one of the screen's panels. */
interface PanelGridPage {
  headers: () => string[];
  rowLabels: () => string[];
  /** The row's cells as texts, its label first. */
  rowTexts: (label: string) => string[];
  /** The labels of the rows one level under this one, as shown. */
  childrenOf: (label: string) => string[];
  /** Whether the row is drawn as an aggregate: bold. */
  isAggregate: (label: string) => boolean;
  /** Whether the row is drawn aside from the others: italic and dim, as Roundings. */
  isAside: (label: string) => boolean;
  selectedLabels: () => string[];
  clickRow: (label: string) => Promise<void>;
  clickCaret: (label: string) => Promise<void>;
  /** What the grid says in place of rows; null while it has some. */
  emptyMessage: () => string | null;
}

/** What a test can do with, and ask of, one of the screen's panels: its title, its grid and its tools. */
export interface PanelPage {
  title: () => string;
  grid: PanelGridPage;
  /** Every tool's name, in the order drawn. */
  toolLabels: () => string[];
  clickTool: (label: string) => Promise<void>;
  clickLegend: () => Promise<void>;
}

/** A panel of the screen, looked for under `root` when asked. */
export function panelIn(root: () => HTMLElement, user: User): PanelPage {
  return {
    title: (): string => {
      return within(root()).getByTestId(TESTIDS.panelTitle).textContent ?? "";
    },
    grid: panelGridIn(root, user),
    toolLabels: (): string[] => {
      return within(root())
        .getAllByTestId(TESTIDS.toolbarButton)
        .map((button) => {
          return button.getAttribute("aria-label") ?? "";
        });
    },
    clickTool: async (label: string): Promise<void> => {
      await user.click(within(root()).getByRole("button", { name: label }));
    },
    clickLegend: async (): Promise<void> => {
      await user.click(within(root()).getByTestId(TESTIDS.panelLegend));
    },
  };
}

function panelGridIn(root: () => HTMLElement, user: User): PanelGridPage {
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

  return {
    headers: (): string[] => {
      return within(root())
        .getAllByRole("columnheader")
        .map((header) => {
          return header.textContent ?? "";
        });
    },
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
      const parent = rowOf(label);
      const depth = depthOf(parent);
      const children: string[] = [];

      for (const row of all.slice(all.indexOf(parent) + 1)) {
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
      return rowOf(label).getAttribute("data-emphasis") === "true";
    },
    isAside: (label: string): boolean => {
      return rowOf(label).getAttribute("data-tone") === "aside";
    },
    selectedLabels: (): string[] => {
      return rows()
        .filter((row) => {
          return row.getAttribute("aria-selected") === "true";
        })
        .map(labelOf);
    },
    clickRow: async (label: string): Promise<void> => {
      await user.click(rowOf(label));
    },
    clickCaret: async (label: string): Promise<void> => {
      await user.click(within(rowOf(label)).getByTestId(TESTIDS.treeGridCaret));
    },
    emptyMessage: (): string | null => {
      return root().querySelector(".tree-grid-empty")?.textContent ?? null;
    },
  };
}
