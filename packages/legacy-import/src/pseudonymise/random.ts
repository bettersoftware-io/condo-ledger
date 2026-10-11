/**
 * Deterministic randomness for the pseudonymisation: the same table and id
 * always draw the same fake identity, on every machine and every run, with no
 * npm dependency. Changing SALT re-rolls every pseudonym in the seed.
 */
const SALT = "condo-ledger/pseudonymise/v1";

/** A source of uniform numbers in [0, 1). */
export type Rng = () => number;

/** The generator for one record: FNV-1a of `${SALT}:${table}:${id}` seeds mulberry32. */
export function rngFor(table: string, id: string): Rng {
  return mulberry32(fnv1a(`${SALT}:${table}:${id}`));
}

/** FNV-1a, 32 bits, over the UTF-16 code units of the text. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;

  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
}

/** mulberry32: a small, well-distributed 32-bit PRNG (public domain, T. Ettinger). */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return next;
}

export function pick<T>(list: readonly T[], rng: Rng): T {
  if (list.length === 0) {
    throw new Error("pick: the list is empty");
  }

  return list[Math.floor(rng() * list.length)] as T;
}

/** An integer in [min, max], both ends included. */
export function intBetween(min: number, max: number, rng: Rng): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Exactly `n` decimal digits; leading zeros are kept. */
export function digits(n: number, rng: Rng): string {
  let out = "";

  for (let i = 0; i < n; i++) {
    out += String(Math.floor(rng() * 10));
  }

  return out;
}
