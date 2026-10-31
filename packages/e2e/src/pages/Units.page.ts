import type { Page } from "@playwright/test";

import { TESTIDS } from "@cl/client-react/src/ui/testids.ts";

/** What a spec can do with, and ask of, the Units, Owners & Personal Balance screen. */
export interface UnitsPage {
  /** The labels of the Units grid's rows shown, top to bottom, read in one step: `B3 - Tavano Ornella (PR)`. */
  rowLabels: () => Promise<string[]>;
  /** Selects the unit with this code in the Units grid. */
  selectUnit: (code: string) => Promise<void>;
  /** Adds an owner to the selected unit through the Add Owner dialog: the contact found by what is typed, chosen by name, then + Add. Resolves when the dialog has closed. */
  addOwner: (typed: string, contact: string) => Promise<void>;
}

export function createUnitsPage(page: Page): UnitsPage {
  const panel = page.getByTestId(TESTIDS.unitsPanel);
  const rows = panel.getByTestId(TESTIDS.treeGridRow);
  const dialog = page.getByTestId(TESTIDS.dialog);

  return {
    rowLabels: async (): Promise<string[]> => {
      return rows.evaluateAll((elements) => {
        return elements.map((element) => {
          return (
            element.querySelector(".tree-grid-text")?.textContent?.trim() ?? ""
          );
        });
      });
    },
    selectUnit: async (code: string): Promise<void> => {
      const row = rows.filter({ hasText: `${code} - ` });

      await row.getByRole("gridcell").first().click();
      await row.and(page.locator('[aria-selected="true"]')).waitFor();
    },
    addOwner: async (typed: string, contact: string): Promise<void> => {
      await page
        .getByTestId(TESTIDS.unitTabs)
        .getByRole("button", { name: "Add owner" })
        .click();
      await dialog.getByRole("textbox", { name: "Linked contact" }).fill(typed);
      await dialog
        .getByTestId(TESTIDS.contactPickerOption)
        .filter({ hasText: contact })
        .click();
      await dialog.getByTestId(TESTIDS.formDialogSave).click();
      await dialog.waitFor({ state: "detached" });
    },
  };
}
