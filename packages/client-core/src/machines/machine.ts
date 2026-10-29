import type { DefaultedStateObservable } from "@rx-state/core";

/**
 * State that changes on intents; the logic is a pure reducer. A dialog's or
 * a wizard's belongs to one component instance: the bindings create one per
 * mount and dispose it on unmount. A screen's grid, columns, split or tabs
 * belong to the application (`App.screens`), which keeps one for the session.
 */
export interface Machine<TState, TIntents extends object> {
  state$: DefaultedStateObservable<TState>;
  intents: TIntents;
  dispose: () => void;
}
