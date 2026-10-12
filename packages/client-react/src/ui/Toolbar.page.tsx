import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { Toolbar } from "./Toolbar.tsx";
import { TESTIDS } from "./testids.ts";

/** What a test can do with, and ask of, a toolbar. */
export interface ToolbarPage {
  click: (label: string) => Promise<void>;
  type: (text: string) => Promise<void>;
  toggle: (label: string) => Promise<void>;
  buttonText: (label: string) => string;
  buttonTone: (label: string) => string;
  isDisabled: (label: string) => boolean;
  searchValue: () => string;
  isChecked: (label: string) => boolean;
}

export function mountToolbar(children: ReactNode): ToolbarPage {
  const user = userEvent.setup();
  const rendered = render(<Toolbar>{children}</Toolbar>);

  function button(label: string): HTMLElement {
    return rendered.getByRole("button", { name: label });
  }

  function search(): HTMLInputElement {
    return rendered.getByTestId(TESTIDS.toolbarSearch) as HTMLInputElement;
  }

  function checkbox(label: string): HTMLInputElement {
    return rendered.getByLabelText(label) as HTMLInputElement;
  }

  return {
    click: async (label: string): Promise<void> => {
      await user.click(button(label));
    },
    type: async (text: string): Promise<void> => {
      await user.type(search(), text);
    },
    toggle: async (label: string): Promise<void> => {
      await user.click(checkbox(label));
    },
    buttonText: (label: string): string => {
      return button(label).textContent ?? "";
    },
    buttonTone: (label: string): string => {
      return button(label).dataset.tone ?? "";
    },
    isDisabled: (label: string): boolean => {
      return (button(label) as HTMLButtonElement).disabled;
    },
    searchValue: (): string => {
      return search().value;
    },
    isChecked: (label: string): boolean => {
      return checkbox(label).checked;
    },
  };
}
