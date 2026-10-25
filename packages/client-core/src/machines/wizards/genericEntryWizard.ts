import {
  addCents,
  type Cents,
  type Counterpart,
  type EntryDraft,
  type EntryKind,
  findNode,
  type JournalEntry,
  NONE,
  type Posting,
  type PostingScope,
  type Result,
  subtractCents,
  ZERO_CENTS,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import type { AmountTexts } from "#/amounts.ts";
import type { Books } from "#/presenters/booksPresenter.ts";

import { contextOf, rowChoices, rowKeyOf } from "./choices.ts";
import {
  createWizardMachine,
  type Derived,
  judged,
  keepingOneLine,
  refused,
  type WizardChoice,
  type WizardMachine,
  type WriteEntry,
} from "./wizard.ts";

/** One line of the entry: the row of the tree it lands on, and its debit and credit as typed. */
export interface GenericLine {
  scopeKey: string | null;
  debit: string;
  credit: string;
}

export interface GenericEntryForm {
  description: string;
  lines: GenericLine[];
}

/** What the generic wizard shows beyond the contract: the lines grid's Balance column and its totals. */
export interface GenericEntrySummary {
  /** Per line, the running debit minus credit down to it. */
  balances: Cents[];
  debit: Cents;
  credit: Cents;
  /** Debit minus credit: zero when the entry balances. */
  balance: Cents;
}

/** A line read: the row chosen, and the posting it writes. */
interface ReadLine {
  path: string;
  posting: Posting;
}

/** A line's amounts as the summary counts them: a text that does not read counts as zero. */
interface Sides {
  debit: Cents;
  credit: Cents;
}

const EMPTY_LINE: GenericLine = { scopeKey: null, debit: "", credit: "" };

/** What a generic draft is written as, beside its lines: its kind, and the entry it rewrites. */
interface Writing {
  kind: EntryKind;
  replacing: string | null;
}

/**
 * Any entry, line by line: each line lands on a row of the tree, so a line on
 * a control account names its party by construction. It writes `kind`: by
 * default generic for a new entry, and an edited entry's own kind (the port
 * refuses a replace that changes it). Editing an entry, the form is its
 * description and its postings, each on the row that owns it. Amounts are
 * read and written through `texts`, in the session's locale.
 */
export function createGenericEntryWizard(
  texts: AmountTexts,
  books: Books | null,
  write: WriteEntry,
  editing: JournalEntry | null,
  kind: EntryKind = editing?.kind ?? "generic",
): WizardMachine<GenericEntryForm, GenericEntrySummary> {
  const choices = books === null ? [] : rowChoices(books);
  const writing: Writing = { kind, replacing: editing?.id ?? null };

  function derived(form: GenericEntryForm): Derived {
    return derive(texts, books, choices, form, writing);
  }

  return keepingOneLine(
    createWizardMachine<GenericEntryForm, GenericEntrySummary>(
      {
        initial:
          editing === null
            ? { description: "", lines: [EMPTY_LINE] }
            : formOf(texts, books, editing),
        stepCount: 1,
        choices,
        derive: derived,
        summarize: (form: GenericEntryForm): GenericEntrySummary => {
          return summarize(texts, form);
        },
        stepVerdict: (form: GenericEntryForm): Result => {
          return derived(form).verdict;
        },
        editing: writing.replacing,
      },
      write,
      texts.changed$,
    ),
    EMPTY_LINE,
  );
}

/** The posting a line on this row writes: the scope's account, and its party unless the row is of postings that name none. */
export function postingOf(
  books: Books,
  scopeKey: string,
  debit: Cents,
  credit: Cents,
): Posting {
  const scope = must(
    findNode(books.tree, scopeKey)?.scope,
    `the row ${scopeKey}`,
  );

  return {
    accountId: scope.accountId,
    debit,
    credit,
    counterpart: counterpartOf(scope),
  };
}

/** The form an entry was written from: a line per posting, on the row offered that owns it (none when no row does), a side of zero left blank. */
function formOf(
  texts: AmountTexts,
  books: Books | null,
  entry: JournalEntry,
): GenericEntryForm {
  return {
    description: entry.description,
    lines: entry.postings.map((posting): GenericLine => {
      return {
        scopeKey: books === null ? null : rowKeyOf(books, posting),
        debit: sideText(texts, posting.debit),
        credit: sideText(texts, posting.credit),
      };
    }),
  };
}

/** A side of a posting as a form holds it: blank for zero. */
export function sideText(texts: AmountTexts, amount: Cents): string {
  return amount === ZERO_CENTS ? "" : texts.text(amount);
}

function derive(
  texts: AmountTexts,
  books: Books | null,
  choices: WizardChoice[],
  form: GenericEntryForm,
  writing: Writing,
): Derived {
  const read: ReadLine[] = [];

  // With no books no line has a row: what the first line would answer.
  if (books === null) {
    return refused(lineReason(form, "no-target"));
  }

  for (const line of form.lines) {
    const lineRead = readLine(texts, books, choices, line);

    if (typeof lineRead === "string") {
      return refused(lineReason(form, lineRead));
    }

    read.push(lineRead);
  }

  const draft: EntryDraft = {
    kind: writing.kind,
    description: form.description,
    postings: read.map((line) => {
      return line.posting;
    }),
  };

  const preview = read.map((line) => {
    return {
      path: line.path,
      debit: line.posting.debit,
      credit: line.posting.credit,
    };
  });
  return judged(preview, draft, contextOf(books, writing.replacing));
}

/** A line's reason, after the blank description the domain would answer first. */
function lineReason(form: GenericEntryForm, reason: string): string {
  return form.description.trim() === "" ? "blank-description" : reason;
}

/** The line's row and posting, or why it has none: no row chosen, or a text that does not read. */
function readLine(
  texts: AmountTexts,
  books: Books,
  choices: WizardChoice[],
  line: GenericLine,
): ReadLine | string {
  const choice = choices.find((candidate) => {
    return candidate.key === line.scopeKey;
  });

  if (choice === undefined) {
    return "no-target";
  }

  const debit = amountOf(texts, line.debit);
  const credit = amountOf(texts, line.credit);

  if (debit === null || credit === null) {
    return "not-an-amount";
  }

  return {
    path: choice.label,
    posting: postingOf(books, choice.key, debit, credit),
  };
}

function summarize(
  texts: AmountTexts,
  form: GenericEntryForm,
): GenericEntrySummary {
  const balances: Cents[] = [];
  let debit = ZERO_CENTS;
  let credit = ZERO_CENTS;

  for (const line of form.lines) {
    const sides = sidesOf(texts, line);

    debit = addCents(debit, sides.debit);
    credit = addCents(credit, sides.credit);
    balances.push(subtractCents(debit, credit));
  }

  return { balances, debit, credit, balance: subtractCents(debit, credit) };
}

function sidesOf(texts: AmountTexts, line: GenericLine): Sides {
  return {
    debit: amountOf(texts, line.debit) ?? ZERO_CENTS,
    credit: amountOf(texts, line.credit) ?? ZERO_CENTS,
  };
}

/** A side's text as cents: an empty text is zero, one that does not read is null. */
function amountOf(texts: AmountTexts, text: string): Cents | null {
  return text.trim() === "" ? ZERO_CENTS : texts.parse(text);
}

function counterpartOf(scope: PostingScope): Counterpart | null {
  switch (scope.kind) {
    case "account":
      return null;
    case "supplier":
      return scope.supplierId === NONE
        ? null
        : { kind: "supplier", id: scope.supplierId };
    case "residency":
      return scope.residentId === NONE
        ? null
        : { kind: "owner", id: scope.residentId };
  }
}
