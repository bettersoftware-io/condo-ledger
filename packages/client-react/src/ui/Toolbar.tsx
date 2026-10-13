import type { ReactElement, ReactNode } from "react";

import "./Toolbar.css";

/** A row of controls above a grid. */
export function Toolbar({ children }: ToolbarProps): ReactElement {
  return <div className="toolbar">{children}</div>;
}

export interface ToolbarProps {
  children: ReactNode;
}
