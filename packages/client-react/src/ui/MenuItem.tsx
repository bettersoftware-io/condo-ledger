import type { ReactElement, ReactNode } from "react";

import { TESTIDS } from "./testids.ts";

import "./MenuItem.css";

/** A row of a popover menu: the icon in its slot, then the label. */
export function MenuItem({
  label,
  icon,
  onClick,
}: MenuItemProps): ReactElement {
  return (
    <button
      type="button"
      className="menu-item"
      data-testid={TESTIDS.menuItem}
      role="menuitem"
      onClick={onClick}
    >
      <span className="menu-item-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="menu-item-label">{label}</span>
    </button>
  );
}

export interface MenuItemProps {
  label: string;
  /** Drawn in the 16px slot before the label, out of the item's name. */
  icon?: ReactNode;
  onClick: () => void;
}
