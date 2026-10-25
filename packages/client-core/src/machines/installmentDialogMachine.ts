import { type DefaultedStateObservable, state } from "@rx-state/core";
import { BehaviorSubject, map } from "rxjs";

import {
  type Installment,
  type InstallmentPatch,
  type Result,
  rejected,
  type ScheduleContext,
  validateUpdate,
} from "@cl/domain";

import type { Machine } from "./machine.ts";

/** What the Edit Installment dialog's fields hold. */
interface InstallmentDialogForm {
  name: string;
  /** "YYYY-MM-DD". */
  dueDate: string;
  locked: boolean;
}

export interface InstallmentDialogState {
  form: InstallmentDialogForm;
  /** validateUpdate on what the form changes: decides Save. */
  verdict: Result;
  /** True after the first edit: the UI shows the reason from then on. */
  touched: boolean;
  saving: boolean;
}

export interface InstallmentDialogIntents {
  edit: (patch: Partial<InstallmentDialogForm>) => void;
  /** What the form changes written, answered as the write answered; the verdict's Rejected, or `saving` while a save runs, without writing. */
  save: () => Promise<Result>;
}

interface Inner {
  form: InstallmentDialogForm;
  touched: boolean;
  saving: boolean;
}

/**
 * The Edit Installment dialog over one installment: its name, due date and
 * lock. The form is judged as the port will judge its write, against the
 * period's schedule in `context`: a locked installment takes no new name or
 * due date while Locked stays on; unlocking and editing is one save. Save
 * writes only the fields that changed.
 */
export function createInstallmentDialog(
  installment: Installment,
  write: (patch: InstallmentPatch) => Promise<Result>,
  context: ScheduleContext,
): Machine<InstallmentDialogState, InstallmentDialogIntents> {
  const inner$ = new BehaviorSubject<Inner>({
    form: {
      name: installment.name,
      dueDate: installment.dueDate,
      locked: installment.locked,
    },
    touched: false,
    saving: false,
  });

  function stateOf(inner: Inner): InstallmentDialogState {
    return {
      ...inner,
      verdict: validateUpdate(
        context,
        installment.id,
        patchOf(installment, inner.form),
      ),
    };
  }

  const state$: DefaultedStateObservable<InstallmentDialogState> = state(
    inner$.pipe(map(stateOf)),
    stateOf(inner$.getValue()),
  );
  const subscription = state$.subscribe();

  function update(change: Partial<Inner>): void {
    inner$.next({ ...inner$.getValue(), ...change });
  }

  return {
    state$,
    intents: {
      edit: (patch: Partial<InstallmentDialogForm>): void => {
        update({
          form: { ...inner$.getValue().form, ...patch },
          touched: true,
        });
      },
      save: async (): Promise<Result> => {
        if (inner$.getValue().saving) {
          return rejected("saving");
        }

        const { verdict } = state$.getValue();

        if (!verdict.ok) {
          return verdict;
        }

        update({ saving: true });

        try {
          return await write(patchOf(installment, inner$.getValue().form));
        } finally {
          update({ saving: false });
        }
      },
    },
    dispose: (): void => {
      subscription.unsubscribe();
      inner$.complete();
    },
  };
}

/** The fields the form changes from the installment as it stands. */
function patchOf(
  installment: Installment,
  form: InstallmentDialogForm,
): InstallmentPatch {
  const patch: InstallmentPatch = {};

  if (form.name !== installment.name) {
    patch.name = form.name;
  }

  if (form.dueDate !== installment.dueDate) {
    patch.dueDate = form.dueDate;
  }

  if (form.locked !== installment.locked) {
    patch.locked = form.locked;
  }

  return patch;
}
