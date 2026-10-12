import type { ReactElement, ReactNode } from "react";

import { TESTIDS } from "./testids.ts";

import "./Scheda.css";

export function Row({ label, tone, children }: RowProps): ReactElement {
  return (
    <div className="scheda-row" data-testid={TESTIDS.schedaRow}>
      <span className="scheda-label">{label}</span>
      <span className="scheda-value" data-tone={tone}>
        {children}
      </span>
    </div>
  );
}

export interface RowProps {
  label: string;
  tone?: "accent" | "mono" | "muted" | "ok" | "num";
  children: ReactNode;
}
