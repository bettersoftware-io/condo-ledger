import { useState } from "react";

import type { EntryAdded, ResultOf } from "@cl/domain";

/** A wizard's save as its dialog uses it: the click, and the store's refusal until the next edit. */
interface WizardSave {
  /** Why the journal store refused the last save; null when it did not. */
  refusal: string | null;
  save: () => void;
  /** The person edits again: the refusal no longer applies. */
  forget: () => void;
}

/**
 * Saves through the wizard's machine: `Ok` hands the new entry's id to
 * `onSaved`, a refusal is kept to show until the person edits again.
 */
export function useWizardSave(
  save: () => Promise<ResultOf<EntryAdded>>,
  onSaved: (id: string) => void,
): WizardSave {
  const [refusal, setRefusal] = useState<string | null>(null);

  function settle(result: ResultOf<EntryAdded>): void {
    if (result.ok) {
      onSaved(result.value.id);

      return;
    }

    setRefusal(result.reason);
  }

  function saveNow(): void {
    // A click waits for nothing: the verdict is shown when it arrives.
    void save().then(settle).catch(reportFailed);
  }

  function forget(): void {
    setRefusal(null);
  }

  return { refusal, save: saveNow, forget };
}

/* v8 ignore next 3 -- only a real journal store can fail to answer; the simulator always does */
function reportFailed(error: unknown): void {
  console.error("the entry was not saved", error);
}
