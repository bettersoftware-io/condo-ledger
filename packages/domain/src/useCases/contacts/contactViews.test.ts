import { describe, expect, it } from "vitest";

import type { Address } from "#/entities/address.ts";
import { nameOf, referenceAddressOf } from "#/entities/contact.ts";
import {
  createCompanyContact,
  createPersonContact,
} from "#/testing/createContacts.ts";

import { contactViewsOf } from "./contactViews.ts";

describe("referenceAddressOf", () => {
  it("gives a person's office address first", () => {
    expect(referenceAddressOf(createPersonWithAll())).toEqual(OFFICE);
  });

  it("falls to the residence, then the domicile, then the postal address", () => {
    const person = createPersonWithAll();
    const noOffice = { ...person, officeAddress: null };
    const noResidence = { ...noOffice, residenceAddress: null };
    const postalOnly = { ...noResidence, domicileAddress: null };

    expect(referenceAddressOf(noOffice)).toEqual(RESIDENCE);
    expect(referenceAddressOf(noResidence)).toEqual(DOMICILE);
    expect(referenceAddressOf(postalOnly)).toEqual(POSTAL);
  });

  it("gives a person with no address none", () => {
    expect(
      referenceAddressOf(createPersonContact("md1", "Rossi", "Mario")),
    ).toBeNull();
  });

  it("gives a company's registered office first, then the tax domicile, then the postal address", () => {
    const company = createCompanyContact("md2", "Alfa", {
      registeredOffice: OFFICE,
      taxDomicile: DOMICILE,
      postalAddress: POSTAL,
    });
    const noOffice = { ...company, registeredOffice: null };
    const postalOnly = { ...noOffice, taxDomicile: null };

    expect(referenceAddressOf(company)).toEqual(OFFICE);
    expect(referenceAddressOf(noOffice)).toEqual(DOMICILE);
    expect(referenceAddressOf(postalOnly)).toEqual(POSTAL);
  });

  it("gives a company with no address none", () => {
    expect(referenceAddressOf(createCompanyContact("md2", "Alfa"))).toBeNull();
  });
});

describe("nameOf", () => {
  it("gives a person's last name then first name", () => {
    expect(nameOf(createPersonContact("md1", "Rossi", "Mario"))).toBe(
      "Rossi Mario",
    );
  });

  it("gives a person with no first name the last name alone", () => {
    expect(nameOf(createPersonContact("md1", "Rossi", null))).toBe("Rossi");
    expect(nameOf(createPersonContact("md1", "Rossi", ""))).toBe("Rossi");
  });

  it("gives a company its name", () => {
    expect(nameOf(createCompanyContact("md2", "Alfa s.n.c."))).toBe(
      "Alfa s.n.c.",
    );
  });
});

describe("contactViewsOf", () => {
  it("lists the contacts by name, then id, with the category's name and the reference address as text", () => {
    const views = contactViewsOf(
      [
        createPersonContact("md9", "Verdi", "Luca"),
        createCompanyContact("md3", "Alfa", {
          categoryId: "mc2",
          registeredOffice: {
            street: "Via Roma, 1",
            postcode: "33100",
            city: "Udine",
          },
        }),
        createPersonContact("md2", "Bianchi", "Anna"),
        createPersonContact("md1", "Bianchi", "Anna"),
      ],
      [{ id: "mc2", name: "Gardener" }],
    );

    expect(
      views.map((view) => {
        return view.id;
      }),
    ).toEqual(["md3", "md1", "md2", "md9"]);
    expect(views[0]).toMatchObject({
      kind: "company",
      name: "Alfa",
      status: "active",
      code: null,
      category: "Gardener",
      referenceAddress: "Via Roma, 1, 33100 Udine",
    });
    expect(views[1]?.category).toBeNull();
    expect(views[1]?.referenceAddress).toBeNull();
  });

  it("sorts names the Italian way and keeps the contact itself", () => {
    const contact = createPersonContact("md1", "Èvola", "Anna");
    const views = contactViewsOf(
      [createPersonContact("md2", "Zeta", null), contact],
      [],
    );

    expect(views[0]?.contact).toBe(contact);
    expect(views[0]?.name).toBe("Èvola Anna");
  });

  it("gives a category the list does not hold none", () => {
    const [view] = contactViewsOf(
      [createPersonContact("md1", "Rossi", "Mario", { categoryId: "mc9" })],
      [],
    );

    expect(view?.category).toBeNull();
  });
});

const OFFICE: Address = { street: "Via Uno, 1", postcode: null, city: null };
const RESIDENCE: Address = { street: "Via Due, 2", postcode: null, city: null };
const DOMICILE: Address = { street: "Via Tre, 3", postcode: null, city: null };
const POSTAL: Address = {
  street: "Via Quattro, 4",
  postcode: null,
  city: null,
};

function createPersonWithAll(): ReturnType<typeof createPersonContact> {
  return createPersonContact("md1", "Rossi", "Mario", {
    officeAddress: OFFICE,
    residenceAddress: RESIDENCE,
    domicileAddress: DOMICILE,
    postalAddress: POSTAL,
  });
}
