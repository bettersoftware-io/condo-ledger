import { type DefaultedStateObservable, state } from "@rx-state/core";
import {
  BehaviorSubject,
  combineLatest,
  map,
  type Observable,
  startWith,
} from "rxjs";

import { type PeriodDates, type Result, rejected } from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import { parseDate } from "#/amounts.ts";

import type { Machine } from "./machine.ts";

/** What every form dialog (group, unit, owner, building, period, address) holds besides its own fields. */
export interface FormDialogState<TForm> {
  /** The fields as typed. */
  form: TForm;
  /** The form judged as the port will judge its write: a refusal is worded from it, with the form for its details. */
  verdict: Result;
  /** False while a required field is blank, and while a save runs. */
  canSave: boolean;
  /** True after the first edit: the UI shows the reason from then on. */
  touched: boolean;
  saving: boolean;
}

export interface DialogIntents<TForm> {
  /** Changes the fields; a field the dialog does not let change stays as it is. */
  edit: (patch: Partial<TForm>) => void;
  /** The form written, answered as the write answered; the verdict's Rejected, or `saving` while a save runs, without writing. */
  save: () => Promise<Result>;
}

/** A form judged: the verdict, the draft when the fields read, and whether every required field is filled. */
export interface Judgement<TDraft> {
  verdict: Result;
  draft: TDraft | null;
  filled: boolean;
}

/** How a dialog is made: its first fields, those it keeps fixed, how it judges them and writes, and what makes it judge again. */
interface FormDialogSpec<TForm, TDraft, TState> {
  initial: TForm;
  fixed: readonly (keyof TForm)[];
  judge: (form: TForm) => Judgement<TDraft>;
  stateOf: (base: FormDialogState<TForm>) => TState;
  write: (draft: TDraft) => Promise<Result>;
  rejudge$: Observable<unknown>;
}

interface Inner<TForm> {
  form: TForm;
  touched: boolean;
  saving: boolean;
}

/**
 * The machine every form dialog shares: the fields as typed, judged on each
 * edit, and a save that writes the draft only when the verdict accepts it.
 */
export function createFormDialog<TForm extends object, TDraft, TState>(
  spec: FormDialogSpec<TForm, TDraft, TState>,
): Machine<TState, DialogIntents<TForm>> {
  const inner$ = new BehaviorSubject<Inner<TForm>>({
    form: spec.initial,
    touched: false,
    saving: false,
  });

  function stateOf(inner: Inner<TForm>): TState {
    const { verdict, filled } = spec.judge(inner.form);

    return spec.stateOf({
      ...inner,
      verdict,
      canSave: filled && !inner.saving,
    });
  }

  const state$: DefaultedStateObservable<TState> = state(
    combineLatest([inner$, spec.rejudge$.pipe(startWith(null))]).pipe(
      map(([inner]) => {
        return stateOf(inner);
      }),
    ),
    stateOf(inner$.getValue()),
  );
  const subscription = state$.subscribe();

  function update(change: Partial<Inner<TForm>>): void {
    inner$.next({ ...inner$.getValue(), ...change });
  }

  return {
    state$,
    intents: {
      edit: (patch: Partial<TForm>): void => {
        const previous = inner$.getValue().form;
        const form: TForm = { ...previous, ...patch };

        for (const key of spec.fixed) {
          form[key] = previous[key];
        }

        update({ form, touched: true });
      },
      save: async (): Promise<Result> => {
        const { form, saving } = inner$.getValue();

        if (saving) {
          return rejected("saving");
        }

        const { verdict, draft } = spec.judge(form);

        if (!verdict.ok) {
          return verdict;
        }

        update({ saving: true });

        try {
          return await spec.write(must(draft, "the draft of an accepted form"));
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

/** The typed date as YYYY-MM-DD: null when blank, undefined when it does not read. */
export function dateOf(text: string, year: number): string | null | undefined {
  return text.trim() === "" ? null : (parseDate(text, year) ?? undefined);
}

/** The typed date as it reads; null while blank or unreadable. */
export function dateOrNull(text: string, year: number): string | null {
  return dateOf(text, year) ?? null;
}

/** `2011-05-01` as `01/05/2011`, a text parseDate reads back; blank for none. */
export function dateText(iso: string | null): string {
  return iso === null
    ? ""
    : `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** The year a date typed without one is in: the period's first. */
export function yearOf(period: PeriodDates): number {
  return Number(period.start.slice(0, 4));
}

export function textOrNull(text: string): string | null {
  const trimmed = text.trim();

  return trimmed === "" ? null : trimmed;
}
