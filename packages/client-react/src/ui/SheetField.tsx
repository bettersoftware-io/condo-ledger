import type { ReactElement } from "react";

import { Row } from "./Row.tsx";

/** A read-only sheet's row: the value in its tone, or `---`, dim, when there is none. */
export function SheetField({
  label,
  value,
  tone,
}: SheetFieldProps): ReactElement {
  if (value === null || value === "") {
    return (
      <Row label={label} tone="muted">
        ---
      </Row>
    );
  }

  return (
    <Row label={label} tone={tone}>
      {value}
    </Row>
  );
}

export interface SheetFieldProps {
  label: string;
  /** Null or blank reads `---`. */
  value: string | null;
  /** How a value is drawn: a code in mono, a status in green, a link's text in the accent. */
  tone?: "mono" | "ok" | "accent";
}
