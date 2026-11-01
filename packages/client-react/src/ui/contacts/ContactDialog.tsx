import { type ChangeEvent, type ReactElement, useState } from "react";

import type { ContactDialogSpec, ContactDialogState } from "@cl/client-core";
import type {
  Address,
  ContactCategory,
  ContactRowDraft,
  RecordStatus,
  Rejected,
} from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { AddressDialog } from "../AddressDialog.tsx";
import { STATUS_LABELS } from "../buildingData/labels.ts";
import { Fieldset } from "../Fieldset.tsx";
import { FormDialogFrame } from "../FormDialogFrame.tsx";
import { FormField } from "../FormField.tsx";
import { useDialogWrite } from "../useDialogWrite.ts";
import { type ValueOption, ValueSelect } from "../ValueSelect.tsx";
import { AddressField } from "./AddressField.tsx";
import { CompanyFields } from "./CompanyFields.tsx";
import { ContactRowDialog } from "./ContactRowDialog.tsx";
import { ContactRowsField } from "./ContactRowsField.tsx";
import { contactReasonText } from "./contactReasons.ts";
import { LANGUAGE_LABELS, NO_CHOICE } from "./labels.ts";
import {
  type AddressKey,
  type ContactForm,
  PersonFields,
} from "./PersonFields.tsx";

/**
 * Reads the New or Edit Person or Company dialog, and hands its body plain
 * props. An address's ✎ opens the Address dialog and a row's ✎ or the ⊕
 * the Add or Edit Contact one, each over this card and not in it; which is
 * open is this one's own state. `onAdded` gets the id of a contact added,
 * before the dialog closes; `onSaved` runs once the contact is written.
 */
export function ContactDialog({
  spec,
  onAdded,
  onSaved,
  onCancel,
}: ContactDialogProps): ReactElement {
  const { useContactDialog, useContactsScreen } = useViewModel();
  const dialog = useContactDialog(spec, onAdded);
  const { view } = useContactsScreen();
  const write = useDialogWrite(onSaved, "the contact was not saved");
  const [addressField, setAddressField] = useState<AddressKey | null>(null);
  const [rowDialog, setRowDialog] = useState<RowDialogOpen | null>(null);
  const { form } = dialog.state;

  function edit(patch: Partial<ContactForm>): void {
    write.forget();
    dialog.edit(patch);
  }

  function save(): void {
    write.run(dialog.save);
  }

  function closeAddress(): void {
    setAddressField(null);
  }

  function applyAddress(address: Address): void {
    if (addressField !== null) {
      edit({ [addressField]: address });
    }
  }

  function openAddRow(): void {
    setRowDialog({ index: null, row: null });
  }

  function openEditRow(index: number): void {
    setRowDialog({ index, row: form.rows[index] ?? null });
  }

  function closeRow(): void {
    setRowDialog(null);
  }

  function applyRow(row: ContactRowDraft): void {
    write.forget();
    dialog.applyRow(rowDialog?.index ?? null, row);
  }

  function removeRow(index: number): void {
    write.forget();
    dialog.removeRow(index);
  }

  return (
    <>
      <ContactDialogBody
        state={dialog.state}
        categories={
          view?.categories.map((entry) => {
            return entry.category;
          }) ?? []
        }
        refusal={write.refusal}
        onEdit={edit}
        onEditAddress={setAddressField}
        onAddRow={openAddRow}
        onEditRow={openEditRow}
        onRemoveRow={removeRow}
        onSave={save}
        onCancel={onCancel}
      />
      {addressField === null ? null : (
        <AddressDialog
          address={form[addressField]}
          onApply={applyAddress}
          onClose={closeAddress}
        />
      )}
      {rowDialog === null ? null : (
        <ContactRowDialog
          row={rowDialog.row}
          nextOrder={dialog.state.nextOrder}
          onApply={applyRow}
          onClose={closeRow}
        />
      )}
    </>
  );
}

export interface ContactDialogProps {
  /** The contact the dialog edits, or the kind of a new one; read when it opens. */
  spec: ContactDialogSpec;
  /** The id of the contact added. */
  onAdded: (id: string) => void;
  /** The contact is written. */
  onSaved: () => void;
  onCancel: () => void;
}

/** The row dialog over the contact's: the place of the row it edits, or none for a new row. */
interface RowDialogOpen {
  index: number | null;
  row: ContactRowDraft | null;
}

/** The statuses in the design's order. */
const STATUSES: readonly ValueOption<RecordStatus>[] = (
  ["active", "archived"] as const
).map((status) => {
  return { value: status, label: STATUS_LABELS[status] };
});

/** The languages, or none. */
const LANGUAGES: readonly ValueOption<LanguageChoice>[] = [
  { value: "", label: NO_CHOICE },
  { value: "it", label: LANGUAGE_LABELS.it.name },
  { value: "en", label: LANGUAGE_LABELS.en.name },
];

type LanguageChoice = "" | "it" | "en";

/**
 * "New Person" or "Edit Person", "New Company" or "Edit Company": Status and
 * Code, the personal or company data, CONTACTS, USEFUL DATA and NOTES. Once
 * the person has edited something, why it cannot be saved yet; the port's
 * refusal in its place. Takes only props.
 */
function ContactDialogBody({
  state,
  categories,
  refusal,
  onEdit,
  onEditAddress,
  onAddRow,
  onEditRow,
  onRemoveRow,
  onSave,
  onCancel,
}: ContactDialogBodyProps): ReactElement {
  const { form, verdict } = state;
  const person = state.kind === "person";
  const adding = state.editing === null;
  const reason = refusal ?? (!verdict.ok && state.touched ? verdict : null);

  const salutations: ValueOption<string>[] = [
    { value: "", label: NO_CHOICE },
    ...state.salutations.map((salutation) => {
      return { value: salutation, label: salutation };
    }),
  ];

  const categoryOptions: ValueOption<string>[] = [
    { value: "", label: NO_CHOICE },
    ...categories.map((category) => {
      return { value: category.id, label: category.name };
    }),
  ];

  function editing(
    field: "code" | "taxCode" | "vatNumber",
  ): (event: ChangeEvent<HTMLInputElement>) => void {
    return (event: ChangeEvent<HTMLInputElement>): void => {
      onEdit({ [field]: event.target.value });
    };
  }

  function editStatus(status: RecordStatus): void {
    onEdit({ status });
  }

  function editSalutation(salutation: string): void {
    onEdit({ salutation: salutation === "" ? null : salutation });
  }

  function editCategory(categoryId: string): void {
    onEdit({ categoryId: categoryId === "" ? null : categoryId });
  }

  function editLanguage(language: LanguageChoice): void {
    onEdit({ language: language === "" ? null : language });
  }

  function editNotes(event: ChangeEvent<HTMLTextAreaElement>): void {
    onEdit({ notes: event.target.value });
  }

  function editPostalAddress(): void {
    onEditAddress("postalAddress");
  }

  function clearPostalAddress(): void {
    onEdit({ postalAddress: null });
  }

  return (
    <FormDialogFrame
      title={`${adding ? "New" : "Edit"} ${person ? "Person" : "Company"}`}
      adding={adding}
      canSave={state.canSave && verdict.ok}
      message={reason === null ? null : contactReasonText(reason, "")}
      onSave={onSave}
      onCancel={onCancel}
    >
      <FormField label="Status" required>
        <ValueSelect
          label="Status"
          required
          options={STATUSES}
          value={form.status}
          onChange={editStatus}
        />
      </FormField>
      <FormField label="Code">
        <input
          className="form-dialog-mono"
          aria-label="Code"
          value={form.code}
          onChange={editing("code")}
        />
      </FormField>
      {person ? (
        <PersonFields
          form={form}
          bornOn={state.bornOn}
          onEdit={onEdit}
          onEditAddress={onEditAddress}
        />
      ) : (
        <CompanyFields
          form={form}
          onEdit={onEdit}
          onEditAddress={onEditAddress}
        />
      )}
      <ContactRowsField
        rows={form.rows}
        onAdd={onAddRow}
        onEdit={onEditRow}
        onRemove={onRemoveRow}
      />
      <Fieldset legend="USEFUL DATA">
        <FormField label="Salutation">
          <ValueSelect
            label="Salutation"
            options={salutations}
            value={form.salutation ?? ""}
            onChange={editSalutation}
          />
        </FormField>
        <FormField label="Tax code">
          <input
            aria-label="Tax code"
            value={form.taxCode}
            onChange={editing("taxCode")}
          />
        </FormField>
        <FormField label="VAT number">
          <input
            aria-label="VAT number"
            value={form.vatNumber}
            onChange={editing("vatNumber")}
          />
        </FormField>
        <FormField label="Contact category">
          <ValueSelect
            label="Contact category"
            options={categoryOptions}
            value={form.categoryId ?? ""}
            onChange={editCategory}
          />
        </FormField>
        <AddressField
          label="Postal address"
          address={form.postalAddress}
          onEdit={editPostalAddress}
          onClear={clearPostalAddress}
        />
        <FormField label="Language">
          <ValueSelect
            label="Language"
            options={LANGUAGES}
            value={form.language ?? ""}
            onChange={editLanguage}
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

interface ContactDialogBodyProps {
  state: ContactDialogState;
  /** The categories to choose from. */
  categories: ContactCategory[];
  /** Why the contacts port refused the last save; null when it did not. */
  refusal: Rejected | null;
  onEdit: (patch: Partial<ContactForm>) => void;
  onEditAddress: (field: AddressKey) => void;
  onAddRow: () => void;
  onEditRow: (index: number) => void;
  onRemoveRow: (index: number) => void;
  onSave: () => void;
  onCancel: () => void;
}
