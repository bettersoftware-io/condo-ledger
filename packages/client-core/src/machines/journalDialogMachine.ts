import type { Machine } from "./machine.ts";
import { createReducerMachine } from "./reducerMachine.ts";
import type { DirectPaymentKind } from "./wizards/directPaymentWizard.ts";

/** The five wizards the Journal screen opens. */
export type WizardName =
  | DirectPaymentKind
  | "multiCostPayment"
  | "genericEntry";

interface WizardDialog {
  kind: "wizard";
  wizard: WizardName;
}

interface DeleteDialog {
  kind: "delete";
}

type JournalDialog = WizardDialog | DeleteDialog | null;

export interface JournalDialogState {
  open: JournalDialog;
}

export interface JournalDialogIntents {
  openWizard: (wizard: WizardName) => void;
  openDelete: () => void;
  close: () => void;
}

const INITIAL: JournalDialogState = { open: null };

/** Which dialog the Journal screen shows over the grid: one wizard, the delete confirmation, or none. Opening one replaces the other. */
export function createJournalDialogMachine(): Machine<
  JournalDialogState,
  JournalDialogIntents
> {
  return createReducerMachine(INITIAL, reduceJournalDialog, (dispatch) => {
    return {
      openWizard: (wizard: WizardName): void => {
        dispatch({ kind: "wizard", wizard });
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
