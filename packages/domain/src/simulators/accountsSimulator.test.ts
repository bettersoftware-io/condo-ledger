import { BehaviorSubject, firstValueFrom, of } from "rxjs";
import { describe, expect, it } from "vitest";

import { cents } from "#/entities/cents.ts";
import type { OwnerParty } from "#/entities/party.ts";

import {
  createSmallBooks,
  createSmallSeed,
} from "../testing/createSmallBooks.ts";
import { createTwoPeriodSeed } from "../testing/createTwoPeriodSeed.ts";
import { createAccountsSimulator } from "./accountsSimulator.ts";

describe("accounts simulator", () => {
  it("answers its current accounts, budget edit included, and fails for a period it does not have", async () => {
    const port = createAccountsSimulator(createSmallSeed());

    await port.setBudget("la21", cents(1234));

    expect(
      port.current("p1").find((account) => {
        return account.id === "la21";
      })?.budget,
    ).toBe(1234);
    expect(() => {
      return port.current("p99");
    }).toThrow("missing: the period p99");
  });

  it("answers the period's parties, whether or not a posting names them: the suppliers first, then the residents", async () => {
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
      "supplier:md9",
      "owner:r1",
      "owner:r2",
      "owner:r3",
    ]);
  });

  it("reads the residents from the reader, emitting the parties again whenever it does", () => {
    const residents$ = new BehaviorSubject<OwnerParty[]>([]);
    const port = createAccountsSimulator(createSmallSeed(), (periodId) => {
      return periodId === "p1" ? residents$ : of([]);
    });
    const seen: string[][] = [];
    const subscription = port.parties("p1").subscribe((parties) => {
      seen.push(
        parties.map((party) => {
          return party.id;
        }),
      );
    });
    const resident = createSmallBooks().parties[2];

    if (resident?.kind !== "owner") {
      throw new Error("missing: the small books' first owner");
    }

    residents$.next([{ ...resident, id: "r-new-1" }]);
    subscription.unsubscribe();

    expect(seen).toEqual([
      ["md1", "md2"],
      ["md1", "md2", "r-new-1"],
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
