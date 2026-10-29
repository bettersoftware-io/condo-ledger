import { type ReactElement, type ReactNode, useId } from "react";

import { TESTIDS } from "./testids.ts";

import "./FormField.css";

/**
 * A dialog's form row: the label column, then the box the field sits in. The
 * row is the field's `<label>`, so the field it holds takes the label as its
 * name; a required one is marked with a `*` that is drawn, not read. The
 * field is the caller's, and the caller announces it as required
 * (`aria-required`) where the row says `required`. A read-only row holds a value, not
 * a field: it is a group (a `<fieldset>`) named by its label.
 */
export function FormField({
  label,
  required = false,
  readOnly = false,
  children,
}: FormFieldProps): ReactElement {
  const labelId = useId();

  const name = (
    <span
      id={labelId}
      className="form-field-label"
      data-testid={TESTIDS.formFieldLabel}
    >
      {label}
      {required ? <span aria-hidden="true"> *</span> : null}
    </span>
  );
  const box = <span className="form-field-box">{children}</span>;

  if (readOnly) {
    return (
      <fieldset
        className="form-field"
        data-testid={TESTIDS.formField}
        data-required={required}
        data-read-only={true}
        aria-labelledby={labelId}
      >
        {name}
        {box}
      </fieldset>
    );
  }

  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is the caller's children, which Biome cannot see; this label is what names it
    <label
      className="form-field"
      data-testid={TESTIDS.formField}
      data-required={required}
      data-read-only={false}
    >
      {name}
      {box}
    </label>
  );
}

export interface FormFieldProps {
  label: string;
  required?: boolean;
  /** A computed value: the box is drawn on the zebra, dimmed, and names no field. */
  readOnly?: boolean;
  children: ReactNode;
}
