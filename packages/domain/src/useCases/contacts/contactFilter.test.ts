import { describe, expect, it } from "vitest";

import type { Contact } from "#/entities/contact.ts";

import {
  ALL_CONTACTS,
  type ContactFilter,
  filterContacts,
} from "./contactFilter.ts";
import type { ContactUses, ContactUsesById } from "./contactUses.ts";

describe("filterContacts", () => {
  it("lists everyone with the default filter", () => {
    expect(filterContacts(contacts, ALL_CONTACTS, new Map())).toEqual(contacts);
  });

  it("lists persons and companies by their boxes, and none with neither", () => {
    expect(
      filterContacts(contacts, createFilter({ companies: false }), new Map()),
    ).toEqual([person]);
    expect(
      filterContacts(contacts, createFilter({ persons: false }), new Map()),
    ).toEqual([company]);
    expect(
      filterContacts(
        contacts,
        createFilter({ persons: false, companies: false }),
        new Map(),
      ),
    ).toEqual([]);
  });

  it("finds a keyword in each of six fields, ignoring case and accents", () => {
    const rich = [
      createPerson("a", { code: "Città" }),
      createPerson("b", { firstName: "Zeno" }),
      createPerson("c", { lastName: "Quirino" }),
      createCompany("d", { companyName: "Gamma Srl" }),
      createPerson("e", { taxCode: "TAX123" }),
      createCompany("f", { vatNumber: "IT999" }),
      createPerson("g", { notes: "citta" }),
    ];

    function find(keyword: string): string[] {
      return filterContacts(rich, createFilter({ keyword }), new Map()).map(
        (contact) => {
          return contact.id;
        },
      );
    }

    expect(find("citta")).toEqual(["a"]);
    expect(find("ZEN")).toEqual(["b"]);
    expect(find("quiri")).toEqual(["c"]);
    expect(find("gamma")).toEqual(["d"]);
    expect(find("tax12")).toEqual(["e"]);
    expect(find("it99")).toEqual(["f"]);
  });

  it("narrows nothing on a blank keyword", () => {
    expect(
      filterContacts(contacts, createFilter({ keyword: "   " }), new Map()),
    ).toEqual(contacts);
  });

  it("filters by building through each of its four meanings", () => {
    const uses: ContactUsesById = new Map([
      ["a", createUses({ residentOf: ["c1"] })],
      ["b", createUses({ supplierOf: ["c1"] })],
      ["c", createUses({ onInvoicesOf: ["c1"] })],
      ["d", createUses({ inEntriesOf: ["c1"] })],
      ["e", createUses({ residentOf: ["c2"] })],
    ]);

    const many = ["a", "b", "c", "d", "e", "f"].map((id) => {
      return createPerson(id, {});
    });

    expect(
      filterContacts(many, createFilter({ buildingId: "c1" }), uses).map(
        (contact) => {
          return contact.id;
        },
      ),
    ).toEqual(["a", "b", "c", "d"]);
  });

  it("filters by status and by category", () => {
    const set = [
      createPerson("a", { status: "archived", categoryId: "mc1" }),
      createPerson("b", { categoryId: "mc1" }),
      createPerson("c", {}),
    ];

    expect(
      filterContacts(set, createFilter({ status: "archived" }), new Map()),
    ).toEqual([set[0]]);
    expect(
      filterContacts(set, createFilter({ categoryId: "mc1" }), new Map()),
    ).toEqual([set[0], set[1]]);
  });

  const person = createPerson("md1", {});

  const company = createCompany("md2", {});

  const contacts = [person, company];
});

function createFilter(over: Partial<ContactFilter>): ContactFilter {
  return { ...ALL_CONTACTS, ...over };
}

function createUses(over: Partial<ContactUses>): ContactUses {
  return {
    supplierOf: [],
    residentOf: [],
    onInvoicesOf: [],
    inEntriesOf: [],
    ...over,
  };
}

function createPerson(id: string, over: Partial<Contact>): Contact {
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
    firstName: null,
    lastName: `Last ${id}`,
    gender: null,
    birthDate: null,
    birthPlace: null,
    officeAddress: null,
    residenceAddress: null,
    domicileAddress: null,
    ...over,
  } as Contact;
}

function createCompany(id: string, over: Partial<Contact>): Contact {
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
    companyName: `Company ${id}`,
    registeredOffice: null,
    taxDomicile: null,
    ...over,
  } as Contact;
}
