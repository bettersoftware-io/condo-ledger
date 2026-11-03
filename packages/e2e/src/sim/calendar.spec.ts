import { expect, test } from "#/testing/test.ts";

test.describe("the Calendar, on the simulator", () => {
  test("an installment's deadline opens again when a collection that paid it is deleted in the Journal", async ({
    shell,
    calendar,
    journal,
  }) => {
    await shell.open();
    await shell.openModule("Calendar");
    await calendar.showMonth("January 2026");
    await calendar.selectDay("20 January 2026");

    await expect.poll(calendar.deadlines).toContainEqual({
      description: INSTALLMENT,
      status: "Closed",
    });

    // Fornasier's first part of Installment 1, entry 5 of Pozzetto 2026: on
    // the Journal's first page.
    await shell.openModule("Buildings");
    await shell.selectManagement("2026 (Ordinary)");
    await shell.openScreen("Journal & Daybook");

    expect(await journal.askToDelete(COLLECTION)).toBe(
      `Delete the entry "${COLLECTION}"?`,
    );

    await journal.answer(true);

    // The Calendar keeps its day. The installment was due on 20 January
    // 2026, so open again it is overdue on any day the spec runs.
    await shell.openModule("Calendar");
    await expect.poll(calendar.deadlines).toContainEqual({
      description: INSTALLMENT,
      status: "Overdue",
    });
  });

  test("a deadline added is on its day", async ({ shell, calendar }) => {
    await shell.open();
    await shell.openModule("Calendar");

    await calendar.addDeadline("Lift inspection", "15/12/2026");

    // The save shows the deadline's month and selects it on its day.
    await expect
      .poll(async () => {
        return calendar.dayLines("15 December 2026");
      })
      .toContain("Lift inspection");
    await expect
      .poll(calendar.deadlines)
      .toContainEqual(
        expect.objectContaining({ description: "Lift inspection" }),
      );
  });
});

const INSTALLMENT = "Installment 1 due, Pozzetto 2026";

const COLLECTION =
  "Partial collection of installments from Fornasier Marco: Installment 1 (20/01/2026)";
