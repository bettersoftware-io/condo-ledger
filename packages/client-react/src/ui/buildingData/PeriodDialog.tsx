import type { ChangeEvent, ReactElement } from "react";

import type { PeriodDialogState } from "@cl/client-core";
import { PERIOD_TYPE_WORDS, type PeriodType, type Rejected } from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { DateField } from "../DateField.tsx";
import { Fieldset } from "../Fieldset.tsx";
import { FormDialogFrame } from "../FormDialogFrame.tsx";
import { FormField } from "../FormField.tsx";
import { useDialogWrite } from "../useDialogWrite.ts";
import { type ValueOption, ValueSelect } from "../ValueSelect.tsx";
import { buildingReasonText } from "./buildingReasons.ts";

/** Reads the Edit Management / Period dialog, and hands its body plain props. */
export function PeriodDialog({
  periodId,
  onSaved,
  onCancel,
}: PeriodDialogProps): ReactElement {
  const { usePeriodDialog } = useViewModel();
  const dialog = usePeriodDialog(periodId);
  const write = useDialogWrite(onSaved, "the period was not saved");

  function edit(patch: Partial<PeriodForm>): void {
    write.forget();
    dialog.edit(patch);
  }

  function save(): void {
    write.run(dialog.save);
  }

  return (
    <PeriodDialogBody
      state={dialog.state}
      refusal={write.refusal}
      onEdit={edit}
      onSave={save}
      onCancel={onCancel}
    />
  );
}

export interface PeriodDialogProps {
  /** The period the dialog edits, read when it opens. */
  periodId: string;
  /** The period is written. */
  onSaved: () => void;
  onCancel: () => void;
}

type PeriodForm = PeriodDialogState["form"];

/** Whether the period is open or closed: the form holds `closed`. */
type PeriodStatus = "open" | "closed";

/** The period types in the design's order. */
const TYPES: readonly ValueOption<PeriodType>[] = (
  ["ordinary", "extra", "auxiliary"] as const
).map((type) => {
  return { value: type, label: PERIOD_TYPE_WORDS[type] };
});

const STATUSES: readonly ValueOption<PeriodStatus>[] = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

/**
 * "Edit Management / Period": Management name, Type, Status; COMPETENCE
 * PERIOD (Start date, End date); NOTES. Once the person has edited
 * something, why it cannot be saved yet; the port's refusal in its place.
 * Takes only props.
 */
function PeriodDialogBody({
  state,
  refusal,
  onEdit,
  onSave,
  onCancel,
}: PeriodDialogBodyProps): ReactElement {
  const { form, verdict } = state;
  const reason = refusal ?? (!verdict.ok && state.touched ? verdict : null);

  function editName(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ name: event.target.value });
  }

  function editType(type: PeriodType): void {
    onEdit({ type });
  }

  function editStatus(status: PeriodStatus): void {
    onEdit({ closed: status === "closed" });
  }

  function editStart(text: string): void {
    onEdit({ start: text });
  }

  function editEnd(text: string): void {
    onEdit({ end: text });
  }

  function editNotes(event: ChangeEvent<HTMLTextAreaElement>): void {
    onEdit({ notes: event.target.value });
  }

  return (
    <FormDialogFrame
      title="Edit Management / Period"
      adding={false}
      canSave={state.canSave && verdict.ok}
      message={reason === null ? null : buildingReasonText(reason)}
      onSave={onSave}
      onCancel={onCancel}
    >
      <FormField label="Management name" required>
        <input
          aria-required="true"
          aria-label="Management name"
          value={form.name}
          onChange={editName}
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
      <FormField label="Status" required>
        <ValueSelect
          label="Status"
          required
          options={STATUSES}
          value={form.closed ? "closed" : "open"}
          onChange={editStatus}
        />
      </FormField>
      <Fieldset legend="COMPETENCE PERIOD">
        <DateField
          label="Start date"
          required
          value={form.start}
          parsed={state.from}
          onChange={editStart}
        />
        <DateField
          label="End date"
          required
          value={form.end}
          parsed={state.to}
          onChange={editEnd}
        />
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

interface PeriodDialogBodyProps {
  state: PeriodDialogState;
  /** Why the buildings port refused the last save; null when it did not. */
  refusal: Rejected | null;
  onEdit: (patch: Partial<PeriodForm>) => void;
  onSave: () => void;
  onCancel: () => void;
}
