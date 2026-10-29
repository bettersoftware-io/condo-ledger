import { TriangleAlert } from "lucide-react";
import { type ReactElement, useEffect, useId, useRef } from "react";

import { Dialog } from "./Dialog.tsx";
import { TESTIDS } from "./testids.ts";

import "./ConfirmAlert.css";

/**
 * The yes-or-no question before an act that cannot be undone: a notice with
 * the warning glyph, the question, and the reason it failed when it did.
 * An alert dialog, after WAI-ARIA's: named Notice, it reads the question and
 * the reason after its name. It opens with the focus on No, the answer that
 * changes nothing. Escape and the scrim answer No.
 */
export function ConfirmAlert({
  text,
  error,
  onYes,
  onNo,
}: ConfirmAlertProps): ReactElement {
  const id = useId();
  const no = useRef<HTMLButtonElement>(null);
  const textId = `${id}-text`;
  const errorId = `${id}-error`;

  // After the dialog's own effect, which puts the focus on its card.
  useEffect(() => {
    no.current?.focus();
  }, []);

  return (
    <Dialog
      title="Notice"
      width="alert"
      role="alertdialog"
      describedBy={error === null ? textId : `${textId} ${errorId}`}
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
            ref={no}
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
          <p
            id={textId}
            className="confirm-alert-text"
            data-testid={TESTIDS.confirmText}
          >
            {text}
          </p>
          {error === null ? null : (
            <p
              id={errorId}
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
