import { useState } from "react";

import type { EntryAdded, ResultOf } from "@cl/domain";

/** A wizard's save and edit as its dialog uses them: the click, the store's refusal until the next edit, and the edit that clears it. */
interface WizardSave<TForm> {
  /** Why the journal store refused the last save; null when it did not. */
  refusal: string | null;
  save: () => void;
  /** The person edits: the refusal no longer applies, and the wizard takes the patch. */
  edit: (patch: Partial<TForm>) => void;
}

/** What the dialog asks of a wizard's machine view. */
interface WizardSource<TForm> {
  save: () => Promise<ResultOf<EntryAdded>>;
  edit: (patch: Partial<TForm>) => void;
}

/**
 * Saves through the wizard's machine: `Ok` hands the new entry's id to
 * `onSaved`, a refusal is kept to show until the person edits again.
 */
export function useWizardSave<TForm>(
  wizard: WizardSource<TForm>,
  onSaved: (id: string) => void,
): WizardSave<TForm> {
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
    void wizard.save().then(settle).catch(reportFailed);
  }

  function edit(patch: Partial<TForm>): void {
    setRefusal(null);
    wizard.edit(patch);
  }

  return { refusal, save: saveNow, edit };
}

/* v8 ignore next 3 -- only a real journal store can fail to answer; the simulator always does */
function reportFailed(error: unknown): void {
  console.error("the entry was not saved", error);
}
