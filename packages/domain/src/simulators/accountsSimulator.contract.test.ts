import { describeAccountsPortContract } from "../ports/__contracts__/AccountsPortContract.ts";
import { createTwoPeriodSeed } from "../testing/createTwoPeriodSeed.ts";
import { createAccountsSimulator } from "./accountsSimulator.ts";

describeAccountsPortContract("accounts simulator", () => {
  return {
    port: createAccountsSimulator(createTwoPeriodSeed()),
    periodId: "p1",
    unknownPeriodId: "p99",
    costLeafId: "la21",
    groupingId: "la20",
    teardown: (): void => {},
  };
});
