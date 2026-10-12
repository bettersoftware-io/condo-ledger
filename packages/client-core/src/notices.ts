import { type DefaultedStateObservable, state } from "@rx-state/core";
import { BehaviorSubject } from "rxjs";

interface Notice {
  id: number;
  text: string;
}

export interface Notices {
  notices$: DefaultedStateObservable<Notice[]>;
  /** For a control the design shows but M1 does not wire: says so instead of doing nothing. */
  stub: (label: string) => void;
  clear: (id: number) => void;
}

export function createNotices(): Notices {
  const notices$ = new BehaviorSubject<Notice[]>([]);
  let nextId = 1;

  return {
    notices$: state(notices$.asObservable(), []),
    stub: (label: string): void => {
      notices$.next([
        ...notices$.getValue(),
        { id: nextId, text: `${label}: not yet available` },
      ]);
      nextId += 1;
    },
    clear: (id: number): void => {
      notices$.next(
        notices$.getValue().filter((notice) => {
          return notice.id !== id;
        }),
      );
    },
  };
}
