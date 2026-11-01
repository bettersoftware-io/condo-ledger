import { within } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";

import { requiredFieldsUnannounced } from "./FormField.page.tsx";
import { TESTIDS } from "./testids.ts";

type User = ReturnType<typeof userEvent.setup>;

/** What a test can do with, and ask of, a form dialog: group, unit, owner, building, period or address. */
export interface FormDialogPage {
  isShown: () => boolean;
  title: () => string;
  /** The labels of the required fields not announced as required; empty when every one is. */
  requiredUnannounced: () => string[];
  /** The legends of the dialog's fieldsets, in order. */
  legends: () => string[];
  /** The text in the field named by this label (a text box, or the NOTES box named "Notes"). */
  fieldValue: (label: string) => string;
  /** Whether the field named by this label can be changed: a text box or a select. */
  isFieldDisabled: (label: string) => boolean;
  /** Clears the text box and types the text into it. */
  fill: (label: string, text: string) => Promise<void>;
  /** The choice a select shows, as drawn over it. */
  chosen: (label: string) => string;
  choose: (label: string, option: string) => Promise<void>;
  /** The text of the read-only row with this label. */
  readOnlyValue: (label: string) => string;
  /** The reason the dialog shows in red, or null when it shows none. */
  message: () => string | null;
  /** The line under the previous balance, or null when there is none. */
  balanceNote: () => string | null;
  /** The contacts the picker offers for what was typed, by name. */
  contactOptions: () => string[];
  chooseContact: (name: string) => Promise<void>;
  /** Whether the picker says that nothing matches what was typed. */
  noContactMatches: () => boolean;
  /** The picker's buttons, in the order drawn: New company, New person, Edit contact, Clear. */
  pickerTools: () => string[];
  isPickerToolDisabled: (name: string) => boolean;
  clickPickerTool: (name: string) => Promise<void>;
  /** Presses the button with this name in the dialog. */
  clickButton: (name: string) => Promise<void>;
  /** Presses Escape where the focus is. */
  pressEscape: () => Promise<void>;
  /** The name of what has the focus: a button's label, or a field's. */
  focused: () => string;
  /** The address as the group dialog shows it. */
  address: () => string;
  editAddress: () => Promise<void>;
  removeAddress: () => Promise<void>;
  isSaveDisabled: () => boolean;
  /** What the primary button says. */
  saveLabel: () => string;
  save: () => Promise<void>;
  cancel: () => Promise<void>;
  /** Presses Enter where the focus is. */
  pressEnter: () => Promise<void>;
}

/** Where a dialog is in the order the layers are drawn: the first, the one over it, the one over that. */
const LAYER_INDEX = { first: 0, stacked: 1, third: 2 } as const;

/**
 * The dialog wherever it is drawn under `root`: the first one, or with
 * `stacked` the one opened over it (the Address dialog over the dialog whose
 * address it edits), or with `third` the one over that.
 */
export function formDialogIn(
  root: () => HTMLElement,
  user: User,
  layer: keyof typeof LAYER_INDEX = "first",
): FormDialogPage {
  const index = LAYER_INDEX[layer];

  function dialogs(): HTMLElement[] {
    return within(root()).queryAllByTestId(TESTIDS.dialog);
  }

  function dialog(): HTMLElement {
    const found = dialogs()[index];

    if (found === undefined) {
      throw new Error(`missing: the ${layer} dialog`);
    }

    return found;
  }

  function textBox(label: string): HTMLInputElement | HTMLTextAreaElement {
    return within(dialog()).getByRole<HTMLInputElement | HTMLTextAreaElement>(
      "textbox",
      { name: label },
    );
  }

  function select(label: string): HTMLSelectElement {
    return within(dialog()).getByRole<HTMLSelectElement>("combobox", {
      name: label,
    });
  }

  function field(
    label: string,
  ): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
    return (
      within(dialog()).queryByRole<HTMLSelectElement>("combobox", {
        name: label,
      }) ?? textBox(label)
    );
  }

  function button(testId: string): HTMLButtonElement {
    return within(dialog()).getByTestId<HTMLButtonElement>(testId);
  }

  function optional(testId: string): string | null {
    return within(dialog()).queryByTestId(testId)?.textContent ?? null;
  }

  return {
    isShown: (): boolean => {
      return dialogs().length > index;
    },
    title: (): string => {
      return (
        within(dialog()).getByTestId(TESTIDS.dialogTitle).textContent ?? ""
      );
    },
    requiredUnannounced: (): string[] => {
      return requiredFieldsUnannounced(dialog());
    },
    legends: (): string[] => {
      return Array.from(dialog().querySelectorAll("legend")).map((legend) => {
        return legend.textContent ?? "";
      });
    },
    fieldValue: (label: string): string => {
      return textBox(label).value;
    },
    isFieldDisabled: (label: string): boolean => {
      return field(label).disabled;
    },
    fill: async (label: string, text: string): Promise<void> => {
      await user.clear(textBox(label));

      if (text !== "") {
        await user.type(textBox(label), text);
      }
    },
    chosen: (label: string): string => {
      const box = select(label).closest(".value-select");

      return box?.querySelector(".value-select-text")?.textContent ?? "";
    },
    choose: async (label: string, option: string): Promise<void> => {
      await user.selectOptions(select(label), option);
    },
    readOnlyValue: (label: string): string => {
      return (
        within(dialog())
          .getByRole("group", { name: label })
          .querySelector(".form-field-box")?.textContent ?? ""
      );
    },
    message: (): string | null => {
      return optional(TESTIDS.formDialogMessage);
    },
    balanceNote: (): string | null => {
      return optional(TESTIDS.formDialogNote);
    },
    contactOptions: (): string[] => {
      const list = within(dialog()).queryByTestId(TESTIDS.contactPickerList);

      return list === null
        ? []
        : within(list)
            .queryAllByTestId(TESTIDS.contactPickerOption)
            .map((option) => {
              return (
                option.querySelector(".contact-picker-name")?.textContent ?? ""
              );
            });
    },
    chooseContact: async (name: string): Promise<void> => {
      const option = within(dialog())
        .getAllByTestId(TESTIDS.contactPickerOption)
        .find((candidate) => {
          return (
            candidate.querySelector(".contact-picker-name")?.textContent ===
            name
          );
        });

      if (option === undefined) {
        throw new Error(`No contact ${name} offered`);
      }

      await user.click(option);
    },
    noContactMatches: (): boolean => {
      return within(dialog()).queryByText("No contact matches.") !== null;
    },
    pickerTools: (): string[] => {
      return within(
        within(dialog()).getByRole("group", { name: "Contact tools" }),
      )
        .getAllByRole("button")
        .map((tool) => {
          return tool.getAttribute("aria-label") ?? "";
        });
    },
    isPickerToolDisabled: (name: string): boolean => {
      return within(dialog()).getByRole<HTMLButtonElement>("button", { name })
        .disabled;
    },
    clickPickerTool: async (name: string): Promise<void> => {
      await user.click(within(dialog()).getByRole("button", { name }));
    },
    clickButton: async (name: string): Promise<void> => {
      await user.click(within(dialog()).getByRole("button", { name }));
    },
    pressEscape: async (): Promise<void> => {
      await user.keyboard("{Escape}");
    },
    focused: (): string => {
      const { activeElement } = document;

      return (
        activeElement?.getAttribute("aria-label") ??
        activeElement?.textContent ??
        ""
      );
    },
    address: (): string => {
      return (
        within(dialog()).getByTestId(TESTIDS.formDialogAddress).textContent ??
        ""
      );
    },
    editAddress: async (): Promise<void> => {
      await user.click(
        within(dialog()).getByRole("button", { name: "Edit the address" }),
      );
    },
    removeAddress: async (): Promise<void> => {
      await user.click(
        within(dialog()).getByRole("button", { name: "Remove the address" }),
      );
    },
    isSaveDisabled: (): boolean => {
      return button(TESTIDS.formDialogSave).disabled;
    },
    saveLabel: (): string => {
      return button(TESTIDS.formDialogSave).textContent ?? "";
    },
    save: async (): Promise<void> => {
      await user.click(button(TESTIDS.formDialogSave));
    },
    cancel: async (): Promise<void> => {
      await user.click(button(TESTIDS.formDialogCancel));
    },
    pressEnter: async (): Promise<void> => {
      await user.keyboard("{Enter}");
    },
  };
}
