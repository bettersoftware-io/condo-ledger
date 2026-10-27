import { render, within } from "@testing-library/react";

import type { AllocationTableRow } from "@cl/client-core";

import { AmountLocaleContext } from "../amountLocale.ts";
import { TESTIDS } from "../testids.ts";
import { AllocationTablesGrid } from "./AllocationTablesGrid.tsx";

/** What a test can ask of an account's allocation tables mini-grid. */
export interface AllocationTablesGridPage {
  headers: () => string[];
  /** Each link's cells, in order. */
  rows: () => string[][];
}

/** Mounts the grid alone over the rows, in the locale given (en-US by default). */
export function mountAllocationTablesGrid(
  rows: AllocationTableRow[],
  locale: "en-US" | "it-IT" = "en-US",
): AllocationTablesGridPage {
  const rendered = render(
    <AmountLocaleContext value={locale}>
      <AllocationTablesGrid rows={rows} />
    </AmountLocaleContext>,
  );

  return allocationTablesGridIn(() => {
    return rendered.container;
  });
}

/** The grid wherever it is drawn under `root`. */
export function allocationTablesGridIn(
  root: () => HTMLElement,
): AllocationTablesGridPage {
  function grid(): HTMLElement {
    return within(root()).getByTestId(TESTIDS.allocationTablesGrid);
  }

  function cellsOf(row: HTMLElement): string[] {
    return Array.from(row.children).map((cell) => {
      return cell.textContent ?? "";
    });
  }

  return {
    headers: (): string[] => {
      return cellsOf(within(grid()).getByTestId(TESTIDS.allocationTablesHead));
    },
    rows: (): string[][] => {
      return within(grid())
        .queryAllByTestId(TESTIDS.allocationTablesRow)
        .map(cellsOf);
    },
  };
}

/** A link's row as the accounts presenter gives it: all of the account, PR/NP/LE all of the table, unless told otherwise. */
export function createAllocationTableRow(
  id: string,
  overrides: Partial<AllocationTableRow> = {},
): AllocationTableRow {
  return {
    id,
    percentage: null,
    table: `Table ${id}`,
    roles: { 1: 10000, 2: null, 3: null, 4: null },
    ...overrides,
  };
}
