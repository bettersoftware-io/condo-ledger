import { describeJournalPortContract } from "../ports/__contracts__/JournalPortContract.ts";
import { createSmallSeed } from "../testing/createSmallBooks.ts";
import { createJournalSimulator } from "./journalSimulator.ts";

describeJournalPortContract("journal simulator", () => {
  return {
    port: createJournalSimulator(createSmallSeed()),
    periodId: "p1",
    unknownPeriodId: "p99",
    teardown: (): void => {},
  };
});
