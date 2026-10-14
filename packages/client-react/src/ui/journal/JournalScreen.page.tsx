import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import {
  type Account,
  type AccountRole,
  cents,
  type EntryAdded,
  type EntryDraft,
  type JournalEntry,
  type JournalPort,
  type LegacySeed,
  type ResultOf,
  rejected,
} from "@cl/domain";
import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";
import { createViewModel, ViewModelProvider } from "@cl/react-bindings";

import { accountsScreenIn } from "../accounts/AccountsScreen.page.tsx";
import { AppRoot } from "../shell/AppRoot.tsx";
import { TESTIDS } from "../testids.ts";
import {
  type WizardDialogPage,
  wizardDialogPage,
} from "./wizards/WizardDialog.page.tsx";

/** What a test can do with, and ask of, the Journal screen. */
export interface JournalScreenPage {
  title: () => string;
  meta: () => string;
  /** Each row's cells, entries and open postings alike. */
  rowTexts: () => string[][];
  entryLabels: () => string[];
  /** The entry's kind, as its icon is drawn. */
  iconOf: (label: string) => string;
  isExpanded: (label: string) => boolean;
  isSelected: (label: string) => boolean;
  clickRow: (label: string) => Promise<void>;
  clickCaret: (label: string) => Promise<void>;
  /** The `index`-th posting row on screen, counted from 0. */
  clickPostingRow: (index: number) => Promise<void>;
  isPostingSelected: (index: number) => boolean;
  /** Whether the running balance of the `index`-th posting row is bold. */
  isPostingBold: (index: number) => boolean;
  search: (text: string) => Promise<void>;
  emptyMessage: () => string | null;
  toolLabels: () => string[];
  clickTool: (label: string) => Promise<void>;
  isToolDisabled: (label: string) => boolean;
  /** Whether the tool says it opens a menu, and whether that menu is open. */
  toolMenu: (label: string) => string | null;
  openAddMenu: () => Promise<void>;
  menuItems: () => string[];
  clickMenuItem: (label: string) => Promise<void>;
  pageText: () => string;
  pageSizeText: () => string;
  nextPage: () => Promise<void>;
  previousPage: () => Promise<void>;
  choosePageSize: (size: number) => Promise<void>;
  maximized: () => string | null;
  clickMaximize: () => Promise<void>;
  confirmOpen: () => boolean;
  confirmText: () => string;
  confirmError: () => string | null;
  confirmYes: () => Promise<void>;
  confirmNo: () => Promise<void>;
  pressEscape: () => Promise<void>;
  /** Whether the keyboard's focus is in the grid's area. */
  gridHasFocus: () => boolean;
  toasts: () => string[];
  dialogOpen: () => boolean;
  /** Opens the Add transaction menu and chooses this wizard. */
  openWizard: (menuLabel: string) => Promise<WizardDialogPage>;
  /** The wizard open over the screen. */
  wizard: () => WizardDialogPage;
  /** The journal store refuses the next entry added, for this reason; the ones after it are written. */
  refuseNextAdd: (reason: string) => void;
  /** The open wizard's choice of the control account's row for this party. */
  rowChoiceLabel: (accountId: string, partyId: string) => string;
  /** Switches to Accounts through the sidebar, opens the rows of the path and selects its last, and reads the Ledger tab's lines. */
  ledgerOf: (path: string[]) => Promise<string[][]>;
}

/** What the books hold besides the small books' nine entries. */
export interface JournalScreenOptions {
  /** Generic entries numbered after the nine, one cent each. */
  extraEntries?: number;
  /** A period with no entry at all. */
  empty?: boolean;
  /** The account with this role loses it: the period has no such account. */
  withoutRole?: AccountRole;
  /** Two tax accounts, Ritenute 1019 and Ritenute 1020, that a withholding settles. */
  taxAccounts?: boolean;
}

/** Mounts the shell on the Journal screen over the small books, the menu chosen through the navigation's own intent. */
export function mountJournalScreen(
  options: JournalScreenOptions = {},
): JournalScreenPage {
  const user = userEvent.setup();
  const { app, ports } = createAppHarness(createJournalSeed(options));

  app.navigation.intents.selectMenu("journal");

  const rendered = render(
    <ViewModelProvider viewModel={createViewModel(app)}>
      <AppRoot />
    </ViewModelProvider>,
  );

  function screen(): HTMLElement {
    return rendered.getByTestId(TESTIDS.journalScreen);
  }

  function rows(): HTMLElement[] {
    return within(screen()).queryAllByTestId(TESTIDS.treeGridRow);
  }

  function entryRows(): HTMLElement[] {
    return rows().filter((row) => {
      return row.getAttribute("data-depth") === "0";
    });
  }

  function postingRow(index: number): HTMLElement {
    const row = rows().filter((candidate) => {
      return candidate.getAttribute("data-depth") === "1";
    })[index];

    if (row === undefined) {
      throw new Error(`No posting row ${index}`);
    }

    return row;
  }

  function labelOf(row: HTMLElement): string {
    return row.querySelector(".tree-grid-text")?.textContent ?? "";
  }

  function rowOf(label: string): HTMLElement {
    const row = entryRows().find((candidate) => {
      return labelOf(candidate) === label;
    });

    if (row === undefined) {
      throw new Error(`No entry labelled ${label}`);
    }

    return row;
  }

  function tool(label: string): HTMLButtonElement {
    return within(screen()).getByRole<HTMLButtonElement>("button", {
      name: label,
    });
  }

  function confirm(): HTMLElement | null {
    return rendered.queryByTestId(TESTIDS.confirmText);
  }

  return {
    title: (): string => {
      return within(screen()).getByTestId(TESTIDS.panelTitle).textContent ?? "";
    },
    meta: (): string => {
      return screen().querySelector(".panel-meta")?.textContent ?? "";
    },
    rowTexts: (): string[][] => {
      return rows().map((row) => {
        return Array.from(row.children).map((cell) => {
          return cell.textContent ?? "";
        });
      });
    },
    entryLabels: (): string[] => {
      return entryRows().map(labelOf);
    },
    iconOf: (label: string): string => {
      return (
        within(rowOf(label))
          .getByTestId(TESTIDS.entryIcon)
          .getAttribute("data-kind") ?? ""
      );
    },
    isExpanded: (label: string): boolean => {
      return rowOf(label).getAttribute("aria-expanded") === "true";
    },
    isSelected: (label: string): boolean => {
      return rowOf(label).getAttribute("aria-selected") === "true";
    },
    clickRow: async (label: string): Promise<void> => {
      await user.click(rowOf(label));
    },
    clickCaret: async (label: string): Promise<void> => {
      await user.click(within(rowOf(label)).getByTestId(TESTIDS.treeGridCaret));
    },
    clickPostingRow: async (index: number): Promise<void> => {
      await user.click(postingRow(index));
    },
    isPostingSelected: (index: number): boolean => {
      return postingRow(index).getAttribute("aria-selected") === "true";
    },
    isPostingBold: (index: number): boolean => {
      const balance = within(postingRow(index)).getAllByTestId(
        TESTIDS.money,
      )[2];

      return balance?.getAttribute("data-emphasis") === "true";
    },
    search: async (text: string): Promise<void> => {
      const box = within(screen()).getByTestId(TESTIDS.toolbarSearch);
      await user.clear(box);
      await user.type(box, text);
    },
    emptyMessage: (): string | null => {
      return screen().querySelector(".tree-grid-empty")?.textContent ?? null;
    },
    toolLabels: (): string[] => {
      return within(screen())
        .getAllByTestId(TESTIDS.toolbarButton)
        .map((button) => {
          return button.getAttribute("aria-label") ?? "";
        });
    },
    clickTool: async (label: string): Promise<void> => {
      await user.click(tool(label));
    },
    isToolDisabled: (label: string): boolean => {
      return tool(label).disabled;
    },
    toolMenu: (label: string): string | null => {
      const button = tool(label);
      const popup = button.getAttribute("aria-haspopup");

      return popup === null
        ? null
        : `${popup} ${button.getAttribute("aria-expanded") === "true" ? "open" : "closed"}`;
    },
    openAddMenu: async (): Promise<void> => {
      await user.click(tool("Add transaction"));
    },
    menuItems: (): string[] => {
      return within(screen())
        .queryAllByTestId(TESTIDS.menuItem)
        .map((item) => {
          return item.textContent ?? "";
        });
    },
    clickMenuItem: async (label: string): Promise<void> => {
      await user.click(within(screen()).getByRole("menuitem", { name: label }));
    },
    pageText: (): string => {
      return (
        within(screen()).getByTestId(TESTIDS.journalPageText).textContent ?? ""
      );
    },
    pageSizeText: (): string => {
      return tool("Page size").textContent ?? "";
    },
    nextPage: async (): Promise<void> => {
      await user.click(tool("Next page"));
    },
    previousPage: async (): Promise<void> => {
      await user.click(tool("Previous page"));
    },
    choosePageSize: async (size: number): Promise<void> => {
      await user.click(tool("Page size"));
      await user.click(
        within(screen()).getByRole("menuitem", { name: String(size) }),
      );
    },
    maximized: (): string | null => {
      return screen().getAttribute("data-maximized");
    },
    clickMaximize: async (): Promise<void> => {
      await user.click(within(screen()).getByTestId(TESTIDS.panelMaximize));
    },
    confirmOpen: (): boolean => {
      return confirm() !== null;
    },
    confirmText: (): string => {
      return confirm()?.textContent ?? "";
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
    pressEscape: async (): Promise<void> => {
      await user.keyboard("{Escape}");
    },
    gridHasFocus: (): boolean => {
      return within(screen())
        .getByTestId(TESTIDS.journalGrid)
        .contains(document.activeElement);
    },
    toasts: (): string[] => {
      return rendered.queryAllByTestId(TESTIDS.toast).map((toast) => {
        return toast.querySelector(".toast-text")?.textContent ?? "";
      });
    },
    dialogOpen: (): boolean => {
      return rendered.queryByTestId(TESTIDS.dialog) !== null;
    },
    openWizard: async (menuLabel: string): Promise<WizardDialogPage> => {
      await user.click(tool("Add transaction"));
      await user.click(
        within(screen()).getByRole("menuitem", { name: menuLabel }),
      );

      return wizardDialogPage(rendered, user);
    },
    wizard: (): WizardDialogPage => {
      return wizardDialogPage(rendered, user);
    },
    refuseNextAdd: (reason: string): void => {
      refuseNextAdd(ports.journal, reason);
    },
    rowChoiceLabel: (accountId: string, partyId: string): string => {
      const option = Array.from(
        rendered.getByTestId(TESTIDS.dialog).querySelectorAll("option"),
      ).find((candidate) => {
        return (
          candidate.value.startsWith(`${accountId}@`) &&
          candidate.value.endsWith(`/${partyId}`)
        );
      });

      if (option === undefined) {
        throw new Error(`No choice of ${accountId} for ${partyId}`);
      }

      return option.textContent ?? "";
    },
    ledgerOf: async (path: string[]): Promise<string[][]> => {
      await user.click(
        within(rendered.getByTestId(TESTIDS.sidebar)).getByRole("button", {
          name: "Accounts, Ledgers & Balance",
        }),
      );

      const accounts = accountsScreenIn({ rendered, user });

      await accounts.activateTab("Ledger");

      for (const [index, label] of path.entries()) {
        await (index < path.length - 1
          ? accounts.clickAccountCaret(label)
          : accounts.clickAccount(label));
      }

      return accounts.ledgerRows();
    },
  };
}

/** The store answers the next add with a refusal, then hands back to the simulator. */
function refuseNextAdd(journal: JournalPort, reason: string): void {
  const add = journal.addEntry.bind(journal);

  journal.addEntry = (
    _periodId: string,
    _draft: EntryDraft,
  ): Promise<ResultOf<EntryAdded>> => {
    journal.addEntry = add;

    return Promise.resolve(rejected(reason));
  };
}

/** The small books, with the accounts and the entries the options ask for. */
function createJournalSeed(options: JournalScreenOptions): LegacySeed {
  const small = createSmallSeed();
  const seed: LegacySeed = {
    ...small,
    accounts: [
      ...small.accounts.map((account) => {
        return options.withoutRole !== undefined &&
          account.role === options.withoutRole
          ? { ...account, role: null }
          : account;
      }),
      ...(options.taxAccounts === true
        ? [
            createTaxAccount("la7", "Ritenute 1019"),
            createTaxAccount("la8", "Ritenute 1020"),
          ]
        : []),
    ],
  };

  if (options.empty === true) {
    return { ...seed, entries: [] };
  }

  const extra = Array.from(
    { length: options.extraEntries ?? 0 },
    (_, index) => {
      return createExtraEntry(seed.entries.length + index + 1);
    },
  );

  return { ...seed, entries: [...seed.entries, ...extra] };
}

/** A one-cent generic entry from cash to cash, numbered `number`. */
function createExtraEntry(number: number): JournalEntry {
  return {
    id: `x${number}`,
    periodId: "p1",
    number,
    at: "2013-04-01T10:00:00",
    kind: "generic",
    description: `Extra ${number}`,
    postings: [
      {
        accountId: "la1",
        debit: cents(1),
        credit: cents(0),
        counterpart: null,
      },
      {
        accountId: "la30",
        debit: cents(0),
        credit: cents(1),
        counterpart: null,
      },
    ],
  };
}

/** A regular tax account at the top of the liabilities, numbered by its id. */
function createTaxAccount(id: string, name: string): Account {
  return {
    id,
    periodId: "p1",
    parentId: null,
    name,
    order: Number(id.slice(2)),
    nature: "liabilities",
    type: "regular",
    role: "tax",
    budget: null,
  };
}
