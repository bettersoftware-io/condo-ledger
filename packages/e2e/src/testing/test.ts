import { test as base, expect, type Page } from "@playwright/test";

import {
  type AccountsPage,
  createAccountsPage,
} from "../pages/Accounts.page.ts";
import { createJournalPage, type JournalPage } from "../pages/Journal.page.ts";
import { createShellPage, type ShellPage } from "../pages/Shell.page.ts";

interface PageObjects {
  shell: ShellPage;
  accounts: AccountsPage;
  journal: JournalPage;
  /** Fails a test whose page threw. Every test has it, asked for or not. */
  crashes: string[];
}

/**
 * The `test` every spec imports. It hands out page objects, and that is how a
 * spec reaches the browser: a new page object is added here.
 */
export const test = base.extend<PageObjects>({
  shell: async ({ page }: WithPage, use: Use<ShellPage>): Promise<void> => {
    await use(createShellPage(page));
  },

  accounts: async (
    { page }: WithPage,
    use: Use<AccountsPage>,
  ): Promise<void> => {
    await use(createAccountsPage(page));
  },

  journal: async ({ page }: WithPage, use: Use<JournalPage>): Promise<void> => {
    await use(createJournalPage(page));
  },

  crashes: [
    async ({ page }: WithPage, use: Use<string[]>): Promise<void> => {
      const crashes: string[] = [];

      page.on("pageerror", (error) => {
        crashes.push(error.message);
      });

      await use(crashes);

      expect(crashes, "the page threw an error nothing caught").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

interface WithPage {
  page: Page;
}

/** Hands a fixture to the test, and resolves when the test is over. */
type Use<T> = (value: T) => Promise<void>;
