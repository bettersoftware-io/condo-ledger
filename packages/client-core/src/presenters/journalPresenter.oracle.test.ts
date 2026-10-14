import { describe, expect, it } from "vitest";

import type { JournalEntryView } from "@cl/domain";
import {
  type JournalOracleEntry,
  POZZETTO_2013_JOURNAL,
} from "@cl/domain/testing/pozzetto2013.journal.ts";

import { createAppHarness } from "../testing/appHarness.ts";

describe("the Journal screen on Pozzetto 2013", () => {
  it("reconciles every entry and every line to the oracle: number, kind, stamp, totals, rows, amounts, running balances", () => {
    const { app } = createAppHarness();
    let entries: JournalEntryView[] = [];
    app.presenters.journal.entries$.subscribe((next) => {
      entries = next;
    });

    app.presenters.buildings.selectPeriod("p36");

    const mismatches: string[] = [];
    POZZETTO_2013_JOURNAL.forEach((expected, index) => {
      compare(expected, entries[index], mismatches);
    });
    expect(mismatches).toEqual([]);
    expect(entries).toHaveLength(140);
    expect(entries[0]?.postings).toHaveLength(20);
    expect(entries.at(-1)?.postings).toHaveLength(55);
  });
});

function compare(
  expected: JournalOracleEntry,
  actual: JournalEntryView | undefined,
  mismatches: string[],
): void {
  if (actual === undefined) {
    mismatches.push(`entry ${expected.number}: missing`);
    return;
  }

  if (
    expected.number !== actual.number ||
    expected.kind !== actual.kind ||
    expected.at !== actual.at ||
    expected.debit !== actual.debit ||
    expected.credit !== actual.credit
  ) {
    mismatches.push(
      `entry ${expected.number} ${expected.kind} ${expected.at} ${expected.debit}/${expected.credit} vs entry ${actual.number} ${actual.kind} ${actual.at} ${actual.debit}/${actual.credit}`,
    );
  }

  if (expected.postings.length !== actual.postings.length) {
    mismatches.push(
      `entry ${expected.number}: ${expected.postings.length} lines expected, ${actual.postings.length} found`,
    );
    return;
  }

  expected.postings.forEach((line, index) => {
    const ours = actual.postings[index];

    if (
      line.key !== ours?.key ||
      line.debit !== ours.debit ||
      line.credit !== ours.credit ||
      line.balance !== ours.balance
    ) {
      mismatches.push(
        `entry ${expected.number} line ${index + 1}: ${line.key} ${line.debit}/${line.credit}/${line.balance} vs ${ours?.key} ${ours?.debit}/${ours?.credit}/${ours?.balance}`,
      );
    }
  });
}
