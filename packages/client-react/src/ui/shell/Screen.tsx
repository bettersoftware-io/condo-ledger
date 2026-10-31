import type { ReactElement } from "react";

import type {
  MaximizeIntents,
  MaximizeState,
  NavigationState,
} from "@cl/client-core";
import type { MachineView } from "@cl/react-bindings";

import { AccountsScreen } from "../accounts/AccountsScreen.tsx";
import { TablesAllocationScreen } from "../allocation/TablesAllocationScreen.tsx";
import { InstallmentScheduleScreen } from "../installments/InstallmentScheduleScreen.tsx";
import { JournalScreen } from "../journal/JournalScreen.tsx";
import { UnitsScreen } from "../units/UnitsScreen.tsx";
import { menuLabel, moduleLabel } from "./labels.tsx";
import { Placeholder } from "./Placeholder.tsx";

/** The main area's content for where the person is: the Units, Thousandth Tables & Allocation, Accounts, Journal and Installment Schedule screens on their menu items, a placeholder for every screen not built yet. */
export function Screen({ module, menu, maximize }: ScreenProps): ReactElement {
  if (module === "buildings" && menu === "units") {
    return <UnitsScreen maximize={maximize} />;
  }

  if (module === "buildings" && menu === "thousandths") {
    return <TablesAllocationScreen maximize={maximize} />;
  }

  if (module === "buildings" && menu === "accounts") {
    return <AccountsScreen maximize={maximize} />;
  }

  if (module === "buildings" && menu === "journal") {
    return <JournalScreen maximize={maximize} />;
  }

  if (module === "buildings" && menu === "installments") {
    return <InstallmentScheduleScreen maximize={maximize} />;
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
