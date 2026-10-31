import { describe, expect, it } from "vitest";

import { formatAddress, parseAddressVO } from "./addressVO.ts";

describe("parseAddressVO", () => {
  it("extracts string fields and the city's id, and ignores N (null)", () => {
    const a = parseAddressVO(SATURNO);
    expect(a).toEqual({
      postCode: "33017",
      street: "via dei Glicini, 4",
      countryIso3166_1_a2: "IT",
      cityId: "41",
    });
  });
  it("composes streetName + streetNumber when street is null", () => {
    expect(formatAddress(parseAddressVO(POZZETTO))).toBe(
      "Viale delle Querce, 8 — 33045",
    );
  });
  it("formats street + postCode", () => {
    expect(formatAddress(parseAddressVO(SATURNO))).toBe(
      "via dei Glicini, 4 — 33017",
    );
  });
  it("returns {} for null/empty/garbage and formats to empty string", () => {
    expect(parseAddressVO(null)).toEqual({});
    expect(formatAddress(parseAddressVO("not-a-vo"))).toBe("");
  });
});

const SATURNO = `C:9:"AddressVO":144:{a:14:{s:19:"countryIso3166_1_a2";s:2:"IT";s:8:"postCode";s:5:"33017";s:6:"street";s:18:"via dei Glicini, 4";s:8:"cityName";N;s:6:"cityId";i:41;}}`;

const POZZETTO = `C:9:"AddressVO":174:{a:19:{s:19:"countryIso3166_1_a2";s:2:"IT";s:8:"postCode";s:5:"33045";s:6:"street";N;s:12:"streetNumber";s:1:"8";s:10:"streetName";s:18:"Viale delle Querce";s:8:"cityName";N;}}`;
