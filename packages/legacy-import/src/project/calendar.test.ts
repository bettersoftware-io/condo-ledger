import { describe, it, expect } from "vitest";
import { projectLayers, projectEvents } from "./calendar.ts";
import { buildDb } from "../db.ts";
import type { Tables } from "../loadRows.ts";

const tables: Tables = {
  calendarLayer: [{ id: "1", name: "Scadenze", color: "#c0392b", description: null, order: "1" }],
  calendarEvent: [
    { id: "5", layerId: "1", date: "2011-04-16 00:00:00", ignoreTime: true, description: "F24", priority: "high", status: "new", notes: null, studioId: "1" },
    { id: "6", layerId: "1", date: "2011-04-21 18:00:00", ignoreTime: false, description: "Assemblea", priority: "veryHigh", status: "done", notes: "odg", studioId: "1" },
  ],
  condominiumCalendarEvent: [{ calendarEventId: "6", condominiumId: "1", accountingPeriodId: "1", unitGroupId: null, unitId: null, unitResidentId: null, masterDataId: null }],
};

describe("calendar projection", () => {
  const db = buildDb(tables);
  it("maps layers", () => {
    expect(projectLayers(db)).toEqual([{ id: "lay1", name: "Scadenze", color: "#c0392b" }]);
  });
  it("maps events: date split, status/priority vocab, period link, time when not ignored", () => {
    const ev = projectEvents(db);
    expect(ev.find((e) => e.id === "ev5")).toMatchObject({ date: "2011-04-16", description: "F24", layerId: "lay1", status: "new", priority: "high" });
    expect(ev.find((e) => e.id === "ev5")!.time).toBeUndefined();
    expect(ev.find((e) => e.id === "ev6")).toMatchObject({ date: "2011-04-21", time: "18:00", status: "closed", priority: "critical", periodId: "p1", notes: "odg" });
  });
  it("real-data: no lay0 injected when all events have a layerId (needsDefault=false)", () => {
    const layers = projectLayers(db);
    expect(layers.some((l) => l.id === "lay0")).toBe(false);
    expect(layers).toEqual([{ id: "lay1", name: "Scadenze", color: "#c0392b" }]);
  });
});

// Regression: real dump has 0 calendarLayer rows and calendarEvent rows with layerId=null.
// Must synthesize a catch-all "lay0" layer and never produce "laynull".
const nullLayerTables: Tables = {
  calendarLayer: [],
  calendarEvent: [
    { id: "1", layerId: null, date: "2013-06-30 00:00:00", ignoreTime: true, description: "Scadenza", priority: "normal", status: "new", notes: null, studioId: "1" },
    { id: "2", layerId: null, date: "2013-09-15 00:00:00", ignoreTime: true, description: "Assemblea", priority: "high", status: "done", notes: null, studioId: "1" },
  ],
  condominiumCalendarEvent: [],
};

describe("calendar projection — null layerId (real-dump regression)", () => {
  const db = buildDb(nullLayerTables);
  it("synthesises the default catch-all layer when some events have layerId=null", () => {
    const layers = projectLayers(db);
    expect(layers).toContainEqual({ id: "lay0", name: "Generale", color: "#7f8c8d" });
  });
  it("maps null layerId to lay0, never to laynull", () => {
    const ev = projectEvents(db);
    expect(ev.every((e) => e.layerId !== "laynull")).toBe(true);
    expect(ev.find((e) => e.id === "ev1")).toMatchObject({ layerId: "lay0" });
    expect(ev.find((e) => e.id === "ev2")).toMatchObject({ layerId: "lay0" });
  });
  it("every projected event references a layer that exists in projectLayers", () => {
    const layerIds = new Set(projectLayers(db).map((l) => l.id));
    const ev = projectEvents(db);
    expect(ev.every((e) => layerIds.has(e.layerId))).toBe(true);
  });
});
