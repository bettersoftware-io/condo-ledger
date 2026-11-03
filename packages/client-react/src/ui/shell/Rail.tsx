import type { ReactElement } from "react";

import { TESTIDS } from "../testids.ts";

import "./Sidebar.css";

/** The folded sidebar (or column): a narrow card reading its label (MANAGEMENT, FILTERS), which brings the sidebar back. */
export function Rail({
  label,
  title,
  side = "left",
  onOpen,
}: RailProps): ReactElement {
  return (
    <div className="rail" data-side={side}>
      <button
        type="button"
        className="rail-card"
        data-testid={TESTIDS.rail}
        aria-label={title}
        title={title}
        onClick={onOpen}
      >
        <span className="rail-arrow" aria-hidden="true">
          {side === "left" ? "›" : "‹"}
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
  /** The edge it stands at; its arrow points inward. Left by default. */
  side?: "left" | "right";
  onOpen: () => void;
}
