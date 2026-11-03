import { firstValueFrom, type Observable, type Subscription } from "rxjs";
import { describe, expect, it } from "vitest";

import type { ManualDeadline } from "#/entities/deadline.ts";
import type { DeadlineDraft } from "#/useCases/calendar/validateDeadline.ts";

import type { CalendarPort } from "../calendarPort.ts";

/** What an adapter's test supplies so the contract can drive it. */
export interface CalendarPortHarness {
  port: CalendarPort;
  /** What the port is expected to answer: at least two deadlines, in their listed order. */
  expected: ManualDeadline[];
  /** A building the port knows, for a draft to name. */
  buildingId: string;
  teardown: () => void;
}

export function describeCalendarPortContract(
  label: string,
  createHarness: () => CalendarPortHarness,
): void {
  describe(`${label} :: CalendarPort contract`, () => {
    it("lists the deadlines, to each subscriber, at once", async () => {
      const { port, expected, teardown } = createHarness();

      try {
        expect(await firstValueFrom(port.deadlines())).toEqual(expected);
        expect(await firstValueFrom(port.deadlines())).toEqual(expected);
      } finally {
        teardown();
      }
    });

    it("emits again after an add, which answers the next number and is listed", async () => {
      const { port, expected, buildingId, teardown } = createHarness();

      try {
        const seen = collect(port.deadlines());
        const next = highestNumber(expected) + 1;
        const added = await port.addDeadline(
          createDraft(buildingId, { description: "  Renew  " }),
        );

        expect(added).toEqual({ ok: true, value: { id: `ce${next}` } });
        expect(seen.lists).toHaveLength(2);
        expect(seen.lists[1]?.map(idOf)).toContain(`ce${next}`);
        expect(
          seen.lists[1]?.find((deadline) => {
            return deadline.id === `ce${next}`;
          })?.description,
        ).toBe("Renew");
        seen.stop();
      } finally {
        teardown();
      }
    });

    it("lists by date, then time with none first, then the id's number", async () => {
      const { port, buildingId, teardown } = createHarness();

      try {
        await port.addDeadline(
          createDraft(buildingId, { date: "1999-01-01", time: "09:00" }),
        );
        await port.addDeadline(
          createDraft(buildingId, { date: "1999-01-01", time: null }),
        );
        await port.addDeadline(
          createDraft(buildingId, { date: "1999-01-01", time: null }),
        );
        await port.addDeadline(
          createDraft(buildingId, { date: "1998-12-31", time: "23:00" }),
        );

        const listed = (await firstValueFrom(port.deadlines())).filter(
          (deadline) => {
            return deadline.date < "2000";
          },
        );

        expect(
          listed.map((deadline) => {
            return `${deadline.date} ${deadline.time ?? "-"}`;
          }),
        ).toEqual([
          "1998-12-31 23:00",
          "1999-01-01 -",
          "1999-01-01 -",
          "1999-01-01 09:00",
        ]);
        expect(numberOf(listed[1]?.id ?? "")).toBeLessThan(
          numberOf(listed[2]?.id ?? ""),
        );
      } finally {
        teardown();
      }
    });

    it("edits a deadline, keeping its id, and emits", async () => {
      const { port, expected, buildingId, teardown } = createHarness();

      try {
        const id = expected[0]?.id ?? "";
        const seen = collect(port.deadlines());
        const verdict = await port.editDeadline(
          id,
          createDraft(buildingId, { description: "Changed", priority: "high" }),
        );

        const edited = (await firstValueFrom(port.deadlines())).find(
          (deadline) => {
            return deadline.id === id;
          },
        );

        expect(verdict).toEqual({ ok: true });
        expect(edited?.description).toBe("Changed");
        expect(edited?.priority).toBe("high");
        expect(seen.lists).toHaveLength(2);
        seen.stop();
      } finally {
        teardown();
      }
    });

    it("deletes a deadline and emits", async () => {
      const { port, expected, teardown } = createHarness();

      try {
        const id = expected[0]?.id ?? "";
        const seen = collect(port.deadlines());

        expect(await port.deleteDeadline(id)).toEqual({ ok: true });
        expect(seen.lists).toHaveLength(2);
        expect(seen.lists[1]?.map(idOf)).not.toContain(id);
        expect(seen.lists[1]).toHaveLength(expected.length - 1);
        seen.stop();
      } finally {
        teardown();
      }
    });

    it("changes nothing, and does not emit, for a refused write", async () => {
      const { port, expected, buildingId, teardown } = createHarness();

      try {
        const id = expected[0]?.id ?? "";
        const seen = collect(port.deadlines());
        const refused = createDraft(buildingId, { description: " " });

        expect(await port.addDeadline(refused)).toEqual({
          ok: false,
          reason: "blank-description",
        });
        expect(await port.editDeadline(id, refused)).toEqual({
          ok: false,
          reason: "blank-description",
        });
        expect(seen.lists).toHaveLength(1);
        expect(await firstValueFrom(port.deadlines())).toEqual(expected);
        seen.stop();
      } finally {
        teardown();
      }
    });

    it("rejects an edit and a delete of an id it does not have", async () => {
      const { port, buildingId, teardown } = createHarness();

      try {
        await expect(
          port.editDeadline("ce-none", createDraft(buildingId)),
        ).rejects.toThrow();
        await expect(port.deleteDeadline("ce-none")).rejects.toThrow();
      } finally {
        teardown();
      }
    });
  });
}

function createDraft(
  buildingId: string,
  parts: Partial<DeadlineDraft> = {},
): DeadlineDraft {
  return {
    date: "2026-11-05",
    time: "10:30",
    calendar: "general",
    buildingId,
    description: "Meet the plumber",
    status: "new",
    priority: "none",
    notes: null,
    ...parts,
  };
}

function idOf(deadline: ManualDeadline): string {
  return deadline.id;
}

function numberOf(id: string): number {
  return Number(/^ce(\d+)$/.exec(id)?.[1] ?? 0);
}

function highestNumber(deadlines: ManualDeadline[]): number {
  return Math.max(0, ...deadlines.map(idNumber));
}

function idNumber(deadline: ManualDeadline): number {
  return numberOf(deadline.id);
}

interface Collected {
  lists: ManualDeadline[][];
  stop: () => void;
}

function collect(source: Observable<ManualDeadline[]>): Collected {
  const lists: ManualDeadline[][] = [];
  const subscription: Subscription = source.subscribe((list) => {
    lists.push(list);
  });

  return {
    lists,
    stop: (): void => {
      subscription.unsubscribe();
    },
  };
}
