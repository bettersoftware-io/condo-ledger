import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import type { ContactView } from "@cl/domain";
import { createPersonContact } from "@cl/domain/testing/createContacts.ts";

import { ContactPicker, type ContactPickerProps } from "./ContactPicker.tsx";

/** What a test can do with, and ask of, the contact picker. */
export interface ContactPickerPage {
  boxText: () => string;
  /** Draws the picker again with these props, as its dialog does. */
  rerender: (next: Partial<ContactPickerProps>) => void;
}

export function mountContactPicker(
  props: Partial<ContactPickerProps>,
): ContactPickerPage {
  const rendered = render(<ContactPicker {...withDefaults(props)} />);

  return {
    boxText: (): string => {
      return screen.getByRole<HTMLInputElement>("textbox").value;
    },
    rerender: (next: Partial<ContactPickerProps>): void => {
      rendered.rerender(
        <ContactPicker {...withDefaults({ ...props, ...next })} />,
      );
    },
  };
}

export function createContactView(id: string, name: string): ContactView {
  return {
    contact: createPersonContact(id, name, null),
    id,
    kind: "person",
    name,
    status: "active",
    code: null,
    category: null,
    referenceAddress: null,
  };
}

function withDefaults(props: Partial<ContactPickerProps>): ContactPickerProps {
  return {
    contacts: [],
    value: null,
    fixed: false,
    onChange: vi.fn(),
    ...props,
  };
}
