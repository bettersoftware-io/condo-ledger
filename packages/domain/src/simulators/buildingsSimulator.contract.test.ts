import { describeBuildingsPortContract } from "../ports/__contracts__/BuildingsPortContract.ts";
import { createSmallSeed } from "../testing/createSmallBooks.ts";
import { createBuildingsSimulator } from "./buildingsSimulator.ts";

describeBuildingsPortContract("buildings simulator", () => {
  const seed = createSmallSeed();

  return {
    port: createBuildingsSimulator(seed),
    expected: seed.buildings,
    teardown: (): void => {},
  };
});
