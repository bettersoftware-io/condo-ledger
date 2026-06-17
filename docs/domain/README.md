# Domain Documentation

This folder explains the **problem domain** of the condominium-management app and the legacy
data it is built on. It complements the strategic/product brief in
[`../PROJECT_BRIEF.md`](../PROJECT_BRIEF.md) (which is the forward-looking *product vision*:
multi-jurisdiction SaaS, country packs, competitive landscape).

The app today is a faithful prototype seeded from a real legacy Italian condominium dataset
(`old/db/it-jtime-condominium.all.sql`). These documents describe that domain as it actually
works in the code.

## Contents

| Document | What it covers |
|---|---|
| [`database-schema.md`](./database-schema.md) | The legacy MySQL schema — Entity-Relationship diagrams and a per-table reference for the ~30 core domain tables (registry, units & residents, master data, the double-entry ledger, distribution/riparto, installments, calendar). Mirrors the real DDL. |
| [`accounting-and-distribution.md`](./accounting-and-distribution.md) | How the numbers work — the data pipeline (dump → generator → seed → app), **double-entry** bookkeeping (signed amounts, account tree, roll-up), per-period **reconciliation** (the trial-balance gate), and the Italian **distribution (riparto)** engine (subtree roll-up, multi-table % splits, estimate vs consuntivo tables, owner/tenant role split), with diagrams and worked examples. |
| [`requirements.md`](./requirements.md) | The legacy **requirements & feature catalogue** — extracted from the original 2011 analytical spec (`old/prototype.pdf`), structured into 14 areas (anagrafiche, buildings/periods, accounting, riparto, installments, fiscal, calendar, documents, frontend portal, …), each **cross-checked** against the legacy schema (what was modelled) and the current prototype (what's built), with the author's own future/aspirational flags and open questions preserved. |

## Parity specs

**Parity specs** — `apps/web/tools/gen/specs/features/*.feature` are executable Gherkin
acceptance specs proving the new accounting **projections** (the generator that produces
the app's seed) reproduce the legacy dump (the oracle) — not the prototype UI, and not the
legacy app itself. Run with `pnpm --filter @cl/web spec`. See
[`apps/web/tools/gen/specs/README.md`](../../apps/web/tools/gen/specs/README.md) for
exactly what is and isn't covered; design:
`docs/superpowers/specs/2026-06-14-accounting-parity-specs-design.md`.

**Riparto engine** — the faithful distribution math lives once in
`packages/domain/src/riparto/computeRiparto.ts` (pure, store/DB-agnostic). The offline
generator adapts the legacy dump into it via `apps/web/tools/gen/project/ripartoInput.ts`;
`data.generated.json` is byte-identical to the pre-extraction output (the parity specs are
the gate). This is Phase 0 of the recompute-engine work
(`docs/superpowers/specs/2026-06-16-recompute-engine-design.md`); the live-app reactive
cascade is a later phase.
The period cascade `packages/domain/src/riparto/recomputePeriod.ts` builds on it (pure
`recomputePeriod(state) → { riparto, installments, balances }`); Phase 1b wires the generator
and the live app through it.

## Quick mental model

- **Registry:** a *studio* (firm) manages *condominiums* (buildings); each has *accounting
  periods* (usually a year); each period has *units* (apartments) and, per unit, *residents*
  (owners/tenants) drawn from the shared *master-data* (anagrafiche) registry.
- **Ledger:** every period keeps a **double-entry** general ledger — `ledgerEntry` rows carry
  a single *signed* amount; a transaction's entries sum to zero; accounts form a tree and
  balances roll up.
- **Reconciliation:** a period only shows accounting if its trial balance nets to zero;
  otherwise it ships *structure-only* (no fabricated figures).
- **Distribution (riparto):** shared expenses are allocated to units by *millesimi*
  (coefficient) tables, with multi-table percentage splits, separate estimate/consuntivo
  tables, and owner/tenant role splits — tied out to the expense totals.

Where the code lives: the offline generator that projects the dump into the app's data is in
`apps/web/tools/gen/` (pure functions, fully tested); the running app seeds from the committed
`apps/web/src/mock/data.generated.json`. See `apps/web/README.md` → "Dati reali" for
regeneration.
