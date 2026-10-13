import { type RenderResult, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactElement, useEffect } from "react";

import type { App } from "@cl/client-core";
import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";
import {
  createViewModel,
  useViewModel,
  ViewModelProvider,
} from "@cl/react-bindings";

import { dragSplitterElement } from "../shell/Splitter.page.tsx";
import { ToastHost } from "../shell/ToastHost.tsx";
import { TESTIDS } from "../testids.ts";
import { AccountsScreen } from "./AccountsScreen.tsx";

type User = ReturnType<typeof userEvent.setup>;

/** What a test can do with, and ask of, the Accounts screen as a whole. */
export interface AccountsScreenPage {
  title: () => string;
  tabs: () => string[];
  activeTab: () => string;
  activateTab: (name: string) => Promise<void>;
  showsDetails: () => boolean;
  showsLedger: () => boolean;
  /** Drags the splitter between the panels on a screen of the given height. */
  dragSplitter: (by: number, screenHeight?: number) => void;
  /** The top panel's share, as written for the stylesheet. */
  splitRatio: () => number;
  maximizeLabel: () => string;
  clickMaximize: () => Promise<void>;
  /** Which panel fills the screen: top, bottom or none. */
  maximized: () => string | null;
  toolLabels: () => string[];
  clickTool: (label: string) => Promise<void>;
  toasts: () => string[];
}

/** Mounts the Accounts screen over the small books, with the toasts its stubs post. */
export function mountAccountsScreen(): AccountsScreenPage {
  const { rendered, user } = mountScreen();

  function screen(): HTMLElement {
    return rendered.getByTestId(TESTIDS.accountsScreen);
  }

  function bottom(): HTMLElement {
    const element = screen().querySelector<HTMLElement>(".accounts-bottom");

    if (element === null) {
      throw new Error("missing: the bottom panel");
    }

    return element;
  }

  function top(): HTMLElement {
    const element = screen().querySelector<HTMLElement>(".accounts-top");

    if (element === null) {
      throw new Error("missing: the top panel");
    }

    return element;
  }

  return {
    title: (): string => {
      return within(top()).getByTestId(TESTIDS.panelTitle).textContent ?? "";
    },
    tabs: (): string[] => {
      return within(bottom())
        .getAllByRole("tab")
        .map((tab) => {
          return tab.textContent ?? "";
        });
    },
    activeTab: (): string => {
      return (
        within(bottom()).getByRole("tab", { selected: true }).textContent ?? ""
      );
    },
    activateTab: async (name: string): Promise<void> => {
      await user.click(within(bottom()).getByRole("tab", { name }));
    },
    showsDetails: (): boolean => {
      return within(bottom()).queryByTestId(TESTIDS.scheda) !== null;
    },
    showsLedger: (): boolean => {
      return within(bottom()).queryByTestId(TESTIDS.treeGrid) !== null;
    },
    dragSplitter: (by: number, screenHeight = 600): void => {
      screen().getBoundingClientRect = (): DOMRect => {
        return { height: screenHeight } as DOMRect;
      };

      dragSplitterElement(within(screen()).getByTestId(TESTIDS.splitter), by);
    },
    splitRatio: (): number => {
      return Number.parseFloat(
        screen().style.getPropertyValue("--split-ratio"),
      );
    },
    maximizeLabel: (): string => {
      return (
        within(top())
          .getByTestId(TESTIDS.panelMaximize)
          .getAttribute("aria-label") ?? ""
      );
    },
    clickMaximize: async (): Promise<void> => {
      await user.click(within(top()).getByTestId(TESTIDS.panelMaximize));
    },
    maximized: (): string | null => {
      return screen().getAttribute("data-maximized");
    },
    toolLabels: (): string[] => {
      return within(top())
        .getAllByTestId(TESTIDS.toolbarButton)
        .map((button) => {
          return button.getAttribute("aria-label") ?? "";
        });
    },
    clickTool: async (label: string): Promise<void> => {
      await user.click(within(top()).getByRole("button", { name: label }));
    },
    toasts: (): string[] => {
      return rendered.queryAllByTestId(TESTIDS.toast).map((toast) => {
        return toast.querySelector(".toast-text")?.textContent ?? "";
      });
    },
  };
}

/** The screen as the shell draws it, on the real application. */
export interface MountedScreen {
  rendered: RenderResult;
  user: User;
  app: App;
  /** The account the whole app has selected, read back through the view model. */
  selectedKey: () => string;
}

/** Mounts the screen, the toasts and a reader of the app-wide selection over the small books. */
export function mountScreen(): MountedScreen {
  const user = userEvent.setup();
  const { app } = createAppHarness(createSmallSeed());
  let seen: string | undefined;

  function record(key: string): void {
    seen = key;
  }

  const rendered = render(
    <ViewModelProvider viewModel={createViewModel(app)}>
      <ScreenHost />
      <ToastHost />
      <SelectionReader onRead={record} />
    </ViewModelProvider>,
  );

  return {
    rendered,
    user,
    app,
    selectedKey: (): string => {
      if (seen === undefined) {
        throw new Error("missing: what the reader saw");
      }

      return seen;
    },
  };
}

/** Holds the maximize machine as the shell does, and hands it to the screen. */
function ScreenHost(): ReactElement {
  const { useMaximize } = useViewModel();
  const maximize = useMaximize();

  return <AccountsScreen maximize={maximize} />;
}

interface SelectionReaderProps {
  onRead: (key: string) => void;
}

/** Reads the selected account the way any other screen would, and hands over what it read once drawn. */
function SelectionReader({ onRead }: SelectionReaderProps): ReactElement {
  const { useSelectedAccount } = useViewModel();
  const { key } = useSelectedAccount();

  useEffect(() => {
    onRead(key);
  }, [onRead, key]);

  return <span hidden />;
}
