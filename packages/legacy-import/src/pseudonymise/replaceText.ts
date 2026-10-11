import { parseAddressVO } from "../addressVO.ts";
import type { Row, Tables } from "../loadRows.ts";
import { COMMON_WORDS } from "./commonWords.ts";
import { identifierReplacements, type NameEntry } from "./freeText.ts";
import { companyCore } from "./identity.ts";
import { EXTRA_ENTRIES } from "./leftovers.ts";
import { TOWNS } from "./names.ts";
import {
  buildingTowns,
  isOutsideFreeText,
  LABEL_TABLES,
  splitStreet,
  streetOf,
} from "./pseudonymise.ts";

// The lines of a `git filter-repo --replace-text` file that carry the same
// pseudonymisation through the repository's history: every real name as a
// word-bounded regex (in its case and in ALL CAPS), every real identifier and
// street as a literal. The file it ends up in holds the real names: it is
// written outside the repository by exportMapping.ts and never committed.

interface Rule {
  kind: "regex" | "literal";
  original: string;
  replacement: string;
}

// A lone surname or first name shorter than this is too likely an ordinary
// word somewhere in the history; it is still replaced inside a full name.
const MIN_LONE_NAME = 5;
const MIN_LITERAL = 6;
// A one-letter firm ("A", a test entry) would rewrite every "A" in history.
const MIN_FIRM = 3;
const MIN_STREET = 5;

// Numbers a test or a doc may hold for other reasons: "123456789", "0000000".
const PLACEHOLDER = /^(?:(\d)\1+|0?123456789\d?)$/;

// The identity columns compared row by row, keyed by the row's own id column.
const IDENTIFIER_COLUMNS: readonly (readonly [string, string, string])[] = [
  ["masterData", "id", "taxCode"],
  ["masterData", "id", "vatNumber"],
  ["masterDataVariation", "id", "taxCode"],
  ["masterDataVariation", "id", "vatNumber"],
  ["condominium", "id", "taxCode"],
  ["condominium", "id", "vatNumber"],
  ["condominium", "id", "landRegistry"],
  ["unit", "id", "landRegistry"],
  ["bankAccount", "id", "iban"],
  ["bankAccount", "id", "accountNumber"],
  ["masterDataContact", "id", "value"],
];

const ADDRESS_COLUMNS: readonly (readonly [string, string, string])[] = [
  ["masterData", "id", "postalAddress"],
  ["masterDataVariation", "id", "postalAddress"],
  ["person", "masterDataId", "officeAddress"],
  ["person", "masterDataId", "permanentAddress"],
  ["person", "masterDataId", "currentAddress"],
  ["company", "masterDataId", "registeredOfficeAddress"],
  ["company", "masterDataId", "taxPurposeAddress"],
  ["condominium", "id", "address"],
  ["unitGroup", "id", "address"],
  ["bankAccount", "id", "branchAddress"],
];

/** The replace-text lines for `original` → `pseudonymised` (the same tables, pseudonymised). */
export function replaceTextLines(
  original: Tables,
  pseudonymised: Tables,
): string[] {
  const rules = new Map<string, Rule>();

  function add(rule: Rule): void {
    const key = `${rule.kind}:${rule.original}`;

    if (
      rule.original !== rule.replacement &&
      !rules.has(key) &&
      !/==>|[\r\n]/.test(`${rule.original}${rule.replacement}`)
    ) {
      rules.set(key, rule);
    }
  }

  for (const entry of nameEntries(original, pseudonymised)) {
    add({
      kind: "regex",
      original: entry.original,
      replacement: entry.pseudonym,
    });
    add({
      kind: "regex",
      original: entry.original.toUpperCase(),
      replacement: entry.pseudonym.toUpperCase(),
    });
  }

  for (const [from, to] of literalPairs(original, pseudonymised)) {
    add({ kind: "literal", original: from, replacement: to });
  }

  return [...rules.values()]
    .sort((a, b) => {
      return (
        b.original.length - a.original.length ||
        byCodeUnits(a.kind, b.kind) ||
        byCodeUnits(a.original, b.original)
      );
    })
    .map(formatRule);
}

function nameEntries(original: Tables, pseudonymised: Tables): NameEntry[] {
  const entries: NameEntry[] = [];
  const fakePeople = indexBy(pseudonymised.person, "masterDataId");
  const fakeFirms = indexBy(pseudonymised.company, "masterDataId");
  const canStandAlone = loneNameFilter(original);

  for (const person of original.person ?? []) {
    const fake = fakePeople.get(text(person.masterDataId));
    const first = text(person.firstName).trim();
    const last = text(person.lastName).trim();
    const fakeFirst = text(fake?.firstName).trim();
    const fakeLast = text(fake?.lastName).trim();

    if (!fake || last === "") {
      continue;
    }

    if (first !== "") {
      entries.push(
        { original: `${last} ${first}`, pseudonym: `${fakeLast} ${fakeFirst}` },
        { original: `${first} ${last}`, pseudonym: `${fakeFirst} ${fakeLast}` },
      );
    }

    if (canStandAlone(last)) {
      entries.push({ original: last, pseudonym: fakeLast });
    }

    if (canStandAlone(first)) {
      entries.push({ original: first, pseudonym: fakeFirst });
    }
  }

  for (const company of original.company ?? []) {
    const name = text(company.name).trim();
    const fake = text(fakeFirms.get(text(company.masterDataId))?.name).trim();

    if (fake === "" || fake === name || name.length < MIN_FIRM) {
      continue;
    }

    entries.push({ original: name, pseudonym: fake });
    const core = companyCore(name);

    if (core !== name && core.length >= MIN_FIRM) {
      entries.push({ original: core, pseudonym: companyCore(fake) });
    }
  }

  entries.push(...EXTRA_ENTRIES, ...townEntries(original, pseudonymised));
  return entries;
}

// A lone name is rewritten only when it is long enough and is no ordinary
// text: not a common word, place, brand or saint (commonWords.ts), and not a
// word of the lookup and label tables. Such a name is still rewritten inside
// a full name.
function loneNameFilter(original: Tables): (name: string) => boolean {
  const labels = [...LABEL_TABLES]
    .flatMap((table) => {
      return (original[table] ?? []).flatMap((row) => {
        return Object.values(row).filter((value): value is string => {
          return typeof value === "string";
        });
      });
    })
    .join("\n")
    .toLowerCase();

  return (name: string): boolean => {
    const lower = name.toLowerCase();
    const inLabels = new RegExp(
      `(?<![\\p{L}])${lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`,
      "u",
    ).test(labels);
    return (
      name.length >= MIN_LONE_NAME && !COMMON_WORDS.has(lower) && !inLabels
    );
  };
}

function townEntries(original: Tables, pseudonymised: Tables): NameEntry[] {
  const fakeBuildings = indexBy(pseudonymised.condominium, "id");
  const entries: NameEntry[] = [];

  const poolTowns = new Set(
    TOWNS.map((t) => {
      return t.name;
    }),
  );

  for (const [id, town] of buildingTowns(original)) {
    // A town that is also in the fake pool is in the generator's own source.
    if (poolTowns.has(town)) {
      continue;
    }

    const blob = text(fakeBuildings.get(id)?.address);
    const fakeTown = parseAddressVO(blob === "" ? null : blob).cityName;

    if (fakeTown !== undefined) {
      entries.push({ original: town, pseudonym: fakeTown });
    }
  }

  return entries;
}

// The identity values as they were and as the pseudonymised tables hold them;
// then the identifiers the free-text sweep found and replaced.
function literalPairs(
  original: Tables,
  pseudonymised: Tables,
): [string, string][] {
  const pairs: [string, string][] = [];

  for (const [table, key, column] of IDENTIFIER_COLUMNS) {
    for (const [from, to] of columnPairs(
      original,
      pseudonymised,
      table,
      key,
      column,
    )) {
      if (from.length >= MIN_LITERAL && !PLACEHOLDER.test(from)) {
        pairs.push([from, to]);
      }
    }
  }

  for (const [table, key, column] of ADDRESS_COLUMNS) {
    for (const [from, to] of columnPairs(
      original,
      pseudonymised,
      table,
      key,
      column,
    )) {
      pairs.push(...streetPairs(from, to));
    }
  }

  for (const [name, rows] of Object.entries(original)) {
    if (isOutsideFreeText(name)) {
      continue;
    }

    for (const row of rows) {
      for (const value of Object.values(row)) {
        if (typeof value === "string") {
          pairs.push(
            ...identifierReplacements(value).filter(([from]) => {
              return from.length >= MIN_LITERAL && !PLACEHOLDER.test(from);
            }),
          );
        }
      }
    }
  }

  return pairs;
}

function columnPairs(
  original: Tables,
  pseudonymised: Tables,
  table: string,
  key: string,
  column: string,
): [string, string][] {
  const fakes = indexBy(pseudonymised[table], key);
  const pairs: [string, string][] = [];

  for (const row of original[table] ?? []) {
    const from = row[column];
    const to = fakes.get(text(row[key]))?.[column];

    if (typeof from === "string" && typeof to === "string") {
      pairs.push([from.trim(), to.trim()]);
    }
  }

  return pairs;
}

// An address blob's street line, and its street name alone (the legacy
// application stored either "via X, 4" or "via X" and "4" apart).
function streetPairs(fromBlob: string, toBlob: string): [string, string][] {
  const from = parseAddressVO(fromBlob);
  const to = streetOf(parseAddressVO(toBlob));
  const pairs: [string, string][] = [];
  const line = streetOf(from);

  if (line.length >= MIN_STREET && to !== "") {
    pairs.push([line, to]);
  }

  const name = (from.streetName ?? "").trim();

  if (from.street === undefined && name.length >= MIN_STREET && to !== "") {
    pairs.push([name, splitStreet(to)[0]]);
  }

  return pairs;
}

function formatRule(rule: Rule): string {
  if (rule.kind === "literal") {
    return `literal:${rule.original}==>${rule.replacement}`;
  }

  // Python's re (filter-repo runs on bytes): lookarounds instead of \b, so a
  // name ending in "." ("S.p.A.") still matches before a space or the end.
  return `regex:(?<!\\w)${pythonEscape(rule.original)}(?!\\w)==>${rule.replacement.replace(/\\/g, "\\\\")}`;
}

function pythonEscape(text: string): string {
  return text.replace(/[.^$*+?{}[\]\\|()]/g, "\\$&");
}

function indexBy(rows: Row[] | undefined, key: string): Map<string, Row> {
  const out = new Map<string, Row>();

  for (const row of rows ?? []) {
    out.set(text(row[key]), row);
  }

  return out;
}

function text(value: Row[string] | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function byCodeUnits(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  return a < b ? -1 : 1;
}
