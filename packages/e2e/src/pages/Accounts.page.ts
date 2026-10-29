import type { Page } from "@playwright/test";

import { TESTIDS } from "@cl/client-react/src/ui/testids.ts";

/** One row of the chart of accounts, as the person reads it: the amounts as text. */
interface AccountRow {
  account: string;
  debit: string;
  credit: string;
  balance: string;
}

/** What a spec can do with, and ask of, the accounts screen. */
export interface AccountsPage {
  /** Every row, read in one step, so the grid cannot change between two rows. */
  rows: () => Promise<AccountRow[]>;
  /** The first row: the chart's grand total. */
  total: () => Promise<AccountRow | undefined>;
}

export function createAccountsPage(page: Page): AccountsPage {
  const screen = page.getByTestId(TESTIDS.accountsScreen);

  async function readRows(): Promise<AccountRow[]> {
    return screen.getByTestId(TESTIDS.treeGridRow).evaluateAll((elements) => {
      return elements.map((element) => {
        const cells = [...element.querySelectorAll('[role="gridcell"]')].map(
          (cell) => {
            return cell.textContent?.trim() ?? "";
          },
        );

        return {
          account: cells[0] ?? "",
          debit: cells[1] ?? "",
          credit: cells[2] ?? "",
          balance: cells[3] ?? "",
        };
      });
    });
  }

  return {
    rows: readRows,
    total: async (): Promise<AccountRow | undefined> => {
      return (await readRows())[0];
    },
  };
}
