import { type ChangeEvent, type ReactElement, useState } from "react";

import type { TableDialogForm, TableDialogState } from "@cl/client-core";
import { type ResultOf, rejected, type TableAdded } from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { Dialog } from "../Dialog.tsx";
import { FormField } from "../FormField.tsx";
import { TESTIDS } from "../testids.ts";
import { allocationReasonText } from "./allocationReasons.ts";

import "./TableDialog.css";

/** Reads the New or Edit Thousandth Table dialog, and hands its body plain props. */
export function TableDialog({
  editing,
  onSaved,
  onCancel,
}: TableDialogProps): ReactElement {
  const { useTableDialog } = useViewModel();
  const dialog = useTableDialog(editing);
  const [refusal, setRefusal] = useState<string | null>(null);

  function edit(patch: Partial<TableDialogForm>): void {
    setRefusal(null);
    dialog.edit(patch);
  }

  function settle(result: ResultOf<TableAdded>): void {
    if (result.ok) {
      onSaved(result.value.id);

      return;
    }

    setRefusal(result.reason);
  }

  function save(): void {
    // A click waits for nothing: the tables' stream redraws the panel, and
    // the verdict is shown when it arrives.
    void dialog.save().then(settle).catch(reportUnsaved);
  }

  return (
    <TableDialogBody
      state={dialog.state}
      refusal={refusal}
      onEdit={edit}
      onSave={save}
      onCancel={onCancel}
    />
  );
}

export interface TableDialogProps {
  /** The id of the table the dialog edits, read when it opens; null for a new one. */
  editing: string | null;
  /** The table is written: its id, the new one's or the edited one's. */
  onSaved: (tableId: string) => void;
  onCancel: () => void;
}

/**
 * "New Thousandth Table" or "Edit Thousandth Table": Name, Order and NOTES.
 * Once the person has edited something, why Save cannot go on yet; a store's
 * refusal in its place. Takes only props.
 */
function TableDialogBody({
  state,
  refusal,
  onEdit,
  onSave,
  onCancel,
}: TableDialogBodyProps): ReactElement {
  const { form, verdict } = state;
  const canSave = verdict.ok && !state.saving;
  const verdictReason = !verdict.ok && state.touched ? verdict.reason : null;
  const reason = refusal ?? verdictReason;

  function editName(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ name: event.target.value });
  }

  function editOrder(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ order: event.target.value });
  }

  function editNotes(event: ChangeEvent<HTMLTextAreaElement>): void {
    onEdit({ notes: event.target.value });
  }

  function pressPrimary(): void {
    if (canSave) {
      onSave();
    }
  }

  return (
    <Dialog
      title={
        state.editing === null
          ? "New Thousandth Table"
          : "Edit Thousandth Table"
      }
      onClose={onCancel}
      onEnter={pressPrimary}
      footer={
        <>
          <span className="table-dialog-note">
            Required fields are marked with *
          </span>
          <span className="table-dialog-spacer" />
          <button
            type="button"
            className="dialog-button"
            data-primary="true"
            data-testid={TESTIDS.tableDialogSave}
            disabled={!canSave}
            onClick={onSave}
          >
            {state.editing === null ? "+ Add" : "✎ Save"}
          </button>
          <button
            type="button"
            className="dialog-button"
            data-testid={TESTIDS.tableDialogCancel}
            onClick={onCancel}
          >
            ✕ Cancel
          </button>
        </>
      }
    >
      <div className="table-dialog">
        <FormField label="Name" required>
          <input
            aria-required="true"
            aria-label="Name"
            value={form.name}
            onChange={editName}
          />
        </FormField>
        <FormField label="Order">
          <input aria-label="Order" value={form.order} onChange={editOrder} />
        </FormField>
        <fieldset className="table-dialog-notes">
          <legend>NOTES</legend>
          <textarea
            aria-label="Notes"
            value={form.notes}
            onChange={editNotes}
          />
        </fieldset>
        {reason === null ? null : (
          <div
            className="table-dialog-message"
            data-testid={TESTIDS.tableDialogMessage}
          >
            {allocationReasonText(rejected(reason), {
              table: form.name.trim(),
            })}
          </div>
        )}
      </div>
    </Dialog>
  );
}

interface TableDialogBodyProps {
  state: TableDialogState;
  /** Why the tables store refused the last save; null when it did not. */
  refusal: string | null;
  onEdit: (patch: Partial<TableDialogForm>) => void;
  onSave: () => void;
  onCancel: () => void;
}

/* v8 ignore next 3 -- the simulator answers every table write: only a real store fails otherwise */
function reportUnsaved(error: unknown): void {
  console.error("the table was not saved", error);
}
