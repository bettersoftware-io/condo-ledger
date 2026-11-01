import type {
  CompanyContact,
  Contact,
  ContactRow,
  PersonContact,
} from "#/entities/contact.ts";
import { ok, type Result, rejected } from "#/entities/result.ts";

/** A contact row as the dialog holds it: a new one has no id yet. */
export interface ContactRowDraft {
  id: string | null;
  type: ContactRow["type"];
  label: string;
  value: string;
  order: number;
}

/** What the person dialog hands the port. */
interface PersonDraft extends Omit<PersonContact, "id" | "rows"> {
  rows: ContactRowDraft[];
}

/** What the company dialog hands the port. */
interface CompanyDraft extends Omit<CompanyContact, "id" | "rows"> {
  rows: ContactRowDraft[];
}

/** The contact's fields without its id, its rows as drafts. */
export type ContactDraft = PersonDraft | CompanyDraft;

const CODE_MAX = 15;

/**
 * Whether a contact may be saved: `editing` is its id, null for a new one.
 * The reasons are checked in this order: a blank last name (a person) or
 * company name, a code over 15 characters, a code another contact has (a
 * blank code is allowed), a birth date that is not a date. Codes compare
 * trimmed and by case.
 */
export function validateContact(
  draft: ContactDraft,
  contacts: Contact[],
  editing: string | null,
): Result {
  if (draft.kind === "person" && draft.lastName.trim() === "") {
    return rejected("blank-last-name");
  }

  if (draft.kind === "company" && draft.companyName.trim() === "") {
    return rejected("blank-company-name");
  }

  const code = (draft.code ?? "").trim();

  if (code.length > CODE_MAX) {
    return rejected("code-too-long");
  }

  const codeTaken =
    code !== "" &&
    contacts.some((contact) => {
      return contact.id !== editing && same(contact.code ?? "", code);
    });

  if (codeTaken) {
    return rejected("contact-code-taken", code);
  }

  if (
    draft.kind === "person" &&
    draft.birthDate !== null &&
    !isDate(draft.birthDate)
  ) {
    return rejected("bad-birth-date");
  }

  return ok();
}

/** Whether a contact row may be kept: a label, a value, and an order that is a whole number from 1. */
export function validateContactRow(row: ContactRowDraft): Result {
  if (row.label.trim() === "") {
    return rejected("blank-label");
  }

  if (row.value.trim() === "") {
    return rejected("blank-value");
  }

  return Number.isInteger(row.order) && row.order >= 1
    ? ok()
    : rejected("bad-order");
}

function same(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function isDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

  if (match === null) {
    return false;
  }

  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}
