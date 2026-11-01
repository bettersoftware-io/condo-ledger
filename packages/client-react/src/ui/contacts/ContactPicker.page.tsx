import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import type { ContactView } from "@cl/domain";
import { createPersonContact } from "@cl/domain/testing/createContacts.ts";

import { TESTIDS } from "../testids.ts";
import { ContactPicker, type ContactPickerProps } from "./ContactPicker.tsx";

/** What a test can do with, and ask of, the contact picker. */
export interface ContactPickerPage {
  boxText: () => string;
  /** The box's accessible name. */
  boxLabel: () => string;
  /** Types in the box, as the person does. */
  type: (text: string) => Promise<void>;
  /** The names the picker offers under the box. */
  offered: () => string[];
  /** The buttons drawn beside the field, in order; none when it does not create. */
  tools: () => string[];
  isToolDisabled: (name: string) => boolean;
  clickTool: (name: string) => Promise<void>;
  /** Draws the picker again with these props, as its dialog does. */
  rerender: (next: Partial<ContactPickerProps>) => void;
}

export function mountContactPicker(
  props: Partial<ContactPickerProps>,
): ContactPickerPage {
  const user = userEvent.setup();
  const rendered = render(<ContactPicker {...withDefaults(props)} />);

  return {
    boxText: (): string => {
      return screen.getByRole<HTMLInputElement>("textbox").value;
    },
    boxLabel: (): string => {
      return screen.getByRole("textbox").getAttribute("aria-label") ?? "";
    },
    type: async (text: string): Promise<void> => {
      await user.type(screen.getByRole("textbox"), text);
    },
    offered: (): string[] => {
      return screen
        .queryAllByTestId(TESTIDS.contactPickerOption)
        .map((option) => {
          return (
            option.querySelector(".contact-picker-name")?.textContent ?? ""
          );
        });
    },
    tools: (): string[] => {
      return screen
        .queryAllByRole("button")
        .filter((button) => {
          return button.closest(".contact-picker-tools") !== null;
        })
        .map((button) => {
          return button.getAttribute("aria-label") ?? "";
        });
    },
    isToolDisabled: (name: string): boolean => {
      return screen.getByRole<HTMLButtonElement>("button", { name }).disabled;
    },
    clickTool: async (name: string): Promise<void> => {
      await user.click(screen.getByRole("button", { name }));
    },
    rerender: (next: Partial<ContactPickerProps>): void => {
      rendered.rerender(
        <ContactPicker {...withDefaults({ ...props, ...next })} />,
      );
    },
  };
}

export function createContactView(
  id: string,
  name: string,
  status: ContactView["status"] = "active",
): ContactView {
  return {
    contact: createPersonContact(id, name, null),
    id,
    kind: "person",
    name,
    status,
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
    creating: false,
    onChange: vi.fn(),
    ...props,
  };
}
