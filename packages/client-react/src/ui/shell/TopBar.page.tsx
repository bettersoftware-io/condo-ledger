import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";
import { createViewModel, ViewModelProvider } from "@cl/react-bindings";

import { TESTIDS } from "../testids.ts";
import { AppRoot } from "./AppRoot.tsx";

/** What a test can do with, and ask of, the top bar. */
export interface TopBarPage {
  accountLine: () => string;
  modeLabel: () => string;
  toggleMode: () => Promise<void>;
  openThemes: () => Promise<void>;
  pickTheme: (name: string) => Promise<void>;
  themeLabel: () => string;
  openLanguages: () => Promise<void>;
  pickLanguage: (name: string) => Promise<void>;
  languageLabel: () => string;
  /** The names of the options in the open popover, the checked one marked with ✓. */
  options: () => string[];
  isPopoverOpen: () => boolean;
  pressEscape: () => Promise<void>;
  clickOutside: () => Promise<void>;
  logOut: () => Promise<void>;
  toasts: () => string[];
  activeTab: () => string;
  clickTab: (label: string) => Promise<void>;
  rootMode: () => string | null;
  rootTheme: () => string | null;
  hasSidebar: () => boolean;
  placeholderTitle: () => string | null;
}

/**
 * Mounts the whole shell over the small books: the root element carries the
 * mode and theme the top bar changes, and the main area shows what its module
 * tabs choose.
 */
export function mountTopBar(): TopBarPage {
  const user = userEvent.setup();
  const viewModel = createViewModel(createAppHarness(createSmallSeed()).app);
  const rendered = render(
    <ViewModelProvider viewModel={viewModel}>
      <AppRoot />
    </ViewModelProvider>,
  );

  function root(): HTMLElement {
    return rendered.getByTestId(TESTIDS.appRoot);
  }

  function labelOf(testId: string): string {
    return rendered.getByTestId(testId).getAttribute("aria-label") ?? "";
  }

  return {
    accountLine: (): string => {
      return rendered.getByTestId(TESTIDS.accountLine).textContent ?? "";
    },
    modeLabel: (): string => {
      return labelOf(TESTIDS.modeToggle);
    },
    toggleMode: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.modeToggle));
    },
    openThemes: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.themeButton));
    },
    pickTheme: async (name: string): Promise<void> => {
      await user.click(rendered.getByRole("menuitemradio", { name }));
    },
    themeLabel: (): string => {
      return rendered.getByTestId(TESTIDS.themeButton).textContent ?? "";
    },
    openLanguages: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.languageButton));
    },
    pickLanguage: async (name: string): Promise<void> => {
      await user.click(rendered.getByRole("menuitemradio", { name }));
    },
    languageLabel: (): string => {
      return labelOf(TESTIDS.languageButton);
    },
    options: (): string[] => {
      return within(rendered.getByRole("menu"))
        .getAllByRole("menuitemradio")
        .map((option) => {
          const name = option.textContent?.replace("✓", "") ?? "";

          return option.getAttribute("aria-checked") === "true"
            ? `${name} ✓`
            : name;
        });
    },
    isPopoverOpen: (): boolean => {
      return rendered.queryByRole("menu") !== null;
    },
    pressEscape: async (): Promise<void> => {
      await user.keyboard("{Escape}");
    },
    clickOutside: async (): Promise<void> => {
      const scrim = rendered.container.querySelector(".popover-scrim");

      if (scrim === null) {
        throw new Error("No popover is open");
      }

      await user.click(scrim);
    },
    logOut: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.logOut));
    },
    toasts: (): string[] => {
      return rendered.queryAllByTestId(TESTIDS.toast).map((toast) => {
        return toast.querySelector(".toast-text")?.textContent ?? "";
      });
    },
    activeTab: (): string => {
      return rendered.getByRole("tab", { selected: true }).textContent ?? "";
    },
    clickTab: async (label: string): Promise<void> => {
      await user.click(rendered.getByRole("tab", { name: label }));
    },
    rootMode: (): string | null => {
      return root().getAttribute("data-mode");
    },
    rootTheme: (): string | null => {
      return root().getAttribute("data-theme");
    },
    hasSidebar: (): boolean => {
      return rendered.queryByTestId(TESTIDS.sidebar) !== null;
    },
    placeholderTitle: (): string | null => {
      return (
        within(rendered.getByTestId(TESTIDS.appMain)).queryByTestId(
          TESTIDS.panelTitle,
        )?.textContent ?? null
      );
    },
  };
}
