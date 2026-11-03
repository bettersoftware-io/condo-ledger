import type { ReactElement } from "react";

import type {
  MaximizeIntents,
  MaximizeState,
  NavigationState,
} from "@cl/client-core";
import type { MachineView } from "@cl/react-bindings";

import { AccountsScreen } from "../accounts/AccountsScreen.tsx";
import { TablesAllocationScreen } from "../allocation/TablesAllocationScreen.tsx";
import { BuildingDataScreen } from "../buildingData/BuildingDataScreen.tsx";
import { CalendarScreen } from "../calendar/CalendarScreen.tsx";
import { ContactsScreen } from "../contacts/ContactsScreen.tsx";
import { InstallmentScheduleScreen } from "../installments/InstallmentScheduleScreen.tsx";
import { JournalScreen } from "../journal/JournalScreen.tsx";
import { UnitsScreen } from "../units/UnitsScreen.tsx";

/** The main area's content for where the person is: the Calendar and Contacts screens in their modules, and in Buildings the screen of its menu item. */
export function Screen({ module, menu, maximize }: ScreenProps): ReactElement {
  switch (module) {
    case "calendar":
      return <CalendarScreen />;
    case "contacts":
      return <ContactsScreen maximize={maximize} />;
    case "buildings":
      return buildingsScreen(menu, maximize);
  }
}

export interface ScreenProps {
  module: NavigationState["module"];
  menu: NavigationState["menu"];
  /** The shell's, so a screen's maximized panel folds the sidebar too. */
  maximize: MachineView<MaximizeState, MaximizeIntents>;
}

/** The Buildings module's screen for a menu item: Building Data & Suppliers, Units, Thousandth Tables & Allocation, Accounts, Journal or Installment Schedule. */
function buildingsScreen(
  menu: NavigationState["menu"],
  maximize: MachineView<MaximizeState, MaximizeIntents>,
): ReactElement {
  switch (menu) {
    case "data":
      return <BuildingDataScreen maximize={maximize} />;
    case "units":
      return <UnitsScreen maximize={maximize} />;
    case "thousandths":
      return <TablesAllocationScreen maximize={maximize} />;
    case "accounts":
      return <AccountsScreen maximize={maximize} />;
    case "journal":
      return <JournalScreen maximize={maximize} />;
    case "installments":
      return <InstallmentScheduleScreen maximize={maximize} />;
  }
}
