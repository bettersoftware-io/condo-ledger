import type { ReactElement, ReactNode } from "react";

import { TESTIDS } from "./testids.ts";

import "./Toolbar.css";

/**
 * A button with an icon and a label; `iconOnly` keeps the label for assistive
 * technology alone, and `text` shows something else in its place (a chip's
 * value). A button that opens a menu says so, and whether it is open.
 */
export function ToolbarButton({
  label,
  icon,
  text,
  tone = "plain",
  iconOnly = false,
  disabled = false,
  menuOpen,
  onClick,
}: ToolbarButtonProps): ReactElement {
  return (
    <button
      type="button"
      className="toolbar-button"
      data-testid={TESTIDS.toolbarButton}
      data-tone={tone}
      data-icon-only={iconOnly}
      aria-label={label}
      aria-haspopup={menuOpen === undefined ? undefined : "menu"}
      aria-expanded={menuOpen}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      {iconOnly ? null : <span>{text ?? label}</span>}
    </button>
  );
}

export interface ToolbarButtonProps {
  /** The button's accessible name, and its visible text unless `text` or `iconOnly` says otherwise. */
  label: string;
  icon?: ReactNode;
  /** Drawn in place of the label, which stays the button's name. */
  text?: ReactNode;
  tone?: "ok" | "neg" | "muted" | "plain";
  iconOnly?: boolean;
  disabled?: boolean;
  /** Set on a button that opens a menu: whether that menu is open. */
  menuOpen?: boolean;
  onClick: () => void;
}
