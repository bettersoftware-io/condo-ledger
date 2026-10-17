import { describeClockPortContract } from "../ports/__contracts__/ClockPortContract.ts";
import { fixedClock } from "./fixedClock.ts";

describeClockPortContract("fixed clock", () => {
  return {
    port: fixedClock("2026-10-14T08:00:00Z"),
    teardown: (): void => {},
  };
});
