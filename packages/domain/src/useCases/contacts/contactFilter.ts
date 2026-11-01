import type { RecordStatus } from "#/entities/building.ts";
import type { Contact } from "#/entities/contact.ts";

import type { ContactUsesById } from "./contactUses.ts";

/** What the Filter Contacts card holds. A null building, status or category is "- All -". */
export interface ContactFilter {
  persons: boolean;
  companies: boolean;
  keyword: string;
  buildingId: string | null;
  status: RecordStatus | null;
  categoryId: string | null;
}

/** The filter that Reset restores: both boxes ticked, nothing else narrowed. */
export const ALL_CONTACTS: ContactFilter = {
  persons: true,
  companies: true,
  keyword: "",
  buildingId: null,
  status: null,
  categoryId: null,
};

/**
 * The contacts the filter lets through, in their order. The keyword is
 * contained in the code, first name, last name, company name, tax code or VAT
 * number, ignoring case and accents. A building holds a contact that is its
 * resident or supplier, is on its invoices or is in its entries.
 */
export function filterContacts(
  contacts: Contact[],
  filter: ContactFilter,
  uses: ContactUsesById,
): Contact[] {
  const keyword = fold(filter.keyword);

  return contacts.filter((contact) => {
    if (contact.kind === "person" ? !filter.persons : !filter.companies) {
      return false;
    }

    if (filter.status !== null && contact.status !== filter.status) {
      return false;
    }

    if (
      filter.categoryId !== null &&
      contact.categoryId !== filter.categoryId
    ) {
      return false;
    }

    if (
      keyword !== "" &&
      !keywordFields(contact).some((field) => {
        return fold(field).includes(keyword);
      })
    ) {
      return false;
    }

    return (
      filter.buildingId === null ||
      usesBuilding(uses, contact, filter.buildingId)
    );
  });
}

/**
 * The contacts a picker offers for what is typed: the active ones whose name
 * holds the text, ignoring case and accents as the keyword does. Blank text
 * offers none.
 */
export function offerableContacts<
  T extends { name: string; status: RecordStatus },
>(contacts: T[], typed: string): T[] {
  const text = fold(typed);

  if (text === "") {
    return [];
  }

  return contacts.filter((contact) => {
    return contact.status === "active" && fold(contact.name).includes(text);
  });
}

function keywordFields(contact: Contact): string[] {
  const own =
    contact.kind === "person"
      ? [contact.firstName, contact.lastName]
      : [contact.companyName];

  return [contact.code, ...own, contact.taxCode, contact.vatNumber].filter(
    (field) => {
      return field !== null;
    },
  );
}

function usesBuilding(
  uses: ContactUsesById,
  contact: Contact,
  buildingId: string,
): boolean {
  const found = uses.get(contact.id);

  return (
    found !== undefined &&
    [
      found.residentOf,
      found.supplierOf,
      found.onInvoicesOf,
      found.inEntriesOf,
    ].some((buildingIds) => {
      return buildingIds.includes(buildingId);
    })
  );
}

function fold(text: string): string {
  return text.trim().normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
