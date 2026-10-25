import { afterEach, describe, expect, it } from "vitest";

import {
  type Cents,
  cents,
  type InstallmentItem,
  type InstallmentsDraft,
  ok,
  type Result,
  rejected,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";
import { createScheduleSeed } from "@cl/domain/testing/createScheduleSeed.ts";

import { type AppHarness, createAppHarness } from "#/testing/appHarness.ts";
import { currentBooks } from "#/testing/harnessBooks.ts";

import {
  type BudgetInstallmentsForm,
  type BudgetInstallmentsSummary,
  createBudgetInstallmentsWizard,
  type InstallmentRowForm,
  type ReviewRow,
} from "./budgetInstallmentsWizard.ts";
import type { WizardMachine } from "./wizard.ts";

afterEach(() => {
  for (const machine of created.splice(0)) {
    machine.dispose();
  }
});

describe("the Create budget installments wizard", () => {
  it("starts on step 1 of 3: three installments four months apart, no date yet, to the cent, named and shared 34/33/33", () => {
    const { machine } = createWizard();

    expect(machine.state$.getValue()).toMatchObject({
      step: 1,
      firstStep: 1,
      stepCount: 3,
      editing: null,
      choices: [],
      preview: [],
      form: {
        count: "3",
        firstDue: "",
        months: "4",
        wholeEuros: false,
        rows: [
          createRow("Installment 1", "34"),
          createRow("Installment 2", "33"),
          createRow("Installment 3", "33"),
        ],
      },
      stepVerdict: { ok: false, reason: "invalid-due-date" },
      verdict: { ok: false, reason: "invalid-due-date" },
      summary: { dueDates: [], review: [], total: 0 },
      touched: false,
      saving: false,
    });
  });

  it("step 1 is no-budget-allocation in a period without a budget allocation entry, and with no period", () => {
    const harness = createScheduleHarness("p2");
    const machine = track(
      harness.app.machines.createBudgetInstallmentsWizard(),
    );

    expect(stepReasonAfter(machine, { firstDue: "2014-03-31" })).toBe(
      "no-budget-allocation",
    );

    const without = track(createBudgetInstallmentsWizard(null, neverWrite));

    expect(stepReasonAfter(without, { firstDue: "2014-03-31" })).toBe(
      "no-budget-allocation",
    );
  });

  it.each([
    ["0", "count-out-of-range"],
    ["13", "count-out-of-range"],
    ["", "count-out-of-range"],
    ["2.5", "count-out-of-range"],
    ["x", "count-out-of-range"],
    ["1", null],
    ["12", null],
  ])(
    "step 1 answers the number of installments %j with %s",
    (count, reason) => {
      const { machine } = createWizard();

      machine.intents.edit({ firstDue: "2015-03-31" });

      expect(stepReasonAfter(machine, { count })).toBe(reason);
    },
  );

  it.each([
    ["0", "months-out-of-range"],
    ["6", "months-out-of-range"],
    ["", "months-out-of-range"],
    ["1.5", "months-out-of-range"],
    ["1", null],
    ["5", null],
  ])(
    "step 1 answers the months between installments %j with %s",
    (months, reason) => {
      const { machine } = createWizard();

      machine.intents.edit({ firstDue: "2015-03-31" });

      expect(stepReasonAfter(machine, { months })).toBe(reason);
    },
  );

  it.each([
    ["", "invalid-due-date"],
    ["2015-02-30", "invalid-due-date"],
    ["31/03/2015", "invalid-due-date"],
    ["2016-02-29", null],
  ])("step 1 answers the first due date %j with %s", (firstDue, reason) => {
    const { machine } = createWizard();

    expect(stepReasonAfter(machine, { firstDue })).toBe(reason);
  });

  it("step 1 answers its reasons in order: the budget allocation, the number, the months, the date", () => {
    const { machine } = createWizard();

    expect(stepReasonAfter(machine, { count: "0", months: "0" })).toBe(
      "count-out-of-range",
    );
    expect(stepReasonAfter(machine, { count: "2" })).toBe(
      "months-out-of-range",
    );
    expect(stepReasonAfter(machine, { months: "1" })).toBe("invalid-due-date");
  });

  it("Next waits for step 1, then moves on; Back returns", () => {
    const { machine } = createWizard();

    machine.intents.next();
    expect(machine.state$.getValue().step).toBe(1);

    machine.intents.edit({ firstDue: "2015-03-31" });
    machine.intents.next();
    expect(machine.state$.getValue().step).toBe(2);

    machine.intents.back();
    expect(machine.state$.getValue().step).toBe(1);
  });

  it("the rows follow the number: a new number resets the percentages and keeps a typed name", () => {
    const { machine } = createWizard();

    machine.intents.edit({ count: "4" });
    expect(machine.state$.getValue().form.rows).toEqual([
      createRow("Installment 1", "25"),
      createRow("Installment 2", "25"),
      createRow("Installment 3", "25"),
      createRow("Installment 4", "25"),
    ]);

    machine.intents.edit({
      rows: [
        createRow("First", "40"),
        createRow("Installment 2", "20"),
        createRow("Installment 3", "20"),
        createRow("Installment 4", "20"),
      ],
    });
    machine.intents.edit({ count: "2" });
    expect(machine.state$.getValue().form.rows).toEqual([
      createRow("First", "50"),
      createRow("Installment 2", "50"),
    ]);

    machine.intents.edit({ count: "12" });
    expect(
      machine.state$.getValue().form.rows.map((row) => {
        return row.percentage;
      }),
    ).toEqual(["12", ...Array<string>(11).fill("8")]);
    expect(machine.state$.getValue().form.rows[0]?.name).toBe("First");
    expect(machine.state$.getValue().form.rows[11]?.name).toBe(
      "Installment 12",
    );
  });

  it("a number out of range, or the same number again, leaves the rows as they are", () => {
    const { machine } = createWizard();
    const typed = [
      createRow("A", "50"),
      createRow("B", "30"),
      createRow("C", "20"),
    ];

    machine.intents.edit({ rows: typed });
    machine.intents.edit({ count: "13" });
    expect(machine.state$.getValue().form.rows).toEqual(typed);

    machine.intents.edit({ count: "" });
    expect(machine.state$.getValue().form.rows).toEqual(typed);

    machine.intents.edit({ count: "3", firstDue: "2015-03-31" });
    expect(machine.state$.getValue().form.rows).toEqual(typed);
  });

  it("refuses rows that are not as many as the number, rows-not-count, and Save writes nothing", async () => {
    const harness = createScheduleHarness("p3");
    let writes = 0;
    const machine = track(
      createBudgetInstallmentsWizard(currentBooks(harness), () => {
        writes += 1;

        return Promise.resolve(ok());
      }),
    );

    machine.intents.edit({ firstDue: "2015-03-31" });
    machine.intents.edit({
      rows: [
        createRow("Installment 1", "50"),
        createRow("Installment 2", "50"),
      ],
    });

    expect(machine.state$.getValue()).toMatchObject({
      form: { count: "3" },
      verdict: { ok: false, reason: "rows-not-count" },
      summary: { review: [], total: 0 },
    });
    await expect(machine.intents.save()).resolves.toEqual({
      ok: false,
      reason: "rows-not-count",
    });
    expect(writes).toBe(0);
  });

  it("names a new installment after those the period already has", () => {
    const harness = createAppHarness();

    harness.app.presenters.buildings.selectPeriod("p36");

    const machine = track(
      harness.app.machines.createBudgetInstallmentsWizard(),
    );

    expect(
      machine.state$.getValue().form.rows.map((row) => {
        return row.name;
      }),
    ).toEqual(["Installment 13", "Installment 14", "Installment 15"]);
  });

  it("derives the due dates from the first, months apart, the day clamped to the month's last", () => {
    const { machine } = createWizard();

    machine.intents.edit({ firstDue: "2015-01-31", months: "1" });

    expect(machine.state$.getValue().summary.dueDates).toEqual([
      "2015-01-31",
      "2015-02-28",
      "2015-03-31",
    ]);

    machine.intents.edit({ months: "9" });
    expect(machine.state$.getValue().summary.dueDates).toEqual([]);
  });

  it("step 2 is percentages-not-100 until the percentages add up to 100", () => {
    const { machine } = createWizard();

    machine.intents.edit({ firstDue: "2015-03-31" });
    machine.intents.next();

    expect(
      stepReasonAfter(machine, {
        rows: [
          createRow("Installment 1", "34"),
          createRow("Installment 2", "33"),
          createRow("Installment 3", "32.99"),
        ],
      }),
    ).toBe("percentages-not-100");

    machine.intents.next();
    expect(machine.state$.getValue().step).toBe(2);

    expect(
      stepReasonAfter(machine, {
        rows: [
          createRow("Installment 1", "33.34"),
          createRow("Installment 2", "33.33"),
          createRow("Installment 3", "33.33"),
        ],
      }),
    ).toBeNull();

    machine.intents.next();
    expect(machine.state$.getValue().step).toBe(3);
  });

  it("step 2 is name-taken for a name the period holds or the batch repeats, and blank-name for a blank one", () => {
    const { machine } = createWizard();

    machine.intents.edit({ firstDue: "2015-03-31" });
    machine.intents.next();

    expect(
      stepReasonAfter(machine, {
        rows: [
          createRow("Twice", "34"),
          createRow("Twice", "33"),
          createRow("Installment 3", "33"),
        ],
      }),
    ).toBe("name-taken");
    expect(
      stepReasonAfter(machine, {
        rows: [
          createRow(" ", "34"),
          createRow("Installment 2", "33"),
          createRow("Installment 3", "33"),
        ],
      }),
    ).toBe("blank-name");

    const harness = createAppHarness();
    const saturno = track(
      harness.app.machines.createBudgetInstallmentsWizard(),
    );

    saturno.intents.edit({ firstDue: "2011-12-15" });
    saturno.intents.next();
    expect(
      stepReasonAfter(saturno, {
        rows: [
          createRow("Rata nr. 2", "34"),
          createRow("Installment 5", "33"),
          createRow("Installment 6", "33"),
        ],
      }),
    ).toBe("name-taken");
  });

  it.each([
    ["abc", "not-a-percentage"],
    ["33.333", "not-a-percentage"],
    ["", "not-a-percentage"],
    ["1,5", "not-a-percentage"],
    ["-5", "negative-percentage"],
  ])("step 2 answers a percentage %j with %s", (percentage, reason) => {
    const { machine } = createWizard();

    machine.intents.edit({ firstDue: "2015-03-31" });
    machine.intents.next();

    expect(
      stepReasonAfter(machine, {
        rows: [
          createRow("Installment 1", "34"),
          createRow("Installment 2", "33"),
          createRow("Installment 3", percentage),
        ],
      }),
    ).toBe(reason);
  });

  it("reads a percentage to hundredths of a percent exactly: 33.33 is 3333, 8 is 800, 0.1 is 10", async () => {
    const harness = createScheduleHarness("p3");
    const drafts: InstallmentsDraft[] = [];
    const machine = track(
      createBudgetInstallmentsWizard(currentBooks(harness), (draft) => {
        drafts.push(draft);

        return Promise.resolve(ok());
      }),
    );

    machine.intents.edit({
      count: "4",
      firstDue: "2015-03-31",
      months: "1",
      wholeEuros: true,
    });
    machine.intents.edit({
      rows: [
        createRow(" Installment 1 ", "33.33"),
        createRow("Installment 2", "8"),
        createRow("Installment 3", "0.1"),
        createRow("Installment 4", "58.57"),
      ],
    });

    await expect(machine.intents.save()).resolves.toEqual({ ok: true });
    expect(drafts).toEqual([
      {
        installments: [
          {
            name: " Installment 1 ",
            dueDate: "2015-03-31",
            percentage: 3333,
          },
          { name: "Installment 2", dueDate: "2015-04-30", percentage: 800 },
          { name: "Installment 3", dueDate: "2015-05-31", percentage: 10 },
          { name: "Installment 4", dueDate: "2015-06-30", percentage: 5857 },
        ],
        wholeEuros: true,
      },
    ]);
  });

  it("step 3 reviews each resident's items; Save writes them, and the port then holds the same, to the cent", async () => {
    const harness = createScheduleHarness("p3");
    const machine = track(
      harness.app.machines.createBudgetInstallmentsWizard(),
    );

    machine.intents.edit({ count: "2", firstDue: "2015-03-31", months: "1" });
    machine.intents.next();
    machine.intents.next();

    const state = machine.state$.getValue();

    expect(state.step).toBe(3);
    expect(state.summary).toEqual({
      dueDates: ["2015-03-31", "2015-04-30"],
      review: [
        createReview("r31", "A01 Verdi Luca", 60000, 5000, [35000, 30000]),
        createReview("r32", "A02 Neri Paola", 30000, 0, [15000, 15000]),
        createReview("r33", "B01 Gialli Carla", 9999, -2000, [3000, 5000]),
      ],
      total: cents(103000),
    });

    await expect(machine.intents.save()).resolves.toEqual({ ok: true });
    expect(savedItems(harness, ["2015-03-31", "2015-04-30"])).toEqual(
      reviewedItems(state.summary.review),
    );
  });

  it.each([
    [false, "3", "33.34", "33.33", "33.33"],
    [true, "3", "33.34", "33.33", "33.33"],
    [true, "3", "12.5", "50", "37.5"],
  ])(
    "over p36's schedule (whole euros: %s), the review is what the port saves, to the cent",
    async (wholeEuros, count, ...percentages) => {
      const harness = createAppHarness();

      harness.app.presenters.buildings.selectPeriod("p36");

      const machine = track(
        harness.app.machines.createBudgetInstallmentsWizard(),
      );

      machine.intents.edit({
        count,
        firstDue: "2014-01-31",
        months: "1",
        wholeEuros,
      });
      machine.intents.edit({
        rows: machine.state$.getValue().form.rows.map((row, index) => {
          return { ...row, percentage: must(percentages[index], "a share") };
        }),
      });

      const { summary, verdict } = machine.state$.getValue();

      expect(verdict).toEqual({ ok: true });
      expect(summary.review).toHaveLength(27);

      await expect(machine.intents.save()).resolves.toEqual({ ok: true });
      expect(savedItems(harness, summary.dueDates)).toEqual(
        reviewedItems(summary.review),
      );
    },
  );

  it("over p36's schedule, a second batch gives r170, whose items already cover what it owes, all zeros", () => {
    const harness = createAppHarness();

    harness.app.presenters.buildings.selectPeriod("p36");

    const machine = track(
      harness.app.machines.createBudgetInstallmentsWizard(),
    );

    machine.intents.edit({ count: "2", firstDue: "2014-01-31", months: "1" });

    const review = machine.state$.getValue().summary.review;
    const r170 = must(
      review.find((row) => {
        return row.residentId === "r170";
      }),
      "r170's review",
    );

    expect(r170.items).toEqual([0, 0]);
    expect(r170.total).toBe(0);
    expect(
      review.some((row) => {
        return row.total > 0;
      }),
    ).toBe(true);
  });

  it("Save writes nothing while the form is refused, and nothing twice while a save runs", async () => {
    const harness = createScheduleHarness("p3");
    let writes = 0;

    const resolvers: ((result: Result) => void)[] = [];

    const machine = track(
      createBudgetInstallmentsWizard(currentBooks(harness), () => {
        writes += 1;

        return new Promise<Result>((resolve) => {
          resolvers.push(resolve);
        });
      }),
    );

    await expect(machine.intents.save()).resolves.toEqual({
      ok: false,
      reason: "invalid-due-date",
    });
    expect(writes).toBe(0);

    machine.intents.edit({ firstDue: "2015-03-31" });

    const first = machine.intents.save();

    expect(machine.state$.getValue().saving).toBe(true);
    await expect(machine.intents.save()).resolves.toEqual({
      ok: false,
      reason: "saving",
    });

    must(resolvers[0], "the running save")(ok());
    await expect(first).resolves.toEqual({ ok: true });
    expect(writes).toBe(1);
    expect(machine.state$.getValue().saving).toBe(false);
  });

  it("after a refused save, reads the schedule again: a name the period took meanwhile is name-taken", async () => {
    const harness = createScheduleHarness("p3");
    const machine = track(
      harness.app.machines.createBudgetInstallmentsWizard(),
    );

    machine.intents.edit({ count: "2", firstDue: "2015-03-31", months: "1" });
    expect(machine.state$.getValue().verdict).toEqual({ ok: true });

    await harness.ports.installments.createInstallments("p3", {
      installments: [
        { name: "Installment 2", dueDate: "2015-02-28", percentage: 10000 },
      ],
      wholeEuros: false,
    });

    await expect(machine.intents.save()).resolves.toEqual({
      ok: false,
      reason: "name-taken",
    });
    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: false, reason: "name-taken" },
      form: { count: "2", firstDue: "2015-03-31" },
    });
  });

  it("with no period, Save is refused without a write", async () => {
    let writes = 0;
    const machine = track(
      createBudgetInstallmentsWizard(null, () => {
        writes += 1;

        return Promise.resolve(rejected("never"));
      }),
    );

    machine.intents.edit({ firstDue: "2015-03-31" });

    await expect(machine.intents.save()).resolves.toEqual({
      ok: false,
      reason: "no-budget-allocation",
    });
    expect(writes).toBe(0);
    expect(machine.state$.getValue().summary).toEqual({
      dueDates: ["2015-03-31", "2015-07-31", "2015-11-30"],
      review: [],
      total: 0,
    });
  });
});

type Wizard = WizardMachine<
  BudgetInstallmentsForm,
  BudgetInstallmentsSummary,
  Result
>;

interface CreatedWizard {
  machine: Wizard;
  harness: AppHarness;
}

/** The wizard over the empty-schedule period p3. */
function createWizard(): CreatedWizard {
  const harness = createScheduleHarness("p3");

  return {
    machine: track(harness.app.machines.createBudgetInstallmentsWizard()),
    harness,
  };
}

/** The harness over the schedule seed, on the period named. */
function createScheduleHarness(periodId: string): AppHarness {
  const harness = createAppHarness(createScheduleSeed());

  harness.app.presenters.buildings.selectPeriod(periodId);

  return harness;
}

function createRow(name: string, percentage: string): InstallmentRowForm {
  return { name, percentage };
}

function createReview(
  residentId: string,
  label: string,
  budget: number,
  previousBalance: number,
  items: number[],
): ReviewRow {
  return {
    residentId,
    label,
    budget: cents(budget),
    previousBalance: cents(previousBalance),
    due: cents(budget + previousBalance),
    items: items.map((amount) => {
      return cents(amount);
    }),
    total: cents(
      items.reduce((sum, amount) => {
        return sum + amount;
      }, 0),
    ),
  };
}

/** The current step's reason after the patch; null when it passes. */
function stepReasonAfter(
  machine: Wizard,
  patch: Partial<BudgetInstallmentsForm>,
): string | null {
  machine.intents.edit(patch);

  const verdict = machine.state$.getValue().stepVerdict;

  return verdict.ok ? null : verdict.reason;
}

/** By resident, the amounts of the review's items, in installment order. */
function reviewedItems(review: ReviewRow[]): Map<string, Cents[]> {
  return new Map(
    review.map((row) => {
      return [row.residentId, row.items];
    }),
  );
}

/** By resident, the amounts the port holds on the new installments due on these dates, in date order. */
function savedItems(
  harness: AppHarness,
  dates: readonly string[],
): Map<string, Cents[]> {
  const books = currentBooks(harness);
  const created = dates.map((dueDate) => {
    return must(
      books.installments.find((installment) => {
        return (
          installment.dueDate === dueDate &&
          installment.id.startsWith("in-new-")
        );
      }),
      `the new installment due ${dueDate}`,
    );
  });
  const byResident = new Map<string, Cents[]>();

  for (const installment of created) {
    for (const item of itemsOf(books.installmentItems, installment.id)) {
      byResident.set(item.residentId, [
        ...(byResident.get(item.residentId) ?? []),
        item.amount,
      ]);
    }
  }

  return byResident;
}

function itemsOf(
  items: InstallmentItem[],
  installmentId: string,
): InstallmentItem[] {
  return items.filter((item) => {
    return item.installmentId === installmentId;
  });
}

function track(machine: Wizard): Wizard {
  created.push(machine);

  return machine;
}

function neverWrite(): Promise<Result> {
  return Promise.resolve(rejected("never"));
}

const created: Wizard[] = [];
