import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import { cents } from "#/entities/cents.ts";
import type { EntryDraft, Posting } from "#/entities/journal.ts";
import { fixedClock } from "#/support/clock.ts";
import { romeTime } from "#/support/romeTime.ts";

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

  it("stamps a new entry with the clock, on the Rome wall clock", async () => {
    const port = createJournalSimulator(
      createTwoPeriodSeed(),
      fixedClock("2013-07-01T15:05:51Z"),
    );

    const result = await port.addEntry("p1", createDraft());
    const entries = await firstValueFrom(port.entries("p1"));

    expect(result).toEqual({ ok: true, value: { id: "new1" } });
    expect(entries.at(-1)).toMatchObject({
      id: "new1",
      number: 10,
      at: "2013-07-01T17:05:51",
      invoiceId: null,
    });
  });

  it("keeps the invoice a draft names on the entry it writes", async () => {
    const port = createJournalSimulator(createTwoPeriodSeed());

    await port.addEntry("p1", { ...createDraft(), invoiceId: "li7" });

    expect((await firstValueFrom(port.entries("p1"))).at(-1)?.invoiceId).toBe(
      "li7",
    );
  });

  it("numbers from 1 in a period whose entries carry no positive number", async () => {
    const port = createJournalSimulator(
      createTwoPeriodSeed(),
      fixedClock("2026-01-01T00:00:00Z"),
    );

    await port.addEntry("p2", {
      ...createDraft(),
      postings: [createLine("x1", 100, 0), createLine("x4", 0, 100, "md1")],
    });

    expect(
      (await firstValueFrom(port.entries("p2"))).map((entry) => {
        return entry.number;
      }),
    ).toEqual([0, 1]);
  });

  it("two deletes renumber twice: the last entry ends two numbers lower", async () => {
    const port = createJournalSimulator(createTwoPeriodSeed());

    await port.deleteEntry("e6");
    await port.deleteEntry("e8");

    const numbers = (await firstValueFrom(port.entries("p1"))).map((entry) => {
      return [entry.id, entry.number];
    });

    expect(numbers).toEqual([
      ["e1", 1],
      ["e2", 2],
      ["e3", 3],
      ["e4", 4],
      ["e5", 5],
      ["e7", 6],
      ["e9", 7],
    ]);
  });

  it("the system clock is the default: a stamp of the moment the entry was added", async () => {
    const port = createJournalSimulator(createTwoPeriodSeed());

    const before = Date.now();
    await port.addEntry("p1", createDraft());
    const after = Date.now();

    const stamp = (await firstValueFrom(port.entries("p1"))).at(-1)?.at ?? "";

    expect(stamp >= romeTime(new Date(before))).toBe(true);
    expect(stamp <= romeTime(new Date(after))).toBe(true);
  });
});

function createDraft(): EntryDraft {
  return {
    kind: "generic",
    description: "Spesa in contanti",
    postings: [createLine("la21", 1200, 0), createLine("la1", 0, 1200)],
  };
}

function createLine(
  accountId: string,
  debit: number,
  credit: number,
  supplierId?: string,
): Posting {
  return {
    accountId,
    debit: cents(debit),
    credit: cents(credit),
    counterpart:
      supplierId === undefined ? null : { kind: "supplier", id: supplierId },
  };
}
