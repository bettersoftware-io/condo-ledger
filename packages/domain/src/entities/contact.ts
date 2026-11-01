import type { Address } from "./address.ts";
import type { RecordStatus } from "./building.ts";

/** What a contact row holds: a phone number, an email address, a website, an instant-messaging handle or a certified email address. */
export type ContactRowType = "phone" | "email" | "web" | "im" | "pec";

/** One line of a contact's means of reaching it: its type, the label it carries, the value, and its place among the contact's rows. */
export interface ContactRow {
  id: string;
  type: ContactRowType;
  label: string;
  value: string;
  order: number;
}

/** A group of contacts, such as "Electrician". */
export interface ContactCategory {
  id: string;
  name: string;
}

/** What a person and a company share. */
interface ContactBase {
  id: string;
  status: RecordStatus;
  code: string | null;
  categoryId: string | null;
  salutation: string | null;
  taxCode: string | null;
  vatNumber: string | null;
  postalAddress: Address | null;
  language: "it" | "en" | null;
  notes: string | null;
  /** The contact's rows, by their order. */
  rows: ContactRow[];
}

export interface PersonContact extends ContactBase {
  kind: "person";
  firstName: string | null;
  lastName: string;
  gender: "m" | "f" | null;
  /** An ISO date; null when unknown. */
  birthDate: string | null;
  /** A line of text: the city and the country. */
  birthPlace: string | null;
  officeAddress: Address | null;
  residenceAddress: Address | null;
  domicileAddress: Address | null;
}

export interface CompanyContact extends ContactBase {
  kind: "company";
  companyName: string;
  registeredOffice: Address | null;
  taxDomicile: Address | null;
}

/** A person or a company of the registry: an owner, a tenant or a supplier. */
export type Contact = PersonContact | CompanyContact;

/** A contact's link to another: the other says what it is to this one ("Managing director"). It shows on `contactId` only. */
export interface ContactConnection {
  id: string;
  /** The contact it shows on. */
  contactId: string;
  connectedId: string;
  relationship: string;
  order: number;
}

/** A building's supplier: the building and the supplier's contact. */
export interface SupplierLink {
  buildingId: string;
  contactId: string;
}

/** What the contact is called: a person's last name then first name, a company's name. */
export function nameOf(contact: Contact): string {
  return contact.kind === "company"
    ? contact.companyName
    : [contact.lastName, contact.firstName]
        .filter((part) => {
          return part !== null && part !== "";
        })
        .join(" ");
}

/** The address a list shows for the contact: a person's office, else residence, else domicile, else postal; a company's registered office, else tax domicile, else postal. Null with none. */
export function referenceAddressOf(contact: Contact): Address | null {
  const chain =
    contact.kind === "company"
      ? [contact.registeredOffice, contact.taxDomicile, contact.postalAddress]
      : [
          contact.officeAddress,
          contact.residenceAddress,
          contact.domicileAddress,
          contact.postalAddress,
        ];

  return (
    chain.find((address) => {
      return address !== null;
    }) ?? null
  );
}
