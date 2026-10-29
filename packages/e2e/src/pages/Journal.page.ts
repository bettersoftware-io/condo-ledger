import type { Page } from "@playwright/test";

import { TESTIDS } from "@cl/client-react/src/ui/testids.ts";

/** What a spec can do with, and ask of, the journal. */
export interface JournalPage {
  /** The number of entries the journal says it holds, across its pages. */
  entryCount: () => Promise<number | null>;
  /** The descriptions of the entries on the page shown. */
  descriptions: () => Promise<string[]>;
  /** Selects the entry with this description and asks to delete it. Resolves with the question asked. */
  askToDelete: (description: string) => Promise<string>;
  answer: (yes: boolean) => Promise<void>;
}

export function createJournalPage(page: Page): JournalPage {
  const screen = page.getByTestId(TESTIDS.journalScreen);
  const dialog = page.getByTestId(TESTIDS.dialog);

  return {
    entryCount: async (): Promise<number | null> => {
      const text = await screen.getByText(/\d+ entries total/).textContent();
      const count = /(\d+) entries total/.exec(text ?? "")?.[1];

      return count === undefined ? null : Number(count);
    },
    descriptions: async (): Promise<string[]> => {
      return screen
        .getByTestId(TESTIDS.journalGrid)
        .getByRole("row")
        .evaluateAll((rows) => {
          return rows.flatMap((row) => {
            const cell = row.querySelectorAll('[role="gridcell"]')[2];

            return cell === undefined ? [] : [cell.textContent?.trim() ?? ""];
          });
        });
    },
    askToDelete: async (description: string): Promise<string> => {
      await screen
        .getByTestId(TESTIDS.journalGrid)
        .getByRole("row")
        .filter({ hasText: description })
        .getByRole("gridcell")
        .first()
        .click();
      await screen.getByRole("button", { name: "Delete entry" }).click();

      return (
        (await dialog.getByTestId(TESTIDS.confirmText).textContent()) ?? ""
      );
    },
    answer: async (yes: boolean): Promise<void> => {
      await dialog
        .getByTestId(yes ? TESTIDS.confirmYes : TESTIDS.confirmNo)
        .click();
      await dialog.waitFor({ state: "detached" });
    },
  };
}
