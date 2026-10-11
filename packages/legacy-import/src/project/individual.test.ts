import { describe, expect, it } from "vitest";

import type { Db } from "../db.ts";
import { projectIndividual } from "./individual.ts";

describe("projectIndividual", () => {
  it("sums directly-attributed individual expenses per resident, filtering by period/type/kind/unitResidentId", () => {
    expect(projectIndividual(db, "p1")).toEqual({ "166": 1500 }); // 12,00 + 3,00 = 1500 cents
  });

  it("returns an empty record when nothing qualifies", () => {
    expect(projectIndividual(db, "no-such-period")).toEqual({});
  });
});

function createFakeDb(tables: Record<string, Record<string, unknown>[]>): Db {
  function rows(t: string) {
    return tables[t] ?? [];
  }

  function by(t: string, key: string) {
    const map = new Map<string, Record<string, unknown>>();

    for (const r of rows(t)) {
      map.set(String(r[key]), r);
    }

    return {
      get: (k: string) => {
        return map.get(k);
      },
    };
  }

  function group(t: string, key: string) {
    const map = new Map<string, Record<string, unknown>[]>();

    for (const r of rows(t)) {
      const k = String(r[key]);
      (map.get(k) ?? map.set(k, []).get(k)!).push(r);
    }

    return {
      get: (k: string) => {
        return map.get(k);
      },
    };
  }

  return { rows, by, group } as unknown as Db;
}

const db = createFakeDb({
  ledgerTransaction: [
    { id: "t1", accountingPeriodId: "p1" },
    { id: "t2", accountingPeriodId: "other" }, // out of period → ignored
  ],
  ledgerAccount: [
    { id: "ea", kind: "expenses" },
    { id: "rev", kind: "revenues" },
  ],
  ledgerEntry: [
    // counted: in-period, non-takings, expenses-kind posting account, has unitResidentId
    {
      ledgerTransactionId: "t1",
      type: "expense",
      postingAccountId: "ea",
      unitResidentId: "166",
      amount: "12,00",
    },
    {
      ledgerTransactionId: "t1",
      type: "expense",
      postingAccountId: "ea",
      unitResidentId: "166",
      amount: "3,00",
    },
    // ignored: takings
    {
      ledgerTransactionId: "t1",
      type: "unitResidentTakings",
      postingAccountId: "ea",
      unitResidentId: "166",
      amount: "-99,00",
    },
    // ignored: posting account is not expenses-kind
    {
      ledgerTransactionId: "t1",
      type: "expense",
      postingAccountId: "rev",
      unitResidentId: "166",
      amount: "5,00",
    },
    // ignored: no unitResidentId
    {
      ledgerTransactionId: "t1",
      type: "expense",
      postingAccountId: "ea",
      amount: "7,00",
    },
    // ignored: transaction not in this period
    {
      ledgerTransactionId: "t2",
      type: "expense",
      postingAccountId: "ea",
      unitResidentId: "166",
      amount: "100,00",
    },
  ],
});
