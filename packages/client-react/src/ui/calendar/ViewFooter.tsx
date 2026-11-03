import type { ReactElement } from "react";

import { TESTIDS } from "../testids.ts";

import "./ViewFooter.css";

/**
 * "View: ● Monthly ○ Weekly ○ List" under the month. Monthly is the one view
 * there is; Weekly and List are drawn switched off, and say so.
 */
export function ViewFooter(): ReactElement {
  return (
    <div className="view-footer" data-testid={TESTIDS.viewFooter}>
      <span>View:</span>
      <span className="view-footer-option" data-active="true">
        ● Monthly
      </span>
      {LATER.map((name) => {
        return (
          <button
            key={name}
            type="button"
            className="view-footer-option"
            title={NOT_YET}
            disabled
          >
            ○ {name}
          </button>
        );
      })}
    </div>
  );
}

/** The views drawn and not built. */
const LATER = ["Weekly", "List"] as const;

const NOT_YET = "Not available yet";
