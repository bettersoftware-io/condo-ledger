import type { ReactElement } from "react";

import type { SupplierDialogState } from "@cl/client-core";
import type { Contact, ContactView, Rejected } from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { ContactDialog } from "../contacts/ContactDialog.tsx";
import { ContactPicker } from "../contacts/ContactPicker.tsx";
import { contactReasonText } from "../contacts/contactReasons.ts";
import { useContactDialogSpec } from "../contacts/useContactDialogSpec.ts";
import { FormDialogFrame } from "../FormDialogFrame.tsx";
import { useDialogWrite } from "../useDialogWrite.ts";

/**
 * Reads the Add Supplier dialog on one building, and the contacts, and hands
 * its body plain props. The picker's New and Edit buttons open the person or
 * company dialog beside this card, not in it; which one is open is the
 * `useContactDialogSpec` state, and a contact it adds is the one chosen.
 */
export function SupplierDialog({
  buildingId,
  onSaved,
  onCancel,
}: SupplierDialogProps): ReactElement {
  const { useSupplierDialog, useContacts } = useViewModel();
  const dialog = useSupplierDialog(buildingId);
  const contacts = useContacts();
  const write = useDialogWrite(onSaved, "the supplier was not saved");
  const contactDialog = useContactDialogSpec(
    contacts,
    dialog.state.form.contactId,
  );

  function edit(patch: Partial<SupplierForm>): void {
    write.forget();
    dialog.edit(patch);
  }

  function save(): void {
    write.run(dialog.save);
  }

  function chooseAdded(contactId: string): void {
    edit({ contactId });
  }

  return (
    <>
      <SupplierDialogBody
        state={dialog.state}
        contacts={contacts}
        refusal={write.refusal}
        onEdit={edit}
        onNewContact={contactDialog.openNew}
        onEditContact={contactDialog.openChosen}
        onSave={save}
        onCancel={onCancel}
      />
      {contactDialog.spec === null ? null : (
        <ContactDialog
          spec={contactDialog.spec}
          onAdded={chooseAdded}
          onSaved={contactDialog.close}
          onCancel={contactDialog.close}
        />
      )}
    </>
  );
}

export interface SupplierDialogProps {
  /** The building the supplier is added to, read when the dialog opens. */
  buildingId: string;
  /** The supplier is added. */
  onSaved: () => void;
  onCancel: () => void;
}

type SupplierForm = SupplierDialogState["form"];

/**
 * "Add Supplier": the Contact, chosen with the picker. Once the person has
 * edited something, why it cannot be saved yet; the port's refusal in its
 * place. Takes only props.
 */
function SupplierDialogBody({
  state,
  contacts,
  refusal,
  onEdit,
  onNewContact,
  onEditContact,
  onSave,
  onCancel,
}: SupplierDialogBodyProps): ReactElement {
  const { form, verdict } = state;
  const reason = refusal ?? (!verdict.ok && state.touched ? verdict : null);

  function editContact(contactId: string | null): void {
    onEdit({ contactId });
  }

  return (
    <FormDialogFrame
      title="Add Supplier"
      adding
      canSave={state.canSave && verdict.ok}
      message={
        reason === null ? null : contactReasonText(reason, reason.detail ?? "")
      }
      labels="owner"
      onSave={onSave}
      onCancel={onCancel}
    >
      <ContactPicker
        label="Contact"
        contacts={contacts}
        value={form.contactId}
        fixed={false}
        creating
        onChange={editContact}
        onNew={onNewContact}
        onEdit={onEditContact}
      />
    </FormDialogFrame>
  );
}

interface SupplierDialogBodyProps {
  state: SupplierDialogState;
  /** Every contact: the picker offers the active ones. */
  contacts: ContactView[];
  /** Why the buildings port refused the last save; null when it did not. */
  refusal: Rejected | null;
  onEdit: (patch: Partial<SupplierForm>) => void;
  /** New company or New person: opens that dialog. */
  onNewContact: (kind: Contact["kind"]) => void;
  /** Edit contact: opens the dialog on the contact chosen. */
  onEditContact: () => void;
  onSave: () => void;
  onCancel: () => void;
}
