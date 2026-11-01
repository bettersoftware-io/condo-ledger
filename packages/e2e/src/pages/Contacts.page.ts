import type { Page } from "@playwright/test";

import { TESTIDS } from "@cl/client-react/src/ui/testids.ts";

/** What a spec can do with, and ask of, the Contacts module. */
export interface ContactsPage {
  /** Types the keyword in Filter Contacts and presses Search. */
  search: (keyword: string) => Promise<void>;
  /** The names of the contacts the list shows, top to bottom, read in one step. */
  names: () => Promise<string[]>;
  /** The name of the selected row of the list; null while none is selected. */
  selectedName: () => Promise<string | null>;
  /** Edits the selected contact's last name through the Edit Person dialog, and resolves when it has closed. */
  renameSelected: (lastName: string) => Promise<void>;
}

export function createContactsPage(page: Page): ContactsPage {
  const filters = page.getByTestId(TESTIDS.contactFilters);
  const rows = page
    .getByTestId(TESTIDS.contactsPanel)
    .getByTestId(TESTIDS.treeGridRow);
  const dialog = page.getByTestId(TESTIDS.dialog);

  return {
    search: async (keyword: string): Promise<void> => {
      await filters.getByRole("textbox", { name: "Keyword" }).fill(keyword);
      await filters.getByRole("button", { name: "Search" }).click();
    },
    names: async (): Promise<string[]> => {
      return rows.evaluateAll((elements) => {
        return elements.map((element) => {
          return (
            element.querySelector(".tree-grid-text")?.textContent?.trim() ?? ""
          );
        });
      });
    },
    selectedName: async (): Promise<string | null> => {
      const selected = rows.and(page.locator('[aria-selected="true"]'));

      if ((await selected.count()) === 0) {
        return null;
      }

      const text = await selected
        .first()
        .locator(".tree-grid-text")
        .first()
        .textContent();

      return text === null ? null : text.trim();
    },
    renameSelected: async (lastName: string): Promise<void> => {
      await page
        .getByTestId(TESTIDS.contactTabs)
        .getByRole("button", { name: "Edit contact" })
        .click();
      await dialog.getByRole("textbox", { name: "Last name" }).fill(lastName);
      await dialog.getByTestId(TESTIDS.formDialogSave).click();
      await dialog.waitFor({ state: "detached" });
    },
  };
}
