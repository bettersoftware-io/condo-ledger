import { act, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import { type LegacySeed, nameOf } from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";
import { createViewModel, ViewModelProvider } from "@cl/react-bindings";

import { type FormDialogPage, formDialogIn } from "../FormDialog.page.tsx";
import { AppRoot } from "../shell/AppRoot.tsx";
import { dragSplitterElement } from "../shell/Splitter.page.tsx";
import { TESTIDS } from "../testids.ts";

/** The flag drawn for a language, and the language's name as its tooltip. */
interface LanguageShown {
  flag: string;
  name: string | null;
}

/** What the St. cell shows: the status it names, and whether it draws an icon. */
interface StatusShown {
  status: string | null;
  hasIcon: boolean;
}

/** What a test can do with, and ask of, the Filter Contacts card. */
interface FiltersPage {
  /** The card's title. */
  title: () => string;
  isPersonsTicked: () => boolean;
  isCompaniesTicked: () => boolean;
  togglePersons: () => Promise<void>;
  toggleCompanies: () => Promise<void>;
  keyword: () => string;
  typeKeyword: (text: string) => Promise<void>;
  /** Presses Enter in the Keyword box. */
  pressEnterInKeyword: () => Promise<void>;
  search: () => Promise<void>;
  reset: () => Promise<void>;
  /** The Building select's options, and the one chosen. */
  buildingOptions: () => string[];
  building: () => string;
  chooseBuilding: (label: string) => Promise<void>;
  statusOptions: () => string[];
  status: () => string;
  chooseStatus: (label: string) => Promise<void>;
}

/** What a test can do with, and ask of, the Contact Categories card. */
interface CategoriesPage {
  title: () => string;
  /** Each row as the card draws it: the name, then the count. */
  rows: () => string[][];
  selected: () => string[];
  click: (name: string) => Promise<void>;
  toolLabels: () => string[];
  clickTool: (label: string) => Promise<void>;
  isToolDisabled: (label: string) => boolean;
}

/** What a test can do with, and ask of, the Contact List. */
interface ListPage {
  title: () => string;
  headers: () => string[];
  rowLabels: () => string[];
  /** The row's cells as texts, its name first. */
  rowTexts: (label: string) => string[];
  selectedLabels: () => string[];
  clickRow: (label: string) => Promise<void>;
  emptyMessage: () => string | null;
  /** "Page 1 of 12 · 113 contacts total". */
  pageText: () => string;
  pageSizeText: () => string;
  clickStep: (label: string) => Promise<void>;
  isStepDisabled: (label: string) => boolean;
  choosePageSize: (size: number) => Promise<void>;
  /** Opens the page-size menu; its sizes. */
  openPageSizes: () => Promise<number[]>;
  /** The sizes of the open page-size menu; none while it is closed. */
  pageSizeOptions: () => number[];
  /** The row's St. cell: Active or Archived, and the glyph drawn. */
  statusOf: (label: string) => StatusShown;
  languageOf: (label: string) => LanguageShown;
  toolLabels: () => string[];
  clickTool: (label: string) => Promise<void>;
}

/** What a test can do with, and ask of, the two tabs under the list. */
interface TabsPage {
  active: () => string;
  names: () => string[];
  activate: (name: string) => Promise<void>;
  toolLabels: () => string[];
  clickTool: (label: string) => Promise<void>;
  isToolDisabled: (label: string) => boolean;
  /** The Add menu's items; none once it is closed. */
  openAddMenu: () => Promise<string[]>;
  addMenuItems: () => string[];
  clickMenuItem: (label: string) => Promise<void>;
  /** The legends of the sheet's fieldsets, in order. */
  legends: () => string[];
  /** The sheet's value for this label; inside a fieldset when `legend` says which. */
  value: (label: string, legend?: string) => string;
  /** The lines under a fieldset's legend, other than labelled values. */
  listIn: (legend: string) => string[];
  /** What the sheet says in place of a contact; null while it shows one. */
  hint: () => string | null;
  /** The Connected Contacts grid. */
  connectedHeaders: () => string[];
  connectedRows: () => string[][];
  connectedEmpty: () => string | null;
  /** Clicks the Connected Contacts row with this name. */
  clickConnectedRow: (label: string) => Promise<void>;
  clickLegend: () => Promise<void>;
}

/** What a test can do with, and ask of, the Contacts screen. */
export interface ContactsScreenPage {
  filters: FiltersPage;
  categories: CategoriesPage;
  list: ListPage;
  tabs: TabsPage;
  /** A contact's name, by its id: a test never spells a person's name. */
  contactName: (contactId: string) => string;
  /** The dialog over the screen: the category dialog. */
  dialog: FormDialogPage;
  /** The question before a delete, and why it was refused. */
  confirmText: () => string | null;
  confirmError: () => string | null;
  confirmYes: () => Promise<void>;
  confirmNo: () => Promise<void>;
  /** Edits the only contact of this category into none, through the port, as the screen's own edit will. */
  moveLastContactOut: (categoryName: string) => Promise<void>;
  /** Which panel fills the screen: top or none. */
  maximized: () => string | null;
  clickMaximize: () => Promise<void>;
  /** The list's share of the height, as written for the stylesheet. */
  splitRatio: () => number;
  /** Drags the splitter between the panels on a screen of the given height. */
  dragSplitter: (by: number, screenHeight: number) => void;
  toasts: () => string[];
  /** Presses Escape where the focus is. */
  pressEscape: () => Promise<void>;
  /** The breadcrumb's last crumb. */
  breadcrumb: () => string;
  /** What the rail reads. */
  railText: () => string;
  isDrawerOpen: () => boolean;
  clickRail: () => Promise<void>;
  clickScrim: () => Promise<void>;
  /** The sidebar's width in pixels, as written for the stylesheet. */
  sidebarWidth: () => number;
  dragSidebar: (by: number) => void;
  /** Clicks the top bar's module tab with this label. */
  clickModule: (label: string) => Promise<void>;
  /** Whether the Management sidebar is on screen, by one of its cards. */
  showsManagementSidebar: () => boolean;
}

/** Mounts the shell on the Contacts module over the real seed, or over the seed given. */
export function mountContacts(seed?: LegacySeed): ContactsScreenPage {
  const user = userEvent.setup();
  const harness = createAppHarness(seed);
  const { app } = harness;

  app.navigation.intents.selectModule("contacts");

  const rendered = render(
    <ViewModelProvider viewModel={createViewModel(app)}>
      <AppRoot />
    </ViewModelProvider>,
  );

  function sidebar(): HTMLElement {
    return rendered.getByTestId(TESTIDS.sidebar);
  }

  function filtersCard(): HTMLElement {
    return within(sidebar()).getByTestId(TESTIDS.contactFilters);
  }

  function categoriesCard(): HTMLElement {
    return within(sidebar()).getByTestId(TESTIDS.contactCategories);
  }

  function screen(): HTMLElement {
    return rendered.getByTestId(TESTIDS.contactsScreen);
  }

  function listPanel(): HTMLElement {
    return within(screen()).getByTestId(TESTIDS.contactsPanel);
  }

  function tabsPanel(): HTMLElement {
    return within(screen()).getByTestId(TESTIDS.contactTabs);
  }

  function selectIn(root: HTMLElement, name: string): HTMLSelectElement {
    return within(root).getByRole<HTMLSelectElement>("combobox", { name });
  }

  function optionsOf(select: HTMLSelectElement): string[] {
    return Array.from(select.options).map((option) => {
      return option.textContent ?? "";
    });
  }

  function chosenIn(select: HTMLSelectElement): string {
    return select.selectedOptions[0]?.textContent ?? "";
  }

  function rowOf(root: HTMLElement, label: string): HTMLElement {
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

  function cellsOf(row: HTMLElement): string[] {
    return Array.from(row.children).map((cell) => {
      return cell.textContent ?? "";
    });
  }

  function toolLabelsIn(root: HTMLElement): string[] {
    return within(root)
      .queryAllByTestId(TESTIDS.toolbarButton)
      .map((button) => {
        return button.getAttribute("aria-label") ?? "";
      });
  }

  function toolIn(root: HTMLElement, label: string): HTMLButtonElement {
    return within(root).getByRole<HTMLButtonElement>("button", {
      name: label,
    });
  }

  function sizesShown(): number[] {
    return within(listPanel())
      .queryAllByRole("menuitem")
      .map((item) => {
        return Number(item.textContent);
      });
  }

  function menuItems(): string[] {
    return within(tabsPanel())
      .queryAllByRole("menuitem")
      .map((item) => {
        return item.querySelector(".menu-item-label")?.textContent ?? "";
      });
  }

  function sheetRow(label: string, legend?: string): HTMLElement {
    const scope =
      legend === undefined
        ? tabsPanel()
        : within(tabsPanel()).getByRole("group", { name: legend });

    const row = within(scope)
      .getAllByTestId(TESTIDS.schedaRow)
      .find((candidate) => {
        return candidate.querySelector(".scheda-label")?.textContent === label;
      });

    if (row === undefined) {
      throw new Error(`No sheet row labelled ${label}`);
    }

    return row;
  }

  return {
    filters: {
      title: (): string => {
        return filtersCard().querySelector("header")?.textContent ?? "";
      },
      isPersonsTicked: (): boolean => {
        return within(filtersCard()).getByRole<HTMLInputElement>("checkbox", {
          name: "Natural persons",
        }).checked;
      },
      isCompaniesTicked: (): boolean => {
        return within(filtersCard()).getByRole<HTMLInputElement>("checkbox", {
          name: "Companies",
        }).checked;
      },
      togglePersons: async (): Promise<void> => {
        await user.click(
          within(filtersCard()).getByRole("checkbox", {
            name: "Natural persons",
          }),
        );
      },
      toggleCompanies: async (): Promise<void> => {
        await user.click(
          within(filtersCard()).getByRole("checkbox", { name: "Companies" }),
        );
      },
      keyword: (): string => {
        return within(filtersCard()).getByRole<HTMLInputElement>("textbox", {
          name: "Keyword",
        }).value;
      },
      typeKeyword: async (text: string): Promise<void> => {
        const box = within(filtersCard()).getByRole("textbox", {
          name: "Keyword",
        });

        await user.clear(box);
        await user.type(box, text);
      },
      pressEnterInKeyword: async (): Promise<void> => {
        await user.type(
          within(filtersCard()).getByRole("textbox", { name: "Keyword" }),
          "{Enter}",
        );
      },
      search: async (): Promise<void> => {
        await user.click(
          within(filtersCard()).getByRole("button", { name: /Search/ }),
        );
      },
      reset: async (): Promise<void> => {
        await user.click(
          within(filtersCard()).getByRole("button", { name: /Reset/ }),
        );
      },
      buildingOptions: (): string[] => {
        return optionsOf(selectIn(filtersCard(), "Building"));
      },
      building: (): string => {
        return chosenIn(selectIn(filtersCard(), "Building"));
      },
      chooseBuilding: async (label: string): Promise<void> => {
        await user.selectOptions(selectIn(filtersCard(), "Building"), label);
      },
      statusOptions: (): string[] => {
        return optionsOf(selectIn(filtersCard(), "Status"));
      },
      status: (): string => {
        return chosenIn(selectIn(filtersCard(), "Status"));
      },
      chooseStatus: async (label: string): Promise<void> => {
        await user.selectOptions(selectIn(filtersCard(), "Status"), label);
      },
    },
    categories: {
      title: (): string => {
        return categoriesCard().querySelector("header")?.textContent ?? "";
      },
      rows: (): string[][] => {
        return within(categoriesCard())
          .queryAllByTestId(TESTIDS.contactCategoryRow)
          .map((row) => {
            return Array.from(row.children).map((cell) => {
              return cell.textContent ?? "";
            });
          });
      },
      selected: (): string[] => {
        return within(categoriesCard())
          .queryAllByTestId(TESTIDS.contactCategoryRow)
          .filter((row) => {
            return row.getAttribute("aria-pressed") === "true";
          })
          .map((row) => {
            return row.firstElementChild?.textContent ?? "";
          });
      },
      click: async (name: string): Promise<void> => {
        const row = within(categoriesCard())
          .queryAllByTestId(TESTIDS.contactCategoryRow)
          .find((candidate) => {
            return candidate.firstElementChild?.textContent === name;
          });

        if (row === undefined) {
          throw new Error(`No category named ${name}`);
        }

        await user.click(row);
      },
      toolLabels: (): string[] => {
        return Array.from(
          categoriesCard().querySelectorAll<HTMLElement>(".sidebar-tool"),
        ).map((tool) => {
          return tool.getAttribute("aria-label") ?? "";
        });
      },
      clickTool: async (label: string): Promise<void> => {
        await user.click(
          within(categoriesCard()).getByRole("button", { name: label }),
        );
      },
      isToolDisabled: (label: string): boolean => {
        return within(categoriesCard())
          .getByRole<HTMLButtonElement>("button", { name: label })
          .hasAttribute("disabled");
      },
    },
    list: {
      title: (): string => {
        return (
          within(listPanel()).getByTestId(TESTIDS.panelTitle).textContent ?? ""
        );
      },
      headers: (): string[] => {
        return within(listPanel())
          .getAllByRole("columnheader")
          .map((header) => {
            return header.textContent ?? "";
          });
      },
      rowLabels: (): string[] => {
        return within(listPanel())
          .queryAllByTestId(TESTIDS.treeGridRow)
          .map((row) => {
            return row.querySelector(".tree-grid-text")?.textContent ?? "";
          });
      },
      rowTexts: (label: string): string[] => {
        return cellsOf(rowOf(listPanel(), label));
      },
      selectedLabels: (): string[] => {
        return within(listPanel())
          .queryAllByTestId(TESTIDS.treeGridRow)
          .filter((row) => {
            return row.getAttribute("aria-selected") === "true";
          })
          .map((row) => {
            return row.querySelector(".tree-grid-text")?.textContent ?? "";
          });
      },
      clickRow: async (label: string): Promise<void> => {
        await user.click(rowOf(listPanel(), label));
      },
      emptyMessage: (): string | null => {
        return (
          listPanel().querySelector(".tree-grid-empty")?.textContent ?? null
        );
      },
      pageText: (): string => {
        return (
          within(listPanel()).getByTestId(TESTIDS.pageText).textContent ?? ""
        );
      },
      pageSizeText: (): string => {
        return toolIn(listPanel(), "Page size").textContent ?? "";
      },
      clickStep: async (label: string): Promise<void> => {
        await user.click(toolIn(listPanel(), label));
      },
      isStepDisabled: (label: string): boolean => {
        return toolIn(listPanel(), label).hasAttribute("disabled");
      },
      openPageSizes: async (): Promise<number[]> => {
        await user.click(toolIn(listPanel(), "Page size"));

        return sizesShown();
      },
      pageSizeOptions: (): number[] => {
        return sizesShown();
      },
      choosePageSize: async (size: number): Promise<void> => {
        await user.click(toolIn(listPanel(), "Page size"));
        await user.click(
          within(listPanel()).getByRole("menuitem", { name: String(size) }),
        );
      },
      statusOf: (label: string): StatusShown => {
        const status = within(rowOf(listPanel(), label)).getByTestId(
          TESTIDS.contactStatus,
        );

        return {
          status: status.getAttribute("data-status"),
          hasIcon: status.querySelector("svg") !== null,
        };
      },
      languageOf: (label: string): LanguageShown => {
        const language = within(rowOf(listPanel(), label)).queryByTestId(
          TESTIDS.contactLanguage,
        );

        return {
          flag: language?.textContent ?? "",
          name: language?.getAttribute("title") ?? null,
        };
      },
      toolLabels: (): string[] => {
        return toolLabelsIn(listPanel());
      },
      clickTool: async (label: string): Promise<void> => {
        await user.click(toolIn(listPanel(), label));
      },
    },
    tabs: {
      active: (): string => {
        return (
          within(tabsPanel()).getByRole("tab", { selected: true })
            .textContent ?? ""
        );
      },
      names: (): string[] => {
        return within(tabsPanel())
          .getAllByRole("tab")
          .map((tab) => {
            return tab.textContent ?? "";
          });
      },
      activate: async (name: string): Promise<void> => {
        await user.click(within(tabsPanel()).getByRole("tab", { name }));
      },
      toolLabels: (): string[] => {
        return toolLabelsIn(tabsPanel());
      },
      clickTool: async (label: string): Promise<void> => {
        await user.click(toolIn(tabsPanel(), label));
      },
      isToolDisabled: (label: string): boolean => {
        return toolIn(tabsPanel(), label).hasAttribute("disabled");
      },
      openAddMenu: async (): Promise<string[]> => {
        await user.click(toolIn(tabsPanel(), "Add contact"));

        return menuItems();
      },
      addMenuItems: (): string[] => {
        return menuItems();
      },
      clickMenuItem: async (label: string): Promise<void> => {
        await user.click(
          within(tabsPanel()).getByRole("menuitem", { name: label }),
        );
      },
      legends: (): string[] => {
        return Array.from(tabsPanel().querySelectorAll("legend")).map(
          (legend) => {
            return legend.textContent ?? "";
          },
        );
      },
      value: (label: string, legend?: string): string => {
        return (
          sheetRow(label, legend).querySelector(".scheda-value")?.textContent ??
          ""
        );
      },
      listIn: (legend: string): string[] => {
        return Array.from(
          within(tabsPanel())
            .getByRole("group", { name: legend })
            .querySelectorAll(".contact-building"),
        ).map((line) => {
          return line.textContent ?? "";
        });
      },
      hint: (): string | null => {
        return (
          tabsPanel().querySelector(".contact-tabs-hint")?.textContent ?? null
        );
      },
      connectedHeaders: (): string[] => {
        return within(tabsPanel())
          .getAllByRole("columnheader")
          .map((header) => {
            return header.textContent ?? "";
          });
      },
      connectedRows: (): string[][] => {
        return within(tabsPanel())
          .queryAllByTestId(TESTIDS.treeGridRow)
          .map(cellsOf);
      },
      connectedEmpty: (): string | null => {
        return (
          tabsPanel().querySelector(".tree-grid-empty")?.textContent ?? null
        );
      },
      clickConnectedRow: async (label: string): Promise<void> => {
        await user.click(rowOf(tabsPanel(), label));
      },
      clickLegend: async (): Promise<void> => {
        await user.click(within(tabsPanel()).getByTestId(TESTIDS.panelLegend));
      },
    },
    dialog: formDialogIn(() => {
      return rendered.container;
    }, user),
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
    moveLastContactOut: async (categoryName: string): Promise<void> => {
      const category = must(
        harness.seed.contactCategories.find((candidate) => {
          return candidate.name === categoryName;
        }),
        `the category ${categoryName}`,
      );

      const [only, ...others] = harness.seed.contacts.filter((contact) => {
        return contact.categoryId === category.id;
      });

      if (only === undefined || others.length > 0) {
        throw new Error(`${categoryName} does not hold exactly one contact`);
      }

      await act(async () => {
        await harness.ports.contacts.editContact(only.id, {
          ...only,
          categoryId: null,
          rows: only.rows.map((row) => {
            return { ...row };
          }),
        });
      });
    },
    contactName: (contactId: string): string => {
      const found = harness.seed.contacts.find((contact) => {
        return contact.id === contactId;
      });

      if (found === undefined) {
        throw new Error(`No contact ${contactId}`);
      }

      return nameOf(found);
    },
    maximized: (): string | null => {
      return screen().getAttribute("data-maximized");
    },
    clickMaximize: async (): Promise<void> => {
      await user.click(within(listPanel()).getByTestId(TESTIDS.panelMaximize));
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
    pressEscape: async (): Promise<void> => {
      await user.keyboard("{Escape}");
    },
    toasts: (): string[] => {
      return rendered.queryAllByTestId(TESTIDS.toast).map((toast) => {
        return toast.querySelector(".toast-text")?.textContent ?? "";
      });
    },
    breadcrumb: (): string => {
      return Array.from(
        rendered
          .getByTestId(TESTIDS.breadcrumb)
          .querySelectorAll<HTMLElement>(".breadcrumb-item"),
      )
        .map((crumb) => {
          return crumb.textContent ?? "";
        })
        .join(" › ");
    },
    railText: (): string => {
      return rendered.getByTestId(TESTIDS.rail).textContent ?? "";
    },
    isDrawerOpen: (): boolean => {
      return sidebar().getAttribute("data-open") === "true";
    },
    clickRail: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.rail));
    },
    clickScrim: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.drawerScrim));
    },
    sidebarWidth: (): number => {
      return Number.parseFloat(
        sidebar().style.getPropertyValue("--sidebar-width"),
      );
    },
    dragSidebar: (by: number): void => {
      const splitter = rendered
        .getAllByTestId(TESTIDS.splitter)
        .find((candidate) => {
          return candidate.getAttribute("data-direction") === "vertical";
        });

      if (splitter === undefined) {
        throw new Error("missing: the sidebar's splitter");
      }

      dragSplitterElement(splitter, [by]);
    },
    clickModule: async (label: string): Promise<void> => {
      await user.click(rendered.getByRole("tab", { name: label }));
    },
    showsManagementSidebar: (): boolean => {
      return within(sidebar()).queryByText("Select Management") !== null;
    },
  };
}
