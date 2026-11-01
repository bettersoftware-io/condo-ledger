import type { ReactElement } from "react";

import { TESTIDS } from "../testids.ts";

import "./Sidebar.css";

/** The folded sidebar: a narrow card reading its label (MANAGEMENT, FILTERS), which brings the sidebar back. */
export function Rail({ label, title, onOpen }: RailProps): ReactElement {
  return (
    <div className="rail">
      <button
        type="button"
        className="rail-card"
        data-testid={TESTIDS.rail}
        aria-label={title}
        title={title}
        onClick={onOpen}
      >
        <span className="rail-arrow" aria-hidden="true">
          ›
        </span>
        <span className="rail-label" aria-hidden="true">
          {label}
        </span>
      </button>
    </div>
  );
}

export interface RailProps {
  /** What it reads, in capitals. */
  label: string;
  /** Its tooltip and accessible name. */
  title: string;
  onOpen: () => void;
}
