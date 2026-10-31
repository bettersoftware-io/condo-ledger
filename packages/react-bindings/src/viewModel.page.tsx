import { act, render } from "@testing-library/react";
import type { ReactElement } from "react";

import type {
  AccountDetails,
  AccountsGridIntents,
  AccountsGridState,
  AllocationGridState,
  AmountLocale,
  BottomTabIntents,
  BottomTabState,
  BudgetAllocationForm,
  BudgetAllocationSummary,
  BudgetInstallmentsForm,
  BudgetInstallmentsSummary,
  CoefficientsGridState,
  CollectionForm,
  CollectionSummary,
  ColumnSpec,
  ColumnsIntents,
  ColumnsState,
  DialogIntents,
  DirectPaymentForm,
  DirectPaymentSummary,
  GenericEntryForm,
  GenericEntrySummary,
  GroupDialogState,
  InstallmentDialogIntents,
  InstallmentDialogState,
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
  OwnerDialogState,
  ScheduleGridIntents,
  ScheduleGridState,
  SidebarIntents,
  SidebarState,
  SplitIntents,
  SplitState,
  TableDialogIntents,
  TableDialogState,
  TreeGridIntents,
  TreeGridState,
  UnitDialogState,
  WizardIntents,
  WizardState,
} from "@cl/client-core";
import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import type {
  AccountNode,
  Building,
  Cents,
  Contact,
  JournalEntryView,
  Ledger,
  LegacySeed,
  OwnersRow,
  Result,
  UnitsRow,
} from "@cl/domain";

import {
  type AllocationView,
  createViewModel,
  type NoticesView,
  type ScheduleView,
  type SelectedAccountView,
  type SelectedPeriodView,
  type SessionView,
  type UnitsScreenView,
} from "./createViewModel.ts";
import type { MachineView } from "./useMachine.ts";
import { useViewModel } from "./useViewModel.ts";
import { ViewModelProvider } from "./ViewModelProvider.tsx";

/** What one reader got from every hook of the view model on its latest render. */
export interface Seen {
  session: SessionView;
  amountLocale: AmountLocale;
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
  collection: MachineView<
    WizardState<CollectionForm, CollectionSummary>,
    WizardIntents<CollectionForm>
  >;
  schedule: ScheduleView;
  scheduleGrid: MachineView<ScheduleGridState, ScheduleGridIntents>;
  budgetInstallments: MachineView<
    WizardState<BudgetInstallmentsForm, BudgetInstallmentsSummary>,
    WizardIntents<BudgetInstallmentsForm, Result>
  >;
  allocation: AllocationView;
  coefficientsGrid: MachineView<CoefficientsGridState, TreeGridIntents>;
  allocationGrid: MachineView<AllocationGridState, TreeGridIntents>;
  budgetAllocation: MachineView<
    WizardState<BudgetAllocationForm, BudgetAllocationSummary>,
    WizardIntents<BudgetAllocationForm>
  >;
  /** The New Thousandth Table dialog. */
  tableDialog: MachineView<TableDialogState, TableDialogIntents>;
  /** Null unless the page was mounted with an installment to edit. */
  installmentDialog: MachineView<
    InstallmentDialogState,
    InstallmentDialogIntents
  > | null;
  units: UnitsScreenView;
  unitsGrid: MachineView<TreeGridState<UnitsRow>, TreeGridIntents>;
  unitOwnersGrid: MachineView<TreeGridState<OwnersRow>, TreeGridIntents>;
  /** Null unless the page was mounted with a unit to edit. */
  unitDialog: MachineView<
    UnitDialogState,
    DialogIntents<UnitDialogState["form"]>
  > | null;
  /** The New Group dialog; null unless the page was mounted with a unit to edit. */
  groupDialog: MachineView<
    GroupDialogState,
    DialogIntents<GroupDialogState["form"]>
  > | null;
  /** The Add Owner dialog on the selected unit; null unless the page was mounted with a unit to edit. */
  ownerDialog: MachineView<
    OwnerDialogState,
    DialogIntents<OwnerDialogState["form"]>
  > | null;
  contacts: Contact[];
}

export interface ViewModelPage {
  /** What the given reader (the first by default) saw on its latest render. */
  read: (reader?: number) => Seen;
  /** Uses what the given reader saw (an intent, a command) and lets React render what follows. */
  send: (use: (seen: Seen) => unknown, reader?: number) => Promise<void>;
}

/** The columns every reader asks the accounts grid's widths for. */
const COLUMNS: readonly ColumnSpec[] = [
  { def: 200, min: 120, max: 400, grow: true },
  { def: 90, min: 60, max: 180, grow: false },
];

/** The tabs every reader asks the accounts panel's tab for. */
const TABS: readonly string[] = ["Ledger", "Details"];

/** Mounts readers of every hook under one provider, on the real application over the given seed. */
export function mountUnderProvider(
  seed: LegacySeed,
  readers: 1 | 2 = 1,
  editing: string | null = null,
  collectionEditing: string | null = null,
  installmentId: string | null = null,
  unitId: string | null = null,
): ViewModelPage {
  const viewModel = createViewModel(createAppHarness(seed).app);
  const seen: (Seen | undefined)[] = [];

  render(
    <ViewModelProvider viewModel={viewModel}>
      <Reader
        seen={seen}
        index={0}
        editing={editing}
        collectionEditing={collectionEditing}
        installmentId={installmentId}
        unitId={unitId}
      />
      {readers === 2 ? (
        <Reader
          seen={seen}
          index={1}
          editing={editing}
          collectionEditing={collectionEditing}
          installmentId={installmentId}
          unitId={unitId}
        />
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
  render(
    <Reader
      seen={[]}
      index={0}
      editing={null}
      collectionEditing={null}
      installmentId={null}
      unitId={null}
    />,
  );
}

interface ReaderProps {
  seen: (Seen | undefined)[];
  index: number;
  /** The entry every wizard of this reader opens on: its generic one rewrites it. */
  editing: string | null;
  /** The collection the reader's collection wizard rewrites. */
  collectionEditing: string | null;
  /** The installment the reader's Edit Installment dialog opens on; none, no dialog. */
  installmentId: string | null;
  /** The unit the reader's Edit Unit dialog opens on, beside its New Group and Add Owner dialogs; none, no dialog. */
  unitId: string | null;
}

function Reader({
  seen,
  index,
  editing,
  collectionEditing,
  installmentId,
  unitId,
}: ReaderProps): ReactElement {
  const {
    useSession,
    useAmountLocale,
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
    useCollectionWizard,
    useSchedule,
    useScheduleGrid,
    useBudgetInstallmentsWizard,
    useAllocation,
    useCoefficientsGrid,
    useAllocationGrid,
    useBudgetAllocationWizard,
    useTableDialog,
    useUnits,
    useUnitsGrid,
    useUnitOwnersGrid,
    useContacts,
  } = useViewModel();

  seen[index] = {
    session: useSession(),
    amountLocale: useAmountLocale(),
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
    columns: useColumns("accounts", COLUMNS),
    split: useSplit("accounts"),
    bottomTab: useBottomTab("accounts", TABS),
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
    collection: useCollectionWizard(collectionEditing),
    schedule: useSchedule(),
    scheduleGrid: useScheduleGrid(),
    budgetInstallments: useBudgetInstallmentsWizard(),
    allocation: useAllocation(),
    coefficientsGrid: useCoefficientsGrid(),
    allocationGrid: useAllocationGrid(),
    budgetAllocation: useBudgetAllocationWizard(),
    tableDialog: useTableDialog(null),
    installmentDialog: null,
    units: useUnits(),
    unitsGrid: useUnitsGrid(),
    unitOwnersGrid: useUnitOwnersGrid(),
    unitDialog: null,
    groupDialog: null,
    ownerDialog: null,
    contacts: useContacts(),
  };

  return (
    <output>
      {installmentId === null ? null : (
        <DialogReader seen={seen} index={index} installmentId={installmentId} />
      )}
      {unitId === null ? null : (
        <UnitsDialogsReader seen={seen} index={index} unitId={unitId} />
      )}
    </output>
  );
}

interface DialogReaderProps {
  seen: (Seen | undefined)[];
  index: number;
  installmentId: string;
}

/** Mounted apart, because the dialog hook needs an installment that exists. */
function DialogReader({
  seen,
  index,
  installmentId,
}: DialogReaderProps): ReactElement | null {
  const { useInstallmentDialog } = useViewModel();
  const dialog = useInstallmentDialog(installmentId);
  const entry = seen[index];

  if (entry !== undefined) {
    entry.installmentDialog = dialog;
  }

  return null;
}

interface UnitsDialogsReaderProps {
  seen: (Seen | undefined)[];
  index: number;
  unitId: string;
}

/** Mounted apart, because the Units screen's dialog hooks need a unit that exists, and a period with a unit selected. */
function UnitsDialogsReader({
  seen,
  index,
  unitId,
}: UnitsDialogsReaderProps): ReactElement | null {
  const { useUnitDialog, useGroupDialog, useOwnerDialog } = useViewModel();
  const unitDialog = useUnitDialog(unitId);
  const groupDialog = useGroupDialog(null);
  const ownerDialog = useOwnerDialog(null);
  const entry = seen[index];

  if (entry !== undefined) {
    entry.unitDialog = unitDialog;
    entry.groupDialog = groupDialog;
    entry.ownerDialog = ownerDialog;
  }

  return null;
}
