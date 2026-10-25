import { useState } from "react";

import type { Result } from "@cl/domain";

/** A write to the schedule as a dialog uses it: the click, and the store's refusal until the next edit. */
interface ScheduleWrite {
  /** Why the installments store refused the last write; null when it did not. */
  refusal: string | null;
  /** Runs the write: `Ok` calls `onWritten`, a refusal is kept to show. */
  run: (write: () => Promise<Result>) => void;
  /** The person edits again, or asks anew: the refusal no longer applies. */
  forget: () => void;
}

/**
 * Writes to the installments store from a dialog: `Ok` hands over to
 * `onWritten` (the dialog closes), a refusal is kept to show until the person
 * edits or asks again.
 */
export function useScheduleWrite(
  onWritten: () => void,
  failure: string,
): ScheduleWrite {
  const [refusal, setRefusal] = useState<string | null>(null);

  function settle(result: Result): void {
    if (result.ok) {
      onWritten();

      return;
    }

    setRefusal(result.reason);
  }

  /* v8 ignore next 3 -- the simulator rejects only an id it does not hold, and a dialog writes only what the schedule it shows holds: only a real store fails otherwise */
  function reportFailed(error: unknown): void {
    console.error(failure, error);
  }

  function run(write: () => Promise<Result>): void {
    // A click waits for nothing: the schedule's stream redraws the grid, and
    // the verdict is shown when it arrives.
    void write().then(settle).catch(reportFailed);
  }

  function forget(): void {
    setRefusal(null);
  }

  return { refusal, run, forget };
}
