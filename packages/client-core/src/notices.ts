import { type DefaultedStateObservable, state } from "@rx-state/core";
import { BehaviorSubject } from "rxjs";

export interface Notice {
  id: number;
  text: string;
}

export interface Notices {
  notices$: DefaultedStateObservable<Notice[]>;
  /** For a control the design shows but M1 does not wire: says so instead of doing nothing. */
  stub: (label: string) => void;
  /** A notice in its own words: what a control does instead, when "not yet available" alone would not say it. */
  say: (text: string) => void;
  clear: (id: number) => void;
}

export function createNotices(): Notices {
  const notices$ = new BehaviorSubject<Notice[]>([]);
  let nextId = 1;

  function say(text: string): void {
    notices$.next([...notices$.getValue(), { id: nextId, text }]);
    nextId += 1;
  }

  return {
    notices$: state(notices$.asObservable(), []),
    stub: (label: string): void => {
      say(`${label}: not yet available`);
    },
    say,
    clear: (id: number): void => {
      notices$.next(
        notices$.getValue().filter((notice) => {
          return notice.id !== id;
        }),
      );
    },
  };
}
