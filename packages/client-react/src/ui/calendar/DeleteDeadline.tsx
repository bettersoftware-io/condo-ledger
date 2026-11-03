import type { ReactElement } from "react";

import { ConfirmAlert } from "../ConfirmAlert.tsx";

/** The Calendar's question before a typed deadline goes. Nothing refuses a delete, so there is no reason to show. */
export function DeleteDeadline({
  description,
  onYes,
  onNo,
}: DeleteDeadlineProps): ReactElement {
  return (
    <ConfirmAlert
      text={`Delete the deadline "${description}"? This cannot be undone.`}
      error={null}
      onYes={onYes}
      onNo={onNo}
    />
  );
}

export interface DeleteDeadlineProps {
  /** The selected deadline's description. */
  description: string;
  onYes: () => void;
  onNo: () => void;
}
