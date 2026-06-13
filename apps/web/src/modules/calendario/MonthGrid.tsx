import type { CalendarEvent, CalendarLayer } from "@cl/application";
import { WEEKDAYS, monthCells } from "./monthGridHelpers";
import styles from "./MonthGrid.module.css";

const MAX_CHIPS = 3;

export function MonthGrid({ ym, events, layers, selectedDay, onSelectDay, todayIso }: {
  ym: string; events: CalendarEvent[]; layers: CalendarLayer[];
  selectedDay: string | null; onSelectDay: (iso: string) => void;
  /** injectable for tests; defaults to UTC today (codebase is UTC-based) */
  todayIso?: string;
}) {
  const today = todayIso ?? new Date().toISOString().slice(0, 10);
  const colorOf = (layerId: string) => layers.find((l) => l.id === layerId)?.color ?? "#7f8c8d";
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  return (
    <div className={styles.grid}>
      {WEEKDAYS.map((w) => <div key={w} className={styles.weekday}>{w}</div>)}
      {monthCells(ym).map((c) => {
        const dayEvents = byDay.get(c.iso) ?? [];
        const cls = [
          styles.cell,
          c.inMonth ? "" : styles.outside,
          c.weekend ? styles.weekend : "",
          c.iso === today ? styles.today : "",
          c.iso === selectedDay ? styles.selected : "",
        ].filter(Boolean).join(" ");
        return (
          <div key={c.iso} data-iso={c.iso} className={cls} onClick={() => onSelectDay(c.iso)}>
            <span className={styles.dayNum}>{c.day}</span>
            {dayEvents.slice(0, MAX_CHIPS).map((e) => (
              <span key={e.id} className={styles.chip}
                style={{ background: colorOf(e.layerId) }} title={e.description}>
                {e.description}
              </span>
            ))}
            {dayEvents.length > MAX_CHIPS &&
              <span className={styles.more}>+{dayEvents.length - MAX_CHIPS} altre</span>}
          </div>
        );
      })}
    </div>
  );
}
