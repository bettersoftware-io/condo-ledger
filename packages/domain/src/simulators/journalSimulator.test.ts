import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import { createTwoPeriodSeed } from "../testing/createTwoPeriodSeed.ts";
import { createJournalSimulator } from "./journalSimulator.ts";

describe("journal simulator", () => {
  it("answers a period's entries in number order, however the seed holds them", async () => {
    const seed = createTwoPeriodSeed();
    const held = seed.entries
      .filter((entry) => {
        return entry.periodId === "p1";
      })
      .map((entry) => {
        return entry.number;
      });

    const answered = (
      await firstValueFrom(createJournalSimulator(seed).entries("p1"))
    ).map((entry) => {
      return entry.number;
    });

    expect(held).not.toEqual(answered);
    expect(answered).toEqual(
      [...held].sort((a, b) => {
        return a - b;
      }),
    );
  });

  it("leaves another period's entries out", async () => {
    const entries = await firstValueFrom(
      createJournalSimulator(createTwoPeriodSeed()).entries("p1"),
    );

    expect(
      entries.some((entry) => {
        return entry.id === "x-e1";
      }),
    ).toBe(false);
  });
});
