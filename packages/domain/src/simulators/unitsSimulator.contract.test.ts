import { describeUnitsPortContract } from "../ports/__contracts__/UnitsPortContract.ts";
import { createUnitsSeed } from "../testing/createUnitsSeed.ts";
import { createUnitsSimulator } from "./unitsSimulator.ts";

describeUnitsPortContract("units simulator", () => {
  return {
    port: createUnitsSimulator(createUnitsSeed()),
    periodId: "p1",
    periodStart: "2013-01-01",
    periodEnd: "2013-12-31",
    outsideDate: "2014-01-01",
    unknownPeriodId: "p99",
    emptyGroupId: "ugC",
    unitId: "uA02",
    namedResidentId: "r2",
    billedResidentId: "r4",
    contactId: "md12",
    contactName: "Verdi Luca",
    teardown: (): void => {},
  };
});
