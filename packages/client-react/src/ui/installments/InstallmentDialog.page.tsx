import { type RenderResult, within } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";

import { requiredFieldsUnannounced } from "../FormField.page.tsx";
import { TESTIDS } from "../testids.ts";

type User = ReturnType<typeof userEvent.setup>;

/** What a test can do with, and ask of, the Edit Installment dialog open over the schedule. */
export interface InstallmentDialogPage {
  isShown: () => boolean;
  title: () => string;
  /** The labels of the required fields not announced as required; empty when every one is. */
  requiredUnannounced: () => string[];
  /** The text in the field with this label: "Name" or "Due date". */
  fieldValue: (label: string) => string;
  /** Clears the field with this label and types the text into it. */
  fill: (label: string, text: string) => Promise<void>;
  /** Whether the field with this label can be changed: "Name", "Due date" or "Locked". */
  isEnabled: (label: string) => boolean;
  isLocked: () => boolean;
  /** Ticks or clears Locked. */
  toggleLocked: () => Promise<void>;
  /** The reason the dialog shows in red, or null when it shows none. */
  message: () => string | null;
  isSaveDisabled: () => boolean;
  /** Presses Enter where the focus is. */
  pressEnter: () => Promise<void>;
  save: () => Promise<void>;
  cancel: () => Promise<void>;
}

/** The dialog in a mounted schedule, through what the person sees and does. */
export function installmentDialogIn(
  rendered: RenderResult,
  user: User,
): InstallmentDialogPage {
  function dialog(): HTMLElement {
    return rendered.getByTestId(TESTIDS.dialog);
  }

  function control(label: string): HTMLInputElement {
    const role = label === "Locked" ? "checkbox" : "textbox";

    return within(dialog()).getByRole<HTMLInputElement>(role, { name: label });
  }

  function button(testId: string): HTMLButtonElement {
    return within(dialog()).getByTestId<HTMLButtonElement>(testId);
  }

  return {
    isShown: (): boolean => {
      return rendered.queryByTestId(TESTIDS.dialog) !== null;
    },
    title: (): string => {
      return (
        within(dialog()).getByTestId(TESTIDS.dialogTitle).textContent ?? ""
      );
    },
    requiredUnannounced: (): string[] => {
      return requiredFieldsUnannounced(dialog());
    },
    fieldValue: (label: string): string => {
      return control(label).value;
    },
    fill: async (label: string, text: string): Promise<void> => {
      await user.clear(control(label));

      if (text !== "") {
        await user.type(control(label), text);
      }
    },
    isEnabled: (label: string): boolean => {
      return !control(label).disabled;
    },
    isLocked: (): boolean => {
      return control("Locked").checked;
    },
    toggleLocked: async (): Promise<void> => {
      await user.click(control("Locked"));
    },
    message: (): string | null => {
      return (
        within(dialog()).queryByTestId(TESTIDS.installmentDialogMessage)
          ?.textContent ?? null
      );
    },
    isSaveDisabled: (): boolean => {
      return button(TESTIDS.installmentDialogSave).disabled;
    },
    pressEnter: async (): Promise<void> => {
      await user.keyboard("{Enter}");
    },
    save: async (): Promise<void> => {
      await user.click(button(TESTIDS.installmentDialogSave));
    },
    cancel: async (): Promise<void> => {
      await user.click(button(TESTIDS.installmentDialogCancel));
    },
  };
}
