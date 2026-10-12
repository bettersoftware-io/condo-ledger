import { describe, expect, it } from "vitest";

import { formatAddress, parseAddressVO } from "../addressVO.ts";
import {
  isSerialized,
  mapSerializedStrings,
  serializeAddressVO,
} from "./phpSerialized.ts";

describe("serializeAddressVO", () => {
  it("writes a blob the legacy parser reads back", () => {
    const blob = serializeAddressVO({
      countryIso3166_1_a2: "IT",
      postCode: "33017",
      street: "Via Cavour, 12",
      cityName: "Tarcento",
    });

    expect(parseAddressVO(blob)).toEqual({
      countryIso3166_1_a2: "IT",
      postCode: "33017",
      street: "Via Cavour, 12",
      cityName: "Tarcento",
    });
    expect(formatAddress(parseAddressVO(blob))).toBe("Via Cavour, 12 — 33017");
  });

  it("states the byte length of the object body and of every string", () => {
    const blob = serializeAddressVO({
      countryIso3166_1_a2: "IT",
      postCode: null,
      street: "Piazza Libertà, 3",
      cityName: null,
    });

    expectConsistentLengths(blob);
    expect(blob).toContain('s:6:"street";s:18:"Piazza Libertà, 3";');
    expect(blob).toContain('s:8:"postCode";N;');
  });
});

describe("mapSerializedStrings", () => {
  it("rewrites every string value and fixes the lengths, multi-byte text included", () => {
    const blob = serializeAddressVO({
      countryIso3166_1_a2: "IT",
      postCode: "33100",
      street: "via Zanin, 4",
      cityName: null,
    });

    const out = mapSerializedStrings(blob, (text) => {
      return text.replace("Zanin", "Zanòn");
    });

    expect(parseAddressVO(out).street).toBe("via Zanòn, 4");
    expectConsistentLengths(out);
  });

  it("rewrites the strings of a plain serialized array too", () => {
    const out = mapSerializedStrings(
      'a:1:{s:8:"username";s:4:"abcd";}',
      (t) => {
        return t === "abcd" ? "abcdef" : t;
      },
    );

    expect(out).toBe('a:1:{s:8:"username";s:6:"abcdef";}');
  });

  it("leaves a malformed string token as it is", () => {
    const broken = 'a:1:{s:3:"key";s:9:"short";}';

    expect(
      mapSerializedStrings(broken, (t) => {
        return t.toUpperCase();
      }),
    ).toBe('a:1:{s:3:"KEY";s:9:"short";}');
  });
});

describe("isSerialized", () => {
  it("recognises an object or an array, nothing else", () => {
    expect(isSerialized('C:9:"AddressVO":12:{a:0:{}}')).toBe(true);
    expect(isSerialized("a:2:{i:0;N;}")).toBe(true);
    expect(isSerialized("Via Cavour, 12")).toBe(false);
    expect(isSerialized("a:b")).toBe(false);
  });
});

function expectConsistentLengths(blob: string): void {
  const outer = /^C:\d+:"AddressVO":(\d+):\{([\s\S]*)\}$/.exec(blob);

  expect(outer).not.toBeNull();
  expect(Buffer.byteLength(outer?.[2] ?? "")).toBe(Number(outer?.[1]));

  for (const m of blob.matchAll(/s:(\d+):"([^"]*)";/g)) {
    expect(Buffer.byteLength(m[2] ?? "")).toBe(Number(m[1]));
  }
}
