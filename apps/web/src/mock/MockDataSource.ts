import type { MockDataSource } from "@cl/application";
import { MockStore } from "./MockStore";
import { generatedSeed } from "./data.generated";

export function createMockDataSource(): MockDataSource {
  return new MockStore();
}

export function createGeneratedDataSource(): MockDataSource {
  return new MockStore(generatedSeed);
}
