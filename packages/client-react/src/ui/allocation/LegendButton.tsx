import type { ReactElement } from "react";

import { TESTIDS } from "../testids.ts";

import "./LegendButton.css";

/** The panel header's "ⓘ Legend": the design gives it no content yet, so it posts its notice. */
export function LegendButton({ onStub }: LegendButtonProps): ReactElement {
  function stub(): void {
    onStub("Legend");
  }

  return (
    <button
      type="button"
      className="legend-button"
      data-testid={TESTIDS.panelLegend}
      onClick={stub}
    >
      ⓘ Legend
    </button>
  );
}

export interface LegendButtonProps {
  /** A tool that is not built yet, by name. */
  onStub: (label: string) => void;
}
