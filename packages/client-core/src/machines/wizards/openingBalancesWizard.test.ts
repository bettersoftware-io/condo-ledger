import { describe, expect, it } from "vitest";

import {
  accepted,
  cents,
  type EntryAdded,
  type EntryDraft,
  type JournalEntry,
  type OwnerParty,
  PATH_SEPARATOR,
  type Posting,
  type ResultOf,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";
import { createSmallBooks } from "@cl/domain/testing/createSmallBooks.ts";

import { amountText } from "#/amounts.ts";
import type { Books } from "#/presenters/booksPresenter.ts";
import { type AppHarness, createAppHarness } from "#/testing/appHarness.ts";
import { createAmountTexts } from "#/testing/createAmountTexts.ts";
import { createBooks } from "#/testing/createBooks.ts";
import { disposeAfterEach } from "#/testing/disposeAfterEach.ts";
import { currentBooks, currentEntry } from "#/testing/harnessBooks.ts";

import {
  createOpeningBalancesWizard,
  fitsOpening,
  type OpeningAmount,
  type OpeningForm,
  type OpeningRow,
  type OpeningRowView,
  type OpeningSummary,
  openingRows,
} from "./openingBalancesWizard.ts";
import type { WizardMachine } from "./wizard.ts";

describe("openingRows", () => {
  it("lists the regular assets and liabilities leaves, then one row per resident under the owners account", async () => {
    const books = currentBooks(await createHarnessWithoutOpening());
    const rows = openingRows(books);
    const owners = ownersOf(books);

    expect(
      rows
        .filter((row) => {
          return row.counterpart === null;
        })
        .map((row) => {
          return row.key;
        }),
    ).toEqual([
      "la154",
      "la156",
      "la162",
      "la163",
      "la164",
      "la165",
      "la166",
      "la167",
      "la168",
      "la169",
    ]);
    expect(owners).toHaveLength(27);
    expect(rows.slice(-27)).toEqual(
      owners.map((owner): OpeningRow => {
        return {
          key: `la158/${owner.id}`,
          label: [ownersName(books), owner.name, owner.unitCode].join(
            PATH_SEPARATOR,
          ),
          accountId: "la158",
          counterpart: { kind: "owner", id: owner.id },
        };
      }),
    );
  });

  it("labels a leaf by its path and keys it by its account", async () => {
    const books = currentBooks(await createHarnessWithoutOpening());
    const bank = rowOf(openingRows(books), "la156");

    expect(bank.accountId).toBe("la156");
    expect(bank.label.endsWith(accountName(books, "la156"))).toBe(true);
    expect(bank.label.split(PATH_SEPARATOR).length).toBeGreaterThan(2);
  });

  it("leaves out the suppliers and the roundings accounts, even a regular one", () => {
    const accounts = createSmallBooks().accounts.map((account) => {
      return account.id === "la3"
        ? { ...account, role: "roundings" as const }
        : account;
    });

    expect(
      openingRows(createBooks(accounts)).map((row) => {
        return row.key;
      }),
    ).toEqual(["la1", "la2", "la5/r1", "la5/r2", "la5/r3"]);
  });

  it("has no resident rows in a period with no owners account", () => {
    const accounts = createSmallBooks().accounts.map((account) => {
      return account.role === "owners" ? { ...account, role: null } : account;
    });

    expect(
      openingRows(createBooks(accounts)).map((row) => {
        return row.key;
      }),
    ).toEqual(["la1", "la2", "la3"]);
  });
});

describe("the Opening balances wizard", () => {
  it("starts on its one step, described Opening balances, each resident prefilled from the starting balance", async () => {
    const harness = await createHarnessWithoutOpening();
    const books = currentBooks(harness);
    const { machine } = createWizard(books);
    const state = machine.state$.getValue();

    expect(state).toMatchObject({
      step: 1,
      stepCount: 1,
      editing: null,
      form: {
        description: "Opening balances",
        search: "",
        onlyWithAmount: false,
      },
    });

    for (const owner of ownersOf(books)) {
      expect(viewOf(state.summary, `la158/${owner.id}`)).toEqual(
        prefilledView(books, owner),
      );
    }

    expect(viewOf(state.summary, "la156")).toMatchObject({
      debit: "",
      credit: "",
    });
  });

  it("prefills a debtor on the debit side and a creditor on the credit side", async () => {
    const { machine } = createWizard(
      currentBooks(await createHarnessWithoutOpening()),
    );
    const { summary } = machine.state$.getValue();

    expect(viewOf(summary, "la158/r165")).toMatchObject({
      debit: "3528.42",
      credit: "",
    });
    expect(viewOf(summary, "la158/r162")).toMatchObject({
      debit: "",
      credit: "860.65",
    });
  });

  it("the balance is minus the bank's 6,250.99 until the bank gets it, then zero, and the entry balances", async () => {
    const { machine } = createWizard(
      currentBooks(await createHarnessWithoutOpening()),
    );

    expect(machine.state$.getValue()).toMatchObject({
      summary: { balance: -625099, unreadableRow: null },
      verdict: { ok: false, reason: "unbalanced" },
      stepVerdict: { ok: false, reason: "unbalanced" },
    });

    editAmount(machine, "la156", { debit: "6,250.99", credit: "" });

    expect(machine.state$.getValue()).toMatchObject({
      summary: { balance: 0 },
      verdict: { ok: true },
      stepVerdict: { ok: true },
    });
  });

  it("a row of 0 or 0.00 writes nothing; a row with no amount writes nothing", async () => {
    const harness = await createHarnessWithoutOpening();
    const { machine, calls } = createWizard(currentBooks(harness));

    editAmount(machine, "la156", { debit: "6,250.99", credit: "" });
    editAmount(machine, "la154", { debit: "0", credit: "" });
    editAmount(machine, "la162", { debit: "", credit: "0.00" });

    expect(await machine.intents.save()).toEqual({ ok: true, value: SAVED });

    const draft = must(calls()[0], "the draft");
    const accounts = draft.postings.map((posting) => {
      return posting.accountId;
    });

    expect(draft).toMatchObject({
      kind: "openingBalances",
      description: "Opening balances",
    });
    expect(draft.postings).toHaveLength(20);
    expect(accounts).not.toContain("la154");
    expect(accounts).not.toContain("la162");
    expect(draft.postings[0]).toEqual({
      accountId: "la156",
      debit: cents(625099),
      credit: cents(0),
      counterpart: null,
    });
    expect(
      draft.postings.find((posting) => {
        return posting.counterpart?.id === "r162";
      }),
    ).toEqual({
      accountId: "la158",
      debit: cents(0),
      credit: cents(86065),
      counterpart: { kind: "owner", id: "r162" },
    });
  });

  it("previews each written line on its row's label", async () => {
    const books = currentBooks(await createHarnessWithoutOpening());
    const { machine } = createWizard(books);

    editAmount(machine, "la156", { debit: "6,250.99", credit: "" });

    expect(machine.state$.getValue().preview[0]).toEqual({
      path: rowOf(openingRows(books), "la156").label,
      debit: cents(625099),
      credit: cents(0),
    });
  });

  it.each([
    ["-50", ""],
    ["", "-50"],
    ["x", ""],
    ["50,5", ""],
  ])(
    "a Debit of %j and a Credit of %j are not an amount, and the summary names the row",
    async (debit, credit) => {
      const books = currentBooks(await createHarnessWithoutOpening());
      const { machine, calls } = createWizard(books);

      editAmount(machine, "la156", { debit: "6,250.99", credit: "" });
      editAmount(machine, "la154", { debit, credit });

      expect(machine.state$.getValue()).toMatchObject({
        verdict: { ok: false, reason: "not-an-amount" },
        stepVerdict: { ok: false, reason: "not-an-amount" },
        summary: {
          balance: 0,
          unreadableRow: rowOf(openingRows(books), "la154").label,
        },
      });
      expect(await machine.intents.save()).toEqual({
        ok: false,
        reason: "not-an-amount",
      });
      expect(calls()).toEqual([]);
    },
  );

  it("names the first row that does not read", async () => {
    const books = currentBooks(await createHarnessWithoutOpening());
    const { machine } = createWizard(books);

    editAmount(machine, "la162", { debit: "x", credit: "" });
    editAmount(machine, "la154", { debit: "y", credit: "" });

    expect(machine.state$.getValue().summary.unreadableRow).toBe(
      rowOf(openingRows(books), "la154").label,
    );
  });

  it("a blank description is answered before an amount that does not read", async () => {
    const { machine } = createWizard(
      currentBooks(await createHarnessWithoutOpening()),
    );

    editAmount(machine, "la154", { debit: "x", credit: "" });
    machine.intents.edit({ description: " " });

    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "blank-description",
    });
  });

  it("search narrows the rows to those whose label holds it, whatever the case", async () => {
    const books = currentBooks(await createHarnessWithoutOpening());
    const { machine } = createWizard(books);
    const owner = must(ownersOf(books)[3], "a resident");

    machine.intents.edit({ search: ` ${owner.unitCode.toLowerCase()} ` });

    const { rows } = machine.state$.getValue().summary;

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(openingRows(books).length);
    expect(
      rows.map((row) => {
        return row.key;
      }),
    ).toContain(`la158/${owner.id}`);

    for (const row of rows) {
      expect(row.label.toLowerCase()).toContain(owner.unitCode.toLowerCase());
    }
  });

  it("Show only rows with an amount keeps the rows with a nonzero amount, or one that does not read", async () => {
    const books = currentBooks(await createHarnessWithoutOpening());
    const { machine } = createWizard(books);
    const debtors = ownersOf(books)
      .filter((owner) => {
        return owner.startingBalance !== 0;
      })
      .map((owner) => {
        return `la158/${owner.id}`;
      });

    editAmount(machine, "la156", { debit: "6,250.99", credit: "" });
    editAmount(machine, "la154", { debit: "0.00", credit: "" });
    editAmount(machine, "la162", { debit: "", credit: "x" });
    machine.intents.edit({ onlyWithAmount: true });

    expect(
      machine.state$.getValue().summary.rows.map((row) => {
        return row.key;
      }),
    ).toEqual(["la156", "la162", ...debtors]);
    expect(debtors).toHaveLength(19);
  });

  it("a save writes kind openingBalances, and the menu item then opens it as an edit", async () => {
    const harness = await createHarnessWithoutOpening();
    const dialog = harness.app.machines.createJournalDialog();
    const machine = harness.app.machines.createOpeningBalancesWizard(null);

    track(machine);
    editAmount(machine, "la156", { debit: "6,250.99", credit: "" });

    const saved = await machine.intents.save();

    if (!saved.ok) {
      throw new Error(`the opening was refused: ${saved.reason}`);
    }

    expect(currentEntry(harness, saved.value.id).kind).toBe("openingBalances");

    dialog.intents.openWizard("openingBalances");

    expect(dialog.state$.getValue()).toEqual({
      open: {
        kind: "wizard",
        wizard: "openingBalances",
        editing: saved.value.id,
      },
    });
    dialog.dispose();
  });

  it("with the opening deleted, the menu item opens a new one", async () => {
    const harness = await createHarnessWithoutOpening();
    const dialog = harness.app.machines.createJournalDialog();

    dialog.intents.openWizard("openingBalances");

    expect(dialog.state$.getValue()).toEqual({
      open: { kind: "wizard", wizard: "openingBalances", editing: null },
    });
    dialog.dispose();
  });

  it("editing the seeded opening shows its own lines, not the prefill, and saves over it", async () => {
    const harness = createP36Harness();
    const books = currentBooks(harness);
    const entry = currentEntry(harness, "tx100");
    const machine = harness.app.machines.createOpeningBalancesWizard("tx100");

    track(machine);

    const state = machine.state$.getValue();

    expect(state).toMatchObject({
      editing: "tx100",
      form: { description: entry.description },
      verdict: { ok: true },
    });
    expect(state.form.description).not.toBe("Opening balances");
    expect(state.form.amounts).toEqual(amountsOf(entry));
    expect(viewOf(state.summary, "la156")).toMatchObject({
      debit: "6250.99",
      credit: "",
    });
    expect(
      ownersOf(books).filter((owner) => {
        return state.form.amounts[`la158/${owner.id}`] !== undefined;
      }),
    ).toHaveLength(19);

    editAmount(machine, "la156", { debit: "6,250.98", credit: "" });
    editAmount(machine, "la154", { debit: "0.01", credit: "" });

    expect(await machine.intents.save()).toEqual({
      ok: true,
      value: { id: "tx100" },
    });
    expect(currentEntry(harness, "tx100").postings.slice(0, 2)).toEqual([
      {
        accountId: "la154",
        debit: cents(1),
        credit: cents(0),
        counterpart: null,
      },
      {
        accountId: "la156",
        debit: cents(625098),
        credit: cents(0),
        counterpart: null,
      },
    ]);
  });

  it("with no books, has no rows and refuses with no postings", () => {
    const { machine } = createWizard(null);

    expect(machine.state$.getValue()).toMatchObject({
      summary: { rows: [], balance: 0, unreadableRow: null },
      verdict: { ok: false, reason: "no-postings" },
      form: { amounts: {} },
    });
  });
});

describe("fitsOpening", () => {
  it("fits an opening whose every line lands on its own row of the list", () => {
    const harness = createP36Harness();

    expect(
      fitsOpening(currentEntry(harness, "tx100"), currentBooks(harness)),
    ).toBe(true);
  });

  it("does not fit an opening with supplier lines, two lines on one row, a resident on a leaf, or another kind", () => {
    const harness = createP36Harness();
    const books = currentBooks(harness);
    const opening = currentEntry(harness, "tx100");
    const bank = must(opening.postings.at(-1), "the bank line");

    expect(fitsOpening(createWithPostings(opening, [bank, bank]), books)).toBe(
      false,
    );
    expect(
      fitsOpening(
        createWithPostings(opening, [
          { ...bank, counterpart: { kind: "supplier", id: "md78" } },
        ]),
        books,
      ),
    ).toBe(false);
    expect(
      fitsOpening(
        createWithPostings(opening, [
          { ...bank, counterpart: { kind: "owner", id: "r162" } },
        ]),
        books,
      ),
    ).toBe(false);
    expect(fitsOpening({ ...opening, kind: "generic" }, books)).toBe(false);
  });

  it("does not fit p1's opening, which has supplier lines", () => {
    const harness = createAppHarness();

    expect(
      fitsOpening(currentEntry(harness, "tx1"), currentBooks(harness)),
    ).toBe(false);
  });
});

interface CreatedWizard {
  machine: WizardMachine<OpeningForm, OpeningSummary>;
  calls: () => EntryDraft[];
}

const SAVED: EntryAdded = { id: "saved" };

const track = disposeAfterEach();

function createWizard(books: Books | null): CreatedWizard {
  const drafts: EntryDraft[] = [];

  function write(draft: EntryDraft): Promise<ResultOf<EntryAdded>> {
    drafts.push(draft);

    return Promise.resolve(accepted(SAVED));
  }

  const machine = createOpeningBalancesWizard(
    createAmountTexts(),
    books,
    write,
    null,
  );

  track(machine);

  return {
    machine,
    calls: (): EntryDraft[] => {
      return drafts;
    },
  };
}

function createP36Harness(): AppHarness {
  const harness = createAppHarness();

  harness.app.presenters.buildings.selectPeriod("p36");

  return harness;
}

/** Pozzetto 2013 with its seeded opening deleted through the port, as a new opening needs. */
async function createHarnessWithoutOpening(): Promise<AppHarness> {
  const harness = createP36Harness();

  expect(await harness.ports.journal.deleteEntry("tx100")).toEqual({
    ok: true,
  });

  return harness;
}

/** The row's amounts replaced, the others kept. */
function editAmount(
  machine: WizardMachine<OpeningForm, OpeningSummary>,
  key: string,
  amount: OpeningAmount,
): void {
  machine.intents.edit({
    amounts: { ...machine.state$.getValue().form.amounts, [key]: amount },
  });
}

function viewOf(summary: OpeningSummary, key: string): OpeningRowView {
  return must(
    summary.rows.find((row) => {
      return row.key === key;
    }),
    `the row ${key}`,
  );
}

function rowOf(rows: OpeningRow[], key: string): OpeningRow {
  return must(
    rows.find((row) => {
      return row.key === key;
    }),
    `the row ${key}`,
  );
}

/** A resident's row as the prefill shows it: a debt on the debit side, a credit on the credit side, nothing for zero. */
function prefilledView(books: Books, owner: OwnerParty): OpeningRowView {
  const balance = owner.startingBalance;

  return {
    key: `la158/${owner.id}`,
    label: [ownersName(books), owner.name, owner.unitCode].join(PATH_SEPARATOR),
    debit: balance > 0 ? amountText(balance, "en-US") : "",
    credit: balance < 0 ? amountText(cents(-balance), "en-US") : "",
  };
}

/** The form's amounts an entry was written from: a row per posting, a side of zero blank. */
function amountsOf(entry: JournalEntry): Record<string, OpeningAmount> {
  return Object.fromEntries(
    entry.postings.map((posting) => {
      const key =
        posting.counterpart === null
          ? posting.accountId
          : `${posting.accountId}/${posting.counterpart.id}`;

      return [
        key,
        {
          debit: posting.debit === 0 ? "" : amountText(posting.debit, "en-US"),
          credit:
            posting.credit === 0 ? "" : amountText(posting.credit, "en-US"),
        },
      ];
    }),
  );
}

function ownersOf(books: Books): OwnerParty[] {
  return books.parties.filter((party) => {
    return party.kind === "owner";
  });
}

function ownersName(books: Books): string {
  return accountName(books, "la158");
}

function accountName(books: Books, id: string): string {
  return must(
    books.accounts.find((account) => {
      return account.id === id;
    }),
    `the account ${id}`,
  ).name;
}

function createWithPostings(
  entry: JournalEntry,
  postings: Posting[],
): JournalEntry {
  return { ...entry, postings };
}
