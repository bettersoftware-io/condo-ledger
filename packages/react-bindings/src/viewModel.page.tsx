import { act, render } from "@testing-library/react";
import type { ReactElement } from "react";

import type {
  AccountDetails,
  AccountsGridIntents,
  AccountsGridState,
  BottomTabIntents,
  BottomTabState,
  ColumnSpec,
  ColumnsIntents,
  ColumnsState,
  DirectPaymentForm,
  DirectPaymentSummary,
  GenericEntryForm,
  GenericEntrySummary,
  InvoiceForm,
  InvoicePaymentForm,
  InvoicePaymentSummary,
  InvoiceSummary,
  JournalContext,
  JournalDialogIntents,
  JournalDialogState,
  JournalGridIntents,
  JournalGridState,
  MaximizeIntents,
  MaximizeState,
  MultiCostPaymentForm,
  MultiCostPaymentSummary,
  NavigationIntents,
  NavigationState,
  OpeningForm,
  OpeningSummary,
  SidebarIntents,
  SidebarState,
  SplitIntents,
  SplitState,
  WizardIntents,
  WizardState,
} from "@cl/client-core";
import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import type {
  AccountNode,
  Building,
  Cents,
  JournalEntryView,
  Ledger,
  LegacySeed,
  Result,
} from "@cl/domain";

import {
  createViewModel,
  type NoticesView,
  type SelectedAccountView,
  type SelectedPeriodView,
  type SessionView,
} from "./createViewModel.ts";
import type { MachineView } from "./useMachine.ts";
import { useViewModel } from "./useViewModel.ts";
import { ViewModelProvider } from "./ViewModelProvider.tsx";

/** What one reader got from every hook of the view model on its latest render. */
export interface Seen {
  session: SessionView;
  buildings: Building[];
  period: SelectedPeriodView;
  tree: AccountNode | null;
  account: SelectedAccountView;
  ledger: Ledger | null;
  details: AccountDetails | null;
  setBudget: (accountId: string, budget: Cents) => Promise<Result>;
  navigation: MachineView<NavigationState, NavigationIntents>;
  notices: NoticesView;
  grid: MachineView<AccountsGridState, AccountsGridIntents>;
  columns: MachineView<ColumnsState, ColumnsIntents>;
  split: MachineView<SplitState, SplitIntents>;
  bottomTab: MachineView<BottomTabState, BottomTabIntents>;
  maximize: MachineView<MaximizeState, MaximizeIntents>;
  sidebar: MachineView<SidebarState, SidebarIntents>;
  journalEntries: JournalEntryView[];
  journalContext: JournalContext | null;
  deleteEntry: (id: string) => Promise<Result>;
  journalGrid: MachineView<JournalGridState, JournalGridIntents>;
  journalDialog: MachineView<JournalDialogState, JournalDialogIntents>;
  /** The cash purchase: the kind every reader's direct-payment wizard is built for. */
  directPayment: MachineView<
    WizardState<DirectPaymentForm, DirectPaymentSummary>,
    WizardIntents<DirectPaymentForm>
  >;
  multiCostPayment: MachineView<
    WizardState<MultiCostPaymentForm, MultiCostPaymentSummary>,
    WizardIntents<MultiCostPaymentForm>
  >;
  genericEntry: MachineView<
    WizardState<GenericEntryForm, GenericEntrySummary>,
    WizardIntents<GenericEntryForm>
  >;
  invoice: MachineView<
    WizardState<InvoiceForm, InvoiceSummary>,
    WizardIntents<InvoiceForm>
  >;
  invoicePayment: MachineView<
    WizardState<InvoicePaymentForm, InvoicePaymentSummary>,
    WizardIntents<InvoicePaymentForm>
  >;
  openingBalances: MachineView<
    WizardState<OpeningForm, OpeningSummary>,
    WizardIntents<OpeningForm>
  >;
}

export interface ViewModelPage {
  /** What the given reader (the first by default) saw on its latest render. */
  read: (reader?: number) => Seen;
  /** Uses what the given reader saw (an intent, a command) and lets React render what follows. */
  send: (use: (seen: Seen) => unknown, reader?: number) => Promise<void>;
}

/** The columns every reader's columns machine is built over. */
const COLUMNS: readonly ColumnSpec[] = [
  { def: 200, min: 120, max: 400, grow: true },
  { def: 90, min: 60, max: 180, grow: false },
];

/** The tabs every reader's tab machine is built over. */
const TABS: readonly string[] = ["Ledger", "Details"];

/** Mounts readers of every hook under one provider, on the real application over the given seed. */
export function mountUnderProvider(
  seed: LegacySeed,
  readers: 1 | 2 = 1,
  editing: string | null = null,
): ViewModelPage {
  const viewModel = createViewModel(createAppHarness(seed).app);
  const seen: (Seen | undefined)[] = [];

  render(
    <ViewModelProvider viewModel={viewModel}>
      <Reader seen={seen} index={0} editing={editing} />
      {readers === 2 ? (
        <Reader seen={seen} index={1} editing={editing} />
      ) : null}
    </ViewModelProvider>,
  );

  function read(reader = 0): Seen {
    const entry = seen[reader];

    if (entry === undefined) {
      throw new Error(`missing: what reader ${reader} saw`);
    }

    return entry;
  }

  return {
    read,
    send: async (use: (seen: Seen) => unknown, reader = 0): Promise<void> => {
      await act(async () => {
        await use(read(reader));
      });
    },
  };
}

/** Mounts the same component with no provider above it. React reports what the component threw. */
export function mountWithoutProvider(): void {
  render(<Reader seen={[]} index={0} editing={null} />);
}

interface ReaderProps {
  seen: (Seen | undefined)[];
  index: number;
  /** The entry every wizard of this reader opens on: its generic one rewrites it. */
  editing: string | null;
}

function Reader({ seen, index, editing }: ReaderProps): ReactElement {
  const {
    useSession,
    useBuildingsTree,
    useSelectedPeriod,
    useAccountsTree,
    useSelectedAccount,
    useLedger,
    useAccountDetails,
    useSetBudget,
    useNavigation,
    useNotices,
    useAccountsGrid,
    useColumns,
    useSplit,
    useBottomTab,
    useMaximize,
    useSidebar,
    useJournalEntries,
    useJournalContext,
    useDeleteEntry,
    useJournalGrid,
    useJournalDialog,
    useDirectPaymentWizard,
    useMultiCostPaymentWizard,
    useGenericEntryWizard,
    useInvoiceWizard,
    useInvoicePaymentWizard,
    useOpeningBalancesWizard,
  } = useViewModel();

  seen[index] = {
    session: useSession(),
    buildings: useBuildingsTree(),
    period: useSelectedPeriod(),
    tree: useAccountsTree(),
    account: useSelectedAccount(),
    ledger: useLedger(),
    details: useAccountDetails(),
    setBudget: useSetBudget(),
    navigation: useNavigation(),
    notices: useNotices(),
    grid: useAccountsGrid(),
    columns: useColumns(COLUMNS),
    split: useSplit(),
    bottomTab: useBottomTab(TABS),
    maximize: useMaximize(),
    sidebar: useSidebar(),
    journalEntries: useJournalEntries(),
    journalContext: useJournalContext(),
    deleteEntry: useDeleteEntry(),
    journalGrid: useJournalGrid(),
    journalDialog: useJournalDialog(),
    directPayment: useDirectPaymentWizard("directPaymentCash", null),
    multiCostPayment: useMultiCostPaymentWizard(null),
    genericEntry: useGenericEntryWizard(editing),
    invoice: useInvoiceWizard(null),
    invoicePayment: useInvoicePaymentWizard(null),
    openingBalances: useOpeningBalancesWizard(null),
  };

  return <output />;
}
