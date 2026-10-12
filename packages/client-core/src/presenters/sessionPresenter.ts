import { type DefaultedStateObservable, state } from "@rx-state/core";

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

export interface SessionPresenter {
  principal$: DefaultedStateObservable<Principal | null>;
  firm$: DefaultedStateObservable<Firm | null>;
  preferences$: DefaultedStateObservable<Preferences>;
  setMode: (mode: Mode) => Promise<Result>;
  setTheme: (theme: Theme) => Promise<Result>;
  setLanguage: (language: Language) => Promise<Result>;
}

/** Who is signed in and how they like the screen. Shared: one subscription to the port however many readers. */
export function createSessionPresenter(port: SessionPort): SessionPresenter {
  return {
    principal$: state(port.principal(), null),
    firm$: state(port.firm(), null),
    preferences$: state(port.preferences(), DEFAULT_PREFERENCES),
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
