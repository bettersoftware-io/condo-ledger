import { type ChangeEvent, type ReactElement, useId } from "react";

import { FormField } from "./FormField.tsx";
import { formatDate } from "./format.ts";
import { TESTIDS } from "./testids.ts";

import "./DateField.css";

/**
 * A date typed as text, in whatever short form the person likes. Beside the
 * text, the date it was read as, in full (`dd/mm/yyyy`), until the text is
 * itself in full form.
 */
export function DateField({
  label,
  required = false,
  disabled = false,
  value,
  parsed,
  onChange,
}: DateFieldProps): ReactElement {
  function change(event: ChangeEvent<HTMLInputElement>): void {
    onChange(event.target.value);
  }

  const parsedId = useId();
  const showParsed = parsed !== null && !FULL_FORM.test(value.trim());

  return (
    <FormField label={label} required={required}>
      <input
        type="text"
        aria-label={label}
        aria-required={required}
        aria-describedby={showParsed ? parsedId : undefined}
        value={value}
        disabled={disabled}
        onChange={change}
      />
      {showParsed ? (
        <span
          className="date-field-parsed"
          id={parsedId}
          data-testid={TESTIDS.dateFieldParsed}
        >
          {formatDate(parsed)}
        </span>
      ) : null}
    </FormField>
  );
}

export interface DateFieldProps {
  label: string;
  required?: boolean;
  /** The date cannot be changed while this holds. */
  disabled?: boolean;
  /** The text as typed. */
  value: string;
  /** The ISO date the text reads as, or null when it reads as none. */
  parsed: string | null;
  onChange: (text: string) => void;
}

/** `dd/mm/yyyy`: nothing to show beside it. */
const FULL_FORM = /^\d{2}\/\d{2}\/\d{4}$/;
