import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import type { EntryDraft, JournalEntry } from "#/entities/journal.ts";

import type { JournalPort } from "../journalPort.ts";

/** What an adapter's test supplies so the contract can drive it. */
export interface JournalPortHarness {
  port: JournalPort;
  periodId: string;
  unknownPeriodId: string;
  /** Balanced, on the period's leaves. */
  acceptedDraft: EntryDraft;
  refusedDraft: EntryDraft;
  refusedReason: string;
  /** An entry canDeleteEntry accepts, not the last by number. */
  deletableEntryId: string;
  undeletableEntryId: string;
  teardown: () => void;
}

export function describeJournalPortContract(
  label: string,
  createHarness: () => JournalPortHarness,
): void {
  describe(`${label} :: JournalPort contract`, () => {
    it("answers a period's entries, all of that period, in number order", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        const entries = await firstValueFrom(port.entries(periodId));
        const numbers = entries.map((entry) => {
          return entry.number;
        });

        expect(entries.length).toBeGreaterThan(0);
        expect(
          entries.every((entry) => {
            return entry.periodId === periodId;
          }),
        ).toBe(true);
        expect(numbers).toEqual(
          [...numbers].sort((a, b) => {
            return a - b;
          }),
        );
      } finally {
        teardown();
      }
    });

    it("fails, naming the id, for a period it does not have", async () => {
      const { port, unknownPeriodId, teardown } = createHarness();

      try {
        await expect(
          firstValueFrom(port.entries(unknownPeriodId)),
        ).rejects.toThrow(unknownPeriodId);
      } finally {
        teardown();
      }
    });

    it("adds an entry: the next number, the port's stamp, the id it answers with, and every subscriber hears", async () => {
      const { port, periodId, acceptedDraft, teardown } = createHarness();
      const seen: JournalEntry[][] = [];
      const subscription = port.entries(periodId).subscribe((entries) => {
        seen.push(entries);
      });

      try {
        const before = seen.at(-1) ?? [];
        const result = await port.addEntry(periodId, acceptedDraft);

        expect(result.ok).toBe(true);

        const id = result.ok ? result.value.id : "";
        const added = seen.at(-1)?.find((entry) => {
          return entry.id === id;
        });

        expect(seen.at(-1)).toHaveLength(before.length + 1);
        expect(added).toMatchObject({
          periodId,
          number:
            Math.max(
              ...before.map((entry) => {
                return entry.number;
              }),
            ) + 1,
          kind: acceptedDraft.kind,
          description: acceptedDraft.description,
          postings: acceptedDraft.postings,
        });
        expect(added?.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      } finally {
        subscription.unsubscribe();
        teardown();
      }
    });

    it("refuses a draft with the domain's reason and leaves the journal as it was", async () => {
      const { port, periodId, refusedDraft, refusedReason, teardown } =
        createHarness();

      try {
        const before = await firstValueFrom(port.entries(periodId));

        expect(await port.addEntry(periodId, refusedDraft)).toEqual({
          ok: false,
          reason: refusedReason,
        });
        expect(await firstValueFrom(port.entries(periodId))).toEqual(before);
      } finally {
        teardown();
      }
    });

    it("rejects an entry for a period it does not have", async () => {
      const { port, unknownPeriodId, acceptedDraft, teardown } =
        createHarness();

      try {
        await expect(
          port.addEntry(unknownPeriodId, acceptedDraft),
        ).rejects.toThrow(unknownPeriodId);
      } finally {
        teardown();
      }
    });

    it("deletes an entry and closes the gap in the numbering", async () => {
      const { port, periodId, deletableEntryId, teardown } = createHarness();

      try {
        const before = await firstValueFrom(port.entries(periodId));

        expect(await port.deleteEntry(deletableEntryId)).toEqual({ ok: true });

        const after = await firstValueFrom(port.entries(periodId));

        expect(after).toHaveLength(before.length - 1);
        expect(
          after.some((entry) => {
            return entry.id === deletableEntryId;
          }),
        ).toBe(false);
        expect(
          after.map((entry) => {
            return entry.number;
          }),
        ).toEqual(
          after.map((_, index) => {
            return index + 1;
          }),
        );
      } finally {
        teardown();
      }
    });

    it("refuses to delete a kind the domain keeps, and leaves the journal as it was", async () => {
      const { port, periodId, undeletableEntryId, teardown } = createHarness();

      try {
        const before = await firstValueFrom(port.entries(periodId));

        expect(await port.deleteEntry(undeletableEntryId)).toEqual({
          ok: false,
          reason: "kind-not-deletable",
        });
        expect(await firstValueFrom(port.entries(periodId))).toEqual(before);
      } finally {
        teardown();
      }
    });

    it("rejects a delete of an entry it does not have", async () => {
      const { port, teardown } = createHarness();

      try {
        await expect(port.deleteEntry("nope")).rejects.toThrow("nope");
      } finally {
        teardown();
      }
    });
  });
}
