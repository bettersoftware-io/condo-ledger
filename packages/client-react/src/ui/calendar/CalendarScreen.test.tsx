import { describe, expect, it } from "vitest";

import type { DeadlineDraft } from "@cl/domain";

import { CALENDAR_TODAY, mountCalendar } from "./CalendarScreen.page.tsx";

describe("the Calendar's toolbar", () => {
  it("opens on the current month with today selected and ringed", () => {
    const page = mountCalendar();

    expect(page.panelTitle()).toBe("Calendar");
    expect(page.monthTitle()).toBe("November 2026");
    expect(page.selectedDay()).toBe(CALENDAR_TODAY);
    expect(page.today()).toBe(CALENDAR_TODAY);
  });

  it("‹ and › move a month and keep the day number", async () => {
    const page = mountCalendar();

    await page.clickPrevious();

    expect(page.monthTitle()).toBe("October 2026");
    expect(page.selectedDay()).toBe("2026-10-03");
    expect(page.today()).toBeNull();

    await page.clickNext();
    await page.clickNext();

    expect(page.monthTitle()).toBe("December 2026");
    expect(page.selectedDay()).toBe("2026-12-03");
  });

  it("Today goes back to the current month and selects today", async () => {
    const page = mountCalendar();
    await page.clickNext();
    await page.clickNext();

    expect(page.monthTitle()).toBe("January 2027");

    await page.clickDay("2027-01-24");

    await page.clickToday();

    expect(page.monthTitle()).toBe("November 2026");
    expect(page.selectedDay()).toBe(CALENDAR_TODAY);
  });

  it("⟳ says it is not yet available, as on the other screens", async () => {
    const page = mountCalendar();

    await page.clickRefresh();

    expect(page.toasts()).toEqual(["Refresh: not yet available"]);
  });
});

describe("the Calendars popover", () => {
  it("counts the calendars shown and lists each with its colour", async () => {
    const page = mountCalendar();

    expect(page.calendarsCount()).toBe("6");
    expect(page.isCalendarsOpen()).toBe(false);

    await page.openCalendars();

    expect(page.isCalendarsOpen()).toBe(true);
    expect(page.calendarsLabel()).toBe("Show calendars");
    expect(page.calendarRows()).toEqual([
      {
        name: "Installments",
        shown: true,
        colourClass: "calendar-installments",
      },
      { name: "Invoices", shown: true, colourClass: "calendar-invoices" },
      { name: "Fiscal", shown: true, colourClass: "calendar-fiscal" },
      { name: "Policies", shown: true, colourClass: "calendar-policies" },
      {
        name: "Interventions",
        shown: true,
        colourClass: "calendar-interventions",
      },
      { name: "General", shown: true, colourClass: "calendar-general" },
    ]);
  });

  it("one row hides its calendar from the month, and the popover stays open", async () => {
    const page = mountCalendar();
    await page.openCalendars();

    await page.toggleCalendar("Invoices");

    expect(page.isCalendarsOpen()).toBe(true);
    expect(page.calendarsCount()).toBe("5");
    expect(
      page.calendarRows().find((row) => {
        return row.name === "Invoices";
      })?.shown,
    ).toBe(false);
    expect(colourClassesOf(page.lines("2026-11-20"))).toEqual([
      "calendar-installments",
    ]);

    await page.toggleCalendar("Invoices");

    expect(page.calendarsCount()).toBe("6");
    expect(colourClassesOf(page.lines("2026-11-20"))).toEqual([
      "calendar-installments",
      "calendar-invoices",
    ]);
  });

  it("None hides every calendar and All shows them again", async () => {
    const page = mountCalendar();
    await page.openCalendars();

    await page.clickNoCalendars();

    expect(page.calendarsCount()).toBe("0");
    expect(
      page.calendarRows().every((row) => {
        return !row.shown;
      }),
    ).toBe(true);
    expect(page.lines("2026-11-20")).toEqual([]);

    await page.clickAllCalendars();

    expect(page.calendarsCount()).toBe("6");
    expect(page.lines("2026-11-20")).toHaveLength(2);
  });

  it("Escape closes it", async () => {
    const page = mountCalendar();
    await page.openCalendars();

    await page.closeCalendars();

    expect(page.isCalendarsOpen()).toBe(false);
  });
});

describe("the Building select", () => {
  it("lists — All — then the buildings by name, and draws its value as text", () => {
    const page = mountCalendar();

    expect(page.buildingLabel()).toBe("Building:");
    expect(page.buildingOptions()).toEqual(["— All —", "Pozzetto", "Saturno"]);
    expect(page.building()).toBe("— All —");
  });

  it("shows one building's deadlines and those tied to it, and — All — every one", async () => {
    const page = mountCalendar();
    await page.addDeadline(createDraft({ description: "Studio meeting" }));

    await page.chooseBuilding("Saturno");

    expect(page.building()).toBe("Saturno");
    expect(page.lines("2026-11-20")).toEqual([]);

    await page.chooseBuilding("Pozzetto");

    expect(colourClassesOf(page.lines("2026-11-20"))).toEqual([
      "calendar-installments",
      "calendar-invoices",
    ]);

    await page.chooseBuilding("— All —");

    expect(page.lines("2026-11-20")).toHaveLength(3);
  });
});

describe("the month", () => {
  it("draws the weekdays, Monday first, and every week November 2026 touches", () => {
    const page = mountCalendar();

    expect(page.weekdays()).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    expect(page.weeks()).toEqual([
      ["", "", "", "", "", "", "1"],
      ["2", "3", "4", "5", "6", "7", "8"],
      ["9", "10", "11", "12", "13", "14", "15"],
      ["16", "17", "18", "19", "20", "21", "22"],
      ["23", "24", "25", "26", "27", "28", "29"],
      ["30", "", "", "", "", "", ""],
    ]);
    expect(page.weekdayOf("2026-11-01")).toBe(6);
    expect(page.weekdayOf("2026-11-07")).toBe(5);
  });

  it("draws a day's lines in its calendar's colour, with the status mark and the description", () => {
    const page = mountCalendar();

    const [installment, invoice] = page.lines("2026-11-20");

    expect(installment).toMatchObject({
      mark: "✦",
      status: "new",
      time: null,
      colourClass: "calendar-installments",
    });
    expect(installment?.text).toMatch(/^.+ due, Pozzetto .+$/);
    expect(installment?.tooltip).toBe(installment?.text);
    expect(invoice).toMatchObject({
      mark: "✓",
      status: "closed",
      time: null,
      colourClass: "calendar-invoices",
    });
    expect(invoice?.text).toMatch(/^Invoice due .+ no\. .+ of €[\d,]+\.\d\d$/);
  });

  it("marks a deadline still open after its day as overdue, and a cancelled one", async () => {
    const page = mountCalendar();
    await page.addDeadline(
      createDraft({ date: "2026-11-10", status: "cancelled" }),
    );

    expect(page.lines("2026-11-10")).toMatchObject([
      { mark: "✕", status: "cancelled" },
    ]);

    await page.clickPrevious();

    expect(page.lines("2026-10-20")).toMatchObject([
      { mark: "!", status: "overdue", colourClass: "calendar-installments" },
    ]);
  });

  it("draws a time after the deadlines with none, in the day list's order", async () => {
    const page = mountCalendar();
    await page.addDeadline(
      createDraft({ description: "Assembly", time: "09:30" }),
    );

    expect(
      page.lines("2026-11-20").map((line) => {
        return line.time;
      }),
    ).toEqual([null, null, "09:30"]);
    expect(page.lines("2026-11-20")[2]).toMatchObject({
      text: "Assembly",
      colourClass: "calendar-general",
    });
    expect(page.more("2026-11-20")).toBeNull();
  });

  it("ends a cell with +N more when its lines do not fit, and +N more selects the day", async () => {
    const page = mountCalendar();
    await page.addDeadline(createDraft({ description: "Assembly" }));
    await page.addDeadline(createDraft({ description: "Boiler check" }));

    expect(page.lines("2026-11-20")).toHaveLength(2);
    expect(page.more("2026-11-20")).toBe("+2 more");

    await page.clickMore("2026-11-20");

    expect(page.selectedDay()).toBe("2026-11-20");
    expect(page.selectedLine()).toMatch(/ due, /);
  });

  it("clicking a cell selects its day and the day's first deadline", async () => {
    const page = mountCalendar();

    await page.clickDay("2026-11-20");

    expect(page.selectedDay()).toBe("2026-11-20");
    expect(page.selectedLine()).toMatch(/ due, /);

    await page.clickDay("2026-11-11");

    expect(page.selectedDay()).toBe("2026-11-11");
    expect(page.selectedLine()).toBeNull();
  });

  it("clicking a line of another day selects that day and that deadline", async () => {
    const page = mountCalendar();

    await page.clickLine("2026-11-20", "Invoice due");

    expect(page.selectedDay()).toBe("2026-11-20");
    expect(page.selectedLine()).toMatch(/^Invoice due /);
  });

  it("clicking a line of the selected day selects its deadline", async () => {
    const page = mountCalendar();
    await page.clickDay("2026-11-20");

    await page.clickLine("2026-11-20", "Invoice due");

    expect(page.selectedDay()).toBe("2026-11-20");
    expect(page.selectedLine()).toMatch(/^Invoice due /);
  });
});

describe("the footer", () => {
  it("shows Monthly, and Weekly and List switched off with their tooltip", () => {
    const page = mountCalendar();

    expect(page.views()).toEqual([
      {
        name: "Monthly",
        glyph: "●",
        active: true,
        disabled: false,
        title: null,
      },
      {
        name: "Weekly",
        glyph: "○",
        active: false,
        disabled: true,
        title: "Not available yet",
      },
      {
        name: "List",
        glyph: "○",
        active: false,
        disabled: true,
        title: "Not available yet",
      },
    ]);
  });
});

interface LineColour {
  colourClass: string | null;
}

function colourClassesOf(lines: LineColour[]): (string | null)[] {
  return lines.map((line) => {
    return line.colourClass;
  });
}

function createDraft(changes: Partial<DeadlineDraft> = {}): DeadlineDraft {
  return {
    date: "2026-11-20",
    time: null,
    calendar: "general",
    buildingId: null,
    description: "Studio meeting",
    status: "new",
    priority: "none",
    notes: null,
    ...changes,
  };
}
