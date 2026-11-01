import { map, type Observable, of } from "rxjs";

import type {
  Contact,
  ContactCategory,
  ContactConnection,
} from "#/entities/contact.ts";
import type { ContactsPort } from "#/ports/contactsPort.ts";

import type { LegacySeed } from "./seed/legacySeed.ts";

/** The seed's contacts, categories and connections, answered to anyone who asks. */
export function createContactsSimulator(seed: LegacySeed): ContactsPort {
  return {
    contacts: (): Observable<Contact[]> => {
      return of(seed.contacts);
    },
    categories: (): Observable<ContactCategory[]> => {
      return of(seed.contactCategories);
    },
    connections: (contactId: string): Observable<ContactConnection[]> => {
      return of(seed.contactConnections).pipe(
        map((all) => {
          return all
            .filter((connection) => {
              return connection.contactId === contactId;
            })
            .sort((a, b) => {
              return a.order - b.order;
            });
        }),
      );
    },
  };
}
