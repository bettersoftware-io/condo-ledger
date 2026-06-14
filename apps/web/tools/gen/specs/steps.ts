import { expect } from "vitest";
import { Given, Then, When } from "./gherkin/run.ts";
import { resolvePeriod, type SpecWorld } from "./world.ts";
import { rawTrialBalanceCents, entryCount } from "./oracle.ts";
import { reconcilePeriods } from "../reconcile.ts";
import { projectAccounts, projectTransactions } from "../project/accounting.ts";
import type { LedgerAccountRow, LedgerTxnRow } from "@cl/application";

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
  expect(Math.abs(rawTrialBalanceCents(w.db, w.legacyPeriodId!))).toBeLessThanOrEqual(1);
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

Then(/^every projected transaction balances \(dare equals avere\)$/, (world) => {
  const txns = (world as SpecWorld).txns as LedgerTxnRow[];
  for (const t of txns) expect(t.dare.cents).toBe(t.avere.cents);
});

Then(/^the account tree root saldo is zero$/, (world) => {
  const accounts = (world as SpecWorld).accounts as LedgerAccountRow[];
  const rootSaldo = accounts.reduce((s, a) => s + a.saldo.cents, 0);
  expect(Math.abs(rootSaldo)).toBeLessThanOrEqual(1);
});

Then(/^the account tree saldo equals the raw sum of entries$/, (world) => {
  const w = world as SpecWorld;
  const accounts = w.accounts as LedgerAccountRow[];
  const treeSaldo = accounts.reduce((s, a) => s + a.saldo.cents, 0);
  expect(treeSaldo).toBe(rawTrialBalanceCents(w.db, w.legacyPeriodId!));
});
