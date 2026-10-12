import { email, fiscalCode, iban, vatNumber } from "./codes.ts";
import { personIdentity } from "./identity.ts";
import { digits, type Rng, rngFor } from "./random.ts";

// Free text (journal descriptions, account names, notes) mentions people and
// firms by name and may carry identifiers typed by hand. Two passes clean it:
// replaceNames swaps every known original name for its pseudonym, and
// sweepIdentifiers replaces anything shaped like a fiscal code, an IBAN, a VAT
// number, an e-mail, a phone or a bank-account number with a fake of the same
// kind, keyed on the original so the same value is replaced the same way
// wherever it occurs.

/** One original → pseudonym pair. `anyCase` matches the original in any letter case (firm names). */
export interface NameEntry {
  original: string;
  pseudonym: string;
  anyCase?: boolean;
}

/** A compiled set of entries: build it once with createNameMapping, use it on every string. */
export interface NameMapping {
  pattern: RegExp | null;
  exact: ReadonlyMap<string, string>;
  folded: ReadonlyMap<string, string>;
  firstWords: ReadonlySet<string>;
}

const MIN_TOKEN = 3;
const WORD_SPLIT = /[^\p{L}\p{N}]+/u;

const SWEEP = new RegExp(
  [
    // Not inside a word, and not a part of a decimal number ("300.000000").
    String.raw`(?<![\p{L}\p{N}]|\d[.,])(?:`,
    String.raw`(?<iban>IT\s?\d{2}\s?[A-Z]\s?\d{5}\s?\d{5}\s?[0-9A-Z]{12})`,
    String.raw`|(?<cf>[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])`,
    String.raw`|(?<email>[\p{L}\p{N}._%+\-]+@[\p{L}\p{N}\-]+(?:\.[\p{L}\p{N}\-]+)+)`,
    String.raw`|(?<vat>(?:IT)?\d{11})`,
    String.raw`|(?<policy>[Pp]olizza\D{0,20}?n[°.r]*\s*\d+)`,
    String.raw`|(?<phone>(?:\+39[\s\-]?)?(?:0\d{1,3}|3\d{2})[\s\/\-]?\d{5,8})`,
    String.raw`|(?<account>[Cc]\/[Cc]\.?\s*(?:n\.?\s*)?\d[\d.]{2,}\d)`,
    String.raw`)(?![\p{L}\p{N}]|[.,]\d)`,
  ].join(""),
  "gu",
);

export function createNameMapping(entries: readonly NameEntry[]): NameMapping {
  const exact = new Map<string, string>();
  const folded = new Map<string, string>();
  const firstWords = new Set<string>();
  const alternatives = new Map<string, string>();

  for (const entry of entries) {
    const original = entry.original.trim();

    if (original.length < MIN_TOKEN || exact.has(original)) {
      continue;
    }

    exact.set(original, entry.pseudonym);
    alternatives.set(original, escapeRegExp(original));
    const upper = original.toUpperCase();

    if (!exact.has(upper)) {
      exact.set(upper, entry.pseudonym.toUpperCase());
      alternatives.set(upper, escapeRegExp(upper));
    }

    if (entry.anyCase === true) {
      folded.set(original.toLowerCase(), entry.pseudonym);
      alternatives.set(`(?i)${original}`, `(?i:${escapeRegExp(original)})`);
    }

    firstWords.add(firstWord(original));
  }

  const ordered = [...alternatives.entries()]
    .sort(([a], [b]) => {
      return literalLength(b) - literalLength(a) || byCodeUnits(a, b);
    })
    .map(([, source]) => {
      return source;
    });

  const pattern =
    ordered.length === 0
      ? null
      : new RegExp(
          `(?<![\\p{L}\\p{N}])(?:${ordered.join("|")})(?![\\p{L}\\p{N}])`,
          "gu",
        );
  return { pattern, exact, folded, firstWords };
}

/** Every original name in `text` becomes its pseudonym; ALL-CAPS stays ALL-CAPS. */
export function replaceNames(text: string, mapping: NameMapping): string {
  const { pattern } = mapping;

  if (pattern === null || !mentionsAny(text, mapping.firstWords)) {
    return text;
  }

  return text.replace(pattern, (match) => {
    return pseudonymOf(match, mapping);
  });
}

/** Identifier-shaped text becomes a fake of the same kind, the same fake for the same original. */
export function sweepIdentifiers(text: string): string {
  if (!/\d|@/.test(text)) {
    return text;
  }

  return text.replace(SWEEP, (match: string, ...rest: unknown[]) => {
    const groups = rest.at(-1) as Record<string, string | undefined>;
    return fakeIdentifier(match, groups);
  });
}

/** Each identifier-shaped substring of `text` with the fake sweepIdentifiers puts in its place. */
export function identifierReplacements(text: string): [string, string][] {
  const out: [string, string][] = [];

  if (!/\d|@/.test(text)) {
    return out;
  }

  for (const m of text.matchAll(SWEEP)) {
    out.push([m[0], fakeIdentifier(m[0], m.groups ?? {})]);
  }

  return out;
}

function fakeIdentifier(
  match: string,
  groups: Record<string, string | undefined>,
): string {
  const kind =
    Object.keys(groups).find((key) => {
      return groups[key] !== undefined;
    }) ?? "";
  const rng = rngFor(`sweep.${kind}`, match);

  switch (kind) {
    case "iban":
      return respace(
        match,
        iban(digits(5, rng), digits(5, rng), digits(12, rng)),
      );
    case "cf":
      return fakeFiscalCode(rng);
    case "email":
      return fakeEmail(rng);
    case "vat":
      return `${match.startsWith("IT") ? "IT" : ""}${vatNumber(rng)}`;
    case "policy":
      return redigitAfter(match, /^[Pp]olizza\D*/, rng);
    case "phone":
      return redigitAfter(match, /^(?:\+39[\s-]?)?(?:0\d{1,3}|3\d{2})/, rng);
    default:
      return redigitAfter(match, /^[Cc]\/[Cc]\.?\s*(?:n\.?\s*)?/, rng);
  }
}

function fakeFiscalCode(rng: Rng): string {
  const p = personIdentity(null, rng);
  return fiscalCode(
    p.lastName,
    p.firstName,
    p.sex,
    p.birthDate,
    p.birthPlace.belfiore,
  );
}

function fakeEmail(rng: Rng): string {
  const p = personIdentity(null, rng);
  return email(p.firstName, p.lastName);
}

// The fake's characters, laid over the original's: its spaces stay where they were.
function respace(original: string, fake: string): string {
  let i = 0;
  let out = "";

  for (const ch of original) {
    if (/\s/.test(ch)) {
      out += ch;
    } else {
      out += fake.charAt(i);
      i += 1;
    }
  }

  return out;
}

// Keeps the prefix (country code and area code, "C/C ") and redraws every
// digit after it; separators stay where they were.
function redigitAfter(original: string, prefix: RegExp, rng: Rng): string {
  const head = prefix.exec(original)?.[0] ?? "";
  const tail = original.slice(head.length).replace(/\d/g, () => {
    return digits(1, rng);
  });
  return `${head}${tail}`;
}

function pseudonymOf(match: string, mapping: NameMapping): string {
  const direct = mapping.exact.get(match);

  if (direct !== undefined) {
    return direct;
  }

  const pseudonym = mapping.folded.get(match.toLowerCase());

  if (pseudonym === undefined) {
    return match;
  }

  return isAllCaps(match) ? pseudonym.toUpperCase() : pseudonym;
}

function mentionsAny(text: string, words: ReadonlySet<string>): boolean {
  return text
    .toLowerCase()
    .split(WORD_SPLIT)
    .some((word) => {
      return words.has(word);
    });
}

function firstWord(text: string): string {
  return (
    text
      .toLowerCase()
      .split(WORD_SPLIT)
      .find((word) => {
        return word !== "";
      }) ?? ""
  );
}

function byCodeUnits(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  return a < b ? -1 : 1;
}

function isAllCaps(text: string): boolean {
  return text === text.toUpperCase() && text !== text.toLowerCase();
}

function literalLength(key: string): number {
  return key.startsWith("(?i)") ? key.length - 4 : key.length;
}

function escapeRegExp(text: string): string {
  // The syntax characters, the only ones a unicode-mode pattern may escape.
  return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}
