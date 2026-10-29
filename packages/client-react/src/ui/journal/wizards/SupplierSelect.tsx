import type { ReactElement } from "react";

import type { WizardChoice } from "@cl/client-core";

import { FormField } from "#/ui/FormField.tsx";
import { TESTIDS } from "#/ui/testids.ts";

import { ChoiceSelect } from "./ChoiceSelect.tsx";

import "./SupplierSelect.css";
import "./Wizards.css";

/**
 * The supplier of an invoice: a form row over the wizards' choice select. A
 * locked one (the invoice has payments) cannot change, and says why in its
 * note under the box.
 */
export function SupplierSelect({
  choices,
  value,
  locked,
  note,
  onChange,
}: SupplierSelectProps): ReactElement {
  return (
    <div className="supplier-select">
      <FormField label="Supplier" required>
        <ChoiceSelect
          required
          label="Supplier"
          choices={choices}
          value={value}
          onChoose={onChange}
          disabled={locked}
          placeholder="Choose a supplier…"
        />
      </FormField>
      {note === undefined ? null : (
        <p
          className="supplier-select-note"
          data-testid={TESTIDS.supplierSelectNote}
        >
          {note}
        </p>
      )}
    </div>
  );
}

export interface SupplierSelectProps {
  choices: WizardChoice[];
  value: string | null;
  /** The supplier cannot change. */
  locked: boolean;
  /** Said under the box, whether locked or not. */
  note?: string;
  onChange: (key: string | null) => void;
}
