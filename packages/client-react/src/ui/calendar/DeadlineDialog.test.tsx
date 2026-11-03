import { describe, expect, it } from "vitest";

import type { DeadlineDraft } from "@cl/domain";

import {
  type CalendarScreenPage,
  mountCalendar,
} from "./CalendarScreen.page.tsx";

describe("+ Add deadline", () => {
  it("opens Add Deadline on the selected day with the form's defaults", async () => {
    const page = mountCalendar();
    await page.clickDay("2026-11-20");

    await page.clickDeadlineTool("Add deadline");

    expect(page.dialog.isShown()).toBe(true);
    expect(page.dialog.title()).toBe("Add Deadline");
    expect(page.dialog.width()).toBe("nested");
    expect(page.dialog.saveLabel()).toBe("+ Add");
    expect(page.dialog.fieldValue("Description")).toBe("");
    expect(page.dialog.fieldValue("Date")).toBe("20/11/2026");
    expect(page.dialog.fieldValue("Time")).toBe("");
    expect(page.dialog.chosen("Calendar")).toBe("General");
    expect(page.dialog.chosen("Building")).toBe("— None —");
    expect(page.dialog.isSaveDisabled()).toBe(true);
    expect(page.dialog.requiredUnannounced()).toEqual([]);
  });

  it("offers the four calendars a typed deadline may be in, and the buildings", async () => {
    const page = mountCalendar();

    await page.clickDeadlineTool("Add deadline");

    expect(page.dialog.options("Calendar")).toEqual([
      "Fiscal",
      "Policies",
      "Interventions",
      "General",
    ]);
    expect(page.dialog.options("Building")).toEqual([
      "— None —",
      "Pozzetto",
      "Saturno",
    ]);
  });

  it("saves the deadline, moves to its day and selects it", async () => {
    const page = mountCalendar();
    await page.clickDeadlineTool("Add deadline");

    await page.dialog.fill("Description", "Boiler check");
    await page.dialog.fill("Date", "05/11/2026");
    await page.dialog.fill("Time", "14:30");
    await page.dialog.choose("Calendar", "Interventions");
    await page.dialog.save();

    expect(page.dialog.isShown()).toBe(false);
    expect(page.selectedDay()).toBe("2026-11-05");
    expect(page.dayListRows()).toMatchObject([
      { time: "14:30", text: "Boiler check", selected: true },
    ]);
  });

  it("with the Building filter on Saturno opens on Saturno, and the deadline shows under Saturno and All, not Pozzetto", async () => {
    const page = mountCalendar();
    await page.chooseBuilding("Saturno");

    await page.clickDeadlineTool("Add deadline");

    expect(page.dialog.chosen("Building")).toBe("Saturno");

    await page.dialog.fill("Description", "Saturno roof");
    await page.dialog.save();

    expect(listed(page)).toEqual(["Saturno roof"]);

    await page.chooseBuilding("— All —");

    expect(listed(page)).toEqual(["Saturno roof"]);

    await page.chooseBuilding("Pozzetto");

    expect(page.dayListRows()).toEqual([]);
  });

  it("names a date that does not read, in the words of the other dialogs", async () => {
    const page = mountCalendar();
    await page.clickDeadlineTool("Add deadline");
    await page.dialog.fill("Description", "Boiler check");

    await page.dialog.fill("Date", "31/02/2026");

    expect(page.dialog.message()).toBe("The date is not a date");
    expect(page.invalidField()).toBe("Date");
    expect(page.dialog.isSaveDisabled()).toBe(true);
  });

  it("names a time that is not HH:MM", async () => {
    const page = mountCalendar();
    await page.clickDeadlineTool("Add deadline");
    await page.dialog.fill("Description", "Boiler check");

    await page.dialog.fill("Time", "25:99");

    expect(page.dialog.message()).toBe(
      "The time is HH:MM, from 00:00 to 23:59",
    );
    expect(page.invalidField()).toBe("Time");
  });

  it("names a blank description once it has been edited", async () => {
    const page = mountCalendar();
    await page.clickDeadlineTool("Add deadline");

    expect(page.dialog.message()).toBeNull();

    await page.dialog.fill("Description", "x");
    await page.dialog.fill("Description", "");

    expect(page.dialog.message()).toBe("Enter a description");
    expect(page.invalidField()).toBe("Description");
  });

  it("names a description of more than 255 characters", async () => {
    const page = mountCalendar();
    await page.clickDeadlineTool("Add deadline");

    await page.dialog.fill("Description", "x".repeat(256));

    expect(page.dialog.message()).toBe(
      "A description has at most 255 characters",
    );
    expect(page.invalidField()).toBe("Description");
  });

  it("shows the date a short one was read as", async () => {
    const page = mountCalendar();
    await page.clickDeadlineTool("Add deadline");

    await page.dialog.fill("Date", "5/12");

    expect(page.dialog.readDate()).toBe("05/12/2026");
  });

  it("Cancel closes it without a deadline, and the focus goes back to +", async () => {
    const page = mountCalendar();
    await page.clickDeadlineTool("Add deadline");
    await page.dialog.fill("Description", "Never saved");

    await page.dialog.cancel();

    expect(page.dialog.isShown()).toBe(false);
    expect(page.dayListRows()).toEqual([]);
    expect(page.focusedName()).toBe("Add deadline");
  });
});

describe("the dialog's other fields", () => {
  it("saves the building, status, priority and notes chosen, and Edit opens on them", async () => {
    const page = mountCalendar();
    await page.clickDeadlineTool("Add deadline");

    await page.dialog.fill("Description", "Roof survey");
    await page.dialog.choose("Building", "Saturno");
    await page.dialog.chooseRadio("Status", "Cancelled");
    await page.dialog.chooseRadio("Priority", "Critical");
    await page.dialog.fill("Notes", "Bring the ladder");
    await page.dialog.save();

    expect(page.details().rows).toEqual(
      expect.arrayContaining([
        { label: "Building", value: "Saturno" },
        { label: "Status", value: "✕Cancelled" },
        { label: "Priority", value: "Critical" },
      ]),
    );
    expect(page.details().notes).toBe("Bring the ladder");

    await page.clickDeadlineTool("Edit deadline");

    expect(page.dialog.chosen("Building")).toBe("Saturno");
    expect(page.dialog.pickedRadio("Status")).toBe("Cancelled");
    expect(page.dialog.pickedRadio("Priority")).toBe("Critical");

    await page.dialog.choose("Building", "— None —");

    expect(page.dialog.chosen("Building")).toBe("— None —");
  });
});

describe("✎ Edit deadline", () => {
  it("opens Edit Deadline on the selected deadline and saves the change", async () => {
    const page = mountCalendar();
    await page.addDeadline(
      createDraft({ description: "Boiler check", priority: "high" }),
    );

    await page.clickDeadlineTool("Edit deadline");

    expect(page.dialog.title()).toBe("Edit Deadline");
    expect(page.dialog.width()).toBe("nested");
    expect(page.dialog.saveLabel()).toBe("✎ Save");
    expect(page.dialog.fieldValue("Description")).toBe("Boiler check");
    expect(page.dialog.fieldValue("Date")).toBe("03/11/2026");

    await page.dialog.fill("Description", "Boiler service");
    await page.dialog.save();

    expect(page.dialog.isShown()).toBe(false);
    expect(page.dayListRows()).toMatchObject([
      { text: "Boiler service", selected: true },
    ]);
    expect(page.focusedName()).toBe("Edit deadline");
  });

  it("moving the date moves the month to the deadline", async () => {
    const page = mountCalendar();
    await page.addDeadline(createDraft({ description: "Boiler check" }));
    await page.clickDeadlineTool("Edit deadline");

    await page.dialog.fill("Date", "15/12/2026");
    await page.dialog.save();

    expect(page.monthTitle()).toBe("December 2026");
    expect(page.selectedDay()).toBe("2026-12-15");
    expect(page.dayListRows()).toMatchObject([{ text: "Boiler check" }]);
  });
});

describe("− Delete deadline", () => {
  it("asks, and No keeps the deadline", async () => {
    const page = mountCalendar();
    await page.addDeadline(createDraft({ description: "Boiler check" }));

    await page.clickDeadlineTool("Delete deadline");

    expect(page.deleteQuestion()).toBe(
      'Delete the deadline "Boiler check"? This cannot be undone.',
    );

    await page.answerNo();

    expect(page.deleteQuestion()).toBeNull();
    expect(listed(page)).toEqual(["Boiler check"]);
    expect(page.focusedName()).toBe("Delete deadline");
  });

  it("Yes deletes it and selects the day's first", async () => {
    const page = mountCalendar();
    await page.addDeadline(
      createDraft({ description: "Assembly", time: "09:00" }),
    );
    await page.addDeadline(
      createDraft({ description: "Boiler check", time: "14:00" }),
    );
    await page.clickDayListRow("Boiler check");

    await page.clickDeadlineTool("Delete deadline");
    await page.answerYes();

    expect(page.deleteQuestion()).toBeNull();
    expect(page.dayListRows()).toMatchObject([
      { text: "Assembly", selected: true },
    ]);
  });
});

describe("the dialog's day", () => {
  it("opens on the selected day, whatever the month", async () => {
    const page = mountCalendar();
    await page.clickNext();

    await page.clickDeadlineTool("Add deadline");

    expect(page.dialog.fieldValue("Date")).toBe("03/12/2026");
  });
});

function listed(page: CalendarScreenPage): string[] {
  return page.dayListRows().map((row) => {
    return row.text;
  });
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
