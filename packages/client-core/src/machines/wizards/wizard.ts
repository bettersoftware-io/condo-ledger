import { type DefaultedStateObservable, state } from "@rx-state/core";
import { BehaviorSubject, EMPTY, map, merge, type Observable } from "rxjs";

import {
  accepted,
  type Cents,
  type EntryAdded,
  type EntryContext,
  type EntryDraft,
  type Ok,
  type Rejected,
  type Result,
  type ResultOf,
  rejected,
  validateEntry,
} from "@cl/domain";

import type { JournalPresenter } from "#/presenters/journalPresenter.ts";

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
export interface WizardState<TForm, TSummary> {
  /** 1-based. */
  step: number;
  /** The step the wizard starts at: Back is disabled there. */
  firstStep: number;
  stepCount: number;
  form: TForm;
  choices: WizardChoice[];
  /** The "Entry postings" grid. */
  preview: PreviewLine[];
  /** validateEntry on the draft as it stands, after the wizard's own rules: decides Save. */
  verdict: Result;
  /** The current step's own rules on the form as it stands: decides Next. */
  stepVerdict: Result;
  summary: TSummary;
  /** True after the first edit: the UI shows the reason from then on. */
  touched: boolean;
  saving: boolean;
  /** The id of the entry the wizard rewrites; null when it writes a new one. */
  editing: string | null;
}

/** `TSaved` is what a write answers when it is done: an entry's id, for the journal's wizards. */
export interface WizardIntents<
  TForm,
  TSaved extends Result = ResultOf<EntryAdded>,
> {
  edit: (patch: Partial<TForm>) => void;
  /** To the next step, while the current step's verdict accepts. */
  next: () => void;
  /** To the step before, down to the first step. */
  back: () => void;
  /** The draft written, answered as the write answered; the verdict's Rejected, or `saving` while a save runs, without writing. */
  save: () => Promise<TSaved | Rejected>;
}

export type WizardMachine<
  TForm,
  TSummary,
  TSaved extends Result = ResultOf<EntryAdded>,
> = Machine<WizardState<TForm, TSummary>, WizardIntents<TForm, TSaved>>;

/** How a wizard's draft is written: added as a new entry, or replacing the entry it edits. Either way it answers the entry's id. */
export type WriteEntry = (draft: EntryDraft) => Promise<ResultOf<EntryAdded>>;

/** A write that rewrites this entry: an accepted replace answers its id, a refused one its reason, and one the port rejects (the entry is gone) `entry-gone`. */
export function replacing(
  entryId: string,
  replaceEntry: JournalPresenter["replaceEntry"],
): WriteEntry {
  async function write(draft: EntryDraft): Promise<ResultOf<EntryAdded>> {
    let result: Result;

    try {
      result = await replaceEntry(entryId, draft);
    } catch {
      return rejected("entry-gone");
    }

    return result.ok ? accepted({ id: entryId }) : result;
  }

  return write;
}

/** A form the wizard accepts: the draft it writes. */
interface Accepting<TDraft extends object> {
  preview: PreviewLine[];
  verdict: Ok;
  draft: TDraft;
}

/** A form the wizard refuses: no draft. */
interface Refusing {
  preview: PreviewLine[];
  verdict: Rejected;
  draft: null;
}

/** What a form derives: the preview, the verdict, and the draft when the verdict accepts. A journal entry's, unless the wizard writes something else. */
export type Derived<TDraft extends object = EntryDraft> =
  | Accepting<TDraft>
  | Refusing;

export interface WizardDefinition<
  TForm,
  TSummary,
  TDraft extends object = EntryDraft,
> {
  initial: TForm;
  /** The step the wizard starts at, 1 unless an edit starts past a choice it cannot change. */
  firstStep?: number;
  stepCount: number;
  choices: WizardChoice[];
  derive: (form: TForm) => Derived<TDraft>;
  summarize: (form: TForm) => TSummary;
  /** The rules of one step on the form: what Next waits for. */
  stepVerdict: (form: TForm, step: number) => Result;
  /** The id of the entry the wizard rewrites; null, or left out, for a new one. */
  editing?: string | null;
}

interface Inner<TForm> {
  form: TForm;
  step: number;
  touched: boolean;
  saving: boolean;
}

/**
 * One contract for every wizard: the definition says what the form derives;
 * the machine holds the form, the step and the save. A wizard writes a
 * journal entry unless it names another draft and what its write answers.
 * Each emission of `rejudge$` derives the form as it stands again: what the
 * definition reads beyond the form (the amounts' locale) has changed.
 */
export function createWizardMachine<
  TForm,
  TSummary,
  TDraft extends object = EntryDraft,
  TSaved extends Result = ResultOf<EntryAdded>,
>(
  definition: WizardDefinition<TForm, TSummary, TDraft>,
  write: (draft: TDraft) => Promise<TSaved>,
  rejudge$: Observable<unknown> = EMPTY,
): WizardMachine<TForm, TSummary, TSaved> {
  const firstStep = definition.firstStep ?? 1;
  const inner$ = new BehaviorSubject<Inner<TForm>>({
    form: definition.initial,
    step: firstStep,
    touched: false,
    saving: false,
  });

  const state$: DefaultedStateObservable<WizardState<TForm, TSummary>> = state(
    merge(inner$, rejudge$).pipe(
      map(() => {
        return stateOf(definition, inner$.getValue());
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
        const { form, step } = inner$.getValue();

        if (definition.stepVerdict(form, step).ok) {
          update({ step: Math.min(definition.stepCount, step + 1) });
        }
      },
      back: (): void => {
        update({ step: Math.max(firstStep, inner$.getValue().step - 1) });
      },
      save: async (): Promise<TSaved | Rejected> => {
        if (inner$.getValue().saving) {
          return rejected("saving");
        }

        const derived = definition.derive(inner$.getValue().form);

        if (!isAccepting(derived)) {
          return derived.verdict;
        }

        update({ saving: true });

        try {
          return await write(derived.draft);
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

/** The draft as the domain judges it against the context, beside its preview: the draft is kept only when the verdict accepts. */
export function judged(
  preview: PreviewLine[],
  draft: EntryDraft,
  context: EntryContext,
): Derived {
  const verdict = validateEntry(draft, context);

  return verdict.ok
    ? { preview, verdict, draft }
    : { preview, verdict, draft: null };
}

/** A form refused for a reason of the wizard's own, before there is anything to preview. */
export function refused<TDraft extends object = EntryDraft>(
  reason: string,
): Derived<TDraft> {
  return { preview: [], verdict: rejected(reason), draft: null };
}

/** Whether the form gives a draft: a guard, as a generic draft is no discriminant. */
function isAccepting<TDraft extends object>(
  derived: Derived<TDraft>,
): derived is Accepting<TDraft> {
  return derived.draft !== null;
}

function stateOf<TForm, TSummary, TDraft extends object>(
  definition: WizardDefinition<TForm, TSummary, TDraft>,
  inner: Inner<TForm>,
): WizardState<TForm, TSummary> {
  const { preview, verdict } = definition.derive(inner.form);

  return {
    step: inner.step,
    firstStep: definition.firstStep ?? 1,
    stepCount: definition.stepCount,
    form: inner.form,
    choices: definition.choices,
    preview,
    verdict,
    stepVerdict: definition.stepVerdict(inner.form, inner.step),
    summary: definition.summarize(inner.form),
    touched: inner.touched,
    saving: inner.saving,
    editing: definition.editing ?? null,
  };
}
