import { describe, it, expect } from "vitest";
import { mapRow, removeRow, insertChild, findRow } from "./treeRows";

type R = { id: string; v?: number; children?: R[] };
const rows: R[] = [{ id: "a", children: [{ id: "a1" }, { id: "a2", children: [{ id: "a2x" }] }] }];

describe("treeRows", () => {
  it("mapRow replaces the matching node, preserving untouched branches by reference", () => {
    const out = mapRow(rows, "a2x", (r) => ({ ...r, v: 7 }));
    expect(findRow(out, "a2x")?.v).toBe(7);
    expect(out[0]!.children![0]!).toBe(rows[0]!.children![0]!); // a1 untouched
  });
  it("removeRow drops the node anywhere in the tree", () => {
    const out = removeRow(rows, "a2x");
    expect(findRow(out, "a2x")).toBeNull();
    expect(out[0]!.children![0]!).toBe(rows[0]!.children![0]!); // a1 untouched
  });
  it("returns the input array by reference when nothing matches", () => {
    expect(mapRow(rows, "nope", (r) => r)).toBe(rows);
    expect(removeRow(rows, "nope")).toBe(rows);
  });
  it("insertChild appends under the parent (or at the root for null parent)", () => {
    const out = insertChild(rows, "a1", { id: "new" });
    expect(findRow(out, "a1")?.children?.[0]?.id).toBe("new");
    expect(insertChild(rows, null, { id: "root2" })[1]!.id).toBe("root2");
  });
});
