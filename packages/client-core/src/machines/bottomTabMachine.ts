import type { Machine } from "./machine.ts";
import { createReducerMachine } from "./reducerMachine.ts";

export interface BottomTabState {
  active: string;
}

export interface BottomTabIntents {
  /** A name that is not one of the tabs is ignored. */
  activate: (tab: string) => void;
}

interface Activate {
  type: "activate";
  tab: string;
}

export function reduceBottomTab(
  tabs: readonly string[],
): (current: BottomTabState, action: Activate) => BottomTabState {
  return (current: BottomTabState, action: Activate): BottomTabState => {
    return tabs.includes(action.tab) ? { active: action.tab } : current;
  };
}

/** Which tab of a tabbed panel is in front. */
export function createBottomTabMachine(
  tabs: readonly string[],
): Machine<BottomTabState, BottomTabIntents> {
  const [first] = tabs;

  if (first === undefined) {
    throw new Error("a tabbed panel needs at least one tab");
  }

  return createReducerMachine(
    { active: first },
    reduceBottomTab(tabs),
    (dispatch) => {
      return {
        activate: (tab: string): void => {
          dispatch({ type: "activate", tab });
        },
      };
    },
  );
}
