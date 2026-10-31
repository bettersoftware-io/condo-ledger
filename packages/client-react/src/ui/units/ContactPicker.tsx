import { type ChangeEvent, type ReactElement, useId, useState } from "react";

import type { Contact } from "@cl/domain";

import { FormField } from "../FormField.tsx";
import { TESTIDS } from "../testids.ts";
import { CONTACT_KIND_LABELS } from "./labels.ts";

import "./ContactPicker.css";

/**
 * The owner's Linked contact: a name typed into the box, and under it the
 * contacts whose name holds what is typed, people and companies, each a
 * button that links that contact and writes its name into the box. Typing
 * again unlinks it and looks anew. A fixed contact (an owner being edited) is
 * shown in the box, which cannot change. What is typed is this view's own
 * state. Takes only props.
 */
export function ContactPicker({
  contacts,
  value,
  fixed,
  onChange,
}: ContactPickerProps): ReactElement {
  const listId = useId();
  const chosen =
    contacts.find((contact) => {
      return contact.id === value;
    }) ?? null;
  const [typed, setTyped] = useState("");
  const query = typed.trim().toLowerCase();
  const offered =
    chosen !== null || query === ""
      ? []
      : contacts.filter((contact) => {
          return contact.name.toLowerCase().includes(query);
        });
  const open = chosen === null && query !== "";

  function type(event: ChangeEvent<HTMLInputElement>): void {
    setTyped(event.target.value);

    if (value !== null) {
      onChange(null);
    }
  }

  function choosing(contact: Contact): () => void {
    return (): void => {
      setTyped(contact.name);
      onChange(contact.id);
    };
  }

  return (
    <div className="contact-picker">
      <FormField label="Linked contact" required>
        <input
          type="text"
          aria-label="Linked contact"
          aria-required="true"
          aria-controls={open ? listId : undefined}
          placeholder="Type a name…"
          value={fixed ? (chosen?.name ?? "") : typed}
          disabled={fixed}
          onChange={type}
        />
      </FormField>
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
  contacts: Contact[];
  /** The linked contact's id; null for none. */
  value: string | null;
  /** The contact cannot change: an owner being edited keeps theirs. */
  fixed: boolean;
  onChange: (contactId: string | null) => void;
}
