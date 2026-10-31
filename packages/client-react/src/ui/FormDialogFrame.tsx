import type { ReactElement, ReactNode } from "react";

import { Dialog } from "./Dialog.tsx";
import { TESTIDS } from "./testids.ts";

import "./FormDialog.css";

/**
 * What the form dialogs share (group, unit, owner, building, period, address): the card at 560px, the
 * fields in a label column of 160px (148px for the owner), the reason in red
 * under them, and the footer's note, "+ Add" for a new record or "✎ Save"
 * for an edit, and Cancel. Enter in a text field presses the primary button
 * while it can go on. Takes only props.
 */
export function FormDialogFrame({
  title,
  adding,
  canSave,
  message,
  labels = "wide",
  onSave,
  onCancel,
  children,
}: FormDialogFrameProps): ReactElement {
  function pressPrimary(): void {
    if (canSave) {
      onSave();
    }
  }

  return (
    <Dialog
      title={title}
      onClose={onCancel}
      onEnter={pressPrimary}
      footer={
        <>
          <span className="form-dialog-footnote">
            Required fields are marked with *
          </span>
          <span className="form-dialog-spacer" />
          <button
            type="button"
            className="dialog-button"
            data-primary="true"
            data-testid={TESTIDS.formDialogSave}
            disabled={!canSave}
            onClick={onSave}
          >
            {adding ? "+ Add" : "✎ Save"}
          </button>
          <button
            type="button"
            className="dialog-button"
            data-testid={TESTIDS.formDialogCancel}
            onClick={onCancel}
          >
            ✕ Cancel
          </button>
        </>
      }
    >
      <div className="form-dialog" data-labels={labels}>
        {children}
        {message === null ? null : (
          <div
            className="form-dialog-message"
            data-testid={TESTIDS.formDialogMessage}
          >
            {message}
          </div>
        )}
      </div>
    </Dialog>
  );
}

export interface FormDialogFrameProps {
  title: string;
  /** A new record: the primary button adds. */
  adding: boolean;
  canSave: boolean;
  /** Why the dialog cannot save, in words; null when nothing stops it. */
  message: string | null;
  /** The label column: 160px (`wide`) or the owner dialog's 148px (`owner`). */
  labels?: "wide" | "owner";
  onSave: () => void;
  onCancel: () => void;
  children: ReactNode;
}
