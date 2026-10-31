import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import type { Contact } from "@cl/domain";

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

export function createContact(id: string, name: string): Contact {
  return {
    id,
    kind: "person",
    name,
    status: "active",
    code: null,
    category: null,
    companyName: null,
    registeredOffice: null,
    taxDomicile: null,
    phone: null,
    email: null,
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
