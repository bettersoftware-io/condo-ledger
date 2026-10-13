import type { Machine } from "./machine.ts";
import { createReducerMachine } from "./reducerMachine.ts";

type Module = "calendar" | "buildings" | "contacts";
type Menu =
  | "data"
  | "units"
  | "thousandths"
  | "accounts"
  | "journal"
  | "installments";

export interface NavigationState {
  module: Module;
  menu: Menu;
}

export interface NavigationIntents {
  selectModule: (module: Module) => void;
  selectMenu: (menu: Menu) => void;
}

type NavigationAction =
  | { type: "selectModule"; module: Module }
  | { type: "selectMenu"; menu: Menu };

const INITIAL: NavigationState = { module: "buildings", menu: "accounts" };

export function reduceNavigation(
  current: NavigationState,
  action: NavigationAction,
): NavigationState {
  switch (action.type) {
    case "selectModule":
      return { ...current, module: action.module };
    case "selectMenu":
      return { ...current, menu: action.menu };
  }
}

/** Which module and which of its menus the person is in. */
export function createNavigationMachine(): Machine<
  NavigationState,
  NavigationIntents
> {
  return createReducerMachine(INITIAL, reduceNavigation, (dispatch) => {
    return {
      selectModule: (module: Module): void => {
        dispatch({ type: "selectModule", module });
      },
      selectMenu: (menu: Menu): void => {
        dispatch({ type: "selectMenu", menu });
      },
    };
  });
}
