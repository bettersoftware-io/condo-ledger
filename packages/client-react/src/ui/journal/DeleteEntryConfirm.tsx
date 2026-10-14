import type { ReactElement } from "react";

import { ConfirmAlert } from "../ConfirmAlert.tsx";

/** The Journal's question before an entry goes, with the reason when the domain refused it. */
export function DeleteEntryConfirm({
  description,
  error,
  onYes,
  onNo,
}: DeleteEntryConfirmProps): ReactElement {
  return (
    <ConfirmAlert
      text={`Delete the entry "${description}"?`}
      error={error}
      onYes={onYes}
      onNo={onNo}
    />
  );
}

export interface DeleteEntryConfirmProps {
  /** The selected entry's description. */
  description: string;
  /** Why the last Yes did not go through, in the person's words; null when nothing failed. */
  error: string | null;
  onYes: () => void;
  onNo: () => void;
}
