import type { Machine } from "./machine.ts";
import { createReducerMachine } from "./reducerMachine.ts";

type Panel = "top" | "bottom";

export interface MaximizeState {
  maximized: Panel | null;
}

export interface MaximizeIntents {
  toggle: (panel: Panel) => void;
  restore: () => void;
}

type MaximizeAction = { type: "toggle"; panel: Panel } | { type: "restore" };

const INITIAL: MaximizeState = { maximized: null };

export function reduceMaximize(
  current: MaximizeState,
  action: MaximizeAction,
): MaximizeState {
  switch (action.type) {
    case "toggle":
      return {
        maximized: current.maximized === action.panel ? null : action.panel,
      };
    case "restore":
      return INITIAL;
  }
}

/** Which of two stacked panels, if any, fills the whole column. */
export function createMaximizeMachine(): Machine<
  MaximizeState,
  MaximizeIntents
> {
  return createReducerMachine(INITIAL, reduceMaximize, (dispatch) => {
    return {
      toggle: (panel: Panel): void => {
        dispatch({ type: "toggle", panel });
      },
      restore: (): void => {
        dispatch({ type: "restore" });
      },
    };
  });
}
