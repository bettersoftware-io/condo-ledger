import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import { cents } from "#/entities/cents.ts";

import { createSmallSeed } from "../testing/createSmallBooks.ts";
import { createAccountsSimulator } from "./accountsSimulator.ts";

describe("accounts simulator", () => {
  it("answers only the parties the period's postings name", async () => {
    const port = createAccountsSimulator(createSmallSeed());
    const parties = await firstValueFrom(port.parties("p1"));

    expect(
      parties.map((party) => {
        return `${party.kind}:${party.id}`;
      }),
    ).toEqual([
      "supplier:md1",
      "supplier:md2",
      "owner:r1",
      "owner:r2",
      "owner:r3",
    ]);
  });

  it("keeps a rejected budget out of the stream", async () => {
    const port = createAccountsSimulator(createSmallSeed());
    const seen: number[] = [];
    const subscription = port.accounts("p1").subscribe(() => {
      seen.push(seen.length);
    });

    await port.setBudget("la20", cents(1));
    subscription.unsubscribe();

    expect(seen).toEqual([0]);
  });
});
