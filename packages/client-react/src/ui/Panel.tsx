import { Maximize2, Minimize2 } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { TESTIDS } from "./testids.ts";

import "./Panel.css";

/** A titled surface: a header with an optional meta and maximize button, and a scrolling body. */
export function Panel({
  title,
  meta,
  maximized = false,
  onToggleMaximize,
  children,
}: PanelProps): ReactElement {
  return (
    <section className="panel" data-testid={TESTIDS.panel}>
      <header className="panel-header">
        <span className="panel-title" data-testid={TESTIDS.panelTitle}>
          {title}
        </span>
        {meta === undefined ? null : <span className="panel-meta">{meta}</span>}
        {onToggleMaximize === undefined ? null : (
          <button
            type="button"
            className="panel-maximize"
            data-testid={TESTIDS.panelMaximize}
            aria-label={maximized ? "Restore" : "Maximize"}
            onClick={onToggleMaximize}
          >
            {maximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        )}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export interface PanelProps {
  title: string;
  meta?: ReactNode;
  maximized?: boolean;
  onToggleMaximize?: () => void;
  children: ReactNode;
}
