import { describe, it, expect } from "vitest";
import { filterAccounts } from "./filterAccounts";
import { ledgerAccountsByPeriod } from "../../mock/fixtures";

const rows = ledgerAccountsByPeriod["sat-2011"]!;
const labels = (rs: ReturnType<typeof filterAccounts>): string[] =>
  rs.flatMap(function walk(r): string[] { return [r.label, ...(r.children ?? []).flatMap(walk)]; });

describe("filterAccounts", () => {
  it("matches case-insensitively and keeps ancestor groups of matches", () => {
    const out = filterAccounts(rows, "cassa", false);
    expect(labels(out)).toEqual(["Totale", "Patrimoniali", "(Attività)", "Liquidità", "Cassa Contanti"]);
  });
  it("hides zero-movement leaves when hideEmpty is on, pruning emptied groups", () => {
    const out = filterAccounts(rows, "", true);
    expect(labels(out)).not.toContain("Erario c/ritenute"); // 0/0 leaf
    expect(labels(out)).toContain("Fornitori c/acquisti");
  });
  it("no query, no hide → same reference (no pointless re-allocation)", () => {
    expect(filterAccounts(rows, "", false)).toBe(rows);
  });
});
