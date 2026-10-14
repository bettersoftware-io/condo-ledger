/** The design's sentence for an entry that does not hold together. */
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
  "lines-do-not-sum": "The lines must add up to the amount paid",
  saving: "Saving…",
};

/** The cash purchase's own words: it pays from the cash account. */
export const CASH_REASONS: Readonly<Record<string, string>> = {
  "no-paid-from-account": "This period has no cash account",
};

/** The bank purchases' and the withholding's own words: they pay from the default bank account. */
export const BANK_REASONS: Readonly<Record<string, string>> = {
  "no-paid-from-account": "This period has no default bank account",
};

/** A reason in the wizard's words: its own first, then the common ones; a reason no one words is shown as it is. */
export function reasonText(
  reason: string,
  own: Readonly<Record<string, string>> = {},
): string {
  return own[reason] ?? COMMON_REASONS[reason] ?? reason;
}
