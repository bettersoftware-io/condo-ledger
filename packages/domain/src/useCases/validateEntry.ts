import type { Account } from "../entities/account.ts";
import { addCents, ZERO_CENTS } from "../entities/cents.ts";
import type { EntryDraft, Posting } from "../entities/journal.ts";
import { ok, type Result, rejected } from "../entities/result.ts";

/**
 * Whether a draft may be written to the period whose accounts are given. The
 * reasons are checked in this order, and the first one found is answered.
 */
export function validateEntry(draft: EntryDraft, accounts: Account[]): Result {
  if (draft.description.trim() === "") {
    return rejected("blank-description");
  }

  if (draft.postings.length === 0) {
    return rejected("no-postings");
  }

  const byId = new Map(
    accounts.map((account) => {
      return [account.id, account];
    }),
  );

  for (const posting of draft.postings) {
    const reason = lineReason(posting, byId);

    if (reason !== null) {
      return rejected(reason);
    }
  }

  const debit = draft.postings.reduce((sum, posting) => {
    return addCents(sum, posting.debit);
  }, ZERO_CENTS);

  const credit = draft.postings.reduce((sum, posting) => {
    return addCents(sum, posting.credit);
  }, ZERO_CENTS);

  return debit === credit ? ok() : rejected("unbalanced");
}

function lineReason(
  posting: Posting,
  byId: Map<string, Account>,
): string | null {
  const account = byId.get(posting.accountId);

  if (account === undefined) {
    return "unknown-account";
  }

  if (account.type === "grouping") {
    return "not-a-leaf";
  }

  if (posting.debit === 0 && posting.credit === 0) {
    return "empty-line";
  }

  if (posting.debit !== 0 && posting.credit !== 0) {
    return "both-sides";
  }

  if (posting.debit < 0 || posting.credit < 0) {
    return "negative";
  }

  const control =
    account.type === "control" || account.type === "controlUnitResident";

  if (control && posting.counterpart === null) {
    return "counterpart-required";
  }

  if (!control && posting.counterpart !== null) {
    return "counterpart-not-allowed";
  }

  return null;
}
