import type { ReactElement } from "react";

import { useViewModel } from "@cl/react-bindings";

import { AmountLocaleProvider } from "../AmountLocaleProvider.tsx";
import { DeadlinesColumn } from "../calendar/DeadlinesColumn.tsx";
import { FiltersSidebar } from "../contacts/FiltersSidebar.tsx";
import { TESTIDS } from "../testids.ts";
import { Breadcrumb } from "./Breadcrumb.tsx";
import { Screen } from "./Screen.tsx";
import { Sidebar } from "./Sidebar.tsx";
import { ToastHost } from "./ToastHost.tsx";
import { TopBar } from "./TopBar.tsx";

import "./AppRoot.css";

/**
 * The shell. Carries the person's theme and mode on its root element, where
 * the tokens read them, and hands their amount locale to everything inside. Holds the one sidebar, the Calendar's deadlines column and the one maximize machine
 * the shell shares: the sidebar and the column keep their width while another module is
 * shown, and the rail stands in for it while a panel of the main area is
 * maximized.
 */
export function AppRoot(): ReactElement {
  const {
    useSession,
    useNavigation,
    useSidebar,
    useDeadlinesColumn,
    useMaximize,
  } = useViewModel();
  const { preferences } = useSession();
  const navigation = useNavigation();
  const sidebar = useSidebar();
  const deadlines = useDeadlinesColumn();
  const maximize = useMaximize();
  const maximized = maximize.state.maximized !== null;
  const frame = {
    width: sidebar.state.width,
    open: sidebar.state.open,
    maximized,
    onResize: sidebar.resize,
    onOpen: sidebar.open,
    onClose: sidebar.close,
    onRestore: maximize.restore,
  };

  const deadlinesFrame = {
    width: deadlines.state.width,
    open: deadlines.state.open,
    onResize: deadlines.resize,
    onOpen: deadlines.open,
    onClose: deadlines.close,
  };

  return (
    <AmountLocaleProvider>
      <div
        className="app-root"
        data-theme={preferences.theme}
        data-mode={preferences.mode}
        data-testid={TESTIDS.appRoot}
      >
        <TopBar />
        <Breadcrumb />
        <div className="app-body" data-maximized={maximized}>
          {navigation.state.module === "buildings" ? (
            <Sidebar {...frame} />
          ) : null}
          {navigation.state.module === "contacts" ? (
            <FiltersSidebar {...frame} />
          ) : null}
          <main className="app-main" data-testid={TESTIDS.appMain}>
            <Screen
              module={navigation.state.module}
              menu={navigation.state.menu}
              maximize={maximize}
            />
          </main>
          {navigation.state.module === "calendar" ? (
            <DeadlinesColumn
              frame={deadlinesFrame}
              maximized={maximized}
              onRestore={maximize.restore}
            />
          ) : null}
        </div>
        <ToastHost />
      </div>
    </AmountLocaleProvider>
  );
}
