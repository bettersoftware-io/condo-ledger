import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { WizardName } from "@cl/client-core";
import {
  type AppHarness,
  createAppHarness,
} from "@cl/client-core/testing/appHarness.ts";
import {
  type Account,
  type AccountRole,
  cents,
  type EntryAdded,
  type EntryDraft,
  type Invoice,
  type JournalEntry,
  type JournalPort,
  type LegacySeed,
  type Result,
  type ResultOf,
  rate,
  rejected,
} from "@cl/domain";
import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";
import { createViewModel, ViewModelProvider } from "@cl/react-bindings";

import { accountsScreenIn } from "../accounts/AccountsScreen.page.tsx";
import { AppRoot } from "../shell/AppRoot.tsx";
import { TESTIDS } from "../testids.ts";
import { JournalWizard } from "./JournalWizard.tsx";
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
  /** Double-clicks the entry's row. */
  doubleClickRow: (label: string) => Promise<void>;
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
  /** The tool's tooltip; null when it has none. */
  toolTitle: (label: string) => string | null;
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
  /** The journal store refuses the next delete, for this reason; the ones after it go through. */
  refuseNextDelete: (reason: string) => void;
  /** Another payment of the invoice lands in the store, from the bank, as if made from another window. */
  payElsewhere: (
    invoiceId: string,
    supplierId: string,
    amount: number,
  ) => Promise<void>;
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
  /**
   * The two invoices the small books register, with the tax accounts and code
   * 1019 at 4%: li1, Alfa's 101 of 360.18, due 10/02/2013 and open; li2,
   * Beta's 55 of 200.00, which the entry Pagamento Beta pays in full.
   */
  invoices?: boolean;
  /**
   * The real seed in place of the small books, on this period: p1 is Saturno
   * 2011, p36 Pozzetto 2013, the periods with installments. The other options
   * do not apply to it.
   */
  legacyPeriod?: string;
}

/** The dialog the Journal screen would open: which wizard, and the entry it edits. */
export interface JournalWizardDialog {
  wizard: WizardName;
  editing: string | null;
}

/** Mounts one wizard alone over the small books, as the Journal screen's dialog opens it. */
export function mountJournalWizard(
  dialog: JournalWizardDialog,
  options: JournalScreenOptions = {},
): WizardDialogPage {
  const user = userEvent.setup();
  const { app } = createJournalHarness(options);

  function ignore(): void {
    // Saving or cancelling closes the dialog on the Journal screen; alone, it stays.
  }

  const rendered = render(
    <ViewModelProvider viewModel={createViewModel(app)}>
      <JournalWizard
        wizard={dialog.wizard}
        editing={dialog.editing}
        onSaved={ignore}
        onCancel={ignore}
      />
    </ViewModelProvider>,
  );

  return wizardDialogPage(rendered, user);
}

/** Mounts the shell on the Journal screen over the small books, the menu chosen through the navigation's own intent. */
export function mountJournalScreen(
  options: JournalScreenOptions = {},
): JournalScreenPage {
  const user = userEvent.setup();
  const { app, ports } = createJournalHarness(options);

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
    doubleClickRow: async (label: string): Promise<void> => {
      await user.dblClick(rowOf(label));
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
    toolTitle: (label: string): string | null => {
      return tool(label).getAttribute("title");
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
    refuseNextDelete: (reason: string): void => {
      refuseNextDelete(ports.journal, reason);
    },
    payElsewhere: async (
      invoiceId: string,
      supplierId: string,
      amount: number,
    ): Promise<void> => {
      const result = await ports.journal.addEntry("p1", {
        kind: "invoicePayment",
        description: "Paid elsewhere",
        invoiceId,
        postings: [
          {
            accountId: "la4",
            debit: cents(amount),
            credit: cents(0),
            counterpart: { kind: "supplier", id: supplierId },
          },
          {
            accountId: "la2",
            debit: cents(0),
            credit: cents(amount),
            counterpart: null,
          },
        ],
      });

      if (!result.ok) {
        throw new Error(`the payment elsewhere was refused: ${result.reason}`);
      }
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

/** The store answers the next delete with a refusal, then hands back to the simulator. */
function refuseNextDelete(journal: JournalPort, reason: string): void {
  const remove = journal.deleteEntry.bind(journal);

  journal.deleteEntry = (_entryId: string): Promise<Result> => {
    journal.deleteEntry = remove;

    return Promise.resolve(rejected(reason));
  };
}

/** The application over the books the options ask for. */
function createJournalHarness(options: JournalScreenOptions): AppHarness {
  if (options.legacyPeriod === undefined) {
    return createAppHarness(createJournalSeed(options));
  }

  const harness = createAppHarness();

  harness.app.presenters.buildings.selectPeriod(options.legacyPeriod);

  return harness;
}

/** The small books, with the accounts and the entries the options ask for. */
function createJournalSeed(options: JournalScreenOptions): LegacySeed {
  const small = createSmallSeed();
  const invoices = options.invoices === true;
  const seed: LegacySeed = {
    ...small,
    entries: invoices
      ? small.entries.map((entry) => {
          return entry.id === "e3" ? { ...entry, invoiceId: "li2" } : entry;
        })
      : small.entries,
    invoices: invoices ? [createAlfaInvoice(), createBetaInvoice()] : [],
    withholdingTaxes: invoices
      ? [
          {
            periodId: "p1",
            code: "1019",
            name: "Ritenuta 4%",
            rate: rate(400),
            accountId: "la7",
          },
        ]
      : [],
    accounts: [
      ...small.accounts.map((account) => {
        return options.withoutRole !== undefined &&
          account.role === options.withoutRole
          ? { ...account, role: null }
          : account;
      }),
      ...(options.taxAccounts === true || invoices
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

/** Alfa's invoice 101, registered by Fattura Alfa: 300.15 taxable and 20% VAT, 360.18 due by 10/02/2013. */
function createAlfaInvoice(): Invoice {
  return {
    id: "li1",
    periodId: "p1",
    entryId: "e1",
    supplierId: "md1",
    number: "101",
    reason: "Manutenzione ascensore",
    date: "2013-01-10",
    dueDate: "2013-02-10",
    costAccountId: "la21",
    taxable: cents(30015),
    socialSecurityRate: rate(0),
    vatRate: rate(2000),
    nonTaxable: cents(0),
    withholdingCode: null,
    withholdingOnSocialSecurity: false,
  };
}

/** Beta's invoice 55, registered by Fattura Beta: 166.67 taxable and 20% VAT, 200.00 due. */
function createBetaInvoice(): Invoice {
  return {
    ...createAlfaInvoice(),
    id: "li2",
    entryId: "e2",
    supplierId: "md2",
    number: "55",
    reason: "Pulizie scale",
    date: "2013-01-15",
    dueDate: null,
    costAccountId: "la22",
    taxable: cents(16667),
  };
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
    invoiceId: null,
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
