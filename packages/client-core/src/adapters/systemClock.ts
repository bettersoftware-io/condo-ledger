import type { ClockPort } from "@cl/domain";

/** The real clock: the moment the application asks. */
export const systemClock: ClockPort = {
  now: (): Date => {
    return new Date();
  },
};
