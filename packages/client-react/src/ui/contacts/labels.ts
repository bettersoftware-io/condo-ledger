import type { Contact, ContactRowType } from "@cl/domain";

// What the Contacts screen calls its values and its tabs, and the glyphs it
// draws them with. Its own module, apart from the components that draw them:
// a component file exports components only.

/** The bottom panel's tabs, in the design's order. */
export const CONTACT_TABS = ["Contact Details", "Connected Contacts"] as const;

/** A language as the list draws it: the flag, and its name as the tooltip and on the sheet. */
interface LanguageLabel {
  flag: string;
  name: string;
}

export const LANGUAGE_LABELS: Record<
  NonNullable<Contact["language"]>,
  LanguageLabel
> = {
  it: { flag: "🇮🇹", name: "Italian" },
  en: { flag: "🇬🇧", name: "English" },
};

/** A person's gender in words. */
export const GENDER_LABELS = {
  m: "Male",
  f: "Female",
} as const;

/** What a person with no gender set reads. */
export const GENDER_UNSPECIFIED = "Unspecified";

/** What the sheet says when the supplier fieldset has no building. */
export const NO_BUILDINGS = "- None -";

/** What the list and the bottom panel say when the filters let no contact through. */
export const NO_CONTACT_MATCHES = "No contact matches.";

/** A contact row's type in words; also the label a new row of that type starts with. */
export const ROW_TYPE_LABELS: Record<ContactRowType, string> = {
  phone: "Phone",
  email: "Email",
  web: "Website",
  im: "Instant messaging",
  pec: "Certified email",
};

/** What a select of an optional choice (a salutation, a category, a language) says for none. */
export const NO_CHOICE = "- None -";
