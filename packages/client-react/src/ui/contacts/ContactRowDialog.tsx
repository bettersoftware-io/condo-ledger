import type { ChangeEvent, ReactElement } from "react";

import type { ContactRowDialogState } from "@cl/client-core";
import type { ContactRowDraft, ContactRowType, Rejected } from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { FormDialogFrame } from "../FormDialogFrame.tsx";
import { FormField } from "../FormField.tsx";
import { useDialogWrite } from "../useDialogWrite.ts";
import { type ValueOption, ValueSelect } from "../ValueSelect.tsx";
import { contactReasonText } from "./contactReasons.ts";
import { ROW_TYPE_LABELS } from "./labels.ts";

/**
 * Reads the Add or Edit Contact dialog on one row of a contact's form, and
 * hands its body plain props. It writes nothing itself: its save hands the
 * row to `onApply`, the form of the dialog that opened it, and closes.
 */
export function ContactRowDialog({
  row,
  nextOrder,
  onApply,
  onClose,
}: ContactRowDialogProps): ReactElement {
  const { useContactRowDialog } = useViewModel();
  const dialog = useContactRowDialog(row, nextOrder, onApply);
  const write = useDialogWrite(onClose, "the contact row was not handed over");

  function edit(patch: Partial<RowForm>): void {
    write.forget();
    dialog.edit(patch);
  }

  function save(): void {
    write.run(dialog.save);
  }

  return (
    <ContactRowDialogBody
      state={dialog.state}
      adding={row === null}
      refusal={write.refusal}
      onEdit={edit}
      onSave={save}
      onCancel={onClose}
    />
  );
}

export interface ContactRowDialogProps {
  /** The row the dialog opens on, read when it opens; null for a new one. */
  row: ContactRowDraft | null;
  /** The order a new row starts on. */
  nextOrder: number;
  /** The row saved, for the form that opened the dialog. */
  onApply: (row: ContactRowDraft) => void;
  /** The dialog is done with: saved or cancelled. */
  onClose: () => void;
}

type RowForm = ContactRowDialogState["form"];

/** The row types in the design's order. */
const TYPES: readonly ValueOption<ContactRowType>[] = (
  ["phone", "email", "web", "im", "pec"] as const
).map((type) => {
  return { value: type, label: ROW_TYPE_LABELS[type] };
});

/**
 * "Add Contact" or "Edit Contact": Order, Contact type, Label and Value,
 * all required, in a card of 460px. Once the person has edited something,
 * why it cannot be saved yet. Takes only props.
 */
function ContactRowDialogBody({
  state,
  adding,
  refusal,
  onEdit,
  onSave,
  onCancel,
}: ContactRowDialogBodyProps): ReactElement {
  const { form, verdict } = state;
  const reason = refusal ?? (!verdict.ok && state.touched ? verdict : null);

  function editing(
    field: "order" | "label" | "value",
  ): (event: ChangeEvent<HTMLInputElement>) => void {
    return (event: ChangeEvent<HTMLInputElement>): void => {
      onEdit({ [field]: event.target.value });
    };
  }

  function editType(type: ContactRowType): void {
    onEdit({ type });
  }

  return (
    <FormDialogFrame
      title={adding ? "Add Contact" : "Edit Contact"}
      adding={adding}
      canSave={state.canSave && verdict.ok}
      message={reason === null ? null : contactReasonText(reason, "")}
      labels="nested"
      width="nested"
      onSave={onSave}
      onCancel={onCancel}
    >
      <FormField label="Order" required>
        <input
          type="text"
          inputMode="numeric"
          aria-required="true"
          aria-label="Order"
          value={form.order}
          onChange={editing("order")}
        />
      </FormField>
      <FormField label="Contact type" required>
        <ValueSelect
          label="Contact type"
          required
          options={TYPES}
          value={form.type}
          onChange={editType}
        />
      </FormField>
      <FormField label="Label" required>
        <input
          type="text"
          aria-required="true"
          aria-label="Label"
          value={form.label}
          onChange={editing("label")}
        />
      </FormField>
      <FormField label="Value" required>
        <input
          type="text"
          aria-required="true"
          aria-label="Value"
          value={form.value}
          onChange={editing("value")}
        />
      </FormField>
    </FormDialogFrame>
  );
}

interface ContactRowDialogBodyProps {
  state: ContactRowDialogState;
  /** No row yet: the primary button adds one. */
  adding: boolean;
  /** Why the last save was refused; null when it was not. */
  refusal: Rejected | null;
  onEdit: (patch: Partial<RowForm>) => void;
  onSave: () => void;
  onCancel: () => void;
}
