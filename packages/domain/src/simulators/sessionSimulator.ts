import { BehaviorSubject, type Observable } from "rxjs";

import { ok, type Result } from "#/entities/result.ts";
import {
  DEFAULT_PREFERENCES,
  type Firm,
  type Preferences,
  type Principal,
} from "#/entities/session.ts";
import type { SessionPort } from "#/ports/sessionPort.ts";

interface SessionSimulatorOptions {
  principal: Principal;
  firm: Firm;
  preferences?: Preferences;
}

/** The design's invented administrator: not a real person. */
export const DESIGN_PRINCIPAL: Principal = {
  username: "marco",
  displayName: "Ferrari Marco",
  role: "administrator",
};

export const DESIGN_FIRM: Firm = { name: "Studio Ferrari" };

/**
 * A session that needs no server: one principal, preferences kept in memory.
 * Production code: the app runs on it when no server is configured.
 */
export function createSessionSimulator({
  principal,
  firm,
  preferences = DEFAULT_PREFERENCES,
}: SessionSimulatorOptions): SessionPort {
  const principal$ = new BehaviorSubject<Principal>(principal);
  const firm$ = new BehaviorSubject<Firm>(firm);
  const preferences$ = new BehaviorSubject<Preferences>(preferences);

  return {
    principal: (): Observable<Principal> => {
      return principal$.asObservable();
    },
    firm: (): Observable<Firm> => {
      return firm$.asObservable();
    },
    preferences: (): Observable<Preferences> => {
      return preferences$.asObservable();
    },
    setPreference: (patch: Partial<Preferences>): Promise<Result> => {
      preferences$.next({ ...preferences$.getValue(), ...patch });

      return Promise.resolve(ok());
    },
  };
}
