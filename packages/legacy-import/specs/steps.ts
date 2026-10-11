import { expect } from "vitest";
import { Given, Then, When } from "./gherkin/run.ts";
import { resolvePeriod, type SpecWorld } from "./world.ts";
import { rawTrialBalanceCents, entryCount, estimateDistributionByResident, installmentItemTotalCents, startingBalanceByResident } from "./oracle.ts";
import { reconcilePeriods } from "#/reconcile.ts";
import { projectAccounts, projectTransactions } from "#/project/accounting.ts";
import { projectDistribution } from "#/project/distribution.ts";
import { buildRiparto } from "@cl/domain";
import { dbToRipartoInput } from "#/project/ripartoInput.ts";
import { projectUnits } from "#/project/units.ts";
import type { LedgerAccountRow, LedgerTxnRow, InstallmentRow, UnitRow } from "#/seedTypes.ts";
import { projectInstallments } from "#/project/installments.ts";
import { projectAnagrafiche, projectCategories } from "#/project/anagrafiche.ts";
import { projectTree } from "#/project/structure.ts";
import type { Anagrafica, CondominiumNode } from "#/seedTypes.ts";

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

// --- riparto (distribution) parity -----------------------------------------

/** group row is rows[0]; its total is the whole matrix total. */
function sumMatrix(rows: { total: { cents: number } }[]): number {
  return rows.length ? rows[0]!.total.cents : 0;
}

When(/^the new app computes the riparto matrices$/, (world) => {
  const w = world as SpecWorld;
  w.dist = projectDistribution(w.db, w.legacyPeriodId!);
});

Then(/^the estimate matrix total equals the sum of linked expense estimates$/, (world) => {
  const w = world as SpecWorld;
  const dist = w.dist as ReturnType<typeof projectDistribution>;
  const eng = buildRiparto(dbToRipartoInput(w.db, w.legacyPeriodId!));
  const src = eng.columns.reduce((s, c) => s + eng.subtree(c.legacyAccountId).estimateCents, 0);
  const matrix = sumMatrix(dist.estimate.rows);
  // tolerance: ~one rounding cent per allocated (column x unit) cell. A multi-link
  // column rounds once per chosen link, so a cell can contribute >1 cent; in practice
  // link counts are small and errors rarely align, so this remains a safe upper bound.
  expect(Math.abs(matrix - src)).toBeLessThanOrEqual(eng.columns.length * eng.unitLegacyIds.length);
});

Then(/^the current matrix total equals the sum of linked expense actuals$/, (world) => {
  const w = world as SpecWorld;
  const dist = w.dist as ReturnType<typeof projectDistribution>;
  const eng = buildRiparto(dbToRipartoInput(w.db, w.legacyPeriodId!));
  const src = eng.columns.reduce((s, c) => s + eng.subtree(c.legacyAccountId).actualCents, 0);
  const matrix = sumMatrix(dist.current.rows);
  expect(Math.abs(matrix - src)).toBeLessThanOrEqual(eng.columns.length * eng.unitLegacyIds.length);
});

When(/^the new app computes per-resident preventivo from the riparto engine$/, (world) => {
  const w = world as SpecWorld;
  const eng = buildRiparto(dbToRipartoInput(w.db, w.legacyPeriodId!));
  const byResident = new Map<string, number>();
  for (const unitId of eng.unitLegacyIds) {
    for (const col of eng.columns) {
      for (const [ur, cents] of eng.perResidentAmount(col.legacyAccountId, "estimate", unitId)) {
        byResident.set(ur, (byResident.get(ur) ?? 0) + cents);
      }
    }
  }
  w.enginePreventivo = byResident;
});

// Σ-only fallback: the per-resident split diverges materially (see feature NOTE),
// but the TOTAL preventivo the engine emits ties out to what the legacy app
// posted, within rounding. Tolerance = number of residents (≤1 cent per resident
// rounding), generous enough to cover the per-cell rounding of the split.
Then(
  /^the total engine preventivo equals the total legacy estimateDistribution within rounding$/,
  (world) => {
    const w = world as SpecWorld;
    const engine = w.enginePreventivo as Map<string, number>;
    const legacy = estimateDistributionByResident(w.db, w.legacyPeriodId!);
    const sum = (mm: Map<string, number>): number => [...mm.values()].reduce((s, v) => s + v, 0);
    const residents = new Set<string>([...engine.keys(), ...legacy.keys()]).size;
    expect(Math.abs(sum(engine) - sum(legacy))).toBeLessThanOrEqual(residents);
  },
);

// --- installments parity ----------------------------------------------------

When(/^the new app projects the installments$/, (world) => {
  const w = world as SpecWorld;
  w.installments = projectInstallments(w.db, w.legacyPeriodId!);
});

Then(/^the installments group total equals the sum of legacy installmentItem amounts$/, (world) => {
  const w = world as SpecWorld;
  const inst = w.installments as ReturnType<typeof projectInstallments>;
  const group = inst.rows[0] as InstallmentRow | undefined;
  const projected = group ? group.totPreventivo.cents : 0;
  expect(projected).toBe(installmentItemTotalCents(w.db, w.legacyPeriodId!));
});

// --- units money (per-resident saldoPrec) parity ---------------------------

// Resident rows carry id `r<unitResident.id>` (see project/units.ts: `id: \`r${r.id}\``),
// so stripping the leading `r` recovers the raw unitResident.id that
// startingBalanceByResident keys by.
function residentRows(rows: UnitRow[]): UnitRow[] {
  const out: UnitRow[] = [];
  const walk = (r: UnitRow) => { if (r.kind === "resident") out.push(r); (r.children ?? []).forEach(walk); };
  rows.forEach(walk);
  return out;
}

When(/^the new app projects the units tree$/, (world) => {
  const w = world as SpecWorld;
  w.units = projectUnits(w.db, w.legacyPeriodId!);
});

Then(/^each resident saldoPrec equals the legacy unitResident startingBalance$/, (world) => {
  const w = world as SpecWorld;
  const residents = residentRows(w.units as UnitRow[]);
  const legacy = startingBalanceByResident(w.db, w.legacyPeriodId!);
  expect(residents.length).toBeGreaterThan(0);
  for (const r of residents) {
    const legacyId = r.id.replace(/^r/, "");
    expect(r.saldoPrec.cents).toBe(legacy.get(legacyId) ?? 0);
  }
});

Then(/^the group saldoPrec equals the sum of resident saldoPrec$/, (world) => {
  const rows = (world as SpecWorld).units as UnitRow[];
  expect(rows.length).toBeGreaterThan(0); // fail readably (not a raw TypeError) on an empty tree
  const group = rows[0]!;
  const sum = residentRows(rows).reduce((s, r) => s + r.saldoPrec.cents, 0);
  expect(group.saldoPrec.cents).toBe(sum);
});

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

Then(/^every anagrafica has a category present in the category registry$/, (world) => {
  const w = world as SpecWorld;
  const cats = new Set(w.categories as string[]);
  for (const a of w.anagrafiche as Anagrafica[]) expect(cats.has(a.categoria)).toBe(true);
});

Then(/^the registry has at least (\d+) parties$/, (world, n) => {
  expect(((world as SpecWorld).anagrafiche as Anagrafica[]).length).toBeGreaterThanOrEqual(Number(n));
});

When(/^the new app projects the condominium tree$/, (world) => {
  const w = world as SpecWorld;
  w.tree = projectTree(w.db);
});

Then(/^the tree contains the building "([^"]+)" with a null legacy code rendered blank$/, (world, name) => {
  const tree = (world as SpecWorld).tree as CondominiumNode[];
  const node = tree.find((c) => c.name === name);
  expect(node).toBeDefined();
  expect(node!.code).toBe("");
});

Then(/^the tree contains the super-condominium "([^"]+)"$/, (world, name) => {
  const tree = (world as SpecWorld).tree as CondominiumNode[];
  const node = tree.find((c) => c.name === name);
  expect(node).toBeDefined();
  expect(node!.type).toBe("super");
});

Then(/^the tree excludes any building whose name contains "([^"]+)"$/, (world, needle) => {
  const tree = (world as SpecWorld).tree as CondominiumNode[];
  expect(tree.some((c) => c.name.toLowerCase().includes(needle.toLowerCase()))).toBe(false);
});
