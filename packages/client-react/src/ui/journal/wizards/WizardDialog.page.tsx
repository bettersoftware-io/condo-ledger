import { type RenderResult, within } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";

import { TESTIDS } from "#/ui/testids.ts";

type User = ReturnType<typeof userEvent.setup>;

/** A lines grid's typed columns. */
type LineColumn = "amount" | "debit" | "credit";

/** What a test can do with, and ask of, the wizard open over the Journal screen. */
export interface WizardDialogPage {
  title: () => string;
  /** The first row: "Building / Period: {building} / {period}". */
  contextLine: () => string;
  /** Clears the form field with this label and types the text into it. */
  fill: (label: string, text: string) => Promise<void>;
  fieldValue: (label: string) => string;
  /** Chooses the selectable list's row with this label. */
  pick: (label: string) => Promise<void>;
  /** Chooses the option with this label in a line's account cell, counted from 0. */
  select: (lineIndex: number, optionLabel: string) => Promise<void>;
  fillLine: (
    lineIndex: number,
    column: LineColumn,
    text: string,
  ) => Promise<void>;
  addLine: () => Promise<void>;
  removeLine: () => Promise<void>;
  /** The "Entry postings" grid's rows, each as its cells' texts. */
  previewRows: () => string[][];
  /** The reason the wizard shows in red, or null when it shows none. */
  message: () => string | null;
  /** The "Paid from" line, or what it says in its place. */
  paidFrom: () => string;
  /** The multi-cost lines grid's footer total. */
  linesTotal: () => string;
  /** The generic lines grid's Balance column. */
  lineBalances: () => string[];
  /** The generic lines grid's footer: Debit, Credit, Balance. */
  totals: () => string[];
  isSaveDisabled: () => boolean;
  save: () => Promise<void>;
  cancel: () => Promise<void>;
  pressEscape: () => Promise<void>;
}

/** The wizard open in a mounted Journal screen, through what the person sees and does. */
export function wizardDialogPage(
  rendered: RenderResult,
  user: User,
): WizardDialogPage {
  function dialog(): HTMLElement {
    return rendered.getByTestId(TESTIDS.dialog);
  }

  function fieldLabel(field: HTMLElement): string {
    const label = within(field).getByTestId(TESTIDS.formFieldLabel);

    return (label.textContent ?? "").replace(/ \*$/, "");
  }

  function field(label: string): HTMLElement {
    const found = within(dialog())
      .getAllByTestId(TESTIDS.formField)
      .find((candidate) => {
        return fieldLabel(candidate) === label;
      });

    if (found === undefined) {
      throw new Error(`No field labelled ${label}`);
    }

    return found;
  }

  function input(label: string): HTMLInputElement {
    const found = field(label).querySelector("input");

    if (found === null) {
      throw new Error(`The field ${label} has no input`);
    }

    return found;
  }

  function lineBox(name: string): HTMLElement {
    return within(dialog()).getByRole("textbox", { name });
  }

  async function retype(box: HTMLElement, text: string): Promise<void> {
    await user.clear(box);

    if (text !== "") {
      await user.type(box, text);
    }
  }

  function textsOf(elements: HTMLElement[]): string[] {
    return elements.map((element) => {
      return element.textContent ?? "";
    });
  }

  function button(testId: string): HTMLButtonElement {
    return within(dialog()).getByTestId<HTMLButtonElement>(testId);
  }

  return {
    title: (): string => {
      return (
        within(dialog()).getByTestId(TESTIDS.dialogTitle).textContent ?? ""
      );
    },
    contextLine: (): string => {
      const [first] = within(dialog()).getAllByTestId(TESTIDS.formField);

      if (first === undefined) {
        throw new Error("missing: the wizard's first row");
      }

      const box = first.querySelector(".form-field-box")?.textContent ?? "";

      return `${fieldLabel(first)}: ${box}`;
    },
    fill: async (label: string, text: string): Promise<void> => {
      await retype(input(label), text);
    },
    fieldValue: (label: string): string => {
      return input(label).value;
    },
    pick: async (label: string): Promise<void> => {
      await user.click(within(dialog()).getByRole("radio", { name: label }));
    },
    select: async (lineIndex: number, optionLabel: string): Promise<void> => {
      const cell = within(dialog()).getByRole<HTMLSelectElement>("combobox", {
        name: `Line ${lineIndex + 1} account`,
      });

      const option = Array.from(cell.options).find((candidate) => {
        return candidate.textContent === optionLabel;
      });

      if (option === undefined) {
        throw new Error(`No option labelled ${optionLabel}`);
      }

      await user.selectOptions(cell, option);
    },
    fillLine: async (
      lineIndex: number,
      column: LineColumn,
      text: string,
    ): Promise<void> => {
      await retype(lineBox(`Line ${lineIndex + 1} ${column}`), text);
    },
    addLine: async (): Promise<void> => {
      await user.click(button(TESTIDS.wizardAddLine));
    },
    removeLine: async (): Promise<void> => {
      await user.click(button(TESTIDS.wizardRemoveLine));
    },
    previewRows: (): string[][] => {
      return within(dialog())
        .queryAllByTestId(TESTIDS.wizardPreviewRow)
        .map((row) => {
          return textsOf(Array.from(row.children) as HTMLElement[]);
        });
    },
    message: (): string | null => {
      return (
        within(dialog()).queryByTestId(TESTIDS.wizardMessage)?.textContent ??
        null
      );
    },
    paidFrom: (): string => {
      return (
        within(dialog()).getByTestId(TESTIDS.wizardPaidFrom).textContent ?? ""
      );
    },
    linesTotal: (): string => {
      return (
        within(dialog()).getByTestId(TESTIDS.wizardLinesTotal).textContent ?? ""
      );
    },
    lineBalances: (): string[] => {
      return textsOf(
        within(dialog()).queryAllByTestId(TESTIDS.wizardLineBalance),
      );
    },
    totals: (): string[] => {
      return textsOf(
        within(
          within(dialog()).getByTestId(TESTIDS.wizardTotals),
        ).getAllByTestId(TESTIDS.money),
      );
    },
    isSaveDisabled: (): boolean => {
      return button(TESTIDS.wizardSave).disabled;
    },
    save: async (): Promise<void> => {
      await user.click(button(TESTIDS.wizardSave));
    },
    cancel: async (): Promise<void> => {
      await user.click(button(TESTIDS.wizardCancel));
    },
    pressEscape: async (): Promise<void> => {
      await user.keyboard("{Escape}");
    },
  };
}
