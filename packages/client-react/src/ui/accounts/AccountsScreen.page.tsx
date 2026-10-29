import { act, type RenderResult, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactElement, useEffect } from "react";

import type { App } from "@cl/client-core";
import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import {
  type AccountsPort,
  type Cents,
  type Result,
  rejected,
} from "@cl/domain";
import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";
import {
  createViewModel,
  useViewModel,
  ViewModelProvider,
} from "@cl/react-bindings";

import { AmountLocaleProvider } from "../AmountLocaleProvider.tsx";
import { dragSplitterElement } from "../shell/Splitter.page.tsx";
import { ToastHost } from "../shell/ToastHost.tsx";
import { resizeColumnIn } from "../TreeGrid.page.tsx";
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
  /** Presses on the splitter, moves to each position in turn (each measured from the press), and lets go, on a screen of the given height. */
  dragSplitterThrough: (steps: number[], screenHeight?: number) => void;
  /** The top panel's share, as written for the stylesheet. */
  splitRatio: () => number;
  maximizeLabel: () => string;
  clickMaximize: () => Promise<void>;
  /** Which panel fills the screen: top, bottom or none. */
  maximized: () => string | null;
  toolLabels: () => string[];
  clickTool: (label: string) => Promise<void>;
  toasts: () => string[];
  /** Clicks the chart of accounts' row with this label: the account the whole app selects. */
  clickAccount: (label: string) => Promise<void>;
  /** Opens or closes the chart of accounts' row with this label. */
  clickAccountCaret: (label: string) => Promise<void>;
  /** The Ledger tab's lines, each as its cells' texts. */
  ledgerRows: () => string[][];
  /** The chart of accounts' rows, by label, in order. */
  chartLabels: () => string[];
  /** The chart of accounts' column layout, as written for the stylesheet. */
  chartTemplate: () => string;
  /** Drags the chart's boundary on the right of column `index` to the given width. */
  resizeChartColumn: (index: number, toPx: number) => void;
  /** The Ledger tab's column layout, as written for the stylesheet. */
  ledgerTemplate: () => string;
  /** Drags the Ledger tab's boundary on the right of column `index` to the given width. */
  resizeLedgerColumn: (index: number, toPx: number) => void;
}

/** Mounts the Accounts screen over the small books, with the toasts its stubs post. */
export function mountAccountsScreen(): AccountsScreenPage {
  return accountsScreenIn(mountScreen());
}

/** What a mounted page holds for a page object: what it drew, and the person at the keyboard. */
interface Drawn {
  rendered: RenderResult;
  user: User;
}

/** The Accounts screen wherever it is drawn: on its own, or in the shell another page object mounted. */
export function accountsScreenIn({
  rendered,
  user,
}: Drawn): AccountsScreenPage {
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

  function rowTexts(panel: HTMLElement): string[][] {
    return within(panel)
      .queryAllByTestId(TESTIDS.treeGridRow)
      .map((row) => {
        return Array.from(row.children).map((cell) => {
          return cell.textContent ?? "";
        });
      });
  }

  function accountRow(label: string): HTMLElement {
    const row = within(top())
      .queryAllByTestId(TESTIDS.treeGridRow)
      .find((candidate) => {
        return (
          candidate.querySelector(".tree-grid-text")?.textContent === label
        );
      });

    if (row === undefined) {
      throw new Error(`No account labelled ${label}`);
    }

    return row;
  }

  function templateIn(panel: HTMLElement): string {
    return within(panel)
      .getByTestId(TESTIDS.treeGrid)
      .style.getPropertyValue("--tree-grid-template");
  }

  function dragThrough(steps: number[], screenHeight: number): void {
    screen().getBoundingClientRect = (): DOMRect => {
      return { height: screenHeight } as DOMRect;
    };

    dragSplitterElement(within(screen()).getByTestId(TESTIDS.splitter), steps);
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
      dragThrough([by], screenHeight);
    },
    dragSplitterThrough: (steps: number[], screenHeight = 600): void => {
      dragThrough(steps, screenHeight);
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
    clickAccount: async (label: string): Promise<void> => {
      await user.click(accountRow(label));
    },
    clickAccountCaret: async (label: string): Promise<void> => {
      await user.click(
        within(accountRow(label)).getByTestId(TESTIDS.treeGridCaret),
      );
    },
    ledgerRows: (): string[][] => {
      return rowTexts(bottom());
    },
    chartLabels: (): string[] => {
      return within(top())
        .queryAllByTestId(TESTIDS.treeGridRow)
        .map((row) => {
          return row.querySelector(".tree-grid-text")?.textContent ?? "";
        });
    },
    chartTemplate: (): string => {
      return templateIn(top());
    },
    resizeChartColumn: (index: number, toPx: number): void => {
      resizeColumnIn(top(), index, toPx);
    },
    ledgerTemplate: (): string => {
      return templateIn(bottom());
    },
    resizeLedgerColumn: (index: number, toPx: number): void => {
      resizeColumnIn(bottom(), index, toPx);
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
  /** The budget writes that reached the accounts store. */
  budgetWrites: BudgetWrites;
}

/** Counts the budget writes that reach the accounts store, can hold their answers back, and can have the store refuse them. */
interface BudgetWrites {
  count: () => number;
  /** From now on, a write is saved at once but its verdict waits for release. */
  hold: () => void;
  /** Hands every held verdict back, and stops holding. */
  release: () => Promise<void>;
  /** From now on, the store refuses every write with this reason and saves nothing. */
  refuse: (reason: string) => void;
}

/** Mounts the screen, the toasts and a reader of the app-wide selection over the small books. */
export function mountScreen(): MountedScreen {
  const user = userEvent.setup();
  const { app, ports } = createAppHarness(createSmallSeed());
  const budgetWrites = recordBudgetWrites(ports.accounts);
  let seen: string | undefined;

  function record(key: string): void {
    seen = key;
  }

  const rendered = render(
    <ViewModelProvider viewModel={createViewModel(app)}>
      <AmountLocaleProvider>
        <ScreenHost />
        <ToastHost />
        <SelectionReader onRead={record} />
      </AmountLocaleProvider>
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
    budgetWrites,
  };
}

/** Wraps the simulator's budget write: counted, its verdict held back while asked to, refused when told to. */
function recordBudgetWrites(accounts: AccountsPort): BudgetWrites {
  const save = accounts.setBudget.bind(accounts);
  const waiting: (() => void)[] = [];
  let count = 0;
  let holding = false;
  let refusal: string | null = null;

  accounts.setBudget = async (
    accountId: string,
    budget: Cents,
  ): Promise<Result> => {
    count += 1;
    const result =
      refusal === null ? await save(accountId, budget) : rejected(refusal);

    if (holding) {
      await new Promise<void>((resolve) => {
        waiting.push(resolve);
      });
    }

    return result;
  };

  return {
    count: (): number => {
      return count;
    },
    hold: (): void => {
      holding = true;
    },
    refuse: (reason: string): void => {
      refusal = reason;
    },
    release: async (): Promise<void> => {
      holding = false;
      await act(async () => {
        for (const resolve of waiting.splice(0)) {
          resolve();
        }

        await Promise.resolve();
      });
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
