import { useStateObservable } from "@react-rxjs/core";

import type {
  AccountDetails,
  AccountsGridIntents,
  AccountsGridState,
  App,
  BottomTabIntents,
  BottomTabState,
  ColumnSpec,
  ColumnsIntents,
  ColumnsState,
  MaximizeIntents,
  MaximizeState,
  NavigationIntents,
  NavigationState,
  Notice,
  PeriodSelection,
  SidebarIntents,
  SidebarState,
  SplitIntents,
  SplitState,
} from "@cl/client-core";
import type {
  AccountNode,
  Building,
  Cents,
  Firm,
  Language,
  Ledger,
  Mode,
  Preferences,
  Principal,
  Result,
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
}

/** Built once at startup, in the composition root, from the application. */
export function createViewModel(app: App): ViewModel {
  const { session, buildings, accounts } = app.presenters;

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
  };
}
