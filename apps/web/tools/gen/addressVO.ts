export interface AddressFields {
  countryIso3166_1_a2?: string;
  postCode?: string;
  street?: string;
  streetName?: string;
  streetNumber?: string;
  cityName?: string;
}

const WANTED_KEYS: ReadonlyArray<keyof AddressFields> = [
  "countryIso3166_1_a2",
  "postCode",
  "street",
  "streetName",
  "streetNumber",
  "cityName",
];

/**
 * Per-key scan: for each known key, find its literal PHP string token
 * `s:LEN:"key";` in the blob, then read the immediately following token.
 * If the next token is `s:\d+:"value";`, capture the string value.
 * If it is `N;` or `i:\d+;`, leave that key undefined.
 *
 * This avoids the global-regex advancement mis-pairing that can occur when
 * a key's value is N (null) or i: (int) — a sequential regex would consume
 * a token that belongs to the next valid pair.
 */
export function parseAddressVO(blob: string | null): AddressFields {
  const out: AddressFields = {};
  if (!blob || !blob.includes("AddressVO")) return out;

  for (const key of WANTED_KEYS) {
    // Match the PHP serialized key token exactly.
    const keyToken = `s:${key.length}:"${key}";`;
    const keyIdx = blob.indexOf(keyToken);
    if (keyIdx === -1) continue;

    // The value token starts immediately after the key token.
    const afterKey = blob.slice(keyIdx + keyToken.length);

    // Try to match a string value: s:LEN:"...";
    const strMatch = /^s:\d+:"([^"]*)";/.exec(afterKey);
    if (strMatch) {
      (out as Record<string, string>)[key] = strMatch[1]!;
    }
    // N; or i:...; → leave undefined (do nothing)
  }

  return out;
}

export function formatAddress(a: AddressFields): string {
  const streetPart =
    a.street ??
    [a.streetName, a.streetNumber].filter((s): s is string => s !== undefined && s !== "").join(", ");
  const trimmed = streetPart.trim();
  const parts = [trimmed, a.postCode?.trim()].filter((s): s is string => !!s);
  return parts.join(" — ");
}
