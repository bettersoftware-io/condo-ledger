import { BehaviorSubject, map, type Observable, of } from "rxjs";

import type { Account } from "#/entities/account.ts";
import type { Cents } from "#/entities/cents.ts";
import type { WithholdingTax } from "#/entities/invoice.ts";
import type { OwnerParty, Party, SupplierParty } from "#/entities/party.ts";
import type { Result } from "#/entities/result.ts";
import type { AccountsPort } from "#/ports/accountsPort.ts";
import { must } from "#/support/must.ts";
import { validateBudget } from "#/useCases/validateBudget.ts";

import { missingPeriod } from "./missingPeriod.ts";
import type { LegacySeed } from "./seed/legacySeed.ts";
import { seededResidents, seededSuppliers } from "./seededParties.ts";

/** A period's accounts, kept in memory, the building's suppliers and the period's withholding catalogue. */
interface PeriodBooks {
  accounts$: BehaviorSubject<Account[]>;
  suppliers: SupplierParty[];
  withholdingTaxes: WithholdingTax[];
}

/** The port, and what the tables simulator reads of it: a period's accounts as they stand now. */
export interface AccountsSimulator extends AccountsPort {
  /** Throws "missing: the period <id>" for a period the simulator does not have. */
  current(periodId: string): Account[];
}

/**
 * The chart of accounts of every seeded period, with the budget edit kept in
 * memory. A period's parties are the seed's suppliers, then its residents as
 * `residentsOf` streams them; left out, the seed's residents. Throws on an
 * unknown id: it never answers empty for a wrong key.
 */
export function createAccountsSimulator(
  seed: LegacySeed,
  residentsOf: (periodId: string) => Observable<OwnerParty[]> = (
    periodId: string,
  ): Observable<OwnerParty[]> => {
    return of(seededResidents(seed, periodId));
  },
): AccountsSimulator {
  const periods = new Map<string, PeriodBooks>();

  for (const building of seed.buildings) {
    for (const period of building.periods) {
      periods.set(period.id, {
        accounts$: new BehaviorSubject(
          seed.accounts.filter((account) => {
            return account.periodId === period.id;
          }),
        ),
        suppliers: seededSuppliers(seed, period.id),
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
        ? missingPeriod(periodId)
        : books.accounts$.asObservable();
    },
    parties: (periodId: string): Observable<Party[]> => {
      const books = periods.get(periodId);

      return books === undefined
        ? missingPeriod(periodId)
        : residentsOf(periodId).pipe(
            map((residents) => {
              return [...books.suppliers, ...residents];
            }),
          );
    },
    withholdingTaxes: (periodId: string): Observable<WithholdingTax[]> => {
      const books = periods.get(periodId);

      return books === undefined
        ? missingPeriod(periodId)
        : of(books.withholdingTaxes);
    },
    setBudget: (accountId: string, budget: Cents): Promise<Result> => {
      // A throw inside the executor is a rejection, as the port promises; an async arrow with no await would trip require-await.
      return new Promise((resolve) => {
        resolve(applyBudget([...periods.values()], accountId, budget));
      });
    },
    current: (periodId: string): Account[] => {
      return must(
        periods.get(periodId),
        `the period ${periodId}`,
      ).accounts$.getValue();
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
