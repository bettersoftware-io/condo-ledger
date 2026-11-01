import type { ReactElement } from "react";

import type { ContactRowDraft } from "@cl/domain";

import { FormField } from "../FormField.tsx";
import { TESTIDS } from "../testids.ts";

import "./ContactRowsField.css";

/**
 * The CONTACTS fieldset of a person or company form: the rows held by the
 * form, each as `✎ ⊖ value` under its label, and ⊕ on the legend to add one.
 * ⊖ takes a row out without asking; nothing is written until the contact is
 * saved. Takes only props, so the compiler memoizes it.
 */
export function ContactRowsField({
  rows,
  onAdd,
  onEdit,
  onRemove,
}: ContactRowsFieldProps): ReactElement {
  return (
    <fieldset className="scheda-fieldset contact-rows-field">
      <legend>CONTACTS</legend>
      <button
        type="button"
        className="contact-rows-add"
        aria-label="Add contact row"
        onClick={onAdd}
      >
        ⊕
      </button>
      {rows.map((row, index) => {
        return (
          <ContactRowLine
            // A row added now has no id yet, and the order is editable: the place in the list is its identity.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            key={index}
            row={row}
            index={index}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        );
      })}
    </fieldset>
  );
}

export interface ContactRowsFieldProps {
  /** The rows the form holds, by their place in it. */
  rows: ContactRowDraft[];
  onAdd: () => void;
  /** Asks for the Edit Contact dialog on the row at this place. */
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
}

interface ContactRowLineProps {
  row: ContactRowDraft;
  index: number;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
}

function ContactRowLine({
  row,
  index,
  onEdit,
  onRemove,
}: ContactRowLineProps): ReactElement {
  function edit(): void {
    onEdit(index);
  }

  function remove(): void {
    onRemove(index);
  }

  return (
    <div className="form-dialog-address" data-testid={TESTIDS.contactFormRow}>
      <FormField label={row.label} readOnly>
        <button
          type="button"
          className="form-dialog-address-tool"
          data-tone="acc"
          aria-label={`Edit ${row.label}`}
          onClick={edit}
        >
          ✎
        </button>
        <button
          type="button"
          className="form-dialog-address-tool"
          data-tone="neg"
          aria-label={`Remove ${row.label}`}
          onClick={remove}
        >
          ⊖
        </button>
        <span
          className="form-dialog-address-text"
          data-testid={TESTIDS.contactFormRowValue}
        >
          {row.value}
        </span>
      </FormField>
    </div>
  );
}
