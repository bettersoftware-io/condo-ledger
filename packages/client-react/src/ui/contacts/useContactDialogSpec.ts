import { useState } from "react";

import type { ContactDialogSpec } from "@cl/client-core";
import type { Contact, ContactView } from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

/**
 * Which person or company dialog a picker's buttons have opened over the
 * dialog the picker is in: none, a new contact of a kind, or the contact
 * chosen. The dialog that holds the picker draws it beside its own card, and
 * is the one that knows which contact is chosen.
 */
export function useContactDialogSpec(
  contacts: ContactView[],
  chosenId: string | null,
): ContactDialogSpecOpen {
  const [spec, setSpec] = useState<ContactDialogSpec | null>(null);

  function openNew(kind: Contact["kind"]): void {
    setSpec({ kind, editing: null });
  }

  // Edit is pressed with a contact chosen, and one chosen is among the contacts.
  function openChosen(): void {
    const chosen = must(
      contacts.find((contact) => {
        return contact.id === chosenId;
      }),
      "the contact chosen",
    );

    setSpec({ kind: chosen.kind, editing: chosen.contact });
  }

  function close(): void {
    setSpec(null);
  }

  return { spec, openNew, openChosen, close };
}

/** The dialog open over the one that holds the picker, and what opens and closes it. */
interface ContactDialogSpecOpen {
  /** The dialog open; null while none is. */
  spec: ContactDialogSpec | null;
  openNew: (kind: Contact["kind"]) => void;
  openChosen: () => void;
  close: () => void;
}
