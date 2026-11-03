import type { ChangeEvent, ReactElement } from "react";

import type { DeadlineDialogSpec, DeadlineDialogState } from "@cl/client-core";
import type {
  CalendarId,
  DeadlinePriority,
  DeadlineStatus,
  Rejected,
} from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { DateField } from "../DateField.tsx";
import { FormDialogFrame } from "../FormDialogFrame.tsx";
import { FormField } from "../FormField.tsx";
import { RadioField } from "../RadioField.tsx";
import { useDialogWrite } from "../useDialogWrite.ts";
import { type ValueOption, ValueSelect } from "../ValueSelect.tsx";
import {
  calendarName,
  priorityWord,
  reasonText,
  statusWord,
} from "./calendarWords.ts";

/**
 * Reads the Add or Edit Deadline dialog, and hands its body plain props. A
 * saved deadline is revealed on the Calendar by the machine; `onSaved` then
 * closes the dialog.
 */
export function DeadlineDialog({
  spec,
  onSaved,
  onCancel,
}: DeadlineDialogProps): ReactElement {
  const { useDeadlineDialog } = useViewModel();
  const dialog = useDeadlineDialog(spec);
  const write = useDialogWrite(onSaved, "the deadline was not saved");

  function edit(patch: Partial<DeadlineForm>): void {
    write.forget();
    dialog.edit(patch);
  }

  function save(): void {
    write.run(dialog.save);
  }

  return (
    <DeadlineDialogBody
      state={dialog.state}
      refusal={write.refusal}
      onEdit={edit}
      onSave={save}
      onCancel={onCancel}
    />
  );
}

export interface DeadlineDialogProps {
  /** Which deadline the dialog opens on, read when it opens. */
  spec: DeadlineDialogSpec;
  /** The deadline is written. */
  onSaved: () => void;
  onCancel: () => void;
}

type DeadlineForm = DeadlineDialogState["form"];

/** The calendars a typed deadline may be in: the books' two hold only what the books say. */
const CALENDARS: readonly ValueOption<CalendarId>[] = (
  ["fiscal", "policies", "interventions", "general"] as const
).map((id) => {
  return { value: id, label: calendarName(id) };
});

const STATUSES: readonly ValueOption<DeadlineStatus>[] = (
  ["new", "closed", "cancelled"] as const
).map((status) => {
  return { value: status, label: statusWord(status) };
});

const PRIORITIES: readonly ValueOption<DeadlinePriority>[] = (
  ["none", "low", "medium", "high", "critical"] as const
).map((priority) => {
  return { value: priority, label: priorityWord(priority) };
});

/** The Building select's value for no building. */
const NO_BUILDING = "";

/**
 * "Add Deadline" or "Edit Deadline": Description, Date, Time, Calendar,
 * Building, Status, Priority and Notes. Once the person has edited
 * something, why it cannot be saved yet, the field it belongs to marked
 * invalid; the port's refusal in its place. Takes only props.
 */
function DeadlineDialogBody({
  state,
  refusal,
  onEdit,
  onSave,
  onCancel,
}: DeadlineDialogBodyProps): ReactElement {
  const { form, verdict } = state;
  const reason = refusal ?? (!verdict.ok && state.touched ? verdict : null);
  const field = reason === null || refusal !== null ? null : state.field;
  const buildings: readonly ValueOption<string>[] = [
    { value: NO_BUILDING, label: "— None —" },
    ...[...state.buildings]
      .sort((a, b) => {
        return a.name.localeCompare(b.name, "it") || a.id.localeCompare(b.id);
      })
      .map((building) => {
        return { value: building.id, label: building.name };
      }),
  ];

  function editText(
    name: "description" | "time",
  ): (event: ChangeEvent<HTMLInputElement>) => void {
    return (event: ChangeEvent<HTMLInputElement>): void => {
      onEdit({ [name]: event.target.value });
    };
  }

  function editDate(date: string): void {
    onEdit({ date });
  }

  function editCalendar(calendar: CalendarId): void {
    onEdit({ calendar });
  }

  function editBuilding(id: string): void {
    onEdit({ buildingId: id === NO_BUILDING ? null : id });
  }

  function editStatus(status: DeadlineStatus): void {
    onEdit({ status });
  }

  function editPriority(priority: DeadlinePriority): void {
    onEdit({ priority });
  }

  function editNotes(event: ChangeEvent<HTMLTextAreaElement>): void {
    onEdit({ notes: event.target.value });
  }

  return (
    <FormDialogFrame
      title={state.editing === null ? "Add Deadline" : "Edit Deadline"}
      adding={state.editing === null}
      canSave={state.canSave && verdict.ok}
      width="nested"
      message={reason === null ? null : reasonText(reason.reason)}
      onSave={onSave}
      onCancel={onCancel}
    >
      <FormField label="Description" required>
        <input
          type="text"
          aria-required="true"
          aria-label="Description"
          aria-invalid={field === "description"}
          value={form.description}
          onChange={editText("description")}
        />
      </FormField>
      <DateField
        label="Date"
        required
        invalid={field === "date"}
        value={form.date}
        parsed={state.dateRead}
        onChange={editDate}
      />
      <FormField label="Time">
        <input
          type="text"
          aria-label="Time"
          aria-invalid={field === "time"}
          placeholder="HH:MM"
          value={form.time}
          onChange={editText("time")}
        />
      </FormField>
      <FormField label="Calendar" required>
        <ValueSelect
          label="Calendar"
          required
          options={CALENDARS}
          value={form.calendar}
          onChange={editCalendar}
        />
      </FormField>
      <FormField label="Building">
        <ValueSelect
          label="Building"
          options={buildings}
          value={form.buildingId ?? NO_BUILDING}
          onChange={editBuilding}
        />
      </FormField>
      <RadioField
        label="Status"
        options={STATUSES}
        value={form.status}
        onChange={editStatus}
      />
      <RadioField
        label="Priority"
        options={PRIORITIES}
        value={form.priority}
        onChange={editPriority}
      />
      <FormField label="Notes">
        <textarea
          className="form-dialog-notes"
          aria-label="Notes"
          value={form.notes}
          onChange={editNotes}
        />
      </FormField>
    </FormDialogFrame>
  );
}

interface DeadlineDialogBodyProps {
  state: DeadlineDialogState;
  /** Why the calendar port refused the last save; null when it did not. */
  refusal: Rejected | null;
  onEdit: (patch: Partial<DeadlineForm>) => void;
  onSave: () => void;
  onCancel: () => void;
}
