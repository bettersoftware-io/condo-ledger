import type { ReactElement } from "react";

import type {
  MaximizeIntents,
  MaximizeState,
  NavigationState,
} from "@cl/client-core";
import type { MachineView } from "@cl/react-bindings";

import { AccountsScreen } from "../accounts/AccountsScreen.tsx";
import { JournalScreen } from "../journal/JournalScreen.tsx";
import { menuLabel, moduleLabel } from "./labels.tsx";
import { Placeholder } from "./Placeholder.tsx";

/** The main area's content for where the person is: the Accounts and Journal screens on their menu items, a placeholder for every screen not built yet. */
export function Screen({ module, menu, maximize }: ScreenProps): ReactElement {
  if (module === "buildings" && menu === "accounts") {
    return <AccountsScreen maximize={maximize} />;
  }

  if (module === "buildings" && menu === "journal") {
    return <JournalScreen maximize={maximize} />;
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
