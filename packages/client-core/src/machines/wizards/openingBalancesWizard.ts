import {
  type Account,
  type AccountNature,
  type AccountRole,
  addCents,
  type Cents,
  type Counterpart,
  cents,
  type EntryDraft,
  type JournalEntry,
  type OwnerParty,
  PATH_SEPARATOR,
  type Party,
  type Posting,
  type Result,
  subtractCents,
  ZERO_CENTS,
} from "@cl/domain";

import { amountText, parseAmount } from "#/amounts.ts";
import type { Books } from "#/presenters/booksPresenter.ts";

import { contextOf, leafChoices } from "./choices.ts";
import { sideText } from "./genericEntryWizard.ts";
import {
  createWizardMachine,
  type Derived,
  judged,
  refused,
  type WizardMachine,
  type WriteEntry,
} from "./wizard.ts";

/** A row's Debit and Credit, as typed. */
export interface OpeningAmount {
  debit: string;
  credit: string;
}

export interface OpeningForm {
  description: string;
  /** By row key; a row not here has neither amount. */
  amounts: Record<string, OpeningAmount>;
  /** Narrows the rows shown to those whose label holds it, whatever the case. */
  search: string;
  /** Narrows the rows shown to those with an amount. */
  onlyWithAmount: boolean;
}

/** One row of the list as shown: its amounts as the form holds them. */
export interface OpeningRowView {
  key: string;
  label: string;
  debit: string;
  credit: string;
}

/** What the Opening balances wizard shows beyond the contract. */
export interface OpeningSummary {
  /** The rows the search and the "Show only rows with an amount" box leave. */
  rows: OpeningRowView[];
  /** "Transaction balance": every row's debits minus its credits, an amount that does not read counted as zero. */
  balance: Cents;
  /** The label of the first row, in list order, with an amount that does not read or is below zero: the row a `not-an-amount` names. Null when every one reads. */
  unreadableRow: string | null;
}

/** A row of the opening list: what a line on it writes. */
export interface OpeningRow {
  /** A leaf's account id; a resident's `<owners account id>/<resident id>`. */
  key: string;
  label: string;
  accountId: string;
  counterpart: Counterpart | null;
}

const OPENING_DESCRIPTION = "Opening balances";

/** The natures an opening balance stands on: what the period carries over. */
const OPENING_NATURES: readonly AccountNature[] = [
  "assets",
  "liabilities",
  "assetsOrLiabilities",
];

/** Accounts the list leaves out: a supplier's opening debt needs an opening invoice, and roundings carry nothing over. */
const LEFT_OUT_ROLES: readonly (AccountRole | null)[] = [
  "suppliers",
  "roundings",
];

/** What the wizard reads the form against. */
interface OpeningBooks {
  books: Books | null;
  rows: OpeningRow[];
  /** The id of the opening the wizard rewrites; null for a new one. */
  replacing: string | null;
}

/** A row's amounts read: null for a side that does not read, or reads below zero. */
interface ReadAmount {
  debit: Cents | null;
  credit: Cents | null;
}

/**
 * The Opening balances wizard: one list of every regular assets and
 * liabilities leaf and every resident of the period, each with Debit and
 * Credit. A new opening has each resident prefilled from the starting
 * balance (a debt in Debit, a credit in Credit); an edit shows the entry's
 * own lines. Rows with neither amount write nothing.
 */
export function createOpeningBalancesWizard(
  books: Books | null,
  write: WriteEntry,
  editing: JournalEntry | null,
): WizardMachine<OpeningForm, OpeningSummary> {
  const read: OpeningBooks = {
    books,
    rows: books === null ? [] : openingRows(books),
    replacing: editing?.id ?? null,
  };

  function derived(form: OpeningForm): Derived {
    return derive(read, form);
  }

  return createWizardMachine<OpeningForm, OpeningSummary>(
    {
      initial: {
        description: editing?.description ?? OPENING_DESCRIPTION,
        amounts:
          editing === null
            ? prefilled(books?.parties ?? [], read.rows)
            : amountsOf(editing),
        search: "",
        onlyWithAmount: false,
      },
      stepCount: 1,
      choices: [],
      derive: derived,
      summarize: (form: OpeningForm): OpeningSummary => {
        return summarize(read.rows, form);
      },
      stepVerdict: (form: OpeningForm): Result => {
        return derived(form).verdict;
      },
      editing: read.replacing,
    },
    write,
  );
}

/** The rows of the opening list: the period's regular assets and liabilities leaves by their path, in tree order, then one per resident under the owners account. */
export function openingRows(books: Books): OpeningRow[] {
  const leaves = leafChoices(books, isOpeningLeaf).map((choice): OpeningRow => {
    return {
      key: choice.key,
      label: choice.label,
      accountId: choice.key,
      counterpart: null,
    };
  });

  const owners = books.accounts.find((account) => {
    return account.role === "owners";
  });

  if (owners === undefined) {
    return leaves;
  }

  const residents = books.parties.filter(isOwner).map((owner): OpeningRow => {
    return {
      key: residentKey(owners.id, owner.id),
      label: [owners.name, owner.name, owner.unitCode].join(PATH_SEPARATOR),
      accountId: owners.id,
      counterpart: { kind: "owner", id: owner.id },
    };
  });

  return [...leaves, ...residents];
}

/** Whether the Opening balances wizard can write this entry's postings: an opening whose every line lands on a row of the list, no row twice. */
export function fitsOpening(entry: JournalEntry, books: Books): boolean {
  const rows = new Set(
    openingRows(books).map((row) => {
      return row.key;
    }),
  );
  const named = entry.postings.map(postingKey);

  return (
    entry.kind === "openingBalances" &&
    named.every((key) => {
      return key !== null && rows.has(key);
    }) &&
    new Set(named).size === named.length
  );
}

function derive(read: OpeningBooks, form: OpeningForm): Derived {
  const { books } = read;

  // With no books there is no row, so nothing to write.
  if (books === null) {
    return refused("no-postings");
  }

  const postings: Posting[] = [];
  const preview: Derived["preview"] = [];

  for (const row of read.rows) {
    const { debit, credit } = readAmount(form, row);

    if (debit === null || credit === null) {
      return refused(
        form.description.trim() === "" ? "blank-description" : "not-an-amount",
      );
    }

    if (debit !== ZERO_CENTS || credit !== ZERO_CENTS) {
      postings.push({
        accountId: row.accountId,
        debit,
        credit,
        counterpart: row.counterpart,
      });
      preview.push({ path: row.label, debit, credit });
    }
  }

  const draft: EntryDraft = {
    kind: "openingBalances",
    description: form.description,
    postings,
  };

  return judged(preview, draft, contextOf(books, read.replacing));
}

function summarize(rows: OpeningRow[], form: OpeningForm): OpeningSummary {
  const search = form.search.trim().toLowerCase();
  let balance = ZERO_CENTS;
  let unreadableRow: string | null = null;

  for (const row of rows) {
    const { debit, credit } = readAmount(form, row);

    balance = subtractCents(
      addCents(balance, debit ?? ZERO_CENTS),
      credit ?? ZERO_CENTS,
    );

    if ((debit === null || credit === null) && unreadableRow === null) {
      unreadableRow = row.label;
    }
  }

  const shown = rows
    .filter((row) => {
      return (
        row.label.toLowerCase().includes(search) &&
        (!form.onlyWithAmount || hasAmount(form, row))
      );
    })
    .map((row): OpeningRowView => {
      const amount = amountOf(form, row);

      return {
        key: row.key,
        label: row.label,
        debit: amount.debit,
        credit: amount.credit,
      };
    });

  return { rows: shown, balance, unreadableRow };
}

/** Whether the row holds an amount: a side typed that is not zero, or that does not read. */
function hasAmount(form: OpeningForm, row: OpeningRow): boolean {
  const amount = amountOf(form, row);

  return [amount.debit, amount.credit].some((text) => {
    return text.trim() !== "" && parseAmount(text) !== ZERO_CENTS;
  });
}

function readAmount(form: OpeningForm, row: OpeningRow): ReadAmount {
  const amount = amountOf(form, row);

  return { debit: sideOf(amount.debit), credit: sideOf(amount.credit) };
}

function amountOf(form: OpeningForm, row: OpeningRow): OpeningAmount {
  return form.amounts[row.key] ?? { debit: "", credit: "" };
}

/** A side's text as cents: blank is zero; one that does not read, or reads below zero, is null. */
function sideOf(text: string): Cents | null {
  if (text.trim() === "") {
    return ZERO_CENTS;
  }

  const amount = parseAmount(text);

  return amount === null || amount < ZERO_CENTS ? null : amount;
}

/** A new opening's amounts: each resident's starting balance, a debt in Debit and a credit in Credit; nothing for zero. */
function prefilled(
  parties: Party[],
  rows: OpeningRow[],
): Record<string, OpeningAmount> {
  const amounts: Record<string, OpeningAmount> = {};

  for (const owner of parties.filter(isOwner)) {
    const row = rows.find((candidate) => {
      return candidate.counterpart?.id === owner.id;
    });
    const balance = owner.startingBalance;

    if (row !== undefined && balance !== ZERO_CENTS) {
      amounts[row.key] =
        balance > ZERO_CENTS
          ? { debit: amountText(balance), credit: "" }
          : { debit: "", credit: amountText(cents(-balance)) };
    }
  }

  return amounts;
}

/** The amounts an opening was written from: each posting on its row, a side of zero blank. */
function amountsOf(entry: JournalEntry): Record<string, OpeningAmount> {
  const amounts: Record<string, OpeningAmount> = {};

  for (const posting of entry.postings) {
    const key = postingKey(posting);

    if (key !== null) {
      amounts[key] = {
        debit: sideText(posting.debit),
        credit: sideText(posting.credit),
      };
    }
  }

  return amounts;
}

/** The key of the row a posting lands on: its account's for no party, a resident's for an owner; null for a supplier, whom the list has no row for. */
function postingKey(posting: Posting): string | null {
  const { counterpart } = posting;

  if (counterpart === null) {
    return posting.accountId;
  }

  return counterpart.kind === "owner"
    ? residentKey(posting.accountId, counterpart.id)
    : null;
}

function residentKey(accountId: string, residentId: string): string {
  return `${accountId}/${residentId}`;
}

function isOpeningLeaf(account: Account): boolean {
  return (
    OPENING_NATURES.includes(account.nature) &&
    !LEFT_OUT_ROLES.includes(account.role)
  );
}

function isOwner(party: Party): party is OwnerParty {
  return party.kind === "owner";
}
