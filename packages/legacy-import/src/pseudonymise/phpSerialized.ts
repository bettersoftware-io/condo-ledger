import { Buffer } from "node:buffer";

// The legacy PHP application stored addresses (and sessions) as serialized
// PHP values: `C:9:"AddressVO":<bytes>:{a:<n>:{s:<bytes>:"key";s:<bytes>:"value";…}}`.
// Every length counts UTF-8 bytes, so a rewritten string must restate its
// length, and the object its body's. The work is done on a "byte string" (the
// UTF-8 bytes read as latin1), where one character is one byte.

export interface AddressVOFields {
  countryIso3166_1_a2: string | null;
  postCode: string | null;
  street: string | null;
  cityName: string | null;
}

// The keys of the 14-key AddressVO the legacy application wrote, in its order.
const ADDRESS_VO_KEYS = [
  "countryIso3166_1_a2",
  "postCode",
  "street",
  "cityName",
  "minorCivilDivisionName",
  "districtName",
  "stateName",
  "id",
  "cityId",
  "minorCivilDivisionId",
  "districtId",
  "stateId",
  "created",
  "lastModified",
] as const;

const STRING_TOKEN = /s:(\d+):"/g;
const OBJECT_ENVELOPE = /^C:(\d+):"([^"]+)":(\d+):\{([\s\S]*)\}$/;

export function isSerialized(value: string): boolean {
  return /^(?:C:\d+:"[^"]+":\d+:\{|a:\d+:\{)/.test(value);
}

/** A fresh AddressVO blob: the given fields, every other key null. */
export function serializeAddressVO(fields: AddressVOFields): string {
  const values: Record<string, string | null> = { ...fields };
  const body = ADDRESS_VO_KEYS.map((key) => {
    return `${stringToken(key)}${valueToken(values[key] ?? null)}`;
  }).join("");
  const array = `a:${String(ADDRESS_VO_KEYS.length)}:{${body}}`;
  return `C:9:"AddressVO":${String(byteLength(array))}:{${array}}`;
}

/**
 * Rewrites every string inside a serialized value with `rewrite`, restating
 * each string's byte length and the object envelope's. A token whose length
 * does not fit the text is left as it is.
 */
export function mapSerializedStrings(
  blob: string,
  rewrite: (text: string) => string,
): string {
  const bytes = toByteString(blob);
  let out = "";
  let cursor = 0;
  STRING_TOKEN.lastIndex = 0;

  for (
    let m = STRING_TOKEN.exec(bytes);
    m !== null;
    m = STRING_TOKEN.exec(bytes)
  ) {
    const start = m.index + m[0].length;
    const end = start + Number(m[1]);

    if (bytes.slice(end, end + 2) !== '";') {
      continue;
    }

    const text = rewrite(fromByteString(bytes.slice(start, end)));
    out += `${bytes.slice(cursor, m.index)}${toByteString(stringToken(text))}`;
    cursor = end + 2;
    STRING_TOKEN.lastIndex = cursor;
  }

  out += bytes.slice(cursor);
  return fromByteString(restateEnvelope(out));
}

function restateEnvelope(bytes: string): string {
  const m = OBJECT_ENVELOPE.exec(bytes);

  if (!m) {
    return bytes;
  }

  const body = m[4] ?? "";
  return `C:${m[1] ?? ""}:"${m[2] ?? ""}":${String(body.length)}:{${body}}`;
}

function stringToken(text: string): string {
  return `s:${String(byteLength(text))}:"${text}";`;
}

function valueToken(value: string | null): string {
  return value === null ? "N;" : stringToken(value);
}

function byteLength(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

function toByteString(text: string): string {
  return Buffer.from(text, "utf8").toString("latin1");
}

function fromByteString(bytes: string): string {
  return Buffer.from(bytes, "latin1").toString("utf8");
}
