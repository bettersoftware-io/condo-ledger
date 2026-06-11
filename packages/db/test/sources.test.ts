import { describe, it, expect } from "vitest";
import { DROP_STUDIO_ID, STUDIO_BACKFILL } from "../etl/sources.ts";

// Cheap guard: the studioId reconciliation sets are load-bearing (a positional
// column override + a NOT NULL backfill). Pin their exact membership so they can't
// silently drift. See sources.ts for the evidence behind these choices.
describe("studioId reconciliation sets", () => {
  it("DROP_STUDIO_ID is exactly the four pre-studioId dumps", () => {
    expect([...DROP_STUDIO_ID].sort()).toEqual(
      ["condominiumSupplier", "f24", "installmentItem", "ledgerInvoice2F24"].sort(),
    );
  });

  it("STUDIO_BACKFILL is the four above plus condominium (present-but-NULL)", () => {
    expect([...STUDIO_BACKFILL].sort()).toEqual(
      ["condominium", "condominiumSupplier", "f24", "installmentItem", "ledgerInvoice2F24"].sort(),
    );
  });

  it("every DROP_STUDIO_ID table is also backfilled", () => {
    for (const t of DROP_STUDIO_ID) expect(STUDIO_BACKFILL.has(t)).toBe(true);
  });
});
