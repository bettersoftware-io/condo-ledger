import type { Locator, Page } from "@playwright/test";

import { TESTIDS } from "@cl/client-react/src/ui/testids.ts";

/** A row of the selected day's list, as the person reads it. */
interface DeadlineRow {
  description: string;
  /** The status mark's word: "New", "Closed", "Cancelled" or "Overdue". */
  status: string;
}

/** What a spec can do with, and ask of, the Calendar. */
export interface CalendarPage {
  /** Moves the month with ‹ or › until its title reads this: "January 2026". */
  showMonth: (title: string) => Promise<void>;
  /** Selects a day of the month shown, by the name its cell gives it: "20 January 2026". */
  selectDay: (title: string) => Promise<void>;
  /** The selected day's deadlines, top to bottom, read in one step. */
  deadlines: () => Promise<DeadlineRow[]>;
  /** The descriptions a day's cell in the month shows, top to bottom, read in one step. */
  dayLines: (title: string) => Promise<string[]>;
  /** Adds a deadline through Add Deadline, its description and date (`dd/mm/yyyy`) typed, and resolves when the dialog has closed. */
  addDeadline: (description: string, date: string) => Promise<void>;
}

export function createCalendarPage(page: Page): CalendarPage {
  const screen = page.getByTestId(TESTIDS.calendarScreen);
  const title = screen.getByTestId(TESTIDS.calendarMonthTitle);
  const column = page.getByTestId(TESTIDS.deadlinesColumn);
  const dialog = page.getByTestId(TESTIDS.dialog);

  function dayCell(name: string): Locator {
    return screen.getByTestId(TESTIDS.dayCell).filter({
      has: page.getByRole("button", { name, exact: true }),
    });
  }

  return {
    showMonth: async (wanted: string): Promise<void> => {
      await title.waitFor();

      const shown = (await title.textContent()) ?? "";
      const steps = monthIndex(wanted) - monthIndex(shown);
      const button = screen.getByRole("button", {
        name: steps < 0 ? "Previous month" : "Next month",
        exact: true,
      });

      for (let step = 0; step < Math.abs(steps); step += 1) {
        await button.click();
      }

      await screen
        .getByTestId(TESTIDS.calendarMonthTitle)
        .filter({ hasText: new RegExp(`^${wanted}$`) })
        .waitFor();
    },
    selectDay: async (name: string): Promise<void> => {
      await screen
        .getByTestId(TESTIDS.monthGrid)
        .getByRole("button", { name, exact: true })
        .click();
    },
    deadlines: async (): Promise<DeadlineRow[]> => {
      return column
        .getByTestId(TESTIDS.dayListRow)
        .evaluateAll((rows, markId) => {
          return rows.map((row) => {
            return {
              description:
                row.querySelector(".day-list-text")?.textContent?.trim() ?? "",
              status:
                row
                  .querySelector(`[data-testid="${markId}"]`)
                  ?.getAttribute("title") ?? "",
            };
          });
        }, TESTIDS.calendarMark);
    },
    dayLines: async (name: string): Promise<string[]> => {
      return dayCell(name)
        .getByTestId(TESTIDS.dayLine)
        .evaluateAll((lines) => {
          return lines.map((line) => {
            return (
              line.querySelector(".day-line-text")?.textContent?.trim() ?? ""
            );
          });
        });
    },
    addDeadline: async (description: string, date: string): Promise<void> => {
      await column
        .getByTestId(TESTIDS.deadlinesToolbar)
        .getByRole("button", { name: "Add deadline" })
        .click();
      await dialog
        .getByRole("textbox", { name: "Description" })
        .fill(description);
      await dialog.getByRole("textbox", { name: "Date" }).fill(date);
      await dialog.getByTestId(TESTIDS.formDialogSave).click();
      await dialog.waitFor({ state: "detached" });
    },
  };
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** A month title ("November 2026") as a count of months, so two can be subtracted. */
function monthIndex(title: string): number {
  const [name = "", year = ""] = title.trim().split(" ");
  const month = MONTHS.indexOf(name);

  if (month === -1 || !/^\d{4}$/.test(year)) {
    throw new Error(`not a month title: ${title}`);
  }

  return Number(year) * 12 + month;
}
