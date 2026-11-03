import type { Machine } from "./machine.ts";
import { createReducerMachine } from "./reducerMachine.ts";

export interface SidebarState {
  width: number;
  open: boolean;
}

export interface SidebarIntents {
  resize: (px: number) => void;
  open: () => void;
  close: () => void;
}

type SidebarAction =
  | { type: "resize"; px: number }
  | { type: "open" }
  | { type: "close" };

const MIN_WIDTH = 180;
const MAX_WIDTH = 440;
const DEFAULT_WIDTH = 272;

export function reduceSidebar(
  current: SidebarState,
  action: SidebarAction,
): SidebarState {
  switch (action.type) {
    case "resize":
      return {
        ...current,
        width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, action.px)),
      };
    case "open":
      return { ...current, open: true };
    case "close":
      return { ...current, open: false };
  }
}

/** The side panel: how wide it is (never under 180 or over 440 pixels) and whether it is showing. It starts `width` wide, 272 unless the panel says otherwise. */
export function createSidebarMachine(
  width: number = DEFAULT_WIDTH,
): Machine<SidebarState, SidebarIntents> {
  const initial: SidebarState = { width, open: false };

  return createReducerMachine(initial, reduceSidebar, (dispatch) => {
    return {
      resize: (px: number): void => {
        dispatch({ type: "resize", px });
      },
      open: (): void => {
        dispatch({ type: "open" });
      },
      close: (): void => {
        dispatch({ type: "close" });
      },
    };
  });
}
