import type { CompanyContact, PersonContact } from "#/entities/contact.ts";

/** A person with nothing filled in but a name: active, no code, no category, no address and no row. */
export function createPersonContact(
  id: string,
  lastName: string,
  firstName: string | null,
  overrides: Partial<PersonContact> = {},
): PersonContact {
  return {
    id,
    kind: "person",
    status: "active",
    code: null,
    categoryId: null,
    salutation: null,
    taxCode: null,
    vatNumber: null,
    postalAddress: null,
    language: null,
    notes: null,
    rows: [],
    firstName,
    lastName,
    gender: null,
    birthDate: null,
    birthPlace: null,
    officeAddress: null,
    residenceAddress: null,
    domicileAddress: null,
    ...overrides,
  };
}

/** A company with nothing filled in but a name. */
export function createCompanyContact(
  id: string,
  companyName: string,
  overrides: Partial<CompanyContact> = {},
): CompanyContact {
  return {
    id,
    kind: "company",
    status: "active",
    code: null,
    categoryId: null,
    salutation: null,
    taxCode: null,
    vatNumber: null,
    postalAddress: null,
    language: null,
    notes: null,
    rows: [],
    companyName,
    registeredOffice: null,
    taxDomicile: null,
    ...overrides,
  };
}
