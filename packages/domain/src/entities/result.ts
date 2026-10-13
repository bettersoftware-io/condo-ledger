/** What a command answers: done, or refused for a reason the domain names. */
export interface Ok {
  readonly ok: true;
}

export interface Rejected {
  readonly ok: false;
  readonly reason: string;
}

export type Result = Ok | Rejected;

export function ok(): Ok {
  return { ok: true };
}

export function rejected(reason: string): Rejected {
  return { ok: false, reason };
}
