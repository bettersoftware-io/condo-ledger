import { render, within } from "@testing-library/react";

import { TESTIDS } from "#/ui/testids.ts";

import {
  SettlementTable,
  type SettlementTableProps,
} from "./SettlementTable.tsx";

/** What a test can ask of a settlement table. */
export interface SettlementTablePage {
  /** The column headings, as the person reads them. */
  columns: () => string[];
  /** Each row's cells: Installment, Unit, Due, Owed, Paid now. */
  rows: () => string[][];
  /** The rows marked "partial", counted from 0. */
  partialRows: () => number[];
}

/** Mounts the table alone, on these rows. */
export function mountSettlementTable(
  props: SettlementTableProps,
): SettlementTablePage {
  const rendered = render(<SettlementTable {...props} />);

  return settlementTableIn(
    within(rendered.container).getByTestId(TESTIDS.settlementTable),
  );
}

/** The settlement table drawn under this element: alone, or in a wizard's step. */
export function settlementTableIn(root: HTMLElement): SettlementTablePage {
  function table(): HTMLElement {
    return root.getAttribute("data-testid") === TESTIDS.settlementTable
      ? root
      : within(root).getByTestId(TESTIDS.settlementTable);
  }

  function rowElements(): HTMLElement[] {
    return within(table()).queryAllByTestId(TESTIDS.settlementRow);
  }

  return {
    columns: (): string[] => {
      return Array.from(
        table().querySelectorAll<HTMLElement>(".settlement-head > span"),
      )
        .map((cell) => {
          return cell.textContent ?? "";
        })
        .filter((text) => {
          return text !== "";
        });
    },
    rows: (): string[][] => {
      return rowElements().map((row) => {
        return Array.from(
          row.querySelectorAll<HTMLElement>(".settlement-cell"),
        ).map((cell) => {
          return cell.textContent ?? "";
        });
      });
    },
    partialRows: (): number[] => {
      return rowElements().flatMap((row, index) => {
        return within(row).queryByTestId(TESTIDS.settlementPartial) === null
          ? []
          : [index];
      });
    },
  };
}
