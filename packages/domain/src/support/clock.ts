/** Where the time comes from. A simulator stamps with it; the server has its own. */
export interface Clock {
  now: () => Date;
}

export const systemClock: Clock = {
  now: (): Date => {
    return new Date();
  },
};

/** A clock stopped at one moment: tests and goldens stamp the same thing every run. */
export function fixedClock(iso: string): Clock {
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
