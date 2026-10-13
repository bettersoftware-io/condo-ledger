import {
  addCents,
  type Cents,
  subtractCents,
  ZERO_CENTS,
} from "../entities/cents.ts";
import type { JournalEntry, Posting } from "../entities/journal.ts";
import { must } from "../support/must.ts";
import {
  type AccountNode,
  findNode,
  type PostingScope,
} from "./accountTree.ts";

interface LedgerLine {
  entryId: string;
  at: string;
  number: number;
  description: string;
  postingPath: string;
  debit: Cents;
  credit: Cents;
  balance: Cents;
}

export interface Ledger {
  lines: LedgerLine[];
  totalDebit: Cents;
  totalCredit: Cents;
  balance: Cents;
}

const PATH_SEPARATOR = " › ";

/** A leaf that owns postings, with the path the ledger shows for it. */
interface Owner {
  scope: PostingScope;
  path: string;
}

/**
 * The postings under a node, in the order the journal was written (date, then
 * entry number, then the posting's place in its entry), each with the running
 * balance: the cumulative debit minus credit, whatever the account's nature.
 */
export function ledgerOf(
  root: AccountNode,
  key: string,
  entries: JournalEntry[],
): Ledger {
  const owners = ownersUnder(root, key);
  const lines: LedgerLine[] = [];
  let balance = ZERO_CENTS;
  let totalDebit = ZERO_CENTS;
  let totalCredit = ZERO_CENTS;

  for (const entry of chronological(entries)) {
    for (const posting of entry.postings) {
      const owner = owners.find((candidate) => {
        return owns(candidate.scope, posting);
      });

      if (owner === undefined) {
        continue;
      }

      balance = subtractCents(addCents(balance, posting.debit), posting.credit);
      totalDebit = addCents(totalDebit, posting.debit);
      totalCredit = addCents(totalCredit, posting.credit);
      lines.push({
        entryId: entry.id,
        at: entry.at,
        number: entry.number,
        description: entry.description,
        postingPath: owner.path,
        debit: posting.debit,
        credit: posting.credit,
        balance,
      });
    }
  }

  return { lines, totalDebit, totalCredit, balance };
}

/** The node's labels from Total, joined. */
export function pathOf(root: AccountNode, key: string): string {
  return must(trail(root, key, []), `the node ${key}`).join(PATH_SEPARATOR);
}

function ownersUnder(root: AccountNode, key: string): Owner[] {
  const path = pathOf(root, key);
  const start = must(findNode(root, key), `the node ${key}`);
  const owners: Owner[] = [];

  function collect(node: AccountNode, nodePath: string): void {
    if (node.scope !== null) {
      owners.push({ scope: node.scope, path: nodePath });
    }

    for (const child of node.children) {
      collect(child, `${nodePath}${PATH_SEPARATOR}${child.label}`);
    }
  }

  collect(start, path);

  return owners;
}

function owns(scope: PostingScope, posting: Posting): boolean {
  if (posting.accountId !== scope.accountId) {
    return false;
  }

  switch (scope.kind) {
    case "account":
      return true;
    case "supplier":
      return scope.supplierId === NONE
        ? posting.counterpart === null
        : posting.counterpart?.kind === "supplier" &&
            posting.counterpart.id === scope.supplierId;
    case "residency":
      return scope.residentId === NONE
        ? posting.counterpart === null
        : posting.counterpart?.kind === "owner" &&
            posting.counterpart.id === scope.residentId;
  }
}

/** The id accountTree gives the row of postings that name no counterpart. */
const NONE = "none";

function trail(
  node: AccountNode,
  key: string,
  above: string[],
): string[] | undefined {
  const here = [...above, node.label];

  if (node.key === key) {
    return here;
  }

  for (const child of node.children) {
    const found = trail(child, key, here);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

function chronological(entries: JournalEntry[]): JournalEntry[] {
  return entries.slice().sort((a, b) => {
    return a.at.localeCompare(b.at) || a.number - b.number;
  });
}
