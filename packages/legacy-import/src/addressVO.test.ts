import { describe, it, expect } from "vitest";
import { parseAddressVO, formatAddress } from "./addressVO.ts";

describe("parseAddressVO", () => {
  it("extracts string fields and ignores N (null) / i: (int)", () => {
    const a = parseAddressVO(SATURNO);
    expect(a).toMatchObject({ postCode: "33100", street: "Piazza del Duomo, 39", countryIso3166_1_a2: "IT" });
    expect(a.cityName).toBeUndefined();
  });
  it("composes streetName + streetNumber when street is null", () => {
    expect(formatAddress(parseAddressVO(POZZETTO))).toBe("Piazza Libertà, 74 — 34071");
  });
  it("formats street + postCode", () => {
    expect(formatAddress(parseAddressVO(SATURNO))).toBe("Piazza del Duomo, 39 — 33100");
  });
  it("returns {} for null/empty/garbage and formats to empty string", () => {
    expect(parseAddressVO(null)).toEqual({});
    expect(formatAddress(parseAddressVO("not-a-vo"))).toBe("");
  });
});

const SATURNO = `C:9:"AddressVO":345:{a:14:{s:19:"countryIso3166_1_a2";s:2:"IT";s:8:"postCode";s:5:"33100";s:6:"street";s:24:"Piazza del Duomo, 39";s:8:"cityName";N;s:6:"cityId";i:30129;}}`;

const POZZETTO = `C:9:"AddressVO":477:{a:19:{s:19:"countryIso3166_1_a2";s:2:"IT";s:8:"postCode";s:5:"34071";s:6:"street";N;s:12:"streetNumber";s:2:"12";s:10:"streetName";s:12:"Piazza Libertà";s:8:"cityName";N;}}`;
