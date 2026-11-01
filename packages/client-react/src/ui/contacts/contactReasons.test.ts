import { describe, expect, it } from "vitest";

import { rejected } from "@cl/domain";

import { contactReasonText } from "./contactReasons.ts";

describe("contactReasonText", () => {
  it.each([
    ["blank-last-name", "Enter a last name"],
    ["blank-company-name", "Enter a company name"],
    ["code-too-long", "A code has at most 15 characters"],
    ["bad-birth-date", "The birth date is not a date"],
    ["blank-label", "Enter a label"],
    ["blank-value", "Enter a value"],
    ["bad-order", "The order is a whole number from 1"],
    ["blank-name", "Enter a name"],
    ["name-too-long", "A name has at most 63 characters"],
    ["no-contact", "Choose a contact"],
    ["same-contact", "A contact cannot be connected to itself"],
    ["blank-relationship", "Enter the relationship"],
    ["relationship-too-long", "A relationship has at most 127 characters"],
  ])("words %s", (reason, text) => {
    expect(contactReasonText(rejected(reason), "Someone")).toBe(text);
  });

  it("names the code another contact has", () => {
    expect(
      contactReasonText(rejected("contact-code-taken", "ABC"), "Someone"),
    ).toBe("Another contact has the code ABC");
  });

  it("names the category another is named like", () => {
    expect(
      contactReasonText(rejected("category-name-taken", "Taxes"), ""),
    ).toBe("Another category is named Taxes");
  });

  it("counts the contacts that keep a category, and says one in the singular", () => {
    expect(contactReasonText(rejected("category-not-empty", "4"), "")).toBe(
      "Move its 4 contacts to another category first.",
    );
    expect(contactReasonText(rejected("category-not-empty", "1"), "")).toBe(
      "Move its contact to another category first.",
    );
  });

  it("names the connected contact, whose id is the detail", () => {
    expect(
      contactReasonText(rejected("connection-taken", "md7"), "Someone"),
    ).toBe("Someone already has this relationship");
  });

  it("names the contact already a supplier", () => {
    expect(
      contactReasonText(rejected("already-supplier", "Someone"), "Someone"),
    ).toBe("Someone is already a supplier of this building");
  });

  it.each([
    ["is-resident", "a resident of"],
    ["is-supplier", "a supplier of"],
    ["on-invoice", "on an invoice of"],
    ["in-entries", "in an entry of"],
  ])("says where %s keeps a contact from being deleted", (reason, where) => {
    expect(contactReasonText(rejected(reason, "Pozzetto"), "Someone")).toBe(
      `Someone is ${where} Pozzetto, so it cannot be deleted. Archive it instead.`,
    );
  });

  it("words the wizards' common reasons, and shows a reason no one words as it is", () => {
    expect(contactReasonText(rejected("saving"), "")).toBe("Saving…");
    expect(contactReasonText(rejected("unknown-contact"), "")).toBe(
      "unknown-contact",
    );
  });
});
