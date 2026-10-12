import type { ReactElement } from "react";

import { useViewModel } from "@cl/react-bindings";

import { TESTIDS } from "../testids.ts";
import { Breadcrumb } from "./Breadcrumb.tsx";
import { Screen } from "./Screen.tsx";
import { Sidebar } from "./Sidebar.tsx";
import { ToastHost } from "./ToastHost.tsx";
import { TopBar } from "./TopBar.tsx";

import "./AppRoot.css";

/**
 * The shell. Carries the person's theme and mode on its root element, where
 * the tokens read them. Holds the one sidebar and the one maximize machine
 * the shell shares: the sidebar keeps its width while another module is
 * shown, and the rail stands in for it while a panel of the main area is
 * maximized.
 */
export function AppRoot(): ReactElement {
  const { useSession, useNavigation, useSidebar, useMaximize } = useViewModel();
  const { preferences } = useSession();
  const navigation = useNavigation();
  const sidebar = useSidebar();
  const maximize = useMaximize();
  const maximized = maximize.state.maximized !== null;

  return (
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
          <Sidebar
            width={sidebar.state.width}
            open={sidebar.state.open}
            maximized={maximized}
            onResize={sidebar.resize}
            onOpen={sidebar.open}
            onClose={sidebar.close}
            onRestore={maximize.restore}
          />
        ) : null}
        <main className="app-main" data-testid={TESTIDS.appMain}>
          <Screen
            module={navigation.state.module}
            menu={navigation.state.menu}
          />
        </main>
      </div>
      <ToastHost />
    </div>
  );
}
