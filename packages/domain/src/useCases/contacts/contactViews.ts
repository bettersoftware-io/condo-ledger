import { addressTextOf } from "#/entities/address.ts";
import type { RecordStatus } from "#/entities/building.ts";
import {
  type Contact,
  type ContactCategory,
  nameOf,
  referenceAddressOf,
} from "#/entities/contact.ts";

/** A contact as a list shows it: the contact, its name, its category's name and its reference address as text. */
export interface ContactView {
  contact: Contact;
  id: string;
  kind: Contact["kind"];
  name: string;
  status: RecordStatus;
  code: string | null;
  category: string | null;
  referenceAddress: string | null;
}

/** The contacts as views, by name, then id. */
export function contactViewsOf(
  contacts: Contact[],
  categories: ContactCategory[],
): ContactView[] {
  const names = new Map(
    categories.map((category) => {
      return [category.id, category.name];
    }),
  );

  return contacts
    .map((contact): ContactView => {
      const address = referenceAddressOf(contact);

      return {
        contact,
        id: contact.id,
        kind: contact.kind,
        name: nameOf(contact),
        status: contact.status,
        code: contact.code,
        category:
          contact.categoryId === null
            ? null
            : (names.get(contact.categoryId) ?? null),
        referenceAddress: address === null ? null : addressTextOf(address),
      };
    })
    .sort((a, b) => {
      return a.name.localeCompare(b.name, "it") || a.id.localeCompare(b.id);
    });
}
