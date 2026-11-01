import type { Contact } from "@cl/domain";

/** A contact's kind in words, wherever a contact is shown. */
export const CONTACT_KIND_LABELS: Record<Contact["kind"], string> = {
  person: "Person",
  company: "Company",
};

/** A contact's kind as an icon, wherever a contact is listed or its sheet is drawn. */
export const CONTACT_KIND_ICONS: Record<Contact["kind"], string> = {
  person: "👤",
  company: "🏢",
};
