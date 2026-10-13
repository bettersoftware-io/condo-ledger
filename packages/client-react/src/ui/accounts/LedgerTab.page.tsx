import { act, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import type { LegacySeed } from "@cl/domain";
import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";
import { createViewModel, ViewModelProvider } from "@cl/react-bindings";

import { TESTIDS } from "../testids.ts";
import { LedgerTab } from "./LedgerTab.tsx";

/** What a test can do with, and ask of, the selected account's ledger. */
export interface LedgerTabPage {
  /** Selects an account app-wide, as a click on its row would. */
  select: (key: string) => Promise<void>;
  /** Each line's cell texts, the date first. */
  rows: () => string[][];
  /** The totals row's cell texts; empty when there is none. */
  footer: () => string[];
  hasFooter: () => boolean;
  emptyMessage: () => string | null;
  clickRow: (index: number) => Promise<void>;
  isSelected: (index: number) => boolean;
}

/** Mounts the ledger over the real application on the small books, or on the seed given. */
export function mountLedgerTab(
  seed: LegacySeed = createSmallSeed(),
): LedgerTabPage {
  const user = userEvent.setup();
  const { app } = createAppHarness(seed);
  const rendered = render(
    <ViewModelProvider viewModel={createViewModel(app)}>
      <LedgerTab />
    </ViewModelProvider>,
  );

  function rowElements(): HTMLElement[] {
    return rendered.queryAllByTestId(TESTIDS.treeGridRow);
  }

  function rowAt(index: number): HTMLElement {
    const row = rowElements()[index];

    if (row === undefined) {
      throw new Error(`No line ${index}`);
    }

    return row;
  }

  return {
    select: async (key: string): Promise<void> => {
      await act(async () => {
        app.presenters.accounts.select(key);
      });
    },
    rows: (): string[][] => {
      return rowElements().map((row) => {
        return Array.from(row.children).map((cell) => {
          return cell.textContent ?? "";
        });
      });
    },
    footer: (): string[] => {
      const footer = rendered.queryByTestId(TESTIDS.treeGridFooter);

      return Array.from(footer?.children ?? []).map((cell) => {
        return cell.textContent ?? "";
      });
    },
    hasFooter: (): boolean => {
      return rendered.queryByTestId(TESTIDS.treeGridFooter) !== null;
    },
    emptyMessage: (): string | null => {
      return (
        rendered.container.querySelector(".tree-grid-empty")?.textContent ??
        null
      );
    },
    clickRow: async (index: number): Promise<void> => {
      await user.click(rowAt(index));
    },
    isSelected: (index: number): boolean => {
      return rowAt(index).getAttribute("aria-selected") === "true";
    },
  };
}
