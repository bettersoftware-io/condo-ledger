import type { CalendarLayer, CalendarEvent } from "#/seedTypes.ts";
import type { Db } from "../db.ts";

// Catch-all layer for events whose layerId is null in the legacy dump.
// "lay0" cannot collide — legacy calendarLayer.id values start at 1.
// NOTE: legacy calendarLayer.color is a smallint colour-index in the DDL, not a CSS
// string; harmless here because the real dump has zero calendarLayer rows, but a
// future dump with layers would need an int→hex palette mapping.
const DEFAULT_LAYER_ID = "lay0";

const PRIORITY: Record<string, CalendarEvent["priority"]> = {
  idle: "idle",
  low: "low",
  normal: "medium",
  medium: "medium",
  high: "high",
  veryHigh: "critical",
  critical: "critical",
};

const STATUS: Record<string, CalendarEvent["status"]> = {
  new: "new",
  open: "new",
  todo: "new",
  done: "closed",
  closed: "closed",
  completed: "closed",
  cancelled: "cancelled",
  canceled: "cancelled",
};

export function projectLayers(db: Db): CalendarLayer[] {
  const layers = db.rows("calendarLayer").map((l) => ({
    id: `lay${l.id}`,
    name: String(l.name),
    color: String(l.color ?? "#7f8c8d"),
  }));
  const needsDefault = db.rows("calendarEvent").some((e) => e.layerId == null);
  if (needsDefault && !layers.some((l) => l.id === DEFAULT_LAYER_ID)) {
    layers.unshift({ id: DEFAULT_LAYER_ID, name: "Generale", color: "#7f8c8d" });
  }
  return layers;
}

export function projectEvents(db: Db): CalendarEvent[] {
  const linkByEvent = db.by("condominiumCalendarEvent", "calendarEventId");
  return db.rows("calendarEvent").map((e) => {
    const raw = String(e.date ?? "");
    const [datePart, timePart] = raw.split(" ");
    const link = linkByEvent.get(String(e.id));
    const apId =
      link !== undefined && link.accountingPeriodId !== null
        ? `p${link.accountingPeriodId}`
        : undefined;
    const ev: CalendarEvent = {
      id: `ev${e.id}`,
      date: datePart ?? raw,
      description: String(e.description ?? ""),
      layerId: e.layerId != null ? `lay${e.layerId}` : DEFAULT_LAYER_ID,
      status: STATUS[String(e.status)] ?? "new",
      priority: PRIORITY[String(e.priority)] ?? "medium",
    };
    if (e.ignoreTime !== true && timePart !== undefined && timePart !== "00:00:00") {
      ev.time = timePart.slice(0, 5);
    }
    if (apId !== undefined) ev.periodId = apId;
    const notes =
      e.notes === null || e.notes === undefined
        ? undefined
        : String(e.notes).trim() || undefined;
    if (notes !== undefined) ev.notes = notes;
    return ev;
  });
}
