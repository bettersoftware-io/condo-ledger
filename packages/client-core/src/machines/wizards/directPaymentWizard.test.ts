import { afterEach, describe, expect, it } from "vitest";

import {
  accepted,
  type EntryAdded,
  type EntryDraft,
  type ResultOf,
} from "@cl/domain";
import { createSmallBooks } from "@cl/domain/testing/createSmallBooks.ts";

import type { Books } from "#/presenters/booksPresenter.ts";
import { createAccountsWithTax, createBooks } from "#/testing/createBooks.ts";

import {
  createDirectPaymentWizard,
  type DirectPaymentForm,
  type DirectPaymentKind,
  type DirectPaymentSummary,
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

  const machine = createDirectPaymentWizard(kind, books, addEntry);

  created.push(machine);

  return {
    machine,
    calls: (): EntryDraft[] => {
      return drafts;
    },
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
