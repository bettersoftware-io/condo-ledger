import { act } from "react";

import { TESTIDS } from "../ui/testids.ts";
import { startApp } from "./startApp.tsx";

export interface StartedApp {
  accountLine: () => string | null;
  breadcrumb: () => string | null;
  /** True when nothing is drawn in #root. */
  isBlank: () => boolean;
  stop: () => Promise<void>;
}

/** Gives the page a #root, as index.html does, and starts the app in it. */
export async function startAppOnPage(): Promise<StartedApp> {
  document.body.innerHTML = '<div id="root"></div>';

  let stop: () => void = stopNothing;

  await act(async () => {
    stop = startApp();
  });

  return {
    accountLine: (): string | null => {
      return textOf(TESTIDS.accountLine);
    },
    breadcrumb: (): string | null => {
      return textOf(TESTIDS.breadcrumb);
    },
    isBlank: (): boolean => {
      return document.getElementById("root")?.childElementCount === 0;
    },
    stop: async (): Promise<void> => {
      await act(async () => {
        stop();
      });
    },
  };
}

function textOf(testId: string): string | null {
  return (
    document.querySelector(`[data-testid="${testId}"]`)?.textContent ?? null
  );
}

/** Stands in until the app has started and handed back the real one. */
function stopNothing(): void {}

/** Leaves the page as a test found it. */
export function clearPage(): void {
  document.body.replaceChildren();
}
