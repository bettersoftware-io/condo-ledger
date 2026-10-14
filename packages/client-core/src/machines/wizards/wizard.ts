import { type DefaultedStateObservable, state } from "@rx-state/core";
import { BehaviorSubject, map } from "rxjs";

import {
  type Cents,
  type EntryAdded,
  type EntryDraft,
  type Ok,
  type Rejected,
  type Result,
  type ResultOf,
  rejected,
} from "@cl/domain";

import type { Machine } from "../machine.ts";

/** One line of the "Entry postings" grid. */
interface PreviewLine {
  path: string;
  debit: Cents;
  credit: Cents;
}

/** An account, or a row of the tree, the person may pick; grouped for the picker. */
export interface WizardChoice {
  key: string;
  label: string;
  group: string;
}

/**
 * What a wizard shows. `TSummary` is what one kind of wizard shows beyond the
 * contract, computed here so the UI only formats it: the account paid from,
 * the lines' total, the running balances.
 */
interface WizardState<TForm, TSummary> {
  /** 1-based. */
  step: number;
  stepCount: number;
  form: TForm;
  choices: WizardChoice[];
  /** The "Entry postings" grid. */
  preview: PreviewLine[];
  /** validateEntry on the draft as it stands, after the wizard's own rules: decides Next and Save. */
  verdict: Result;
  summary: TSummary;
  /** True after the first edit: the UI shows the reason from then on. */
  touched: boolean;
  saving: boolean;
}

interface WizardIntents<TForm> {
  edit: (patch: Partial<TForm>) => void;
  next: () => void;
  back: () => void;
  /** The draft to addEntry, answered as it answered; the verdict's Rejected, or `saving` while a save runs, without calling it. */
  save: () => Promise<ResultOf<EntryAdded>>;
}

export type WizardMachine<TForm, TSummary> = Machine<
  WizardState<TForm, TSummary>,
  WizardIntents<TForm>
>;

export type AddEntry = (draft: EntryDraft) => Promise<ResultOf<EntryAdded>>;

/** A form the wizard accepts: the draft it writes. */
interface Accepting {
  preview: PreviewLine[];
  verdict: Ok;
  draft: EntryDraft;
}

/** A form the wizard refuses: no draft. */
interface Refusing {
  preview: PreviewLine[];
  verdict: Rejected;
  draft: null;
}

/** What a form derives: the preview, the verdict, and the draft when the verdict accepts. */
export type Derived = Accepting | Refusing;

export interface WizardDefinition<TForm, TSummary> {
  initial: TForm;
  stepCount: number;
  choices: WizardChoice[];
  derive: (form: TForm) => Derived;
  summarize: (form: TForm) => TSummary;
}

interface Inner<TForm> {
  form: TForm;
  step: number;
  touched: boolean;
  saving: boolean;
}

/** One contract for every wizard: the definition says what the form derives; the machine holds the form, the step and the save. */
export function createWizardMachine<TForm, TSummary>(
  definition: WizardDefinition<TForm, TSummary>,
  addEntry: AddEntry,
): WizardMachine<TForm, TSummary> {
  const inner$ = new BehaviorSubject<Inner<TForm>>({
    form: definition.initial,
    step: 1,
    touched: false,
    saving: false,
  });

  const state$: DefaultedStateObservable<WizardState<TForm, TSummary>> = state(
    inner$.pipe(
      map((inner) => {
        return stateOf(definition, inner);
      }),
    ),
    stateOf(definition, inner$.getValue()),
  );
  const subscription = state$.subscribe();

  function update(change: Partial<Inner<TForm>>): void {
    inner$.next({ ...inner$.getValue(), ...change });
  }

  return {
    state$,
    intents: {
      edit: (patch: Partial<TForm>): void => {
        update({
          form: { ...inner$.getValue().form, ...patch },
          touched: true,
        });
      },
      next: (): void => {
        update({
          step: Math.min(definition.stepCount, inner$.getValue().step + 1),
        });
      },
      back: (): void => {
        update({ step: Math.max(1, inner$.getValue().step - 1) });
      },
      save: async (): Promise<ResultOf<EntryAdded>> => {
        if (inner$.getValue().saving) {
          return rejected("saving");
        }

        const derived = definition.derive(inner$.getValue().form);

        if (derived.draft === null) {
          return derived.verdict;
        }

        update({ saving: true });

        try {
          return await addEntry(derived.draft);
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

/** A form of lines the person adds and removes. */
interface Lined<TLine> {
  lines: TLine[];
}

/** The machine, with `edit` keeping one line at least: an empty `lines` becomes the one empty line. */
export function keepingOneLine<TLine, TForm extends Lined<TLine>, TSummary>(
  machine: WizardMachine<TForm, TSummary>,
  emptyLine: TLine,
): WizardMachine<TForm, TSummary> {
  function edit(patch: Partial<TForm>): void {
    machine.intents.edit(
      patch.lines?.length === 0 ? { ...patch, lines: [emptyLine] } : patch,
    );
  }

  return { ...machine, intents: { ...machine.intents, edit } };
}

/** A form refused for a reason of the wizard's own, before there is anything to preview. */
export function refused(reason: string): Derived {
  return { preview: [], verdict: rejected(reason), draft: null };
}

function stateOf<TForm, TSummary>(
  definition: WizardDefinition<TForm, TSummary>,
  inner: Inner<TForm>,
): WizardState<TForm, TSummary> {
  const { preview, verdict } = definition.derive(inner.form);

  return {
    step: inner.step,
    stepCount: definition.stepCount,
    form: inner.form,
    choices: definition.choices,
    preview,
    verdict,
    summary: definition.summarize(inner.form),
    touched: inner.touched,
    saving: inner.saving,
  };
}
