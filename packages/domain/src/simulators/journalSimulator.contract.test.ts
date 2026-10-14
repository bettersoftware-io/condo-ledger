import { cents } from "#/entities/cents.ts";
import { fixedClock } from "#/support/clock.ts";

import { describeJournalPortContract } from "../ports/__contracts__/JournalPortContract.ts";
import { createTwoPeriodSeed } from "../testing/createTwoPeriodSeed.ts";
import { createJournalSimulator } from "./journalSimulator.ts";

describeJournalPortContract("journal simulator", () => {
  return {
    port: createJournalSimulator(
      createTwoPeriodSeed(),
      fixedClock("2026-10-14T08:00:00Z"),
    ),
    periodId: "p1",
    unknownPeriodId: "p99",
    acceptedDraft: {
      kind: "generic",
      description: "Spesa in contanti",
      postings: [
        {
          accountId: "la21",
          debit: cents(1200),
          credit: cents(0),
          counterpart: null,
        },
        {
          accountId: "la1",
          debit: cents(0),
          credit: cents(1200),
          counterpart: null,
        },
      ],
    },
    refusedDraft: {
      kind: "generic",
      description: "Sbilanciata",
      postings: [
        {
          accountId: "la21",
          debit: cents(1200),
          credit: cents(0),
          counterpart: null,
        },
      ],
    },
    refusedReason: "unbalanced",
    deletableEntryId: "e6",
    undeletableEntryId: "e1",
    teardown: (): void => {},
  };
});
