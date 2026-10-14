import { afterEach, describe, expect, it } from "vitest";

import {
  accepted,
  type Cents,
  type EntryAdded,
  type EntryDraft,
  type ResultOf,
  ZERO_CENTS,
} from "@cl/domain";

import { parseAmount } from "#/amounts.ts";

import {
  createWizardMachine,
  type Derived,
  refused,
  type WizardDefinition,
  type WizardMachine,
} from "./wizard.ts";

afterEach(() => {
  for (const machine of created.splice(0)) {
    machine.dispose();
  }
});

describe("a wizard machine", () => {
  it("starts untouched on step 1 with the definition's choices and a rejected verdict", () => {
    const { machine } = createWizard();

    expect(machine.state$.getValue()).toMatchObject({
      step: 1,
      stepCount: 1,
      touched: false,
      saving: false,
      form: { amount: "" },
      choices: [{ key: "la21", label: "Ascensore", group: "Spese generali" }],
      verdict: { ok: false, reason: "not-an-amount" },
      preview: [],
      summary: { amount: null },
    });
  });

  it("an edit marks it touched and re-derives the preview, the verdict and the summary", () => {
    const { machine } = createWizard();

    machine.intents.edit({ amount: "12.50" });

    expect(machine.state$.getValue()).toMatchObject({
      touched: true,
      verdict: { ok: true },
      form: { amount: "12.50" },
      summary: { amount: 1250 },
    });
    expect(machine.state$.getValue().preview).toEqual([
      { path: "Costs › Ascensore", debit: 1250, credit: 0 },
      { path: "Cassa", debit: 0, credit: 1250 },
    ]);
  });

  it("next and back move within the steps and no further", () => {
    const { machine } = createWizard(2);

    machine.intents.next();
    machine.intents.next();
    expect(machine.state$.getValue().step).toBe(2);

    machine.intents.back();
    machine.intents.back();
    expect(machine.state$.getValue().step).toBe(1);
  });

  it("save refuses with the verdict's reason without calling the port while the verdict is rejected", async () => {
    const { machine, calls } = createWizard();

    machine.intents.edit({ amount: "0" });

    expect(await machine.intents.save()).toEqual({
      ok: false,
      reason: "not-an-amount",
    });
    expect(calls()).toEqual([]);
    expect(machine.state$.getValue().saving).toBe(false);
  });

  it("save hands the draft to addEntry and answers what it answered", async () => {
    const { machine, calls } = createWizard();

    machine.intents.edit({ amount: "12.50" });

    expect(await machine.intents.save()).toEqual({
      ok: true,
      value: { id: "new1" },
    });
    expect(calls()).toHaveLength(1);
    expect(
      calls()[0]?.postings.map((posting) => {
        return [posting.accountId, posting.debit, posting.credit];
      }),
    ).toEqual([
      ["la21", 1250, 0],
      ["la1", 0, 1250],
    ]);
    expect(machine.state$.getValue().saving).toBe(false);
  });

  it("a second save while the first is in flight is refused as saving, and one entry is written", async () => {
    const { machine, calls, release } = createWizard(1, true);

    machine.intents.edit({ amount: "12.50" });

    const first = machine.intents.save();

    expect(machine.state$.getValue().saving).toBe(true);
    expect(await machine.intents.save()).toEqual({
      ok: false,
      reason: "saving",
    });

    release();

    expect(await first).toEqual({ ok: true, value: { id: "new1" } });
    expect(calls()).toHaveLength(1);
    expect(machine.state$.getValue().saving).toBe(false);
  });

  it("saving ends when addEntry fails, and the failure reaches the caller", async () => {
    const machine = createWizardMachine(createDefinition(1), () => {
      return Promise.reject(new Error("the port is down"));
    });

    created.push(machine);
    machine.intents.edit({ amount: "1" });

    await expect(machine.intents.save()).rejects.toThrow("the port is down");
    expect(machine.state$.getValue().saving).toBe(false);
  });

  it("after dispose an edit changes nothing", () => {
    const machine = createWizardMachine(createDefinition(1), () => {
      return Promise.resolve(accepted({ id: "new1" }));
    });
    const reader = machine.state$.subscribe();

    machine.dispose();
    machine.intents.edit({ amount: "5" });

    expect(machine.state$.getValue()).toMatchObject({
      form: { amount: "" },
      touched: false,
    });

    reader.unsubscribe();
  });
});

interface AmountForm {
  amount: string;
}

interface AmountSummary {
  amount: Cents | null;
}

interface CreatedWizard {
  machine: WizardMachine<AmountForm, AmountSummary>;
  calls: () => EntryDraft[];
  release: () => void;
}

function createWizard(stepCount = 1, hold = false): CreatedWizard {
  const drafts: EntryDraft[] = [];

  const waiting: (() => void)[] = [];
  const held = new Promise<void>((resolve) => {
    waiting.push(resolve);
  });

  async function addEntry(draft: EntryDraft): Promise<ResultOf<EntryAdded>> {
    drafts.push(draft);

    if (hold) {
      await held;
    }

    return accepted({ id: "new1" });
  }

  const machine = createWizardMachine(createDefinition(stepCount), addEntry);

  created.push(machine);

  return {
    machine,
    calls: (): EntryDraft[] => {
      return drafts;
    },
    release: (): void => {
      for (const resolve of waiting) {
        resolve();
      }
    },
  };
}

function createDefinition(
  stepCount: number,
): WizardDefinition<AmountForm, AmountSummary> {
  return {
    initial: { amount: "" },
    stepCount,
    choices: [{ key: "la21", label: "Ascensore", group: "Spese generali" }],
    derive: deriveAmount,
    summarize: (form: AmountForm): AmountSummary => {
      return { amount: parseAmount(form.amount) };
    },
  };
}

/** Accepted when the amount reads as more than zero: a generic entry, Ascensore debited and Cassa credited. */
function deriveAmount(form: AmountForm): Derived {
  const amount = parseAmount(form.amount);

  if (amount === null || amount <= 0) {
    return refused("not-an-amount");
  }

  return {
    preview: [
      { path: "Costs › Ascensore", debit: amount, credit: ZERO_CENTS },
      { path: "Cassa", debit: ZERO_CENTS, credit: amount },
    ],
    verdict: { ok: true },
    draft: {
      kind: "generic",
      description: "Una spesa",
      postings: [
        {
          accountId: "la21",
          debit: amount,
          credit: ZERO_CENTS,
          counterpart: null,
        },
        {
          accountId: "la1",
          debit: ZERO_CENTS,
          credit: amount,
          counterpart: null,
        },
      ],
    },
  };
}

const created: WizardMachine<AmountForm, AmountSummary>[] = [];
