import type { Address } from "./address.ts";
import type { RecordStatus } from "./building.ts";

/** A person or a company of the registry: an owner, a tenant or a supplier. */
export interface Contact {
  id: string;
  kind: "person" | "company";
  name: string;
  status: RecordStatus;
  code: string | null;
  category: string | null;
  companyName: string | null;
  registeredOffice: Address | null;
  taxDomicile: Address | null;
  /** The first phone number the contact has; null when none. */
  phone: string | null;
  /** The first email address the contact has; null when none. */
  email: string | null;
}

/** A building's supplier: the building and the supplier's contact. */
export interface SupplierLink {
  buildingId: string;
  contactId: string;
}
