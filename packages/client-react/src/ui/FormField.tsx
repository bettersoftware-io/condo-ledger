import {
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";

import { TESTIDS } from "./testids.ts";

import "./FormField.css";

/**
 * A dialog's form row: the label column, then the box the field sits in. The
 * row is the field's `<label>`, so the field it holds takes the label as its
 * name; a required one is marked with a `*` that is drawn, not read, and the
 * field is announced as required instead. A read-only row holds a value, not
 * a field: it is a group (a `<fieldset>`) named by its label.
 */
export function FormField({
  label,
  required = false,
  readOnly = false,
  children,
}: FormFieldProps): ReactElement {
  const row = useRef<HTMLLabelElement>(null);
  const labelId = useId();

  // The field is the caller's, drawn with the row: after each render, the
  // row marks whatever its label names. A field that another one replaced
  // on its own state, without the row redrawing, would go unmarked until the
  // row draws again; no field in a row does that.
  useEffect(() => {
    if (row.current !== null) {
      markRequired(row.current, required);
    }
  });

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
      ref={row}
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

/** Sets `aria-required` on the field a row's label names, or takes it off; a row that names no field marks nothing. */
function markRequired(row: HTMLLabelElement, required: boolean): void {
  if (required) {
    row.control?.setAttribute("aria-required", "true");
  } else {
    row.control?.removeAttribute("aria-required");
  }
}
