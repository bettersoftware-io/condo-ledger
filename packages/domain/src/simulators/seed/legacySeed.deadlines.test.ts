import { describe, expect, it } from "vitest";

import { legacySeedData } from "./legacySeed.generated.ts";
import { loadLegacySeed } from "./legacySeed.ts";

describe("the seed's hand-entered deadlines", () => {
  it("holds the 12 of the dump, by id number", () => {
    expect(seed.deadlines).toHaveLength(12);
    expect(
      seed.deadlines.map((deadline) => {
        return deadline.id;
      }),
    ).toEqual([
      "ce1",
      "ce8",
      "ce13",
      "ce15",
      "ce18",
      "ce19",
      "ce20",
      "ce21",
      "ce23",
      "ce24",
      "ce25",
      "ce26",
    ]);
  });

  it("puts 11 in February 2026 and one in August 2026", () => {
    expect(
      countBy("date", (date) => {
        return date.slice(0, 7);
      }),
    ).toEqual({
      "2026-02": 11,
      "2026-08": 1,
    });
  });

  it("puts every one in General, tied to no building, with no time of its own", () => {
    for (const deadline of seed.deadlines) {
      expect(deadline).toMatchObject({
        calendar: "general",
        buildingId: null,
        time: null,
      });
    }
  });

  it("holds 10 new, 1 closed and 1 cancelled", () => {
    expect(countBy("status")).toEqual({ new: 10, closed: 1, cancelled: 1 });
  });

  it("holds 4 critical, 2 high, 1 medium, 4 low and 1 with none", () => {
    expect(countBy("priority")).toEqual({
      critical: 4,
      high: 2,
      medium: 1,
      low: 4,
      none: 1,
    });
  });

  it("carries the notes of the four notices to the residents, and no others", () => {
    expect(
      seed.deadlines
        .filter((deadline) => {
          return deadline.notes !== null;
        })
        .map((deadline) => {
          return deadline.id;
        }),
    ).toEqual(["ce23", "ce24", "ce25", "ce26"]);
  });

  it("words them all in English", () => {
    const first = seed.deadlines[0];

    expect(first?.description).toBe("Insurance policy no. 059 expires");
    expect(seed.deadlines[9]?.notes).toMatch(/^Our office will be closed/);
  });
});

const seed = loadLegacySeed(legacySeedData);

function keepWhole(value: string): string {
  return value;
}

function countBy(
  field: "date" | "status" | "priority",
  key: (value: string) => string = keepWhole,
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const deadline of seed.deadlines) {
    const group = key(deadline[field]);

    counts[group] = (counts[group] ?? 0) + 1;
  }

  return counts;
}
