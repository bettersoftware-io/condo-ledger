import type { Observable } from "rxjs";

import type {
  Contact,
  ContactCategory,
  ContactConnection,
} from "#/entities/contact.ts";

/** The administrator's registry of people and companies: owners, tenants and suppliers. Read only for now. */
export interface ContactsPort {
  contacts(): Observable<Contact[]>;
  categories(): Observable<ContactCategory[]>;
  /** The contacts the contact is connected to, by their order; the connections show on this contact only. */
  connections(contactId: string): Observable<ContactConnection[]>;
}
