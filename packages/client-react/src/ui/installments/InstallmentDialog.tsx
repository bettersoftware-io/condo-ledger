import type { ChangeEvent, ReactElement } from "react";

import type {
  InstallmentDialogForm,
  InstallmentDialogState,
} from "@cl/client-core";
import { useViewModel } from "@cl/react-bindings";

import { DateField } from "../DateField.tsx";
import { Dialog } from "../Dialog.tsx";
import { FormField } from "../FormField.tsx";
import { TESTIDS } from "../testids.ts";
import { scheduleReasonText } from "./reasons.ts";
import { useScheduleWrite } from "./useScheduleWrite.ts";

import "./InstallmentDialog.css";

/** Reads the Edit Installment dialog over one installment, and hands its body plain props. */
export function InstallmentDialog({
  installmentId,
  onSaved,
  onCancel,
}: InstallmentDialogProps): ReactElement {
  const { useInstallmentDialog } = useViewModel();
  const dialog = useInstallmentDialog(installmentId);
  const saving = useScheduleWrite(onSaved, "the installment was not saved");

  function edit(patch: Partial<InstallmentDialogForm>): void {
    saving.forget();
    dialog.edit(patch);
  }

  function save(): void {
    saving.run(dialog.save);
  }

  return (
    <InstallmentDialogBody
      state={dialog.state}
      refusal={saving.refusal}
      onEdit={edit}
      onSave={save}
      onCancel={onCancel}
    />
  );
}

export interface InstallmentDialogProps {
  /** The installment it edits: read when the dialog opens. */
  installmentId: string;
  /** The changes are written. */
  onSaved: () => void;
  onCancel: () => void;
}

/**
 * "Edit Installment": Name, Due date and Locked. While Locked is on, Name and
 * Due date cannot change, as in the legacy dialog; unticking it frees them,
 * and one Save writes all three. Once the person has edited something, why
 * Save cannot go on yet; a store's refusal in its place.
 */
function InstallmentDialogBody({
  state,
  refusal,
  onEdit,
  onSave,
  onCancel,
}: InstallmentDialogBodyProps): ReactElement {
  const { form, verdict } = state;
  const canSave = verdict.ok && !state.saving;
  const verdictReason = !verdict.ok && state.touched ? verdict.reason : null;
  const reason = refusal ?? verdictReason;

  function editName(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ name: event.target.value });
  }

  function editDueDate(text: string): void {
    onEdit({ dueDate: text });
  }

  function editLocked(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ locked: event.target.checked });
  }

  function pressPrimary(): void {
    if (canSave) {
      onSave();
    }
  }

  return (
    <Dialog
      title="Edit Installment"
      onClose={onCancel}
      onEnter={pressPrimary}
      footer={
        <>
          <span className="installment-dialog-spacer" />
          <button
            type="button"
            className="dialog-button"
            data-primary="true"
            data-testid={TESTIDS.installmentDialogSave}
            disabled={!canSave}
            onClick={onSave}
          >
            ✓ Save
          </button>
          <button
            type="button"
            className="dialog-button"
            data-testid={TESTIDS.installmentDialogCancel}
            onClick={onCancel}
          >
            ✕ Cancel
          </button>
        </>
      }
    >
      <FormField label="Name" required>
        <input
          aria-label="Name"
          value={form.name}
          disabled={form.locked}
          onChange={editName}
        />
      </FormField>
      <DateField
        label="Due date"
        required
        disabled={form.locked}
        value={form.dueDate}
        parsed={state.dueDate}
        onChange={editDueDate}
      />
      <FormField label="Locked">
        <input
          type="checkbox"
          className="form-check"
          aria-label="Locked"
          checked={form.locked}
          onChange={editLocked}
        />
      </FormField>
      {reason === null ? null : (
        <div
          className="installment-dialog-message"
          data-testid={TESTIDS.installmentDialogMessage}
        >
          {scheduleReasonText(reason)}
        </div>
      )}
    </Dialog>
  );
}

interface InstallmentDialogBodyProps {
  state: InstallmentDialogState;
  refusal: string | null;
  onEdit: (patch: Partial<InstallmentDialogForm>) => void;
  onSave: () => void;
  onCancel: () => void;
}
