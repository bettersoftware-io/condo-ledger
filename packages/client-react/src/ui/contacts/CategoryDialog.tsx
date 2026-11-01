import type { ChangeEvent, ReactElement } from "react";

import type { CategoryDialogState } from "@cl/client-core";
import type { ContactCategory, Rejected } from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { FormDialogFrame } from "../FormDialogFrame.tsx";
import { FormField } from "../FormField.tsx";
import { useDialogWrite } from "../useDialogWrite.ts";
import { contactReasonText } from "./contactReasons.ts";

/**
 * Reads the New or Edit Category dialog, and hands its body plain props.
 * `onAdded` gets the id of a category added, before the dialog closes.
 */
export function CategoryDialog({
  editing,
  onAdded,
  onSaved,
  onCancel,
}: CategoryDialogProps): ReactElement {
  const { useCategoryDialog } = useViewModel();
  const dialog = useCategoryDialog(editing, onAdded);
  const write = useDialogWrite(onSaved, "the category was not saved");

  function edit(name: string): void {
    write.forget();
    dialog.edit({ name });
  }

  function save(): void {
    write.run(dialog.save);
  }

  return (
    <CategoryDialogBody
      state={dialog.state}
      refusal={write.refusal}
      onEdit={edit}
      onSave={save}
      onCancel={onCancel}
    />
  );
}

export interface CategoryDialogProps {
  /** The category the dialog edits, read when it opens; null for a new one. */
  editing: ContactCategory | null;
  /** The id of the category added. */
  onAdded: (id: string) => void;
  /** The category is written. */
  onSaved: () => void;
  onCancel: () => void;
}

/**
 * "New Category" or "Edit Category": the Name. Once the person has edited it,
 * why it cannot be saved yet; the port's refusal in its place. Takes only
 * props.
 */
function CategoryDialogBody({
  state,
  refusal,
  onEdit,
  onSave,
  onCancel,
}: CategoryDialogBodyProps): ReactElement {
  const { form, verdict } = state;
  const reason = refusal ?? (!verdict.ok && state.touched ? verdict : null);

  function editName(event: ChangeEvent<HTMLInputElement>): void {
    onEdit(event.target.value);
  }

  return (
    <FormDialogFrame
      title={state.editing === null ? "New Category" : "Edit Category"}
      adding={state.editing === null}
      canSave={state.canSave && verdict.ok}
      message={reason === null ? null : contactReasonText(reason, "")}
      onSave={onSave}
      onCancel={onCancel}
    >
      <FormField label="Name" required>
        <input
          aria-required="true"
          aria-label="Name"
          value={form.name}
          onChange={editName}
        />
      </FormField>
    </FormDialogFrame>
  );
}

interface CategoryDialogBodyProps {
  state: CategoryDialogState;
  /** Why the contacts port refused the last save; null when it did not. */
  refusal: Rejected | null;
  onEdit: (name: string) => void;
  onSave: () => void;
  onCancel: () => void;
}
