import type { Rejected } from "@cl/domain";

import { reasonText } from "../journal/wizards/reasons.ts";

/** The Contacts screen's reasons with nothing to fill in. */
const FIXED: Readonly<Record<string, string>> = {
  "blank-last-name": "Enter a last name",
  "blank-company-name": "Enter a company name",
  "code-too-long": "A code has at most 15 characters",
  "bad-birth-date": "The birth date is not a date",
  "blank-label": "Enter a label",
  "blank-value": "Enter a value",
  "bad-order": "The order is a whole number from 1",
  "blank-name": "Enter a name",
  "name-too-long": "A name has at most 63 characters",
  "no-contact": "Choose a contact",
  "same-contact": "A contact cannot be connected to itself",
  "blank-relationship": "Enter the relationship",
  "relationship-too-long": "A relationship has at most 127 characters",
};

/** What a contact cannot be deleted for, by the reason's code. */
const USED_AS: Readonly<Record<string, string>> = {
  "is-resident": "a resident of",
  "is-supplier": "a supplier of",
  "on-invoice": "on an invoice of",
  "in-entries": "in an entry of",
};

/**
 * A refusal of the contact, category, connection or supplier dialogs, or of a
 * delete on the Contacts screen, as the person reads it. `name` is the
 * contact the refusal speaks of, for the reasons whose detail is not its name:
 * `connection-taken` carries the connected contact's id, and `is-resident`,
 * `is-supplier`, `on-invoice` and `in-entries` the building. The rest are
 * worded from their detail, or fixed; a reason no one words is shown as it is.
 */
export function contactReasonText(refusal: Rejected, name: string): string {
  const detail = refusal.detail ?? "";
  const usedAs = USED_AS[refusal.reason];

  if (usedAs !== undefined) {
    return `${name} is ${usedAs} ${detail}, so it cannot be deleted. Archive it instead.`;
  }

  switch (refusal.reason) {
    case "contact-code-taken":
      return `Another contact has the code ${detail}`;
    case "category-name-taken":
      return `Another category is named ${detail}`;
    case "category-not-empty":
      return detail === "1"
        ? "Move its contact to another category first."
        : `Move its ${detail} contacts to another category first.`;
    case "connection-taken":
      return `${name} already has this relationship`;
    case "already-supplier":
      return `${name} is already a supplier of this building`;
    default:
      return reasonText(refusal.reason, FIXED);
  }
}
