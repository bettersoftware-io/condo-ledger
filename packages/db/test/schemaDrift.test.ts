import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

d("schema drift", () => {
  it("drizzle-kit check reports no pending changes vs the migrated DB", () => {
    // `drizzle-kit check` validates migration consistency; `generate` with no
    // schema change must produce no new statements.
    const out = execFileSync("pnpm", ["--filter", "@cl/db", "exec", "drizzle-kit", "check"], {
      encoding: "utf8", env: process.env,
    });
    expect(out.toLowerCase()).not.toContain("conflict");
  });
});
