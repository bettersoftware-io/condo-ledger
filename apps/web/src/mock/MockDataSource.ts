import type { MockDataSource } from "@cl/application";
import { MockStore } from "./MockStore";

export function createMockDataSource(): MockDataSource {
  return new MockStore();
}
