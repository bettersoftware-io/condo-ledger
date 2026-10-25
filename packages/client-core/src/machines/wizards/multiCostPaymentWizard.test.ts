import { afterEach, describe, expect, it } from "vitest";

import {
  accepted,
  type EntryAdded,
  type EntryDraft,
  type ResultOf,
} from "@cl/domain";
import { createSmallBooks } from "@cl/domain/testing/createSmallBooks.ts";

import type { Books } from "#/presenters/booksPresenter.ts";
import { createAppHarness } from "#/testing/appHarness.ts";
import { createAmountTexts } from "#/testing/createAmountTexts.ts";
import { createBooks } from "#/testing/createBooks.ts";
import { currentBooks, currentEntry } from "#/testing/harnessBooks.ts";

import {
  createMultiCostPaymentWizard,
  fitsMultiCost,
  type MultiCostPaymentForm,
  type MultiCostPaymentSummary,
} from "./multiCostPaymentWizard.ts";
import type { WizardMachine } from "./wizard.ts";

afterEach(() => {
  for (const machine of created.splice(0)) {
    machine.dispose();
  }
});

describe("the multi-cost payment wizard", () => {
  it("starts with one empty line, the bank purchase's description, paid from the bank, the expense leaves to choose", () => {
    const { machine } = createWizard();

    expect(machine.state$.getValue()).toMatchObject({
      form: {
        description: "Direct purchase via bank account",
        amount: "",
        lines: [{ accountId: null, amount: "" }],
      },
      verdict: { ok: false, reason: "no-target" },
      summary: { paidFrom: "Banca", linesTotal: 0 },
      preview: [],
    });
    expect(
      machine.state$.getValue().choices.map((choice) => {
        return choice.key;
      }),
    ).toEqual(["la21", "la22"]);
  });

  it("a line without an account is no target, whichever line it is", () => {
    const { machine } = createWizard();

    machine.intents.edit({
      amount: "100",
      lines: [
        { accountId: "la21", amount: "60" },
        { accountId: null, amount: "40" },
      ],
    });

    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "no-target",
    });
  });

  it("an account that is not offered is no target: the bank does not pay the bank", () => {
    const { machine } = createWizard();

    machine.intents.edit({
      amount: "100",
      lines: [{ accountId: "la2", amount: "100" }],
    });

    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "no-target",
    });
  });

  it("lines that sum to less than the amount paid do not sum", () => {
    const { machine } = createWizard();

    machine.intents.edit({
      amount: "100",
      lines: [
        { accountId: "la21", amount: "60" },
        { accountId: "la22", amount: "30" },
      ],
    });

    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: false, reason: "lines-do-not-sum" },
      summary: { linesTotal: 9000 },
    });
  });

  it("lines that sum to more than the amount paid do not sum either", () => {
    const { machine } = createWizard();

    machine.intents.edit({
      amount: "100",
      lines: [
        { accountId: "la21", amount: "60" },
        { accountId: "la22", amount: "50" },
      ],
    });

    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: false, reason: "lines-do-not-sum" },
      summary: { linesTotal: 11000 },
    });
  });

  it("lines that sum to the amount paid preview each cost debited in order and the bank credited, and save a bank purchase", async () => {
    const { machine, calls } = createWizard();

    machine.intents.edit({
      amount: "100",
      lines: [
        { accountId: "la21", amount: "60" },
        { accountId: "la22", amount: "40" },
      ],
    });

    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: true },
      summary: { paidFrom: "Banca", linesTotal: 10000 },
    });
    expect(machine.state$.getValue().preview).toEqual([
      { path: "Costs › Spese generali › Ascensore", debit: 6000, credit: 0 },
      { path: "Costs › Spese generali › Pulizie", debit: 4000, credit: 0 },
      {
        path: "Patrimonial › (Assets) › Liquidità › Banca",
        debit: 0,
        credit: 10000,
      },
    ]);
    expect(await machine.intents.save()).toEqual({
      ok: true,
      value: { id: "new1" },
    });
    expect(calls()).toEqual([
      {
        kind: "directPaymentBank",
        description: "Direct purchase via bank account",
        postings: [
          { accountId: "la21", debit: 6000, credit: 0, counterpart: null },
          { accountId: "la22", debit: 4000, credit: 0, counterpart: null },
          { accountId: "la2", debit: 0, credit: 10000, counterpart: null },
        ],
      },
    ]);
  });

  it("removing every line leaves one empty line", () => {
    const { machine } = createWizard();

    machine.intents.edit({
      lines: [
        { accountId: "la21", amount: "60" },
        { accountId: "la22", amount: "40" },
      ],
    });
    machine.intents.edit({ description: "Two costs", lines: [] });

    expect(machine.state$.getValue().form).toEqual({
      description: "Two costs",
      amount: "",
      lines: [{ accountId: null, amount: "" }],
    });
  });

  it("a line amount that does not read is not an amount, and counts nothing towards the total", () => {
    const { machine } = createWizard();

    machine.intents.edit({
      amount: "100",
      lines: [
        { accountId: "la21", amount: "abc" },
        { accountId: "la22", amount: "40" },
      ],
    });

    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: false, reason: "not-an-amount" },
      summary: { linesTotal: 4000 },
      preview: [],
    });
  });

  it("an empty amount paid is not an amount", () => {
    const { machine } = createWizard();

    machine.intents.edit({
      amount: "",
      lines: [{ accountId: "la21", amount: "60" }],
    });

    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "not-an-amount",
    });
  });

  it("past its own rules the domain decides: a zero line is an empty line", () => {
    const { machine } = createWizard();

    machine.intents.edit({
      amount: "60",
      lines: [
        { accountId: "la21", amount: "60" },
        { accountId: "la22", amount: "0" },
      ],
    });

    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "empty-line",
    });
  });

  it("a period without a bank account stays refused, whatever is typed", () => {
    const { machine } = createWizard(createBooksWithoutBank());

    machine.intents.edit({
      amount: "60",
      lines: [{ accountId: "la21", amount: "60" }],
    });

    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: false, reason: "no-paid-from-account" },
      summary: { paidFrom: null, linesTotal: 6000 },
      preview: [],
    });
  });

  it("with no books at all: no choices, no account paid from", () => {
    const { machine } = createWizard(null);

    expect(machine.state$.getValue()).toMatchObject({
      choices: [],
      verdict: { ok: false, reason: "no-paid-from-account" },
      summary: { paidFrom: null, linesTotal: 0 },
    });
  });
});

describe("editing a bank purchase of several costs", () => {
  it("a seeded one opens on its lines and the amount paid, and judges as written", () => {
    const harness = createAppHarness();
    const machine = harness.app.machines.createMultiCostPaymentWizard("tx4");

    created.push(machine);

    expect(machine.state$.getValue()).toMatchObject({
      editing: "tx4",
      form: {
        description: currentEntry(harness, "tx4").description,
        amount: "286.50",
        lines: [
          { accountId: "la38", amount: "57.30" },
          { accountId: "la41", amount: "229.20" },
        ],
      },
      verdict: { ok: true },
      stepVerdict: { ok: true },
      summary: { linesTotal: 28650 },
    });
  });

  it("saving it unchanged rewrites it in place: its id, its number and its stamp stay", async () => {
    const harness = createAppHarness();
    const before = currentBooks(harness).entries.length;
    const machine = harness.app.machines.createMultiCostPaymentWizard("tx4");

    created.push(machine);

    expect(await machine.intents.save()).toEqual({
      ok: true,
      value: { id: "tx4" },
    });
    expect(currentBooks(harness).entries).toHaveLength(before);
    expect(currentEntry(harness, "tx4")).toMatchObject({
      number: 4,
      at: "2011-03-13T14:07:00",
      kind: "directPaymentBank",
    });
  });
});

describe("fitsMultiCost", () => {
  it("fits a bank purchase of expense leaves, of one cost or several", () => {
    const harness = createAppHarness();
    const books = currentBooks(harness);

    expect(fitsMultiCost(currentEntry(harness, "tx4"), books)).toBe(true);
    expect(fitsMultiCost(currentEntry(harness, "tx3"), books)).toBe(true);
  });

  it("does not fit a cash purchase, a withholding, or a cost on a leaf that is no expense", () => {
    const harness = createAppHarness();
    const books = currentBooks(harness);
    const purchase = currentEntry(harness, "tx4");

    expect(fitsMultiCost(currentEntry(harness, "tx8"), books)).toBe(false);
    expect(fitsMultiCost(currentEntry(harness, "tx12"), books)).toBe(false);
    expect(
      fitsMultiCost(
        {
          ...purchase,
          postings: purchase.postings.map((posting) => {
            return posting.accountId === "la41"
              ? { ...posting, accountId: "la25" }
              : posting;
          }),
        },
        books,
      ),
    ).toBe(false);
  });
});

interface CreatedWizard {
  machine: WizardMachine<MultiCostPaymentForm, MultiCostPaymentSummary>;
  calls: () => EntryDraft[];
}

function createWizard(books: Books | null = createBooks()): CreatedWizard {
  const drafts: EntryDraft[] = [];

  function addEntry(draft: EntryDraft): Promise<ResultOf<EntryAdded>> {
    drafts.push(draft);

    return Promise.resolve(accepted({ id: "new1" }));
  }

  const machine = createMultiCostPaymentWizard(
    createAmountTexts(),
    books,
    addEntry,
    null,
  );

  created.push(machine);

  return {
    machine,
    calls: (): EntryDraft[] => {
      return drafts;
    },
  };
}

/** The small books with Banca no longer the bank account: a period with nothing to pay by bank from. */
function createBooksWithoutBank(): Books {
  return createBooks(
    createSmallBooks().accounts.map((account) => {
      return account.role === "bank" ? { ...account, role: null } : account;
    }),
  );
}

const created: WizardMachine<MultiCostPaymentForm, MultiCostPaymentSummary>[] =
  [];
