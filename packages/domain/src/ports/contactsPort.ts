import type { Observable } from "rxjs";

import type { Contact } from "#/entities/contact.ts";

/** The administrator's registry of people and companies: owners, tenants and suppliers. Read only for now. */
export interface ContactsPort {
  contacts(): Observable<Contact[]>;
}
