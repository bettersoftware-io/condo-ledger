import type { ReactElement } from "react";

import { ConfirmAlert } from "../ConfirmAlert.tsx";

/** The Journal's question before an entry goes, with the reason in the person's words when the domain refused it. */
export function DeleteEntryConfirm({
  description,
  reason,
  onYes,
  onNo,
}: DeleteEntryConfirmProps): ReactElement {
  return (
    <ConfirmAlert
      text={`Delete the entry "${description}"?`}
      error={reason === null ? null : reasonText(reason)}
      onYes={onYes}
      onNo={onNo}
    />
  );
}

export interface DeleteEntryConfirmProps {
  /** The selected entry's description. */
  description: string;
  /** Why the last Yes did not go through, as the domain says it; null when nothing failed. */
  reason: string | null;
  onYes: () => void;
  onNo: () => void;
}

/** The domain's reasons as the person reads them; a reason not listed here is shown as it is. */
const DELETE_REASONS: Readonly<Record<string, string>> = {
  "kind-not-deletable":
    "This kind of entry is removed through its own flow, which is not built yet.",
  "invoice-has-payments": "This invoice has payments. Delete them first.",
};

function reasonText(reason: string): string {
  return DELETE_REASONS[reason] ?? reason;
}
