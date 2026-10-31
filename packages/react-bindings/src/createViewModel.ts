import { useStateObservable } from "@react-rxjs/core";

import type {
  AccountDetails,
  AccountsGridIntents,
  AccountsGridState,
  AllocationGridState,
  AmountLocale,
  App,
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
  DirectPaymentKind,
  DirectPaymentSummary,
  GenericEntryForm,
  GenericEntrySummary,
  GridName,
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
  Notice,
  OpeningForm,
  OpeningSummary,
  OwnerDialogState,
  PeriodSelection,
  ScheduleGridIntents,
  ScheduleGridState,
  SidebarIntents,
  SidebarState,
  SplitIntents,
  SplitName,
  SplitState,
  TabbedPanelName,
  TableDialogIntents,
  TableDialogState,
  TableView,
  TreeGridIntents,
  TreeGridState,
  UnitDialogState,
  UnitsView,
  WizardIntents,
  WizardState,
} from "@cl/client-core";
import type {
  AccountNode,
  Allocation,
  AllocationMode,
  Building,
  Cents,
  Contact,
  EntryAdded,
  EntryKind,
  Firm,
  JournalEntryView,
  Language,
  Ledger,
  Mode,
  OwnersRow,
  Preferences,
  Principal,
  Result,
  ResultOf,
  Schedule,
  Theme,
  UnitsRow,
} from "@cl/domain";

import { type MachineView, useMachine } from "./useMachine.ts";
import { useSharedMachine } from "./useSharedMachine.ts";

/** Who is signed in, how they like the screen, and how to change it. */
export interface SessionView {
  principal: Principal | null;
  firm: Firm | null;
  preferences: Preferences;
  setMode: (mode: Mode) => Promise<Result>;
  setTheme: (theme: Theme) => Promise<Result>;
  setLanguage: (language: Language) => Promise<Result>;
}

export interface SelectedPeriodView {
  selected: PeriodSelection | null;
  selectPeriod: (periodId: string) => void;
}

export interface SelectedAccountView {
  key: string;
  node: AccountNode | null;
  select: (key: string) => void;
}

/** A wizard as the UI reads it: its state and its intents. */
type WizardView<
  TForm,
  TSummary,
  TSaved extends Result = ResultOf<EntryAdded>,
> = MachineView<WizardState<TForm, TSummary>, WizardIntents<TForm, TSaved>>;

/** The period's installment schedule, and the writes the UI may ask of it. */
export interface ScheduleView {
  schedule: Schedule | null;
  deleteInstallment: (id: string) => Promise<Result>;
  setItemAmount: (itemId: string, amount: Cents) => Promise<Result>;
}

/**
 * The Thousandth Tables & Allocation screen: the period's tables and the one
 * selected, the allocation in the mode chosen, and the writes. The selection and the mode are the application's, so every
 * reader, and the grids, follow the same ones.
 */
export interface AllocationView {
  tables: TableView[];
  /** The table whose coefficients are shown; null while the period has none. */
  selectedTableId: string | null;
  /** Null while the period's books or tables are on their way. */
  allocation: Allocation | null;
  mode: AllocationMode;
  chooseMode: (mode: AllocationMode) => void;
  selectTable: (tableId: string) => void;
  deleteTable: (id: string) => Promise<Result>;
  /** The account's path in the selected period's books, as a refusal names it; its id when they do not hold it. */
  accountPath: (accountId: string) => string;
  /** Reads the text in the session's locale: text that does not read, or a negative coefficient, is refused `not-a-coefficient`. */
  setCoefficient: (
    tableId: string,
    unitId: string,
    text: string,
  ) => Promise<Result>;
}

/**
 * The Units, Owners & Personal Balance screen: the grid with its selected
 * row and what the bottom tabs show of it, the breadcrumb's last crumb, and
 * the selection. The selection is the application's, so the grid, the tabs
 * and the breadcrumb follow the same one.
 */
export interface UnitsScreenView {
  /** Null while there is no period, or while its units are on their way. */
  view: UnitsView | null;
  /** The selected unit's code (a resident's unit's), or the selected group's; null for the root and the rounding row. */
  crumb: string | null;
  select: (key: string) => void;
  deleteGroup: (groupId: string) => Promise<Result>;
  deleteUnit: (unitId: string) => Promise<Result>;
  deleteResident: (residentId: string) => Promise<Result>;
}

export interface NoticesView {
  notices: Notice[];
  stub: (label: string) => void;
  clear: (id: number) => void;
}

/**
 * Everything the UI can read or do, as hooks. This is the UI's only door to
 * the application: a component never sees a stream, a port or an adapter.
 * One hook per presenter stream and per machine: a hook never combines two
 * streams itself.
 *
 * The grids, their columns, the splits and the tabbed panels are the
 * application's (`App.screens`), kept for the session: every mount of one
 * reads and changes the same state, so leaving a screen and coming back
 * finds it as it was left. A dialog, a wizard and the shell's own parts get
 * a machine per mount.
 */
export interface ViewModel {
  useSession: () => SessionView;
  /** The locale amounts are shown and typed in: the session language's. */
  useAmountLocale: () => AmountLocale;
  useBuildingsTree: () => Building[];
  useSelectedPeriod: () => SelectedPeriodView;
  useAccountsTree: () => AccountNode | null;
  useSelectedAccount: () => SelectedAccountView;
  useLedger: () => Ledger | null;
  useAccountDetails: () => AccountDetails | null;
  useSetBudget: () => (accountId: string, budget: Cents) => Promise<Result>;
  useNavigation: () => MachineView<NavigationState, NavigationIntents>;
  useNotices: () => NoticesView;
  useAccountsGrid: () => MachineView<AccountsGridState, AccountsGridIntents>;
  /**
   * The widths of the named grid's columns, for the columns given on this
   * render: a grid keeps widths for each set of columns it is drawn with, so
   * a spec that changes between renders (another count of installments, say)
   * reads the widths kept for it.
   */
  useColumns: (
    grid: GridName,
    spec: readonly ColumnSpec[],
  ) => MachineView<ColumnsState, ColumnsIntents>;
  useSplit: (split: SplitName) => MachineView<SplitState, SplitIntents>;
  /** The named panel's tab in front, for the tabs given on this render, as `useColumns` reads its spec. */
  useBottomTab: (
    panel: TabbedPanelName,
    tabs: readonly string[],
  ) => MachineView<BottomTabState, BottomTabIntents>;
  useMaximize: () => MachineView<MaximizeState, MaximizeIntents>;
  useSidebar: () => MachineView<SidebarState, SidebarIntents>;
  useJournalEntries: () => JournalEntryView[];
  useJournalContext: () => JournalContext | null;
  useDeleteEntry: () => (id: string) => Promise<Result>;
  useJournalGrid: () => MachineView<JournalGridState, JournalGridIntents>;
  useJournalDialog: () => MachineView<JournalDialogState, JournalDialogIntents>;
  /**
   * Every wizard hook reads its arguments on the first render only: the wizard is built once, for the
   * kind it opened as and the entry (`editing`, an id the dialog resolved, or null for a new entry) it opened on.
   */
  useDirectPaymentWizard: (
    kind: DirectPaymentKind,
    editing: string | null,
  ) => WizardView<DirectPaymentForm, DirectPaymentSummary>;
  useMultiCostPaymentWizard: (
    editing: string | null,
  ) => WizardView<MultiCostPaymentForm, MultiCostPaymentSummary>;
  /** `kind` is left out unless the caller chose one: an edit takes its entry's own kind. */
  useGenericEntryWizard: (
    editing: string | null,
    kind?: EntryKind,
  ) => WizardView<GenericEntryForm, GenericEntrySummary>;
  useInvoiceWizard: (
    editing: string | null,
  ) => WizardView<InvoiceForm, InvoiceSummary>;
  useInvoicePaymentWizard: (
    editing: string | null,
  ) => WizardView<InvoicePaymentForm, InvoicePaymentSummary>;
  useOpeningBalancesWizard: (
    editing: string | null,
  ) => WizardView<OpeningForm, OpeningSummary>;
  useCollectionWizard: (
    editing: string | null,
  ) => WizardView<CollectionForm, CollectionSummary>;
  useSchedule: () => ScheduleView;
  useScheduleGrid: () => MachineView<ScheduleGridState, ScheduleGridIntents>;
  useBudgetInstallmentsWizard: () => WizardView<
    BudgetInstallmentsForm,
    BudgetInstallmentsSummary,
    Result
  >;
  /** Reads its argument on the first render only: the dialog is built once, for the installment it opened on. */
  useInstallmentDialog: (
    installmentId: string,
  ) => MachineView<InstallmentDialogState, InstallmentDialogIntents>;
  /** The Budget allocation wizard over the selected period's books and budget allocation as they stand when it opens. */
  useBudgetAllocationWizard: () => WizardView<
    BudgetAllocationForm,
    BudgetAllocationSummary
  >;
  /** Reads its argument on the first render only: the New Thousandth Table dialog (null) or the Edit one on the table it opened on. */
  useTableDialog: (
    editing: string | null,
  ) => MachineView<TableDialogState, TableDialogIntents>;
  useAllocation: () => AllocationView;
  /** The selected table's coefficients tree: which of its groups are open. */
  useCoefficientsGrid: () => MachineView<
    CoefficientsGridState,
    TreeGridIntents
  >;
  /** The allocation in the chosen mode: which of its rows are open. */
  useAllocationGrid: () => MachineView<AllocationGridState, TreeGridIntents>;
  useUnits: () => UnitsScreenView;
  /** The Units grid: which of its rows are open. */
  useUnitsGrid: () => MachineView<TreeGridState<UnitsRow>, TreeGridIntents>;
  /** The Unit Owners tab of the selected unit: which of its rows are open. */
  useUnitOwnersGrid: () => MachineView<
    TreeGridState<OwnersRow>,
    TreeGridIntents
  >;
  /** Reads its argument on the first render only: the New Unit dialog (null) or the Edit Unit one on the unit it opened on. */
  useUnitDialog: (
    editing: string | null,
  ) => MachineView<UnitDialogState, DialogIntents<UnitDialogState["form"]>>;
  /** Reads its argument on the first render only: the New Group dialog (null), under the selected row's group, or the Edit Group one on the group it opened on. */
  useGroupDialog: (
    editing: string | null,
  ) => MachineView<GroupDialogState, DialogIntents<GroupDialogState["form"]>>;
  /** Reads its argument on the first render only: the Add Owner dialog (null) on the selected unit, or the Edit Owner one on the resident it opened on. */
  useOwnerDialog: (
    editing: string | null,
  ) => MachineView<OwnerDialogState, DialogIntents<OwnerDialogState["form"]>>;
  /** The contacts an owner can be linked to. */
  useContacts: () => Contact[];
}

/** Built once at startup, in the composition root, from the application. */
export function createViewModel(app: App): ViewModel {
  const { session, buildings, accounts, journal, schedule, allocation, units } =
    app.presenters;
  const { screens } = app;

  return {
    useSession: (): SessionView => {
      return {
        principal: useStateObservable(session.principal$),
        firm: useStateObservable(session.firm$),
        preferences: useStateObservable(session.preferences$),
        setMode: session.setMode,
        setTheme: session.setTheme,
        setLanguage: session.setLanguage,
      };
    },
    useAmountLocale: (): AmountLocale => {
      return useStateObservable(session.amountLocale$);
    },
    useBuildingsTree: (): Building[] => {
      return useStateObservable(buildings.tree$);
    },
    useSelectedPeriod: (): SelectedPeriodView => {
      return {
        selected: useStateObservable(buildings.selected$),
        selectPeriod: buildings.selectPeriod,
      };
    },
    useAccountsTree: (): AccountNode | null => {
      return useStateObservable(accounts.tree$);
    },
    useSelectedAccount: (): SelectedAccountView => {
      return {
        key: useStateObservable(accounts.selectedKey$),
        node: useStateObservable(accounts.selectedNode$),
        select: accounts.select,
      };
    },
    useLedger: (): Ledger | null => {
      return useStateObservable(accounts.ledger$);
    },
    useAccountDetails: (): AccountDetails | null => {
      return useStateObservable(accounts.details$);
    },
    useSetBudget: (): ((
      accountId: string,
      budget: Cents,
    ) => Promise<Result>) => {
      return accounts.setBudget;
    },
    useNavigation: (): MachineView<NavigationState, NavigationIntents> => {
      return useSharedMachine(app.navigation);
    },
    useNotices: (): NoticesView => {
      return {
        notices: useStateObservable(app.notices.notices$),
        stub: app.notices.stub,
        clear: app.notices.clear,
      };
    },
    useAccountsGrid: (): MachineView<
      AccountsGridState,
      AccountsGridIntents
    > => {
      return useSharedMachine(screens.accountsGrid());
    },
    useColumns: (
      grid: GridName,
      spec: readonly ColumnSpec[],
    ): MachineView<ColumnsState, ColumnsIntents> => {
      return useSharedMachine(screens.columns(grid, spec));
    },
    useSplit: (split: SplitName): MachineView<SplitState, SplitIntents> => {
      return useSharedMachine(screens.split(split));
    },
    useBottomTab: (
      panel: TabbedPanelName,
      tabs: readonly string[],
    ): MachineView<BottomTabState, BottomTabIntents> => {
      return useSharedMachine(screens.bottomTab(panel, tabs));
    },
    useMaximize: (): MachineView<MaximizeState, MaximizeIntents> => {
      return useMachine(app.machines.createMaximize);
    },
    useSidebar: (): MachineView<SidebarState, SidebarIntents> => {
      return useMachine(app.machines.createSidebar);
    },
    useJournalEntries: (): JournalEntryView[] => {
      return useStateObservable(journal.entries$);
    },
    useJournalContext: (): JournalContext | null => {
      return useStateObservable(journal.context$);
    },
    useDeleteEntry: (): ((id: string) => Promise<Result>) => {
      return journal.deleteEntry;
    },
    useJournalGrid: (): MachineView<JournalGridState, JournalGridIntents> => {
      return useSharedMachine(screens.journalGrid());
    },
    useJournalDialog: (): MachineView<
      JournalDialogState,
      JournalDialogIntents
    > => {
      return useMachine(app.machines.createJournalDialog);
    },
    useDirectPaymentWizard: (
      kind: DirectPaymentKind,
      editing: string | null,
    ): WizardView<DirectPaymentForm, DirectPaymentSummary> => {
      return useMachine(() => {
        return app.machines.createDirectPaymentWizard(kind, editing);
      });
    },
    useMultiCostPaymentWizard: (
      editing: string | null,
    ): WizardView<MultiCostPaymentForm, MultiCostPaymentSummary> => {
      return useMachine(() => {
        return app.machines.createMultiCostPaymentWizard(editing);
      });
    },
    useGenericEntryWizard: (
      editing: string | null,
      kind?: EntryKind,
    ): WizardView<GenericEntryForm, GenericEntrySummary> => {
      return useMachine(() => {
        return app.machines.createGenericEntryWizard(editing, kind);
      });
    },
    useInvoiceWizard: (
      editing: string | null,
    ): WizardView<InvoiceForm, InvoiceSummary> => {
      return useMachine(() => {
        return app.machines.createInvoiceWizard(editing);
      });
    },
    useInvoicePaymentWizard: (
      editing: string | null,
    ): WizardView<InvoicePaymentForm, InvoicePaymentSummary> => {
      return useMachine(() => {
        return app.machines.createInvoicePaymentWizard(editing);
      });
    },
    useOpeningBalancesWizard: (
      editing: string | null,
    ): WizardView<OpeningForm, OpeningSummary> => {
      return useMachine(() => {
        return app.machines.createOpeningBalancesWizard(editing);
      });
    },
    useCollectionWizard: (
      editing: string | null,
    ): WizardView<CollectionForm, CollectionSummary> => {
      return useMachine(() => {
        return app.machines.createCollectionWizard(editing);
      });
    },
    useSchedule: (): ScheduleView => {
      return {
        schedule: useStateObservable(schedule.schedule$),
        deleteInstallment: schedule.deleteInstallment,
        setItemAmount: schedule.setItemAmount,
      };
    },
    useScheduleGrid: (): MachineView<
      ScheduleGridState,
      ScheduleGridIntents
    > => {
      return useSharedMachine(screens.scheduleGrid());
    },
    useBudgetInstallmentsWizard: (): WizardView<
      BudgetInstallmentsForm,
      BudgetInstallmentsSummary,
      Result
    > => {
      return useMachine(app.machines.createBudgetInstallmentsWizard);
    },
    useInstallmentDialog: (
      installmentId: string,
    ): MachineView<InstallmentDialogState, InstallmentDialogIntents> => {
      return useMachine(() => {
        return app.machines.createInstallmentDialog(installmentId);
      });
    },
    useBudgetAllocationWizard: (): WizardView<
      BudgetAllocationForm,
      BudgetAllocationSummary
    > => {
      return useMachine(app.machines.createBudgetAllocationWizard);
    },
    useTableDialog: (
      editing: string | null,
    ): MachineView<TableDialogState, TableDialogIntents> => {
      return useMachine(() => {
        return app.machines.createTableDialog(editing);
      });
    },
    useAllocation: (): AllocationView => {
      const tableSelection = screens.tableSelection();
      const allocationMode = screens.allocationMode();
      const { tableId } = useStateObservable(tableSelection.state$);
      const { mode } = useStateObservable(allocationMode.state$);

      return {
        tables: useStateObservable(allocation.tables$),
        selectedTableId: tableId,
        allocation: useStateObservable(allocation.allocation$(mode)),
        mode,
        chooseMode: allocationMode.intents.choose,
        selectTable: tableSelection.intents.select,
        deleteTable: allocation.deleteTable,
        accountPath: allocation.accountPath,
        setCoefficient: allocation.setCoefficient,
      };
    },
    useCoefficientsGrid: (): MachineView<
      CoefficientsGridState,
      TreeGridIntents
    > => {
      return useSharedMachine(screens.coefficientsGrid());
    },
    useAllocationGrid: (): MachineView<
      AllocationGridState,
      TreeGridIntents
    > => {
      return useSharedMachine(screens.allocationGrid());
    },
    useUnits: (): UnitsScreenView => {
      return {
        view: useStateObservable(units.view$),
        crumb: useStateObservable(units.crumb$),
        select: units.select,
        deleteGroup: units.deleteGroup,
        deleteUnit: units.deleteUnit,
        deleteResident: units.deleteResident,
      };
    },
    useUnitsGrid: (): MachineView<TreeGridState<UnitsRow>, TreeGridIntents> => {
      return useSharedMachine(screens.unitsGrid());
    },
    useUnitOwnersGrid: (): MachineView<
      TreeGridState<OwnersRow>,
      TreeGridIntents
    > => {
      return useSharedMachine(screens.unitOwnersGrid());
    },
    useUnitDialog: (
      editing: string | null,
    ): MachineView<UnitDialogState, DialogIntents<UnitDialogState["form"]>> => {
      return useMachine(() => {
        return app.machines.createUnitDialog(editing);
      });
    },
    useGroupDialog: (
      editing: string | null,
    ): MachineView<
      GroupDialogState,
      DialogIntents<GroupDialogState["form"]>
    > => {
      return useMachine(() => {
        return app.machines.createGroupDialog(editing);
      });
    },
    useOwnerDialog: (
      editing: string | null,
    ): MachineView<
      OwnerDialogState,
      DialogIntents<OwnerDialogState["form"]>
    > => {
      return useMachine(() => {
        return app.machines.createOwnerDialog(editing);
      });
    },
    useContacts: (): Contact[] => {
      return useStateObservable(units.contacts$);
    },
  };
}
