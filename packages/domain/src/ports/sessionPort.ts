import type { Observable } from "rxjs";

import type { Result } from "#/entities/result.ts";
import type { Firm, Preferences, Principal } from "#/entities/session.ts";

/**
 * Who is signed in and how they like the screen. Built once per session for a
 * principal, so no method takes one.
 */
export interface SessionPort {
  principal(): Observable<Principal>;
  firm(): Observable<Firm>;
  preferences(): Observable<Preferences>;
  setPreference(patch: Partial<Preferences>): Promise<Result>;
}
