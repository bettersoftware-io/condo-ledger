import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import { createTablesSeed } from "../testing/createTablesSeed.ts";
import { createUnitsSimulator } from "./unitsSimulator.ts";

describe("units simulator", () => {
  it("answers no units for a period that has none", async () => {
    const units = createUnitsSimulator(createTablesSeed());

    expect(await firstValueFrom(units.units("p2"))).toEqual([]);
    expect(await firstValueFrom(units.groups("p2"))).toEqual([]);
  });
});
