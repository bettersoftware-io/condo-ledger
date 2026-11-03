import { act, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import { type DeadlineDraft, fixedClock } from "@cl/domain";
import { createViewModel, ViewModelProvider } from "@cl/react-bindings";

import { AppRoot } from "../shell/AppRoot.tsx";
import { TESTIDS } from "../testids.ts";

/** A deadline's line in a day cell, as drawn. */
interface LineShown {
  /** ✦, ✓, ✕ or !. */
  mark: string;
  /** The status the mark stands for: new, closed, cancelled or overdue. */
  status: string;
  /** The time drawn before the description; null for one with none. */
  time: string | null;
  text: string;
  /** The tooltip: the whole description. */
  tooltip: string;
  /** The class that sets the line's colour: `calendar-installments`. */
  colourClass: string | null;
  /** Whether it is the selected deadline. */
  selected: boolean;
}

/** A row of the Calendars popover. */
interface CalendarRowShown {
  name: string;
  shown: boolean;
  /** The class that colours its square. */
  colourClass: string | null;
}

/** A view of the footer. */
interface ViewShown {
  /** "Monthly", "Weekly" or "List". */
  name: string;
  /** ● for the view on screen, ○ for another. */
  glyph: string;
  active: boolean;
  disabled: boolean;
  /** Its tooltip; null for none. */
  title: string | null;
}

/** What a test can do with, and ask of, the Calendar screen. */
export interface CalendarScreenPage {
  /** The title of the main area's first panel. */
  panelTitle: () => string;
  /** "November 2026". */
  monthTitle: () => string;
  clickPrevious: () => Promise<void>;
  clickNext: () => Promise<void>;
  clickToday: () => Promise<void>;
  weekdays: () => string[];
  /** The day numbers week by week, "" for a day of the months around. */
  weeks: () => string[][];
  /** The ISO day of the selected cell; null when none is. */
  selectedDay: () => string | null;
  /** The ISO day ringed as today; null when the month does not hold it. */
  today: () => string | null;
  /** The weekday column a day sits in, 0 for Monday. */
  weekdayOf: (day: string) => number;
  lines: (day: string) => LineShown[];
  /** The cell's "+N more"; null when every line fits. */
  more: (day: string) => string | null;
  /** The text of the line drawn selected; null when none is. */
  selectedLine: () => string | null;
  clickDay: (day: string) => Promise<void>;
  /** Clicks the line of the day whose text starts with this. */
  clickLine: (day: string, text: string) => Promise<void>;
  clickMore: (day: string) => Promise<void>;
  /** The badge on the Calendars button. */
  calendarsCount: () => string;
  openCalendars: () => Promise<void>;
  isCalendarsOpen: () => boolean;
  /** The popover's label, as written: CSS draws it in capitals. */
  calendarsLabel: () => string;
  calendarRows: () => CalendarRowShown[];
  toggleCalendar: (name: string) => Promise<void>;
  clickAllCalendars: () => Promise<void>;
  clickNoCalendars: () => Promise<void>;
  closeCalendars: () => Promise<void>;
  /** The visible label before the Building select. */
  buildingLabel: () => string;
  buildingOptions: () => string[];
  /** The value drawn over the Building select. */
  building: () => string;
  chooseBuilding: (label: string) => Promise<void>;
  clickRefresh: () => Promise<void>;
  toasts: () => string[];
  views: () => ViewShown[];
  /** Adds a deadline through the port, as the screen's own Add will. */
  addDeadline: (draft: DeadlineDraft) => Promise<void>;
}

/** Today in the Calendar's tests: Tuesday 3 November 2026, in Pozzetto's 2026. */
export const CALENDAR_TODAY = "2026-11-03";

/** Mounts the shell on the Calendar, its clock on CALENDAR_TODAY in Rome. */
export function mountCalendar(): CalendarScreenPage {
  const user = userEvent.setup();
  const harness = createAppHarness(
    undefined,
    fixedClock(`${CALENDAR_TODAY}T09:00:00Z`),
  );
  const { app, ports } = harness;

  app.navigation.intents.selectModule("calendar");

  const rendered = render(
    <ViewModelProvider viewModel={createViewModel(app)}>
      <AppRoot />
    </ViewModelProvider>,
  );

  function screen(): HTMLElement {
    return rendered.getByTestId(TESTIDS.calendarScreen);
  }

  function toolbar(): HTMLElement {
    return within(screen()).getByTestId(TESTIDS.calendarToolbar);
  }

  function cells(): HTMLElement[] {
    return within(screen()).getAllByTestId(TESTIDS.dayCell);
  }

  function cellOf(day: string): HTMLElement {
    const cell = cells().find((candidate) => {
      return candidate.dataset.day === day;
    });

    if (cell === undefined) {
      throw new Error(`No cell for ${day}`);
    }

    return cell;
  }

  function lineButtons(day: string): HTMLElement[] {
    return within(cellOf(day)).queryAllByTestId(TESTIDS.dayLine);
  }

  function popover(): HTMLElement {
    return within(toolbar()).getByRole("menu", { name: "Show calendars" });
  }

  function buildingSelect(): HTMLSelectElement {
    return within(toolbar()).getByRole<HTMLSelectElement>("combobox", {
      name: "Building",
    });
  }

  function textOf(element: Element | null): string {
    return element?.textContent ?? "";
  }

  return {
    panelTitle: (): string => {
      return textOf(
        within(rendered.getByTestId(TESTIDS.appMain)).getAllByTestId(
          TESTIDS.panelTitle,
        )[0] ?? null,
      );
    },
    monthTitle: (): string => {
      return textOf(within(toolbar()).getByTestId(TESTIDS.calendarMonthTitle));
    },
    clickPrevious: async (): Promise<void> => {
      await user.click(
        within(toolbar()).getByRole("button", { name: "Previous month" }),
      );
    },
    clickNext: async (): Promise<void> => {
      await user.click(
        within(toolbar()).getByRole("button", { name: "Next month" }),
      );
    },
    clickToday: async (): Promise<void> => {
      await user.click(
        within(toolbar()).getByRole("button", { name: "Today" }),
      );
    },
    weekdays: (): string[] => {
      return within(screen())
        .getAllByTestId(TESTIDS.weekday)
        .map((weekday) => {
          return textOf(weekday);
        });
    },
    weeks: (): string[][] => {
      return within(screen())
        .getAllByTestId(TESTIDS.monthWeek)
        .map((week) => {
          return within(week)
            .getAllByTestId(TESTIDS.dayCell)
            .map((cell) => {
              return textOf(cell.querySelector(".day-number"));
            });
        });
    },
    selectedDay: (): string | null => {
      return (
        cells().find((cell) => {
          return cell.dataset.selected === "true";
        })?.dataset.day ?? null
      );
    },
    today: (): string | null => {
      return (
        cells().find((cell) => {
          return (
            cell
              .querySelector(".day-cell-select")
              ?.getAttribute("aria-current") === "date"
          );
        })?.dataset.day ?? null
      );
    },
    weekdayOf: (day: string): number => {
      return Number(cellOf(day).dataset.weekday);
    },
    lines: (day: string): LineShown[] => {
      return lineButtons(day).map((line) => {
        const mark = within(line).getByTestId(TESTIDS.calendarMark);

        return {
          mark: textOf(mark),
          status: mark.dataset.status ?? "",
          time: line.querySelector(".day-line-time")?.textContent ?? null,
          text: textOf(line.querySelector(".day-line-text")),
          tooltip: line.title,
          colourClass:
            [...line.classList].find((name) => {
              return name.startsWith("calendar-");
            }) ?? null,
          selected: line.getAttribute("aria-pressed") === "true",
        };
      });
    },
    more: (day: string): string | null => {
      return (
        within(cellOf(day)).queryByTestId(TESTIDS.dayMore)?.textContent ?? null
      );
    },
    selectedLine: (): string | null => {
      const line = within(screen())
        .queryAllByTestId(TESTIDS.dayLine)
        .find((candidate) => {
          return candidate.getAttribute("aria-pressed") === "true";
        });

      return line === undefined
        ? null
        : textOf(line.querySelector(".day-line-text"));
    },
    clickDay: async (day: string): Promise<void> => {
      const button = cellOf(day).querySelector(".day-cell-select");

      if (button === null) {
        throw new Error(`No button to select ${day}`);
      }

      await user.click(button);
    },
    clickLine: async (day: string, text: string): Promise<void> => {
      const line = lineButtons(day).find((candidate) => {
        return textOf(candidate.querySelector(".day-line-text")).startsWith(
          text,
        );
      });

      if (line === undefined) {
        throw new Error(`No line of ${day} starting ${text}`);
      }

      await user.click(line);
    },
    clickMore: async (day: string): Promise<void> => {
      await user.click(within(cellOf(day)).getByTestId(TESTIDS.dayMore));
    },
    calendarsCount: (): string => {
      return textOf(within(toolbar()).getByTestId(TESTIDS.calendarsCount));
    },
    openCalendars: async (): Promise<void> => {
      await user.click(within(toolbar()).getByTestId(TESTIDS.calendarsButton));
    },
    isCalendarsOpen: (): boolean => {
      return (
        within(toolbar()).queryByRole("menu", { name: "Show calendars" }) !==
        null
      );
    },
    calendarsLabel: (): string => {
      return textOf(popover().querySelector(".popover-label"));
    },
    calendarRows: (): CalendarRowShown[] => {
      return within(popover())
        .getAllByRole("menuitemcheckbox")
        .map((row) => {
          return {
            name: textOf(row.querySelector(".calendars-option-name")),
            shown: row.getAttribute("aria-checked") === "true",
            colourClass:
              [...row.classList].find((name) => {
                return name.startsWith("calendar-");
              }) ?? null,
          };
        });
    },
    toggleCalendar: async (name: string): Promise<void> => {
      await user.click(
        within(popover()).getByRole("menuitemcheckbox", { name }),
      );
    },
    clickAllCalendars: async (): Promise<void> => {
      await user.click(
        within(popover()).getByRole("menuitem", { name: "All" }),
      );
    },
    clickNoCalendars: async (): Promise<void> => {
      await user.click(
        within(popover()).getByRole("menuitem", { name: "None" }),
      );
    },
    closeCalendars: async (): Promise<void> => {
      await user.keyboard("{Escape}");
    },
    buildingLabel: (): string => {
      return textOf(toolbar().querySelector(".calendar-building-label"));
    },
    buildingOptions: (): string[] => {
      return Array.from(buildingSelect().options).map((option) => {
        return option.textContent ?? "";
      });
    },
    building: (): string => {
      return textOf(toolbar().querySelector(".value-select-text"));
    },
    chooseBuilding: async (label: string): Promise<void> => {
      await user.selectOptions(buildingSelect(), label);
    },
    clickRefresh: async (): Promise<void> => {
      await user.click(
        within(toolbar()).getByRole("button", { name: "Refresh" }),
      );
    },
    toasts: (): string[] => {
      return rendered.queryAllByTestId(TESTIDS.toast).map((toast) => {
        return textOf(toast.querySelector(".toast-text"));
      });
    },
    views: (): ViewShown[] => {
      return Array.from(
        within(screen()).getByTestId(TESTIDS.viewFooter).children,
      )
        .slice(1)
        .map((option) => {
          const [glyph = "", name = ""] = textOf(option).split(" ");

          return {
            name,
            glyph,
            active: option.getAttribute("data-active") === "true",
            disabled: option instanceof HTMLButtonElement && option.disabled,
            title: option.getAttribute("title"),
          };
        });
    },
    addDeadline: async (draft: DeadlineDraft): Promise<void> => {
      await act(async () => {
        await ports.calendar.addDeadline(draft);
      });
    },
  };
}
