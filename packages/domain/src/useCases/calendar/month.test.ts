import { describe, expect, it } from "vitest";

import { cents } from "#/entities/cents.ts";
import { type Deadline, manual } from "#/entities/deadline.ts";

import {
  addMonths,
  deadlinesByDay,
  deadlinesOfDay,
  sameDayIn,
  weeksOf,
} from "./month.ts";
import type { CalendarFilters } from "./overdue.ts";

describe("weeksOf", () => {
  it("has four weeks for February 2027, five for February 2026, six for November and August 2026", () => {
    expect(weeksOf("2027-02")).toHaveLength(4);
    expect(weeksOf("2026-02")).toHaveLength(5);
    expect(weeksOf("2026-11")).toHaveLength(6);
    expect(weeksOf("2026-08")).toHaveLength(6);
  });

  it("starts on Monday and leaves the months around null", () => {
    const weeks = weeksOf("2026-11");

    expect(weeks[0]?.days).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      "2026-11-01",
    ]);
    expect(weeks[5]?.days).toEqual([
      "2026-11-30",
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(weeksOf("2027-02")[0]?.days[0]).toBe("2027-02-01");
  });
});

describe("addMonths and sameDayIn", () => {
  it("crosses a year end", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-05", 0)).toBe("2026-05");
  });

  it("keeps the day number, or the last day of a shorter month", () => {
    expect(sameDayIn("2026-01-31", "2026-02")).toBe("2026-02-28");
    expect(sameDayIn("2026-01-31", "2028-02")).toBe("2028-02-29");
    expect(sameDayIn("2026-01-31", "2026-04")).toBe("2026-04-30");
    expect(sameDayIn("2026-01-15", "2026-03")).toBe("2026-03-15");
  });
});

describe("deadlinesOfDay", () => {
  it("orders no time first, then by time, then installments, invoices, typed", () => {
    const deadlines = [
      createManual("m-late", "18:00", "b"),
      createManual("m-none", null, "z"),
      createInvoice("i2", "10"),
      createInvoice("i1", "9"),
      createInstallment("n2", 2),
      createInstallment("n1", 1),
      createManual("m-early", "08:30", "a"),
      createManual("m-none-a", null, "a"),
      createManual("elsewhere", null, "q", "2026-11-04"),
    ];

    expect(
      deadlinesOfDay(deadlines, "2026-11-03", createAll()).map((deadline) => {
        return deadline.id;
      }),
    ).toEqual([
      "installment:n1",
      "installment:n2",
      "invoice:i1",
      "invoice:i2",
      "m-none-a",
      "m-none",
      "m-early",
      "m-late",
    ]);
  });

  it("orders invoice numbers by text when they are not both numbers", () => {
    const deadlines = [createInvoice("x", "B-2"), createInvoice("y", "A-10")];

    expect(
      deadlinesOfDay(deadlines, "2026-11-03", createAll()).map((deadline) => {
        return deadline.id;
      }),
    ).toEqual(["invoice:y", "invoice:x"]);
  });

  it("leaves out what the filters hide", () => {
    const filters: CalendarFilters = {
      hidden: new Set(["general"]),
      buildingId: null,
    };

    expect(
      deadlinesOfDay([createManual("m", null, "a")], "2026-11-03", filters),
    ).toEqual([]);
  });
});

describe("deadlinesByDay", () => {
  it("groups the month's shown deadlines by day, each in order", () => {
    const deadlines = [
      createManual("b", "09:00", "b"),
      createManual("a", null, "a"),
      createManual("next", null, "n", "2026-11-04"),
      createManual("other-month", null, "o", "2026-12-01"),
    ];
    const byDay = deadlinesByDay(deadlines, "2026-11", createAll());

    expect([...byDay.keys()]).toEqual(["2026-11-03", "2026-11-04"]);
    expect(
      byDay.get("2026-11-03")?.map((deadline) => {
        return deadline.id;
      }),
    ).toEqual(["a", "b"]);
  });
});

function createAll(): CalendarFilters {
  return { hidden: new Set(), buildingId: null };
}

function createManual(
  id: string,
  time: string | null,
  description: string,
  date = "2026-11-03",
): Deadline {
  return manual({
    id,
    date,
    time,
    calendar: "general",
    buildingId: null,
    description,
    status: "new",
    priority: "none",
    notes: null,
  });
}

function createInstallment(installmentId: string, number: number): Deadline {
  return {
    source: "installment",
    id: `installment:${installmentId}`,
    date: "2026-11-03",
    time: null,
    calendar: "installments",
    buildingId: "c1",
    status: "new",
    priority: "none",
    periodId: "p1",
    installmentId,
    installmentName: `Rata ${number}`,
    installmentNumber: number,
    total: cents(0),
    paid: cents(0),
    remaining: cents(0),
  };
}

function createInvoice(invoiceId: string, number: string): Deadline {
  return {
    source: "invoice",
    id: `invoice:${invoiceId}`,
    date: "2026-11-03",
    time: null,
    calendar: "invoices",
    buildingId: "c1",
    status: "new",
    priority: "none",
    periodId: "p1",
    invoiceId,
    supplierId: "md1",
    invoiceNumber: number,
    invoiceDate: "2026-10-01",
    reason: "x",
    dueDateAssumed: false,
    total: cents(0),
    paid: cents(0),
    remaining: cents(0),
  };
}
