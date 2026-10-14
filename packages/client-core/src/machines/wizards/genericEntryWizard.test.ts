import { afterEach, describe, expect, it } from "vitest";

import {
  accepted,
  buildAccountTree,
  cents,
  type EntryAdded,
  type EntryDraft,
  type JournalEntry,
  type ResultOf,
} from "@cl/domain";
import { createSmallBooks } from "@cl/domain/testing/createSmallBooks.ts";

import type { Books } from "#/presenters/booksPresenter.ts";
import { createBooks } from "#/testing/createBooks.ts";

import {
  createGenericEntryWizard,
  type GenericEntryForm,
  type GenericEntrySummary,
  postingOf,
} from "./genericEntryWizard.ts";
import type { WizardMachine } from "./wizard.ts";

afterEach(() => {
  for (const machine of created.splice(0)) {
    machine.dispose();
  }
});

describe("the generic-entry wizard", () => {
  it("starts with one empty line and no description: the description is the first thing refused", () => {
    const { machine } = createWizard();

    expect(machine.state$.getValue()).toMatchObject({
      form: {
        description: "",
        lines: [{ scopeKey: null, debit: "", credit: "" }],
      },
      verdict: { ok: false, reason: "blank-description" },
      summary: { balances: [0], debit: 0, credit: 0, balance: 0 },
      preview: [],
    });
  });

  it("offers every row a posting can land on, a control account's per party", () => {
    const { machine } = createWizard();

    expect(
      machine.state$.getValue().choices.map((choice) => {
        return choice.key;
      }),
    ).toEqual([
      "la1",
      "la2",
      "la4@assets/md2",
      "la5@assets/md10/r1",
      "la5@assets/md10/r2",
      "la6@assets/md10/r1",
      "la3",
      "la4@liabilities/md1",
      "la5@liabilities/md11/r3",
      "la21",
      "la22",
      "la23/md10/r2",
      "la30",
    ]);
  });

  it("with a description, a line with no row is no target", () => {
    const { machine } = createWizard();

    machine.intents.edit({ description: "Giroconto" });

    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "no-target",
    });
  });

  it("two balanced lines with a description accept, previewed by path, and save a generic entry", async () => {
    const { machine, calls } = createWizard();

    machine.intents.edit({
      description: "Giroconto",
      lines: [
        { scopeKey: "la21", debit: "10", credit: "" },
        { scopeKey: "la1", debit: "", credit: "10" },
      ],
    });

    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: true },
      summary: { balances: [1000, 0], debit: 1000, credit: 1000, balance: 0 },
    });
    expect(machine.state$.getValue().preview).toEqual([
      { path: "Costs › Spese generali › Ascensore", debit: 1000, credit: 0 },
      {
        path: "Patrimonial › (Assets) › Liquidità › Cassa",
        debit: 0,
        credit: 1000,
      },
    ]);
    expect(await machine.intents.save()).toEqual({
      ok: true,
      value: { id: "new1" },
    });
    expect(calls()).toEqual([
      {
        kind: "generic",
        description: "Giroconto",
        postings: [
          { accountId: "la21", debit: 1000, credit: 0, counterpart: null },
          { accountId: "la1", debit: 0, credit: 1000, counterpart: null },
        ],
      },
    ]);
  });

  it("a line on a supplier's row names the supplier", async () => {
    const { machine, calls } = createWizard();

    machine.intents.edit({
      description: "Storno Alfa",
      lines: [
        { scopeKey: "la4@liabilities/md1", debit: "5", credit: "" },
        { scopeKey: "la21", debit: "", credit: "5" },
      ],
    });

    expect(machine.state$.getValue().preview[0]?.path).toBe(
      "Patrimonial › (Liabilities) › Fornitori › Alfa s.n.c.",
    );
    await machine.intents.save();
    expect(calls()[0]?.postings).toEqual([
      {
        accountId: "la4",
        debit: 500,
        credit: 0,
        counterpart: { kind: "supplier", id: "md1" },
      },
      { accountId: "la21", debit: 0, credit: 500, counterpart: null },
    ]);
  });

  it("a line on a residency's row names the owner", async () => {
    const { machine, calls } = createWizard();

    machine.intents.edit({
      description: "Addebito Rossi",
      lines: [
        { scopeKey: "la5@assets/md10/r1", debit: "7.50", credit: "" },
        { scopeKey: "la30", debit: "", credit: "7.50" },
      ],
    });

    await machine.intents.save();
    expect(calls()[0]?.postings[0]).toEqual({
      accountId: "la5",
      debit: 750,
      credit: 0,
      counterpart: { kind: "owner", id: "r1" },
    });
  });

  it("a line with both a debit and a credit is refused by the domain as both sides", () => {
    const { machine } = createWizard();

    machine.intents.edit({
      description: "Giroconto",
      lines: [{ scopeKey: "la21", debit: "10", credit: "5" }],
    });

    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: false, reason: "both-sides" },
      preview: [
        {
          path: "Costs › Spese generali › Ascensore",
          debit: 1000,
          credit: 500,
        },
      ],
    });
  });

  it("an Italian comma is not a decimal point: 1,23 is not an amount, never 123", () => {
    const { machine } = createWizard();

    machine.intents.edit({
      description: "Giroconto",
      lines: [
        { scopeKey: "la21", debit: "1,23", credit: "" },
        { scopeKey: "la1", debit: "", credit: "123" },
      ],
    });

    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: false, reason: "not-an-amount" },
      summary: { balances: [0, -12300], debit: 0, credit: 12300 },
      preview: [],
    });
  });

  it("an empty text is zero: one debit alone is unbalanced", () => {
    const { machine } = createWizard();

    machine.intents.edit({
      description: "Giroconto",
      lines: [{ scopeKey: "la21", debit: "10", credit: "" }],
    });

    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: false, reason: "unbalanced" },
      summary: { balances: [1000], debit: 1000, credit: 0, balance: 1000 },
    });
  });

  it("the balances run line by line and the totals sum every line", () => {
    const { machine } = createWizard();

    machine.intents.edit({
      lines: [
        { scopeKey: "la21", debit: "10", credit: "" },
        { scopeKey: "la22", debit: "5.25", credit: "" },
        { scopeKey: "la2", debit: "", credit: "20" },
      ],
    });

    expect(machine.state$.getValue().summary).toEqual({
      balances: [1000, 1525, -475],
      debit: 1525,
      credit: 2000,
      balance: -475,
    });
  });

  it("the checks run in form order: a line's text is judged before a later line's row", () => {
    const { machine } = createWizard();

    machine.intents.edit({
      description: "Giroconto",
      lines: [
        { scopeKey: "la21", debit: "abc", credit: "" },
        { scopeKey: null, debit: "", credit: "10" },
      ],
    });

    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "not-an-amount",
    });
  });

  it("a blank description is refused before the lines, and the preview still shows them", () => {
    const { machine } = createWizard();

    machine.intents.edit({
      lines: [
        { scopeKey: "la21", debit: "10", credit: "" },
        { scopeKey: "la1", debit: "", credit: "10" },
      ],
    });

    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: false, reason: "blank-description" },
      preview: [{ debit: 1000 }, { credit: 1000 }],
    });
  });

  it("removing every line leaves one empty line", () => {
    const { machine } = createWizard();

    machine.intents.edit({
      lines: [{ scopeKey: "la21", debit: "10", credit: "" }],
    });
    machine.intents.edit({ lines: [] });

    expect(machine.state$.getValue().form.lines).toEqual([
      { scopeKey: null, debit: "", credit: "" },
    ]);
  });

  it("with no books at all: nothing to choose, so no line has a row", () => {
    const { machine } = createWizard(null);

    machine.intents.edit({
      description: "Giroconto",
      lines: [{ scopeKey: "la21", debit: "10", credit: "" }],
    });

    expect(machine.state$.getValue()).toMatchObject({
      choices: [],
      verdict: { ok: false, reason: "no-target" },
      preview: [],
    });
  });
});

describe("postingOf", () => {
  it("a plain leaf's row is its account with no counterpart", () => {
    expect(postingOf(createBooks(), "la22", cents(100), cents(0))).toEqual({
      accountId: "la22",
      debit: 100,
      credit: 0,
      counterpart: null,
    });
  });

  it("the rows of postings that name no party give no counterpart", () => {
    const books = createBooksWithUnnamedParties();

    expect(postingOf(books, "la4@assets/none", cents(0), cents(300))).toEqual({
      accountId: "la4",
      debit: 0,
      credit: 300,
      counterpart: null,
    });
    expect(
      postingOf(books, "la5@assets/none/none", cents(200), cents(0)),
    ).toEqual({ accountId: "la5", debit: 200, credit: 0, counterpart: null });
  });

  it("a key the tree has not, or a row that owns no postings, throws naming the key", () => {
    expect(() => {
      return postingOf(createBooks(), "la99", cents(1), cents(0));
    }).toThrow("the row la99");
    expect(() => {
      return postingOf(createBooks(), "la20", cents(1), cents(0));
    }).toThrow("the row la20");
  });
});

interface CreatedWizard {
  machine: WizardMachine<GenericEntryForm, GenericEntrySummary>;
  calls: () => EntryDraft[];
}

function createWizard(books: Books | null = createBooks()): CreatedWizard {
  const drafts: EntryDraft[] = [];

  function addEntry(draft: EntryDraft): Promise<ResultOf<EntryAdded>> {
    drafts.push(draft);

    return Promise.resolve(accepted({ id: "new1" }));
  }

  const machine = createGenericEntryWizard(books, addEntry);

  created.push(machine);

  return {
    machine,
    calls: (): EntryDraft[] => {
      return drafts;
    },
  };
}

/** The small books with one entry on the suppliers' and the owners' accounts that names no party: rows of postings without one. */
function createBooksWithUnnamedParties(): Books {
  const small = createSmallBooks();
  const entries: JournalEntry[] = [
    ...small.entries,
    {
      id: "e10",
      periodId: "p1",
      number: 10,
      at: "2013-04-01T10:00:00",
      kind: "generic",
      description: "Senza controparte",
      postings: [
        {
          accountId: "la4",
          debit: cents(300),
          credit: cents(0),
          counterpart: null,
        },
        {
          accountId: "la5",
          debit: cents(200),
          credit: cents(0),
          counterpart: null,
        },
        {
          accountId: "la1",
          debit: cents(0),
          credit: cents(500),
          counterpart: null,
        },
      ],
    },
  ];

  return {
    ...createBooks(),
    tree: buildAccountTree(small.accounts, entries, small.parties),
    entries,
  };
}

const created: WizardMachine<GenericEntryForm, GenericEntrySummary>[] = [];
