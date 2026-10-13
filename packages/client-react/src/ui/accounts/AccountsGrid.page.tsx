import { fireEvent, within } from "@testing-library/react";

import { polyfillPointerCapture } from "../shell/Splitter.page.tsx";
import { TESTIDS } from "../testids.ts";
import { mountScreen } from "./AccountsScreen.page.tsx";

/** What a test can do with, and ask of, the chart of accounts. */
export interface AccountsGridPage {
  labels: () => string[];
  /** The texts of a row's cells after its label. */
  cellsOf: (label: string) => string[];
  clickRow: (label: string) => Promise<void>;
  clickCaret: (label: string) => Promise<void>;
  search: (text: string) => Promise<void>;
  toggleHideEmpty: () => Promise<void>;
  expandAll: () => Promise<void>;
  collapseAll: () => Promise<void>;
  /** The row drawn as selected. */
  selectedLabel: () => string | null;
  /** The account the whole app has selected. */
  appSelectedKey: () => string;
  /** The glyph drawn for a row and the nature it is tinted by. */
  iconOf: (label: string) => string;
  natureOf: (label: string) => string | null;
  /** Whether a folder row draws its folder open. */
  drawsOpenFolder: (label: string) => boolean;
  /** Whether a row's label and amounts are drawn bold, as an aggregate's are. */
  isBold: (label: string) => boolean;
  /** Whether a row has the root's background. */
  isZebra: (label: string) => boolean;
  /** Drags the boundary before column `index + 1` to the given width. */
  resizeColumn: (index: number, toPx: number) => void;
  template: () => string;
  emptyMessage: () => string | null;
  /** Opens the budget editor of an expense leaf's row. */
  clickBudget: (label: string) => Promise<void>;
  /** The open budget editor's text. */
  budgetText: () => string;
  /** Replaces the open budget editor's text. */
  typeBudget: (text: string) => Promise<void>;
  pressEnter: () => Promise<void>;
  pressEscape: () => Promise<void>;
  /** Leaves the open budget editor by clicking outside it, as the person does. */
  blurBudget: () => Promise<void>;
  /** What the open budget editor says is wrong, if anything. */
  budgetError: () => string | null;
  /** How many budget writes reached the accounts store. */
  budgetWrites: () => number;
  /** From now on, a budget is saved at once but its verdict waits for release. */
  holdBudgetVerdicts: () => void;
  /** Hands every held verdict back to the screen. */
  releaseBudgetVerdicts: () => Promise<void>;
}

/** Mounts the Accounts screen over the small books, as the person sees its top panel. */
export function mountAccountsGrid(): AccountsGridPage {
  const { rendered, user, selectedKey, budgetWrites } = mountScreen();

  function top(): HTMLElement {
    const element =
      rendered.container.querySelector<HTMLElement>(".accounts-top");

    if (element === null) {
      throw new Error("missing: the top panel");
    }

    return element;
  }

  function rows(): HTMLElement[] {
    return within(top()).queryAllByTestId(TESTIDS.treeGridRow);
  }

  function labelOf(row: HTMLElement): string {
    return row.querySelector(".tree-grid-text")?.textContent ?? "";
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

  function iconElement(label: string): HTMLElement {
    return within(rowOf(label)).getByTestId(TESTIDS.accountIcon);
  }

  return {
    labels: (): string[] => {
      return rows().map(labelOf);
    },
    cellsOf: (label: string): string[] => {
      return Array.from(rowOf(label).children)
        .slice(1)
        .map((cell) => {
          return cell.textContent ?? "";
        });
    },
    clickRow: async (label: string): Promise<void> => {
      await user.click(rowOf(label));
    },
    clickCaret: async (label: string): Promise<void> => {
      await user.click(within(rowOf(label)).getByTestId(TESTIDS.treeGridCaret));
    },
    search: async (text: string): Promise<void> => {
      const box = within(top()).getByTestId(TESTIDS.toolbarSearch);
      await user.clear(box);
      await user.type(box, text);
    },
    toggleHideEmpty: async (): Promise<void> => {
      await user.click(within(top()).getByTestId(TESTIDS.toolbarCheckbox));
    },
    expandAll: async (): Promise<void> => {
      await user.click(
        within(top()).getByRole("button", { name: "Expand all" }),
      );
    },
    collapseAll: async (): Promise<void> => {
      await user.click(
        within(top()).getByRole("button", { name: "Collapse all" }),
      );
    },
    selectedLabel: (): string | null => {
      const selected = rows().find((row) => {
        return row.getAttribute("aria-selected") === "true";
      });

      return selected === undefined ? null : labelOf(selected);
    },
    appSelectedKey: selectedKey,
    iconOf: (label: string): string => {
      return iconElement(label).getAttribute("data-icon") ?? "";
    },
    natureOf: (label: string): string | null => {
      return iconElement(label).getAttribute("data-nature");
    },
    drawsOpenFolder: (label: string): boolean => {
      return iconElement(label).querySelector(".lucide-folder-open") !== null;
    },
    isBold: (label: string): boolean => {
      const row = rowOf(label);
      const amounts = within(row).getAllByTestId(TESTIDS.money);

      return (
        row.getAttribute("data-emphasis") === "true" &&
        amounts.every((amount) => {
          return amount.getAttribute("data-emphasis") === "true";
        })
      );
    },
    isZebra: (label: string): boolean => {
      return rowOf(label).getAttribute("data-zebra") === "true";
    },
    resizeColumn: (index: number, toPx: number): void => {
      const handle = within(top()).getAllByTestId(TESTIDS.treeGridResize)[
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
    template: (): string => {
      return within(top())
        .getByTestId(TESTIDS.treeGrid)
        .style.getPropertyValue("--tree-grid-template");
    },
    emptyMessage: (): string | null => {
      return top().querySelector(".tree-grid-empty")?.textContent ?? null;
    },
    clickBudget: async (label: string): Promise<void> => {
      await user.click(within(rowOf(label)).getByTestId(TESTIDS.budgetCell));
    },
    budgetText: (): string => {
      return within(top()).getByTestId<HTMLInputElement>(TESTIDS.inlineEditor)
        .value;
    },
    typeBudget: async (text: string): Promise<void> => {
      const editor = within(top()).getByTestId(TESTIDS.inlineEditor);
      await user.clear(editor);
      await user.type(editor, text);
    },
    pressEnter: async (): Promise<void> => {
      await user.keyboard("{Enter}");
    },
    pressEscape: async (): Promise<void> => {
      await user.keyboard("{Escape}");
    },
    blurBudget: async (): Promise<void> => {
      await user.click(document.body);
    },
    budgetError: (): string | null => {
      return (
        within(top()).queryByTestId(TESTIDS.inlineEditorError)?.textContent ??
        null
      );
    },
    budgetWrites: budgetWrites.count,
    holdBudgetVerdicts: budgetWrites.hold,
    releaseBudgetVerdicts: budgetWrites.release,
  };
}
