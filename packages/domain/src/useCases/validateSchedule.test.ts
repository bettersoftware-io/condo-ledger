import { describe, expect, it } from "vitest";

import { type Cents, cents } from "../entities/cents.ts";
import type { Installment, InstallmentItem } from "../entities/installment.ts";
import type { JournalEntry } from "../entities/journal.ts";
import { legacySeedData } from "../simulators/seed/legacySeed.generated.ts";
import { loadLegacySeed } from "../simulators/seed/legacySeed.ts";
import { must } from "../support/must.ts";
import type { PlannedInstallment } from "./planInstallments.ts";
import {
  type ScheduleContext,
  validateCreate,
  validateDelete,
  validateItemAmount,
  validateUpdate,
} from "./validateSchedule.ts";

describe("validateCreate", () => {
  it("accepts a batch of 100% over a period with a budget allocation", () => {
    expect(
      validateCreate(createContext(), [
        createPlanned("Installment 1", 6000),
        createPlanned("Installment 2", 4000),
      ]),
    ).toEqual({ ok: true });
  });

  it.each([
    ["no-budget-allocation", false, [createPlanned("A", 10000)]],
    ["no-installments", true, []],
    ["blank-name", true, [createPlanned("  ", 10000)]],
    ["name-taken", true, [createPlanned("Rata 1", 10000)]],
    [
      "name-taken",
      true,
      [createPlanned("New", 5000), createPlanned("New", 5000)],
    ],
    [
      "negative-percentage",
      true,
      [createPlanned("A", 12000), createPlanned("B", -2000)],
    ],
    ["percentages-not-100", true, [createPlanned("A", 9999)]],
  ])("refuses %s", (reason, budgetFound, planned) => {
    expect(
      validateCreate({ ...createContext(), budgetFound }, planned),
    ).toEqual({ ok: false, reason });
  });

  it("answers the reasons in their order", () => {
    const context = createContext();

    expect(validateCreate({ ...context, budgetFound: false }, [])).toEqual({
      ok: false,
      reason: "no-budget-allocation",
    });
    expect(validateCreate(context, [])).toEqual({
      ok: false,
      reason: "no-installments",
    });
    expect(
      validateCreate(context, [
        createPlanned("", 5000),
        createPlanned("Rata 1", -1),
      ]),
    ).toEqual({ ok: false, reason: "blank-name" });
    expect(validateCreate(context, [createPlanned("Rata 1", -1)])).toEqual({
      ok: false,
      reason: "name-taken",
    });
    expect(validateCreate(context, [createPlanned("X", -1)])).toEqual({
      ok: false,
      reason: "negative-percentage",
    });
  });
});

describe("validateUpdate", () => {
  it("accepts a rename to a free name and a new due date", () => {
    expect(
      validateUpdate(createContext(), "in1", {
        name: "Renamed",
        dueDate: "2011-03-01",
      }),
    ).toEqual({ ok: true });
  });

  it("accepts keeping the installment's own name", () => {
    expect(validateUpdate(createContext(), "in1", { name: "Rata 1" })).toEqual({
      ok: true,
    });
  });

  it("refuses a blank name", () => {
    expect(validateUpdate(createContext(), "in1", { name: " " })).toEqual({
      ok: false,
      reason: "blank-name",
    });
  });

  it("refuses another installment's name", () => {
    expect(validateUpdate(createContext(), "in1", { name: "Rata 2" })).toEqual({
      ok: false,
      reason: "name-taken",
    });
  });

  it("refuses a rename or a new due date of a locked installment", () => {
    const locked = { reason: "installment-locked", ok: false };

    expect(validateUpdate(createContext(), "in2", { name: "Other" })).toEqual(
      locked,
    );
    expect(
      validateUpdate(createContext(), "in2", { dueDate: "2011-09-01" }),
    ).toEqual(locked);
  });

  it("accepts unlocking a locked installment, and a patch that changes nothing of it", () => {
    expect(validateUpdate(createContext(), "in2", { locked: false })).toEqual({
      ok: true,
    });
    expect(
      validateUpdate(createContext(), "in2", {
        name: "Rata 2",
        dueDate: "2011-06-01",
        locked: true,
      }),
    ).toEqual({ ok: true });
  });

  it("refuses a blank name before a locked installment", () => {
    expect(validateUpdate(createContext(), "in2", { name: "" })).toEqual({
      ok: false,
      reason: "blank-name",
    });
  });

  it("throws for an installment the period does not hold", () => {
    expect(() => {
      return validateUpdate(createContext(), "in99", { locked: true });
    }).toThrow("missing: the installment in99");
  });
});

describe("validateDelete", () => {
  it("accepts an unlocked installment with nothing paid", () => {
    expect(validateDelete(createContext(), "in3")).toEqual({ ok: true });
  });

  it("refuses a locked installment", () => {
    expect(validateDelete(createContext(), "in2")).toEqual({
      ok: false,
      reason: "installment-locked",
    });
  });

  it("refuses an installment with a paid item", () => {
    expect(validateDelete(createContext(), "in1")).toEqual({
      ok: false,
      reason: "installment-paid",
    });
  });

  it("refuses a locked installment before a paid one", () => {
    const context = createContext();
    const lockedAndPaid = {
      ...context,
      installments: context.installments.map((installment) => {
        return { ...installment, locked: true };
      }),
    };

    expect(validateDelete(lockedAndPaid, "in1")).toEqual({
      ok: false,
      reason: "installment-locked",
    });
  });

  it("throws for an installment the period does not hold", () => {
    expect(() => {
      return validateDelete(createContext(), "in99");
    }).toThrow("missing: the installment in99");
  });
});

describe("validateItemAmount", () => {
  it("accepts a new amount for an unpaid item of an unlocked installment, zero included", () => {
    expect(validateItemAmount(createContext(), "ii3", cents(0))).toEqual({
      ok: true,
    });
    expect(validateItemAmount(createContext(), "ii3", cents(1234))).toEqual({
      ok: true,
    });
  });

  it("refuses a negative amount", () => {
    expect(validateItemAmount(createContext(), "ii3", cents(-1))).toEqual({
      ok: false,
      reason: "negative-amount",
    });
  });

  it("refuses an item of a locked installment", () => {
    expect(validateItemAmount(createContext(), "ii2", cents(10))).toEqual({
      ok: false,
      reason: "installment-locked",
    });
  });

  it("refuses a paid item", () => {
    expect(validateItemAmount(createContext(), "ii1", cents(10))).toEqual({
      ok: false,
      reason: "item-paid",
    });
  });

  it("answers negative-amount before locked, and locked before paid", () => {
    const context = createContext();
    const lockedAndPaid = {
      ...context,
      installments: context.installments.map((installment) => {
        return { ...installment, locked: true };
      }),
    };

    expect(validateItemAmount(lockedAndPaid, "ii1", cents(-1))).toEqual({
      ok: false,
      reason: "negative-amount",
    });
    expect(validateItemAmount(lockedAndPaid, "ii1", cents(1))).toEqual({
      ok: false,
      reason: "installment-locked",
    });
  });

  it("throws for an item the period does not hold", () => {
    expect(() => {
      return validateItemAmount(createContext(), "ii99", cents(1));
    }).toThrow("missing: the installment item ii99");
  });
});

describe("the rules on the seed", () => {
  it("refuses Pozzetto 2013's partly paid ii789 item-paid, and accepts a zero item of it", () => {
    const context = createSeedContext("p36");
    const zero = must(
      context.items.find((item) => {
        return item.amount === 0;
      }),
      "a zero item of p36",
    );

    expect(validateItemAmount(context, "ii789", cents(1))).toEqual({
      ok: false,
      reason: "item-paid",
    });
    expect(validateItemAmount(context, zero.id, cents(1))).toEqual({
      ok: true,
    });
  });

  it("refuses to delete Pozzetto 2013's installment that holds ii789", () => {
    const context = createSeedContext("p36");
    const holder = must(
      context.items.find((item) => {
        return item.id === "ii789";
      }),
      "ii789",
    );
    const reason = validateDelete(context, holder.installmentId);

    expect(reason.ok).toBe(false);
  });
});

const seed = loadLegacySeed(legacySeedData);

function createSeedContext(periodId: string): ScheduleContext {
  const installments = seed.installments.filter((installment) => {
    return installment.periodId === periodId;
  });

  const ids = new Set(
    installments.map((installment) => {
      return installment.id;
    }),
  );

  return {
    installments,
    items: seed.installmentItems.filter((item) => {
      return ids.has(item.installmentId);
    }),
    entries: seed.entries.filter((entry) => {
      return entry.periodId === periodId;
    }),
    budgetFound: true,
  };
}

/** in1 unlocked with a paid item ii1; in2 locked; in3 unlocked with nothing paid. */
function createContext(): ScheduleContext {
  return {
    installments: [
      createInstallment("in1", 1, "Rata 1", false),
      createInstallment("in2", 2, "Rata 2", true),
      createInstallment("in3", 3, "Rata 3", false),
    ],
    items: [
      createItem("ii1", "in1", cents(1000)),
      createItem("ii2", "in2", cents(1000)),
      createItem("ii3", "in3", cents(1000)),
    ],
    entries: [createCollection("ii1", cents(400))],
    budgetFound: true,
  };
}

function createPlanned(name: string, percentage: number): PlannedInstallment {
  return { name, dueDate: "2011-01-01", percentage };
}

function createInstallment(
  id: string,
  number: number,
  name: string,
  locked: boolean,
): Installment {
  return {
    id,
    periodId: "p",
    number,
    name,
    dueDate: `2011-0${number * 3}-01`,
    locked,
  };
}

function createItem(
  id: string,
  installmentId: string,
  amount: Cents,
): InstallmentItem {
  return { id, installmentId, residentId: "r1", amount };
}

function createCollection(itemId: string, credit: Cents): JournalEntry {
  return {
    id: "tx1",
    periodId: "p",
    number: 1,
    at: "2011-01-01T00:00:00Z",
    kind: "collection",
    description: "collection",
    invoiceId: null,
    postings: [
      {
        accountId: "la4",
        debit: cents(0),
        credit,
        counterpart: { kind: "owner", id: "r1" },
        installmentItemId: itemId,
      },
    ],
  };
}
