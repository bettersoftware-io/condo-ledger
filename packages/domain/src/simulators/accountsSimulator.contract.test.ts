import { describeAccountsPortContract } from "../ports/__contracts__/AccountsPortContract.ts";
import { createSmallSeed } from "../testing/createSmallBooks.ts";
import { createAccountsSimulator } from "./accountsSimulator.ts";

describeAccountsPortContract("accounts simulator", () => {
  return {
    port: createAccountsSimulator(createSmallSeed()),
    periodId: "p1",
    unknownPeriodId: "p99",
    costLeafId: "la21",
    groupingId: "la20",
    teardown: (): void => {},
  };
});
