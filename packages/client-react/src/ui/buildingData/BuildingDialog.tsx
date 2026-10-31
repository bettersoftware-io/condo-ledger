import { type ChangeEvent, type ReactElement, useState } from "react";

import type { BuildingDialogState } from "@cl/client-core";
import {
  type Address,
  addressTextOf,
  type BuildingType,
  type RecordStatus,
  type Rejected,
} from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { DateField } from "../DateField.tsx";
import { Fieldset } from "../Fieldset.tsx";
import { FormField } from "../FormField.tsx";
import { TESTIDS } from "../testids.ts";
import { UnitsDialogFrame } from "../units/UnitsDialogFrame.tsx";
import { useUnitsWrite } from "../units/useUnitsWrite.ts";
import { type ValueOption, ValueSelect } from "../ValueSelect.tsx";
import { AddressDialog } from "./AddressDialog.tsx";
import { buildingReasonText } from "./buildingReasons.ts";
import { BUILDING_TYPE_LABELS, STATUS_LABELS } from "./labels.ts";

/**
 * Reads the Edit Building dialog, and hands its body plain props. Its
 * address's ✎ opens the Address dialog over it, whose save sets the
 * address in this form; whether that dialog is open is this one's own
 * state.
 */
export function BuildingDialog({
  buildingId,
  onSaved,
  onCancel,
}: BuildingDialogProps): ReactElement {
  const { useBuildingDialog } = useViewModel();
  const dialog = useBuildingDialog(buildingId);
  const write = useUnitsWrite(onSaved, "the building was not saved");
  const [editingAddress, setEditingAddress] = useState(false);

  function edit(patch: Partial<BuildingForm>): void {
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
      <BuildingDialogBody
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

export interface BuildingDialogProps {
  /** The building the dialog edits, read when it opens. */
  buildingId: string;
  /** The building is written. */
  onSaved: () => void;
  onCancel: () => void;
}

type BuildingForm = BuildingDialogState["form"];

/** The statuses in the design's order. */
const STATUSES: readonly ValueOption<RecordStatus>[] = (
  ["active", "archived"] as const
).map((status) => {
  return { value: status, label: STATUS_LABELS[status] };
});

/** The building types in the design's order. */
const TYPES: readonly ValueOption<BuildingType>[] = (
  ["building", "superBuilding", "residence"] as const
).map((type) => {
  return { value: type, label: BUILDING_TYPE_LABELS[type] };
});

/**
 * "Edit Building": Name, Building code, Status, Type, the address, Tax
 * code, Construction date; OTHER (Cadastral data); NOTES. The address shows
 * as text after its tools: ✎ edits it, ⊖ removes it. Once the person has
 * edited something, why it cannot be saved yet; the port's refusal in its
 * place. Takes only props.
 */
function BuildingDialogBody({
  state,
  refusal,
  onEdit,
  onEditAddress,
  onSave,
  onCancel,
}: BuildingDialogBodyProps): ReactElement {
  const { form, verdict } = state;
  const reason = refusal ?? (!verdict.ok && state.touched ? verdict : null);

  function editing(
    field: "name" | "code" | "taxCode" | "cadastralData",
  ): (event: ChangeEvent<HTMLInputElement>) => void {
    return (event: ChangeEvent<HTMLInputElement>): void => {
      onEdit({ [field]: event.target.value });
    };
  }

  function editStatus(status: RecordStatus): void {
    onEdit({ status });
  }

  function editType(type: BuildingType): void {
    onEdit({ type });
  }

  function editConstructionDate(text: string): void {
    onEdit({ constructionDate: text });
  }

  function editNotes(event: ChangeEvent<HTMLTextAreaElement>): void {
    onEdit({ notes: event.target.value });
  }

  function removeAddress(): void {
    onEdit({ address: null });
  }

  return (
    <UnitsDialogFrame
      title="Edit Building"
      adding={false}
      canSave={state.canSave && verdict.ok}
      message={reason === null ? null : buildingReasonText(reason)}
      onSave={onSave}
      onCancel={onCancel}
    >
      <FormField label="Name" required>
        <input
          aria-required="true"
          aria-label="Name"
          value={form.name}
          onChange={editing("name")}
        />
      </FormField>
      <FormField label="Building code">
        <input
          className="units-dialog-mono"
          aria-label="Building code"
          value={form.code}
          onChange={editing("code")}
        />
      </FormField>
      <FormField label="Status" required>
        <ValueSelect
          label="Status"
          required
          options={STATUSES}
          value={form.status}
          onChange={editStatus}
        />
      </FormField>
      <FormField label="Type" required>
        <ValueSelect
          label="Type"
          required
          options={TYPES}
          value={form.type}
          onChange={editType}
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
      <FormField label="Tax code">
        <input
          aria-label="Tax code"
          value={form.taxCode}
          onChange={editing("taxCode")}
        />
      </FormField>
      <DateField
        label="Construction date"
        value={form.constructionDate}
        parsed={state.constructedOn}
        onChange={editConstructionDate}
      />
      <Fieldset legend="OTHER">
        <FormField label="Cadastral data">
          <input
            aria-label="Cadastral data"
            value={form.cadastralData}
            onChange={editing("cadastralData")}
          />
        </FormField>
      </Fieldset>
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

interface BuildingDialogBodyProps {
  state: BuildingDialogState;
  /** Why the buildings port refused the last save; null when it did not. */
  refusal: Rejected | null;
  onEdit: (patch: Partial<BuildingForm>) => void;
  onEditAddress: () => void;
  onSave: () => void;
  onCancel: () => void;
}
