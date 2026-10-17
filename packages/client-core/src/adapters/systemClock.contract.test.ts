import { describeClockPortContract } from "@cl/domain/ports/__contracts__/ClockPortContract.ts";

import { systemClock } from "./systemClock.ts";

describeClockPortContract("system clock", () => {
  return {
    port: systemClock,
    teardown: (): void => {},
  };
});
