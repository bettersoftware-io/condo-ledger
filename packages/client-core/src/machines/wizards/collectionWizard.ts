import {
  accepted,
  addCents,
  type Cents,
  type ClockPort,
  collectionPostings,
  type EntryAdded,
  type EntryDraft,
  type ItemBalance,
  itemBalances,
  type JournalEntry,
  type OwnerParty,
  ok,
  owedBy,
  type Posting,
  type Result,
  type ResultOf,
  rejected,
  type Settlement,
  settleOldestFirst,
  subtractCents,
  ZERO_CENTS,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import { amountText, parseAmount } from "#/amounts.ts";
import type { Books } from "#/presenters/booksPresenter.ts";
import { todayOf } from "#/today.ts";

import {
  contextOf,
  liquidityChoices,
  previewPath,
  roleAccount,
} from "./choices.ts";
import {
  createWizardMachine,
  type Derived,
  judged,
  refused,
  type WizardChoice,
  type WizardMachine,
  type WriteEntry,
} from "./wizard.ts";

/** What the person picks and types for a collection: the amount as text, read in core. */
export interface CollectionForm {
  personId: string | null;
  /** The liquidity account the collection is paid into. */
  accountId: string | null;
  amount: string;
  description: string;
  /** The fields the person changed: the amount and the description stop following the person once they are here. */
  edited: string[];
}

/** One row of step 1's grid: a person who still owes something, across all their residencies of the period. */
export interface PersonRow {
  personId: string;
  name: string;
  /** The codes of the person's units, in order. */
  units: string[];
  /** What the person's items add up to, zero items included. */
  total: Cents;
  paid: Cents;
  remaining: Cents;
}

/** One item the collection pays, as the settlement table shows it. */
export interface SettlementRow {
  itemId: string;
  /** The installment's name, as the seed stores it. */
  installment: string;
  unitCode: string;
  /** "YYYY-MM-DD". */
  dueDate: string;
  /** What the item still owes, the edited collection's own payment added back. */
  owed: Cents;
  paidNow: Cents;
  /** Paid less than it owes. */
  partial: boolean;
}

/** What the collection wizard shows beyond the contract. */
export interface CollectionSummary {
  /** The persons who still owe something, in unit order. */
  people: PersonRow[];
  /** What the chosen person owes in all, the edited collection's own payment added back: the most this collection may be. 0 for a person who owes nothing; null with none chosen. */
  owed: Cents | null;
  /** The items the amount pays, as it stands; none while it settles nothing. */
  settlement: SettlementRow[];
}

/** Every field of the form the person can change. */
const FIELDS: readonly (keyof CollectionForm)[] = [
  "personId",
  "accountId",
  "amount",
  "description",
];

/** What an edited collection's form holds as written: its description alone follows the settlement. */
const WRITTEN: readonly (keyof CollectionForm)[] = [
  "personId",
  "accountId",
  "amount",
];

/**
 * What step 2 is judged with in place of the description, which is step 3's:
 * the domain only asks that one is not blank, so any other text gives the
 * verdict the collection will have once it is written.
 */
const DESCRIPTION_ASIDE = "the description, step 3's";

/** What the wizard reads the form against. */
interface CollectionBooks {
  books: Books | null;
  /** Every item with what it still owes, the edited collection left out of what it has been paid. */
  balances: ItemBalance[];
  people: PersonRow[];
  liquidity: WizardChoice[];
  /** The collection the wizard rewrites; null for a new one. */
  editing: JournalEntry | null;
  /** Today, "YYYY-MM-DD": what the amount is prefilled with is due by it. */
  today: string;
}

/**
 * The Record owner collection wizard: step 1 "Choose an owner", step 2
 * "Amount and liquidity account", step 3 "Description". Choosing a person
 * fills the amount with what they owe on items due by today (or, with nothing
 * due yet, the remaining of their next item), and the description with the
 * installments the amount settles oldest first, until the person types either.
 *
 * Editing, the wizard starts at step 2 on the collection's person, who stays
 * put, and the collection's own payment is owed again. While the amount is
 * the collection's own, its lines are kept as written; once it changes, the
 * amount is settled oldest first and the description, unless typed during the
 * edit, follows the new settlement.
 *
 * After a refused save the wizard reads the books again through `latest`, so
 * what it says the person owes is what they owe now.
 */
export function createCollectionWizard(
  books: Books | null,
  clock: ClockPort,
  write: WriteEntry,
  editing: JournalEntry | null,
  latest: () => Books | null = (): Books | null => {
    return books;
  },
): WizardMachine<CollectionForm, CollectionSummary> {
  const today = todayOf(clock);
  let read = readOf(books, editing, today);

  const machine = createWizardMachine<CollectionForm, CollectionSummary>(
    {
      initial: editing === null ? emptyForm(books) : formOf(read, editing),
      firstStep: editing === null ? 1 : 2,
      stepCount: 3,
      choices: read.liquidity,
      derive: (form: CollectionForm): Derived => {
        return derive(read, form);
      },
      summarize: (form: CollectionForm): CollectionSummary => {
        return {
          people: read.people,
          owed: owedOf(read, form.personId),
          settlement: settlementRows(read, form),
        };
      },
      stepVerdict: (form: CollectionForm, step: number): Result => {
        return verdictAt(read, form, step);
      },
      editing: editing?.id ?? null,
    },
    write,
  );

  function edit(patch: Partial<CollectionForm>): void {
    const { personId, ...rest } = patch;
    const allowed = editing === null || personId === undefined ? patch : rest;

    machine.intents.edit(
      applied(read, machine.state$.getValue().form, allowed),
    );
  }

  async function save(): Promise<ResultOf<EntryAdded>> {
    const result = await machine.intents.save();

    if (!result.ok) {
      read = readOf(latest(), editing, today);
      // The definition reads `read`: an edit that changes nothing has the
      // machine derive its state again, over the books as they stand now.
      machine.intents.edit({});
    }

    return result;
  }

  return { ...machine, intents: { ...machine.intents, edit, save } };
}

/**
 * Whether the collection wizard can write the entry as it stands: its first
 * line the total debited on a liquidity account, then only credits on the
 * owners account, each paying an item of its own resident, all of one person.
 */
export function fitsCollection(entry: JournalEntry, books: Books): boolean {
  const [debit, ...credits] = entry.postings;

  if (debit === undefined || credits.length === 0) {
    return false;
  }

  const liquidity = liquidityChoices(books).some((choice) => {
    return choice.key === debit.accountId;
  });

  const total = credits.reduce((sum, posting) => {
    return addCents(sum, posting.credit);
  }, ZERO_CENTS);

  if (!liquidity || debit.credit !== 0 || debit.debit !== total) {
    return false;
  }

  const persons = new Set(
    credits.map((posting) => {
      return personPaidBy(books, posting);
    }),
  );

  return persons.size === 1 && !persons.has(null);
}

/** The books as the wizard reads them: every item's balance with the edited collection left out, the people who owe, and the liquidity accounts. */
function readOf(
  books: Books | null,
  editing: JournalEntry | null,
  today: string,
): CollectionBooks {
  const balances =
    books === null
      ? []
      : itemBalances(
          books.installmentItems,
          books.installments,
          books.entries.filter((entry) => {
            return entry.id !== editing?.id;
          }),
        );

  return {
    books,
    balances,
    people: books === null ? [] : peopleOf(books, balances),
    liquidity: books === null ? [] : liquidityChoices(books),
    editing,
    today,
  };
}

/** Step 1's grid: every person with an open item, by their first unit's code, then by name. */
function peopleOf(books: Books, balances: ItemBalance[]): PersonRow[] {
  const persons = new Map<string, OwnerParty[]>();

  for (const party of books.parties) {
    if (party.kind === "owner") {
      persons.set(party.personId, [
        ...(persons.get(party.personId) ?? []),
        party,
      ]);
    }
  }

  return [...persons.entries()]
    .filter(([personId]) => {
      return owedBy(personId, books.parties, balances).length > 0;
    })
    .map(([personId, residencies]) => {
      return personRow(personId, residencies, balances);
    })
    .sort((a, b) => {
      return (
        compareText(a.units[0] ?? "", b.units[0] ?? "") ||
        compareText(a.name, b.name)
      );
    });
}

function personRow(
  personId: string,
  residencies: OwnerParty[],
  balances: ItemBalance[],
): PersonRow {
  const sorted = [...residencies].sort((a, b) => {
    return compareText(a.unitCode, b.unitCode);
  });

  const residents = new Set(
    sorted.map((residency) => {
      return residency.id;
    }),
  );
  let total = ZERO_CENTS;
  let paid = ZERO_CENTS;

  for (const balance of balances) {
    if (residents.has(balance.item.residentId)) {
      total = addCents(total, balance.item.amount);
      paid = addCents(paid, balance.paid);
    }
  }

  return {
    personId,
    name: must(sorted[0], `a residency of ${personId}`).name,
    units: [
      ...new Set(
        sorted.map((residency) => {
          return residency.unitCode;
        }),
      ),
    ],
    total,
    paid,
    remaining: subtractCents(total, paid),
  };
}

/** What the person owes in all: the remaining of their open items; null for no person of the period. */
function owedOf(read: CollectionBooks, personId: string | null): Cents | null {
  if (residenciesOf(read, personId).length === 0) {
    return null;
  }

  return sumOf(openOf(read, personId));
}

/** The rules of one step: step 1 a person who owes; step 2 the account, the amount and the domain on the collection, its description aside; step 3 the whole verdict. */
function verdictAt(
  read: CollectionBooks,
  form: CollectionForm,
  step: number,
): Result {
  if (step === 1) {
    return read.people.some((row) => {
      return row.personId === form.personId;
    })
      ? ok()
      : rejected("no-owner");
  }

  return step === 2
    ? derive(read, { ...form, description: DESCRIPTION_ASIDE }).verdict
    : derive(read, form).verdict;
}

/** The form after the person's patch: the fields it names are theirs from now on; the amount follows the person, and the description the settlement, until they are. */
function applied(
  read: CollectionBooks,
  form: CollectionForm,
  patch: Partial<CollectionForm>,
): CollectionForm {
  const next: CollectionForm = {
    ...form,
    ...patch,
    edited: [
      ...new Set([
        ...form.edited,
        ...FIELDS.filter((field) => {
          return field in patch;
        }),
      ]),
    ],
  };

  const amounted: CollectionForm = {
    ...next,
    amount: next.edited.includes("amount")
      ? next.amount
      : prefilledAmount(read, next.personId),
  };

  return {
    ...amounted,
    description: amounted.edited.includes("description")
      ? amounted.description
      : describe(read, amounted),
  };
}

/** What the person owes on items due by today; with nothing due yet, the remaining of their next item; blank for one who owes nothing. */
function prefilledAmount(
  read: CollectionBooks,
  personId: string | null,
): string {
  const open = openOf(read, personId);
  const next = open[0];

  if (next === undefined) {
    return "";
  }

  const due = sumOf(
    open.filter((balance) => {
      return balance.installment.dueDate <= read.today;
    }),
  );

  return amountText(due > 0 ? due : next.remaining);
}

/** The generated description of what the form settles: the edited collection's own while its lines are kept; blank while it settles nothing. */
function describe(read: CollectionBooks, form: CollectionForm): string {
  const settled = settledBy(read, form);

  if (settled === null || !settled.ok) {
    return "";
  }

  if (keepsLines(read, form)) {
    return must(read.editing, "the edited collection").description;
  }

  const list = settled.value
    .map((settlement) => {
      const { installment } = balanceOf(read, settlement.item.id);

      return `${installment.name} (${dateText(installment.dueDate)})`;
    })
    .join(", ");

  return `Collection of installments from ${personName(read, form.personId)}: ${list}`;
}

function derive(read: CollectionBooks, form: CollectionForm): Derived {
  if (residenciesOf(read, form.personId).length === 0) {
    return refused("no-owner");
  }

  const account = read.liquidity.find((choice) => {
    return choice.key === form.accountId;
  });

  if (account === undefined) {
    return refused("no-liquidity-account");
  }

  const settled = settledBy(read, form);

  if (settled === null) {
    return refused("not-an-amount");
  }

  if (!settled.ok) {
    return refused(settled.reason);
  }

  // A person of the period: there are books.
  const books = must(read.books, "the books");
  const postings = collectionPostings(
    account.key,
    settled.value,
    books.accounts,
  );

  if (!postings.ok) {
    return refused(postings.reason);
  }

  const draft: EntryDraft = {
    kind: "collection",
    description: form.description,
    postings: postings.value,
  };

  const preview = postings.value.map((posting) => {
    return {
      path: previewPath(books, posting),
      debit: posting.debit,
      credit: posting.credit,
    };
  });

  return judged(preview, draft, contextOf(books, read.editing?.id ?? null));
}

/**
 * What the form's amount pays: the edited collection's own lines while the
 * amount is its own, else the amount settled oldest first over the person's
 * open items. Null for no amount; `over-owed` above what the person owes.
 */
function settledBy(
  read: CollectionBooks,
  form: CollectionForm,
): ResultOf<Settlement[]> | null {
  const amount = parseAmount(form.amount);

  if (amount === null || amount <= 0) {
    return null;
  }

  if (keepsLines(read, form)) {
    return accepted(keptSettlements(read));
  }

  return settleOldestFirst(amount, openOf(read, form.personId));
}

/** Whether the form keeps the edited collection's lines as written: its amount is the collection's own. */
function keepsLines(read: CollectionBooks, form: CollectionForm): boolean {
  return (
    read.editing !== null && parseAmount(form.amount) === debitOf(read.editing)
  );
}

/** The edited collection's credits as settlements, in their order. */
function keptSettlements(read: CollectionBooks): Settlement[] {
  const entry = must(read.editing, "the edited collection");

  return entry.postings.slice(1).map((posting) => {
    return {
      item: balanceOf(
        read,
        must(posting.installmentItemId, `an item of ${entry.id}`),
      ).item,
      amount: posting.credit,
    };
  });
}

/** The settlement table: one row per item the form pays; none while it pays nothing. */
function settlementRows(
  read: CollectionBooks,
  form: CollectionForm,
): SettlementRow[] {
  const settled = settledBy(read, form);

  if (settled === null || !settled.ok) {
    return [];
  }

  return settled.value.map((settlement) => {
    const balance = balanceOf(read, settlement.item.id);

    return {
      itemId: settlement.item.id,
      installment: balance.installment.name,
      unitCode: residencyOf(read, settlement.item.residentId).unitCode,
      dueDate: balance.installment.dueDate,
      owed: balance.remaining,
      paidNow: settlement.amount,
      partial: settlement.amount < balance.remaining,
    };
  });
}

/** The person's open items, oldest first; none for no person. */
function openOf(read: CollectionBooks, personId: string | null): ItemBalance[] {
  return personId === null || read.books === null
    ? []
    : owedBy(personId, read.books.parties, read.balances);
}

function residenciesOf(
  read: CollectionBooks,
  personId: string | null,
): OwnerParty[] {
  return (read.books?.parties ?? []).filter((party): party is OwnerParty => {
    return party.kind === "owner" && party.personId === personId;
  });
}

function residencyOf(read: CollectionBooks, residentId: string): OwnerParty {
  return must(
    (read.books?.parties ?? []).find((party): party is OwnerParty => {
      return party.kind === "owner" && party.id === residentId;
    }),
    `the resident ${residentId}`,
  );
}

/** The person's name: their first unit's residency's. */
function personName(read: CollectionBooks, personId: string | null): string {
  const [first] = residenciesOf(read, personId).sort((a, b) => {
    return compareText(a.unitCode, b.unitCode);
  });

  return must(first, `the person ${String(personId)}`).name;
}

function balanceOf(read: CollectionBooks, itemId: string): ItemBalance {
  return must(
    read.balances.find((balance) => {
      return balance.item.id === itemId;
    }),
    `the item ${itemId}`,
  );
}

/** The person an owners-account credit pays for: its item's resident's person; null for a line that pays no item of its own resident. */
function personPaidBy(books: Books, posting: Posting): string | null {
  const item = books.installmentItems.find((candidate) => {
    return candidate.id === posting.installmentItemId;
  });

  // The owners account is a control account: roleAccount finds regular ones only.
  const owners = books.accounts.find((account) => {
    return account.role === "owners";
  });

  if (
    item === undefined ||
    owners === undefined ||
    posting.accountId !== owners.id ||
    posting.debit !== 0 ||
    posting.counterpart?.id !== item.residentId
  ) {
    return null;
  }

  const residency = books.parties.find((party): party is OwnerParty => {
    return party.kind === "owner" && party.id === item.residentId;
  });

  return residency?.personId ?? null;
}

/** A new collection: no person yet, the bank-role account chosen. */
function emptyForm(books: Books | null): CollectionForm {
  return {
    personId: null,
    accountId: books === null ? null : (roleAccount(books, "bank")?.id ?? null),
    amount: "",
    description: "",
    edited: [],
  };
}

/** The form a collection was written from: its person, the account it debits, its amount, and its description. */
function formOf(read: CollectionBooks, entry: JournalEntry): CollectionForm {
  const books = must(read.books, "the books of an edited collection");

  if (!fitsCollection(entry, books)) {
    throw new Error(`the entry ${entry.id} is not a collection to edit here`);
  }

  const [debit, credit] = entry.postings;
  const residentId = must(credit?.counterpart, `a resident of ${entry.id}`).id;

  return {
    personId: residencyOf(read, residentId).personId,
    accountId: must(debit, `the debit of ${entry.id}`).accountId,
    amount: amountText(debitOf(entry)),
    description: entry.description,
    edited: [...WRITTEN],
  };
}

/** A collection's total: its first line's debit. */
function debitOf(entry: JournalEntry): Cents {
  return entry.postings[0]?.debit ?? ZERO_CENTS;
}

function sumOf(balances: ItemBalance[]): Cents {
  return balances.reduce((sum, balance) => {
    return addCents(sum, balance.remaining);
  }, ZERO_CENTS);
}

/** `2013-04-23` as `23/04/2013`. */
function dateText(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function compareText(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  return a > b ? 1 : 0;
}
