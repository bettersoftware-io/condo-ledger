import { type Observable, switchMap } from "rxjs";

import {
  type AccountsPort,
  type AccountsSimulator,
  type BuildingsPort,
  type ClockPort,
  createAccountsSimulator,
  createBuildingsSimulator,
  createInstallmentsSimulator,
  createJournalSimulator,
  createSessionSimulator,
  createTablesSimulator,
  createUnitsSimulator,
  DESIGN_FIRM,
  DESIGN_PRINCIPAL,
  type EntryKind,
  type InstallmentsPort,
  type InstallmentsSimulator,
  type JournalEntry,
  type JournalPort,
  type JournalSimulator,
  type LegacySeed,
  type Result,
  type SessionPort,
  type TablesPort,
  type UnitsPort,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import { amountTextsIn } from "./amounts.ts";
import {
  type AccountsGridIntents,
  type AccountsGridState,
  createAccountsGridMachine,
} from "./machines/accountsGridMachine.ts";
import {
  type AllocationGridState,
  type AllocationModeIntents,
  type AllocationModeState,
  type CoefficientsGridState,
  createAllocationGridMachine,
  createAllocationModeMachine,
  createCoefficientsGridMachine,
  createTableSelectionMachine,
  type TableSelectionIntents,
  type TableSelectionState,
  type TreeGridIntents,
} from "./machines/allocationMachines.ts";
import {
  type BottomTabIntents,
  type BottomTabState,
  createBottomTabMachine,
} from "./machines/bottomTabMachine.ts";
import {
  type ColumnSpec,
  type ColumnsIntents,
  type ColumnsState,
  createColumnsMachine,
} from "./machines/columnsMachine.ts";
import {
  createInstallmentDialog,
  type InstallmentDialogIntents,
  type InstallmentDialogState,
} from "./machines/installmentDialogMachine.ts";
import {
  createJournalDialogMachine,
  type JournalDialogIntents,
  type JournalDialogState,
  type WizardName,
} from "./machines/journalDialogMachine.ts";
import {
  createJournalGridMachine,
  type JournalGridIntents,
  type JournalGridState,
} from "./machines/journalGridMachine.ts";
import type { Machine } from "./machines/machine.ts";
import {
  createMaximizeMachine,
  type MaximizeIntents,
  type MaximizeState,
} from "./machines/maximizeMachine.ts";
import {
  createNavigationMachine,
  type NavigationIntents,
  type NavigationState,
} from "./machines/navigationMachine.ts";
import {
  createScheduleGridMachine,
  type ScheduleGridIntents,
  type ScheduleGridState,
} from "./machines/scheduleGridMachine.ts";
import {
  createSidebarMachine,
  type SidebarIntents,
  type SidebarState,
} from "./machines/sidebarMachine.ts";
import {
  createSplitMachine,
  type SplitIntents,
  type SplitState,
} from "./machines/splitMachine.ts";
import {
  type BudgetInstallmentsForm,
  type BudgetInstallmentsSummary,
  createBudgetInstallmentsWizard,
} from "./machines/wizards/budgetInstallmentsWizard.ts";
import {
  type CollectionForm,
  type CollectionSummary,
  createCollectionWizard,
} from "./machines/wizards/collectionWizard.ts";
import {
  createDirectPaymentWizard,
  type DirectPaymentForm,
  type DirectPaymentKind,
  type DirectPaymentSummary,
} from "./machines/wizards/directPaymentWizard.ts";
import { editorOf } from "./machines/wizards/editorOf.ts";
import {
  createGenericEntryWizard,
  type GenericEntryForm,
  type GenericEntrySummary,
} from "./machines/wizards/genericEntryWizard.ts";
import {
  createInvoicePaymentWizard,
  type InvoicePaymentForm,
  type InvoicePaymentSummary,
} from "./machines/wizards/invoicePaymentWizard.ts";
import {
  createInvoiceWizard,
  type InvoiceForm,
  type InvoiceSummary,
} from "./machines/wizards/invoiceWizard.ts";
import {
  createMultiCostPaymentWizard,
  type MultiCostPaymentForm,
  type MultiCostPaymentSummary,
} from "./machines/wizards/multiCostPaymentWizard.ts";
import {
  createOpeningBalancesWizard,
  type OpeningForm,
  type OpeningSummary,
} from "./machines/wizards/openingBalancesWizard.ts";
import {
  replacing,
  type WizardMachine,
  type WriteEntry,
} from "./machines/wizards/wizard.ts";
import { createNotices, type Notices } from "./notices.ts";
import {
  type AccountsPresenter,
  createAccountsPresenter,
} from "./presenters/accountsPresenter.ts";
import {
  type AllocationPresenter,
  createAllocationPresenter,
} from "./presenters/allocationPresenter.ts";
import {
  type Books,
  type BooksPresenter,
  createBooksPresenter,
} from "./presenters/booksPresenter.ts";
import {
  type BuildingsPresenter,
  createBuildingsPresenter,
} from "./presenters/buildingsPresenter.ts";
import {
  createInstallmentSchedulePresenter,
  type InstallmentSchedulePresenter,
  scheduleContextOf,
} from "./presenters/installmentSchedulePresenter.ts";
import {
  createJournalPresenter,
  type JournalPresenter,
} from "./presenters/journalPresenter.ts";
import {
  createSessionPresenter,
  type SessionPresenter,
} from "./presenters/sessionPresenter.ts";

/** Everything the application needs from the outside world. The client's
 * composition root decides what stands behind each port. */
export interface AppPorts {
  session: SessionPort;
  buildings: BuildingsPort;
  accounts: AccountsPort;
  journal: JournalPort;
  installments: InstallmentsPort;
  tables: TablesPort;
  units: UnitsPort;
  clock: ClockPort;
}

/** The shared state: one of each per application, however many readers. */
interface AppPresenters {
  session: SessionPresenter;
  buildings: BuildingsPresenter;
  books: BooksPresenter;
  accounts: AccountsPresenter;
  journal: JournalPresenter;
  schedule: InstallmentSchedulePresenter;
  allocation: AllocationPresenter;
}

/** Per-component state: each call builds a machine of its own. */
interface AppMachines {
  createAccountsGrid: () => Machine<AccountsGridState, AccountsGridIntents>;
  createColumns: (
    spec: readonly ColumnSpec[],
  ) => Machine<ColumnsState, ColumnsIntents>;
  createSplit: () => Machine<SplitState, SplitIntents>;
  createBottomTab: (
    tabs: readonly string[],
  ) => Machine<BottomTabState, BottomTabIntents>;
  createMaximize: () => Machine<MaximizeState, MaximizeIntents>;
  createSidebar: () => Machine<SidebarState, SidebarIntents>;
  createJournalGrid: () => Machine<JournalGridState, JournalGridIntents>;
  createScheduleGrid: () => Machine<ScheduleGridState, ScheduleGridIntents>;
  /** Which of the selected period's tables the coefficients show: its first, until one is selected. */
  createTableSelection: () => Machine<
    TableSelectionState,
    TableSelectionIntents
  >;
  /** Which allocation the panel shows: the budget's, until another is chosen. */
  createAllocationMode: () => Machine<
    AllocationModeState,
    AllocationModeIntents
  >;
  /** The coefficients tree of the table a selection holds, as it changes. */
  createCoefficientsGrid: (
    selection$: Observable<TableSelectionState>,
  ) => Machine<CoefficientsGridState, TreeGridIntents>;
  /** The allocation in the mode a mode machine holds, as it changes. */
  createAllocationGrid: (
    mode$: Observable<AllocationModeState>,
  ) => Machine<AllocationGridState, TreeGridIntents>;
  /** The dialog over the selected period's books as they stand when an intent asks: an edit opens only for an entry they hold. */
  createJournalDialog: () => Machine<JournalDialogState, JournalDialogIntents>;
  /**
   * The wizards are built over the selected period's books as they stand:
   * with no period, no choices and a refused verdict. `editing` names an entry
   * of those books to rewrite, keeping its kind; one they do not hold throws.
   * Left out, the wizard writes a new entry. Each reads and writes amounts
   * in the session's locale as it stands when it judges.
   */
  createDirectPaymentWizard: (
    kind: DirectPaymentKind,
    editing?: string | null,
  ) => WizardMachine<DirectPaymentForm, DirectPaymentSummary>;
  createMultiCostPaymentWizard: (
    editing?: string | null,
  ) => WizardMachine<MultiCostPaymentForm, MultiCostPaymentSummary>;
  /** `kind` is what the generic wizard writes; left out, generic for a new entry and the edited entry's own kind for an edit. */
  createGenericEntryWizard: (
    editing?: string | null,
    kind?: EntryKind,
  ) => WizardMachine<GenericEntryForm, GenericEntrySummary>;
  /** The New invoice wizard, its date from the application's clock; `editing` names an invoice's registration to rewrite. */
  createInvoiceWizard: (
    editing: string | null,
  ) => WizardMachine<InvoiceForm, InvoiceSummary>;
  /** The Invoice payment wizard, its overdue marking from the application's clock; `editing` names an invoice payment to rewrite, from step 2. */
  createInvoicePaymentWizard: (
    editing: string | null,
  ) => WizardMachine<InvoicePaymentForm, InvoicePaymentSummary>;
  /** The Opening balances wizard; `editing` names the period's opening to rewrite. */
  createOpeningBalancesWizard: (
    editing: string | null,
  ) => WizardMachine<OpeningForm, OpeningSummary>;
  /** The Record owner collection wizard, its prefilled amount due by the application's clock; `editing` names a collection to rewrite, from step 2. */
  createCollectionWizard: (
    editing: string | null,
  ) => WizardMachine<CollectionForm, CollectionSummary>;
  /** The Create Budget Installments wizard over the selected period's books as they stand: with no period, refused. Its percentages are read and written in the session's locale. */
  createBudgetInstallmentsWizard: () => WizardMachine<
    BudgetInstallmentsForm,
    BudgetInstallmentsSummary,
    Result
  >;
  /** The Edit Installment dialog over an installment of the selected period's books as they stand; one they do not hold throws. */
  createInstallmentDialog: (
    installmentId: string,
  ) => Machine<InstallmentDialogState, InstallmentDialogIntents>;
}

/** The application, built once at startup. Presenters, the navigation and
 * the notices are shared; machine factories build one machine per component
 * that asks. */
export interface App {
  presenters: AppPresenters;
  navigation: Machine<NavigationState, NavigationIntents>;
  notices: Notices;
  machines: AppMachines;
}

export function createApp(ports: AppPorts): App {
  const session = createSessionPresenter(ports.session);
  const buildings = createBuildingsPresenter(ports.buildings);
  const books = createBooksPresenter(
    {
      accounts: ports.accounts,
      journal: ports.journal,
      installments: ports.installments,
    },
    buildings.selected$,
    buildings.tree$,
  );
  const accounts = createAccountsPresenter(books.books$, ports.accounts);
  const journal = createJournalPresenter(
    books.books$,
    buildings.tree$,
    buildings.selected$,
    ports.journal,
  );

  const schedule = createInstallmentSchedulePresenter(
    books.books$,
    buildings.tree$,
    ports.installments,
    ports.clock,
  );

  const allocation = createAllocationPresenter(
    books.books$,
    buildings.tree$,
    { tables: ports.tables, units: ports.units },
    session.amountLocale$,
  );
  let latestBooks: Books | null = null;

  // The books presenter lives as long as the application: nothing unsubscribes.
  books.books$.subscribe((next) => {
    latestBooks = next;
  });
  // The wizards read the amounts' locale as it stands whenever they judge:
  // held for the application's life, so it always has the session's.
  session.amountLocale$.subscribe();

  const texts = amountTextsIn(session.amountLocale$);

  /** The entry of the books as they stand that a wizard rewrites; null for a new entry. */
  function editedEntry(editing: string | null): JournalEntry | null {
    return editing === null
      ? null
      : must(
          latestBooks?.entries.find((entry) => {
            return entry.id === editing;
          }),
          `the entry ${editing}`,
        );
  }

  /** The wizard that edits an entry of the books as they stand; null for one they do not hold, or that cannot be edited. */
  function editorOfHeld(entryId: string): WizardName | null {
    const books = latestBooks;

    if (books === null) {
      return null;
    }

    const entry = books.entries.find((candidate) => {
      return candidate.id === entryId;
    });

    return entry === undefined ? null : editorOf(entry, books);
  }

  /** The period's opening entry in the books as they stand; null when it has none. */
  function openingEntry(): string | null {
    return (
      latestBooks?.entries.find((entry) => {
        return entry.kind === "openingBalances";
      })?.id ?? null
    );
  }

  /** How a wizard writes: a new entry is added, an edited one replaced. */
  function writeOf(entry: JournalEntry | null): WriteEntry {
    return entry === null
      ? journal.addEntry
      : replacing(entry.id, journal.replaceEntry);
  }

  return {
    presenters: {
      session,
      buildings,
      books,
      accounts,
      journal,
      schedule,
      allocation,
    },
    navigation: createNavigationMachine(),
    notices: createNotices(),
    machines: {
      createAccountsGrid: (): Machine<
        AccountsGridState,
        AccountsGridIntents
      > => {
        return createAccountsGridMachine(accounts.tree$);
      },
      createColumns: createColumnsMachine,
      createSplit: createSplitMachine,
      createBottomTab: createBottomTabMachine,
      createMaximize: createMaximizeMachine,
      createSidebar: createSidebarMachine,
      createJournalGrid: (): Machine<JournalGridState, JournalGridIntents> => {
        return createJournalGridMachine(journal.entries$);
      },
      createScheduleGrid: (): Machine<
        ScheduleGridState,
        ScheduleGridIntents
      > => {
        return createScheduleGridMachine(schedule.schedule$);
      },
      createTableSelection: (): Machine<
        TableSelectionState,
        TableSelectionIntents
      > => {
        return createTableSelectionMachine(allocation.tables$);
      },
      createAllocationMode: createAllocationModeMachine,
      createCoefficientsGrid: (
        selection$: Observable<TableSelectionState>,
      ): Machine<CoefficientsGridState, TreeGridIntents> => {
        return createCoefficientsGridMachine(
          selection$.pipe(
            switchMap(({ tableId }) => {
              return allocation.coefficients$(tableId);
            }),
          ),
        );
      },
      createAllocationGrid: (
        mode$: Observable<AllocationModeState>,
      ): Machine<AllocationGridState, TreeGridIntents> => {
        return createAllocationGridMachine(
          mode$.pipe(
            switchMap(({ mode }) => {
              return allocation.allocation$(mode);
            }),
          ),
        );
      },
      createJournalDialog: (): Machine<
        JournalDialogState,
        JournalDialogIntents
      > => {
        return createJournalDialogMachine({
          editorOf: editorOfHeld,
          openingEntry,
        });
      },
      createDirectPaymentWizard: (
        kind: DirectPaymentKind,
        editing: string | null = null,
      ): WizardMachine<DirectPaymentForm, DirectPaymentSummary> => {
        const entry = editedEntry(editing);

        return createDirectPaymentWizard(
          texts,
          kind,
          latestBooks,
          writeOf(entry),
          entry,
        );
      },
      createMultiCostPaymentWizard: (
        editing: string | null = null,
      ): WizardMachine<MultiCostPaymentForm, MultiCostPaymentSummary> => {
        const entry = editedEntry(editing);

        return createMultiCostPaymentWizard(
          texts,
          latestBooks,
          writeOf(entry),
          entry,
        );
      },
      createGenericEntryWizard: (
        editing: string | null = null,
        kind?: EntryKind,
      ): WizardMachine<GenericEntryForm, GenericEntrySummary> => {
        const entry = editedEntry(editing);

        return createGenericEntryWizard(
          texts,
          latestBooks,
          writeOf(entry),
          entry,
          kind,
        );
      },
      createInvoiceWizard: (
        editing: string | null,
      ): WizardMachine<InvoiceForm, InvoiceSummary> => {
        const entry = editedEntry(editing);

        return createInvoiceWizard(
          texts,
          latestBooks,
          ports.clock,
          writeOf(entry),
          entry,
        );
      },
      createInvoicePaymentWizard: (
        editing: string | null,
      ): WizardMachine<InvoicePaymentForm, InvoicePaymentSummary> => {
        const entry = editedEntry(editing);

        return createInvoicePaymentWizard(
          texts,
          latestBooks,
          ports.clock,
          writeOf(entry),
          entry,
          (): Books | null => {
            return latestBooks;
          },
        );
      },
      createOpeningBalancesWizard: (
        editing: string | null,
      ): WizardMachine<OpeningForm, OpeningSummary> => {
        const entry = editedEntry(editing);

        return createOpeningBalancesWizard(
          texts,
          latestBooks,
          writeOf(entry),
          entry,
        );
      },
      createCollectionWizard: (
        editing: string | null,
      ): WizardMachine<CollectionForm, CollectionSummary> => {
        const entry = editedEntry(editing);

        return createCollectionWizard(
          texts,
          latestBooks,
          ports.clock,
          writeOf(entry),
          entry,
          (): Books | null => {
            return latestBooks;
          },
        );
      },
      createBudgetInstallmentsWizard: (): WizardMachine<
        BudgetInstallmentsForm,
        BudgetInstallmentsSummary,
        Result
      > => {
        const books = latestBooks;

        return createBudgetInstallmentsWizard(
          texts,
          books,
          (draft) => {
            // Only a wizard over books writes: with none, its verdict refuses.
            return schedule.createInstallments(
              must(books, "the books of the batch").periodId,
              draft,
            );
          },
          (): Books | null => {
            return latestBooks;
          },
        );
      },
      createInstallmentDialog: (
        installmentId: string,
      ): Machine<InstallmentDialogState, InstallmentDialogIntents> => {
        const books = must(latestBooks, `the installment ${installmentId}`);
        const installment = must(
          books.installments.find((candidate) => {
            return candidate.id === installmentId;
          }),
          `the installment ${installmentId}`,
        );

        return createInstallmentDialog(
          installment,
          (patch) => {
            return schedule.updateInstallment(installmentId, patch);
          },
          scheduleContextOf(books),
        );
      },
    },
  };
}

/**
 * The seven simulators over one seed: what `pnpm dev` and the harness run on.
 * The journal and the installments read each other's current state, so a
 * collection is judged against the schedule as it stands and an installment
 * a collection pays is not deleted. Each reads the other only when a write
 * asks, after both are built. A table is deleted only when no account, as
 * the accounts simulator holds it now, links to it.
 */
export function createSimulatorPorts(
  seed: LegacySeed,
  clock: ClockPort,
): AppPorts {
  const journal: JournalSimulator = createJournalSimulator(
    seed,
    clock,
    (periodId) => {
      return installments.current(periodId);
    },
  );

  const installments: InstallmentsSimulator = createInstallmentsSimulator(
    seed,
    (periodId) => {
      return journal.current(periodId);
    },
  );

  const accounts: AccountsSimulator = createAccountsSimulator(seed);

  return {
    session: createSessionSimulator({
      principal: DESIGN_PRINCIPAL,
      firm: DESIGN_FIRM,
    }),
    buildings: createBuildingsSimulator(seed),
    accounts,
    journal,
    installments,
    tables: createTablesSimulator(seed, (periodId) => {
      return accounts.current(periodId);
    }),
    units: createUnitsSimulator(seed),
    clock,
  };
}
