import type { ReactElement } from "react";

import { Panel } from "../Panel.tsx";
import { TESTIDS } from "../testids.ts";

import "./Placeholder.css";

/** Stands in for a screen M1 does not build: its title, and when it comes. */
export function Placeholder({ title }: PlaceholderProps): ReactElement {
  return (
    <div className="placeholder-screen">
      <Panel title={title}>
        <div className="placeholder" data-testid={TESTIDS.placeholder}>
          This screen arrives in M2.
        </div>
      </Panel>
    </div>
  );
}

export interface PlaceholderProps {
  title: string;
}
