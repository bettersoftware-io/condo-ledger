import type { ReactElement } from "react";

import type {
  MaximizeIntents,
  MaximizeState,
  NavigationState,
} from "@cl/client-core";
import type { MachineView } from "@cl/react-bindings";

import { AccountsScreen } from "../accounts/AccountsScreen.tsx";
import { menuLabel, moduleLabel } from "./labels.tsx";
import { Placeholder } from "./Placeholder.tsx";

/** The main area's content for where the person is: the Accounts screen on its menu item, a placeholder for every screen not built yet. */
export function Screen({ module, menu, maximize }: ScreenProps): ReactElement {
  if (module === "buildings" && menu === "accounts") {
    return <AccountsScreen maximize={maximize} />;
  }

  return (
    <Placeholder
      title={module === "buildings" ? menuLabel(menu) : moduleLabel(module)}
    />
  );
}

export interface ScreenProps {
  module: NavigationState["module"];
  menu: NavigationState["menu"];
  /** The shell's, so a screen's maximized panel folds the sidebar too. */
  maximize: MachineView<MaximizeState, MaximizeIntents>;
}
