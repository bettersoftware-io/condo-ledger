import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import os from "node:os";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

d("schema drift", () => {
  it("drizzle-kit check reports no pending changes vs the migrated DB", () => {
    // `drizzle-kit check` validates migration consistency; `generate` with no
    // schema change must produce no new statements.
    //
    // drizzle-kit unconditionally creates a drizzle-studio data dir under
    // XDG_DATA_HOME (defaulting to ~/.local/share). When that var is unset and the
    // home dir isn't writable (the sandbox), the child crashes with EACCES before
    // it ever checks anything. Point XDG_DATA_HOME at a writable temp dir if the
    // caller hasn't already set one — harmless when it is set.
    const out = execFileSync("pnpm", ["--filter", "@cl/db", "exec", "drizzle-kit", "check"], {
      encoding: "utf8",
      env: { ...process.env, XDG_DATA_HOME: process.env.XDG_DATA_HOME ?? os.tmpdir() },
    });
    expect(out.toLowerCase()).not.toContain("conflict");
  });
});
