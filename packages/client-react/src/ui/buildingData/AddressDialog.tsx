import type { ChangeEvent, ReactElement } from "react";

import type { AddressDialogState } from "@cl/client-core";
import type { Address } from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { FormField } from "../FormField.tsx";
import { UnitsDialogFrame } from "../units/UnitsDialogFrame.tsx";
import { useUnitsWrite } from "../units/useUnitsWrite.ts";
import { buildingReasonText } from "./buildingReasons.ts";

/**
 * Reads the Address dialog, and hands its body plain props. It writes
 * nothing itself: its save hands the address to `onApply`, the form of the
 * dialog that opened it, and closes.
 */
export function AddressDialog({
  address,
  onApply,
  onClose,
}: AddressDialogProps): ReactElement {
  const { useAddressDialog } = useViewModel();
  const dialog = useAddressDialog(address, onApply);
  const write = useUnitsWrite(onClose, "the address was not handed over");

  function save(): void {
    write.run(dialog.save);
  }

  return (
    <AddressDialogBody
      state={dialog.state}
      adding={address === null}
      onEdit={dialog.edit}
      onSave={save}
      onCancel={onClose}
    />
  );
}

export interface AddressDialogProps {
  /** The address the dialog opens on, read when it opens; null for none yet. */
  address: Address | null;
  /** The address saved, for the form that opened the dialog. */
  onApply: (address: Address) => void;
  /** The dialog is done with: saved or cancelled. */
  onClose: () => void;
}

type AddressForm = AddressDialogState["form"];

/**
 * "Address": Street and number, required, Postcode and City. Once the
 * person has edited something, why it cannot be saved yet. Takes only props.
 */
function AddressDialogBody({
  state,
  adding,
  onEdit,
  onSave,
  onCancel,
}: AddressDialogBodyProps): ReactElement {
  const { form, verdict } = state;

  function editing(
    field: keyof AddressForm,
  ): (event: ChangeEvent<HTMLInputElement>) => void {
    return (event: ChangeEvent<HTMLInputElement>): void => {
      onEdit({ [field]: event.target.value });
    };
  }

  return (
    <UnitsDialogFrame
      title="Address"
      adding={adding}
      canSave={state.canSave && verdict.ok}
      message={
        !verdict.ok && state.touched ? buildingReasonText(verdict) : null
      }
      onSave={onSave}
      onCancel={onCancel}
    >
      <FormField label="Street and number" required>
        <input
          aria-required="true"
          aria-label="Street and number"
          value={form.street}
          onChange={editing("street")}
        />
      </FormField>
      <FormField label="Postcode">
        <input
          aria-label="Postcode"
          value={form.postcode}
          onChange={editing("postcode")}
        />
      </FormField>
      <FormField label="City">
        <input aria-label="City" value={form.city} onChange={editing("city")} />
      </FormField>
    </UnitsDialogFrame>
  );
}

interface AddressDialogBodyProps {
  state: AddressDialogState;
  /** No address yet: the primary button adds one. */
  adding: boolean;
  onEdit: (patch: Partial<AddressForm>) => void;
  onSave: () => void;
  onCancel: () => void;
}
