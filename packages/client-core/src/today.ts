import { type ClockPort, romeTime } from "@cl/domain";

/** Today in Rome, as YYYY-MM-DD: the clock's moment, on the Rome wall clock. */
export function todayOf(clock: ClockPort): string {
  return romeTime(clock.now()).slice(0, 10);
}
