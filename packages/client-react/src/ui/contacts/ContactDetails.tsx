import type { ReactElement } from "react";

import type { ContactsView } from "@cl/client-core";
import {
  type Address,
  addressTextOf,
  type CompanyContact,
  type ContactRow,
  type ContactView,
  type PersonContact,
} from "@cl/domain";

import { STATUS_LABELS } from "../buildingData/labels.ts";
import { CONTACT_KIND_ICONS, CONTACT_KIND_LABELS } from "../contactLabels.ts";
import { Fieldset } from "../Fieldset.tsx";
import { formatDate } from "../format.ts";
import { Scheda } from "../Scheda.tsx";
import { SheetField } from "../SheetField.tsx";
import {
  GENDER_LABELS,
  GENDER_UNSPECIFIED,
  LANGUAGE_LABELS,
  NO_BUILDINGS,
} from "./labels.ts";

import "./ContactDetails.css";

/**
 * The Contact Details tab: the selected contact's sheet, read only. Its kind,
 * status and code; its personal or company data; its rows; the buildings it
 * supplies (or - None -); the buildings it is a resident of, on an invoice of
 * and in an entry of, each only when there is one; its useful data and its
 * notes. An empty value reads `---`, dim. Takes only props, so the compiler
 * memoizes it.
 */
export function ContactDetails({
  contact: view,
  uses,
}: ContactDetailsProps): ReactElement {
  const { contact } = view;
  const active = view.status === "active";

  return (
    <Scheda>
      <SheetField
        label="Contact type"
        value={`${CONTACT_KIND_ICONS[view.kind]} ${CONTACT_KIND_LABELS[view.kind]}`}
      />
      <SheetField
        label="Status"
        value={
          active ? `✓ ${STATUS_LABELS.active}` : STATUS_LABELS[view.status]
        }
        tone={active ? "ok" : undefined}
      />
      <SheetField label="Code" value={contact.code} tone="mono" />
      {contact.kind === "person" ? (
        <PersonData contact={contact} />
      ) : (
        <CompanyData contact={contact} />
      )}
      <Fieldset legend="CONTACTS">
        {contact.rows.length === 0 ? (
          <p className="contact-blank">---</p>
        ) : (
          contact.rows.map((row) => {
            return (
              <SheetField
                key={row.id}
                label={row.label}
                value={row.value}
                tone={toneOf(row)}
              />
            );
          })
        )}
      </Fieldset>
      <Fieldset legend="SUPPLIER OF THE FOLLOWING BUILDINGS">
        {uses.supplierOf.length === 0 ? (
          <div className="contact-building" data-blank="true">
            {NO_BUILDINGS}
          </div>
        ) : (
          <Buildings names={uses.supplierOf} />
        )}
      </Fieldset>
      <UsedIn legend="RESIDENT OF" names={uses.residentOf} />
      <UsedIn legend="ON INVOICES OF" names={uses.onInvoicesOf} />
      <UsedIn legend="IN ENTRIES OF" names={uses.inEntriesOf} />
      <Fieldset legend="USEFUL DATA">
        <SheetField label="Salutation" value={contact.salutation} />
        <SheetField label="Tax code" value={contact.taxCode} />
        <SheetField label="VAT number" value={contact.vatNumber} />
        <SheetField label="Category" value={view.category} />
        <SheetField
          label="Postal address"
          value={textOfAddress(contact.postalAddress)}
        />
        <SheetField
          label="Language"
          value={
            contact.language === null
              ? null
              : LANGUAGE_LABELS[contact.language].name
          }
        />
      </Fieldset>
      <Fieldset legend="NOTES">
        <p className="contact-notes" data-blank={isBlank(contact.notes)}>
          {isBlank(contact.notes) ? "---" : contact.notes}
        </p>
      </Fieldset>
    </Scheda>
  );
}

export interface ContactDetailsProps {
  /** The selected contact. */
  contact: ContactView;
  /** The buildings, by name, where it is used. */
  uses: NonNullable<ContactsView["uses"]>;
}

interface PersonDataProps {
  contact: PersonContact;
}

function PersonData({ contact }: PersonDataProps): ReactElement {
  return (
    <Fieldset legend="PERSONAL DATA">
      <SheetField label="First name" value={contact.firstName} />
      <SheetField label="Last name" value={contact.lastName} />
      <SheetField
        label="Gender"
        value={
          contact.gender === null
            ? GENDER_UNSPECIFIED
            : GENDER_LABELS[contact.gender]
        }
      />
      <SheetField
        label="Birth date"
        value={
          contact.birthDate === null ? null : formatDate(contact.birthDate)
        }
      />
      <SheetField label="Birth place" value={contact.birthPlace} />
      <SheetField
        label="Office address"
        value={textOfAddress(contact.officeAddress)}
      />
      <SheetField
        label="Residence address"
        value={textOfAddress(contact.residenceAddress)}
      />
      <SheetField
        label="Domicile address"
        value={textOfAddress(contact.domicileAddress)}
      />
    </Fieldset>
  );
}

interface CompanyDataProps {
  contact: CompanyContact;
}

function CompanyData({ contact }: CompanyDataProps): ReactElement {
  return (
    <Fieldset legend="COMPANY DATA">
      <SheetField label="Company name" value={contact.companyName} />
      <SheetField
        label="Registered office"
        value={textOfAddress(contact.registeredOffice)}
      />
      <SheetField
        label="Tax domicile"
        value={textOfAddress(contact.taxDomicile)}
      />
    </Fieldset>
  );
}

interface UsedInProps {
  legend: string;
  names: string[];
}

/** A fieldset of the buildings a contact is used in, left out when there is none. */
function UsedIn({ legend, names }: UsedInProps): ReactElement | null {
  if (names.length === 0) {
    return null;
  }

  return (
    <Fieldset legend={legend}>
      <Buildings names={names} />
    </Fieldset>
  );
}

interface BuildingsProps {
  names: string[];
}

function Buildings({ names }: BuildingsProps): ReactElement {
  return (
    <>
      {names.map((name) => {
        return (
          <div key={name} className="contact-building">
            <span aria-hidden="true">🏢</span>
            {name}
          </div>
        );
      })}
    </>
  );
}

/** An email, a website and a certified email are links in the accent; a phone and a handle are plain. */
function toneOf(row: ContactRow): "accent" | undefined {
  return row.type === "phone" || row.type === "im" ? undefined : "accent";
}

function textOfAddress(address: Address | null): string | null {
  return address === null ? null : addressTextOf(address);
}

function isBlank(text: string | null): boolean {
  return text === null || text === "";
}
