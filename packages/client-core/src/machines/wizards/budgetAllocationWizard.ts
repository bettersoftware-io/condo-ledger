import {
  type Allocation,
  budgetAllocationDraftOf,
  type EntryAdded,
  type EntryDraft,
  type Result,
  type ResultOf,
} from "@cl/domain";

import type { Books } from "#/presenters/booksPresenter.ts";

import { contextOf, previewPath } from "./choices.ts";
import {
  createWizardMachine,
  type Derived,
  judged,
  refused,
  type WizardMachine,
} from "./wizard.ts";

/** What the person types: only the entry's description. */
export interface BudgetAllocationForm {
  description: string;
}

/** What the wizard shows beyond the contract. */
export interface BudgetAllocationSummary {
  /** The entry the budget allocation posts, as the domain draws it; null while the domain refuses it. */
  preview: EntryDraft | null;
}

const DEFAULT_DESCRIPTION = "Budget allocation (no.1)";

/**
 * The Budget allocation wizard: one step, the description and the postings
 * the period's budget-mode `allocation` gives. The preview and the save make
 * the same call, `budgetAllocationDraftOf` over the books' entries and
 * accounts; its refusal is the verdict, then validateEntry's on the draft (a
 * blank description). With no books or no allocation there is nothing to
 * allocate: `no-budget`.
 */
export function createBudgetAllocationWizard(
  books: Books | null,
  allocation: Allocation | null,
  write: (draft: EntryDraft) => Promise<ResultOf<EntryAdded>>,
): WizardMachine<BudgetAllocationForm, BudgetAllocationSummary> {
  function derived(form: BudgetAllocationForm): Derived {
    return derive(books, allocation, form);
  }

  return createWizardMachine<BudgetAllocationForm, BudgetAllocationSummary>(
    {
      initial: { description: DEFAULT_DESCRIPTION },
      stepCount: 1,
      choices: [],
      derive: derived,
      summarize: (form: BudgetAllocationForm): BudgetAllocationSummary => {
        const draft = draftOf(books, allocation, form);

        return { preview: draft?.ok === true ? draft.value : null };
      },
      stepVerdict: (form: BudgetAllocationForm): Result => {
        return derived(form).verdict;
      },
    },
    write,
  );
}

function derive(
  books: Books | null,
  allocation: Allocation | null,
  form: BudgetAllocationForm,
): Derived {
  const draft = draftOf(books, allocation, form);

  if (books === null || draft === null) {
    return refused("no-budget");
  }

  if (!draft.ok) {
    return { preview: [], verdict: draft, draft: null };
  }

  const preview = draft.value.postings.map((posting) => {
    return {
      path: previewPath(books, posting),
      debit: posting.debit,
      credit: posting.credit,
    };
  });

  return judged(preview, draft.value, contextOf(books, null));
}

/** The domain's draft over the books and the allocation; null with either missing. */
function draftOf(
  books: Books | null,
  allocation: Allocation | null,
  form: BudgetAllocationForm,
): ResultOf<EntryDraft> | null {
  return books === null || allocation === null
    ? null
    : budgetAllocationDraftOf(
        allocation,
        books.entries,
        books.accounts,
        form.description,
      );
}
