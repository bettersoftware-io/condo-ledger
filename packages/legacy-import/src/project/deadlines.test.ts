import { describe, expect, it } from "vitest";

import { buildDb } from "../db.ts";
import type { Row, Tables } from "../loadRows.ts";
import { projectDeadlines } from "./deadlines.ts";

describe("projectDeadlines", () => {
  it("reads a day with no time of its own as a date and no time", () => {
    const [deadline] = project([event({ date: "2013-02-05 00:00:00" })]);

    expect(deadline).toMatchObject({ date: "2013-02-05", time: null });
  });

  it("reads a time of day as HH:MM", () => {
    const [deadline] = project([event({ date: "2013-02-05 10:30:00" })]);

    expect(deadline).toMatchObject({ date: "2013-02-05", time: "10:30" });
  });

  it("drops the time of a row that says to ignore it", () => {
    const [deadline] = project([
      event({ date: "2013-02-05 10:30:00", ignoreTime: true }),
    ]);

    expect(deadline?.time).toBeNull();
  });

  it("puts a row with no layer in General, tied to no building", () => {
    const [deadline] = project([event({ layerId: null })]);

    expect(deadline).toMatchObject({ calendar: "general", buildingId: null });
  });

  it("stops at a row that names a layer, which the domain has no calendar for", () => {
    expect(() => {
      return project([event({ id: "9", layerId: "3" })]);
    }).toThrow(/ce9.*layer 3/);
  });

  it("reads a missing status as new and keeps the three the legacy form had", () => {
    const statuses = project([
      event({ id: "1", status: null }),
      event({ id: "2", status: "closed" }),
      event({ id: "3", status: "cancelled" }),
    ]).map((deadline) => {
      return deadline.status;
    });

    expect(statuses).toEqual(["new", "closed", "cancelled"]);
  });

  it("stops at a status the domain does not know", () => {
    expect(() => {
      return project([event({ id: "4", status: "postponed" })]);
    }).toThrow(/ce4.*status postponed/);
  });

  it("reads a missing priority and idle as none, and the others as they are", () => {
    const priorities = project([
      event({ id: "1", priority: null }),
      event({ id: "2", priority: "idle" }),
      event({ id: "3", priority: "low" }),
      event({ id: "4", priority: "medium" }),
      event({ id: "5", priority: "high" }),
      event({ id: "6", priority: "critical" }),
    ]).map((deadline) => {
      return deadline.priority;
    });

    expect(priorities).toEqual([
      "none",
      "none",
      "low",
      "medium",
      "high",
      "critical",
    ]);
  });

  it("reads empty notes as none and keeps the words of others", () => {
    const notes = project([
      event({ id: "1", notes: "" }),
      event({ id: "2", notes: null }),
      event({ id: "3", notes: "Bring the keys" }),
    ]).map((deadline) => {
      return deadline.notes;
    });

    expect(notes).toEqual([null, null, "Bring the keys"]);
  });

  it("names a deadline ce<id> and lists them by id number", () => {
    const ids = project([event({ id: "23" }), event({ id: "8" })]).map(
      (deadline) => {
        return deadline.id;
      },
    );

    expect(ids).toEqual(["ce8", "ce23"]);
  });
});

function project(rows: Row[]): ReturnType<typeof projectDeadlines> {
  const tables: Tables = { calendarEvent: rows };

  return projectDeadlines(buildDb(tables));
}

function event(over: Row): Row {
  return {
    id: "1",
    studioId: "1",
    layerId: null,
    date: "2013-02-05 00:00:00",
    ignoreTime: false,
    description: "Policy expires",
    priority: "low",
    status: "new",
    notes: null,
    ...over,
  };
}
