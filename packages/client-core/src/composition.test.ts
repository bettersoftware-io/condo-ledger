import { describe, expect, it } from "vitest";

import { cents, type JournalEntryView } from "@cl/domain";
import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";

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

  it("runs on the real seed by default", () => {
    expect(createAppHarness().seed.buildings).toHaveLength(2);
  });
});
