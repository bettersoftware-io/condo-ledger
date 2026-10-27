import type { Machine } from "./machine.ts";
import { createReducerMachine } from "./reducerMachine.ts";
import type { DirectPaymentKind } from "./wizards/directPaymentWizard.ts";

/** The wizards the Journal screen opens. */
export type WizardName =
  | DirectPaymentKind
  | "multiCostPayment"
  | "genericEntry"
  | "invoice"
  | "invoicePayment"
  | "openingBalances"
  | "collection"
  | "budgetAllocation";

interface WizardDialog {
  kind: "wizard";
  wizard: WizardName;
  /** The id of the entry the wizard rewrites; null when it writes a new one. */
  editing: string | null;
}

interface DeleteDialog {
  kind: "delete";
}

type JournalDialog = WizardDialog | DeleteDialog | null;

export interface JournalDialogState {
  open: JournalDialog;
}

export interface JournalDialogIntents {
  /** A wizard on a new entry; the opening balances one edits the period's opening when there is one. */
  openWizard: (wizard: WizardName) => void;
  /** The entry's editor on the entry; nothing changes for an entry with none. */
  openEdit: (entryId: string) => void;
  openDelete: () => void;
  close: () => void;
}

/** What the dialog asks of the books as they stand. */
export interface JournalDialogLookups {
  /** The wizard that edits the entry; null for an entry that cannot be edited, or one the books do not hold. */
  editorOf: (entryId: string) => WizardName | null;
  /** The id of the period's opening entry; null when it has none. */
  openingEntry: () => string | null;
}

const INITIAL: JournalDialogState = { open: null };

/** Which dialog the Journal screen shows over the grid: one wizard, the delete confirmation, or none. Opening one replaces the other. */
export function createJournalDialogMachine(
  lookups: JournalDialogLookups,
): Machine<JournalDialogState, JournalDialogIntents> {
  /** The entry's editor on it; null when it has none. */
  function editDialog(entryId: string): WizardDialog | null {
    const wizard = lookups.editorOf(entryId);

    return wizard === null
      ? null
      : { kind: "wizard", wizard, editing: entryId };
  }

  return createReducerMachine(INITIAL, reduceJournalDialog, (dispatch) => {
    function openIfAny(dialog: WizardDialog | null): void {
      if (dialog !== null) {
        dispatch(dialog);
      }
    }

    return {
      openWizard: (wizard: WizardName): void => {
        const opening =
          wizard === "openingBalances" ? lookups.openingEntry() : null;

        openIfAny(
          opening === null
            ? { kind: "wizard", wizard, editing: null }
            : editDialog(opening),
        );
      },
      openEdit: (entryId: string): void => {
        openIfAny(editDialog(entryId));
      },
      openDelete: (): void => {
        dispatch({ kind: "delete" });
      },
      close: (): void => {
        dispatch(null);
      },
    };
  });
}

/** Each action is the dialog to show next, whatever was open before. */
function reduceJournalDialog(
  _current: JournalDialogState,
  open: JournalDialog,
): JournalDialogState {
  return { open };
}
