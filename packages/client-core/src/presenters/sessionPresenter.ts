import { type DefaultedStateObservable, state } from "@rx-state/core";
import { distinctUntilChanged, map } from "rxjs";

import {
  DEFAULT_PREFERENCES,
  type Firm,
  type Language,
  type Mode,
  type Preferences,
  type Principal,
  type Result,
  type SessionPort,
  type Theme,
} from "@cl/domain";

import {
  type AmountLocale,
  amountLocaleOf,
  DEFAULT_AMOUNT_LOCALE,
} from "#/amounts.ts";

export interface SessionPresenter {
  principal$: DefaultedStateObservable<Principal | null>;
  firm$: DefaultedStateObservable<Firm | null>;
  preferences$: DefaultedStateObservable<Preferences>;
  /** The locale amounts are shown, typed and written in: the language's. */
  amountLocale$: DefaultedStateObservable<AmountLocale>;
  setMode: (mode: Mode) => Promise<Result>;
  setTheme: (theme: Theme) => Promise<Result>;
  setLanguage: (language: Language) => Promise<Result>;
}

/** Who is signed in and how they like the screen. Shared: one subscription to the port however many readers. */
export function createSessionPresenter(port: SessionPort): SessionPresenter {
  const preferences$ = state(port.preferences(), DEFAULT_PREFERENCES);

  return {
    principal$: state(port.principal(), null),
    firm$: state(port.firm(), null),
    preferences$,
    amountLocale$: state(
      preferences$.pipe(
        map((preferences) => {
          return amountLocaleOf(preferences.language);
        }),
        distinctUntilChanged(),
      ),
      DEFAULT_AMOUNT_LOCALE,
    ),
    setMode: (mode: Mode): Promise<Result> => {
      return port.setPreference({ mode });
    },
    setTheme: (theme: Theme): Promise<Result> => {
      return port.setPreference({ theme });
    },
    setLanguage: (language: Language): Promise<Result> => {
      return port.setPreference({ language });
    },
  };
}
