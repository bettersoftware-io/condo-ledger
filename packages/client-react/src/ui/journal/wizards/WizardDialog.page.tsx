import { type RenderResult, within } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";

import { TESTIDS } from "#/ui/testids.ts";

import { settlementTableIn } from "./SettlementTable.page.tsx";

type User = ReturnType<typeof userEvent.setup>;

/** A lines grid's typed columns. */
type LineColumn = "amount" | "debit" | "credit";

/** A side of an opening row. */
type OpeningSide = "debit" | "credit";

/** What a test can do with, and ask of, the wizard open over the Journal screen. */
export interface WizardDialogPage {
  title: () => string;
  /** The first row: "Building / Period: {building} / {period}". */
  contextLine: () => string;
  /** Clears the form field with this label and types the text into it. */
  fill: (label: string, text: string) => Promise<void>;
  fieldValue: (label: string) => string;
  /** The selectable list's rows, as the person reads them. */
  choices: () => string[];
  /** Chooses the selectable list's row with this label. */
  pick: (label: string) => Promise<void>;
  /** Chooses the option with this label in a line's account cell, counted from 0. */
  select: (lineIndex: number, optionLabel: string) => Promise<void>;
  /** What each line's account cell shows, in order. */
  shownAccounts: () => string[];
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
  isNextDisabled: () => boolean;
  next: () => Promise<void>;
  /** Whether the footer offers ◀ Back. */
  hasBack: () => boolean;
  back: () => Promise<void>;
  /** Chooses the option with this label in the select with this name. */
  choose: (selectName: string, optionLabel: string) => Promise<void>;
  /** Ticks or clears the checkbox with this name. */
  check: (name: string) => Promise<void>;
  isChecked: (name: string) => boolean;
  /** Whether a wizard is drawn at all. */
  isShown: () => boolean;
  /** Whether the select with this name is shown but cannot be changed. */
  isLocked: (selectName: string) => boolean;
  /** The note under the supplier; null when there is none. */
  supplierNote: () => string | null;
  /** The warning under the invoice number; null when there is none. */
  duplicateWarning: () => string | null;
  /** The invoice's computed rows, each as its label and its amount. */
  calcRows: () => string[][];
  /** The open invoices grid's rows, each as its cells' texts. */
  openInvoices: () => string[][];
  /** The numbers of the open invoices whose due date is past. */
  overdueInvoices: () => string[];
  /** What the open invoices grid says when it has no row; null when it has rows. */
  emptyText: () => string | null;
  trancheNote: () => string | null;
  /** The owners grid's rows, each as its cells' texts: Name, Units, Total inst., Paid, Inst. balance. */
  owners: () => string[][];
  /** Chooses the owners grid's row, counted from 0. */
  pickOwner: (index: number) => Promise<void>;
  /** What the owners grid says when it has no row; null when it has rows. */
  ownersEmptyText: () => string | null;
  /** The hint under the amount collected; null when there is none. */
  collectionHint: () => string | null;
  /** The settlement table's rows, each as its cells' texts. */
  settlement: () => string[][];
  /** The settlement rows marked "partial", counted from 0. */
  partialRows: () => number[];
  /** The opening list's rows on screen, each as its label, its Debit and its Credit. */
  openingRows: () => string[][];
  /** Clears a side of the opening row with this label and types the text into it. */
  fillOpening: (
    label: string,
    side: OpeningSide,
    text: string,
  ) => Promise<void>;
  /** Puts the focus on a side of the opening row with this label. */
  focusOpening: (label: string, side: OpeningSide) => Promise<void>;
  /** Types into the opening list's search box. */
  searchOpening: (text: string) => Promise<void>;
  /** The "Transaction balance" amount above the opening list. */
  openingBalance: () => string;
  /** Whether the "Transaction balance" is drawn in the negative tone. */
  isBalanceNegative: () => boolean;
  /** The name of the field that has the keyboard's focus; null when the focus is outside the dialog's fields. */
  focusedLabel: () => string | null;
  /** Presses Enter where the focus is. */
  pressEnter: () => Promise<void>;
  /** Presses Tab where the focus is. */
  pressTab: () => Promise<void>;
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

  /** The form field's input; a computed row's rate is found by its own label. */
  function input(label: string): HTMLInputElement {
    const row = within(dialog())
      .getAllByTestId(TESTIDS.formField)
      .some((candidate) => {
        return fieldLabel(candidate) === label;
      });

    const found = row
      ? field(label).querySelector("input")
      : within(dialog()).getByRole<HTMLInputElement>("textbox", {
          name: label,
        });

    if (found === null) {
      throw new Error(`The field ${label} has no input`);
    }

    return found;
  }

  function combobox(name: string): HTMLSelectElement {
    return within(dialog()).getByRole<HTMLSelectElement>("combobox", { name });
  }

  function textOf(testId: string): string | null {
    return within(dialog()).queryByTestId(testId)?.textContent ?? null;
  }

  function invoiceRows(): HTMLElement[] {
    return within(dialog()).queryAllByTestId(TESTIDS.openInvoiceRow);
  }

  function cellsOf(row: HTMLElement): HTMLElement[] {
    return Array.from(row.querySelectorAll<HTMLElement>(".open-invoices-cell"));
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

  async function chooseIn(
    select: HTMLSelectElement,
    optionLabel: string,
  ): Promise<void> {
    const option = Array.from(select.options).find((candidate) => {
      return candidate.textContent === optionLabel;
    });

    if (option === undefined) {
      throw new Error(`No option labelled ${optionLabel}`);
    }

    await user.selectOptions(select, option);
  }

  function ownerRows(): HTMLElement[] {
    return within(dialog()).queryAllByTestId(TESTIDS.ownerRow);
  }

  function openingBox(label: string, side: OpeningSide): HTMLInputElement {
    return within(dialog()).getByRole<HTMLInputElement>("textbox", {
      name: `${label} ${side}`,
    });
  }

  function balance(): HTMLElement {
    return within(dialog()).getByTestId(TESTIDS.openingBalance);
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
    choices: (): string[] => {
      return textsOf(within(dialog()).queryAllByTestId(TESTIDS.selectableItem));
    },
    pick: async (label: string): Promise<void> => {
      await user.click(within(dialog()).getByRole("radio", { name: label }));
    },
    select: async (lineIndex: number, optionLabel: string): Promise<void> => {
      await chooseIn(combobox(`Line ${lineIndex + 1} account`), optionLabel);
    },
    shownAccounts: (): string[] => {
      return textsOf(
        within(dialog()).queryAllByTestId(TESTIDS.wizardSelectText),
      );
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
    isNextDisabled: (): boolean => {
      return button(TESTIDS.wizardNext).disabled;
    },
    next: async (): Promise<void> => {
      await user.click(button(TESTIDS.wizardNext));
    },
    hasBack: (): boolean => {
      return within(dialog()).queryByTestId(TESTIDS.wizardBack) !== null;
    },
    back: async (): Promise<void> => {
      await user.click(button(TESTIDS.wizardBack));
    },
    choose: async (selectName: string, optionLabel: string): Promise<void> => {
      await chooseIn(combobox(selectName), optionLabel);
    },
    check: async (name: string): Promise<void> => {
      await user.click(within(dialog()).getByRole("checkbox", { name }));
    },
    isChecked: (name: string): boolean => {
      return within(dialog()).getByRole<HTMLInputElement>("checkbox", { name })
        .checked;
    },
    isShown: (): boolean => {
      return rendered.queryByTestId(TESTIDS.dialog) !== null;
    },
    isLocked: (selectName: string): boolean => {
      return combobox(selectName).disabled;
    },
    supplierNote: (): string | null => {
      return textOf(TESTIDS.supplierSelectNote);
    },
    duplicateWarning: (): string | null => {
      return textOf(TESTIDS.invoiceDuplicate);
    },
    calcRows: (): string[][] => {
      return within(dialog())
        .queryAllByTestId(TESTIDS.invoiceCalcRow)
        .map((row) => {
          return [
            row.querySelector(".invoice-calc-label")?.textContent ?? "",
            row.querySelector(".invoice-calc-amount")?.textContent ?? "",
          ];
        });
    },
    openInvoices: (): string[][] => {
      return invoiceRows().map((row) => {
        return textsOf(cellsOf(row));
      });
    },
    overdueInvoices: (): string[] => {
      return invoiceRows()
        .filter((row) => {
          return row.querySelector('[data-overdue="true"]') !== null;
        })
        .map((row) => {
          return cellsOf(row)[0]?.textContent ?? "";
        });
    },
    emptyText: (): string | null => {
      return textOf(TESTIDS.openInvoicesEmpty);
    },
    trancheNote: (): string | null => {
      return textOf(TESTIDS.wizardTrancheNote);
    },
    owners: (): string[][] => {
      return ownerRows().map((row) => {
        return textsOf(
          Array.from(row.querySelectorAll<HTMLElement>(".owners-cell")),
        );
      });
    },
    pickOwner: async (index: number): Promise<void> => {
      const row = ownerRows()[index];

      if (row === undefined) {
        throw new Error(`No owner row ${index}`);
      }

      await user.click(within(row).getByRole("radio"));
    },
    ownersEmptyText: (): string | null => {
      return textOf(TESTIDS.ownersEmpty);
    },
    collectionHint: (): string | null => {
      return textOf(TESTIDS.collectionHint);
    },
    settlement: (): string[][] => {
      return settlementTableIn(dialog()).rows();
    },
    partialRows: (): number[] => {
      return settlementTableIn(dialog()).partialRows();
    },
    openingRows: (): string[][] => {
      return within(dialog())
        .queryAllByTestId(TESTIDS.openingRow)
        .map((row) => {
          const [debit, credit] = Array.from(row.querySelectorAll("input"));

          return [
            row.querySelector(".opening-label")?.textContent ?? "",
            debit?.value ?? "",
            credit?.value ?? "",
          ];
        });
    },
    fillOpening: async (
      label: string,
      side: OpeningSide,
      text: string,
    ): Promise<void> => {
      await retype(openingBox(label, side), text);
    },
    focusOpening: async (label: string, side: OpeningSide): Promise<void> => {
      await user.click(openingBox(label, side));
    },
    searchOpening: async (text: string): Promise<void> => {
      await retype(
        within(dialog()).getByRole("searchbox", { name: "Search accounts" }),
        text,
      );
    },
    openingBalance: (): string => {
      return (
        balance().querySelector(".opening-balance-amount")?.textContent ?? ""
      );
    },
    isBalanceNegative: (): boolean => {
      return balance().getAttribute("data-tone") === "neg";
    },
    focusedLabel: (): string | null => {
      const active = document.activeElement;

      if (!(active instanceof HTMLElement) || !dialog().contains(active)) {
        return null;
      }

      const named = active.getAttribute("aria-label");
      const row = active.closest<HTMLElement>(
        `[data-testid="${TESTIDS.formField}"]`,
      );

      if (named !== null) {
        return named;
      }

      return row === null ? null : fieldLabel(row);
    },
    pressEnter: async (): Promise<void> => {
      await user.keyboard("{Enter}");
    },
    pressTab: async (): Promise<void> => {
      await user.tab();
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
