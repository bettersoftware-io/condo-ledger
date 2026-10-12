import type { ReactElement, ReactNode } from "react";

import { TESTIDS } from "./testids.ts";

import "./Toolbar.css";

/** A button with an icon and a label; `iconOnly` keeps the label for assistive technology alone. */
export function ToolbarButton({
  label,
  icon,
  tone = "plain",
  iconOnly = false,
  disabled = false,
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
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      {iconOnly ? null : <span>{label}</span>}
    </button>
  );
}

export interface ToolbarButtonProps {
  label: string;
  icon?: ReactNode;
  tone?: "ok" | "neg" | "muted" | "plain";
  iconOnly?: boolean;
  disabled?: boolean;
  onClick: () => void;
}
