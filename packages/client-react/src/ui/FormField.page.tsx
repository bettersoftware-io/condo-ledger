import { render } from "@testing-library/react";

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
  };
}
