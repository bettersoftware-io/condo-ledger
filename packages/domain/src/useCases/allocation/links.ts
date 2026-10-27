import type { Account } from "#/entities/account.ts";
import type { TableLink } from "#/entities/table.ts";

/** The links that allocate an account, and whether they are an ancestor's. */
export interface AppliedLinks {
  links: TableLink[];
  /** The links are the nearest ancestor's: the account has none of its own. */
  inherited: boolean;
}

/**
 * The account's own links, or else those of the nearest account up its
 * chain that has any. None, not inherited, when no account up the chain has
 * links, or the accounts do not hold the account.
 */
export function appliedLinksOf(
  accounts: Account[],
  accountId: string,
): AppliedLinks {
  let current = accountById(accounts, accountId);

  while (current !== undefined && current.links.length === 0) {
    current = accountById(accounts, current.parentId);
  }

  return current === undefined
    ? { links: [], inherited: false }
    : { links: current.links, inherited: current.id !== accountId };
}

function accountById(
  accounts: Account[],
  accountId: string | null,
): Account | undefined {
  return accounts.find((candidate) => {
    return candidate.id === accountId;
  });
}
