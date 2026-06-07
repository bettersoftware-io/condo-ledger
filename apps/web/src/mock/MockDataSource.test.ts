import { firstValueFrom } from "rxjs";
import { createMockDataSource } from "./MockDataSource";

test("tree has Saturno and Pozzetto", async () => {
  const ds = createMockDataSource();
  const tree = await firstValueFrom(ds.condominiumTree());
  expect(tree.map((c) => c.code).sort()).toEqual(["POZ", "SAT"]);
});
test("units cascade from period id", async () => {
  const ds = createMockDataSource();
  const units = await firstValueFrom(ds.unitsTree("sat-2011"));
  expect(units[0]!.children?.length).toBeGreaterThan(0);
});
test("unknown period yields empty", async () => {
  const ds = createMockDataSource();
  expect(await firstValueFrom(ds.unitsTree("nope"))).toEqual([]);
});
