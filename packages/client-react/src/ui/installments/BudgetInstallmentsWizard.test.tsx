import { describe, expect, it } from "vitest";

import { createScheduleSeed } from "@cl/domain/testing/createScheduleSeed.ts";

import {
  type InstallmentScheduleScreenPage,
  mountInstallmentSchedule,
} from "./InstallmentScheduleScreen.page.tsx";

describe("BudgetInstallmentsWizard", () => {
  it("creates three installments on a period with none: defaults, a first date, 34/33/33, the review, and three new columns", async () => {
    const page = mountInstallmentSchedule("p3", createScheduleSeed());
    const wizard = await openWizard(page);

    expect(page.grid.headers()).toHaveLength(11);
    expect(wizard.title()).toBe(
      "Create Budget Installments — Step 1: Number and dates",
    );
    expect(wizard.requiredUnannounced()).toEqual([]);
    expect(wizard.fieldValue("Number of installments")).toBe("3");
    expect(wizard.fieldValue("Due date of the first")).toBe("");
    expect(wizard.fieldValue("Months between installments")).toBe("4");
    expect(wizard.isChecked("Round to whole euros")).toBe(false);
    expect(wizard.isNextDisabled()).toBe(true);

    await wizard.fill("Due date of the first", "31/3/2015");

    expect(wizard.dateRead()).toBe("31/03/2015");

    await wizard.next();

    expect(wizard.title()).toBe(
      "Create Budget Installments — Step 2: Installments",
    );
    expect(wizard.rows()).toEqual([
      ["Installment 1", "31/03/2015", "34"],
      ["Installment 2", "31/07/2015", "33"],
      ["Installment 3", "30/11/2015", "33"],
    ]);

    await wizard.fillPercentage(2, "30");

    expect(wizard.message()).toBe("The percentages must add up to 100.");
    expect(wizard.isNextDisabled()).toBe(true);

    await wizard.fillPercentage(2, "33");
    await wizard.next();

    expect(wizard.title()).toBe("Create Budget Installments — Step 3: Review");
    expect(wizard.reviewHeaders()).toEqual([
      "Owner",
      "Total budget",
      "Prev. bal.",
      "Total due",
      "Installment 1",
      "Installment 2",
      "Installment 3",
      "Total inst.",
    ]);
    expect(wizard.reviewResidents()).toEqual(["r31", "r32", "r33"]);
    expect(wizard.reviewRow("r31")).toEqual([
      "600.00",
      "50.00",
      "650.00",
      "254.00",
      "198.00",
      "198.00",
      "650.00",
    ]);
    expect(wizard.reviewRow("r33")).toEqual([
      "99.99",
      "-20.00",
      "79.99",
      "14.00",
      "33.00",
      "33.00",
      "80.00",
    ]);
    expect(wizard.reviewTotal()).toBe("1,030.00");
    expect(wizard.postingsShown()).toBe(false);
    expect(wizard.saveLabel()).toBe("✓ Save");

    await wizard.save();

    expect(wizard.isShown()).toBe(false);
    expect(page.grid.headers().slice(7, 10)).toEqual([
      "1 31/03/2015",
      "2 31/07/2015",
      "3 30/11/2015",
    ]);
    expect(
      page.grid.cell(page.labelOfResident("r33"), "1 31/03/2015").text(),
    ).toBe("14.00");
  });

  it("with Round to whole euros, items 2 on are whole euros and the first takes the rest", async () => {
    const page = mountInstallmentSchedule("p3", createScheduleSeed());
    const wizard = await openWizard(page);

    await wizard.fill("Due date of the first", "31/03/2015");
    await wizard.check("Round to whole euros");
    await wizard.next();
    await wizard.next();

    expect(wizard.reviewRow("r33").slice(3, 6)).toEqual([
      "13.99",
      "33.00",
      "33.00",
    ]);
  });

  it("step 1 says why it cannot go on: the number, the months, the date", async () => {
    const page = mountInstallmentSchedule("p3", createScheduleSeed());
    const wizard = await openWizard(page);

    await wizard.fill("Due date of the first", "31/02/2015");

    expect(wizard.message()).toBe("Enter a due date as day/month/year.");

    await wizard.fill("Due date of the first", "28/02/2015");
    await wizard.fill("Months between installments", "6");

    expect(wizard.message()).toBe(
      "Enter a number of months from 1 to 5 between installments.",
    );

    await wizard.fill("Number of installments", "13");

    expect(wizard.message()).toBe(
      "Enter a number of installments from 1 to 12.",
    );
    expect(wizard.isNextDisabled()).toBe(true);
  });

  it("is refused on a period with no budget allocation entry", async () => {
    const page = mountInstallmentSchedule("p2", createScheduleSeed());
    const wizard = await openWizard(page);

    await wizard.fill("Due date of the first", "31/03/2015");

    expect(wizard.message()).toBe(
      "This period has no budget allocation entry to share out.",
    );
    expect(wizard.isNextDisabled()).toBe(true);
  });

  it("on p36, names the new rows after the twelve, refuses a name the period has, and Back keeps step 1", async () => {
    const page = mountInstallmentSchedule("p36");
    const wizard = await openWizard(page);

    await wizard.fill("Number of installments", "2");
    await wizard.fill("Due date of the first", "15/12/2013");
    await wizard.next();

    expect(wizard.rows()).toEqual([
      ["Installment 13", "15/12/2013", "50"],
      ["Installment 14", "15/04/2014", "50"],
    ]);

    await wizard.fillName(0, "Installment 1");

    expect(wizard.message()).toBe(
      "Another installment of this period already has this name.",
    );

    await wizard.fillName(0, " ");

    expect(wizard.message()).toBe("An installment needs a name.");

    await wizard.back();

    expect(wizard.fieldValue("Number of installments")).toBe("2");
    expect(wizard.fieldValue("Due date of the first")).toBe("15/12/2013");
  });

  it("Cancel closes it and writes nothing", async () => {
    const page = mountInstallmentSchedule("p3", createScheduleSeed());
    const wizard = await openWizard(page);

    await wizard.fill("Due date of the first", "31/03/2015");
    await wizard.next();
    await wizard.next();
    await wizard.cancel();

    expect(wizard.isShown()).toBe(false);
    expect(page.grid.headers()).toHaveLength(11);
  });
});

/** Opens the wizard from the Add installments menu. */
async function openWizard(
  page: InstallmentScheduleScreenPage,
): Promise<InstallmentScheduleScreenPage["budgetWizard"]> {
  await page.toolbar.clickTool("Add installments");
  await page.toolbar.clickMenuItem("Create budget installments");

  return page.budgetWizard;
}
