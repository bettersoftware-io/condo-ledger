import { Archive } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import type { ContactView } from "@cl/domain";

import { STATUS_LABELS } from "../buildingData/labels.ts";
import { CONTACT_KIND_ICONS, CONTACT_KIND_LABELS } from "../contactLabels.ts";
import { TESTIDS } from "../testids.ts";
import { LANGUAGE_LABELS } from "./labels.ts";
import { TextCell } from "./TextCell.tsx";

import "./contactCells.css";

/**
 * The cells a contact has in every grid that lists contacts, after its name:
 * Code, Type, St., Reference address, Tax code and VAT no. A column with
 * nothing reads `---`, dim.
 */
export function contactCells(view: ContactView): ReactNode[] {
  const { contact } = view;

  return [
    <TextCell key="code" value={view.code} mono />,
    <span
      key="type"
      className="contact-type"
      title={CONTACT_KIND_LABELS[view.kind]}
    >
      {CONTACT_KIND_ICONS[view.kind]}
    </span>,
    <span
      key="status"
      className="contact-status"
      data-testid={TESTIDS.contactStatus}
      data-status={view.status}
      title={STATUS_LABELS[view.status]}
    >
      {view.status === "active" ? (
        "✓"
      ) : (
        <Archive size={13} aria-hidden="true" />
      )}
    </span>,
    <TextCell key="address" value={view.referenceAddress} />,
    <TextCell key="taxCode" value={contact.taxCode} />,
    <TextCell key="vat" value={contact.vatNumber} />,
  ];
}

/** The Lng. cell: the flag of the contact's language, named by its tooltip; blank with none. */
export function languageCell(view: ContactView): ReactElement {
  const { language } = view.contact;

  if (language === null) {
    return <span key="language" />;
  }

  const { flag, name } = LANGUAGE_LABELS[language];

  return (
    <span
      key="language"
      className="contact-language"
      data-testid={TESTIDS.contactLanguage}
      title={name}
    >
      {flag}
    </span>
  );
}

/** The Category cell. */
export function categoryCell(view: ContactView): ReactElement {
  return <TextCell key="category" value={view.category} />;
}
