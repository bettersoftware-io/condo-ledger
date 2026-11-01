import { type ChangeEvent, type ReactElement, useId, useState } from "react";

import { type Contact, type ContactView, offerableContacts } from "@cl/domain";

import { CONTACT_KIND_ICONS, CONTACT_KIND_LABELS } from "../contactLabels.ts";
import { FormField } from "../FormField.tsx";
import { TESTIDS } from "../testids.ts";

import "./ContactPicker.css";

/**
 * A contact to link, the owner's Linked contact unless `label` says other: a name typed into the box, and under it the
 * contacts whose name holds what is typed (the domain's `offerableContacts`), people and companies, each a
 * button that links that contact. Only active contacts are offered; one
 * already linked is shown whatever its status. The box shows the linked contact's name,
 * however it came to be linked. Typing again unlinks it and looks anew. A
 * fixed contact (an owner being edited) cannot change. When it `creating`,
 * buttons beside the box ask to make a New company or a New person, to Edit
 * the contact chosen, or to Clear it; a fixed contact has Edit only. The
 * dialogs those open are the owner's, drawn beside its card. What is typed is
 * this view's own state. Takes only props.
 */
export function ContactPicker({
  contacts,
  value,
  fixed,
  creating,
  label = "Linked contact",
  onChange,
  onNew,
  onEdit,
}: ContactPickerProps): ReactElement {
  const listId = useId();
  const chosen =
    contacts.find((contact) => {
      return contact.id === value;
    }) ?? null;
  const [typed, setTyped] = useState("");
  const offered = chosen === null ? offerableContacts(contacts, typed) : [];
  const open = chosen === null && typed.trim() !== "";

  function type(event: ChangeEvent<HTMLInputElement>): void {
    setTyped(event.target.value);

    if (value !== null) {
      onChange(null);
    }
  }

  function clear(): void {
    setTyped("");
    onChange(null);
  }

  function making(kind: Contact["kind"]): () => void {
    return (): void => {
      onNew?.(kind);
    };
  }

  function edit(): void {
    onEdit?.();
  }

  function choosing(contact: ContactView): () => void {
    return (): void => {
      onChange(contact.id);
    };
  }

  return (
    <div className="contact-picker">
      <FormField label={label} required>
        <input
          type="text"
          aria-label={label}
          aria-required="true"
          aria-controls={open ? listId : undefined}
          placeholder="Type a name…"
          value={chosen?.name ?? typed}
          disabled={fixed}
          onChange={type}
        />
      </FormField>
      {creating ? (
        <fieldset className="contact-picker-tools" aria-label="Contact tools">
          {fixed ? null : (
            <>
              <PickerTool
                label="New company"
                glyph={CONTACT_KIND_ICONS.company}
                onClick={making("company")}
              />
              <PickerTool
                label="New person"
                glyph={CONTACT_KIND_ICONS.person}
                onClick={making("person")}
              />
            </>
          )}
          <PickerTool
            label="Edit contact"
            glyph="✎"
            disabled={chosen === null}
            onClick={edit}
          />
          {fixed ? null : (
            <PickerTool
              label="Clear"
              glyph="⊖"
              disabled={chosen === null}
              onClick={clear}
            />
          )}
        </fieldset>
      ) : null}
      {open ? (
        <ul
          id={listId}
          className="contact-picker-list"
          aria-label="Matching contacts"
          data-testid={TESTIDS.contactPickerList}
        >
          {offered.length === 0 ? (
            <li className="contact-picker-empty">No contact matches.</li>
          ) : (
            offered.map((contact) => {
              return (
                <li key={contact.id}>
                  <button
                    type="button"
                    className="contact-picker-option"
                    data-testid={TESTIDS.contactPickerOption}
                    onClick={choosing(contact)}
                  >
                    <span className="contact-picker-name">{contact.name}</span>
                    <span className="contact-picker-kind">
                      {CONTACT_KIND_LABELS[contact.kind]}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}

export interface ContactPickerProps {
  /** The contacts an owner can be linked to. */
  contacts: ContactView[];
  /** The linked contact's id; null for none. */
  value: string | null;
  /** The contact cannot change: an owner being edited keeps theirs. */
  fixed: boolean;
  /** Draws the buttons that make, edit and clear a contact; without it none is drawn. */
  creating: boolean;
  /** The field's name; the owner's "Linked contact" unless given. */
  label?: string;
  onChange: (contactId: string | null) => void;
  /** New company or New person was pressed: the dialog is the owner's to open. */
  onNew?: (kind: Contact["kind"]) => void;
  /** Edit contact was pressed, with a contact chosen. */
  onEdit?: () => void;
}

/** A button beside the box: its words are its name and its tooltip, its glyph what is drawn. */
function PickerTool({
  label,
  glyph,
  disabled = false,
  onClick,
}: PickerToolProps): ReactElement {
  return (
    <button
      type="button"
      className="contact-picker-tool"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  );
}

interface PickerToolProps {
  label: string;
  glyph: string;
  disabled?: boolean;
  onClick: () => void;
}
