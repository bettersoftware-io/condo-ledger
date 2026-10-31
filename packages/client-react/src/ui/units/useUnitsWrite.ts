import { useState } from "react";

import type { Rejected, Result } from "@cl/domain";

/** A write to the units port as a dialog or a question uses it: the click, and the port's refusal until the next edit. */
interface UnitsWrite {
  /** Why the units port refused the last write, with its detail; null when it did not. */
  refusal: Rejected | null;
  /** Runs the write: `Ok` calls `onWritten`, a refusal is kept to show. */
  run: (write: () => Promise<Result>) => void;
  /** The person edits again, or asks anew: the refusal no longer applies. */
  forget: () => void;
}

/**
 * Writes to the units port from a dialog or a delete's question: `Ok` hands
 * over to `onWritten` (it closes), a refusal is kept, detail and all, to show
 * until the person edits or asks again.
 */
export function useUnitsWrite(
  onWritten: () => void,
  failure: string,
): UnitsWrite {
  const [refusal, setRefusal] = useState<Rejected | null>(null);

  function settle(result: Result): void {
    if (result.ok) {
      onWritten();

      return;
    }

    setRefusal(result);
  }

  /* v8 ignore next 3 -- the simulator answers every write to what the screen shows with a verdict: only a real store fails otherwise */
  function reportFailed(error: unknown): void {
    console.error(failure, error);
  }

  function run(write: () => Promise<Result>): void {
    // A click waits for nothing: the units' stream redraws the grid, and the
    // verdict is shown when it arrives.
    void write().then(settle).catch(reportFailed);
  }

  function forget(): void {
    setRefusal(null);
  }

  return { refusal, run, forget };
}
