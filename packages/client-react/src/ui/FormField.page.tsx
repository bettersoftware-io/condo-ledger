import { render, within } from "@testing-library/react";

import { FormField, type FormFieldProps } from "./FormField.tsx";
import { TESTIDS } from "./testids.ts";

/** What a test can ask of a form field. */
export interface FormFieldPage {
  /** The label as drawn, with its trailing `*` when required. */
  labelText: () => string;
  isRequired: () => boolean;
  isReadOnly: () => boolean;
  /** Whether a text box is found by this name, as a person's label names it. */
  hasTextBoxNamed: (name: string) => boolean;
  /** The text of the group of this name; null when assistive technology finds no such group. */
  groupText: (name: string) => string | null;
  /** Whether the row is a `<label>`: it should be only when it holds a field to name. */
  isLabelElement: () => boolean;
}

export function mountFormField(props: Partial<FormFieldProps>): FormFieldPage {
  const rendered = render(
    <FormField label="Description" {...props}>
      {props.children ?? <input />}
    </FormField>,
  );

  function field(): HTMLElement {
    return rendered.getByTestId(TESTIDS.formField);
  }

  return {
    labelText: (): string => {
      return rendered.getByTestId(TESTIDS.formFieldLabel).textContent ?? "";
    },
    isRequired: (): boolean => {
      return field().dataset.required === "true";
    },
    isReadOnly: (): boolean => {
      return field().dataset.readOnly === "true";
    },
    hasTextBoxNamed: (name: string): boolean => {
      return rendered.queryByRole("textbox", { name }) !== null;
    },
    groupText: (name: string): string | null => {
      return rendered.queryByRole("group", { name })?.textContent ?? null;
    },
    isLabelElement: (): boolean => {
      return field() instanceof HTMLLabelElement;
    },
  };
}

/**
 * The labels of the required rows in `container` whose field is not
 * announced as required: a row says `required`, and its caller must mark the
 * field it puts there with `aria-required`. Empty when every one is.
 */
export function requiredFieldsUnannounced(container: HTMLElement): string[] {
  return within(container)
    .queryAllByTestId(TESTIDS.formField)
    .filter((row) => {
      const field = row.querySelector("input, select, textarea");

      return (
        row.dataset.required === "true" &&
        field?.getAttribute("aria-required") !== "true"
      );
    })
    .map((row) => {
      const label = within(row).getByTestId(TESTIDS.formFieldLabel);

      return (label.textContent ?? "").replace(/ \*$/, "");
    });
}
