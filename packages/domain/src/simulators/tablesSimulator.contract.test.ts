import { describeTablesPortContract } from "../ports/__contracts__/TablesPortContract.ts";
import { createTablesSeed } from "../testing/createTablesSeed.ts";
import { createTablesSimulator } from "./tablesSimulator.ts";

describeTablesPortContract("tables simulator", () => {
  return {
    port: createTablesSimulator(createTablesSeed()),
    periodId: "p1",
    unknownPeriodId: "p99",
    linkedTableId: "dt1",
    linkingAccountId: "la21",
    unlinkedTableId: "dt2",
    unitId: "uA02",
    unitIds: ["uA01", "uA02", "uB01"],
    teardown: (): void => {},
  };
});
