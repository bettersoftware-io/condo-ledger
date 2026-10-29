import { expect } from "vitest";

import {
  type Allocation,
  type AllocationRow,
  allocationBooksOf,
  allocationOf,
  allocationSourceOf,
  type LegacySeed,
  loadLegacySeed,
} from "@cl/domain";

import { projectAccounts, projectTransactions } from "#/project/accounting.ts";
import {
  projectAnagrafiche,
  projectCategories,
} from "#/project/anagrafiche.ts";
import { projectInstallments } from "#/project/installments.ts";
import { projectLegacySeed } from "#/project/legacySeed.ts";
import { projectTree } from "#/project/structure.ts";
import { reconcilePeriods } from "#/reconcile.ts";
import type {
  Anagrafica,
  CondominiumNode,
  InstallmentRow,
  LedgerAccountRow,
  LedgerTxnRow,
} from "#/seedTypes.ts";

import { Given, Then, When } from "./gherkin/run.ts";
import {
  entryCount,
  installmentItemTotalCents,
  rawTrialBalanceCents,
} from "./oracle.ts";
import { resolvePeriod, type SpecWorld } from "./world.ts";

Given(/^the legacy data for period "([^"]+)"$/, (world, label) => {
  const w = world as SpecWorld;
  w.legacyPeriodId = resolvePeriod(w.db, label);
});

Then(/^the period has posted books$/, (world) => {
  const w = world as SpecWorld;
  expect(entryCount(w.db, w.legacyPeriodId!)).toBeGreaterThan(0);
});

Then(/^the trial balance nets to zero$/, (world) => {
  const w = world as SpecWorld;
  expect(
    Math.abs(rawTrialBalanceCents(w.db, w.legacyPeriodId!)),
  ).toBeLessThanOrEqual(1);
});

Then(/^the new reconciliation gate marks the period reconciled$/, (world) => {
  const w = world as SpecWorld;
  const status = reconcilePeriods(w.db)[w.legacyPeriodId!]!;
  expect(status).toEqual({ hasBooks: true, reconciles: true });
});

When(/^the new app projects the ledger$/, (world) => {
  const w = world as SpecWorld;
  w.accounts = projectAccounts(w.db, w.legacyPeriodId!);
  w.txns = projectTransactions(w.db, w.legacyPeriodId!);
});

Then(
  /^every projected transaction balances \(dare equals avere\)$/,
  (world) => {
    const txns = (world as SpecWorld).txns as LedgerTxnRow[];

    for (const t of txns) {
      expect(t.dare.cents).toBe(t.avere.cents);
    }
  },
);

Then(/^the account tree root saldo is zero$/, (world) => {
  const accounts = (world as SpecWorld).accounts as LedgerAccountRow[];
  const rootSaldo = accounts.reduce((s, a) => {
    return s + a.saldo.cents;
  }, 0);
  expect(Math.abs(rootSaldo)).toBeLessThanOrEqual(1);
});

Then(/^the account tree saldo equals the raw sum of entries$/, (world) => {
  const w = world as SpecWorld;
  const accounts = w.accounts as LedgerAccountRow[];
  const treeSaldo = accounts.reduce((s, a) => {
    return s + a.saldo.cents;
  }, 0);
  expect(treeSaldo).toBe(rawTrialBalanceCents(w.db, w.legacyPeriodId!));
});

// --- allocation parity (the legacy algorithm) --------------------------------

When(/^the new app computes the budget allocation$/, (world) => {
  const w = world as SpecWorld;
  w.allocation = allocationOf(
    allocationBooksOf(
      allocationSourceOf(projectedSeed(w), `p${w.legacyPeriodId!}`),
    ),
    "budget",
  );
});

Then(
  /^the allocation total of each of the (\d+) residents equals its line of the posted entry "([^"]+)"$/,
  (world, count, entryId) => {
    const w = world as SpecWorld;
    const posted = postedLines(projectedSeed(w), entryId);
    const totals = residentTotals(w.allocation as Allocation);
    expect(totals.size).toBe(Number(count));
    expect(totals).toEqual(posted);
  },
);

Then(
  /^the allocation total of each of the (\d+) residents other than "([^"]+)" and "([^"]+)" equals its line of the posted entry "([^"]+)"$/,
  (world, count, first, second, entryId) => {
    const w = world as SpecWorld;
    const posted = postedLines(projectedSeed(w), entryId);
    const totals = residentTotals(w.allocation as Allocation);

    for (const excluded of [first, second]) {
      totals.delete(excluded);
      posted.delete(excluded);
    }

    expect(totals.size).toBe(Number(count));
    expect(totals).toEqual(posted);
  },
);

Then(
  /^the allocation total of "([^"]+)" is (\d+) cents and of "([^"]+)" is (\d+) cents$/,
  (world, first, firstCents, second, secondCents) => {
    const totals = residentTotals(
      (world as SpecWorld).allocation as Allocation,
    );
    expect(totals.get(first)).toBe(Number(firstCents));
    expect(totals.get(second)).toBe(Number(secondCents));
  },
);

let cachedSeed: LegacySeed | null = null;

/** The generator's own projection of the dump, loaded as the simulators load the seed; built once per worker. */
function projectedSeed(world: SpecWorld): LegacySeed {
  if (!cachedSeed) {
    cachedSeed = loadLegacySeed(projectLegacySeed(world.db));
  }

  return cachedSeed;
}

/** Each owner's line of a posted allocation entry: its postings on the account the entry opens with (a later one is a rounding). */
function postedLines(seed: LegacySeed, entryId: string): Map<string, number> {
  const entry = seed.entries.find((candidate) => {
    return candidate.id === entryId;
  });
  const first = entry?.postings[0];

  if (entry === undefined || first === undefined) {
    throw new Error(`The projected seed has no entry ${entryId}`);
  }

  const lines = new Map<string, number>();

  for (const posting of entry.postings) {
    if (
      posting.accountId === first.accountId &&
      posting.counterpart?.kind === "owner"
    ) {
      lines.set(
        posting.counterpart.id,
        (lines.get(posting.counterpart.id) ?? 0) + posting.debit,
      );
    }
  }

  return lines;
}

/** The Total of each resident row, by resident id. */
function residentTotals(allocation: Allocation): Map<string, number> {
  const totals = new Map<string, number>();

  function walk(row: AllocationRow): void {
    if (row.kind === "resident") {
      totals.set(row.key.replace(/^resident:/, ""), row.total);
    }

    row.children.forEach(walk);
  }

  walk(allocation.root);
  return totals;
}

// --- installments parity ----------------------------------------------------

When(/^the new app projects the installments$/, (world) => {
  const w = world as SpecWorld;
  w.installments = projectInstallments(w.db, w.legacyPeriodId!);
});

Then(
  /^the installments group total equals the sum of legacy installmentItem amounts$/,
  (world) => {
    const w = world as SpecWorld;
    const inst = w.installments as ReturnType<typeof projectInstallments>;
    const group = inst.rows[0] as InstallmentRow | undefined;
    const projected = group ? group.totPreventivo.cents : 0;
    expect(projected).toBe(installmentItemTotalCents(w.db, w.legacyPeriodId!));
  },
);

// --- anagrafiche + structure projection parity ------------------------------

// Studio-wide "Given" (no period) — distinct from the period variant registered
// above (/^the legacy data for period "..."$/); both are anchored so neither shadows
// the other (runStep matches first-registered-wins).
Given(/^the legacy data$/, () => {
  // no-op: world already holds the db; periodId not needed for studio-wide projections
});

When(/^the new app projects the anagrafiche$/, (world) => {
  const w = world as SpecWorld;
  w.anagrafiche = projectAnagrafiche(w.db);
  w.categories = projectCategories(w.db);
});

Then(
  /^every anagrafica has a category present in the category registry$/,
  (world) => {
    const w = world as SpecWorld;
    const cats = new Set(w.categories as string[]);

    for (const a of w.anagrafiche as Anagrafica[]) {
      expect(cats.has(a.categoria)).toBe(true);
    }
  },
);

Then(/^the registry has at least (\d+) parties$/, (world, n) => {
  expect(
    ((world as SpecWorld).anagrafiche as Anagrafica[]).length,
  ).toBeGreaterThanOrEqual(Number(n));
});

When(/^the new app projects the condominium tree$/, (world) => {
  const w = world as SpecWorld;
  w.tree = projectTree(w.db);
});

Then(
  /^the tree contains the building "([^"]+)" with a null legacy code rendered blank$/,
  (world, name) => {
    const tree = (world as SpecWorld).tree as CondominiumNode[];
    const node = tree.find((c) => {
      return c.name === name;
    });
    expect(node).toBeDefined();
    expect(node!.code).toBe("");
  },
);

Then(/^the tree contains the super-condominium "([^"]+)"$/, (world, name) => {
  const tree = (world as SpecWorld).tree as CondominiumNode[];
  const node = tree.find((c) => {
    return c.name === name;
  });
  expect(node).toBeDefined();
  expect(node!.type).toBe("super");
});

Then(
  /^the tree excludes any building whose name contains "([^"]+)"$/,
  (world, needle) => {
    const tree = (world as SpecWorld).tree as CondominiumNode[];
    expect(
      tree.some((c) => {
        return c.name.toLowerCase().includes(needle.toLowerCase());
      }),
    ).toBe(false);
  },
);
