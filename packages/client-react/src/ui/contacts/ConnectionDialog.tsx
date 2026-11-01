import type { ChangeEvent, ReactElement } from "react";

import type { ConnectionDialogState } from "@cl/client-core";
import type { ContactConnection, ContactView, Rejected } from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { FormDialogFrame } from "../FormDialogFrame.tsx";
import { FormField } from "../FormField.tsx";
import { useDialogWrite } from "../useDialogWrite.ts";
import { ContactPicker } from "./ContactPicker.tsx";
import { contactReasonText } from "./contactReasons.ts";

/**
 * Reads the Add or Edit Connected Contact dialog on one contact, and the
 * contacts, and hands its body plain props.
 */
export function ConnectionDialog({
  contactId,
  editing,
  onSaved,
  onCancel,
}: ConnectionDialogProps): ReactElement {
  const { useConnectionDialog, useContacts } = useViewModel();
  const dialog = useConnectionDialog(contactId, editing);
  const contacts = useContacts();
  const write = useDialogWrite(onSaved, "the connection was not saved");

  function edit(patch: Partial<ConnectionForm>): void {
    write.forget();
    dialog.edit(patch);
  }

  function save(): void {
    write.run(dialog.save);
  }

  return (
    <ConnectionDialogBody
      state={dialog.state}
      contacts={contacts}
      refusal={write.refusal}
      onEdit={edit}
      onSave={save}
      onCancel={onCancel}
    />
  );
}

export interface ConnectionDialogProps {
  /** The contact the connection belongs to. */
  contactId: string;
  /** The connection the dialog edits, read when it opens; null for a new one. */
  editing: ContactConnection | null;
  /** The connection is written. */
  onSaved: () => void;
  onCancel: () => void;
}

type ConnectionForm = ConnectionDialogState["form"];

/**
 * "Add Connected Contact" or "Edit Connected Contact": the Contact, what it
 * is to this one, and the Order. Once the person has edited something, why
 * it cannot be saved yet; the port's refusal in its place. Takes only props.
 */
function ConnectionDialogBody({
  state,
  contacts,
  refusal,
  onEdit,
  onSave,
  onCancel,
}: ConnectionDialogBodyProps): ReactElement {
  const { form, verdict } = state;
  const reason = refusal ?? (!verdict.ok && state.touched ? verdict : null);

  function editContact(connectedId: string | null): void {
    onEdit({ connectedId });
  }

  function editRelationship(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ relationship: event.target.value });
  }

  function editOrder(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ order: event.target.value });
  }

  return (
    <FormDialogFrame
      title={
        state.editing === null
          ? "Add Connected Contact"
          : "Edit Connected Contact"
      }
      adding={state.editing === null}
      canSave={state.canSave && verdict.ok}
      message={
        reason === null
          ? null
          : contactReasonText(reason, connectedName(reason, contacts))
      }
      onSave={onSave}
      onCancel={onCancel}
    >
      <ContactPicker
        label="Contact"
        contacts={contacts}
        value={form.connectedId}
        fixed={false}
        onChange={editContact}
      />
      <FormField label="Relationship" required>
        <input
          type="text"
          aria-required="true"
          aria-label="Relationship"
          value={form.relationship}
          onChange={editRelationship}
        />
      </FormField>
      <FormField label="Order" required>
        <input
          type="text"
          inputMode="numeric"
          aria-required="true"
          aria-label="Order"
          value={form.order}
          onChange={editOrder}
        />
      </FormField>
    </FormDialogFrame>
  );
}

interface ConnectionDialogBodyProps {
  state: ConnectionDialogState;
  /** Every contact: the picker offers the active ones, and a refusal names one. */
  contacts: ContactView[];
  /** Why the contacts port refused the last save; null when it did not. */
  refusal: Rejected | null;
  onEdit: (patch: Partial<ConnectionForm>) => void;
  onSave: () => void;
  onCancel: () => void;
}

/** The name of the contact a `connection-taken` refusal speaks of: its detail is that contact's id. */
function connectedName(reason: Rejected, contacts: ContactView[]): string {
  const id = reason.detail ?? "";

  return (
    contacts.find((contact) => {
      return contact.id === id;
    })?.name ?? id
  );
}
