import { type DefaultedStateObservable, state } from "@rx-state/core";
import { BehaviorSubject, map } from "rxjs";

import {
  type Result,
  rejected,
  type TableDraft,
  type ThousandthTable,
  validateTable,
} from "@cl/domain";

import type { Machine } from "./machine.ts";

/** What the New and Edit Thousandth Table dialogs' fields hold. */
interface TableDialogForm {
  name: string;
  /** As typed: a whole number from 1. */
  order: string;
  notes: string;
}

export interface TableDialogState {
  form: TableDialogForm;
  /** validateTable on the form, the order as it reads: decides Save. */
  verdict: Result;
  /** True after the first edit: the UI shows the reason from then on. */
  touched: boolean;
  saving: boolean;
  /** The id of the table the dialog edits; null for a new one. */
  editing: string | null;
}

export interface TableDialogIntents {
  edit: (patch: Partial<TableDialogForm>) => void;
  /** The form written, answered as the write answered; the verdict's Rejected, or `saving` while a save runs, without writing. */
  save: () => Promise<Result>;
}

interface Inner {
  form: TableDialogForm;
  touched: boolean;
  saving: boolean;
}

/**
 * The New and Edit Thousandth Table dialog over a period's `tables`: a name
 * unique in the period, an order and notes. The form is judged as the port
 * will judge its write; an order that does not read as a whole number is
 * `bad-order`. A new table starts on the highest order + 1, or 1 in a period
 * with none; an edit on the table as it stands.
 */
export function createTableDialog(
  tables: ThousandthTable[],
  editing: ThousandthTable | null,
  write: (draft: TableDraft) => Promise<Result>,
): Machine<TableDialogState, TableDialogIntents> {
  const editingId = editing?.id ?? null;
  const inner$ = new BehaviorSubject<Inner>({
    form:
      editing === null
        ? { name: "", order: String(nextOrder(tables)), notes: "" }
        : {
            name: editing.name,
            order: String(editing.order),
            notes: editing.notes,
          },
    touched: false,
    saving: false,
  });

  function stateOf(inner: Inner): TableDialogState {
    return {
      ...inner,
      verdict: validateTable(tables, draftOf(inner.form), editingId),
      editing: editingId,
    };
  }

  const state$: DefaultedStateObservable<TableDialogState> = state(
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
      edit: (patch: Partial<TableDialogForm>): void => {
        update({
          form: { ...inner$.getValue().form, ...patch },
          touched: true,
        });
      },
      save: async (): Promise<Result> => {
        if (inner$.getValue().saving) {
          return rejected("saving");
        }

        const { verdict, form } = state$.getValue();

        if (!verdict.ok) {
          return verdict;
        }

        update({ saving: true });

        try {
          return await write(draftOf(form));
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

/** The form as the port takes it: the order as it reads, NaN for text that does not. */
function draftOf(form: TableDialogForm): TableDraft {
  return { name: form.name, order: orderOf(form.order), notes: form.notes };
}

/** The text as a whole number; NaN for any other text, which validateTable refuses `bad-order`. */
function orderOf(text: string): number {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : Number.NaN;
}

/** The order after the highest of the tables; 1 with none. */
function nextOrder(tables: ThousandthTable[]): number {
  return (
    tables.reduce((highest, table) => {
      return Math.max(highest, table.order);
    }, 0) + 1
  );
}
