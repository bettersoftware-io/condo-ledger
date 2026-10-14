import { TriangleAlert } from "lucide-react";
import type { ReactElement } from "react";

import { Dialog } from "./Dialog.tsx";
import { TESTIDS } from "./testids.ts";

import "./ConfirmAlert.css";

/**
 * The yes-or-no question before an act that cannot be undone: a notice with
 * the warning glyph, the question, and the reason it failed when it did.
 * Escape and the scrim answer No.
 */
export function ConfirmAlert({
  text,
  error,
  onYes,
  onNo,
}: ConfirmAlertProps): ReactElement {
  return (
    <Dialog
      title="Notice"
      width="alert"
      onClose={onNo}
      footer={
        <>
          <button
            type="button"
            className="dialog-button"
            data-testid={TESTIDS.confirmYes}
            data-primary="true"
            onClick={onYes}
          >
            Yes
          </button>
          <button
            type="button"
            className="dialog-button"
            data-testid={TESTIDS.confirmNo}
            onClick={onNo}
          >
            No
          </button>
        </>
      }
    >
      <div className="confirm-alert">
        <span className="confirm-alert-glyph" aria-hidden="true">
          <TriangleAlert size={18} />
        </span>
        <div className="confirm-alert-message">
          <p className="confirm-alert-text" data-testid={TESTIDS.confirmText}>
            {text}
          </p>
          {error === null ? null : (
            <p
              className="confirm-alert-error"
              data-testid={TESTIDS.confirmError}
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}

export interface ConfirmAlertProps {
  text: string;
  /** Why Yes did not go through, under the text; null when nothing failed. */
  error: string | null;
  onYes: () => void;
  onNo: () => void;
}
