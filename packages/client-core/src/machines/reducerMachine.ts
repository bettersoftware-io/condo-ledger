import { state } from "@rx-state/core";
import { Subject, scan } from "rxjs";

import type { Machine } from "./machine.ts";

/** A machine from a pure reducer: actions in, one state stream out, held open for the machine's life so an early intent is not lost. */
export function createReducerMachine<TState, TAction, TIntents extends object>(
  initial: TState,
  reduce: (state: TState, action: TAction) => TState,
  bindIntents: (dispatch: (action: TAction) => void) => TIntents,
): Machine<TState, TIntents> {
  const actions$ = new Subject<TAction>();
  const state$ = state(actions$.pipe(scan(reduce, initial)), initial);
  const subscription = state$.subscribe();

  return {
    state$,
    intents: bindIntents((action: TAction): void => {
      actions$.next(action);
    }),
    dispose: (): void => {
      subscription.unsubscribe();
      actions$.complete();
    },
  };
}
