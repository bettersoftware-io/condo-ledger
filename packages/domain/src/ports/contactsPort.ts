import type { Observable } from "rxjs";

import type {
  Contact,
  ContactCategory,
  ContactConnection,
} from "#/entities/contact.ts";
import type { Added, Result, ResultOf } from "#/entities/result.ts";
import type { ContactUsesById } from "#/useCases/contacts/contactUses.ts";
import type { ConnectionDraft } from "#/useCases/contacts/validateConnection.ts";
import type { ContactDraft } from "#/useCases/contacts/validateContact.ts";

/**
 * The administrator's registry of people and companies: owners, tenants and
 * suppliers. Each write is judged by its validator and answers its verdict;
 * the reads emit again after an accepted one. A write that names an id the
 * port does not have rejects.
 */
export interface ContactsPort {
  contacts(): Observable<Contact[]>;
  categories(): Observable<ContactCategory[]>;
  /** The contacts the contact is connected to, by their order; the connections show on this contact only. */
  connections(contactId: string): Observable<ContactConnection[]>;
  /** Where each contact is used; a contact used nowhere has no entry. */
  uses(): Observable<ContactUsesById>;
  /** The new contact's id is the number after the highest held. A row of the draft with no id gets one. */
  addContact(draft: ContactDraft): Promise<ResultOf<Added>>;
  /** The contact keeps its kind: a draft of the other kind is refused. Rows the draft leaves out are deleted. */
  editContact(id: string, draft: ContactDraft): Promise<Result>;
  /** Takes the contact's rows and every connection on either end; refused while the contact is used. */
  deleteContact(id: string): Promise<Result>;
  addCategory(name: string): Promise<ResultOf<Added>>;
  editCategory(id: string, name: string): Promise<Result>;
  /** Refused while a contact is in it. */
  deleteCategory(id: string): Promise<Result>;
  /** Shows on `contactId` only. */
  addConnection(
    contactId: string,
    draft: ConnectionDraft,
  ): Promise<ResultOf<Added>>;
  editConnection(id: string, draft: ConnectionDraft): Promise<Result>;
  deleteConnection(id: string): Promise<Result>;
}
