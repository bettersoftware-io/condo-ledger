import { describe, expect, it } from "vitest";

import type { DeadlineNames } from "@cl/client-core";
import { cents, type Deadline, manual } from "@cl/domain";

import {
  calendarName,
  dayTitle,
  descriptionOf,
  monthTitle,
  notesOf,
  priorityWord,
  reasonText,
  statusMark,
  statusWord,
} from "./calendarWords.ts";

describe("descriptionOf", () => {
  it("words an installment's deadline with its building and period", () => {
    expect(descriptionOf(createInstallmentDeadline(), NAMES, "en-US")).toBe(
      "1st installment due, Maple Court 2026 (Ordinary)",
    );
  });

  it.each([
    ["en-US", "Invoice due Acme Lifts no. 42 of €1,234.56"],
    ["it-IT", "Invoice due Acme Lifts no. 42 of €1.234,56"],
  ] as const)("words an invoice's deadline in %s", (locale, text) => {
    expect(descriptionOf(createInvoiceDeadline(), NAMES, locale)).toBe(text);
  });

  it("keeps a typed deadline's own description", () => {
    expect(descriptionOf(createManualDeadline(), NAMES, "en-US")).toBe(
      "Boiler inspection",
    );
  });
});

describe("notesOf", () => {
  it.each([
    [
      "en-US",
      [
        "Management: Maple Court / 2026 (Ordinary)",
        "Installment: 1st installment",
        "Due date: 20/01/2026",
        "Amount: €2,500.00",
        "Paid: €1,000.50",
        "Left to pay: €1,499.50",
      ],
    ],
    [
      "it-IT",
      [
        "Management: Maple Court / 2026 (Ordinary)",
        "Installment: 1st installment",
        "Due date: 20/01/2026",
        "Amount: €2.500,00",
        "Paid: €1.000,50",
        "Left to pay: €1.499,50",
      ],
    ],
  ] as const)(
    "writes an installment's notes from the books in %s",
    (locale, lines) => {
      expect(notesOf(createInstallmentDeadline(), NAMES, locale)).toBe(
        lines.join("\n"),
      );
    },
  );

  it.each([
    [
      "en-US",
      [
        "Management: Maple Court / 2026 (Ordinary)",
        "Supplier: Acme Lifts",
        "Invoice no.: 42",
        "Invoice date: 01/03/2026",
        "Due date: 15/03/2026",
        "Reason: Lift maintenance",
        "Amount: €1,234.56",
        "Paid: €234.56",
        "Left to pay: €1,000.00",
      ],
    ],
    [
      "it-IT",
      [
        "Management: Maple Court / 2026 (Ordinary)",
        "Supplier: Acme Lifts",
        "Invoice no.: 42",
        "Invoice date: 01/03/2026",
        "Due date: 15/03/2026",
        "Reason: Lift maintenance",
        "Amount: €1.234,56",
        "Paid: €234,56",
        "Left to pay: €1.000,00",
      ],
    ],
  ] as const)(
    "writes an invoice's notes from the books in %s",
    (locale, lines) => {
      expect(notesOf(createInvoiceDeadline(), NAMES, locale)).toBe(
        lines.join("\n"),
      );
    },
  );

  it("says when an invoice's due date is assumed", () => {
    const notes = notesOf(
      createInvoiceDeadline({ dueDateAssumed: true, date: "2026-03-31" }),
      NAMES,
      "en-US",
    );

    expect(notes?.split("\n")[4]).toBe(
      "Due date: 31/03/2026 (assumed: 30 days after the invoice date)",
    );
  });

  it("keeps a typed deadline's own notes, and none for blank ones", () => {
    expect(
      notesOf(createManualDeadline({ notes: "Call first" }), NAMES, "en-US"),
    ).toBe("Call first");
    expect(
      notesOf(createManualDeadline({ notes: null }), NAMES, "en-US"),
    ).toBeNull();
    expect(
      notesOf(createManualDeadline({ notes: "  " }), NAMES, "en-US"),
    ).toBeNull();
  });

  it("names a building, period or supplier it does not know by its id", () => {
    expect(descriptionOf(createInvoiceDeadline(), UNKNOWN_NAMES, "en-US")).toBe(
      "Invoice due ct9 no. 42 of €1,234.56",
    );
  });
});

describe("the calendar's words", () => {
  it.each([
    ["installments", "Installments"],
    ["invoices", "Invoices"],
    ["fiscal", "Fiscal"],
    ["policies", "Policies"],
    ["interventions", "Interventions"],
    ["general", "General"],
  ] as const)("names the %s calendar", (id, name) => {
    expect(calendarName(id)).toBe(name);
  });

  it.each([
    ["new", "New", "✦"],
    ["closed", "Closed", "✓"],
    ["cancelled", "Cancelled", "✕"],
    ["overdue", "Overdue", "!"],
  ] as const)("words and marks the %s status", (status, word, mark) => {
    expect(statusWord(status)).toBe(word);
    expect(statusMark(status)).toBe(mark);
  });

  it.each([
    ["none", "None"],
    ["low", "Low"],
    ["medium", "Medium"],
    ["high", "High"],
    ["critical", "Critical"],
  ] as const)("words the %s priority", (priority, word) => {
    expect(priorityWord(priority)).toBe(word);
  });

  it.each([
    ["2026-11", "November 2026"],
    ["2027-01", "January 2027"],
    ["2026-12", "December 2026"],
  ])("titles the month %s", (month, title) => {
    expect(monthTitle(month)).toBe(title);
  });

  it.each([
    ["2026-11-02", "2 November 2026"],
    ["2026-02-28", "28 February 2026"],
  ])("names the day %s", (day, title) => {
    expect(dayTitle(day)).toBe(title);
  });
});

describe("reasonText", () => {
  it.each([
    ["blank-description", "Enter a description"],
    ["description-too-long", "A description has at most 255 characters"],
    ["bad-date", "The date is not a date"],
    ["bad-time", "The time is HH:MM, from 00:00 to 23:59"],
    [
      "books-calendar",
      "Installments and Invoices hold only what the books say",
    ],
    ["unknown-building", "That building is not in the app"],
  ])("words %s", (reason, text) => {
    expect(reasonText(reason)).toBe(text);
  });

  it("shows a reason no one words as it is", () => {
    expect(reasonText("something-else")).toBe("something-else");
  });
});

const NAMES: DeadlineNames = {
  buildingName: (id: string): string => {
    return id === "c7" ? "Maple Court" : id;
  },
  periodName: (id: string): string => {
    return id === "p9" ? "2026 (Ordinary)" : id;
  },
  supplierName: (id: string): string => {
    return id === "ct9" ? "Acme Lifts" : id;
  },
};

const UNKNOWN_NAMES: DeadlineNames = {
  buildingName: (id: string): string => {
    return id;
  },
  periodName: (id: string): string => {
    return id;
  },
  supplierName: (id: string): string => {
    return id;
  },
};

function createInstallmentDeadline(): Deadline {
  return {
    source: "installment",
    id: "installment:in1",
    date: "2026-01-20",
    time: null,
    calendar: "installments",
    buildingId: "c7",
    status: "new",
    priority: "none",
    periodId: "p9",
    installmentId: "in1",
    installmentName: "1st installment",
    installmentNumber: 1,
    total: cents(250_000),
    paid: cents(100_050),
    remaining: cents(149_950),
  };
}

interface InvoiceChanges {
  dueDateAssumed?: boolean;
  date?: string;
}

function createInvoiceDeadline(changes: InvoiceChanges = {}): Deadline {
  return {
    source: "invoice",
    id: "invoice:li1",
    date: changes.date ?? "2026-03-15",
    time: null,
    calendar: "invoices",
    buildingId: "c7",
    status: "new",
    priority: "none",
    periodId: "p9",
    invoiceId: "li1",
    supplierId: "ct9",
    invoiceNumber: "42",
    invoiceDate: "2026-03-01",
    reason: "Lift maintenance",
    dueDateAssumed: changes.dueDateAssumed ?? false,
    total: cents(123_456),
    paid: cents(23_456),
    remaining: cents(100_000),
  };
}

interface ManualChanges {
  notes?: string | null;
}

function createManualDeadline(changes: ManualChanges = {}): Deadline {
  return manual({
    id: "ce1",
    date: "2026-02-05",
    time: null,
    calendar: "general",
    buildingId: null,
    description: "Boiler inspection",
    status: "new",
    priority: "none",
    notes: changes.notes === undefined ? null : changes.notes,
  });
}
