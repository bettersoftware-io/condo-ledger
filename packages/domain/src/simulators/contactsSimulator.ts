import { type Observable, of } from "rxjs";

import type { Contact } from "#/entities/contact.ts";
import type { ContactsPort } from "#/ports/contactsPort.ts";

import type { LegacySeed } from "./seed/legacySeed.ts";

/** The seed's contacts, answered to anyone who asks. */
export function createContactsSimulator(seed: LegacySeed): ContactsPort {
  return {
    contacts: (): Observable<Contact[]> => {
      return of(seed.contacts);
    },
  };
}
