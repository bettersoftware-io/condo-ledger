import { describe, expect, it } from "vitest";

import type { DeadlineDraft } from "@cl/domain";

import { mountCalendar } from "./CalendarScreen.page.tsx";

describe("the day's list", () => {
  it("is titled by the selected day and has the prototype's columns", () => {
    const page = mountCalendar();

    expect(page.dayListTitle()).toBe("Deadlines for 3 November 2026");
    expect(page.dayListHeader()).toEqual(["Time", "St.", "Pr.", "Description"]);
  });

  it("follows the selected day", async () => {
    const page = mountCalendar();

    await page.clickDay("2026-11-20");

    expect(page.dayListTitle()).toBe("Deadlines for 20 November 2026");
  });

  it("says so, centred, for a day with no deadline", () => {
    const page = mountCalendar();

    expect(page.dayListRows()).toEqual([]);
    expect(page.dayListEmpty()).toBe("No deadlines on this day.");
  });

  it("lists the day in the month's order, the first selected", async () => {
    const page = mountCalendar();
    await page.addDeadline(
      createDraft({ description: "Boiler check", time: "14:00" }),
    );
    await page.addDeadline(
      createDraft({ description: "Assembly", time: "09:30", priority: "high" }),
    );
    await page.addDeadline(createDraft({ description: "Phone the notary" }));

    expect(page.dayListEmpty()).toBeNull();
    expect(page.dayListRows()).toEqual([
      {
        time: "",
        mark: "✦",
        status: "new",
        priority: null,
        text: "Phone the notary",
        tooltip: "Phone the notary",
        selected: true,
      },
      {
        time: "09:30",
        mark: "✦",
        status: "new",
        priority: "High",
        text: "Assembly",
        tooltip: "Assembly",
        selected: false,
      },
      {
        time: "14:00",
        mark: "✦",
        status: "new",
        priority: null,
        text: "Boiler check",
        tooltip: "Boiler check",
        selected: false,
      },
    ]);
  });

  it("puts the installments and the invoices before the hand-entered ones, with their marks", async () => {
    const page = mountCalendar();
    await page.addDeadline(
      createDraft({ date: "2026-11-20", description: "Assembly" }),
    );
    await page.clickDay("2026-11-20");

    const rows = page.dayListRows();

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ mark: "✦", status: "new" });
    expect(rows[0]?.text).toMatch(/^.+ due, Pozzetto .+$/);
    expect(rows[1]).toMatchObject({ mark: "✓", status: "closed" });
    expect(rows[1]?.text).toMatch(/^Invoice due /);
    expect(rows[2]?.text).toBe("Assembly");
  });

  it("selects the deadline of a row clicked, in the month too", async () => {
    const page = mountCalendar();
    await page.clickDay("2026-11-20");

    await page.clickDayListRow("Invoice due");

    expect(
      page.dayListRows().map((row) => {
        return row.selected;
      }),
    ).toEqual([false, true]);
    expect(page.selectedLine()).toMatch(/^Invoice due /);
  });

  it("marks a deadline past its day and still open as overdue", async () => {
    const page = mountCalendar();
    await page.clickPrevious();
    await page.clickDay("2026-10-20");

    expect(page.dayListRows()).toMatchObject([
      { mark: "!", status: "overdue" },
    ]);
  });
});

describe("the selected deadline's details", () => {
  it("says no deadline is selected on a day with none", () => {
    const page = mountCalendar();

    expect(page.detailsTitle()).toBe("Selected deadline details");
    expect(page.detailsEmpty()).toBe("No deadline selected.");
  });

  it("shows a hand-entered deadline's rows and notes, with a dash for no building", async () => {
    const page = mountCalendar();
    await page.addDeadline(
      createDraft({
        description: "Assembly",
        time: "09:30",
        calendar: "policies",
        priority: "critical",
        notes: "Bring the minutes\nand the proxies",
      }),
    );

    expect(page.detailsEmpty()).toBeNull();
    expect(page.details()).toEqual({
      rows: [
        { label: "Description", value: "Assembly" },
        { label: "Date", value: "03/11/2026 09:30" },
        { label: "Calendar", value: "Policies" },
        { label: "Building", value: "—" },
        { label: "Status", value: "✦New" },
        { label: "Priority", value: "Critical" },
      ],
      calendarColourClass: "calendar-policies",
      notes: "Bring the minutes\nand the proxies",
    });
  });

  it("draws a date with no time as the day alone and a blank note as an empty box", async () => {
    const page = mountCalendar();
    await page.addDeadline(createDraft({ notes: "   " }));

    const { rows, notes } = page.details();

    expect(rows[1]).toEqual({ label: "Date", value: "03/11/2026" });
    expect(rows[5]).toEqual({ label: "Priority", value: "None" });
    expect(notes).toBe("");
  });

  it("writes an installment's notes from the books, and its building", async () => {
    const page = mountCalendar();
    await page.clickDay("2026-11-20");

    const { rows, calendarColourClass, notes } = page.details();

    expect(calendarColourClass).toBe("calendar-installments");
    expect(rows[2]).toEqual({ label: "Calendar", value: "Installments" });
    expect(rows[3]).toEqual({ label: "Building", value: "Pozzetto" });
    expect(rows[4]).toEqual({ label: "Status", value: "✦New" });
    expect(notes.split("\n")).toEqual([
      expect.stringMatching(/^Management: Pozzetto \/ .+$/),
      expect.stringMatching(/^Installment: .+$/),
      "Due date: 20/11/2026",
      expect.stringMatching(/^Amount: €[\d,]+\.\d\d$/),
      expect.stringMatching(/^Paid: €[\d,]+\.\d\d$/),
      expect.stringMatching(/^Left to pay: €[\d,]+\.\d\d$/),
    ]);
  });

  it("writes an invoice's notes from the books", async () => {
    const page = mountCalendar();
    await page.clickLine("2026-11-20", "Invoice due");

    const { rows, calendarColourClass, notes } = page.details();

    expect(calendarColourClass).toBe("calendar-invoices");
    expect(rows[4]).toEqual({ label: "Status", value: "✓Closed" });
    expect(notes.split("\n").map(labelOf)).toEqual([
      "Management",
      "Supplier",
      "Invoice no.",
      "Invoice date",
      "Due date",
      "Reason",
      "Amount",
      "Paid",
      "Left to pay",
    ]);
  });
});

describe("the + ✎ − buttons", () => {
  it("leave ✎ and − disabled with no deadline selected", () => {
    const page = mountCalendar();

    expect(page.deadlineTools()).toEqual([
      {
        name: "Add deadline",
        disabled: false,
        title: "Add a deadline on this day",
      },
      { name: "Edit deadline", disabled: true, title: "Edit the deadline" },
      { name: "Delete deadline", disabled: true, title: "Delete the deadline" },
    ]);
  });

  it("enable ✎ and − on a hand-entered deadline", async () => {
    const page = mountCalendar();
    await page.addDeadline(createDraft());

    expect(
      page.deadlineTools().map((tool) => {
        return tool.disabled;
      }),
    ).toEqual([false, false, false]);
  });

  it("disable ✎ and − on an installment's deadline, saying where to change it", async () => {
    const page = mountCalendar();
    await page.clickDay("2026-11-20");

    expect(page.deadlineTools().slice(1)).toEqual([
      {
        name: "Edit deadline",
        disabled: true,
        title:
          "Worked out from the installment: change it in the Installment Schedule",
      },
      {
        name: "Delete deadline",
        disabled: true,
        title:
          "Worked out from the installment: change it in the Installment Schedule",
      },
    ]);
  });

  it("disable ✎ and − on an invoice's deadline, saying where to change it", async () => {
    const page = mountCalendar();
    await page.clickLine("2026-11-20", "Invoice due");

    expect(
      page
        .deadlineTools()
        .slice(1)
        .map((tool) => {
          return [tool.disabled, tool.title];
        }),
    ).toEqual([
      [true, "Worked out from the invoice: change it in the Journal"],
      [true, "Worked out from the invoice: change it in the Journal"],
    ]);
  });
});

describe("the column's size and fold", () => {
  it("starts 404 wide and splits 40% to the list", () => {
    const page = mountCalendar();

    expect(page.hasColumn()).toBe(true);
    expect(page.columnWidth()).toBe(404);
    expect(page.splitRatio()).toBe(0.4);
  });

  it("widens when its splitter is dragged to the left, within 180–440", () => {
    const page = mountCalendar();

    page.dragColumn(-20);

    expect(page.columnWidth()).toBe(424);

    page.dragColumn(-100);

    expect(page.columnWidth()).toBe(440);

    page.dragColumn(500);

    expect(page.columnWidth()).toBe(180);
  });

  it("keeps its width while another module is shown", () => {
    const page = mountCalendar();

    page.dragColumn(-20);
    page.showModule("contacts");

    expect(page.hasColumn()).toBe(false);

    page.showModule("calendar");

    expect(page.columnWidth()).toBe(424);
  });

  it("moves the split by the drag over the column's height, within a fifth to four fifths", () => {
    const page = mountCalendar();

    page.dragSplit(100, 500);

    expect(page.splitRatio()).toBeCloseTo(0.6);

    page.dragSplit(-500, 500);

    expect(page.splitRatio()).toBe(0.2);
  });

  it("keeps the split when the column has no height to measure", () => {
    const page = mountCalendar();

    page.dragSplit(100, 0);

    expect(page.splitRatio()).toBe(0.4);
  });

  it("is a rail reading DEADLINES that opens the drawer, and the scrim closes it", async () => {
    const page = mountCalendar();

    expect(page.railLabel()).toBe("DEADLINES");
    expect(page.isDrawerOpen()).toBe(false);

    await page.clickRail();

    expect(page.isDrawerOpen()).toBe(true);

    await page.clickScrim();

    expect(page.isDrawerOpen()).toBe(false);
  });
});

function labelOf(line: string): string {
  return line.split(":")[0] ?? "";
}

function createDraft(changes: Partial<DeadlineDraft> = {}): DeadlineDraft {
  return {
    date: "2026-11-03",
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
