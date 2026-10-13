import type { Account } from "../entities/account.ts";
import type { Cents } from "../entities/cents.ts";
import { ok, type Result, rejected } from "../entities/result.ts";

/** A budget belongs to a leaf cost account and is never negative. */
export function validateBudget(account: Account, budget: Cents): Result {
  if (account.nature !== "expenses") {
    return rejected("not-a-cost-account");
  }

  if (account.type === "grouping") {
    return rejected("not-a-leaf");
  }

  if (budget < 0) {
    return rejected("negative");
  }

  return ok();
}
