import type { ReactElement, ReactNode } from "react";

import { TESTIDS } from "./testids.ts";

import "./FormField.css";

/**
 * A dialog's form row: the label column, then the box the field sits in. The
 * row is the field's `<label>`, so the field it holds takes the label as its
 * name; a required one is marked with a `*` that is drawn, not read.
 */
export function FormField({
  label,
  required = false,
  readOnly = false,
  children,
}: FormFieldProps): ReactElement {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is the caller's children, which Biome cannot see; this label is what names it
    <label
      className="form-field"
      data-testid={TESTIDS.formField}
      data-required={required}
      data-read-only={readOnly}
    >
      <span className="form-field-label" data-testid={TESTIDS.formFieldLabel}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </span>
      <span className="form-field-box">{children}</span>
    </label>
  );
}

export interface FormFieldProps {
  label: string;
  required?: boolean;
  /** A computed value: the box is drawn on the zebra, dimmed. */
  readOnly?: boolean;
  children: ReactNode;
}
