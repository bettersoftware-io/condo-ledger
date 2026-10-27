import { describeUnitsPortContract } from "../ports/__contracts__/UnitsPortContract.ts";
import { createTablesSeed } from "../testing/createTablesSeed.ts";
import { createUnitsSimulator } from "./unitsSimulator.ts";

describeUnitsPortContract("units simulator", () => {
  return {
    port: createUnitsSimulator(createTablesSeed()),
    periodId: "p1",
    unknownPeriodId: "p99",
    teardown: (): void => {},
  };
});
