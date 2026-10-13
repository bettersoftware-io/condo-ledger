import type { ReactElement, ReactNode } from "react";

import { TESTIDS } from "./testids.ts";

import "./Scheda.css";

/** A record sheet: labelled rows in a grid. */
export function Scheda({ wide = false, children }: SchedaProps): ReactElement {
  return (
    <div className="scheda" data-testid={TESTIDS.scheda} data-wide={wide}>
      {children}
    </div>
  );
}

export interface SchedaProps {
  /** A 300px label column (Accounts) instead of 170px. */
  wide?: boolean;
  children: ReactNode;
}
