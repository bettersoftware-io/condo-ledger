import { useStateObservable } from "@react-rxjs/core";

import type {
  AccountDetails,
  AccountsGridIntents,
  AccountsGridState,
  AmountLocale,
  App,
  BottomTabIntents,
  BottomTabState,
  BudgetInstallmentsForm,
  BudgetInstallmentsSummary,
  CollectionForm,
  CollectionSummary,
  ColumnSpec,
  ColumnsIntents,
  ColumnsState,
  DirectPaymentForm,
  DirectPaymentKind,
  DirectPaymentSummary,
  GenericEntryForm,
  GenericEntrySummary,
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
  PeriodSelection,
  ScheduleGridIntents,
  ScheduleGridState,
  SidebarIntents,
  SidebarState,
  SplitIntents,
  SplitState,
  WizardIntents,
  WizardState,
} from "@cl/client-core";
import type {
  AccountNode,
  Building,
  Cents,
  EntryAdded,
  EntryKind,
  Firm,
  JournalEntryView,
  Language,
  Ledger,
  Mode,
  Preferences,
  Principal,
  Result,
  ResultOf,
  Schedule,
  Theme,
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
  useColumns: (
    spec: readonly ColumnSpec[],
  ) => MachineView<ColumnsState, ColumnsIntents>;
  useSplit: () => MachineView<SplitState, SplitIntents>;
  useBottomTab: (
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
}

/** Built once at startup, in the composition root, from the application. */
export function createViewModel(app: App): ViewModel {
  const { session, buildings, accounts, journal, schedule } = app.presenters;

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
      return useMachine(app.machines.createAccountsGrid);
    },
    useColumns: (
      spec: readonly ColumnSpec[],
    ): MachineView<ColumnsState, ColumnsIntents> => {
      return useMachine(() => {
        return app.machines.createColumns(spec);
      });
    },
    useSplit: (): MachineView<SplitState, SplitIntents> => {
      return useMachine(app.machines.createSplit);
    },
    useBottomTab: (
      tabs: readonly string[],
    ): MachineView<BottomTabState, BottomTabIntents> => {
      return useMachine(() => {
        return app.machines.createBottomTab(tabs);
      });
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
      return useMachine(app.machines.createJournalGrid);
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
      return useMachine(app.machines.createScheduleGrid);
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
  };
}
