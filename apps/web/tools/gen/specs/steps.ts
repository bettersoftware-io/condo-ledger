import { expect } from "vitest";
import { Given, Then } from "./gherkin/run.ts";
import { resolvePeriod, type SpecWorld } from "./world.ts";
import { rawTrialBalanceCents, entryCount } from "./oracle.ts";
import { reconcilePeriods } from "../reconcile.ts";

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
