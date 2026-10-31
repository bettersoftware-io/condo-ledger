import type { ReactElement, ReactNode } from "react";

import { Dialog } from "../Dialog.tsx";
import { TESTIDS } from "../testids.ts";

import "./UnitsDialog.css";

/**
 * What the group, unit and owner dialogs share: the card at 560px, the
 * fields in a label column of 160px (148px for the owner), the reason in red
 * under them, and the footer's note, "+ Add" for a new record or "✎ Save"
 * for an edit, and Cancel. Enter in a text field presses the primary button
 * while it can go on. Takes only props.
 */
export function UnitsDialogFrame({
  title,
  adding,
  canSave,
  message,
  labels = "wide",
  onSave,
  onCancel,
  children,
}: UnitsDialogFrameProps): ReactElement {
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
          <span className="units-dialog-footnote">
            Required fields are marked with *
          </span>
          <span className="units-dialog-spacer" />
          <button
            type="button"
            className="dialog-button"
            data-primary="true"
            data-testid={TESTIDS.unitsDialogSave}
            disabled={!canSave}
            onClick={onSave}
          >
            {adding ? "+ Add" : "✎ Save"}
          </button>
          <button
            type="button"
            className="dialog-button"
            data-testid={TESTIDS.unitsDialogCancel}
            onClick={onCancel}
          >
            ✕ Cancel
          </button>
        </>
      }
    >
      <div className="units-dialog" data-labels={labels}>
        {children}
        {message === null ? null : (
          <div
            className="units-dialog-message"
            data-testid={TESTIDS.unitsDialogMessage}
          >
            {message}
          </div>
        )}
      </div>
    </Dialog>
  );
}

export interface UnitsDialogFrameProps {
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
