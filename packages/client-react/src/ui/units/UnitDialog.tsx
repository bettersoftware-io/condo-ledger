import type { ChangeEvent, ReactElement } from "react";

import type { UnitDialogState } from "@cl/client-core";
import type { PeriodDates, Rejected, UnitType } from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { DateField } from "../DateField.tsx";
import { Fieldset } from "../Fieldset.tsx";
import { FormDialogFrame } from "../FormDialogFrame.tsx";
import { FormField } from "../FormField.tsx";
import { useDialogWrite } from "../useDialogWrite.ts";
import { type ValueOption, ValueSelect } from "../ValueSelect.tsx";
import { UNIT_TYPE_LABELS } from "./labels.ts";
import { unitsReasonText } from "./unitsReasons.ts";

/** Reads the New or Edit Unit dialog, and hands its body plain props. */
export function UnitDialog({
  editing,
  period,
  onSaved,
  onCancel,
}: UnitDialogProps): ReactElement {
  const { useUnitDialog } = useViewModel();
  const dialog = useUnitDialog(editing);
  const write = useDialogWrite(onSaved, "the unit was not saved");

  function edit(patch: Partial<UnitForm>): void {
    write.forget();
    dialog.edit(patch);
  }

  function save(): void {
    write.run(dialog.save);
  }

  return (
    <UnitDialogBody
      state={dialog.state}
      period={period}
      refusal={write.refusal}
      onEdit={edit}
      onSave={save}
      onCancel={onCancel}
    />
  );
}

export interface UnitDialogProps {
  /** The id of the unit the dialog edits, read when it opens; null for a new one. */
  editing: string | null;
  /** The period the unit's own dates must lie within, for the reason that says so. */
  period: PeriodDates;
  /** The unit is written. */
  onSaved: () => void;
  onCancel: () => void;
}

type UnitForm = UnitDialogState["form"];

/** The unit types in the design's order. */
const UNIT_TYPES: readonly ValueOption<UnitType>[] = (
  ["apartment", "shop", "garage", "premises"] as const
).map((type) => {
  return { value: type, label: UNIT_TYPE_LABELS[type] };
});

/**
 * "New Unit" or "Edit Unit": the unit name; IDENTIFICATION DATA (Code,
 * Floor, Interior, Sub-unit); RESTRICTED PERIOD (Start date, End date);
 * ADDITIONAL DATA (Type, Cadastral data); NOTES. Once the person has edited
 * something, why it cannot be saved yet; the port's refusal in its place.
 * Takes only props.
 */
function UnitDialogBody({
  state,
  period,
  refusal,
  onEdit,
  onSave,
  onCancel,
}: UnitDialogBodyProps): ReactElement {
  const { form, verdict } = state;
  const reason = refusal ?? (!verdict.ok && state.touched ? verdict : null);

  function editing(
    field: "name" | "code" | "floor" | "interior" | "subUnit" | "cadastralData",
  ): (event: ChangeEvent<HTMLInputElement>) => void {
    return (event: ChangeEvent<HTMLInputElement>): void => {
      onEdit({ [field]: event.target.value });
    };
  }

  function editStart(text: string): void {
    onEdit({ start: text });
  }

  function editEnd(text: string): void {
    onEdit({ end: text });
  }

  function editType(type: UnitType): void {
    onEdit({ type });
  }

  function editNotes(event: ChangeEvent<HTMLTextAreaElement>): void {
    onEdit({ notes: event.target.value });
  }

  return (
    <FormDialogFrame
      title={state.editing === null ? "New Unit" : "Edit Unit"}
      adding={state.editing === null}
      canSave={state.canSave && verdict.ok}
      message={reason === null ? null : unitsReasonText(reason, { period })}
      onSave={onSave}
      onCancel={onCancel}
    >
      <FormField label="Unit name">
        <input
          aria-label="Unit name"
          value={form.name}
          onChange={editing("name")}
        />
      </FormField>
      <Fieldset legend="IDENTIFICATION DATA">
        <FormField label="Code" required>
          <input
            className="form-dialog-mono"
            aria-required="true"
            aria-label="Code"
            value={form.code}
            onChange={editing("code")}
          />
        </FormField>
        <FormField label="Floor">
          <input
            aria-label="Floor"
            value={form.floor}
            onChange={editing("floor")}
          />
        </FormField>
        <FormField label="Interior">
          <input
            aria-label="Interior"
            value={form.interior}
            onChange={editing("interior")}
          />
        </FormField>
        <FormField label="Sub-unit">
          <input
            aria-label="Sub-unit"
            value={form.subUnit}
            onChange={editing("subUnit")}
          />
        </FormField>
      </Fieldset>
      <Fieldset legend="RESTRICTED PERIOD">
        <DateField
          label="Start date"
          value={form.start}
          parsed={state.from}
          onChange={editStart}
        />
        <DateField
          label="End date"
          value={form.end}
          parsed={state.to}
          onChange={editEnd}
        />
      </Fieldset>
      <Fieldset legend="ADDITIONAL DATA">
        <FormField label="Type" required>
          <ValueSelect
            label="Type"
            required
            options={UNIT_TYPES}
            value={form.type}
            onChange={editType}
          />
        </FormField>
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
          className="form-dialog-notes"
          aria-label="Notes"
          value={form.notes}
          onChange={editNotes}
        />
      </Fieldset>
    </FormDialogFrame>
  );
}

interface UnitDialogBodyProps {
  state: UnitDialogState;
  period: PeriodDates;
  /** Why the units port refused the last save; null when it did not. */
  refusal: Rejected | null;
  onEdit: (patch: Partial<UnitForm>) => void;
  onSave: () => void;
  onCancel: () => void;
}
