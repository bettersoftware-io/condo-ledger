import { describe, expect, it } from "vitest";

describe("scaffold", () => {
  it("exposes a DATABASE_URL-driven client factory module", async () => {
    const mod = await import("../src/db.ts");
    expect(typeof mod.makeDb).toBe("function");
    expect(typeof mod.makePool).toBe("function");
  });
});
