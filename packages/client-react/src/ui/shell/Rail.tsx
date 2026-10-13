import type { ReactElement } from "react";

import { TESTIDS } from "../testids.ts";

import "./Sidebar.css";

/** The folded sidebar: a narrow card reading MANAGEMENT, which brings the sidebar back. */
export function Rail({ onOpen }: RailProps): ReactElement {
  return (
    <div className="rail">
      <button
        type="button"
        className="rail-card"
        data-testid={TESTIDS.rail}
        aria-label="Open management"
        title="Open management"
        onClick={onOpen}
      >
        <span className="rail-arrow" aria-hidden="true">
          ›
        </span>
        <span className="rail-label" aria-hidden="true">
          MANAGEMENT
        </span>
      </button>
    </div>
  );
}

export interface RailProps {
  onOpen: () => void;
}
