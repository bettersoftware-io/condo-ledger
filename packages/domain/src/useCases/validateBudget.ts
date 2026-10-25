import type { Account } from "../entities/account.ts";
import type { Cents } from "../entities/cents.ts";
import { ok, type Result, rejected } from "../entities/result.ts";

/**
 * A budget belongs to a leaf cost account. It may be negative, as the legacy
 * schema's signed `estimate` holds it (Pozzetto 2013 has two).
 */
export function validateBudget(account: Account, _budget: Cents): Result {
  if (account.nature !== "expenses") {
    return rejected("not-a-cost-account");
  }

  if (account.type === "grouping") {
    return rejected("not-a-leaf");
  }

  return ok();
}
