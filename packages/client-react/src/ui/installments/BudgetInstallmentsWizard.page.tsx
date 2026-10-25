import { type RenderResult, within } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";

import {
  type WizardDialogPage,
  wizardDialogPage,
} from "../journal/wizards/WizardDialog.page.tsx";
import { TESTIDS } from "../testids.ts";

type User = ReturnType<typeof userEvent.setup>;

/** What a test can do with, and ask of, the Create Budget Installments wizard open over the schedule. */
export interface BudgetInstallmentsWizardPage
  extends Pick<
    WizardDialogPage,
    | "title"
    | "fill"
    | "fieldValue"
    | "check"
    | "isChecked"
    | "message"
    | "isNextDisabled"
    | "isSaveDisabled"
    | "next"
    | "back"
    | "save"
    | "cancel"
    | "isShown"
  > {
  /** The date the first due date was read as, beside the text; null when nothing is shown there. */
  dateRead: () => string | null;
  /** Step 2's rows, each as its name, its due date and its percentage. */
  rows: () => string[][];
  /** Clears the name of the step 2 row, counted from 0, and types the text. */
  fillName: (index: number, text: string) => Promise<void>;
  /** Clears the percentage of the step 2 row, counted from 0, and types the text. */
  fillPercentage: (index: number, text: string) => Promise<void>;
  /** Step 3's column headers. */
  reviewHeaders: () => string[];
  /** The resident's review row after its label: Total budget, Prev. bal., Total due, each new installment, Total inst. */
  reviewRow: (residentId: string) => string[];
  /** The residents step 3 reviews, in order. */
  reviewResidents: () => string[];
  /** What the new items add up to, under the review. */
  reviewTotal: () => string;
  /** Whether the dialog shows an "Entry postings" section. */
  postingsShown: () => boolean;
  /** What the last step's primary button says. */
  saveLabel: () => string;
}

/** The wizard in a mounted schedule, through what the person sees and does. */
export function budgetInstallmentsWizardIn(
  rendered: RenderResult,
  user: User,
): BudgetInstallmentsWizardPage {
  const wizard = wizardDialogPage(rendered, user);

  function dialog(): HTMLElement {
    return rendered.getByTestId(TESTIDS.dialog);
  }

  function box(name: string): HTMLInputElement {
    return within(dialog()).getByRole<HTMLInputElement>("textbox", { name });
  }

  async function retype(input: HTMLInputElement, text: string): Promise<void> {
    await user.clear(input);

    if (text !== "") {
      await user.type(input, text);
    }
  }

  function reviewRowOf(residentId: string): HTMLElement {
    const row = within(dialog())
      .queryAllByTestId(TESTIDS.budgetReviewRow)
      .find((candidate) => {
        return candidate.getAttribute("data-resident-id") === residentId;
      });

    if (row === undefined) {
      throw new Error(`No review row for the resident ${residentId}`);
    }

    return row;
  }

  function cellsOf(row: HTMLElement): string[] {
    return Array.from(row.children).map((cell) => {
      return cell.textContent ?? "";
    });
  }

  return {
    title: wizard.title,
    fill: wizard.fill,
    fieldValue: wizard.fieldValue,
    check: wizard.check,
    isChecked: wizard.isChecked,
    message: wizard.message,
    isNextDisabled: wizard.isNextDisabled,
    isSaveDisabled: wizard.isSaveDisabled,
    next: wizard.next,
    back: wizard.back,
    save: wizard.save,
    cancel: wizard.cancel,
    isShown: wizard.isShown,
    dateRead: (): string | null => {
      return (
        within(dialog()).queryByTestId(TESTIDS.dateFieldParsed)?.textContent ??
        null
      );
    },
    rows: (): string[][] => {
      return within(dialog())
        .queryAllByTestId(TESTIDS.budgetInstallmentRow)
        .map((row) => {
          const [name, percentage] = Array.from(
            row.querySelectorAll<HTMLInputElement>("input"),
          );

          return [
            name?.value ?? "",
            row.querySelector(".budget-rows-date")?.textContent ?? "",
            percentage?.value ?? "",
          ];
        });
    },
    fillName: async (index: number, text: string): Promise<void> => {
      await retype(box(`Installment ${index + 1} name`), text);
    },
    fillPercentage: async (index: number, text: string): Promise<void> => {
      await retype(box(`Installment ${index + 1} % of budget`), text);
    },
    reviewHeaders: (): string[] => {
      return cellsOf(within(dialog()).getByTestId(TESTIDS.budgetReviewHead));
    },
    reviewRow: (residentId: string): string[] => {
      return cellsOf(reviewRowOf(residentId)).slice(1);
    },
    reviewResidents: (): string[] => {
      return within(dialog())
        .queryAllByTestId(TESTIDS.budgetReviewRow)
        .map((row) => {
          return row.getAttribute("data-resident-id") ?? "";
        });
    },
    postingsShown: (): boolean => {
      return within(dialog()).queryByText("Entry postings") !== null;
    },
    saveLabel: (): string => {
      return within(dialog()).getByTestId(TESTIDS.wizardSave).textContent ?? "";
    },
    reviewTotal: (): string => {
      return (
        within(dialog()).getByTestId(TESTIDS.budgetReviewTotal).textContent ??
        ""
      );
    },
  };
}
