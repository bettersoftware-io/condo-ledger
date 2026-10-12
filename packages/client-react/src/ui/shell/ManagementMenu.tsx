import type { ReactElement } from "react";

import type { NavigationState } from "@cl/client-core";

import { MENU_ITEMS } from "./labels.tsx";

import "./Sidebar.css";

/** The Buildings module's six screens; the active one is marked with the accent bar and ▸. */
export function ManagementMenu({
  active,
  onSelect,
}: ManagementMenuProps): ReactElement {
  function selectingMenu(menu: Menu): () => void {
    return (): void => {
      onSelect(menu);
    };
  }

  return (
    <nav className="management-menu" aria-label="Management Menu">
      {MENU_ITEMS.map((item) => {
        return (
          <button
            key={item.id}
            type="button"
            className="management-menu-item"
            aria-current={item.id === active ? "page" : undefined}
            onClick={selectingMenu(item.id)}
          >
            <span className="management-menu-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="management-menu-label">{item.label}</span>
            <span className="management-menu-arrow" aria-hidden="true">
              ▸
            </span>
          </button>
        );
      })}
    </nav>
  );
}

type Menu = NavigationState["menu"];

export interface ManagementMenuProps {
  active: Menu;
  onSelect: (menu: Menu) => void;
}
