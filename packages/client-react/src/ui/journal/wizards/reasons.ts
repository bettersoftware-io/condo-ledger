/** The design's sentence for a generic entry that does not hold together. */
const MUST_BALANCE =
  "The entry must balance — the transaction balance must be 0 and a description is required.";

/** The reasons every wizard can meet, from the domain and the wizards' own rules, as the person reads them. */
const COMMON_REASONS: Readonly<Record<string, string>> = {
  unbalanced: MUST_BALANCE,
  "blank-description": MUST_BALANCE,
  "no-postings": MUST_BALANCE,
  "no-target": "Choose an account",
  "not-an-amount": "Enter an amount",
  "empty-line": "Enter an amount above zero",
  "both-sides": "A line is either a debit or a credit",
  negative: "An amount cannot be negative",
  "lines-do-not-sum": "The lines must add up to the amount paid",
  saving: "Saving…",
  "unknown-account":
    "The period changed while this was open: cancel and open it again",
  "entry-gone":
    "This entry was deleted while it was open: cancel to close this window",
  "kind-not-editable":
    "This kind of entry is edited through its own flow, which is not built yet.",
};

/** The payment wizards' word for a blank description: nothing in them can be unbalanced. */
const DESCRIPTION_REQUIRED = "A description is required";

/** The cash purchase's own words: it pays from the cash account. */
export const CASH_REASONS: Readonly<Record<string, string>> = {
  "blank-description": DESCRIPTION_REQUIRED,
  "no-paid-from-account": "This period has no cash account",
};

/** The bank purchases' and the withholding's own words: they pay from the default bank account. */
export const BANK_REASONS: Readonly<Record<string, string>> = {
  "blank-description": DESCRIPTION_REQUIRED,
  "no-paid-from-account": "This period has no default bank account",
};

/** The New invoice wizard's own words; "below-paid" names what was paid, and the wizard words it. */
export const INVOICE_REASONS: Readonly<Record<string, string>> = {
  "no-supplier": "Choose a supplier",
  "no-number": "Enter the invoice number",
  "no-reason": "Enter the invoice reason",
  "no-cost-account": "Choose a cost account",
  "not-a-date": "Enter a date as day/month/year",
  "due-before-date": "The due date cannot be before the invoice date",
  "not-a-rate": "Enter a rate as a percentage",
  "unknown-withholding": "Choose a withholding tax of this period",
  "supplier-has-payments":
    "This invoice has payments: its supplier cannot change.",
  "blank-description": DESCRIPTION_REQUIRED,
};

/** The Invoice payment wizard's own words; "over-remaining" names what is owed, and the wizard words it. */
export const PAYMENT_REASONS: Readonly<Record<string, string>> = {
  "no-invoice": "Choose an invoice",
  "no-liquidity-account": "Choose a liquidity account",
  "blank-description": DESCRIPTION_REQUIRED,
};

/** A reason in the wizard's words: its own first, then the common ones; a reason no one words is shown as it is. */
export function reasonText(
  reason: string,
  own: Readonly<Record<string, string>> = {},
): string {
  return own[reason] ?? COMMON_REASONS[reason] ?? reason;
}
