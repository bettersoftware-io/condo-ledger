import type { JournalEntry } from "@cl/domain";

import type { Books } from "#/presenters/booksPresenter.ts";

import type { WizardName } from "../journalDialogMachine.ts";
import { fitsCollection } from "./collectionWizard.ts";
import { fitsDirectPayment } from "./directPaymentWizard.ts";
import { fitsMultiCost } from "./multiCostPaymentWizard.ts";
import { fitsOpening } from "./openingBalancesWizard.ts";

/**
 * The wizard that edits an entry; null for a kind `canEditEntry` refuses. An
 * entry whose lines its own wizard cannot write (a payment credited to another
 * account than its role's, an opening with supplier lines) opens in the
 * generic editor, which keeps its kind. Invoices and their payments always
 * open in their own: a generic draft cannot carry an invoice. Nor can it
 * carry an installment item: a collection its wizard cannot write has none,
 * and the journal presenter refuses ✎ on it with `lines-not-editable`.
 */
export function editorOf(entry: JournalEntry, books: Books): WizardName | null {
  switch (entry.kind) {
    case "generic":
      return "genericEntry";
    case "directPaymentCash":
    case "withholdingPayment":
      return fitsDirectPayment(entry, books) ? entry.kind : "genericEntry";
    case "directPaymentBank":
      return bankPaymentEditor(entry, books);
    case "invoice":
      return "invoice";
    case "invoicePayment":
      return "invoicePayment";
    case "openingBalances":
      return fitsOpening(entry, books) ? "openingBalances" : "genericEntry";
    case "collection":
      return fitsCollection(entry, books) ? "collection" : null;
    case "budgetAllocation":
    case "closingBalances":
    case "individualExpense":
      return null;
  }
}

/** A bank purchase of one cost opens as a direct payment, of several as a multi-cost one: the multi-cost wizard fits one cost too, so the direct payment is asked first. */
function bankPaymentEditor(entry: JournalEntry, books: Books): WizardName {
  if (fitsDirectPayment(entry, books)) {
    return "directPaymentBank";
  }

  return fitsMultiCost(entry, books) ? "multiCostPayment" : "genericEntry";
}
