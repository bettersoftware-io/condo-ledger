import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as schema from "../src/schema/index.ts";

describe("table coverage", () => {
  it("defines 94 tables (95 legacy minus dropped codeIgniterSession)", () => {
    const tables = Object.values(schema).filter((t) => {
      return t instanceof PgTable;
    });
    expect(tables).toHaveLength(94);
  });
  it("no codeIgniterSession, no duplicate table names", () => {
    const names = Object.values(schema)
      .filter((t) => {
        return t instanceof PgTable;
      })
      .map((t) => {
        return getTableConfig(t as PgTable).name;
      });
    expect(names).not.toContain("code_igniter_session");
    expect(new Set(names).size).toBe(names.length);
  });
});
