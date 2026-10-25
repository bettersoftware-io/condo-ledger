import { describeInstallmentsPortContract } from "../ports/__contracts__/InstallmentsPortContract.ts";
import { createTwoPeriodSeed } from "../testing/createTwoPeriodSeed.ts";
import { createInstallmentsSimulator } from "./installmentsSimulator.ts";

describeInstallmentsPortContract("installments simulator", () => {
  return {
    port: createInstallmentsSimulator(createTwoPeriodSeed()),
    periodId: "p1",
    unknownPeriodId: "p99",
    teardown: (): void => {},
  };
});
