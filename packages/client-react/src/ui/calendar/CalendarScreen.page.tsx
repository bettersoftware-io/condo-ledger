import { act, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import { type DeadlineDraft, fixedClock, rejected } from "@cl/domain";
import { createViewModel, ViewModelProvider } from "@cl/react-bindings";

import { type FormDialogPage, formDialogIn } from "../FormDialog.page.tsx";
import { AppRoot } from "../shell/AppRoot.tsx";
import { dragSplitterElement } from "../shell/Splitter.page.tsx";
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

/** A row of the selected day's list. */
interface DayListRowShown {
  /** The time, "" for a deadline with none. */
  time: string;
  mark: string;
  status: string;
  /** The priority word on the dot's tooltip; null when no dot is drawn. */
  priority: string | null;
  text: string;
  tooltip: string;
  selected: boolean;
}

/** The selected deadline's details, as drawn. */
interface DetailsShown {
  /** The rows by label, in order: Description, Date, Calendar, Building, Status, Priority. */
  rows: { label: string; value: string }[];
  /** The class that colours the Calendar row's square. */
  calendarColourClass: string | null;
  /** The NOTES box's text. */
  notes: string;
}

/** A button of the deadlines panel's toolbar. */
interface DeadlineToolShown {
  /** Its accessible name: "Add deadline", "Edit deadline" or "Delete deadline". */
  name: string;
  disabled: boolean;
  title: string;
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
  /** The title of the column's first panel: "Deadlines for 3 November 2026". */
  dayListTitle: () => string;
  /** The list's header cells. */
  dayListHeader: () => string[];
  dayListRows: () => DayListRowShown[];
  /** The sentence of a day with no deadline; null when the day has some. */
  dayListEmpty: () => string | null;
  /** Clicks the row whose description starts with this. */
  clickDayListRow: (text: string) => Promise<void>;
  deadlineTools: () => DeadlineToolShown[];
  clickDeadlineTool: (name: string) => Promise<void>;
  /** The details panel's title. */
  detailsTitle: () => string;
  /** The panel's sentence when no deadline is selected; null when one is. */
  detailsEmpty: () => string | null;
  details: () => DetailsShown;
  /** The list's share of the column, as written for the stylesheet. */
  splitRatio: () => number;
  /** Drags the splitter between the list and the details by pixels, the column being this tall. */
  dragSplit: (by: number, columnHeight: number) => void;
  /** The column's width in pixels, as written for the stylesheet. */
  columnWidth: () => number;
  /** Drags the column's own splitter: a positive move is to the right. */
  dragColumn: (by: number) => void;
  hasColumn: () => boolean;
  /** What the rail reads. */
  railLabel: () => string;
  clickRail: () => Promise<void>;
  clickScrim: () => Promise<void>;
  isDrawerOpen: () => boolean;
  /** The Add and Edit Deadline dialog. */
  dialog: FormDialogPage;
  /** The label of the field the dialog marks invalid; null when none is. */
  invalidField: () => string | null;
  /** The shell shows another module, as the top bar's menu does. */
  showModule: (module: "buildings" | "contacts" | "calendar") => void;
  /** From now on the calendar port refuses every delete, for this reason. */
  refuseDeletes: (reason: string) => void;
  /** The reason the delete question shows under its text; null when it shows none. */
  deleteRefusal: () => string | null;
  /** The delete question's text; null when it is not asked. */
  deleteQuestion: () => string | null;
  answerYes: () => Promise<void>;
  answerNo: () => Promise<void>;
  /** The accessible name of the element with the focus: "Add deadline" after the dialog closes. */
  focusedName: () => string;
  /** Adds a deadline through the port, as a test needs one to start from. */
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

  function column(): HTMLElement {
    return rendered.getByTestId(TESTIDS.deadlinesColumn);
  }

  function columnPanel(index: number): HTMLElement {
    const panel = within(column()).getAllByTestId(TESTIDS.panel)[index];

    if (panel === undefined) {
      throw new Error(`No panel ${index} in the deadlines column`);
    }

    return panel;
  }

  function dayListRowButtons(): HTMLElement[] {
    return within(column()).queryAllByTestId(TESTIDS.dayListRow);
  }

  function splitterOf(direction: string): HTMLElement {
    const found = rendered.getAllByTestId(TESTIDS.splitter).find((splitter) => {
      return splitter.getAttribute("data-direction") === direction;
    });

    if (found === undefined) {
      throw new Error(`No ${direction} splitter`);
    }

    return found;
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
    dayListTitle: (): string => {
      return textOf(
        within(columnPanel(0)).getAllByTestId(TESTIDS.panelTitle)[0] ?? null,
      );
    },
    dayListHeader: (): string[] => {
      return Array.from(
        within(column())
          .getByTestId(TESTIDS.dayList)
          .querySelector(".day-list-header")?.children ?? [],
      ).map((cell) => {
        return textOf(cell);
      });
    },
    dayListRows: (): DayListRowShown[] => {
      return dayListRowButtons().map((row) => {
        const mark = within(row).getByTestId(TESTIDS.calendarMark);
        const dot = within(row).queryByTestId(TESTIDS.priorityDot);

        return {
          time: textOf(row.querySelector(".day-list-time")),
          mark: textOf(mark),
          status: mark.dataset.status ?? "",
          priority: dot === null ? null : dot.title,
          text: textOf(row.querySelector(".day-list-text")),
          tooltip:
            row.querySelector<HTMLElement>(".day-list-text")?.title ?? "",
          selected: row.getAttribute("aria-pressed") === "true",
        };
      });
    },
    dayListEmpty: (): string | null => {
      const empty = within(column()).queryByTestId(TESTIDS.dayListEmpty);

      return empty === null ? null : textOf(empty);
    },
    clickDayListRow: async (text: string): Promise<void> => {
      const row = dayListRowButtons().find((candidate) => {
        return textOf(candidate.querySelector(".day-list-text")).startsWith(
          text,
        );
      });

      if (row === undefined) {
        throw new Error(`No row of the list starting ${text}`);
      }

      await user.click(row);
    },
    deadlineTools: (): DeadlineToolShown[] => {
      return within(within(column()).getByTestId(TESTIDS.deadlinesToolbar))
        .getAllByRole("button")
        .map((button) => {
          return {
            name: button.getAttribute("aria-label") ?? "",
            disabled: button instanceof HTMLButtonElement && button.disabled,
            title: button.title,
          };
        });
    },
    clickDeadlineTool: async (name: string): Promise<void> => {
      await user.click(within(column()).getByRole("button", { name }));
    },
    detailsTitle: (): string => {
      return textOf(
        within(columnPanel(1)).getAllByTestId(TESTIDS.panelTitle)[0] ?? null,
      );
    },
    detailsEmpty: (): string | null => {
      const details = within(column()).getByTestId(TESTIDS.deadlineDetails);

      return details.classList.contains("deadline-details-empty")
        ? textOf(details)
        : null;
    },
    details: (): DetailsShown => {
      const details = within(column()).getByTestId(TESTIDS.deadlineDetails);
      const rows = within(details).getAllByTestId(TESTIDS.deadlineDetailsRow);

      return {
        rows: rows.map((row) => {
          return {
            label: textOf(row.querySelector(".deadline-details-label")),
            value: textOf(row.querySelector(".deadline-details-value")),
          };
        }),
        calendarColourClass:
          [
            ...(rows[2]?.querySelector(".deadline-value")?.classList ?? []),
          ].find((name) => {
            return name.startsWith("calendar-");
          }) ?? null,
        notes: textOf(
          within(details)
            .getByTestId(TESTIDS.deadlineNotes)
            .querySelector(".deadline-notes-text"),
        ),
      };
    },
    splitRatio: (): number => {
      return Number(column().style.getPropertyValue("--split-ratio"));
    },
    dragSplit: (by: number, columnHeight: number): void => {
      // jsdom lays nothing out: the column is as tall as the test says.
      column().getBoundingClientRect = (): DOMRect => {
        return { height: columnHeight } as DOMRect;
      };

      dragSplitterElement(splitterOf("horizontal"), [by]);
    },
    columnWidth: (): number => {
      return Number.parseInt(
        rendered
          .getByTestId(TESTIDS.sidebarRight)
          .style.getPropertyValue("--sidebar-width"),
        10,
      );
    },
    dragColumn: (by: number): void => {
      dragSplitterElement(splitterOf("vertical"), [by]);
    },
    hasColumn: (): boolean => {
      return rendered.queryByTestId(TESTIDS.deadlinesColumn) !== null;
    },
    railLabel: (): string => {
      return textOf(
        rendered.getByTestId(TESTIDS.rail).querySelector(".rail-label"),
      );
    },
    clickRail: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.rail));
    },
    clickScrim: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.drawerScrim));
    },
    isDrawerOpen: (): boolean => {
      return (
        rendered.getByTestId(TESTIDS.sidebarRight).getAttribute("data-open") ===
        "true"
      );
    },
    dialog: formDialogIn(() => {
      return rendered.container;
    }, user),
    invalidField: (): string | null => {
      return (
        rendered.container
          .querySelector("[aria-invalid='true']")
          ?.getAttribute("aria-label") ?? null
      );
    },
    showModule: (module: "buildings" | "contacts" | "calendar"): void => {
      act(() => {
        app.navigation.intents.selectModule(module);
      });
    },
    refuseDeletes: (reason: string): void => {
      vi.spyOn(ports.calendar, "deleteDeadline").mockResolvedValue(
        rejected(reason),
      );
    },
    deleteRefusal: (): string | null => {
      return rendered.queryByTestId(TESTIDS.confirmError)?.textContent ?? null;
    },
    deleteQuestion: (): string | null => {
      return rendered.queryByTestId(TESTIDS.confirmText)?.textContent ?? null;
    },
    answerYes: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.confirmYes));
    },
    answerNo: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.confirmNo));
    },
    focusedName: (): string => {
      return document.activeElement?.getAttribute("aria-label") ?? "";
    },
    addDeadline: async (draft: DeadlineDraft): Promise<void> => {
      await act(async () => {
        await ports.calendar.addDeadline(draft);
      });
    },
  };
}
