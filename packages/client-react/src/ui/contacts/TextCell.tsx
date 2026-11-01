import type { ReactElement } from "react";

import "./contactCells.css";

/** A text of a contact's grid: its value, dim, cut with an ellipsis; `---` when there is none. */
export function TextCell({ value, mono = false }: TextCellProps): ReactElement {
  if (value === null || value === "") {
    return (
      <span className="contact-text" data-blank="true" data-mono={mono}>
        ---
      </span>
    );
  }

  return (
    <span
      className="contact-text"
      data-blank="false"
      data-mono={mono}
      title={value}
    >
      {value}
    </span>
  );
}

export interface TextCellProps {
  value: string | null;
  /** In the mono face, for a code. */
  mono?: boolean;
}
