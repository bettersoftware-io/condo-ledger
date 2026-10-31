import {
  BookOpen,
  BuildingComplex,
  Calculator,
  ChartColumn,
  ClipboardList,
  Receipt,
} from "lucide-react";
import type { ReactNode } from "react";

import type { NavigationState } from "@cl/client-core";
import { type Building, PERIOD_TYPE_WORDS } from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

// What the shell calls the places it leads to. Its own module, apart from the
// components that draw them: a component file exports components only.

type Module = NavigationState["module"];

type Menu = NavigationState["menu"];

type Period = Building["periods"][number];

interface ModuleTab {
  id: Module;
  label: string;
  /** The dot's colour on the active tab; an inactive tab's dot is the chrome's dim text. */
  color: string;
}

interface MenuItem {
  id: Menu;
  label: string;
  icon: ReactNode;
}

/** The module tabs, in the top bar's order. */
export const MODULE_TABS: readonly ModuleTab[] = [
  { id: "calendar", label: "Calendar", color: "#3aa0e0" },
  { id: "buildings", label: "Buildings", color: "#2f6fed" },
  { id: "contacts", label: "Contacts", color: "#7f8c8d" },
];

/** The Buildings module's six screens, in the README's order. Lucide's current names: BuildingComplex was Building2, ChartColumn was BarChart3. */
export const MENU_ITEMS: readonly MenuItem[] = [
  {
    id: "data",
    label: "Building Data & Suppliers",
    icon: <BuildingComplex size={13} />,
  },
  {
    id: "units",
    label: "Units, Owners & Personal Balance",
    icon: <ClipboardList size={13} />,
  },
  {
    id: "thousandths",
    label: "Thousandth Tables & Allocation",
    icon: <Calculator size={13} />,
  },
  {
    id: "accounts",
    label: "Accounts, Ledgers & Balance",
    icon: <ChartColumn size={13} />,
  },
  { id: "journal", label: "Journal & Daybook", icon: <BookOpen size={13} /> },
  {
    id: "installments",
    label: "Installment Schedule",
    icon: <Receipt size={13} />,
  },
];

/** What a module is called on its tab, in the breadcrumb and on its placeholder. */
export function moduleLabel(module: Module): string {
  return must(
    MODULE_TABS.find((tab) => {
      return tab.id === module;
    }),
    `the module tab ${module}`,
  ).label;
}

/** What a menu item is called in the menu, in the breadcrumb and on its placeholder. */
export function menuLabel(menu: Menu): string {
  return must(
    MENU_ITEMS.find((item) => {
      return item.id === menu;
    }),
    `the menu item ${menu}`,
  ).label;
}

/** How a period is named in the sidebar and the breadcrumb: "2013 (Ordinary)". */
export function periodLabel(period: Period): string {
  return `${period.name} (${PERIOD_TYPE_WORDS[period.type]})`;
}
