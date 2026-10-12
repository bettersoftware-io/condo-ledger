import { describe, expect, it } from "vitest";

import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";

import { createAppHarness } from "./testing/appHarness.ts";

describe("the application", () => {
  it("wires the accounts presenter to the selected period", () => {
    const { app } = createAppHarness(createSmallSeed());
    const subscription = app.presenters.accounts.tree$.subscribe();

    expect(app.presenters.accounts.tree$.getValue()?.debit).toBe(212619);

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
