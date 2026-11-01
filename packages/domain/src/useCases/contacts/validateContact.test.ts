import { describe, expect, it } from "vitest";

import type { Contact } from "#/entities/contact.ts";

import {
  type ContactDraft,
  type ContactRowDraft,
  validateContact,
  validateContactRow,
} from "./validateContact.ts";

describe("validateContact", () => {
  it("accepts a person and a company", () => {
    expect(validateContact(createPersonDraft({}), [], null)).toEqual({
      ok: true,
    });
    expect(validateContact(createCompanyDraft({}), [], null)).toEqual({
      ok: true,
    });
  });

  it("refuses a blank last name and a blank company name, spaces included", () => {
    expect(
      validateContact(createPersonDraft({ lastName: "  " }), [], null),
    ).toEqual({ ok: false, reason: "blank-last-name" });
    expect(
      validateContact(createCompanyDraft({ companyName: " " }), [], null),
    ).toEqual({ ok: false, reason: "blank-company-name" });
  });

  it("allows a code of 15 characters and refuses one of 16", () => {
    expect(
      validateContact(createPersonDraft({ code: "a".repeat(15) }), [], null),
    ).toEqual({ ok: true });
    expect(
      validateContact(createPersonDraft({ code: "a".repeat(16) }), [], null),
    ).toEqual({ ok: false, reason: "code-too-long" });
  });

  it("refuses the code of another contact, by case, with the code as detail", () => {
    const others = [createContact("md1", "Città")];

    expect(
      validateContact(createPersonDraft({ code: "CITTÀ" }), others, null),
    ).toEqual({ ok: false, reason: "contact-code-taken", detail: "CITTÀ" });
  });

  it("lets a contact keep its code, and lets blank codes repeat", () => {
    const contacts = [createContact("md1", "A1"), createContact("md2", null)];

    expect(
      validateContact(createPersonDraft({ code: "A1" }), contacts, "md1"),
    ).toEqual({ ok: true });
    expect(
      validateContact(createPersonDraft({ code: " " }), contacts, null),
    ).toEqual({ ok: true });
    expect(
      validateContact(createPersonDraft({ code: null }), contacts, "md1"),
    ).toEqual({ ok: true });
  });

  it("refuses a birth date that is not a date", () => {
    for (const birthDate of ["2023-02-30", "2023-13-01", "abc", "2023-2-3"]) {
      expect(
        validateContact(createPersonDraft({ birthDate }), [], null),
      ).toEqual({ ok: false, reason: "bad-birth-date" });
    }

    expect(
      validateContact(createPersonDraft({ birthDate: "2024-02-29" }), [], null),
    ).toEqual({ ok: true });
    expect(
      validateContact(createPersonDraft({ birthDate: null }), [], null),
    ).toEqual({ ok: true });
  });
});

describe("validateContactRow", () => {
  it("accepts a row", () => {
    expect(validateContactRow(createRow({}))).toEqual({ ok: true });
  });

  it("refuses a blank label and a blank value", () => {
    expect(validateContactRow(createRow({ label: " " }))).toEqual({
      ok: false,
      reason: "blank-label",
    });
    expect(validateContactRow(createRow({ value: "" }))).toEqual({
      ok: false,
      reason: "blank-value",
    });
  });

  it("refuses an order that is not a whole number from 1", () => {
    expect(validateContactRow(createRow({ order: 0 }))).toEqual({
      ok: false,
      reason: "bad-order",
    });
    expect(validateContactRow(createRow({ order: 1.5 }))).toEqual({
      ok: false,
      reason: "bad-order",
    });
    expect(validateContactRow(createRow({ order: 1 }))).toEqual({ ok: true });
  });
});

function createPersonDraft(over: Partial<ContactDraft>): ContactDraft {
  return {
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
    firstName: "Anna",
    lastName: "Rossi",
    gender: null,
    birthDate: null,
    birthPlace: null,
    officeAddress: null,
    residenceAddress: null,
    domicileAddress: null,
    ...over,
  } as ContactDraft;
}

function createCompanyDraft(over: Partial<ContactDraft>): ContactDraft {
  return {
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
    companyName: "Acme",
    registeredOffice: null,
    taxDomicile: null,
    ...over,
  } as ContactDraft;
}

function createContact(id: string, code: string | null): Contact {
  return {
    ...createPersonDraft({ code }),
    id,
    rows: [],
  } as Contact;
}

function createRow(over: Partial<ContactRowDraft>): ContactRowDraft {
  return {
    id: null,
    type: "phone",
    label: "Phone",
    value: "000",
    order: 1,
    ...over,
  };
}
