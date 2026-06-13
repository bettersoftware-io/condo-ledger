import type { UnitRow } from "@cl/application";
import { flattenRows } from "./treeRows";

export type RegroupMode = "gruppo" | "unita" | "condomino";

/** Reshape the group→unit→resident tree for the legacy "Raggruppa righe per" selector. */
export function regroupUnits(rows: UnitRow[], mode: RegroupMode): UnitRow[] {
  if (mode === "gruppo") return rows;
  const units = flattenRows(rows).filter((r) => r.kind === "unit");
  if (mode === "unita") return units;
  // per condòmino: each resident at top, its unit attached as a context child (without grandchildren)
  return units.flatMap((u) =>
    (u.children ?? []).filter((r) => r.kind === "resident")
      .map((r) => ({ ...r, children: [{ ...u, children: undefined }] })),
  );
}
