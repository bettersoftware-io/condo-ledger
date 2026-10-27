import { afterEach, describe, expect, it } from "vitest";

import {
  budgetSharesOf,
  type Cents,
  type Counterpart,
  type LegacySeed,
  loadLegacySeed,
  type Posting,
} from "@cl/domain";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";
import { must } from "@cl/domain/support/must.ts";

import { type AppHarness, createAppHarness } from "#/testing/appHarness.ts";
import { currentBooks, currentEntry } from "#/testing/harnessBooks.ts";

import {
  type BudgetAllocationForm,
  type BudgetAllocationSummary,
  createBudgetAllocationWizard,
} from "./budgetAllocationWizard.ts";
import type { WizardMachine } from "./wizard.ts";

afterEach(() => {
  for (const machine of created.splice(0)) {
    machine.dispose();
  }
});

describe("the Budget allocation wizard", () => {
  it("on p1 with tx5 deleted, previews tx5 again line for line, under the default description, accepted", async () => {
    const harness = createAppHarness();
    const posted = currentEntry(harness, "tx5");

    await deleteEntry(harness, "tx5");

    const machine = track(harness.app.machines.createBudgetAllocationWizard());
    const state = machine.state$.getValue();

    expect(state).toMatchObject({
      step: 1,
      firstStep: 1,
      stepCount: 1,
      editing: null,
      choices: [],
      form: { description: "Budget allocation (no.1)" },
      verdict: { ok: true },
      stepVerdict: { ok: true },
      touched: false,
      saving: false,
    });

    const preview = must(state.summary.preview, "the preview");

    expect(preview.kind).toBe("budgetAllocation");
    expect(preview.description).toBe("Budget allocation (no.1)");
    expect(lines(preview.postings)).toEqual(lines(posted.postings));

    // Ten residents and the roundings on A1 are debits; the budget is the one credit.
    expect(
      state.preview.filter((line) => {
        return line.debit > 0 || line.credit === 0;
      }),
    ).toHaveLength(11);
    expect(state.preview.at(-1)).toMatchObject({ debit: 0, credit: 740000 });
    expect(
      state.preview.every((line) => {
        return line.path !== "";
      }),
    ).toBe(true);
  });

  it("Save adds the entry, and the journal lists it", async () => {
    const harness = createAppHarness();

    await deleteEntry(harness, "tx5");

    const machine = track(harness.app.machines.createBudgetAllocationWizard());

    machine.intents.edit({ description: "Riparto preventivo" });

    const saved = await machine.intents.save();

    expect(saved.ok).toBe(true);

    const id = idOf(saved);
    const { entries$ } = harness.app.presenters.journal;
    const subscription = entries$.subscribe();
    const listed = entries$.getValue().find((row) => {
      return row.id === id;
    });

    subscription.unsubscribe();
    expect(listed).toMatchObject({
      kind: "budgetAllocation",
      description: "Riparto preventivo",
    });
    expect(lines(currentEntry(harness, id).postings)).toEqual(
      lines(
        must(machine.state$.getValue().summary.preview, "a preview").postings,
      ),
    );
  });

  it("on p1 as seeded, refuses allocation-exists, previews nothing and writes nothing", async () => {
    const harness = createAppHarness();
    const before = currentBooks(harness).entries.length;
    const machine = track(harness.app.machines.createBudgetAllocationWizard());

    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: false, reason: "allocation-exists" },
      stepVerdict: { ok: false, reason: "allocation-exists" },
      preview: [],
      summary: { preview: null },
    });
    await expect(machine.intents.save()).resolves.toEqual({
      ok: false,
      reason: "allocation-exists",
    });
    expect(currentBooks(harness).entries).toHaveLength(before);
  });

  it("refuses a blank description, as validateEntry does, and keeps the preview", async () => {
    const harness = createAppHarness();

    await deleteEntry(harness, "tx5");

    const machine = track(harness.app.machines.createBudgetAllocationWizard());

    machine.intents.edit({ description: "  " });

    const state = machine.state$.getValue();

    expect(state.verdict).toEqual({ ok: false, reason: "blank-description" });
    expect(state.touched).toBe(true);
    expect(state.summary.preview).not.toBeNull();
  });

  it("with no books or no allocation, refuses no-budget", () => {
    const harness = createAppHarness();

    expect(
      track(
        createBudgetAllocationWizard(null, null, neverWrite),
      ).state$.getValue().verdict,
    ).toEqual({ ok: false, reason: "no-budget" });
    expect(
      track(
        createBudgetAllocationWizard(currentBooks(harness), null, neverWrite),
      ).state$.getValue().verdict,
    ).toEqual({ ok: false, reason: "no-budget" });
  });

  it("Review Focus 2: a new table linked nowhere does not change the verdict or the preview", async () => {
    const harness = createAppHarness();

    await deleteEntry(harness, "tx5");

    const before = track(harness.app.machines.createBudgetAllocationWizard());

    await expect(
      harness.app.presenters.allocation.addTable({
        name: "Test",
        order: 6,
        notes: "",
      }),
    ).resolves.toEqual({ ok: true, value: { id: "dt-new-1" } });

    const after = track(harness.app.machines.createBudgetAllocationWizard());

    expect(after.state$.getValue().verdict).toEqual({ ok: true });
    expect(after.state$.getValue().summary).toEqual(
      before.state$.getValue().summary,
    );
  });

  it("Review Focus 2: over a seed where an account's only table is all zeros, refuses unallocated-budget, naming the account", async () => {
    const harness = createAppHarness(createZeroTableSeed("dt1"));

    await deleteEntry(harness, "tx5");

    const machine = track(harness.app.machines.createBudgetAllocationWizard());

    // la29 has no link of its own: it allocates through its grouping la28's
    // one table, dt1, now all zeros.
    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "unallocated-budget",
      detail: "la29",
    });
    expect(machine.state$.getValue().summary.preview).toBeNull();
  });

  it("Review Focus 5: on p36, installments planned, tx291 deleted and the allocation posted again: the installments stay, and the shares follow the new entry", async () => {
    const harness = createAppHarness();

    harness.app.presenters.buildings.selectPeriod("p36");

    const planner = track(
      harness.app.machines.createBudgetInstallmentsWizard(),
    );

    planner.intents.edit({ count: "2", firstDue: "31/01/2014", months: "1" });
    await expect(planner.intents.save()).resolves.toEqual({ ok: true });

    const planned = currentBooks(harness);

    expect(
      budgetSharesOf(planned.entries, planned.accounts).shares.get("r166"),
    ).toBe(89880);

    await deleteEntry(harness, "tx291");

    const machine = track(harness.app.machines.createBudgetAllocationWizard());

    expect(machine.state$.getValue().verdict).toEqual({ ok: true });
    expect((await machine.intents.save()).ok).toBe(true);

    const books = currentBooks(harness);

    expect(books.installments).toEqual(planned.installments);
    expect(books.installmentItems).toEqual(planned.installmentItems);
    expect(
      budgetSharesOf(books.entries, books.accounts).shares.get("r166"),
    ).toBe(89864);
  });
});

type Wizard = WizardMachine<BudgetAllocationForm, BudgetAllocationSummary>;

/** A posting's four fields: what a redrawn entry is compared on. */
interface Line {
  accountId: string;
  counterpart: Counterpart | null;
  debit: Cents;
  credit: Cents;
}

/** What a test disposes after it: the machines it built. */
interface Disposable {
  dispose: () => void;
}

const created: Disposable[] = [];

function track<TMachine extends Disposable>(machine: TMachine): TMachine {
  created.push(machine);

  return machine;
}

function neverWrite(): Promise<never> {
  throw new Error("nothing is written");
}

async function deleteEntry(harness: AppHarness, id: string): Promise<void> {
  await expect(harness.app.presenters.journal.deleteEntry(id)).resolves.toEqual(
    { ok: true },
  );
}

function idOf(saved: Awaited<ReturnType<Wizard["intents"]["save"]>>): string {
  if (!saved.ok) {
    throw new Error(`refused: ${saved.reason}`);
  }

  return saved.value.id;
}

function lines(postings: Posting[]): Line[] {
  return postings.map((posting) => {
    return {
      accountId: posting.accountId,
      counterpart: posting.counterpart,
      debit: posting.debit,
      credit: posting.credit,
    };
  });
}

/** The real seed with every coefficient of the table at 0: the accounts it alone serves allocate nothing. */
function createZeroTableSeed(tableId: string): LegacySeed {
  const seed = loadLegacySeed(legacySeedData);

  return {
    ...seed,
    coefficients: seed.coefficients.map((coefficient) => {
      return coefficient.tableId === tableId
        ? { ...coefficient, value: 0 }
        : coefficient;
    }),
  };
}
