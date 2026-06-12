import { addMonths } from "../../recompute/dates";

export interface MonthCell { iso: string; day: number; inMonth: boolean; weekend: boolean; }

// Static labels: deterministic across Node ICU builds (Intl month names vary by ICU data).
export const WEEKDAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
// index 0 = Gennaio … 11 = Dicembre (matches getUTCMonth())
export const MONTHS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

/** 42 cells (6 fixed weeks), Monday-first, covering the whole `ym` ("yyyy-mm") month plus padding. */
export function monthCells(ym: string): MonthCell[] {
  const [y = 0, m = 1] = ym.split("-").map(Number);
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1, 1 - offset + i));
    const wd = (d.getUTCDay() + 6) % 7;
    return {
      iso: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === m - 1,
      weekend: wd >= 5,
    };
  });
}

/** "yyyy-mm" shifted by `delta` months (delegates to the shared addMonths). */
export function shiftMonth(ym: string, delta: number): string {
  return addMonths(`${ym}-01`, delta).slice(0, 7);
}
