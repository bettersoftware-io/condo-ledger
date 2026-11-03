import type { ManualDeadline } from "#/entities/deadline.ts";

import { describeCalendarPortContract } from "../ports/__contracts__/CalendarPortContract.ts";
import { createSmallSeed } from "../testing/createSmallBooks.ts";
import { createCalendarSimulator } from "./calendarSimulator.ts";

describeCalendarPortContract("calendar simulator", () => {
  const small = createSmallSeed();
  const seed = { ...small, deadlines: createDeadlines() };

  return {
    port: createCalendarSimulator(seed, () => {
      return seed.buildings;
    }),
    // The port lists by date, then time, then number: ce9 (no time) before ce10 on the same day.
    expected: [
      seed.deadlines[2],
      seed.deadlines[1],
      seed.deadlines[0],
    ] as ManualDeadline[],
    buildingId: "c1",
    teardown: (): void => {},
  };
});

function createDeadlines(): ManualDeadline[] {
  return [
    createDeadline("ce10", "2026-03-01", "08:00"),
    createDeadline("ce9", "2026-03-01", null),
    createDeadline("ce12", "2026-02-01", "12:00"),
  ];
}

function createDeadline(
  id: string,
  date: string,
  time: string | null,
): ManualDeadline {
  return {
    id,
    date,
    time,
    calendar: "fiscal",
    buildingId: null,
    description: `Deadline ${id}`,
    status: "new",
    priority: "none",
    notes: null,
  };
}
