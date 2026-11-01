import { expect, type Page } from "@playwright/test";

import { TESTIDS } from "@cl/client-react/src/ui/testids.ts";

/** What a spec can do with, and ask of, the Units, Owners & Personal Balance screen. */
export interface UnitsPage {
  /** The labels of the Units grid's rows shown, top to bottom, read in one step: `B3 - Tavano Ornella (PR)`. */
  rowLabels: () => Promise<string[]>;
  /** Selects the unit with this code in the Units grid. */
  selectUnit: (code: string) => Promise<void>;
  /** Adds an owner to the selected unit through the Add Owner dialog: the contact found by what is typed, chosen by name, then + Add. Resolves when the dialog has closed. */
  addOwner: (typed: string, contact: string) => Promise<void>;
  /** Adds an owner to the selected unit through the Add Owner dialog, making the contact in place: New person, its names, + Add there, then + Add on the owner. Resolves when both dialogs have closed. */
  addOwnerAsNewPerson: (firstName: string, lastName: string) => Promise<void>;
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
    addOwnerAsNewPerson: async (
      firstName: string,
      lastName: string,
    ): Promise<void> => {
      await page
        .getByTestId(TESTIDS.unitTabs)
        .getByRole("button", { name: "Add owner" })
        .click();
      await dialog.getByRole("button", { name: "New person" }).click();

      // The person's dialog opens over the owner's, and is the last one.
      const person = dialog.last();

      await person.getByRole("textbox", { name: "First name" }).fill(firstName);
      await person.getByRole("textbox", { name: "Last name" }).fill(lastName);
      await person.getByTestId(TESTIDS.formDialogSave).click();
      await expect(dialog).toHaveCount(1);
      await dialog.getByTestId(TESTIDS.formDialogSave).click();
      await dialog.waitFor({ state: "detached" });
    },
  };
}
