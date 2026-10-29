import { describe, expect, it } from "vitest";

import {
  accepted,
  buildAccountTree,
  cents,
  type EntryAdded,
  type EntryDraft,
  type EntryKind,
  type JournalEntry,
  type Language,
  type ResultOf,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";
import { createSmallBooks } from "@cl/domain/testing/createSmallBooks.ts";

import type { Books } from "#/presenters/booksPresenter.ts";
import { createAppHarness } from "#/testing/appHarness.ts";
import { createAmountTexts } from "#/testing/createAmountTexts.ts";
import { createBooks } from "#/testing/createBooks.ts";
import { disposeAfterEach } from "#/testing/disposeAfterEach.ts";
import { currentBooks, currentEntry } from "#/testing/harnessBooks.ts";

import {
  createGenericEntryWizard,
  type GenericEntryForm,
  type GenericEntrySummary,
  postingOf,
} from "./genericEntryWizard.ts";
import type { WizardMachine } from "./wizard.ts";

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

  it("a control account's rows of postings that name no party are not offered: a line there could never be saved", () => {
    const { machine } = createWizard(createBooksWithUnnamedParties());
    const keys = machine.state$.getValue().choices.map((choice) => {
      return choice.key;
    });

    expect(keys).not.toContain("la4@assets/none");
    expect(keys).not.toContain("la5@assets/none/none");
    expect(keys).toContain("la4@liabilities/md1");
    expect(keys).toContain("la5@assets/md10/r1");
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

describe("the generic-entry wizard on another kind", () => {
  it("writes the kind it is given", async () => {
    const { machine, calls } = createWizard(
      createBooks(),
      null,
      "withholdingPayment",
    );

    machine.intents.edit({
      description: "Ritenute",
      lines: [
        { scopeKey: "la21", debit: "5", credit: "" },
        { scopeKey: "la2", debit: "", credit: "5" },
      ],
    });
    await machine.intents.save();

    expect(calls()[0]?.kind).toBe("withholdingPayment");
  });
});

describe("editing an entry line by line", () => {
  it("a seeded generic entry opens on its description and its lines by row, a side of zero left blank", () => {
    const harness = createAppHarness();
    const machine = harness.app.machines.createGenericEntryWizard("tx2");

    track(machine);

    expect(machine.state$.getValue()).toMatchObject({
      editing: "tx2",
      form: {
        description: currentEntry(harness, "tx2").description,
        lines: [
          { scopeKey: "la30", debit: "500.00", credit: "" },
          { scopeKey: "la14", debit: "", credit: "500.00" },
        ],
      },
      verdict: { ok: true },
      stepVerdict: { ok: true },
    });
  });

  it("saving it unchanged rewrites it in place: its id, its number and its stamp stay", async () => {
    const harness = createAppHarness();
    const before = currentBooks(harness).entries.length;
    const machine = harness.app.machines.createGenericEntryWizard("tx2");

    track(machine);

    expect(await machine.intents.save()).toEqual({
      ok: true,
      value: { id: "tx2" },
    });
    expect(currentBooks(harness).entries).toHaveLength(before);
    expect(currentEntry(harness, "tx2")).toMatchObject({
      number: 2,
      at: "2011-01-01T16:05:19",
      kind: "generic",
    });
  });

  it("an opening entry edited line by line keeps its kind, and is judged with itself left out", async () => {
    const harness = createAppHarness();
    const editing = harness.app.machines.createGenericEntryWizard(
      "tx1",
      "openingBalances",
    );

    const fresh = harness.app.machines.createGenericEntryWizard(
      null,
      "openingBalances",
    );

    track(editing);
    track(fresh);
    fresh.intents.edit(editing.state$.getValue().form);

    expect(editing.state$.getValue().verdict).toEqual({ ok: true });
    expect(editing.state$.getValue().form.lines).toHaveLength(18);
    expect(editing.state$.getValue().form.lines[0]).toEqual({
      scopeKey: "la2",
      debit: "135.52",
      credit: "",
    });
    expect(fresh.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "opening-exists",
    });
    expect(await editing.intents.save()).toEqual({
      ok: true,
      value: { id: "tx1" },
    });
    expect(currentEntry(harness, "tx1")).toMatchObject({
      number: 1,
      kind: "openingBalances",
    });
  });

  it("an entry of another kind edited with no kind named keeps its own", async () => {
    const harness = createAppHarness();
    const machine = harness.app.machines.createGenericEntryWizard("tx1");

    track(machine);

    expect(machine.state$.getValue().verdict).toEqual({ ok: true });
    expect(await machine.intents.save()).toEqual({
      ok: true,
      value: { id: "tx1" },
    });
    expect(currentEntry(harness, "tx1").kind).toBe("openingBalances");
  });

  it("a line on a row no new posting may join opens with no row chosen", () => {
    const books = createBooksWithUnnamedParties();
    const { machine } = createWizard(
      books,
      must(
        books.entries.find((entry) => {
          return entry.id === "e10";
        }),
        "the entry e10",
      ),
    );

    expect(machine.state$.getValue()).toMatchObject({
      editing: "e10",
      form: {
        lines: [
          { scopeKey: null, debit: "3.00", credit: "" },
          { scopeKey: null, debit: "2.00", credit: "" },
          { scopeKey: "la1", debit: "", credit: "5.00" },
        ],
      },
      verdict: { ok: false, reason: "no-target" },
    });
  });

  it("with no books an entry opens with no row chosen on any line", () => {
    const books = createBooks();
    const { machine } = createWizard(
      null,
      must(books.entries.at(-1), "the last entry"),
    );

    expect(machine.state$.getValue().form.lines).toEqual([
      { scopeKey: null, debit: "1.00", credit: "" },
      { scopeKey: null, debit: "", credit: "1.00" },
    ]);
  });
});

describe("amounts in the session's language", () => {
  it("an Italian session reads 1.234,56 as 123456 cents, and an English one refuses it", async () => {
    const italian = await createEditIn("it", "tx2");
    const english = await createEditIn("en", "tx2");

    for (const machine of [italian, english]) {
      machine.intents.edit({ lines: linesOf("1.234,56") });
    }

    expect(italian.state$.getValue()).toMatchObject({
      verdict: { ok: true },
      summary: { debit: 123456, credit: 123456 },
    });
    expect(english.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "not-an-amount",
    });
  });

  it("an entry opened in Italian has its amounts written with a decimal comma and no groups", async () => {
    const machine = await createEditIn("it", "tx2");

    expect(machine.state$.getValue().form.lines).toEqual(linesOf("500,00"));
    expect(machine.state$.getValue().verdict).toEqual({ ok: true });
  });

  it("a change of language keeps the typed text and judges it again at once", async () => {
    const harness = createAppHarness();
    const machine = harness.app.machines.createGenericEntryWizard("tx2");

    track(machine);
    machine.intents.edit({ lines: linesOf("1,234.56") });

    expect(machine.state$.getValue().summary.debit).toBe(123456);

    await harness.app.presenters.session.setLanguage("it");

    expect(machine.state$.getValue()).toMatchObject({
      form: { lines: linesOf("1,234.56") },
      verdict: { ok: false, reason: "not-an-amount" },
      summary: { debit: 0 },
    });

    await harness.app.presenters.session.setLanguage("en");

    expect(machine.state$.getValue().verdict).toEqual({ ok: true });
  });
});

/** The wizard editing one of p1's entries, in a session in the language. */
async function createEditIn(
  language: Language,
  id: string,
): Promise<WizardMachine<GenericEntryForm, GenericEntrySummary>> {
  const harness = createAppHarness();

  await harness.app.presenters.session.setLanguage(language);

  const machine = harness.app.machines.createGenericEntryWizard(id);

  track(machine);

  return machine;
}

/** tx2's two lines, the same amount on each side. */
function linesOf(amount: string): GenericEntryForm["lines"] {
  return [
    { scopeKey: "la30", debit: amount, credit: "" },
    { scopeKey: "la14", debit: "", credit: amount },
  ];
}

interface CreatedWizard {
  machine: WizardMachine<GenericEntryForm, GenericEntrySummary>;
  calls: () => EntryDraft[];
}

function createWizard(
  books: Books | null = createBooks(),
  editing: JournalEntry | null = null,
  kind?: EntryKind,
): CreatedWizard {
  const drafts: EntryDraft[] = [];

  function addEntry(draft: EntryDraft): Promise<ResultOf<EntryAdded>> {
    drafts.push(draft);

    return Promise.resolve(accepted({ id: "new1" }));
  }

  const machine = createGenericEntryWizard(
    createAmountTexts(),
    books,
    addEntry,
    editing,
    kind,
  );

  track(machine);

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
      invoiceId: null,
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

const track = disposeAfterEach();
