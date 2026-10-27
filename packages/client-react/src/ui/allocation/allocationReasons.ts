import type { Rejected } from "@cl/domain";

import { reasonText } from "../journal/wizards/reasons.ts";

/** What a refusal's words name beyond its code: the table it is about, and the account its detail names. */
export interface ReasonSubject {
  /** The table's name: the one typed, or the one asked about. */
  table?: string;
  /** The path of the account the refusal's detail names; its id stands in when left out. */
  accountPath?: string;
}

/** The account a period lacks, by the role the domain names in the detail. */
const MISSING_ACCOUNTS: Readonly<Record<string, string>> = {
  owners: "owners'",
  roundings: "roundings",
  budgetAllocation: "budget allocation revenue",
};

/**
 * A refusal of the Thousandth Tables & Allocation screen, its table dialog
 * and the Budget allocation wizard, as the person reads it; the wizards'
 * common reasons (`saving`) in their words, and a reason no one words as it
 * is.
 */
export function allocationReasonText(
  refusal: Rejected,
  subject: ReasonSubject = {},
): string {
  const table = subject.table ?? "";
  const account = subject.accountPath ?? refusal.detail ?? "";

  switch (refusal.reason) {
    case "not-a-coefficient":
      return "Enter a coefficient of zero or more, with at most 4 decimals";
    case "blank-name":
      return "A table needs a name";
    case "name-taken":
      return `A table named ${table} already exists`;
    case "bad-order":
      return "Enter the order as a whole number from 1";
    case "table-linked":
      return `${table} allocates ${account}; unlink it first`;
    case "allocation-exists":
      return "This period already has a budget allocation; delete it first";
    case "unallocated-budget":
      return `${account} has a budget but no table to allocate it`;
    case "no-budget":
      return "There is no budget to allocate";
    case "missing-account":
      return `This period has no ${MISSING_ACCOUNTS[account] ?? account} account`;
    default:
      return reasonText(refusal.reason);
  }
}
