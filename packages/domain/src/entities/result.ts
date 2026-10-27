/** What a command answers: done, or refused for a reason the domain names. */
export interface Ok {
  readonly ok: true;
}

export interface Rejected {
  readonly ok: false;
  readonly reason: string;
  /** What the reason is about, when it names one: an account's id, a missing role. */
  readonly detail?: string;
}

/** A command that answers with a value when it is done. */
export interface Accepted<T> extends Ok {
  readonly value: T;
}

export type Result = Ok | Rejected;

export type ResultOf<T> = Accepted<T> | Rejected;

export function ok(): Ok {
  return { ok: true };
}

export function accepted<T>(value: T): Accepted<T> {
  return { ok: true, value };
}

export function rejected(reason: string, detail?: string): Rejected {
  return detail === undefined
    ? { ok: false, reason }
    : { ok: false, reason, detail };
}
