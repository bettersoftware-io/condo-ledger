import { useStateObservable } from "@react-rxjs/core";

import type { Machine } from "@cl/client-core";

import type { MachineView } from "./useMachine.ts";

/** A machine the application owns (one per app, not per component): read its state, hand out its intents. */
export function useSharedMachine<TState, TIntents extends object>(
  machine: Machine<TState, TIntents>,
): MachineView<TState, TIntents> {
  return { state: useStateObservable(machine.state$), ...machine.intents };
}
