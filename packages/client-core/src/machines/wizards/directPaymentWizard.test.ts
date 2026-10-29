import { afterEach, describe, expect, it } from "vitest";

import {
  accepted,
  cents,
  type EntryAdded,
  type EntryDraft,
  type JournalEntry,
  type Posting,
  type ResultOf,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";
import { createSmallBooks } from "@cl/domain/testing/createSmallBooks.ts";

import type { Books } from "#/presenters/booksPresenter.ts";
import { type AppHarness, createAppHarness } from "#/testing/appHarness.ts";
import { createAmountTexts } from "#/testing/createAmountTexts.ts";
import { createAccountsWithTax, createBooks } from "#/testing/createBooks.ts";
import { currentBooks, currentEntry } from "#/testing/harnessBooks.ts";

import { judgedPayment } from "./choices.ts";
import {
  createDirectPaymentWizard,
  type DirectPaymentForm,
  type DirectPaymentKind,
  type DirectPaymentSummary,
  fitsDirectPayment,
} from "./directPaymentWizard.ts";
import type { WizardMachine } from "./wizard.ts";

afterEach(() => {
  for (const machine of created.splice(0)) {
    machine.dispose();
  }
});

describe("the direct-payment wizard", () => {
  it("offers the expense leaves for a cash purchase, prefilled with the design's description, paid from cash", () => {
    const { machine } = createWizard("directPaymentCash");

    expect(machine.state$.getValue()).toMatchObject({
      form: { description: "Direct cash purchase", targetId: null, amount: "" },
      verdict: { ok: false, reason: "no-target" },
      summary: { paidFrom: "Cassa" },
      preview: [],
    });
    expect(
      machine.state$.getValue().choices.map((choice) => {
        return choice.key;
      }),
    ).toEqual(["la21", "la22"]);
  });

  it("previews the target debited and cash credited, and accepts once the amount is positive", () => {
    const { machine } = createWizard("directPaymentCash");

    machine.intents.edit({ targetId: "la21" });
    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "not-an-amount",
    });

    machine.intents.edit({ amount: "0" });
    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "empty-line",
    });

    machine.intents.edit({ amount: "23.50" });
    expect(machine.state$.getValue().verdict).toEqual({ ok: true });
    expect(machine.state$.getValue().preview).toEqual([
      { path: "Costs › Spese generali › Ascensore", debit: 2350, credit: 0 },
      {
        path: "Patrimonial › (Assets) › Liquidità › Cassa",
        debit: 0,
        credit: 2350,
      },
    ]);
  });

  it("a bank purchase is paid from the bank-role account", async () => {
    const { machine, calls } = createWizard("directPaymentBank");

    machine.intents.edit({ targetId: "la22", amount: "100" });

    expect(machine.state$.getValue().summary).toEqual({ paidFrom: "Banca" });
    expect(await machine.intents.save()).toEqual({
      ok: true,
      value: { id: "new1" },
    });
    expect(calls()).toEqual([
      {
        kind: "directPaymentBank",
        description: "Direct purchase via bank account",
        postings: [
          { accountId: "la22", debit: 10000, credit: 0, counterpart: null },
          { accountId: "la2", debit: 0, credit: 10000, counterpart: null },
        ],
      },
    ]);
  });

  it("a target that is not offered is no target: cash cannot pay cash", () => {
    const { machine } = createWizard("directPaymentCash");

    machine.intents.edit({ targetId: "la1", amount: "5" });

    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: false, reason: "no-target" },
      preview: [],
    });
  });

  it("a withholding payment offers the tax-role leaves and names the one chosen in its description", async () => {
    const { machine, calls } = createWizard(
      "withholdingPayment",
      createBooks(createAccountsWithTax()),
    );

    expect(machine.state$.getValue()).toMatchObject({
      form: { description: "Withholding payment" },
      choices: [
        {
          key: "la25",
          label: "Patrimonial › (Liabilities) › Erario › Ritenute 1040",
          group: "Erario",
        },
        {
          key: "la26",
          label: "Patrimonial › (Liabilities) › Erario › Ritenute 1019",
          group: "Erario",
        },
      ],
      summary: { paidFrom: "Banca" },
    });

    machine.intents.edit({ targetId: "la25", amount: "7.59" });
    expect(machine.state$.getValue().form.description).toBe(
      "Withholding payment (Ritenute 1040)",
    );
    expect(machine.state$.getValue().preview).toEqual([
      {
        path: "Patrimonial › (Liabilities) › Erario › Ritenute 1040",
        debit: 759,
        credit: 0,
      },
      {
        path: "Patrimonial › (Assets) › Liquidità › Banca",
        debit: 0,
        credit: 759,
      },
    ]);

    machine.intents.edit({ targetId: "la26" });
    expect(machine.state$.getValue().form.description).toBe(
      "Withholding payment (Ritenute 1019)",
    );

    await machine.intents.save();
    expect(calls()[0]).toMatchObject({
      kind: "withholdingPayment",
      description: "Withholding payment (Ritenute 1019)",
    });
  });

  it("the withholding description stops following the target once the person edits it", () => {
    const { machine } = createWizard(
      "withholdingPayment",
      createBooks(createAccountsWithTax()),
    );

    machine.intents.edit({ targetId: "la25" });
    machine.intents.edit({ description: "Ritenute di marzo" });
    machine.intents.edit({ targetId: "la26" });

    expect(machine.state$.getValue().form.description).toBe(
      "Ritenute di marzo",
    );
  });

  it("a purchase's description does not follow the target", () => {
    const { machine } = createWizard("directPaymentCash");

    machine.intents.edit({ targetId: "la21" });

    expect(machine.state$.getValue().form.description).toBe(
      "Direct cash purchase",
    );
  });

  it("a withholding on books with no tax account has nothing to settle", () => {
    const { machine } = createWizard("withholdingPayment");

    machine.intents.edit({ amount: "7.59" });

    expect(machine.state$.getValue()).toMatchObject({
      choices: [],
      verdict: { ok: false, reason: "no-target" },
      summary: { paidFrom: "Banca" },
    });
  });

  it("a period without the paid-from account stays refused, whatever is typed", () => {
    const { machine } = createWizard(
      "directPaymentCash",
      createBooksWithoutCash(),
    );

    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: false, reason: "no-paid-from-account" },
      summary: { paidFrom: null },
    });

    machine.intents.edit({ targetId: "la21", amount: "5" });

    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: false, reason: "no-paid-from-account" },
      preview: [],
    });
  });

  it("a blank description is refused by the domain's rule", () => {
    const { machine } = createWizard("directPaymentCash");

    machine.intents.edit({ description: " ", targetId: "la21", amount: "1" });

    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "blank-description",
    });
  });

  it("with no books at all: no choices, refused", () => {
    const { machine } = createWizard("withholdingPayment", null);

    machine.intents.edit({ targetId: "la25" });

    expect(machine.state$.getValue()).toMatchObject({
      form: { description: "Withholding payment" },
      choices: [],
      verdict: { ok: false, reason: "no-paid-from-account" },
      summary: { paidFrom: null },
    });
  });
});

describe("editing a direct payment", () => {
  it("a seeded cash purchase opens on its description, its target and its amount as text, and judges as written", () => {
    const harness = createAppHarness();
    const machine = harness.app.machines.createDirectPaymentWizard(
      "directPaymentCash",
      "tx8",
    );

    created.push(machine);

    expect(machine.state$.getValue()).toMatchObject({
      editing: "tx8",
      form: {
        description: seededEntry(harness, "tx8").description,
        targetId: "la36",
        amount: "23.50",
      },
      verdict: { ok: true },
      stepVerdict: { ok: true },
      summary: { paidFrom: "Cash on hand" },
    });
  });

  it("saving it unchanged rewrites it in place: its id, its number and its stamp stay", async () => {
    const harness = createAppHarness();
    const before = currentBooks(harness).entries.length;
    const machine = harness.app.machines.createDirectPaymentWizard(
      "directPaymentCash",
      "tx8",
    );

    created.push(machine);

    expect(await machine.intents.save()).toEqual({
      ok: true,
      value: { id: "tx8" },
    });
    expect(currentBooks(harness).entries).toHaveLength(before);
    expect(currentEntry(harness, "tx8")).toMatchObject({
      number: 8,
      at: "2011-04-11T16:15:36",
      kind: "directPaymentCash",
    });
  });

  it("a new amount is written to the same entry", async () => {
    const harness = createAppHarness();
    const machine = harness.app.machines.createDirectPaymentWizard(
      "directPaymentCash",
      "tx8",
    );

    created.push(machine);
    machine.intents.edit({ amount: "25" });
    await machine.intents.save();

    expect(currentEntry(harness, "tx8")).toMatchObject({
      number: 8,
      postings: [
        { accountId: "la36", debit: 2500, credit: 0 },
        { accountId: "la2", debit: 0, credit: 2500 },
      ],
    });
  });

  it("an entry edited under another direct kind is written as its own kind, paid from its own account", async () => {
    const harness = createAppHarness();
    const machine = harness.app.machines.createDirectPaymentWizard(
      "directPaymentCash",
      "tx3",
    );

    const bank = must(
      currentBooks(harness).accounts.find((account) => {
        return account.role === "bank";
      }),
      "the bank",
    );

    created.push(machine);

    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: true },
      summary: { paidFrom: bank.name },
    });
    expect(await machine.intents.save()).toEqual({
      ok: true,
      value: { id: "tx3" },
    });
    expect(currentEntry(harness, "tx3")).toMatchObject({
      kind: "directPaymentBank",
      number: 3,
    });
  });

  it("a withholding keeps its own description when its target changes", () => {
    const harness = createAppHarness();
    const machine = harness.app.machines.createDirectPaymentWizard(
      "withholdingPayment",
      "tx12",
    );
    const description = seededEntry(harness, "tx12").description;

    created.push(machine);

    expect(machine.state$.getValue().form).toEqual({
      description,
      targetId: "la25",
      amount: "7.59",
    });

    machine.intents.edit({ targetId: "la26" });

    expect(machine.state$.getValue().form.description).toBe(description);
  });

  it("an entry deleted while its edit is open: the save answers entry-gone and the wizard stays", async () => {
    const harness = createAppHarness();
    const machine = harness.app.machines.createDirectPaymentWizard(
      "directPaymentCash",
      "tx8",
    );

    created.push(machine);
    await harness.app.presenters.journal.deleteEntry("tx8");

    expect(await machine.intents.save()).toEqual({
      ok: false,
      reason: "entry-gone",
    });
    expect(machine.state$.getValue()).toMatchObject({
      saving: false,
      editing: "tx8",
    });
  });
});

describe("fitsDirectPayment", () => {
  it("fits a direct payment of one leaf from its role's account", () => {
    const harness = createAppHarness();
    const books = currentBooks(harness);

    expect(fitsDirectPayment(currentEntry(harness, "tx8"), books)).toBe(true);
    expect(fitsDirectPayment(currentEntry(harness, "tx3"), books)).toBe(true);
    expect(fitsDirectPayment(currentEntry(harness, "tx12"), books)).toBe(true);
  });

  it("does not fit a purchase of two costs, another kind, or lines its wizard cannot write", () => {
    const harness = createAppHarness();
    const books = currentBooks(harness);
    const cash = currentEntry(harness, "tx8");

    expect(fitsDirectPayment(currentEntry(harness, "tx4"), books)).toBe(false);
    expect(fitsDirectPayment(currentEntry(harness, "tx2"), books)).toBe(false);
    expect(
      fitsDirectPayment(
        createEntryWithPosting(cash, 1, { accountId: "la4" }),
        books,
      ),
    ).toBe(false);
    expect(
      fitsDirectPayment(
        createEntryWithPosting(cash, 0, { accountId: "la25" }),
        books,
      ),
    ).toBe(false);
    expect(
      fitsDirectPayment(
        createEntryWithPosting(cash, 1, { credit: cents(2000) }),
        books,
      ),
    ).toBe(false);
  });

  it("does not fit a period without the account its kind pays from", () => {
    const harness = createAppHarness();
    const books = currentBooks(harness);
    const withoutCash: Books = {
      ...books,
      accounts: books.accounts.map((account) => {
        return account.role === "cash" ? { ...account, role: null } : account;
      }),
    };

    expect(fitsDirectPayment(currentEntry(harness, "tx8"), withoutCash)).toBe(
      false,
    );
  });
});

describe("judgedPayment", () => {
  it("judges a draft with the entry it rewrites left out", () => {
    const harness = createAppHarness();
    const books = currentBooks(harness);
    const paying = {
      books,
      paidFrom: must(
        books.accounts.find((account) => {
          return account.id === "la4";
        }),
        "the bank",
      ),
    };

    const debits = [
      {
        choice: { key: "la36", label: "Costs › la36", group: "Costs" },
        amount: cents(100),
      },
    ];

    expect(
      judgedPayment(
        "openingBalances",
        "Saldi",
        paying,
        debits,
        cents(100),
        "tx1",
      ).verdict,
    ).toEqual({ ok: true });
    expect(
      judgedPayment(
        "openingBalances",
        "Saldi",
        paying,
        debits,
        cents(100),
        null,
      ).verdict,
    ).toEqual({ ok: false, reason: "opening-exists" });
  });
});

interface CreatedWizard {
  machine: WizardMachine<DirectPaymentForm, DirectPaymentSummary>;
  calls: () => EntryDraft[];
}

function createWizard(
  kind: DirectPaymentKind,
  books: Books | null = createBooks(),
): CreatedWizard {
  const drafts: EntryDraft[] = [];

  function addEntry(draft: EntryDraft): Promise<ResultOf<EntryAdded>> {
    drafts.push(draft);

    return Promise.resolve(accepted({ id: "new1" }));
  }

  const machine = createDirectPaymentWizard(
    createAmountTexts(),
    kind,
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

function seededEntry(harness: AppHarness, id: string): JournalEntry {
  return must(
    harness.seed.entries.find((entry) => {
      return entry.id === id;
    }),
    `the seeded entry ${id}`,
  );
}

/** The entry with one posting changed. */
function createEntryWithPosting(
  entry: JournalEntry,
  index: number,
  change: Partial<Posting>,
): JournalEntry {
  return {
    ...entry,
    postings: entry.postings.map((posting, at) => {
      return at === index ? { ...posting, ...change } : posting;
    }),
  };
}

/** The small books with Cassa no longer the cash account: a period with nothing to pay cash from. */
function createBooksWithoutCash(): Books {
  return createBooks(
    createSmallBooks().accounts.map((account) => {
      return account.role === "cash" ? { ...account, role: null } : account;
    }),
  );
}

const created: WizardMachine<DirectPaymentForm, DirectPaymentSummary>[] = [];
