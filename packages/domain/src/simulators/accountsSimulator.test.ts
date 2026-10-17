import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import { cents } from "#/entities/cents.ts";

import { createSmallSeed } from "../testing/createSmallBooks.ts";
import { createTwoPeriodSeed } from "../testing/createTwoPeriodSeed.ts";
import { createAccountsSimulator } from "./accountsSimulator.ts";

describe("accounts simulator", () => {
  it("answers the period's parties, whether or not a posting names them", async () => {
    const seed = createSmallSeed();
    const port = createAccountsSimulator({
      ...seed,
      parties: seed.parties.map((list) => {
        return {
          ...list,
          parties: [
            ...list.parties,
            { kind: "supplier", id: "md9", name: "Gamma s.r.l." },
          ],
        };
      }),
    });
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
      "supplier:md9",
    ]);
  });

  it("answers no parties for a period the seed lists none for", async () => {
    const port = createAccountsSimulator({ ...createSmallSeed(), parties: [] });

    expect(await firstValueFrom(port.parties("p1"))).toEqual([]);
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

  it("leaves another period's accounts, parties and withholding codes out", async () => {
    const port = createAccountsSimulator(createTwoPeriodSeed());
    const accounts = await firstValueFrom(port.accounts("p1"));
    const parties = await firstValueFrom(port.parties("p2"));

    expect(await firstValueFrom(port.withholdingTaxes("p2"))).toEqual([]);

    expect(
      accounts.some((account) => {
        return account.periodId === "p2";
      }),
    ).toBe(false);
    expect(
      parties.map((party) => {
        return party.id;
      }),
    ).toEqual(["md1"]);
  });
});
