import { act, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import { createViewModel, ViewModelProvider } from "@cl/react-bindings";

import { requiredFieldsUnannounced } from "../FormField.page.tsx";
import { TESTIDS } from "../testids.ts";
import { TableDialog } from "./TableDialog.tsx";

type User = ReturnType<typeof userEvent.setup>;

/** A field of the dialog, by its name. */
type TableField = "Name" | "Order" | "Notes";

/** What a test can do with, and ask of, the New or Edit Thousandth Table dialog. */
export interface TableDialogPage {
  isShown: () => boolean;
  title: () => string;
  /** The labels of the required fields not announced as required; empty when every one is. */
  requiredUnannounced: () => string[];
  fieldValue: (field: TableField) => string;
  /** Clears the field and types the text into it. */
  fill: (field: TableField, text: string) => Promise<void>;
  /** The reason the dialog shows in red, or null when it shows none. */
  message: () => string | null;
  isSaveDisabled: () => boolean;
  /** What the primary button says. */
  saveLabel: () => string;
  save: () => Promise<void>;
  cancel: () => Promise<void>;
  /** Presses Enter where the focus is. */
  pressEnter: () => Promise<void>;
}

/** The dialog mounted alone, and what its parent was told. */
export interface MountedTableDialog {
  dialog: TableDialogPage;
  /** The ids the dialog handed over as saved, in order. */
  saved: () => string[];
  /** How many times the dialog asked to close without saving. */
  cancels: () => number;
  /** Adds a table to the period behind the open dialog's back, as another reader would. */
  addTableElsewhere: (name: string) => Promise<void>;
}

/** Mounts the dialog alone over the real seed on p1 (Saturno 2011): new, or editing the table given. */
export function mountTableDialog(editing: string | null): MountedTableDialog {
  const user = userEvent.setup();
  const { app } = createAppHarness();
  const saved: string[] = [];
  let cancels = 0;

  app.presenters.buildings.selectPeriod("p1");

  function recordSaved(tableId: string): void {
    saved.push(tableId);
  }

  function recordCancel(): void {
    cancels += 1;
  }

  const rendered = render(
    <ViewModelProvider viewModel={createViewModel(app)}>
      <TableDialog
        editing={editing}
        onSaved={recordSaved}
        onCancel={recordCancel}
      />
    </ViewModelProvider>,
  );

  return {
    dialog: tableDialogIn(() => {
      return rendered.container;
    }, user),
    saved: (): string[] => {
      return saved;
    },
    cancels: (): number => {
      return cancels;
    },
    addTableElsewhere: async (name: string): Promise<void> => {
      await act(async () => {
        await app.presenters.allocation.addTable({ name, order: 9, notes: "" });
      });
    },
  };
}

/** The dialog wherever it is drawn under `root`: alone, or over the screen. */
export function tableDialogIn(
  root: () => HTMLElement,
  user: User,
): TableDialogPage {
  function dialog(): HTMLElement {
    return within(root()).getByTestId(TESTIDS.dialog);
  }

  function field(name: TableField): HTMLInputElement | HTMLTextAreaElement {
    return within(dialog()).getByRole<HTMLInputElement | HTMLTextAreaElement>(
      "textbox",
      { name },
    );
  }

  function button(testId: string): HTMLButtonElement {
    return within(dialog()).getByTestId<HTMLButtonElement>(testId);
  }

  return {
    isShown: (): boolean => {
      return within(root()).queryByTestId(TESTIDS.dialog) !== null;
    },
    title: (): string => {
      return (
        within(dialog()).getByTestId(TESTIDS.dialogTitle).textContent ?? ""
      );
    },
    requiredUnannounced: (): string[] => {
      return requiredFieldsUnannounced(dialog());
    },
    fieldValue: (name: TableField): string => {
      return field(name).value;
    },
    fill: async (name: TableField, text: string): Promise<void> => {
      await user.clear(field(name));

      if (text !== "") {
        await user.type(field(name), text);
      }
    },
    message: (): string | null => {
      return (
        within(dialog()).queryByTestId(TESTIDS.tableDialogMessage)
          ?.textContent ?? null
      );
    },
    isSaveDisabled: (): boolean => {
      return button(TESTIDS.tableDialogSave).disabled;
    },
    saveLabel: (): string => {
      return button(TESTIDS.tableDialogSave).textContent ?? "";
    },
    save: async (): Promise<void> => {
      await user.click(button(TESTIDS.tableDialogSave));
    },
    cancel: async (): Promise<void> => {
      await user.click(button(TESTIDS.tableDialogCancel));
    },
    pressEnter: async (): Promise<void> => {
      await user.keyboard("{Enter}");
    },
  };
}
