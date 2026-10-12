import type { Observable } from "rxjs";

import type { Account } from "#/entities/account.ts";
import type { Cents } from "#/entities/cents.ts";
import type { Party } from "#/entities/party.ts";
import type { Result } from "#/entities/result.ts";

/**
 * A period's chart of accounts and the parties its postings name. Setting a
 * budget is the one edit the administrator makes to the chart.
 */
export interface AccountsPort {
  /** Errors with "missing: the period <id>" for a period the port does not have. */
  accounts(periodId: string): Observable<Account[]>;
  /** The parties the period's postings name. */
  parties(periodId: string): Observable<Party[]>;
  /** Refused with the domain's reason when the account takes no budget; rejects for an account the port does not have. */
  setBudget(accountId: string, budget: Cents): Promise<Result>;
}
