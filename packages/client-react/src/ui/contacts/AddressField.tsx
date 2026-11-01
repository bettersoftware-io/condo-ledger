import type { ReactElement } from "react";

import { type Address, addressTextOf } from "@cl/domain";

import { FormField } from "../FormField.tsx";
import { TESTIDS } from "../testids.ts";

/**
 * An address in a form, drawn as `✎ ⊖ value` and not as a box: ✎ asks for the
 * Address dialog, ⊖ clears the address. The dialog is its owner's to open, as
 * it is drawn beside the card it edits and not inside it. Takes only props.
 */
export function AddressField({
  label,
  address,
  onEdit,
  onClear,
}: AddressFieldProps): ReactElement {
  return (
    <div className="form-dialog-address">
      <FormField label={label} readOnly>
        <button
          type="button"
          className="form-dialog-address-tool"
          data-tone="acc"
          aria-label={`Edit ${label}`}
          onClick={onEdit}
        >
          ✎
        </button>
        <button
          type="button"
          className="form-dialog-address-tool"
          data-tone="neg"
          aria-label={`Remove ${label}`}
          disabled={address === null}
          onClick={onClear}
        >
          ⊖
        </button>
        <span
          className="form-dialog-address-text"
          data-empty={address === null}
          data-testid={TESTIDS.formDialogAddress}
        >
          {address === null ? "---" : addressTextOf(address)}
        </span>
      </FormField>
    </div>
  );
}

export interface AddressFieldProps {
  label: string;
  /** The address held; null for none. */
  address: Address | null;
  /** Asks for the Address dialog on this address. */
  onEdit: () => void;
  /** Sets the address to none. */
  onClear: () => void;
}
