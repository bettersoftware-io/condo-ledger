import { describe, expect, it } from "vitest";

import { cents } from "#/entities/cents.ts";
import { type Deadline, manual } from "#/entities/deadline.ts";

import {
  type CalendarFilters,
  isOverdue,
  isShown,
  shownStatus,
} from "./overdue.ts";

describe("overdue", () => {
  it("is overdue when open and due before today", () => {
    expect(isOverdue(createManual({ date: "2026-11-02" }), "2026-11-03")).toBe(
      true,
    );
    expect(
      shownStatus(createManual({ date: "2026-11-02" }), "2026-11-03"),
    ).toBe("overdue");
  });

  it("is not overdue on its day", () => {
    expect(isOverdue(createManual({ date: "2026-11-03" }), "2026-11-03")).toBe(
      false,
    );
    expect(
      shownStatus(createManual({ date: "2026-11-03" }), "2026-11-03"),
    ).toBe("new");
  });

  it("is never overdue closed or cancelled", () => {
    for (const status of ["closed", "cancelled"] as const) {
      const deadline = createManual({ date: "2026-10-01", status });

      expect(isOverdue(deadline, "2026-11-03")).toBe(false);
      expect(shownStatus(deadline, "2026-11-03")).toBe(status);
    }
  });
});

describe("isShown", () => {
  it("shows all buildings for null, one building's and the studio's untied ones", () => {
    const tied = createManual({ buildingId: "c1" });
    const studio = createManual({ buildingId: null });

    expect(isShown(tied, filters(null))).toBe(true);
    expect(isShown(studio, filters(null))).toBe(true);
  });

  it("shows the manual deadlines tied to the chosen building and the computed ones of it", () => {
    expect(isShown(createManual({ buildingId: "c1" }), filters("c1"))).toBe(
      true,
    );
    expect(isShown(createManual({ buildingId: "c19" }), filters("c1"))).toBe(
      false,
    );
    expect(isShown(createManual({ buildingId: null }), filters("c1"))).toBe(
      false,
    );
    expect(isShown(createInstallment("c1"), filters("c1"))).toBe(true);
    expect(isShown(createInstallment("c19"), filters("c1"))).toBe(false);
  });

  it("hides a hidden calendar", () => {
    const hidden: CalendarFilters = {
      hidden: new Set(["fiscal"]),
      buildingId: null,
    };

    expect(isShown(createManual({ calendar: "fiscal" }), hidden)).toBe(false);
    expect(isShown(createManual({ calendar: "general" }), hidden)).toBe(true);
  });
});

function filters(buildingId: string | null): CalendarFilters {
  return { hidden: new Set(), buildingId };
}

interface ManualParts {
  date?: string;
  status?: "new" | "closed" | "cancelled";
  buildingId?: string | null;
  calendar?: "fiscal" | "general";
}

function createManual(parts: ManualParts): Deadline {
  return manual({
    id: "ce1",
    date: parts.date ?? "2026-11-03",
    time: null,
    calendar: parts.calendar ?? "general",
    buildingId: parts.buildingId === undefined ? null : parts.buildingId,
    description: "x",
    status: parts.status ?? "new",
    priority: "none",
    notes: null,
  });
}

function createInstallment(buildingId: string): Deadline {
  return {
    source: "installment",
    id: "installment:in1",
    date: "2026-11-03",
    time: null,
    calendar: "installments",
    buildingId,
    status: "new",
    priority: "none",
    periodId: "p1",
    installmentId: "in1",
    installmentName: "Rata 1",
    installmentNumber: 1,
    total: cents(0),
    paid: cents(0),
    remaining: cents(0),
  };
}
