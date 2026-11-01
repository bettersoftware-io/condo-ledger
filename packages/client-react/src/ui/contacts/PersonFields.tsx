import type { ChangeEvent, ReactElement } from "react";

import type { ContactDialogState } from "@cl/client-core";

import { DateField } from "../DateField.tsx";
import { Fieldset } from "../Fieldset.tsx";
import { FormField } from "../FormField.tsx";
import { RadioField } from "../RadioField.tsx";
import type { ValueOption } from "../ValueSelect.tsx";
import { AddressField } from "./AddressField.tsx";
import { GENDER_LABELS, GENDER_UNSPECIFIED } from "./labels.ts";

/**
 * The PERSONAL DATA fieldset of a person's form: First name, Last name,
 * Gender, Birth date, Birth place and the three addresses. Takes only
 * props, so the compiler memoizes it.
 */
export function PersonFields({
  form,
  bornOn,
  onEdit,
  onEditAddress,
}: PersonFieldsProps): ReactElement {
  function editing(
    field: "firstName" | "lastName" | "birthPlace",
  ): (event: ChangeEvent<HTMLInputElement>) => void {
    return (event: ChangeEvent<HTMLInputElement>): void => {
      onEdit({ [field]: event.target.value });
    };
  }

  function editGender(gender: GenderChoice): void {
    onEdit({ gender: gender === "" ? null : gender });
  }

  function editBirthDate(text: string): void {
    onEdit({ birthDate: text });
  }

  function addressOf(
    field: "officeAddress" | "residenceAddress" | "domicileAddress",
    label: string,
  ): ReactElement {
    function edit(): void {
      onEditAddress(field);
    }

    function clear(): void {
      onEdit({ [field]: null });
    }

    return (
      <AddressField
        label={label}
        address={form[field]}
        onEdit={edit}
        onClear={clear}
      />
    );
  }

  return (
    <Fieldset legend="PERSONAL DATA">
      <FormField label="First name">
        <input
          aria-label="First name"
          value={form.firstName}
          onChange={editing("firstName")}
        />
      </FormField>
      <FormField label="Last name" required>
        <input
          aria-required="true"
          aria-label="Last name"
          value={form.lastName}
          onChange={editing("lastName")}
        />
      </FormField>
      <RadioField
        label="Gender"
        options={GENDERS}
        value={form.gender ?? ""}
        onChange={editGender}
      />
      <DateField
        label="Birth date"
        value={form.birthDate}
        parsed={bornOn}
        onChange={editBirthDate}
      />
      <FormField label="Birth place">
        <input
          aria-label="Birth place"
          value={form.birthPlace}
          onChange={editing("birthPlace")}
        />
      </FormField>
      {addressOf("officeAddress", "Office address")}
      {addressOf("residenceAddress", "Residence address")}
      {addressOf("domicileAddress", "Domicile address")}
    </Fieldset>
  );
}

/** The form a contact dialog holds. */
export type ContactForm = ContactDialogState["form"];

/** The addresses of a form, by the field that holds each. */
export type AddressKey =
  | "officeAddress"
  | "residenceAddress"
  | "domicileAddress"
  | "registeredOffice"
  | "taxDomicile"
  | "postalAddress";

export interface PersonFieldsProps {
  form: ContactForm;
  /** The ISO date the birth date reads as; null while blank or unreadable. */
  bornOn: string | null;
  onEdit: (patch: Partial<ContactForm>) => void;
  /** Asks for the Address dialog on this address of the form. */
  onEditAddress: (field: AddressKey) => void;
}

type GenderChoice = "" | "m" | "f";

/** The genders in the design's order, with none as Unspecified. */
const GENDERS: readonly ValueOption<GenderChoice>[] = [
  { value: "m", label: GENDER_LABELS.m },
  { value: "f", label: GENDER_LABELS.f },
  { value: "", label: GENDER_UNSPECIFIED },
];
