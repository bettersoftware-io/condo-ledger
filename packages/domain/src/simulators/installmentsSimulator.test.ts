import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import { type Cents, cents } from "#/entities/cents.ts";
import type { EntryDraft } from "#/entities/journal.ts";
import type { InstallmentsDraft } from "#/ports/installmentsPort.ts";
import type { LegacySeed } from "#/simulators/seed/legacySeed.ts";

import { createScheduleSeed } from "../testing/createScheduleSeed.ts";
import { fixedClock } from "./fixedClock.ts";
import {
  createInstallmentsSimulator,
  type InstallmentsSimulator,
} from "./installmentsSimulator.ts";
import {
  createJournalSimulator,
  type JournalSimulator,
} from "./journalSimulator.ts";

describe("installments simulator", () => {
  it("gives what it creates ids of its own, never a seeded one", async () => {
    const installments = createInstallmentsSimulator(createScheduleSeed());

    await installments.createInstallments("p3", createDraft(["A", "B"]));

    expect(
      (await firstValueFrom(installments.installments("p3"))).map(
        (installment) => {
          return installment.id;
        },
      ),
    ).toEqual(["in-new-1", "in-new-2"]);
    expect(
      (await firstValueFrom(installments.items("p3"))).map((item) => {
        return `${item.id} ${item.installmentId} ${item.residentId}`;
      }),
    ).toEqual([
      "ii-new-1 in-new-1 r31",
      "ii-new-2 in-new-2 r31",
      "ii-new-3 in-new-1 r32",
      "ii-new-4 in-new-2 r32",
      "ii-new-5 in-new-1 r33",
      "ii-new-6 in-new-2 r33",
    ]);
  });

  it("numbers a second batch among the installments it joins, by due date", async () => {
    const installments = createInstallmentsSimulator(createScheduleSeed());

    expect(
      await installments.createInstallments("p1", {
        installments: [
          { name: "Extra", dueDate: "2013-04-30", percentage: 10000 },
        ],
        wholeEuros: false,
      }),
    ).toEqual({ ok: true });
    expect(
      (await firstValueFrom(installments.installments("p1"))).map(
        (installment) => {
          return `${installment.number} ${installment.name}`;
        },
      ),
    ).toEqual(["1 Rata 1", "2 Extra", "3 Rata 2"]);
  });

  it("breaks a tie of due dates by id", async () => {
    const installments = createInstallmentsSimulator(createScheduleSeed());

    await installments.updateInstallment("in1", { dueDate: "2013-06-30" });
    await installments.updateInstallment("in2", { dueDate: "2013-06-30" });

    expect(
      (await firstValueFrom(installments.installments("p1"))).map(
        (installment) => {
          return `${installment.number} ${installment.id}`;
        },
      ),
    ).toEqual(["1 in1", "2 in2"]);
  });

  it("answers its current schedule, and fails for a period it does not have", async () => {
    const installments = createInstallmentsSimulator(createScheduleSeed());

    await installments.setItemAmount("ii3", cents(1));

    expect(installments.current("p1").items).toEqual(
      await firstValueFrom(installments.items("p1")),
    );
    expect(() => {
      return installments.current("p99");
    }).toThrow("missing: the period p99");
  });
});

describe("the installments and journal simulators, each reading the other", () => {
  it("an installment a collection pays refuses delete until the journal deletes the collection; then it goes, and its items with it", async () => {
    const { installments, journal } = createWired(createScheduleSeed());
    const added = await journal.addEntry("p1", createCollection("ii3", 5000));
    const id = added.ok ? added.value.id : "";

    expect(added.ok).toBe(true);
    expect(await installments.deleteInstallment("in2")).toEqual({
      ok: false,
      reason: "installment-paid",
    });
    expect(await installments.setItemAmount("ii3", cents(1))).toEqual({
      ok: false,
      reason: "item-paid",
    });
    expect(await journal.deleteEntry(id)).toEqual({ ok: true });
    expect(await installments.deleteInstallment("in2")).toEqual({ ok: true });
    expect(await journal.addEntry("p1", createCollection("ii3", 5000))).toEqual(
      { ok: false, reason: "unknown-item" },
    );
  });

  it("a collection is judged against an item's amount as it is now", async () => {
    const { installments, journal } = createWired(createScheduleSeed());

    expect(await installments.setItemAmount("ii3", cents(1000))).toEqual({
      ok: true,
    });
    expect(await journal.addEntry("p1", createCollection("ii3", 2000))).toEqual(
      { ok: false, reason: "over-remaining-item" },
    );
    expect(
      await journal.addEntry("p1", createCollection("ii3", 1000)),
    ).toMatchObject({ ok: true });
  });

  it("a collection may pay an item of an installment just created", async () => {
    const { installments, journal } = createWired(createScheduleSeed());

    await installments.createInstallments("p3", createDraft(["A", "B"]));

    expect(
      await journal.addEntry("p3", {
        kind: "collection",
        description: "Incasso Verdi",
        postings: [
          {
            accountId: "y1",
            debit: cents(10000),
            credit: cents(0),
            counterpart: null,
          },
          {
            accountId: "y5",
            debit: cents(0),
            credit: cents(10000),
            counterpart: { kind: "owner", id: "r31" },
            installmentItemId: "ii-new-1",
          },
        ],
      }),
    ).toMatchObject({ ok: true });
    expect(await installments.deleteInstallment("in-new-1")).toEqual({
      ok: false,
      reason: "installment-paid",
    });
  });
});

/** The two simulators over one seed, wired as the client's composition wires them. */
interface Wired {
  installments: InstallmentsSimulator;
  journal: JournalSimulator;
}

function createWired(seed: LegacySeed): Wired {
  const journal: JournalSimulator = createJournalSimulator(
    seed,
    fixedClock("2026-10-14T08:00:00Z"),
    (periodId) => {
      return installments.current(periodId);
    },
  );

  const installments: InstallmentsSimulator = createInstallmentsSimulator(
    seed,
    (periodId) => {
      return journal.current(periodId);
    },
  );

  return { installments, journal };
}

/** Equal parts, due a month apart from 2015-03-28. */
function createDraft(names: string[]): InstallmentsDraft {
  return {
    installments: names.map((name, index) => {
      return {
        name,
        dueDate: `2015-0${index + 3}-28`,
        percentage: 10000 / names.length,
      };
    }),
    wholeEuros: false,
  };
}

/** A collection from p1's r1 into cash, all on r1's item itemId. */
function createCollection(itemId: string, amount: number): EntryDraft {
  const paid: Cents = cents(amount);

  return {
    kind: "collection",
    description: `Incasso ${itemId}`,
    postings: [
      { accountId: "la1", debit: paid, credit: cents(0), counterpart: null },
      {
        accountId: "la5",
        debit: cents(0),
        credit: paid,
        counterpart: { kind: "owner", id: "r1" },
        installmentItemId: itemId,
      },
    ],
  };
}
