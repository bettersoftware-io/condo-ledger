import { describe, expect, it } from "vitest";

import { cents, type JournalEntryView, type LegacySeed } from "@cl/domain";
import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";
import { createTwoPeriodSeed } from "@cl/domain/testing/createTwoPeriodSeed.ts";

import { createAppHarness } from "./testing/appHarness.ts";

describe("the application", () => {
  it("wires the accounts presenter to the selected period", () => {
    const { app } = createAppHarness(createSmallSeed());
    const subscription = app.presenters.accounts.tree$.subscribe();

    expect(app.presenters.accounts.tree$.getValue()?.debit).toBe(212619);

    subscription.unsubscribe();
  });

  it("wires the journal presenter to the selected period, stamping with the application's clock", async () => {
    const { app } = createAppHarness(createSmallSeed());
    let entries: JournalEntryView[] = [];
    const subscription = app.presenters.journal.entries$.subscribe((next) => {
      entries = next;
    });

    expect(
      await app.presenters.journal.addEntry({
        kind: "generic",
        description: "Prova",
        postings: [
          {
            accountId: "la21",
            debit: cents(100),
            credit: cents(0),
            counterpart: null,
          },
          {
            accountId: "la1",
            debit: cents(0),
            credit: cents(100),
            counterpart: null,
          },
        ],
      }),
    ).toEqual({ ok: true, value: { id: "new1" } });
    expect(entries.at(-1)).toMatchObject({
      id: "new1",
      number: 10,
      at: "2026-10-14T10:00:00",
    });

    subscription.unsubscribe();
  });

  it("each grid machine is its own", () => {
    const { app } = createAppHarness(createSmallSeed());
    const first = app.machines.createAccountsGrid();
    const second = app.machines.createAccountsGrid();
    const before = second.state$.getValue().expanded;

    first.intents.toggle("la10");

    expect(first.state$.getValue().expanded).toContain("la10");
    expect(second.state$.getValue().expanded).toEqual(before);
    expect(second.state$.getValue().expanded).not.toContain("la10");

    first.dispose();
    second.dispose();
  });

  it("builds the journal grid over the selected period's entries, and a dialog machine per call", () => {
    const { app } = createAppHarness(createSmallSeed());
    const grid = app.machines.createJournalGrid();
    const first = app.machines.createJournalDialog();
    const second = app.machines.createJournalDialog();

    first.intents.openDelete();

    expect(grid.state$.getValue().total).toBe(9);
    expect(first.state$.getValue().open).toEqual({ kind: "delete" });
    expect(second.state$.getValue().open).toBeNull();

    grid.dispose();
    first.dispose();
    second.dispose();
  });

  it("a wizard built after a period is selected has that period's choices", () => {
    const { app } = createAppHarness(createSmallSeed());

    app.presenters.buildings.selectPeriod("p1");
    const wizard = app.machines.createDirectPaymentWizard("directPaymentCash");

    expect(wizard.state$.getValue().choices).toHaveLength(2);
    expect(wizard.state$.getValue().summary).toEqual({ paidFrom: "Cassa" });

    wizard.dispose();
  });

  it("a wizard is built over the books of the period selected when it is built", () => {
    const { app } = createAppHarness(createTwoPeriodSeed());

    // p2 holds a cash account and no expense leaf.
    app.presenters.buildings.selectPeriod("p2");
    const onP2 = app.machines.createDirectPaymentWizard("directPaymentCash");

    app.presenters.buildings.selectPeriod("p1");
    const onP1 = app.machines.createDirectPaymentWizard("directPaymentCash");

    expect(onP2.state$.getValue()).toMatchObject({
      choices: [],
      summary: { paidFrom: "Cassa" },
    });
    expect(onP1.state$.getValue().choices).toHaveLength(2);

    onP2.dispose();
    onP1.dispose();
  });

  it("one built with no period has none and is refused", async () => {
    const { app } = createAppHarness(createSeedWithNoBuilding());
    const direct = app.machines.createDirectPaymentWizard("directPaymentBank");
    const multiCost = app.machines.createMultiCostPaymentWizard();
    const generic = app.machines.createGenericEntryWizard();

    expect(direct.state$.getValue()).toMatchObject({
      choices: [],
      verdict: { ok: false, reason: "no-paid-from-account" },
      summary: { paidFrom: null },
    });
    expect(multiCost.state$.getValue()).toMatchObject({
      choices: [],
      verdict: { ok: false, reason: "no-paid-from-account" },
    });
    expect(generic.state$.getValue()).toMatchObject({
      choices: [],
      verdict: { ok: false },
    });
    expect(await direct.intents.save()).toEqual({
      ok: false,
      reason: "no-paid-from-account",
    });

    direct.dispose();
    multiCost.dispose();
    generic.dispose();
  });

  it("runs on the real seed by default", () => {
    expect(createAppHarness().seed.buildings).toHaveLength(2);
  });
});

/** The small seed's books with no building to hold them: nothing is selected. */
function createSeedWithNoBuilding(): LegacySeed {
  return { ...createSmallSeed(), buildings: [] };
}
