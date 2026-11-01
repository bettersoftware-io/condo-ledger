import type { ChangeEvent, ReactElement } from "react";

import { Fieldset } from "../Fieldset.tsx";
import { FormField } from "../FormField.tsx";
import { AddressField } from "./AddressField.tsx";
import type { AddressKey, ContactForm } from "./PersonFields.tsx";

/**
 * The COMPANY DATA fieldset of a company's form: Company name, Registered
 * office and Tax domicile. Takes only props, so the compiler memoizes it.
 */
export function CompanyFields({
  form,
  onEdit,
  onEditAddress,
}: CompanyFieldsProps): ReactElement {
  function editName(event: ChangeEvent<HTMLInputElement>): void {
    onEdit({ companyName: event.target.value });
  }

  function addressOf(
    field: "registeredOffice" | "taxDomicile",
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
    <Fieldset legend="COMPANY DATA">
      <FormField label="Company name" required>
        <input
          aria-required="true"
          aria-label="Company name"
          value={form.companyName}
          onChange={editName}
        />
      </FormField>
      {addressOf("registeredOffice", "Registered office")}
      {addressOf("taxDomicile", "Tax domicile")}
    </Fieldset>
  );
}

export interface CompanyFieldsProps {
  form: ContactForm;
  onEdit: (patch: Partial<ContactForm>) => void;
  /** Asks for the Address dialog on this address of the form. */
  onEditAddress: (field: AddressKey) => void;
}
