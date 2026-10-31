import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import type { BuildingRow, Contact, LegacySeed } from "@cl/domain";
import { createViewModel, ViewModelProvider } from "@cl/react-bindings";

import { type PanelPage, panelIn } from "../allocation/panelGrid.page.tsx";
import { AppRoot } from "../shell/AppRoot.tsx";
import { dragSplitterElement } from "../shell/Splitter.page.tsx";
import { TESTIDS } from "../testids.ts";
import {
  type UnitsDialogPage,
  unitsDialogIn,
} from "../units/UnitsDialog.page.tsx";

/** What a test can do with, and ask of, the Building Data & Suppliers screen. */
export interface BuildingDataScreenPage {
  /** The Building Data panel: its title, its grid and its tools. */
  data: PanelPage;
  /** The panel header's meta: the count of buildings. */
  meta: () => string;
  /** The words of the Type column's icon on the row with this label. */
  typeOf: (label: string) => string;
  /** Whether the row's Closed box is ticked; null on a row with none. */
  closedOf: (label: string) => boolean | null;
  /** Whether the grid draws the row with this label on the zebra background. */
  isZebra: (label: string) => boolean;
  /** The items of the open Add menu; none while it is closed. */
  menuItems: () => string[];
  chooseMenuItem: (label: string) => Promise<void>;
  /** Closes the open Add menu with Escape, choosing nothing. */
  closeMenu: () => Promise<void>;
  /** The bottom panel: its tools, and the suppliers' grid while that tab is in front. */
  tabs: PanelPage;
  activeTab: () => string;
  activateTab: (name: string) => Promise<void>;
  /** What the bottom panel says in place of a building or a supplier; null while it shows one. */
  hint: () => string | null;
  /** The value the bottom panel's sheet (the profile, or the supplier's) shows for this label. */
  sheetValue: (label: string) => string;
  /** The legends of the sheet's fieldsets, in order. */
  sheetGroups: () => string[];
  /** The building's NOTES. */
  profileNotes: () => string;
  /** The sidebar's selected period, as it is labelled there. */
  sidebarPeriod: () => string | null;
  /** The sidebar's ✎: Edit Management / Period. */
  clickSidebarEdit: () => Promise<void>;
  /** The label of the grid's row with this key (a building or a period id). */
  labelOf: (key: string) => string;
  /** The selected building's supplier at this place in the list: a test never spells a name. */
  supplierAt: (index: number) => Contact;
  toasts: () => string[];
  /** Which panel fills the screen: top or none. */
  maximized: () => string | null;
  clickMaximize: () => Promise<void>;
  /** The Building Data panel's share of the height, as written for the stylesheet. */
  splitRatio: () => number;
  /** Drags the splitter between the panels on a screen of the given height. */
  dragSplitter: (by: number, screenHeight: number) => void;
  /** The suppliers' list's share of the width, as written for the stylesheet. */
  suppliersRatio: () => number;
  /** Drags the splitter between the suppliers' list and the sheet, on a tab of the given width. */
  dragSuppliersSplitter: (by: number, width: number) => void;
  /** The Edit Building or Edit Management / Period dialog. */
  dialog: UnitsDialogPage;
  /** The Address dialog over it. */
  addressDialog: UnitsDialogPage;
}

/**
 * Mounts the shell on Building Data & Suppliers over the real seed, or a
 * variant of it, on this period (p1 Saturno 2011, p36 Pozzetto 2013). The
 * screen reads every period's books, so the small seed, with no Liquidity
 * or Funds account, cannot stand in.
 */
export function mountBuildingData(
  periodId: string,
  seed?: LegacySeed,
): BuildingDataScreenPage {
  const user = userEvent.setup();
  const { app } = createAppHarness(seed);

  app.presenters.buildings.selectPeriod(periodId);
  app.navigation.intents.selectMenu("data");

  const rendered = render(
    <ViewModelProvider viewModel={createViewModel(app)}>
      <AppRoot />
    </ViewModelProvider>,
  );

  function screen(): HTMLElement {
    return rendered.getByTestId(TESTIDS.buildingDataScreen);
  }

  function panel(): HTMLElement {
    return within(screen()).getByTestId(TESTIDS.buildingDataPanel);
  }

  function tabs(): HTMLElement {
    return within(screen()).getByTestId(TESTIDS.buildingTabs);
  }

  function rowOf(label: string): HTMLElement {
    const row = within(panel())
      .queryAllByTestId(TESTIDS.treeGridRow)
      .find((candidate) => {
        return (
          candidate.querySelector(".tree-grid-text")?.textContent === label
        );
      });

    if (row === undefined) {
      throw new Error(`No row labelled ${label}`);
    }

    return row;
  }

  function sheetRow(label: string): HTMLElement {
    const row = within(tabs())
      .getAllByTestId(TESTIDS.schedaRow)
      .find((candidate) => {
        return candidate.querySelector(".scheda-label")?.textContent === label;
      });

    if (row === undefined) {
      throw new Error(`No sheet row labelled ${label}`);
    }

    return row;
  }

  function suppliers(): HTMLElement {
    return within(tabs()).getByTestId(TESTIDS.buildingSuppliers);
  }

  return {
    data: panelIn(panel, user),
    meta: (): string => {
      return panel().querySelector(".panel-meta")?.textContent ?? "";
    },
    typeOf: (label: string): string => {
      return (
        within(rowOf(label))
          .getByTestId(TESTIDS.buildingTypeIcon)
          .getAttribute("title") ?? ""
      );
    },
    closedOf: (label: string): boolean | null => {
      const box = within(rowOf(label)).queryByRole<HTMLInputElement>(
        "checkbox",
        { name: "Closed" },
      );

      return box === null ? null : box.checked;
    },
    isZebra: (label: string): boolean => {
      return rowOf(label).getAttribute("data-zebra") === "true";
    },
    menuItems: (): string[] => {
      return within(panel())
        .queryAllByTestId(TESTIDS.menuItem)
        .map((item) => {
          return item.textContent ?? "";
        });
    },
    chooseMenuItem: async (label: string): Promise<void> => {
      await user.click(within(panel()).getByRole("menuitem", { name: label }));
    },
    closeMenu: async (): Promise<void> => {
      await user.keyboard("{Escape}");
    },
    tabs: panelIn(tabs, user),
    activeTab: (): string => {
      return (
        within(tabs()).getByRole("tab", { selected: true }).textContent ?? ""
      );
    },
    activateTab: async (name: string): Promise<void> => {
      await user.click(within(tabs()).getByRole("tab", { name }));
    },
    hint: (): string | null => {
      return (
        within(tabs()).queryByTestId(TESTIDS.buildingSelectHint)?.textContent ??
        null
      );
    },
    sheetValue: (label: string): string => {
      return sheetRow(label).querySelector(".scheda-value")?.textContent ?? "";
    },
    sheetGroups: (): string[] => {
      return Array.from(tabs().querySelectorAll("legend")).map((legend) => {
        return legend.textContent ?? "";
      });
    },
    profileNotes: (): string => {
      return (
        within(tabs())
          .getByRole("group", { name: "NOTES" })
          .querySelector(".building-profile-notes")?.textContent ?? ""
      );
    },
    sidebarPeriod: (): string | null => {
      const selected = within(rendered.getByTestId(TESTIDS.sidebar))
        .queryAllByRole("treeitem")
        .find((item) => {
          return (
            item.getAttribute("aria-level") === "2" &&
            item.getAttribute("aria-selected") === "true"
          );
        });

      return (
        selected?.querySelector(".buildings-tree-label")?.textContent ?? null
      );
    },
    clickSidebarEdit: async (): Promise<void> => {
      await user.click(
        within(rendered.getByTestId(TESTIDS.sidebar)).getByRole("button", {
          name: "Edit management",
        }),
      );
    },
    labelOf: (key: string): string => {
      const found = findRow(
        app.presenters.buildingData.view$.getValue().rows,
        key,
      );

      if (found === null) {
        throw new Error(`No row for ${key}`);
      }

      return found.label;
    },
    supplierAt: (index: number): Contact => {
      const supplier =
        app.presenters.buildingData.view$.getValue().suppliers[index];

      if (supplier === undefined) {
        throw new Error(`No supplier at ${index}`);
      }

      return supplier;
    },
    toasts: (): string[] => {
      return rendered.queryAllByTestId(TESTIDS.toast).map((toast) => {
        return toast.querySelector(".toast-text")?.textContent ?? "";
      });
    },
    maximized: (): string | null => {
      return screen().getAttribute("data-maximized");
    },
    clickMaximize: async (): Promise<void> => {
      await user.click(within(panel()).getByTestId(TESTIDS.panelMaximize));
    },
    splitRatio: (): number => {
      return Number.parseFloat(
        screen().style.getPropertyValue("--split-ratio"),
      );
    },
    dragSplitter: (by: number, screenHeight: number): void => {
      screen().getBoundingClientRect = (): DOMRect => {
        return { height: screenHeight } as DOMRect;
      };

      const splitter = Array.from(screen().children).find((child) => {
        return child.getAttribute("data-testid") === TESTIDS.splitter;
      });

      if (!(splitter instanceof HTMLElement)) {
        throw new Error("missing: the splitter between the panels");
      }

      dragSplitterElement(splitter, [by]);
    },
    suppliersRatio: (): number => {
      return Number.parseFloat(
        suppliers().style.getPropertyValue("--suppliers-split"),
      );
    },
    dragSuppliersSplitter: (by: number, width: number): void => {
      suppliers().getBoundingClientRect = (): DOMRect => {
        return { width } as DOMRect;
      };

      dragSplitterElement(within(suppliers()).getByTestId(TESTIDS.splitter), [
        by,
      ]);
    },
    dialog: unitsDialogIn(() => {
      return rendered.container;
    }, user),
    addressDialog: unitsDialogIn(
      () => {
        return rendered.container;
      },
      user,
      "stacked",
    ),
  };
}

function findRow(rows: BuildingRow[], key: string): BuildingRow | null {
  for (const row of rows) {
    if (row.key === key) {
      return row;
    }

    const found = findRow(row.children, key);

    if (found !== null) {
      return found;
    }
  }

  return null;
}
