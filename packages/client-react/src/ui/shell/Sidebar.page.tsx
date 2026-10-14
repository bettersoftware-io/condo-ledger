import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactElement, useEffect } from "react";

import type { App } from "@cl/client-core";
import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import type { LegacySeed } from "@cl/domain";
import { createTwoPeriodSeed } from "@cl/domain/testing/createTwoPeriodSeed.ts";
import {
  createViewModel,
  useViewModel,
  ViewModelProvider,
} from "@cl/react-bindings";

import { TESTIDS } from "../testids.ts";
import { AppRoot } from "./AppRoot.tsx";
import { dragSplitterElement } from "./Splitter.page.tsx";

/** What a test can do with, and ask of, the Buildings sidebar. */
export interface SidebarPage {
  buildingLabels: () => string[];
  periodLabels: () => string[];
  /** The period row drawn as selected. */
  selectedPeriod: () => string | null;
  clickPeriod: (label: string) => Promise<void>;
  toggleBuilding: (label: string) => Promise<void>;
  /** The period the whole app has selected, read back through the view model. */
  appPeriodId: () => string | null;
  menuLabels: () => string[];
  activeMenu: () => string | null;
  clickMenu: (label: string) => Promise<void>;
  /** The menu item the whole app is on, read back through the view model. */
  appMenu: () => string;
  clickTool: (label: string) => Promise<void>;
  toasts: () => string[];
  dragSplitter: (by: number) => void;
  /** Presses on the splitter, moves to each position in turn (each measured from the press), and lets go. */
  dragSplitterThrough: (steps: number[]) => void;
  /** The sidebar's width in pixels, as written for the stylesheet. */
  width: () => number;
  hasSidebar: () => boolean;
  isMaximized: () => boolean;
  clickRail: () => Promise<void>;
  clickScrim: () => Promise<void>;
  isDrawerOpen: () => boolean;
  /** The title of the main area's first panel: the screen the person is on. */
  screenTitle: () => string;
  /** Clicks the maximize button of the main area's first panel. */
  maximizePanel: () => Promise<void>;
  /** Which panel of the Accounts screen fills it: top, bottom or none. */
  accountsMaximized: () => string | null;
}

export interface SidebarOptions {
  /** Start with a panel of the main area maximized, as the screen would leave it. */
  maximized?: boolean;
  /** The books the app runs on; a building with two periods unless given. */
  seed?: LegacySeed;
}

/** Mounts the shell over a building with two periods, with a reader of the app-wide selection and navigation. */
export function mountSidebar(options: SidebarOptions = {}): SidebarPage {
  const user = userEvent.setup();
  const app = maximizedFromTheStart(
    createAppHarness(options.seed ?? createTwoPeriodSeed()).app,
    options.maximized ?? false,
  );
  let seen: SeenState | undefined;

  function record(state: SeenState): void {
    seen = state;
  }

  const rendered = render(
    <ViewModelProvider viewModel={createViewModel(app)}>
      <AppRoot />
      <SelectionReader onRead={record} />
    </ViewModelProvider>,
  );

  function sidebar(): HTMLElement {
    return rendered.getByTestId(TESTIDS.sidebar);
  }

  function labelsOf(level: string): HTMLElement[] {
    return Array.from(
      sidebar().querySelectorAll<HTMLElement>(
        `[role="treeitem"][aria-level="${level}"]`,
      ),
    );
  }

  function textOf(element: HTMLElement): string {
    return element.querySelector(".buildings-tree-label")?.textContent ?? "";
  }

  function rowOf(level: string, label: string): HTMLElement {
    const row = labelsOf(level).find((candidate) => {
      return textOf(candidate) === label;
    });

    if (row === undefined) {
      throw new Error(`No row labelled ${label}`);
    }

    return row;
  }

  function menuItems(): HTMLElement[] {
    return Array.from(
      sidebar().querySelectorAll<HTMLElement>(".management-menu-item"),
    );
  }

  function sidebarSplitter(): HTMLElement {
    const splitter = rendered
      .getAllByTestId(TESTIDS.splitter)
      .find((candidate) => {
        return candidate.getAttribute("data-direction") === "vertical";
      });

    if (splitter === undefined) {
      throw new Error("missing: the sidebar's splitter");
    }

    return splitter;
  }

  function main(): HTMLElement {
    return rendered.getByTestId(TESTIDS.appMain);
  }

  function read(): SeenState {
    if (seen === undefined) {
      throw new Error("missing: what the reader saw");
    }

    return seen;
  }

  return {
    buildingLabels: (): string[] => {
      return labelsOf("1").map(textOf);
    },
    periodLabels: (): string[] => {
      return labelsOf("2").map(textOf);
    },
    selectedPeriod: (): string | null => {
      const selected = labelsOf("2").find((row) => {
        return row.getAttribute("aria-selected") === "true";
      });

      return selected === undefined ? null : textOf(selected);
    },
    clickPeriod: async (label: string): Promise<void> => {
      await user.click(rowOf("2", label));
    },
    toggleBuilding: async (label: string): Promise<void> => {
      await user.click(rowOf("1", label));
    },
    appPeriodId: (): string | null => {
      return read().periodId;
    },
    menuLabels: (): string[] => {
      return menuItems().map((item) => {
        return item.querySelector(".management-menu-label")?.textContent ?? "";
      });
    },
    activeMenu: (): string | null => {
      const active = menuItems().find((item) => {
        return item.getAttribute("aria-current") === "page";
      });

      return (
        active?.querySelector(".management-menu-label")?.textContent ?? null
      );
    },
    clickMenu: async (label: string): Promise<void> => {
      await user.click(within(sidebar()).getByRole("button", { name: label }));
    },
    appMenu: (): string => {
      return read().menu;
    },
    clickTool: async (label: string): Promise<void> => {
      await user.click(within(sidebar()).getByRole("button", { name: label }));
    },
    toasts: (): string[] => {
      return rendered.queryAllByTestId(TESTIDS.toast).map((toast) => {
        return toast.querySelector(".toast-text")?.textContent ?? "";
      });
    },
    dragSplitter: (by: number): void => {
      dragSplitterElement(sidebarSplitter(), [by]);
    },
    dragSplitterThrough: (steps: number[]): void => {
      dragSplitterElement(sidebarSplitter(), steps);
    },
    width: (): number => {
      return Number.parseFloat(
        sidebar().style.getPropertyValue("--sidebar-width"),
      );
    },
    hasSidebar: (): boolean => {
      return rendered.queryByTestId(TESTIDS.sidebar) !== null;
    },
    isMaximized: (): boolean => {
      return (
        rendered.container
          .querySelector(".app-body")
          ?.getAttribute("data-maximized") === "true"
      );
    },
    clickRail: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.rail));
    },
    clickScrim: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.drawerScrim));
    },
    isDrawerOpen: (): boolean => {
      return sidebar().getAttribute("data-open") === "true";
    },
    screenTitle: (): string => {
      return (
        within(main()).getAllByTestId(TESTIDS.panelTitle)[0]?.textContent ?? ""
      );
    },
    maximizePanel: async (): Promise<void> => {
      const [button] = within(main()).getAllByTestId(TESTIDS.panelMaximize);

      if (button === undefined) {
        throw new Error("missing: a panel's maximize button");
      }

      await user.click(button);
    },
    accountsMaximized: (): string | null => {
      return (
        within(main())
          .queryByTestId(TESTIDS.accountsScreen)
          ?.getAttribute("data-maximized") ?? null
      );
    },
  };
}

interface SeenState {
  periodId: string | null;
  menu: string;
}

interface SelectionReaderProps {
  onRead: (state: SeenState) => void;
}

/** Reads the selection and the navigation the way any screen would, and hands over what it read once drawn. */
function SelectionReader({ onRead }: SelectionReaderProps): ReactElement {
  const { useSelectedPeriod, useNavigation } = useViewModel();
  const { selected } = useSelectedPeriod();
  const navigation = useNavigation();
  const periodId = selected?.periodId ?? null;
  const menu = navigation.state.menu;

  useEffect(() => {
    onRead({ periodId, menu });
  }, [onRead, periodId, menu]);

  return <span hidden />;
}

/** The app, with every maximize machine it builds already holding a maximized panel, set through its own intent. */
function maximizedFromTheStart(app: App, maximized: boolean): App {
  if (!maximized) {
    return app;
  }

  return {
    ...app,
    machines: {
      ...app.machines,
      createMaximize: () => {
        const machine = app.machines.createMaximize();
        machine.intents.toggle("top");

        return machine;
      },
    },
  };
}
