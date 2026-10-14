import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  type JournalOracleEntry,
  POZZETTO_2013_JOURNAL,
} from "@cl/domain/testing/pozzetto2013.journal.ts";
import { POZZETTO_2013_ORACLE } from "@cl/domain/testing/pozzetto2013.oracle.ts";

import { DUMP_SUITE_TIMEOUT_MS } from "#/legacyDump.ts";
import {
  type DesignEntry,
  type DesignPosting,
  JOURNAL_DEVIATIONS,
  JOURNAL_LABEL_ALIASES,
  journalOracleAvailable,
  journalOraclePath,
  journalSuiteName,
  KINDS_OF_ICON,
  parseDesignJournal,
} from "#/oracle/designJournal.ts";
import { designOraclePath, parseDesignOracle } from "#/oracle/designOracle.ts";
import { buildLabelMap } from "#/oracle/labelMap.ts";

describe.skipIf(!journalOracleAvailable())(
  journalSuiteName(
    "the committed journal fixture against the design's journal.json",
  ),
  { timeout: DUMP_SUITE_TIMEOUT_MS },
  () => {
    it("has the same entries, stamps, kinds, amounts, rows and running balances", () => {
      const design = parseDesignJournal(
        readFileSync(journalOraclePath(), "utf8"),
      );

      const labels = buildLabelMap(
        parseDesignOracle(readFileSync(designOraclePath(), "utf8")),
        POZZETTO_2013_ORACLE,
      );
      const mismatches: string[] = [];

      expect(design).toHaveLength(POZZETTO_2013_JOURNAL.length);

      design.forEach((entry, index) => {
        compareEntry(
          entry,
          POZZETTO_2013_JOURNAL[index] as JournalOracleEntry,
          labels,
          mismatches,
        );
      });

      expect(mismatches).toEqual([]);
    });
  },
);

/**
 * One entry of the export against the fixture's: its number, stamp, kind
 * (by its icon, unless JOURNAL_DEVIATIONS lists it, and then it must
 * differ), totals, and each line's amounts, running balance and row. A
 * mismatch names the entry and never a party: a path is printed to its
 * third segment at most.
 */
function compareEntry(
  entry: DesignEntry,
  ours: JournalOracleEntry,
  labels: Map<string, string>,
  mismatches: string[],
): void {
  const at = `entry ${entry.number}`;
  const kinds = KINDS_OF_ICON[entry.icon] ?? [];
  const deviation = JOURNAL_DEVIATIONS.some((ruled) => {
    return ruled.number === entry.number;
  });

  expectSame(at, "number", entry.number, ours.number, mismatches);
  expectSame(at, "stamp", entry.stamp, stampOf(ours.at), mismatches);

  if (kinds.includes(ours.kind) === deviation) {
    mismatches.push(
      deviation
        ? `${at}: listed in JOURNAL_DEVIATIONS, but its icon ${entry.icon} agrees with ${ours.kind}`
        : `${at}: icon ${entry.icon} is not ${ours.kind}`,
    );
  }

  expectSame(at, "debit", entry.debit, ours.debit, mismatches);
  expectSame(at, "credit", entry.credit, ours.credit, mismatches);
  expectSame(
    at,
    "postings",
    entry.postings.length,
    ours.postings.length,
    mismatches,
  );

  entry.postings.forEach((posting, index) => {
    const line = ours.postings[index];

    if (line !== undefined) {
      comparePosting(
        `${at} line ${index + 1}`,
        posting,
        line,
        labels,
        mismatches,
      );
    }
  });
}

interface OraclePosting {
  key: string;
  debit: number;
  credit: number;
  balance: number;
}

function comparePosting(
  at: string,
  posting: DesignPosting,
  ours: OraclePosting,
  labels: Map<string, string>,
  mismatches: string[],
): void {
  const account = ours.key.split("/")[0];
  const row = rowOf(posting.path, labels);

  expectSame(at, "debit", posting.debit, ours.debit, mismatches);
  expectSame(at, "credit", posting.credit, ours.credit, mismatches);
  expectSame(at, "balance", posting.balance, ours.balance, mismatches);

  if (row !== account) {
    mismatches.push(
      `${at}: "${posting.path.split(SEPARATOR).slice(0, 3).join(SEPARATOR)} …" is ${row ?? "no row of acc.json"}, not ${account}`,
    );
  }
}

/** The key of the longest prefix of the path that acc.json has a node for, its control accounts read by acc.json's labels. */
function rowOf(path: string, labels: Map<string, string>): string | undefined {
  const segments = path.split(SEPARATOR).map((segment) => {
    return (
      JOURNAL_LABEL_ALIASES.find((alias) => {
        return alias.journal === segment;
      })?.design ?? segment
    );
  });

  for (let length = segments.length; length > 0; length -= 1) {
    const key = labels.get(segments.slice(0, length).join(SEPARATOR));

    if (key !== undefined) {
      return key;
    }
  }

  return undefined;
}

/** `2013-01-10T11:09:43` → `10/01/2013 11:09`, as the export prints a stamp. */
function stampOf(at: string): string {
  const [date = "", time = ""] = at.split("T");
  const [year, month, day] = date.split("-");

  return `${day}/${month}/${year} ${time.slice(0, 5)}`;
}

function expectSame(
  at: string,
  what: string,
  theirs: number | string,
  ours: number | string,
  mismatches: string[],
): void {
  if (theirs !== ours) {
    mismatches.push(
      `${at}: ${what} ${theirs} in the export, ${ours} in the fixture`,
    );
  }
}

const SEPARATOR = " › ";
