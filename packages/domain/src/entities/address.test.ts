import { describe, expect, it } from "vitest";

import { addressTextOf } from "./address.ts";

describe("addressTextOf", () => {
  it("writes the street, then the postcode and the city", () => {
    expect(
      addressTextOf({
        street: "Via Roma, 1",
        postcode: "33100",
        city: "Udine",
      }),
    ).toBe("Via Roma, 1, 33100 Udine");
  });

  it("leaves out a postcode or a city that is not there", () => {
    expect(
      addressTextOf({ street: "Via Roma, 1", postcode: null, city: "Udine" }),
    ).toBe("Via Roma, 1, Udine");
    expect(
      addressTextOf({ street: "Via Roma, 1", postcode: "33100", city: null }),
    ).toBe("Via Roma, 1, 33100");
  });

  it("is the street alone when neither is there", () => {
    expect(
      addressTextOf({ street: "Via Roma, 1", postcode: null, city: null }),
    ).toBe("Via Roma, 1");
  });
});
