import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { DateField, type DateFieldProps } from "./DateField.tsx";
import { requiredFieldsUnannounced } from "./FormField.page.tsx";
import { TESTIDS } from "./testids.ts";

/** What a test can do with, and ask of, a date field. */
export interface DateFieldPage {
  /** The text in the box. */
  text: () => string;
  /** The parsed date drawn beside the text, or null when none is. */
  parsedText: () => string | null;
  /** The accessible description of the box, or null when it has none. */
  description: () => string | null;
  isRequired: () => boolean;
  /** Whether assistive technology hears the field as required. */
  isAnnouncedRequired: () => boolean;
  isDisabled: () => boolean;
  type: (text: string) => Promise<void>;
}

export function mountDateField(props: Partial<DateFieldProps>): DateFieldPage {
  const user = userEvent.setup();
  const rendered = render(
    <DateField
      label="Date"
      value=""
      parsed={null}
      onChange={vi.fn()}
      {...props}
    />,
  );

  function box(): HTMLInputElement {
    return rendered.getByRole("textbox", { name: "Date" }) as HTMLInputElement;
  }

  return {
    text: (): string => {
      return box().value;
    },
    parsedText: (): string | null => {
      const parsed = rendered.queryByTestId(TESTIDS.dateFieldParsed);

      return parsed === null ? null : (parsed.textContent ?? "");
    },
    description: (): string | null => {
      const id = box().getAttribute("aria-describedby");

      return id === null
        ? null
        : (document.getElementById(id)?.textContent ?? null);
    },
    isAnnouncedRequired: (): boolean => {
      return requiredFieldsUnannounced(rendered.container).length === 0;
    },
    isRequired: (): boolean => {
      return (
        rendered.getByTestId(TESTIDS.formField).dataset.required === "true"
      );
    },
    isDisabled: (): boolean => {
      return box().disabled;
    },
    type: async (text: string): Promise<void> => {
      await user.type(box(), text);
    },
  };
}
