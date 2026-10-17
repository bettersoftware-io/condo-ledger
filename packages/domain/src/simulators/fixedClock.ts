import type { ClockPort } from "#/ports/clockPort.ts";

/** A clock stopped at one moment: tests and goldens stamp the same thing every run. */
export function fixedClock(iso: string): ClockPort {
  const moment = new Date(iso).getTime();

  if (Number.isNaN(moment)) {
    throw new Error(`not a moment: ${iso}`);
  }

  return {
    now: (): Date => {
      return new Date(moment);
    },
  };
}
