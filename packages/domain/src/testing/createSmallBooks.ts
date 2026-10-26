import type {
  Account,
  AccountNature,
  AccountRole,
  AccountType,
} from "../entities/account.ts";
import { cents } from "../entities/cents.ts";
import type {
  Counterpart,
  EntryKind,
  JournalEntry,
  Posting,
} from "../entities/journal.ts";
import type { Party } from "../entities/party.ts";
import type { LegacySeed } from "../simulators/seed/legacySeed.ts";

/** One period's books, small enough to work every figure out by hand. */
export interface SmallBooks {
  periodId: "p1";
  accounts: Account[];
  entries: JournalEntry[];
  parties: Party[];
}

/**
 * Cash and bank under Liquidità, funds, the suppliers, owners and roundings
 * control accounts, two budgeted cost leaves under Spese generali, individual
 * expenses and one revenue account; two suppliers, two owners holding three
 * residencies; nine entries, the last dated before the first.
 */
export function createSmallBooks(): SmallBooks {
  return {
    periodId: "p1",
    accounts: [
      createAccount({
        id: "la1",
        parentId: "la10",
        name: "Cassa",
        nature: "assets",
        type: "regular",
        role: "cash",
      }),
      createAccount({
        id: "la2",
        parentId: "la10",
        name: "Banca",
        nature: "assets",
        type: "regular",
        role: "bank",
      }),
      createAccount({
        id: "la3",
        name: "Fondi",
        nature: "liabilities",
        type: "regular",
      }),
      createAccount({
        id: "la4",
        name: "Fornitori",
        nature: "assetsOrLiabilities",
        type: "control",
        role: "suppliers",
      }),
      createAccount({
        id: "la5",
        name: "Condòmini",
        nature: "assetsOrLiabilities",
        type: "controlUnitResident",
        role: "owners",
      }),
      createAccount({
        id: "la6",
        name: "Arrotondamenti",
        nature: "assetsOrLiabilities",
        type: "controlUnitResident",
        role: "roundings",
      }),
      createAccount({
        id: "la10",
        name: "Liquidità",
        nature: "assets",
        type: "grouping",
      }),
      createAccount({
        id: "la20",
        name: "Spese generali",
        nature: "expenses",
        type: "grouping",
      }),
      createAccount({
        id: "la21",
        parentId: "la20",
        name: "Ascensore",
        nature: "expenses",
        type: "regular",
        budget: 100000,
      }),
      createAccount({
        id: "la22",
        parentId: "la20",
        name: "Pulizie",
        nature: "expenses",
        type: "regular",
        budget: 50000,
      }),
      createAccount({
        id: "la23",
        name: "Spese individuali",
        nature: "expenses",
        type: "controlUnitResident",
      }),
      createAccount({
        id: "la30",
        name: "Da condòmini",
        nature: "income",
        type: "regular",
      }),
    ],
    entries: [
      createEntry(1, "2013-01-10T10:00:00", "Fattura Alfa", "invoice", [
        createPosting("la21", 36018, 0),
        createPosting("la4", 0, 36018, supplier("md1")),
      ]),
      createEntry(2, "2013-01-15T10:00:00", "Fattura Beta", "invoice", [
        createPosting("la22", 20000, 0),
        createPosting("la4", 0, 20000, supplier("md2")),
      ]),
      createEntry(
        3,
        "2013-02-01T10:00:00",
        "Pagamento Beta",
        "invoicePayment",
        [
          createPosting("la4", 20000, 0, supplier("md2")),
          createPosting("la2", 0, 20000),
        ],
      ),
      createEntry(4, "2013-02-10T10:00:00", "Riparto", "budgetAllocation", [
        createPosting("la5", 60000, 0, owner("r1")),
        createPosting("la5", 10000, 0, owner("r2")),
        createPosting("la5", 30000, 0, owner("r3")),
        createPosting("la30", 0, 100000),
      ]),
      createEntry(5, "2013-03-01T10:00:00", "Incasso Bianchi", "collection", [
        createPosting("la1", 35000, 0),
        createPosting("la5", 0, 35000, owner("r3")),
      ]),
      createEntry(6, "2013-03-05T10:00:00", "Arrotondamento", "generic", [
        createPosting("la6", 1, 0, owner("r1")),
        createPosting("la1", 0, 1),
      ]),
      createEntry(
        7,
        "2013-03-06T10:00:00",
        "Spesa individuale",
        "individualExpense",
        [
          createPosting("la23", 1500, 0, owner("r2")),
          createPosting("la5", 0, 1500, owner("r2")),
        ],
      ),
      createEntry(8, "2013-03-07T10:00:00", "Movimento nullo", "generic", [
        createPosting("la1", 0, 0),
        createPosting("la2", 0, 0),
      ]),
      createEntry(9, "2013-01-05T10:00:00", "Fuori ordine", "generic", [
        createPosting("la1", 100, 0),
        createPosting("la30", 0, 100),
      ]),
    ],
    parties: [
      { kind: "supplier", id: "md1", name: "Alfa s.n.c." },
      { kind: "supplier", id: "md2", name: "Beta S.p.A." },
      {
        kind: "owner",
        id: "r1",
        personId: "md10",
        name: "Rossi Mario",
        unitCode: "A01",
        unitId: "uA01",
        startingBalance: cents(0),
        role: "PR",
        share: null,
        restriction: null,
        ownRestriction: null,
      },
      {
        kind: "owner",
        id: "r2",
        personId: "md10",
        name: "Rossi Mario",
        unitCode: "A02",
        unitId: "uA02",
        startingBalance: cents(0),
        role: "PR",
        share: null,
        restriction: null,
        ownRestriction: null,
      },
      {
        kind: "owner",
        id: "r3",
        personId: "md11",
        name: "Bianchi Anna",
        unitCode: "B01",
        unitId: "uB01",
        startingBalance: cents(0),
        role: "PR",
        share: null,
        restriction: null,
        ownRestriction: null,
      },
    ],
  };
}

/** The small books as a seed: one building, Pozzetto, whose one period, 2013, holds them. */
export function createSmallSeed(): LegacySeed {
  const books = createSmallBooks();

  return {
    buildings: [
      {
        id: "c1",
        name: "Pozzetto",
        periods: [
          {
            id: books.periodId,
            name: "2013",
            type: "ordinary",
            start: "2013-01-01",
            end: "2013-12-31",
            closed: false,
          },
        ],
      },
    ],
    accounts: books.accounts,
    entries: books.entries,
    parties: [{ periodId: books.periodId, parties: books.parties }],
    invoices: [],
    withholdingTaxes: [],
    installments: [],
    installmentItems: [],
    units: ["A01", "A02", "B01"].map((code) => {
      return {
        id: `u${code}`,
        periodId: books.periodId,
        code,
        groupId: null,
        restriction: null,
      };
    }),
    unitGroups: [],
    tables: [],
    coefficients: [],
  };
}

/** What differs between the fixture's accounts; the order follows the id's number. */
interface AccountParts {
  id: string;
  parentId?: string;
  name: string;
  nature: AccountNature;
  type: AccountType;
  role?: AccountRole;
  budget?: number;
}

function createAccount(parts: AccountParts): Account {
  return {
    id: parts.id,
    periodId: "p1",
    parentId: parts.parentId ?? null,
    name: parts.name,
    order: Number(parts.id.slice(2)),
    nature: parts.nature,
    type: parts.type,
    role: parts.role ?? null,
    budget: parts.budget === undefined ? null : cents(parts.budget),
    abbreviation: null,
    links: [],
  };
}

function createEntry(
  number: number,
  at: string,
  description: string,
  kind: EntryKind,
  postings: Posting[],
): JournalEntry {
  return {
    id: `e${number}`,
    periodId: "p1",
    number,
    at,
    kind,
    description,
    postings,
    invoiceId: null,
  };
}

function createPosting(
  accountId: string,
  debit: number,
  credit: number,
  counterpart?: Counterpart,
): Posting {
  return {
    accountId,
    debit: cents(debit),
    credit: cents(credit),
    counterpart: counterpart ?? null,
  };
}

function supplier(id: string): Counterpart {
  return { kind: "supplier", id };
}

function owner(id: string): Counterpart {
  return { kind: "owner", id };
}
