import type { ChangeEvent, ReactElement } from "react";

import type { OwnerDialogState } from "@cl/client-core";
import type {
  Contact,
  PeriodDates,
  Rejected,
  ResidencyDraft,
} from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { useLocale } from "../amountLocale.ts";
import { DateField } from "../DateField.tsx";
import { Fieldset } from "../Fieldset.tsx";
import { FormDialogFrame } from "../FormDialogFrame.tsx";
import { FormField } from "../FormField.tsx";
import { formatShare } from "../format.ts";
import { TESTIDS } from "../testids.ts";
import { useDialogWrite } from "../useDialogWrite.ts";
import { type ValueOption, ValueSelect } from "../ValueSelect.tsx";
import { ContactPicker } from "./ContactPicker.tsx";
import { ROLE_LABELS } from "./labels.ts";
import { unitsReasonText } from "./unitsReasons.ts";

/** Reads the Add or Edit Owner dialog and the contacts, and hands its body plain props. */
export function OwnerDialog({
  editing,
  period,
  onSaved,
  onCancel,
}: OwnerDialogProps): ReactElement {
  const { useOwnerDialog, useContacts } = useViewModel();
  const dialog = useOwnerDialog(editing);
  const contacts = useContacts();
  const write = useDialogWrite(onSaved, "the owner was not saved");

  function edit(patch: Partial<OwnerForm>): void {
    write.forget();
    dialog.edit(patch);
  }

  function save(): void {
    write.run(dialog.save);
  }

  return (
    <OwnerDialogBody
      state={dialog.state}
      contacts={contacts}
      period={period}
      refusal={write.refusal}
      onEdit={edit}
      onSave={save}
      onCancel={onCancel}
    />
  );
}

export interface OwnerDialogProps {
  /** The id of the resident the dialog edits, read when it opens; null for a new owner of the selected unit. */
  editing: string | null;
  /** The period the residency's own dates must lie within, for the reason that says so. */
  period: PeriodDates;
  /** The owner is written. */
  onSaved: () => void;
  onCancel: () => void;
}

type OwnerForm = OwnerDialogState["form"];

/** The roles in the design's order. */
const ROLES: readonly ValueOption<ResidencyDraft["role"]>[] = (
  ["PR", "CO", "SC"] as const
).map((role) => {
  return { value: role, label: ROLE_LABELS[role] };
});

/**
 * "Add Owner" or "Edit Owner": Linked contact, Role, Previous balance,
 * Co-ownership % (read-only) and RESTRICTED PERIOD. An owner being edited
 * keeps their contact and role. Once the period's opening entry is posted
 * the balance is the journal's, and a line under it says so. Once the person
 * has edited something, why it cannot be saved yet; the port's refusal in
 * its place. Takes only props.
 */
function OwnerDialogBody({
  state,
  contacts,
  period,
  refusal,
  onEdit,
  onSave,
  onCancel,
}: OwnerDialogBodyProps): ReactElement {
  const locale = useLocale();
  const { form, verdict } = state;
  const editing = state.editing !== null;
  const reason = refusal ?? (!verdict.ok && state.touched ? verdict : null);

  function contactName(contactId: string): string {
    return (
      contacts.find((contact) => {
        return contact.id === contactId;
      })?.name ?? contactId
    );
  }

  function editContact(contactId: string | null): void {
    onEdit({ contactId });
  }

  function editRole(role: ResidencyDraft["role"]): void {
    onEdit({ role });
  }

  function editBalance(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ previousBalance: event.target.value });
  }

  function editStart(text: string): void {
    onEdit({ start: text });
  }

  function editEnd(text: string): void {
    onEdit({ end: text });
  }

  return (
    <FormDialogFrame
      title={editing ? "Edit Owner" : "Add Owner"}
      adding={!editing}
      canSave={state.canSave && verdict.ok}
      message={
        reason === null
          ? null
          : unitsReasonText(reason, {
              period,
              unit: state.unitDates,
              contactName,
            })
      }
      labels="owner"
      onSave={onSave}
      onCancel={onCancel}
    >
      <ContactPicker
        contacts={contacts}
        value={form.contactId}
        fixed={editing}
        onChange={editContact}
      />
      <FormField label="Role">
        <ValueSelect
          label="Role"
          options={ROLES}
          value={form.role}
          disabled={editing}
          onChange={editRole}
        />
      </FormField>
      <FormField label="Previous balance" required>
        <input
          type="text"
          aria-label="Previous balance"
          aria-required="true"
          value={form.previousBalance}
          disabled={state.balanceLocked}
          onChange={editBalance}
        />
      </FormField>
      {state.balanceLocked ? (
        <p className="form-dialog-note" data-testid={TESTIDS.formDialogNote}>
          Posted in the opening entry: change it through the journal.
        </p>
      ) : null}
      <FormField label="Co-ownership %" readOnly>
        {state.share === null ? "" : formatShare(state.share, locale)}
      </FormField>
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
    </FormDialogFrame>
  );
}

interface OwnerDialogBodyProps {
  state: OwnerDialogState;
  contacts: Contact[];
  period: PeriodDates;
  /** Why the units port refused the last save; null when it did not. */
  refusal: Rejected | null;
  onEdit: (patch: Partial<OwnerForm>) => void;
  onSave: () => void;
  onCancel: () => void;
}
