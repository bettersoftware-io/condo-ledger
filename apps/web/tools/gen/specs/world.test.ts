import { describe, it, expect } from "vitest";
import { legacyDb, makeWorld, resolvePeriod, type SpecWorld } from "./world.ts";

describe("spec world", () => {
  it("loads the real dump and selects real condominiums", () => {
    const db = legacyDb();
    expect(db.condominiums.length).toBeGreaterThanOrEqual(6);
  });
  it("resolves a period label to its legacy accountingPeriod id", () => {
    const db = legacyDb();
    expect(resolvePeriod(db, "Saturno 2011")).toBe("1");
    expect(resolvePeriod(db, "Pozzetto 2013")).toBe("36");
  });
  it("makeWorld seeds the db", () => {
    const w: SpecWorld = makeWorld();
    expect(w.db.condominiums.length).toBeGreaterThanOrEqual(6);
  });
});
