import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import { must } from "@cl/domain/support/must.ts";
import { createViewModel, ViewModelProvider } from "@cl/react-bindings";

import { type FormDialogPage, formDialogIn } from "../FormDialog.page.tsx";
import { TESTIDS } from "../testids.ts";
import { ContactDialog } from "./ContactDialog.tsx";

type User = ReturnType<typeof userEvent.setup>;

/** What a test can ask of, and do in, the first dialog when it is the person or company dialog. */
export interface ContactFormPage {
  /** The date the Birth date was read as, drawn beside it; null when none is. */
  birthDateRead: () => string | null;
  /** Whether the dialog has a field (a text box, a select or an address) by this label. */
  hasField: (label: string) => boolean;
  /** The gender chosen in the radio group: Male, Female or Unspecified. */
  gender: () => string;
  chooseGender: (name: string) => Promise<void>;
  /** The CONTACTS fieldset's rows as the form lists them: label, then value. */
  rows: () => string[][];
  addRow: () => Promise<void>;
  editRow: (index: number) => Promise<void>;
  removeRow: (index: number) => Promise<void>;
  /** The address as text; `---` for none. */
  address: (label: string) => string;
  editAddress: (label: string) => Promise<void>;
  removeAddress: (label: string) => Promise<void>;
}

/** The person or company dialog wherever it is drawn under `root`: the first dialog. */
export function contactFormIn(
  root: () => HTMLElement,
  user: User,
): ContactFormPage {
  function dialog(): HTMLElement {
    const found = within(root()).queryAllByTestId(TESTIDS.dialog)[0];

    if (found === undefined) {
      throw new Error("missing: the first dialog");
    }

    return found;
  }

  function addressGroup(label: string): HTMLElement {
    return within(dialog()).getByRole("group", { name: label });
  }

  function rowElements(): HTMLElement[] {
    return within(dialog()).queryAllByTestId(TESTIDS.contactFormRow);
  }

  function rowAt(index: number): HTMLElement {
    const row = rowElements()[index];

    if (row === undefined) {
      throw new Error(`missing: row ${index}`);
    }

    return row;
  }

  return {
    birthDateRead: (): string | null => {
      return (
        within(dialog()).queryByTestId(TESTIDS.dateFieldParsed)?.textContent ??
        null
      );
    },
    hasField: (label: string): boolean => {
      return (
        within(dialog()).queryByRole("textbox", { name: label }) !== null ||
        within(dialog()).queryByRole("combobox", { name: label }) !== null ||
        within(dialog()).queryByRole("group", { name: label }) !== null ||
        within(dialog()).queryByRole("radiogroup", { name: label }) !== null
      );
    },
    gender: (): string => {
      const group = within(dialog()).getByRole("radiogroup", {
        name: "Gender",
      });

      return (
        within(group)
          .getAllByRole<HTMLInputElement>("radio")
          .find((radio) => {
            return radio.checked;
          })
          ?.closest("label")?.textContent ?? ""
      );
    },
    chooseGender: async (name: string): Promise<void> => {
      const group = within(dialog()).getByRole("radiogroup", {
        name: "Gender",
      });

      await user.click(within(group).getByRole("radio", { name }));
    },
    rows: (): string[][] => {
      return rowElements().map((row) => {
        return [
          row.querySelector(".form-field-label")?.textContent ?? "",
          within(row).getByTestId(TESTIDS.contactFormRowValue).textContent ??
            "",
        ];
      });
    },
    addRow: async (): Promise<void> => {
      await user.click(
        within(dialog()).getByRole("button", { name: "Add contact row" }),
      );
    },
    editRow: async (index: number): Promise<void> => {
      await user.click(
        within(rowAt(index)).getByRole("button", { name: /^Edit/ }),
      );
    },
    removeRow: async (index: number): Promise<void> => {
      await user.click(
        within(rowAt(index)).getByRole("button", { name: /^Remove/ }),
      );
    },
    address: (label: string): string => {
      return (
        within(addressGroup(label)).getByTestId(TESTIDS.formDialogAddress)
          .textContent ?? ""
      );
    },
    editAddress: async (label: string): Promise<void> => {
      await user.click(
        within(addressGroup(label)).getByRole("button", { name: /^Edit/ }),
      );
    },
    removeAddress: async (label: string): Promise<void> => {
      await user.click(
        within(addressGroup(label)).getByRole("button", { name: /^Remove/ }),
      );
    },
  };
}

/** Mounts the person or company dialog on its own, over the real seed, with no Contacts screen under it. */
export function mountContactDialogAlone(contactId: string): ContactDialogAlone {
  const user = userEvent.setup();
  const harness = createAppHarness();
  const editing = must(
    harness.seed.contacts.find((contact) => {
      return contact.id === contactId;
    }),
    `the contact ${contactId}`,
  );

  const rendered = render(
    <ViewModelProvider viewModel={createViewModel(harness.app)}>
      <ContactDialog
        spec={{ kind: editing.kind, editing }}
        onAdded={ignore}
        onSaved={ignore}
        onCancel={ignore}
      />
    </ViewModelProvider>,
  );

  return {
    dialog: formDialogIn(() => {
      return rendered.container;
    }, user),
    categoryNameOf: (id: string): string => {
      return must(
        harness.seed.contactCategories.find((category) => {
          return category.id === id;
        }),
        `the category ${id}`,
      ).name;
    },
    categoryIdOf: (): string | null => {
      return editing.categoryId;
    },
  };
}

/** What a test can do with, and ask of, the dialog mounted alone. */
export interface ContactDialogAlone {
  dialog: FormDialogPage;
  categoryNameOf: (id: string) => string;
  /** The category the contact opened on has; null for none. */
  categoryIdOf: () => string | null;
}

function ignore(): void {
  // Nothing under test looks at an id or a close here.
}
