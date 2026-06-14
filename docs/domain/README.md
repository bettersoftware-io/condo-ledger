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
