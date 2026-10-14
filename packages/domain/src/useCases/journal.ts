import {
  addCents,
  type Cents,
  subtractCents,
  ZERO_CENTS,
} from "../entities/cents.ts";
import type { EntryKind, JournalEntry, Posting } from "../entities/journal.ts";
import { must } from "../support/must.ts";
import { type AccountNode, ROOT_KEY, scopeOwns } from "./accountTree.ts";
import { type Owner, ownersUnder, PATH_SEPARATOR } from "./ledger.ts";

export interface PostingView {
  /** The posting's row without a side: `la1`, `la4/md2`, `la5/md10/r1`. */
  key: string;
  /** The row's labels from Total, joined; a control row's path leaves the side level out, as the design's export does. */
  path: string;
  debit: Cents;
  credit: Cents;
  /** Debit minus credit, running within the entry; zero on the last line of a balanced entry. */
  balance: Cents;
}

export interface JournalEntryView {
  id: string;
  number: number;
  at: string;
  kind: EntryKind;
  description: string;
  debit: Cents;
  credit: Cents;
  postings: PostingView[];
}

const SIDE_KEYS = new Set(["assets", "liabilities"]);

/** The Journal screen's data for one period: every entry by number, each posting with its row's path and the running balance. */
export function journalOf(
  root: AccountNode,
  entries: JournalEntry[],
): JournalEntryView[] {
  const owners = ownersUnder(root, ROOT_KEY);

  return entries
    .slice()
    .sort((a, b) => {
      return a.number - b.number;
    })
    .map((entry) => {
      let balance = ZERO_CENTS;
      let debit = ZERO_CENTS;
      let credit = ZERO_CENTS;
      const postings = entry.postings.map((posting) => {
        const owner = ownerOf(owners, posting);
        balance = subtractCents(
          addCents(balance, posting.debit),
          posting.credit,
        );
        debit = addCents(debit, posting.debit);
        credit = addCents(credit, posting.credit);

        return {
          key: keyOf(owner.node),
          path: pathWithoutSide(owner),
          debit: posting.debit,
          credit: posting.credit,
          balance,
        };
      });

      return {
        id: entry.id,
        number: entry.number,
        at: entry.at,
        kind: entry.kind,
        description: entry.description,
        debit,
        credit,
        postings,
      };
    });
}

function ownerOf(owners: Owner[], posting: Posting): Owner {
  return must(
    owners.find((candidate) => {
      return scopeOwns(candidate.scope, posting);
    }),
    `the node of the posting on ${posting.accountId}`,
  );
}

/** The node's key without a side: what the fixture and the grid key a posting by. */
function keyOf(node: AccountNode): string {
  return node.key.replace(/@(assets|liabilities)/, "");
}

/** The row's path; a control row's trail skips the side level, a plain leaf keeps it. */
function pathWithoutSide(owner: Owner): string {
  if (owner.scope.kind === "account") {
    return owner.path;
  }

  return owner.trail
    .filter((node) => {
      return !SIDE_KEYS.has(node.key);
    })
    .map((node) => {
      return node.label;
    })
    .join(PATH_SEPARATOR);
}
