import type { Observable } from "rxjs";

import type { Account } from "#/entities/account.ts";
import type { Cents } from "#/entities/cents.ts";
import type { WithholdingTax } from "#/entities/invoice.ts";
import type { Party } from "#/entities/party.ts";
import type { Result } from "#/entities/result.ts";

/**
 * A period's chart of accounts, its parties and its withholding catalogue.
 * Setting a budget is the one edit the administrator makes to the chart.
 */
export interface AccountsPort {
  /** Errors with "missing: the period <id>" for a period the port does not have. */
  accounts(periodId: string): Observable<Account[]>;
  /** The building's suppliers and the period's residents, whether or not a posting names them. Errors as accounts() does. */
  parties(periodId: string): Observable<Party[]>;
  /** The tribute codes the building withholds on in the period, each with its account. Errors as accounts() does. */
  withholdingTaxes(periodId: string): Observable<WithholdingTax[]>;
  /** Refused with the domain's reason when the account takes no budget; rejects for an account the port does not have. */
  setBudget(accountId: string, budget: Cents): Promise<Result>;
}
