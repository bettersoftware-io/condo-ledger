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
import { must } from "@cl/domain/support/must.ts";

import { parseDate } from "#/amounts.ts";

import type { Machine } from "./machine.ts";

/** What the Edit Installment dialog's fields hold. */
export interface InstallmentDialogForm {
  name: string;
  /** As typed: `15/07/2011`, `15/7/2011`, or `15/7` in the year of the installment's due date. */
  dueDate: string;
  locked: boolean;
}

export interface InstallmentDialogState {
  form: InstallmentDialogForm;
  /** The due date as it reads, "YYYY-MM-DD"; null while it reads as none. */
  dueDate: string | null;
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
 * due date while Locked stays on; unlocking and editing is one save. The due
 * date is typed as day/month/year, and a text that reads as no date is
 * `invalid-due-date`. Save writes only the fields that changed.
 */
export function createInstallmentDialog(
  installment: Installment,
  write: (patch: InstallmentPatch) => Promise<Result>,
  context: ScheduleContext,
): Machine<InstallmentDialogState, InstallmentDialogIntents> {
  const year = Number(installment.dueDate.slice(0, 4));
  const inner$ = new BehaviorSubject<Inner>({
    form: {
      name: installment.name,
      dueDate: dateText(installment.dueDate),
      locked: installment.locked,
    },
    touched: false,
    saving: false,
  });

  function stateOf(inner: Inner): InstallmentDialogState {
    const dueDate = parseDate(inner.form.dueDate, year);

    return {
      ...inner,
      dueDate,
      verdict:
        dueDate === null
          ? rejected("invalid-due-date")
          : validateUpdate(
              context,
              installment.id,
              patchOf(installment, inner.form, dueDate),
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

        const { verdict, form, dueDate } = state$.getValue();

        if (!verdict.ok) {
          return verdict;
        }

        update({ saving: true });

        try {
          return await write(
            patchOf(
              installment,
              form,
              must(dueDate, "the due date of an accepted form"),
            ),
          );
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

/** The fields the form changes from the installment as it stands, the due date as it reads. */
function patchOf(
  installment: Installment,
  form: InstallmentDialogForm,
  dueDate: string,
): InstallmentPatch {
  const patch: InstallmentPatch = {};

  if (form.name !== installment.name) {
    patch.name = form.name;
  }

  if (dueDate !== installment.dueDate) {
    patch.dueDate = dueDate;
  }

  if (form.locked !== installment.locked) {
    patch.locked = form.locked;
  }

  return patch;
}

/** `2011-07-15` as `15/07/2011`, a text parseDate reads back. */
function dateText(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}
