import {
  type AccountsPort,
  type BuildingsPort,
  type Clock,
  createAccountsSimulator,
  createBuildingsSimulator,
  createJournalSimulator,
  createSessionSimulator,
  DESIGN_FIRM,
  DESIGN_PRINCIPAL,
  type JournalPort,
  type LegacySeed,
  type SessionPort,
  systemClock,
} from "@cl/domain";

import {
  type AccountsGridIntents,
  type AccountsGridState,
  createAccountsGridMachine,
} from "./machines/accountsGridMachine.ts";
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
  createJournalDialogMachine,
  type JournalDialogIntents,
  type JournalDialogState,
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
  createDirectPaymentWizard,
  type DirectPaymentForm,
  type DirectPaymentKind,
  type DirectPaymentSummary,
} from "./machines/wizards/directPaymentWizard.ts";
import {
  createGenericEntryWizard,
  type GenericEntryForm,
  type GenericEntrySummary,
} from "./machines/wizards/genericEntryWizard.ts";
import {
  createMultiCostPaymentWizard,
  type MultiCostPaymentForm,
  type MultiCostPaymentSummary,
} from "./machines/wizards/multiCostPaymentWizard.ts";
import type { WizardMachine } from "./machines/wizards/wizard.ts";
import { createNotices, type Notices } from "./notices.ts";
import {
  type AccountsPresenter,
  createAccountsPresenter,
} from "./presenters/accountsPresenter.ts";
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
}

/** The shared state: one of each per application, however many readers. */
interface AppPresenters {
  session: SessionPresenter;
  buildings: BuildingsPresenter;
  books: BooksPresenter;
  accounts: AccountsPresenter;
  journal: JournalPresenter;
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
  createJournalDialog: () => Machine<JournalDialogState, JournalDialogIntents>;
  /** The wizards are built over the selected period's books as they stand: with no period, no choices and a refused verdict. */
  createDirectPaymentWizard: (
    kind: DirectPaymentKind,
  ) => WizardMachine<DirectPaymentForm, DirectPaymentSummary>;
  createMultiCostPaymentWizard: () => WizardMachine<
    MultiCostPaymentForm,
    MultiCostPaymentSummary
  >;
  createGenericEntryWizard: () => WizardMachine<
    GenericEntryForm,
    GenericEntrySummary
  >;
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
    { accounts: ports.accounts, journal: ports.journal },
    buildings.selected$,
  );
  const accounts = createAccountsPresenter(books.books$, ports.accounts);
  const journal = createJournalPresenter(
    books.books$,
    buildings.tree$,
    buildings.selected$,
    ports.journal,
  );
  let latestBooks: Books | null = null;

  // The books presenter lives as long as the application: nothing unsubscribes.
  books.books$.subscribe((next) => {
    latestBooks = next;
  });

  return {
    presenters: { session, buildings, books, accounts, journal },
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
      createJournalDialog: createJournalDialogMachine,
      createDirectPaymentWizard: (
        kind: DirectPaymentKind,
      ): WizardMachine<DirectPaymentForm, DirectPaymentSummary> => {
        return createDirectPaymentWizard(kind, latestBooks, journal.addEntry);
      },
      createMultiCostPaymentWizard: (): WizardMachine<
        MultiCostPaymentForm,
        MultiCostPaymentSummary
      > => {
        return createMultiCostPaymentWizard(latestBooks, journal.addEntry);
      },
      createGenericEntryWizard: (): WizardMachine<
        GenericEntryForm,
        GenericEntrySummary
      > => {
        return createGenericEntryWizard(latestBooks, journal.addEntry);
      },
    },
  };
}

/** The four simulators over one seed: what `pnpm dev` and the harness run on. */
export function createSimulatorPorts(
  seed: LegacySeed,
  clock: Clock = systemClock,
): AppPorts {
  return {
    session: createSessionSimulator({
      principal: DESIGN_PRINCIPAL,
      firm: DESIGN_FIRM,
    }),
    buildings: createBuildingsSimulator(seed),
    accounts: createAccountsSimulator(seed),
    journal: createJournalSimulator(seed, clock),
  };
}
