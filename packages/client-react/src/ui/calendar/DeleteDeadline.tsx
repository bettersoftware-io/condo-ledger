import type { ReactElement } from "react";

import type { Rejected } from "@cl/domain";

import { ConfirmAlert } from "../ConfirmAlert.tsx";
import { reasonText } from "./calendarWords.ts";

/** The Calendar's question before a typed deadline goes, with the port's refusal in the person's words when it refused. */
export function DeleteDeadline({
  description,
  refusal,
  onYes,
  onNo,
}: DeleteDeadlineProps): ReactElement {
  return (
    <ConfirmAlert
      text={`Delete the deadline "${description}"? This cannot be undone.`}
      error={refusal === null ? null : reasonText(refusal.reason)}
      onYes={onYes}
      onNo={onNo}
    />
  );
}

export interface DeleteDeadlineProps {
  /** The selected deadline's description. */
  description: string;
  /** Why the last Yes did not go through; null when nothing failed. */
  refusal: Rejected | null;
  onYes: () => void;
  onNo: () => void;
}
