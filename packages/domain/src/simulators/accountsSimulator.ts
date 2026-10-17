import { BehaviorSubject, type Observable, of, throwError } from "rxjs";

import type { Account } from "#/entities/account.ts";
import type { Cents } from "#/entities/cents.ts";
import type { WithholdingTax } from "#/entities/invoice.ts";
import type { Party } from "#/entities/party.ts";
import type { Result } from "#/entities/result.ts";
import type { AccountsPort } from "#/ports/accountsPort.ts";
import { must } from "#/support/must.ts";
import { validateBudget } from "#/useCases/validateBudget.ts";

import type { LegacySeed } from "./seed/legacySeed.ts";

/** A period's accounts, kept in memory, its parties (the building's suppliers and the period's residents) and its withholding catalogue. */
interface PeriodBooks {
  accounts$: BehaviorSubject<Account[]>;
  parties: Party[];
  withholdingTaxes: WithholdingTax[];
}

/** The chart of accounts of every seeded period, with the budget edit kept in memory. Throws on an unknown id: it never answers empty for a wrong key. */
export function createAccountsSimulator(seed: LegacySeed): AccountsPort {
  const periods = new Map<string, PeriodBooks>();

  for (const building of seed.buildings) {
    for (const period of building.periods) {
      periods.set(period.id, {
        accounts$: new BehaviorSubject(
          seed.accounts.filter((account) => {
            return account.periodId === period.id;
          }),
        ),
        parties:
          seed.parties.find((list) => {
            return list.periodId === period.id;
          })?.parties ?? [],
        withholdingTaxes: seed.withholdingTaxes.filter((tax) => {
          return tax.periodId === period.id;
        }),
      });
    }
  }

  return {
    accounts: (periodId: string): Observable<Account[]> => {
      const books = periods.get(periodId);

      return books === undefined
        ? missing(`the period ${periodId}`)
        : books.accounts$.asObservable();
    },
    parties: (periodId: string): Observable<Party[]> => {
      const books = periods.get(periodId);

      return books === undefined
        ? missing(`the period ${periodId}`)
        : of(books.parties);
    },
    withholdingTaxes: (periodId: string): Observable<WithholdingTax[]> => {
      const books = periods.get(periodId);

      return books === undefined
        ? missing(`the period ${periodId}`)
        : of(books.withholdingTaxes);
    },
    setBudget: (accountId: string, budget: Cents): Promise<Result> => {
      // A throw inside the executor is a rejection, as the port promises; an async arrow with no await would trip require-await.
      return new Promise((resolve) => {
        resolve(applyBudget([...periods.values()], accountId, budget));
      });
    },
  };
}

function applyBudget(
  books: PeriodBooks[],
  accountId: string,
  budget: Cents,
): Result {
  const owner = must(
    books.find((candidate) => {
      return candidate.accounts$.getValue().some((account) => {
        return account.id === accountId;
      });
    }),
    `the account ${accountId}`,
  );
  const accounts = owner.accounts$.getValue();
  const account = must(
    accounts.find((candidate) => {
      return candidate.id === accountId;
    }),
    `the account ${accountId}`,
  );
  const verdict = validateBudget(account, budget);

  if (verdict.ok) {
    owner.accounts$.next(
      accounts.map((candidate) => {
        return candidate.id === accountId
          ? { ...candidate, budget }
          : candidate;
      }),
    );
  }

  return verdict;
}

function missing<T>(what: string): Observable<T> {
  return throwError(() => {
    return new Error(`missing: ${what}`);
  });
}
