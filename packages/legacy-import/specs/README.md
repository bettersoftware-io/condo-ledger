# Accounting-parity specs

Executable **Gherkin acceptance specs** (run under Vitest) that prove the new
accounting code reproduces the **legacy app's accounting behaviour**, using the legacy
database dump as the **oracle**.

The parity specs and the other dump-based tests need `old/db/it-jtime-condominium.all.sql`, which is not in the repository (set `LEGACY_DUMP_DIR` to the folder that holds it), and `old/db/leftovers.json`, the local list of extra tokens to rewrite; they are skipped without the dump.

Run them: `pnpm --filter @cl/legacy-import test` (the parity specs run with the package's unit tests; to run only the specs: `pnpm --filter @cl/legacy-import exec vitest run specs`).

Design rationale: [`docs/superpowers/specs/2026-06-14-accounting-parity-specs-design.md`](../../../docs/superpowers/specs/2026-06-14-accounting-parity-specs-design.md).
Domain background: [`docs/domain/accounting-and-distribution.md`](../../../docs/domain/accounting-and-distribution.md).

## What these tests actually exercise

**The offline generator's projection layer** (`packages/legacy-import/src/`) — *not* the prototype
UI and *not* the legacy app.

```
old/db/…all.sql   →   legacy-import/src projections         →   data.generated.json   →   React prototype renders it
 (legacy dump        (parseTables→buildDb→project*,        (committed app seed)       (the UI you click)
  = the ORACLE)        reconcile, buildRiparto)
                       ▲ the specs assert on THIS
```

The steps call the pure projections directly — `projectAccounts`, `projectTransactions`,
`reconcilePeriods`, `projectDistribution`, `buildRiparto`, `projectUnits`,
`projectInstallments`, `projectAnagrafiche`, `projectTree` — and compare their output to
values read **independently** from the dump by `oracle.ts`.

| Subject | Covered here? |
|---|---|
| Generator projections + riparto engine (the data producer) | **Yes** — asserted directly |
| The numbers the prototype **displays** | **Transitively** — these projections *are* `data.generated.json`, the prototype's seed, so asserting them asserts the data behind the screen |
| The prototype **UI** (components, routing, search, dialogs, rendering) | No — no DOM/component rendering here |
| The legacy PHP/Flex app | Not executed (it isn't runnable) — its dump is the frozen-output **oracle** we compare against |
| Recompute / mutation flows (the archived prototype's recompute code under `old/prototype-web`) | No — parity here is about the *initial legacy state*, not post-edit recomputation |

### Why this is genuine parity, not a self-test

The legacy app **stored its own computed riparto results in the ledger** (the
`ledgerTransaction.type='estimateDistribution'` postings). So the specs compare *our
engine's recomputation* against *the legacy app's own saved answer* — an independent
oracle, not our code checked against its own output. The oracles in `oracle.ts` read raw
rows through a different code path than the projections, keeping the comparison
non-circular.

Oracle strength, strongest first: (1) legacy-stored values (`estimateDistribution`
postings, `startingBalance`, `installmentItem.amount`); (2) raw-row invariants computed
in-step (Σ signed entries = 0; Σ matrix = Σ expense subtree); (3) a few clearly-labelled
pinned constants (counts).

## Layout

| Path | Role |
|---|---|
| `features/*.feature` | The durable, tool-neutral specs (6 files — see below). Double as readable documentation. |
| `gherkin/parse.ts` | Minimal Gherkin parser (Feature / Background / Scenario / Scenario Outline + Examples). |
| `gherkin/run.ts` | Step registry + runner; emits one Vitest `it()` per scenario (`runFeatureFiles`). |
| `world.ts` | Parses the 48 MB dump once (cached), builds the in-memory `Db`, resolves period labels → legacy ids. |
| `oracle.ts` | Independent legacy-value extractors (raw rows). |
| `steps.ts` | Step definitions binding the Gherkin to the generator projections + oracles. |
| `specs.test.ts` | Entry point: imports the steps, discovers every `.feature`, runs them under Vitest. |

### The six features

- **reconciliation** — the two periods with books (Saturno 2011, Pozzetto 2013) net to
  €0.00 and the reconciliation gate marks them reconciled.
- **double-entry** — every projected transaction balances; the account tree's saldo ties
  to the raw sum of entries.
- **riparto** — the distribution matrix totals tie out to the linked expense subtree;
  total per-resident *preventivo* matches the legacy `estimateDistribution` postings
  (the old engine, `buildRiparto`, the prototype seed's: its per-resident split diverges
  within one unit, so a Σ-only invariant is asserted, see the `# NOTE:` in the feature);
  and the budget allocation of the legacy algorithm (`allocationOf`, run on the
  generator's own projection of the dump) equals the posted allocation entry to the cent:
  Saturno 2011's ten residents against `tx5`, Pozzetto 2013's 25 against `tx291`, and
  A04's `r166` and `r167` against the legacy report's 898.64 and 46.63.
- **installments** — the plan's group total equals Σ legacy `installmentItem.amount`.
- **units-money** — each resident's `saldoPrec` equals the legacy
  `unitResident.startingBalance`; group rows roll up exactly.
- **anagrafiche-structure** — the registry projects every categorised party; the building
  tree applies the real selection rules (Pozzetto's NULL code renders blank, super-condo
  Sole kept, junk "test" buildings excluded).

## Designed to outlive this binding

The `.feature` files are the contract; only the step definitions know about the
generator. When the full new app exists, the **same** `.feature` files can get a second
set of step bindings (the app's store / HTTP / UI), proving parity at that layer too —
without touching the specs. Covering the prototype UI itself (component/render tests) is
a separate, not-yet-built slice.
