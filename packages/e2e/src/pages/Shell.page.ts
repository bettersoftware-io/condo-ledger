import type { Page } from "@playwright/test";

import { TESTIDS } from "@cl/client-react/src/ui/testids.ts";

/** What a spec can do with, and ask of, the frame around every screen. */
export interface ShellPage {
  open: () => Promise<void>;
  /** The breadcrumb's parts, in order, as the person reads them. */
  breadcrumb: () => Promise<string[]>;
  /** Picks a management (a building's year) in the sidebar's tree. */
  selectManagement: (name: string) => Promise<void>;
  /** Opens a screen from the management menu. */
  openScreen: (name: string) => Promise<void>;
  toggleMode: () => Promise<void>;
  /** The mode the whole app is drawn in: "light" or "dark". */
  mode: () => Promise<string | null>;
}

export function createShellPage(page: Page): ShellPage {
  const root = page.getByTestId(TESTIDS.appRoot);
  const breadcrumb = page.getByTestId(TESTIDS.breadcrumb);

  return {
    open: async (): Promise<void> => {
      await page.goto("/");
      await root.waitFor();
    },
    breadcrumb: async (): Promise<string[]> => {
      // The separators are drawn for the eye and hidden from assistive
      // technology; the parts are what is read.
      return breadcrumb.evaluate((element) => {
        return [...element.children]
          .filter((part) => {
            return part.getAttribute("aria-hidden") !== "true";
          })
          .map((part) => {
            return part.textContent ?? "";
          });
      });
    },
    selectManagement: async (name: string): Promise<void> => {
      await page
        .getByRole("tree", { name: "Buildings" })
        .getByRole("treeitem", { name, exact: true })
        .click();
    },
    openScreen: async (name: string): Promise<void> => {
      await page
        .getByRole("navigation", { name: "Management Menu" })
        .getByRole("button", { name, exact: true })
        .click();
    },
    toggleMode: async (): Promise<void> => {
      await page.getByTestId(TESTIDS.modeToggle).click();
    },
    mode: async (): Promise<string | null> => {
      return root.getAttribute("data-mode");
    },
  };
}
