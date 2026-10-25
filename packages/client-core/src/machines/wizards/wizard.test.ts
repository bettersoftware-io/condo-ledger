import { Subject } from "rxjs";
import { afterEach, describe, expect, it } from "vitest";

import {
  accepted,
  type Cents,
  type EntryAdded,
  type EntryDraft,
  ok,
  type Result,
  type ResultOf,
  rejected,
  ZERO_CENTS,
} from "@cl/domain";

import { parseAmount } from "#/amounts.ts";

import {
  createWizardMachine,
  type Derived,
  refused,
  replacing,
  type WizardDefinition,
  type WizardMachine,
} from "./wizard.ts";

afterEach(() => {
  for (const machine of [...created.splice(0), ...notedCreated.splice(0)]) {
    machine.dispose();
  }
});

describe("a wizard machine", () => {
  it("judges the form again, as it stands, each time rejudge$ emits, and only then", () => {
    const rejudge$ = new Subject<void>();
    let open = true;

    function derive(form: AmountForm): Derived {
      return open ? deriveAmount(form) : refused("closed");
    }

    const machine = createWizardMachine<AmountForm, AmountSummary>(
      {
        ...createDefinition(1),
        derive,
        stepVerdict: (form: AmountForm): Result => {
          return derive(form).verdict;
        },
      },
      () => {
        return Promise.resolve(accepted({ id: "new1" }));
      },
      rejudge$,
    );

    created.push(machine);
    machine.intents.edit({ amount: "12.50" });
    open = false;

    expect(machine.state$.getValue().verdict).toEqual({ ok: true });

    rejudge$.next();

    expect(machine.state$.getValue()).toMatchObject({
      form: { amount: "12.50" },
      touched: true,
      step: 1,
      verdict: { ok: false, reason: "closed" },
      stepVerdict: { ok: false, reason: "closed" },
      preview: [],
    });
  });

  it("starts untouched on step 1 with the definition's choices and a rejected verdict", () => {
    const { machine } = createWizard();

    expect(machine.state$.getValue()).toMatchObject({
      step: 1,
      firstStep: 1,
      stepCount: 1,
      editing: null,
      stepVerdict: { ok: false, reason: "not-an-amount" },
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

    machine.intents.edit({ amount: "12.50" });
    machine.intents.next();
    machine.intents.next();
    expect(machine.state$.getValue().step).toBe(2);

    machine.intents.back();
    machine.intents.back();
    expect(machine.state$.getValue().step).toBe(1);
  });

  it("next is gated by the current step's verdict: step 1 accepts while step 2's field is still blank", () => {
    const machine = createNotedWizard(createNotedDefinition(1));

    machine.intents.next();
    expect(machine.state$.getValue()).toMatchObject({
      step: 1,
      stepVerdict: { ok: false, reason: "not-an-amount" },
    });

    machine.intents.edit({ amount: "12.50" });
    expect(machine.state$.getValue()).toMatchObject({
      step: 1,
      stepVerdict: { ok: true },
      verdict: { ok: false, reason: "blank-note" },
    });

    machine.intents.next();
    expect(machine.state$.getValue()).toMatchObject({
      step: 2,
      stepVerdict: { ok: false, reason: "blank-note" },
    });

    machine.intents.next();
    expect(machine.state$.getValue().step).toBe(2);

    machine.intents.edit({ note: "Rata di marzo" });
    machine.intents.next();
    expect(machine.state$.getValue()).toMatchObject({
      step: 3,
      stepVerdict: { ok: true },
      verdict: { ok: true },
    });
  });

  it("starts at the definition's first step, and back stops there", () => {
    const machine = createNotedWizard(createNotedDefinition(2));

    expect(machine.state$.getValue()).toMatchObject({
      step: 2,
      firstStep: 2,
    });

    machine.intents.back();
    expect(machine.state$.getValue().step).toBe(2);

    machine.intents.edit({ amount: "12.50", note: "Rata di marzo" });
    machine.intents.next();
    expect(machine.state$.getValue().step).toBe(3);

    machine.intents.back();
    machine.intents.back();
    expect(machine.state$.getValue().step).toBe(2);
  });

  it("names the entry it edits, as its definition does", () => {
    const machine = createWizardMachine(
      { ...createDefinition(1), editing: "tx8" },
      () => {
        return Promise.resolve(accepted({ id: "tx8" }));
      },
    );

    created.push(machine);

    expect(machine.state$.getValue().editing).toBe("tx8");
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

  it("a save through replacing rewrites that entry and answers its id", async () => {
    const replaced: string[] = [];
    const machine = createWizardMachine(
      createDefinition(1),
      replacing("tx8", (id: string): Promise<Result> => {
        replaced.push(id);

        return Promise.resolve(ok());
      }),
    );

    created.push(machine);
    machine.intents.edit({ amount: "12.50" });

    expect(await machine.intents.save()).toEqual({
      ok: true,
      value: { id: "tx8" },
    });
    expect(replaced).toEqual(["tx8"]);
  });

  it("a replace the port refuses answers the port's reason", async () => {
    const machine = createWizardMachine(
      createDefinition(1),
      replacing("tx8", (): Promise<Result> => {
        return Promise.resolve(rejected("kind-changed"));
      }),
    );

    created.push(machine);
    machine.intents.edit({ amount: "12.50" });

    expect(await machine.intents.save()).toEqual({
      ok: false,
      reason: "kind-changed",
    });
  });

  it("a replace of an entry the port no longer has answers entry-gone, and saving ends", async () => {
    const machine = createWizardMachine(
      createDefinition(1),
      replacing("tx8", (): Promise<Result> => {
        return Promise.reject(new Error("no entry tx8"));
      }),
    );

    created.push(machine);
    machine.intents.edit({ amount: "12.50" });

    expect(await machine.intents.save()).toEqual({
      ok: false,
      reason: "entry-gone",
    });
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
      return { amount: parseAmount(form.amount, "en-US") };
    },
    stepVerdict: (form: AmountForm): Result => {
      return deriveAmount(form).verdict;
    },
  };
}

interface NotedForm {
  amount: string;
  note: string;
}

/** Three steps: the amount on the first, the note on the second, nothing more on the third. */
function createNotedDefinition(
  firstStep: number,
): WizardDefinition<NotedForm, null> {
  return {
    initial: { amount: "", note: "" },
    firstStep,
    stepCount: 3,
    choices: [],
    derive: (form: NotedForm): Derived => {
      return form.note.trim() === ""
        ? refused("blank-note")
        : deriveAmount(form);
    },
    summarize: (): null => {
      return null;
    },
    stepVerdict: (form: NotedForm, step: number): Result => {
      if (step === 1) {
        return deriveAmount(form).verdict;
      }

      return step === 2 && form.note.trim() === ""
        ? rejected("blank-note")
        : ok();
    },
  };
}

function createNotedWizard(
  definition: WizardDefinition<NotedForm, null>,
): WizardMachine<NotedForm, null> {
  const machine = createWizardMachine(definition, () => {
    return Promise.resolve(accepted({ id: "new1" }));
  });

  notedCreated.push(machine);

  return machine;
}

/** Accepted when the amount reads as more than zero: a generic entry, Ascensore debited and Cassa credited. */
function deriveAmount(form: AmountForm): Derived {
  const amount = parseAmount(form.amount, "en-US");

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

const notedCreated: WizardMachine<NotedForm, null>[] = [];
