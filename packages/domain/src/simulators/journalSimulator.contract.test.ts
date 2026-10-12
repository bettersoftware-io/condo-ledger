import { describeJournalPortContract } from "../ports/__contracts__/JournalPortContract.ts";
import { createTwoPeriodSeed } from "../testing/createTwoPeriodSeed.ts";
import { createJournalSimulator } from "./journalSimulator.ts";

describeJournalPortContract("journal simulator", () => {
  return {
    port: createJournalSimulator(createTwoPeriodSeed()),
    periodId: "p1",
    unknownPeriodId: "p99",
    teardown: (): void => {},
  };
});
