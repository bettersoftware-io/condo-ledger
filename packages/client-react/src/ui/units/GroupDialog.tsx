import { type ChangeEvent, type ReactElement, useState } from "react";

import type { GroupDialogState } from "@cl/client-core";
import { type Address, addressTextOf, type Rejected } from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { AddressDialog } from "../buildingData/AddressDialog.tsx";
import { Fieldset } from "../Fieldset.tsx";
import { FormField } from "../FormField.tsx";
import { TESTIDS } from "../testids.ts";
import { UnitsDialogFrame } from "./UnitsDialogFrame.tsx";
import { unitsReasonText } from "./unitsReasons.ts";
import { useUnitsWrite } from "./useUnitsWrite.ts";

/**
 * Reads the New or Edit Group dialog, and hands its body plain props. Its
 * address's ✎ opens the Address dialog over it, whose save sets the address
 * in this form; whether that dialog is open is this one's own state.
 */
export function GroupDialog({
  editing,
  onSaved,
  onCancel,
}: GroupDialogProps): ReactElement {
  const { useGroupDialog } = useViewModel();
  const dialog = useGroupDialog(editing);
  const [editingAddress, setEditingAddress] = useState(false);
  const write = useUnitsWrite(onSaved, "the group was not saved");

  function edit(patch: Partial<GroupForm>): void {
    write.forget();
    dialog.edit(patch);
  }

  function save(): void {
    write.run(dialog.save);
  }

  function openAddress(): void {
    setEditingAddress(true);
  }

  function closeAddress(): void {
    setEditingAddress(false);
  }

  function applyAddress(address: Address): void {
    edit({ address });
  }

  return (
    <>
      <GroupDialogBody
        state={dialog.state}
        refusal={write.refusal}
        onEdit={edit}
        onEditAddress={openAddress}
        onSave={save}
        onCancel={onCancel}
      />
      {editingAddress ? (
        <AddressDialog
          address={dialog.state.form.address}
          onApply={applyAddress}
          onClose={closeAddress}
        />
      ) : null}
    </>
  );
}

export interface GroupDialogProps {
  /** The id of the group the dialog edits, read when it opens; null for a new one. */
  editing: string | null;
  /** The group is written. */
  onSaved: () => void;
  onCancel: () => void;
}

type GroupForm = GroupDialogState["form"];

/**
 * "New Group" or "Edit Group": Code, Name, the address and NOTES. The
 * address shows as text after its tools: ✎ edits it, ⊖ removes it. Once the
 * person has edited something, why it cannot be saved yet; the port's
 * refusal in its place. Takes only props.
 */
function GroupDialogBody({
  state,
  refusal,
  onEdit,
  onEditAddress,
  onSave,
  onCancel,
}: GroupDialogBodyProps): ReactElement {
  const { form, verdict } = state;
  const reason = refusal ?? (!verdict.ok && state.touched ? verdict : null);

  function editCode(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ code: event.target.value });
  }

  function editName(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ name: event.target.value });
  }

  function editNotes(event: ChangeEvent<HTMLTextAreaElement>): void {
    onEdit({ notes: event.target.value });
  }

  function removeAddress(): void {
    onEdit({ address: null });
  }

  return (
    <UnitsDialogFrame
      title={state.editing === null ? "New Group" : "Edit Group"}
      adding={state.editing === null}
      canSave={state.canSave && verdict.ok}
      message={
        reason === null
          ? null
          : unitsReasonText(reason, {
              code: form.code.trim(),
              name: form.name.trim(),
            })
      }
      onSave={onSave}
      onCancel={onCancel}
    >
      <FormField label="Code" required>
        <input
          className="units-dialog-mono"
          aria-required="true"
          aria-label="Code"
          value={form.code}
          onChange={editCode}
        />
      </FormField>
      <FormField label="Name" required>
        <input
          aria-required="true"
          aria-label="Name"
          value={form.name}
          onChange={editName}
        />
      </FormField>
      <div className="units-dialog-address">
        <FormField label="Address" readOnly>
          <button
            type="button"
            className="units-dialog-address-tool"
            data-tone="acc"
            aria-label="Edit the address"
            onClick={onEditAddress}
          >
            ✎
          </button>
          <button
            type="button"
            className="units-dialog-address-tool"
            data-tone="neg"
            aria-label="Remove the address"
            disabled={form.address === null}
            onClick={removeAddress}
          >
            ⊖
          </button>
          <span
            className="units-dialog-address-text"
            data-empty={form.address === null}
            data-testid={TESTIDS.unitsDialogAddress}
          >
            {form.address === null ? "---" : addressTextOf(form.address)}
          </span>
        </FormField>
      </div>
      <Fieldset legend="NOTES">
        <textarea
          className="units-dialog-notes"
          aria-label="Notes"
          value={form.notes}
          onChange={editNotes}
        />
      </Fieldset>
    </UnitsDialogFrame>
  );
}

interface GroupDialogBodyProps {
  state: GroupDialogState;
  /** Why the units port refused the last save; null when it did not. */
  refusal: Rejected | null;
  onEdit: (patch: Partial<GroupForm>) => void;
  onEditAddress: () => void;
  onSave: () => void;
  onCancel: () => void;
}
