import { describe, expect, it } from "vitest";

import { romeTime } from "./romeTime.ts";

describe("romeTime", () => {
  it("gives Rome wall-clock time either side of the switch to summer time: +1h before, +2h after", () => {
    expect(romeTime(new Date("2013-01-10T14:59:29Z"))).toBe(
      "2013-01-10T15:59:29",
    );
    expect(romeTime(new Date("2013-07-01T15:05:51Z"))).toBe(
      "2013-07-01T17:05:51",
    );
  });

  it("one second either side of the switch itself", () => {
    expect(romeTime(new Date("2013-03-31T00:59:59Z"))).toBe(
      "2013-03-31T01:59:59",
    );
    expect(romeTime(new Date("2013-03-31T01:00:00Z"))).toBe(
      "2013-03-31T03:00:00",
    );
  });

  it("pads every field: midnight on the second of February, an hour past the UTC evening of the first", () => {
    expect(romeTime(new Date("2026-02-01T23:00:00Z"))).toBe(
      "2026-02-02T00:00:00",
    );
  });
});
