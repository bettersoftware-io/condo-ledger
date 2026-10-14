import type { ReactElement } from "react";

import { TESTIDS } from "#/ui/testids.ts";

/** The design's `＋ −` under a lines grid: a line added at the end, the last line removed. */
export function LineButtons({
  onAdd,
  onRemove,
}: LineButtonsProps): ReactElement {
  return (
    <div className="wizard-line-buttons">
      <button
        type="button"
        className="wizard-line-button"
        data-action="add"
        data-testid={TESTIDS.wizardAddLine}
        aria-label="Add line"
        onClick={onAdd}
      >
        ＋
      </button>
      <button
        type="button"
        className="wizard-line-button"
        data-action="remove"
        data-testid={TESTIDS.wizardRemoveLine}
        aria-label="Remove line"
        onClick={onRemove}
      >
        −
      </button>
    </div>
  );
}

export interface LineButtonsProps {
  onAdd: () => void;
  onRemove: () => void;
}
