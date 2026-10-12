import type { Machine } from "./machine.ts";
import { createReducerMachine } from "./reducerMachine.ts";

export interface SplitState {
  ratio: number;
}

export interface SplitIntents {
  setRatio: (ratio: number) => void;
}

interface SetRatio {
  type: "setRatio";
  ratio: number;
}

const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;
const INITIAL: SplitState = { ratio: 0.5 };

export function reduceSplit(
  _current: SplitState,
  action: SetRatio,
): SplitState {
  return { ratio: Math.min(MAX_RATIO, Math.max(MIN_RATIO, action.ratio)) };
}

/** How two stacked panels share their column: the top one's share, never below a fifth or above four fifths. */
export function createSplitMachine(): Machine<SplitState, SplitIntents> {
  return createReducerMachine(INITIAL, reduceSplit, (dispatch) => {
    return {
      setRatio: (ratio: number): void => {
        dispatch({ type: "setRatio", ratio });
      },
    };
  });
}
