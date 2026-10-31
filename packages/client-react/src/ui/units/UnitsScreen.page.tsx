import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import type { Contact, LegacySeed, OwnersRow, UnitsRow } from "@cl/domain";
import { createViewModel, ViewModelProvider } from "@cl/react-bindings";

import { type PanelPage, panelIn } from "../allocation/panelGrid.page.tsx";
import { AppRoot } from "../shell/AppRoot.tsx";
import { dragSplitterElement } from "../shell/Splitter.page.tsx";
import { TESTIDS } from "../testids.ts";
import { type UnitsDialogPage, unitsDialogIn } from "./UnitsDialog.page.tsx";

/** What a test can do with, and ask of, the Units, Owners & Personal Balance screen. */
export interface UnitsScreenPage {
  /** The Units panel: its title, its grid and its tools. */
  units: PanelPage;
  /** The panel header's meta: the count of units. */
  meta: () => string;
  /** The tooltip of the Units grid's header with this text; null when it has none. */
  headerTooltip: (header: string) => string | null;
  /** Whether the Units grid draws the row with this label on the zebra background. */
  isZebra: (label: string) => boolean;
  /** The grid row's icon. */
  iconOf: (label: string) => string;
  groupBy: () => string;
  /** The items of the open Add menu; none while it is closed. */
  menuItems: () => string[];
  chooseMenuItem: (label: string) => Promise<void>;
  isMenuItemDisabled: (label: string) => boolean;
  /** Closes the open Add menu with Escape, choosing nothing. */
  closeMenu: () => Promise<void>;
  /** The bottom panel's tools and its Unit Owners grid, when that tab is in front. */
  tabs: PanelPage;
  activeTab: () => string;
  activateTab: (name: string) => Promise<void>;
  /** What the bottom panel says in place of a unit; null while it shows one. */
  hint: () => string | null;
  /** The Unit Profile's value for this label. */
  profileValue: (label: string) => string;
  /** The Unit Profile's NOTES. */
  profileNotes: () => string;
  /** The legends of the Unit Profile's fieldsets, in order. */
  profileGroups: () => string[];
  /** Whether the Unit Owners grid draws the row with this label on the zebra background. */
  isOwnersZebra: (label: string) => boolean;
  /** The % Share bar's fill of the Unit Owners row with this label, as written for the stylesheet. */
  shareFillOf: (label: string) => string;
  /** The crumbs, joined as the bar shows them. */
  breadcrumb: () => string;
  /** The crumb drawn as the current place. */
  currentCrumb: () => string;
  /** The label of the Units grid's row with this key: a test never spells a person's name. */
  labelOf: (key: string) => string;
  /** The label of the resident's row in the selected unit's Unit Owners tab. */
  ownerLabelOf: (residentId: string) => string;
  toasts: () => string[];
  /** Which panel fills the screen: top or none. */
  maximized: () => string | null;
  clickMaximize: () => Promise<void>;
  /** The Units panel's share of the height, as written for the stylesheet. */
  splitRatio: () => number;
  /** Drags the splitter between the panels on a screen of the given height. */
  dragSplitter: (by: number, screenHeight: number) => void;
  /** The group, unit or owner dialog over the screen. */
  dialog: UnitsDialogPage;
  /** The Address dialog over the group dialog. */
  addressDialog: UnitsDialogPage;
  /** The question asked before a delete; null while none is asked. */
  confirmText: () => string | null;
  /** Why the delete did not go through, under the question; null when nothing failed. */
  confirmError: () => string | null;
  confirmYes: () => Promise<void>;
  confirmNo: () => Promise<void>;
  /** A contact's name, by its id: a test never spells a person's name. */
  contactName: (contactId: string) => string;
}

/**
 * Mounts the shell on Units, Owners & Personal Balance over the real seed, on
 * this period (p1 Saturno 2011, p36 Pozzetto 2013), or over the seed given on
 * its first period, if it has one.
 */
export function mountUnits(
  periodId: string | null,
  seed?: LegacySeed,
): UnitsScreenPage {
  const user = userEvent.setup();
  const { app } = createAppHarness(seed);

  if (periodId !== null) {
    app.presenters.buildings.selectPeriod(periodId);
  }

  app.navigation.intents.selectMenu("units");

  const rendered = render(
    <ViewModelProvider viewModel={createViewModel(app)}>
      <AppRoot />
    </ViewModelProvider>,
  );

  function screen(): HTMLElement {
    return rendered.getByTestId(TESTIDS.unitsScreen);
  }

  function unitsPanel(): HTMLElement {
    return within(screen()).getByTestId(TESTIDS.unitsPanel);
  }

  function unitTabs(): HTMLElement {
    return within(screen()).getByTestId(TESTIDS.unitTabs);
  }

  function rowIn(root: HTMLElement, label: string): HTMLElement {
    const row = within(root)
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

  function profileRow(label: string): HTMLElement {
    const row = within(unitTabs())
      .getAllByTestId(TESTIDS.schedaRow)
      .find((candidate) => {
        return candidate.querySelector(".scheda-label")?.textContent === label;
      });

    if (row === undefined) {
      throw new Error(`No profile row labelled ${label}`);
    }

    return row;
  }

  function crumbs(): HTMLElement[] {
    return Array.from(
      rendered
        .getByTestId(TESTIDS.breadcrumb)
        .querySelectorAll<HTMLElement>(".breadcrumb-item"),
    );
  }

  function view(): ShownUnits {
    const shown = app.presenters.units.view$.getValue();

    if (shown === null) {
      throw new Error("missing: the units view");
    }

    return { root: shown.list.root, owners: shown.owners };
  }

  return {
    units: panelIn(unitsPanel, user),
    meta: (): string => {
      return unitsPanel().querySelector(".panel-meta")?.textContent ?? "";
    },
    headerTooltip: (header: string): string | null => {
      const found = within(unitsPanel())
        .getAllByRole("columnheader")
        .find((candidate) => {
          return candidate.textContent === header;
        });

      if (found === undefined) {
        throw new Error(`No header ${header}`);
      }

      return found.getAttribute("title");
    },
    isZebra: (label: string): boolean => {
      return rowIn(unitsPanel(), label).getAttribute("data-zebra") === "true";
    },
    iconOf: (label: string): string => {
      return (
        rowIn(unitsPanel(), label).querySelector(".tree-grid-icon")
          ?.textContent ?? ""
      );
    },
    groupBy: (): string => {
      return (
        within(unitsPanel()).getByTestId(TESTIDS.unitsGroupBy).textContent ?? ""
      );
    },
    menuItems: (): string[] => {
      return within(unitsPanel())
        .queryAllByTestId(TESTIDS.menuItem)
        .map((item) => {
          return item.textContent ?? "";
        });
    },
    chooseMenuItem: async (label: string): Promise<void> => {
      await user.click(
        within(unitsPanel()).getByRole("menuitem", { name: label }),
      );
    },
    isMenuItemDisabled: (label: string): boolean => {
      return within(unitsPanel())
        .getByRole<HTMLButtonElement>("menuitem", { name: label })
        .hasAttribute("disabled");
    },
    closeMenu: async (): Promise<void> => {
      await user.keyboard("{Escape}");
    },
    tabs: panelIn(unitTabs, user),
    activeTab: (): string => {
      return (
        within(unitTabs()).getByRole("tab", { selected: true }).textContent ??
        ""
      );
    },
    activateTab: async (name: string): Promise<void> => {
      await user.click(within(unitTabs()).getByRole("tab", { name }));
    },
    hint: (): string | null => {
      return (
        within(unitTabs()).queryByTestId(TESTIDS.unitsSelectHint)
          ?.textContent ?? null
      );
    },
    profileValue: (label: string): string => {
      return (
        profileRow(label).querySelector(".scheda-value")?.textContent ?? ""
      );
    },
    profileNotes: (): string => {
      return (
        within(unitTabs())
          .getByRole("group", { name: "NOTES" })
          .querySelector(".units-notes")?.textContent ?? ""
      );
    },
    profileGroups: (): string[] => {
      return Array.from(unitTabs().querySelectorAll("legend")).map((legend) => {
        return legend.textContent ?? "";
      });
    },
    isOwnersZebra: (label: string): boolean => {
      return rowIn(unitTabs(), label).getAttribute("data-zebra") === "true";
    },
    shareFillOf: (label: string): string => {
      const bar = within(rowIn(unitTabs(), label)).getByTestId(
        TESTIDS.shareBar,
      );

      return bar.style.getPropertyValue("--share-fill");
    },
    breadcrumb: (): string => {
      return crumbs()
        .map((crumb) => {
          return crumb.textContent ?? "";
        })
        .join(" › ");
    },
    currentCrumb: (): string => {
      return (
        crumbs().find((crumb) => {
          return crumb.getAttribute("aria-current") === "page";
        })?.textContent ?? ""
      );
    },
    labelOf: (key: string): string => {
      return labelIn([view().root], key);
    },
    ownerLabelOf: (residentId: string): string => {
      const { owners } = view();

      return labelIn(owners === null ? [] : [owners], `resident:${residentId}`);
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
      await user.click(within(unitsPanel()).getByTestId(TESTIDS.panelMaximize));
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

      dragSplitterElement(within(screen()).getByTestId(TESTIDS.splitter), [by]);
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
    confirmText: (): string | null => {
      return rendered.queryByTestId(TESTIDS.confirmText)?.textContent ?? null;
    },
    confirmError: (): string | null => {
      return rendered.queryByTestId(TESTIDS.confirmError)?.textContent ?? null;
    },
    confirmYes: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.confirmYes));
    },
    confirmNo: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.confirmNo));
    },
    contactName: (contactId: string): string => {
      let contacts: Contact[] = [];

      // The simulator answers at once, whether or not the screen reads the contacts yet.
      app.presenters.units.contacts$
        .subscribe((all) => {
          contacts = all;
        })
        .unsubscribe();

      const contact = contacts.find((candidate) => {
        return candidate.id === contactId;
      });

      if (contact === undefined) {
        throw new Error(`No contact ${contactId}`);
      }

      return contact.name;
    },
  };
}

/** What the screen shows, read back through the presenter: the Units grid's root and the selected unit's owners. */
interface ShownUnits {
  root: UnitsRow;
  owners: OwnersRow | null;
}

/** A row of the Units grid or of the Unit Owners tab: a key, a label and the rows under it. */
type Labelled = UnitsRow | OwnersRow;

/** The label of the row with this key, wherever it is in the trees. */
function labelIn(rows: Labelled[], key: string): string {
  const found = findLabel(rows, key);

  if (found === null) {
    throw new Error(`No row for ${key}`);
  }

  return found;
}

function findLabel(rows: Labelled[], key: string): string | null {
  for (const row of rows) {
    if (row.key === key) {
      return row.label;
    }

    const children: Labelled[] = row.children;
    const found = findLabel(children, key);

    if (found !== null) {
      return found;
    }
  }

  return null;
}
