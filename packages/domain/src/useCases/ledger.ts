import {
  addCents,
  type Cents,
  subtractCents,
  ZERO_CENTS,
} from "../entities/cents.ts";
import type { JournalEntry } from "../entities/journal.ts";
import { must } from "../support/must.ts";
import {
  type AccountNode,
  type PostingScope,
  scopeOwns,
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

export const PATH_SEPARATOR = " › ";

/** A leaf that owns postings: the path the ledger shows for it, and the nodes that path is made of. */
export interface Owner {
  node: AccountNode;
  scope: PostingScope;
  /** The nodes from Total down to this leaf. */
  trail: AccountNode[];
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
        return scopeOwns(candidate.scope, posting);
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
  return joined(must(trail(root, key, []), `the node ${key}`));
}

/** Every leaf under the node with this key that owns postings, in tree order. */
export function ownersUnder(root: AccountNode, key: string): Owner[] {
  const above = must(trail(root, key, []), `the node ${key}`);
  const owners: Owner[] = [];

  function collect(nodes: AccountNode[]): void {
    const node = must(nodes.at(-1), `the node ${key}`);

    if (node.scope !== null) {
      owners.push({
        node,
        scope: node.scope,
        trail: nodes,
        path: joined(nodes),
      });
    }

    for (const child of node.children) {
      collect([...nodes, child]);
    }
  }

  collect(above);

  return owners;
}

function joined(nodes: AccountNode[]): string {
  return nodes
    .map((node) => {
      return node.label;
    })
    .join(PATH_SEPARATOR);
}

function trail(
  node: AccountNode,
  key: string,
  above: AccountNode[],
): AccountNode[] | undefined {
  const here = [...above, node];

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
