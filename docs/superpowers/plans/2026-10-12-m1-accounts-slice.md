# M1 Accounts, Ledgers & Balance Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app shell, the Buildings sidebar and the Accounts, Ledgers & Balance screen on in-memory simulators seeded from the pseudonymised legacy data, with every node of the Pozzetto 2013 chart of accounts reconciling to the design's oracle and a budget edit round-tripping through a port command.

**Architecture:** Four ports (`SessionPort`, `BuildingsPort`, `AccountsPort`, `JournalPort`) declared in the domain with contracts and simulators; the chart-of-accounts tree and each ledger derived in the domain (`buildAccountTree`, `ledgerOf`) from raw accounts, journal entries and parties; presenters and machines in `client-core`; one hook per stream in `react-bindings`; dumb components in `client-react` on plain per-component stylesheets over the handoff's `tokens.css`. The generator in `legacy-import` emits a typed seed module into the domain's simulators folder.

**Tech Stack:** TypeScript (Node 26 type stripping), RxJS + `@rx-state/core`, React 19 + React Compiler, Vite 8, Vitest 5, Testing Library, Playwright 1.63.0 (visual goldens), `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono`, `lucide-react`.

**Spec:** `docs/superpowers/specs/2026-10-12-m1-accounts-slice-design.md` (its parent: `docs/superpowers/specs/2026-10-11-app-v2-design.md`).

**Branch:** `feat/m1-accounts`, already created off `main` (a10aad8); the spec and a timeout fix are its first two commits.

**Deviation from the spec's build order, and why:** the spec's step 1 removes the price sample from every package first. This plan removes it when its replacement lands (Task 1 for the wire protocol and server, Task 13 for the domain, core, bindings and client pieces), so no package is ever empty, every intermediate commit passes `pnpm gate:full:quiet`, and each reviewer sees the old pattern leave together with the new one. The spec's "one golden per primitive in isolation" is dropped: the visual host renders the application, not a component, and the four screen goldens of Task 17 show every primitive.

## Global Constraints

- `pnpm gate:full:quiet` passes before every commit. Run `pnpm fix` after editing any source, JSON or CSS file and before the gate.
- Every commit message ends with the two attribution lines given in the session (`Co-Authored-By: …` and `Claude-Session: …`).
- TypeScript only; named functions are `function` declarations; arrows have block bodies with `return`; every object type is a named `interface` or `type`; one import statement per module with inline `type`; deeper-than-one-folder imports use `#/`; no CommonJS.
- `packages/domain` imports nothing but `rxjs`; no Node built-in outside `packages/server`, `packages/legacy-import`, `packages/db` and tests; `react`/`react-dom` only in `react-bindings` and `client-react`; `ws` only in `server`.
- Every `*Port.ts` in `packages/domain/src/ports` has `__contracts__/<Name>PortContract.ts` exporting `describe<Name>PortContract(label, createHarness)`, the contract calls every method of the port and imports no simulator; every simulator runs its contract.
- `createApp(` is called only in `packages/client-core/src/testing/appHarness.ts`. Test ids are string literals only in `packages/client-react/src/ui/testids.ts`. Page objects are the only files that import Testing Library. No `style={{}}`; no RxJS, storage, `fetch`, environment or timers in `client-react/src/ui`. No `useMemo`, `useCallback`, `memo` in bindings or client.
- A test never sleeps: timers are fake and advanced by the exact interval. A fixture factory is named `create…`. Tests come first in a test file; helpers below.
- Coverage bar for every file: lines, statements, functions ≥ 95%, branches ≥ 85%. The generated seed module is excluded with its reason; nothing else new is excluded.
- Money is integer cents (`Cents`); the UI renders `1,234.56` (en-US); no formatting in the domain.
- The visual host fails any request leaving it: fonts are self-hosted via `@fontsource`; no Google Fonts link anywhere.
- Account names shown are the seed's own (Italian); only the five derived levels and chrome strings are English.
- Never read the dump or the oracle in a test that runs in CI: those suites use `describe.skipIf(!legacyDumpAvailable())` and `dumpSuiteName`, with `DUMP_SUITE_TIMEOUT_MS`.

## Review Focus

1. A posting whose counterpart is not in `parties`: the tree must throw naming the id, never silently drop the amount. Pinned in Task 4.
2. Budget text that is not a non-negative amount (`abc`, `1.2.3`, `-5`): the cell shows the rejection and writes nothing. Pinned in Task 17.
3. A period with no entries (every Pozzetto period but 2013): the tree is `Total` with zero amounts and the five levels, the ledger is empty with zero totals, nothing throws. Pinned in Task 9.
4. A search that matches nothing: the grid shows no rows and the panel says so; clearing the search restores the rows and their expansion. Pinned in Task 10.
5. A zero posting (the seed has 21): counts as zero in gross sums and appears in the ledger as a `0.00` line with the balance unchanged. Pinned in Task 5.

---

## File structure

**Domain (`packages/domain/src`)**
- `entities/cents.ts`, `result.ts`, `building.ts`, `account.ts`, `journal.ts`, `party.ts`, `session.ts`: the M1 vocabulary (Task 3).
- `support/must.ts`: `must(value, what)` and `listFor` (Task 2).
- `useCases/validateBudget.ts` (Task 3), `useCases/accountTree.ts` (Task 4), `useCases/ledger.ts` (Task 5).
- `ports/sessionPort.ts`, `buildingsPort.ts` (Task 7), `accountsPort.ts`, `journalPort.ts` (Task 8), each with `__contracts__/<Name>PortContract.ts`.
- `simulators/seed/legacySeed.ts` (types and loader, Task 6), `simulators/seed/legacySeed.generated.ts` (generated, Task 6), `simulators/sessionSimulator.ts`, `buildingsSimulator.ts` (Task 7), `accountsSimulator.ts`, `journalSimulator.ts` (Task 8).

**Generator (`packages/legacy-import/src`)**: `project/legacySeed.ts` (Task 6), `generate-data.ts` (second output, Task 6), `specs/oracleFixture.test.ts` (Task 14).

**Core (`packages/client-core/src`)**: `presenters/sessionPresenter.ts`, `buildingsPresenter.ts`, `accountsPresenter.ts` (Task 9); `machines/accountsGridMachine.ts`, `columnsMachine.ts`, `splitMachine.ts`, `bottomTabMachine.ts`, `maximizeMachine.ts`, `sidebarMachine.ts`, `navigationMachine.ts`, `notices.ts` (Task 10); `composition.ts`, `testing/appHarness.ts` (Task 13); `testing/fixtures/pozzetto2013.oracle.ts` and `presenters/accountsPresenter.oracle.test.ts` (Task 14).

**Bindings (`packages/react-bindings/src`)**: `createViewModel.ts` (Task 13).

**Client (`packages/client-react/src`)**: `styles/tokens.css`, `styles/fonts.css`, `index.css`, `ui/Money.tsx`, `Panel.tsx`, `Toolbar.tsx`, `TabbedPanel.tsx`, `Scheda.tsx` (Task 11); `ui/TreeGrid.tsx`, `InlineEditor.tsx` (Task 12); `ui/App.tsx`, `app/startApp.tsx`, `app/buildPorts.ts` (Task 13); `ui/shell/*` (Task 15); `ui/accounts/*` (Task 16); `tests/visual/*` (Task 17). Each component has `<Name>.css` beside it, `<Name>.page.tsx` when it has an intent, and `<Name>.test.tsx`.

---

### Task 1: The server greets; the price protocol and adapter go

**Files:**
- Modify: `packages/shared/src/protocol.ts`, `packages/shared/src/protocol.test.ts`, `packages/shared/src/index.ts`
- Modify: `packages/server/src/startServer.ts`, `packages/server/src/startServer.port.test.ts`, `packages/server/src/index.ts`
- Delete: `packages/client-core/src/adapters/wsPrice.ts`, `wsPrice.test.ts`, `wsPrice.contract.test.ts`
- Modify: `packages/client-core/src/index.ts`, `packages/client-react/src/app/buildPorts.ts`, `packages/client-react/src/app/buildPorts.test.ts`
- Modify: `packages/integration/src/priceOverWebSocket.port.test.ts` → rename to `packages/integration/src/readyOverWebSocket.port.test.ts`

**Interfaces:**
- Produces: `WS_PATH`, `interface ReadyMessage { type: "ready" }`, `type ServerMessage = ReadyMessage`, `encodeReady(): ReadyMessage`, `parseServerMessage(raw: unknown): ServerMessage | undefined` in `@cl/shared`; `startServer({ port }): Promise<RunningServer>` in `@cl/server/startServer.ts`; `createWsConnection` stays in `@cl/client-core`.

- [ ] **Step 1: Rewrite the protocol test**

Replace `packages/shared/src/protocol.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { encodeReady, parseServerMessage } from "./protocol.ts";

describe("the wire protocol", () => {
  it("encodes the greeting the server sends on connect", () => {
    expect(encodeReady()).toEqual({ type: "ready" });
  });

  it("parses the greeting back", () => {
    expect(parseServerMessage({ type: "ready" })).toEqual({ type: "ready" });
  });

  it("answers undefined for anything it does not know", () => {
    expect(parseServerMessage(null)).toBeUndefined();
    expect(parseServerMessage("ready")).toBeUndefined();
    expect(parseServerMessage({ type: "price", payload: {} })).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @cl/shared test`
Expected: FAIL, `encodeReady` is not exported.

- [ ] **Step 3: Rewrite the protocol**

`packages/shared/src/protocol.ts`:

```ts
export const WS_PATH = "/ws";

const SERVER_MSG = { READY: "ready" } as const;

/** The server's greeting: sent once to each client that connects. The nine ports arrive on this channel in M3. */
export interface ReadyMessage {
  type: typeof SERVER_MSG.READY;
}

export type ServerMessage = ReadyMessage;

export function encodeReady(): ReadyMessage {
  return { type: SERVER_MSG.READY };
}

/** The message, if `raw` is one this protocol knows; otherwise undefined. */
export function parseServerMessage(raw: unknown): ServerMessage | undefined {
  if (!isRecord(raw) || raw.type !== SERVER_MSG.READY) {
    return undefined;
  }

  return { type: SERVER_MSG.READY };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
```

`packages/shared/src/index.ts`: export `encodeReady, parseServerMessage, WS_PATH` and the types `ReadyMessage, ServerMessage`.

- [ ] **Step 4: Rewrite the server**

`packages/server/src/startServer.ts`: remove the `prices` option and the `share()` feed; on `connection` send `JSON.stringify(encodeReady())` once; keep the `error` listener, the `close` of clients and the listening promise exactly as they are. `ServerOptions` becomes `{ port: number }`. `packages/server/src/index.ts` calls `startServer({ port: Number(process.env.PORT ?? 4000) })`.

Rewrite `startServer.port.test.ts` so its tests are: "greets a client that connects" (open a raw `ws` `WebSocket` to `ws://127.0.0.1:${port}${WS_PATH}`, await the first message, expect `JSON.parse(data)` to equal `{ type: "ready" }`), "greets each client once" (two clients, each gets exactly one message within one macrotask: collect messages, close, assert lengths 1 and 1), "closes every client when it closes" (client's `close` event fires after `server.close()`), "picks a free port when asked for 0" (port > 0). Keep the file's existing helpers for opening a raw socket and waiting for `open`/`message`/`close` events; they already exist there, adapt their names only.

- [ ] **Step 5: Drop the price adapter from core and the live branch from buildPorts**

Delete the three `wsPrice*` files. In `packages/client-core/src/index.ts` remove the `createWsPricePort` export. In `packages/client-react/src/app/buildPorts.ts`, the live branch becomes:

```ts
if (serverUrl) {
  throw new Error(`a server URL is set (${serverUrl}) but the server's ports arrive in M3`);
}
```

keep the simulator branch unchanged for now (the price simulator; it goes in Task 13). In `buildPorts.test.ts` replace the "connects to the server" test with `expect(() => buildPorts("ws://example.test/ws")).toThrow(/M3/)` and drop the fake-socket import. Then `grep -rn fakeWebSocket packages`: if only `wsConnection.test.ts` still imports `testing/fakeWebSocket.ts`, keep it; if nothing does, delete it in this task (knip reports an unimported test helper).

- [ ] **Step 6: Rewrite the integration test**

`git mv packages/integration/src/priceOverWebSocket.port.test.ts packages/integration/src/readyOverWebSocket.port.test.ts`, content:

```ts
import { firstValueFrom, timeout } from "rxjs";
import { describe, expect, it, onTestFinished } from "vitest";

import { createWsConnection } from "@cl/client-core";
import { startServer } from "@cl/server/startServer.ts";
import { parseServerMessage, WS_PATH } from "@cl/shared";

// The client's connection adapter against the real server over a real socket:
// the one thing only this package may test. Each side's own tests stay with it.
describe("the client's connection against the real server", () => {
  it("receives the server's greeting, decoded by the shared protocol", async () => {
    const server = await startServer({ port: 0 });
    onTestFinished(server.close);
    const connection = createWsConnection(`ws://127.0.0.1:${server.port}${WS_PATH}`);

    const first = await firstValueFrom(connection.messages().pipe(timeout(GIVE_UP_AFTER_MS)));

    expect(parseServerMessage(first)).toEqual({ type: "ready" });
  });
});

// A deadline for the one wait that has no event to wait on.
const GIVE_UP_AFTER_MS = 2000;
```

- [ ] **Step 7: Fix, gate, commit**

Run `pnpm fix`, then `pnpm gate:full:quiet`. Expected: `gate:full passed`. The `port-contracts` gate must not complain: no adapter folder implements a port now (`packages/client-core/src/adapters` holds only `wsConnection`, which implements no domain port).

```bash
git add -A packages/shared packages/server packages/client-core packages/client-react packages/integration
git commit -m "feat(server): the server greets; the price protocol and adapter go

The sample's price feed leaves the wire, the server and the client's
adapter folder. One message stays, the greeting on connect, so the
protocol package, the connection adapter and the integration test keep
proving the two ends agree until the ports arrive in M3."
```

(append the attribution lines; the same applies to every commit below).

---

### Task 2: Housekeeping carried from M0

**Files:**
- Create: `packages/domain/src/support/must.ts`, `packages/domain/src/support/must.test.ts`
- Delete: `packages/domain/src/useCases/must.ts`, `packages/domain/src/useCases/must.test.ts`
- Modify: every importer of `must.ts` (run `grep -rn "must.ts" packages --include=*.ts` to list them; today: `packages/domain/src/simulators/priceSimulator.ts`, `packages/domain/src/useCases/riparto/*.ts`)
- Modify: `packages/domain/src/useCases/riparto/computeRiparto.ts`, `computeRiparto.test.ts`
- Create: `packages/legacy-import/turbo.json`

**Interfaces:**
- Produces: `must<T>(value: T | undefined | null, what: string): T` (throws `Error(\`missing: ${what}\`)`), `listFor<K, V>(map: Map<K, V[]>, key: K): V[]`, both exported from `#/support/must.ts` (not from the index).

- [ ] **Step 1: Write the failing tests**

`packages/domain/src/support/must.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { listFor, must } from "./must.ts";

describe("must", () => {
  it("returns a present value", () => {
    expect(must(3, "the count")).toBe(3);
  });

  it("throws naming what was missing, for undefined and for null", () => {
    expect(() => {
      return must(undefined, "the account la1");
    }).toThrow("missing: the account la1");
    expect(() => {
      return must(null, "the period");
    }).toThrow("missing: the period");
  });
});

describe("listFor", () => {
  it("returns the list under a key, creating it when absent", () => {
    const map = new Map<string, number[]>();

    listFor(map, "a").push(1);
    listFor(map, "a").push(2);

    expect(map.get("a")).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm --filter @cl/domain test -- support`
Expected: FAIL, module not found.

- [ ] **Step 3: Move and rewrite `must`**

`packages/domain/src/support/must.ts`:

```ts
/** The value, or an error that says what was missing. For lookups that the data guarantees. */
export function must<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) {
    throw new Error(`missing: ${what}`);
  }

  return value;
}

/** The list under `key`, created empty when absent. */
export function listFor<K, V>(map: Map<K, V[]>, key: K): V[] {
  const existing = map.get(key);

  if (existing !== undefined) {
    return existing;
  }

  const created: V[] = [];
  map.set(key, created);

  return created;
}
```

Delete the old files. Update every importer to `#/support/must.ts` (or `../support/must.ts` from one folder down) and give each call a `what`, in the words of the lookup (`"the account ${id}"`, `"the table ${tableId}"`).

- [ ] **Step 4: `subtree(unknownId)` throws, with a test**

In `computeRiparto.ts`, where `subtree(accountId)` looks the account up, wrap the lookup in `must(…, \`the account ${accountId}\`)` if it does not already. Add to `computeRiparto.test.ts`:

```ts
it("subtree throws for an account the input does not have", () => {
  const engine = buildRiparto(createMinimalInput());

  expect(() => {
    return engine.subtree("nope");
  }).toThrow("missing: the account nope");
});
```

using the test file's existing smallest fixture factory (rename it to `createMinimalInput` if it has a bare-noun name).

- [ ] **Step 5: Turbo: the dump is an input of the generator's tests**

Read `node -p "require.resolve('turbo/package.json')"` from the repo root, then that package's `docs/README.md` and its page on package configurations and `inputs`. Create `packages/legacy-import/turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "extends": ["//"],
  "tasks": {
    "test": {
      "cache": false
    }
  }
}
```

with a comment-free file (JSON) and this explanation in the commit message: Turbo inputs are resolved inside the package and cannot name `../../old/db`, which the dump suites read, so a cached pass could survive a changed dump; the package's tests are therefore never cached. If the installed docs show that `inputs` may name a path outside the package in this version, use `"inputs": ["$TURBO_DEFAULT$", "../../old/db/*.sql", "../../old/db/leftovers.json"]` instead and say so in the commit message.

- [ ] **Step 6: Fix, gate, commit**

`pnpm fix && pnpm gate:full:quiet` → green.

```bash
git add -A packages/domain packages/legacy-import
git commit -m "chore(domain): must(value, what) in support/; subtree(unknownId) throws; the generator's tests are not cached"
```

---

### Task 3: The M1 entities, the result type and the budget rule

**Files:**
- Create: `packages/domain/src/entities/cents.ts`, `cents.test.ts`, `result.ts`, `building.ts`, `account.ts`, `journal.ts`, `party.ts`, `session.ts`
- Create: `packages/domain/src/useCases/validateBudget.ts`, `validateBudget.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Produces (all exported from `@cl/domain`):

```ts
// entities/cents.ts
export type Cents = number & { readonly __brand: "Cents" };
export function cents(value: number): Cents;          // throws "not an integer amount of cents: <value>" otherwise
export function addCents(a: Cents, b: Cents): Cents;
export function subtractCents(a: Cents, b: Cents): Cents;
export const ZERO_CENTS: Cents;

// entities/result.ts
export interface Ok { readonly ok: true; }
export interface Rejected { readonly ok: false; readonly reason: string; }
export type Result = Ok | Rejected;
export function ok(): Ok;
export function rejected(reason: string): Rejected;

// entities/building.ts
export type PeriodType = "ordinary" | "extra" | "auxiliary";
export interface Period { id: string; name: string; type: PeriodType; start: string; end: string; closed: boolean; }
export interface Building { id: string; name: string; periods: Period[]; }

// entities/account.ts
export type AccountNature = "assets" | "liabilities" | "assetsOrLiabilities" | "income" | "expenses";
export type AccountType = "grouping" | "regular" | "control" | "controlUnitResident";
export type AccountRole = "cash" | "bank" | "suppliers" | "owners" | "roundings" | "tax";
export interface Account { id: string; periodId: string; parentId: string | null; name: string; order: number;
                           nature: AccountNature; type: AccountType; role: AccountRole | null; budget: Cents | null; }

// entities/journal.ts
export type Counterpart = { kind: "supplier"; id: string } | { kind: "owner"; id: string };
export interface Posting { accountId: string; debit: Cents; credit: Cents; counterpart: Counterpart | null; }
export interface JournalEntry { id: string; periodId: string; number: number; at: string; description: string; postings: Posting[]; }

// entities/party.ts
export interface SupplierParty { kind: "supplier"; id: string; name: string; }
export interface OwnerParty { kind: "owner"; id: string; personId: string; name: string; unitCode: string; }
export type Party = SupplierParty | OwnerParty;

// entities/session.ts
export type Role = "administrator" | "owner";
export interface Principal { username: string; displayName: string; role: Role; }
export interface Firm { name: string; }
export type Mode = "light" | "dark";
export type Theme = "slate" | "carbon" | "sage";
export type Language = "en" | "it" | "fr" | "de" | "es";
export interface Preferences { mode: Mode; theme: Theme; language: Language; }
export const DEFAULT_PREFERENCES: Preferences;   // slate, light, en

// useCases/validateBudget.ts
export function validateBudget(account: Account, budget: Cents): Result;
```

- [ ] **Step 1: Write the failing tests**

`packages/domain/src/entities/cents.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { addCents, cents, subtractCents, ZERO_CENTS } from "./cents.ts";

describe("cents", () => {
  it("accepts an integer, negative included", () => {
    expect(cents(12345)).toBe(12345);
    expect(cents(-7)).toBe(-7);
    expect(ZERO_CENTS).toBe(0);
  });

  it("refuses a fraction and a non-finite number", () => {
    expect(() => {
      return cents(1.5);
    }).toThrow("not an integer amount of cents: 1.5");
    expect(() => {
      return cents(Number.NaN);
    }).toThrow("not an integer amount of cents: NaN");
  });

  it("adds and subtracts", () => {
    expect(addCents(cents(100), cents(-30))).toBe(70);
    expect(subtractCents(cents(100), cents(30))).toBe(70);
  });
});
```

`packages/domain/src/useCases/validateBudget.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { type Account, cents } from "../index.ts";
import { validateBudget } from "./validateBudget.ts";

describe("validateBudget", () => {
  it("accepts a non-negative budget on a regular expense account", () => {
    expect(validateBudget(createAccount({}), cents(0))).toEqual({ ok: true });
    expect(validateBudget(createAccount({}), cents(216500))).toEqual({ ok: true });
  });

  it("rejects a negative budget", () => {
    expect(validateBudget(createAccount({}), cents(-1))).toEqual({ ok: false, reason: "negative" });
  });

  it("rejects an account that is not a cost account", () => {
    expect(validateBudget(createAccount({ nature: "assets" }), cents(1))).toEqual({
      ok: false,
      reason: "not-a-cost-account",
    });
  });

  it("rejects a grouping, which has no budget of its own", () => {
    expect(validateBudget(createAccount({ type: "grouping" }), cents(1))).toEqual({
      ok: false,
      reason: "not-a-leaf",
    });
  });
});

function createAccount(overrides: Partial<Account>): Account {
  return {
    id: "la1",
    periodId: "p1",
    parentId: null,
    name: "Ascensore",
    order: 1,
    nature: "expenses",
    type: "regular",
    role: null,
    budget: null,
    ...overrides,
  };
}
```

- [ ] **Step 2: Run to see them fail**

Run: `pnpm --filter @cl/domain test -- cents validateBudget`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write the entities**

`entities/cents.ts`:

```ts
/** An amount of money in integer minor units. Formatting is the UI's. */
export type Cents = number & { readonly __brand: "Cents" };

export function cents(value: number): Cents {
  if (!Number.isInteger(value)) {
    throw new Error(`not an integer amount of cents: ${value}`);
  }

  return value as Cents;
}

export const ZERO_CENTS: Cents = cents(0);

export function addCents(a: Cents, b: Cents): Cents {
  return cents(a + b);
}

export function subtractCents(a: Cents, b: Cents): Cents {
  return cents(a - b);
}
```

`entities/result.ts`:

```ts
/** What a command answers: done, or refused for a reason the domain names. */
export interface Ok {
  readonly ok: true;
}

export interface Rejected {
  readonly ok: false;
  readonly reason: string;
}

export type Result = Ok | Rejected;

export function ok(): Ok {
  return { ok: true };
}

export function rejected(reason: string): Rejected {
  return { ok: false, reason };
}
```

`entities/building.ts`, `account.ts`, `journal.ts`, `party.ts`, `session.ts`: exactly the interfaces in this task's **Interfaces** block, each with a one-line doc comment saying what it is in the design's words (a Building is a condominium with its accounting periods; an Account is one line of a period's chart of accounts; a Posting is one line of a journal entry; a Party is who a control account's posting is with; the session is who is signed in, for which firm, with which display preferences). `DEFAULT_PREFERENCES = { mode: "light", theme: "slate", language: "en" }`.

`useCases/validateBudget.ts`:

```ts
import type { Account } from "../entities/account.ts";
import type { Cents } from "../entities/cents.ts";
import { ok, rejected, type Result } from "../entities/result.ts";

/** A budget belongs to a leaf cost account and is never negative. */
export function validateBudget(account: Account, budget: Cents): Result {
  if (account.nature !== "expenses") {
    return rejected("not-a-cost-account");
  }

  if (account.type === "grouping") {
    return rejected("not-a-leaf");
  }

  if (budget < 0) {
    return rejected("negative");
  }

  return ok();
}
```

Add to `packages/domain/src/index.ts`: `export * from` each new entities file and `validateBudget.ts`.

- [ ] **Step 4: Run tests, fix, gate, commit**

Run `pnpm --filter @cl/domain test` → all pass. `pnpm fix && pnpm gate:full:quiet` → green (knip: every new export is used by a test or by `index.ts`; the index re-exports count as used only once another package imports them, so if `lint:dead` reports an unused export in the index, leave the export and note it: Tasks 7–9 import them. If the gate stays red on that, mark nothing as ignored; instead move the `index.ts` re-exports for the not-yet-consumed files to the task that consumes them, and say so in the commit message).

```bash
git add packages/domain
git commit -m "feat(domain): the M1 entities, Cents, Result and the budget rule"
```

---

### Task 4: `buildAccountTree`

**Files:**
- Create: `packages/domain/src/useCases/accountTree.ts`, `accountTree.test.ts`
- Create: `packages/domain/src/testing/createSmallBooks.ts` (a fixture factory shared by Tasks 4, 5, 8, 9, 10; test-only, under `testing/`)
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Consumes: Task 3's entities.
- Produces:

```ts
export type NodeIcon = "folder" | "document" | "cash" | "bank" | "suppliers" | "owners" | "roundings" | "tax";
export type PostingScope =
  | { kind: "account"; accountId: string }
  | { kind: "supplier"; accountId: string; supplierId: string }
  | { kind: "residency"; accountId: string; residentId: string };
export interface AccountNode {
  key: string;                 // deterministic, never shown
  label: string;
  accountId: string | null;    // null for total and the five levels
  nature: AccountNature | null;
  icon: NodeIcon;
  debit: Cents; credit: Cents; balance: Cents; budget: Cents | null;
  scope: PostingScope | null;  // leaves that own postings; null on every node with children and on the five levels
  children: AccountNode[];
}
export const ROOT_KEY = "total";
export const LEVEL_LABELS = { patrimonial: "Patrimonial", assets: "(Assets)", liabilities: "(Liabilities)", costs: "Costs", revenue: "Revenue" } as const;
export function buildAccountTree(accounts: Account[], entries: JournalEntry[], parties: Party[]): AccountNode;
export function findNode(root: AccountNode, key: string): AccountNode | undefined;
export function createSmallBooks(): SmallBooks;   // testing/createSmallBooks.ts
```

`SmallBooks` is `{ periodId: "p1"; accounts: Account[]; entries: JournalEntry[]; parties: Party[] }` describing one period with: cash `la1` (assets, regular, role cash) under grouping `la10` "Liquidità" (assets); bank `la2` (assets, regular, role bank) under `la10`; funds `la3` (liabilities, regular); suppliers control `la4` (assetsOrLiabilities, control, role suppliers); owners control `la5` (assetsOrLiabilities, controlUnitResident, role owners); roundings `la6` (assetsOrLiabilities, controlUnitResident, role roundings); cost grouping `la20` "Spese generali" (expenses, grouping) with leaves `la21` "Ascensore" (budget 100000) and `la22` "Pulizie" (budget 50000); individual expenses `la23` (expenses, controlUnitResident, budget null); revenue `la30` "Da condòmini" (income, regular). Parties: suppliers `md1` "Alfa s.n.c.", `md2` "Beta S.p.A."; owners `r1` (person `md10` "Rossi Mario", unit "A01"), `r2` (person `md10`, unit "A02"), `r3` (person `md11` "Bianchi Anna", unit "B01"). Entries (`at` ISO date-times, `number` 1..):
1. `2013-01-10T10:00:00` "Fattura Alfa": la21 debit 36018; la4 credit 36018 counterpart supplier md1.
2. `2013-01-15T10:00:00` "Fattura Beta": la22 debit 20000; la4 credit 20000 counterpart supplier md2.
3. `2013-02-01T10:00:00` "Pagamento Beta": la4 debit 20000 counterpart supplier md2; la2 credit 20000 (Beta ends at 0 → assets side; Alfa stays at -36018 → liabilities side).
4. `2013-02-10T10:00:00` "Riparto": la5 debit 60000 counterpart owner r1; la5 debit 10000 counterpart owner r2; la5 debit 30000 counterpart owner r3; la30 credit 100000.
5. `2013-03-01T10:00:00` "Incasso Bianchi": la1 debit 35000; la5 credit 35000 counterpart owner r3 (Bianchi ends at -5000 → liabilities side; Rossi at 70000 → assets side).
6. `2013-03-05T10:00:00` "Arrotondamento": la6 debit 1 counterpart owner r1; la1 credit 1 → roundings has one row, r1 at +1, on the assets side only.
7. `2013-03-06T10:00:00` "Spesa individuale": la23 debit 1500 counterpart owner r2; la5 credit 1500 counterpart owner r2.
8. `2013-03-07T10:00:00` "Movimento nullo": la1 debit 0; la2 credit 0 (a zero posting on each).
9. `2013-01-05T10:00:00` "Fuori ordine": la1 debit 100; la30 credit 100 (a later number with an earlier date: the ledger orders by date first).

- [ ] **Step 1: Write the fixture factory**

`packages/domain/src/testing/createSmallBooks.ts` builds exactly the data above with `cents()`; export `interface SmallBooks` and `createSmallBooks()`. Give the account a `periodId: "p1"` and every entry `periodId: "p1"`. Note the `testing/` folder is test-only by the gates' rule, so it may be imported by tests of any package.

- [ ] **Step 2: Write the failing tests**

`packages/domain/src/useCases/accountTree.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { createSmallBooks } from "../testing/createSmallBooks.ts";
import { type AccountNode, buildAccountTree, findNode, ROOT_KEY } from "./accountTree.ts";

describe("buildAccountTree", () => {
  it("roots the tree at Total with the five levels in the report's order", () => {
    const root = build();

    expect(root.key).toBe(ROOT_KEY);
    expect(root.label).toBe("Total");
    expect(root.children.map(keyOf)).toEqual(["patrimonial", "costs", "revenue"]);
    expect(must("patrimonial").children.map(keyOf)).toEqual(["assets", "liabilities"]);
  });

  it("sums gross debit and credit up every level, and balance is debit minus credit", () => {
    const root = build();

    expect([root.debit, root.credit, root.balance]).toEqual([212619, 212619, 0]);
    expect(must("la10")).toMatchObject({ debit: 35100, credit: 20001, balance: 15099 });
    expect(must("costs")).toMatchObject({ debit: 57518, credit: 0, balance: 57518 });
    expect(must("revenue")).toMatchObject({ debit: 0, credit: 100100, balance: -100100 });
  });

  it("places pure-nature accounts first, then the control accounts, in legacy order on each side", () => {
    expect(must("assets").children.map(keyOf)).toEqual(["la10", "la4@assets", "la5@assets", "la6@assets"]);
    expect(must("liabilities").children.map(keyOf)).toEqual(["la3", "la4@liabilities", "la5@liabilities"]);
  });

  it("splits a supplier control account per supplier by the sign of each balance; zero goes to assets", () => {
    const assets = must("la4@assets");
    const liabilities = must("la4@liabilities");

    expect(assets.children.map(keyOf)).toEqual(["la4@assets/md2"]);
    expect(assets.children[0]).toMatchObject({ label: "Beta S.p.A.", debit: 20000, credit: 20000, balance: 0 });
    expect(assets.children[0]?.scope).toEqual({ kind: "supplier", accountId: "la4", supplierId: "md2" });
    expect(liabilities.children.map(keyOf)).toEqual(["la4@liabilities/md1"]);
    expect(liabilities.children[0]).toMatchObject({ label: "Alfa s.n.c.", debit: 0, credit: 36018, balance: -36018 });
  });

  it("omits a side that has no row", () => {
    expect(must("la6@assets").children.map(keyOf)).toEqual(["la6@assets/md10"]);
    expect(findNode(build(), "la6@liabilities")).toBeUndefined();
  });

  it("groups an owner control account per person, then per residency, sides by the person's sum", () => {
    const rossi = must("la5@assets/md10");

    expect(rossi.label).toBe("Rossi Mario");
    expect(rossi.children.map((node) => { return [node.key, node.label, node.balance]; })).toEqual([
      ["la5@assets/md10/r1", "A01", 60000],
      ["la5@assets/md10/r2", "A02", 8500],
    ]);
    expect(rossi.balance).toBe(68500);
    expect(must("la5@liabilities").children.map(keyOf)).toEqual(["la5@liabilities/md11"]);
    expect(must("la5@liabilities/md11").balance).toBe(-5000);
  });

  it("groups individual expenses per person under costs, with no sides", () => {
    expect(must("costs").children.map(keyOf)).toEqual(["la20", "la23"]);
    expect(must("la23").children.map(keyOf)).toEqual(["la23/md10"]);
    expect(must("la23/md10/r2")).toMatchObject({ label: "A02", debit: 1500 });
  });

  it("rolls budgets up from the leaves and leaves null where no leaf has one", () => {
    expect(must("la20").budget).toBe(150000);
    expect(must("costs").budget).toBe(150000);
    expect(must("la23").budget).toBeNull();
    expect(must("assets").budget).toBeNull();
  });

  it("picks the icon from the role, else folder for a node with children, else document", () => {
    expect(must("la1").icon).toBe("cash");
    expect(must("la2").icon).toBe("bank");
    expect(must("la4@assets").icon).toBe("suppliers");
    expect(must("la5@assets").icon).toBe("owners");
    expect(must("la6@assets").icon).toBe("roundings");
    expect(must("la10").icon).toBe("folder");
    expect(must("la21").icon).toBe("document");
    expect(must("patrimonial").icon).toBe("folder");
  });

  it("gives a plain leaf an account scope and a node with children none", () => {
    expect(must("la21").scope).toEqual({ kind: "account", accountId: "la21" });
    expect(must("la20").scope).toBeNull();
    expect(must("la5@assets/md10/r1").scope).toEqual({ kind: "residency", accountId: "la5", residentId: "r1" });
  });

  it("counts a zero posting as zero", () => {
    expect(must("la1")).toMatchObject({ debit: 35100, credit: 1, balance: 35099 });
    expect(must("la2")).toMatchObject({ debit: 0, credit: 20000, balance: -20000 });
  });

  it("throws, naming the id, for a posting whose counterpart is not a party", () => {
    const books = createSmallBooks();
    books.entries[0]?.postings.push({ accountId: "la4", debit: 0 as never, credit: 0 as never, counterpart: { kind: "supplier", id: "md99" } });

    expect(() => {
      return buildAccountTree(books.accounts, books.entries, books.parties);
    }).toThrow("missing: the supplier md99");
  });

  it("throws for a posting on an account the period does not have", () => {
    const books = createSmallBooks();
    books.entries[0]?.postings.push({ accountId: "la77", debit: 0 as never, credit: 0 as never, counterpart: null });

    expect(() => {
      return buildAccountTree(books.accounts, books.entries, books.parties);
    }).toThrow("missing: the account la77");
  });
});

function build(): AccountNode {
  const books = createSmallBooks();
  return buildAccountTree(books.accounts, books.entries, books.parties);
}

function must(key: string): AccountNode {
  const node = findNode(build(), key);

  if (node === undefined) {
    throw new Error(`no node ${key}`);
  }

  return node;
}

function keyOf(node: AccountNode): string {
  return node.key;
}
```

The figures, from the fixture: total debit = 36018 + 20000 + 20000 + (60000 + 10000 + 30000) + 35000 + 1 + 1500 + 0 + 100 = 212619, and the credits sum to the same. `la1` (cash): debit 35000 (entry 5) + 0 (entry 8) + 100 (entry 9), credit 1 (entry 6). `la2` (bank): credit 20000 (entry 3) + 0 (entry 8). `la10` = la1 + la2: debit 35100, credit 20001, balance 15099. `revenue` = la30: credit 100000 (entry 4) + 100 (entry 9). `costs` = la21 36018 + la22 20000 + la23 1500 = 57518. Rossi (md10): r1 60000, r2 10000 − 1500 = 8500, sum 68500 → assets. Bianchi (md11): r3 30000 − 35000 = −5000 → liabilities.

- [ ] **Step 3: Run to see them fail**

Run: `pnpm --filter @cl/domain test -- accountTree`
Expected: FAIL, module not found.

- [ ] **Step 4: Implement**

`packages/domain/src/useCases/accountTree.ts`:

```ts
import { type Account, type AccountNature } from "../entities/account.ts";
import { addCents, type Cents, subtractCents, ZERO_CENTS } from "../entities/cents.ts";
import type { JournalEntry, Posting } from "../entities/journal.ts";
import type { OwnerParty, Party, SupplierParty } from "../entities/party.ts";
import { listFor, must } from "../support/must.ts";

export type NodeIcon =
  | "folder"
  | "document"
  | "cash"
  | "bank"
  | "suppliers"
  | "owners"
  | "roundings"
  | "tax";

export type PostingScope =
  | { kind: "account"; accountId: string }
  | { kind: "supplier"; accountId: string; supplierId: string }
  | { kind: "residency"; accountId: string; residentId: string };

/** One row of the Accounts screen's tree, with everything the screen shows already decided. */
export interface AccountNode {
  key: string;
  label: string;
  accountId: string | null;
  nature: AccountNature | null;
  icon: NodeIcon;
  debit: Cents;
  credit: Cents;
  balance: Cents;
  budget: Cents | null;
  scope: PostingScope | null;
  children: AccountNode[];
}

export const ROOT_KEY = "total";

export const LEVEL_LABELS = {
  patrimonial: "Patrimonial",
  assets: "(Assets)",
  liabilities: "(Liabilities)",
  costs: "Costs",
  revenue: "Revenue",
} as const;

type Side = "assets" | "liabilities";

interface Sums {
  debit: Cents;
  credit: Cents;
}

/** Everything indexed once, so the walk below is plain lookups. */
interface Books {
  byId: Map<string, Account>;
  childrenOf: Map<string, Account[]>;
  postingsOf: Map<string, Posting[]>;
  suppliers: Map<string, SupplierParty>;
  owners: Map<string, OwnerParty>;
}

/**
 * The legacy report's chart of accounts for one period: Total over
 * Patrimonial (Assets, Liabilities), Costs and Revenue; every amount the gross
 * sum of the postings beneath; a control account split per supplier or per
 * person and residency, each on the side its balance has.
 */
export function buildAccountTree(
  accounts: Account[],
  entries: JournalEntry[],
  parties: Party[],
): AccountNode {
  const books = index(accounts, entries, parties);
  const roots = ordered(
    accounts.filter((account) => {
      return account.parentId === null;
    }),
  );
  const assets = level("assets", LEVEL_LABELS.assets, "assets", sideNodes(books, roots, "assets"));
  const liabilities = level(
    "liabilities",
    LEVEL_LABELS.liabilities,
    "liabilities",
    sideNodes(books, roots, "liabilities"),
  );
  const patrimonial = level("patrimonial", LEVEL_LABELS.patrimonial, null, [assets, liabilities]);
  const costs = level("costs", LEVEL_LABELS.costs, "expenses", natureNodes(books, roots, "expenses"));
  const revenue = level("revenue", LEVEL_LABELS.revenue, "income", natureNodes(books, roots, "income"));

  return level(ROOT_KEY, "Total", null, [patrimonial, costs, revenue]);
}

/** The node with this key, anywhere under `root`. */
export function findNode(root: AccountNode, key: string): AccountNode | undefined {
  if (root.key === key) {
    return root;
  }

  for (const child of root.children) {
    const found = findNode(child, key);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

function index(accounts: Account[], entries: JournalEntry[], parties: Party[]): Books {
  const byId = new Map(
    accounts.map((account) => {
      return [account.id, account];
    }),
  );
  const childrenOf = new Map<string, Account[]>();
  const postingsOf = new Map<string, Posting[]>();
  const suppliers = new Map<string, SupplierParty>();
  const owners = new Map<string, OwnerParty>();

  for (const account of accounts) {
    if (account.parentId !== null) {
      listFor(childrenOf, account.parentId).push(account);
    }
  }

  for (const entry of entries) {
    for (const posting of entry.postings) {
      must(byId.get(posting.accountId), `the account ${posting.accountId}`);
      listFor(postingsOf, posting.accountId).push(posting);
    }
  }

  for (const party of parties) {
    if (party.kind === "supplier") {
      suppliers.set(party.id, party);
    } else {
      owners.set(party.id, party);
    }
  }

  return { byId, childrenOf, postingsOf, suppliers, owners };
}

/** Pure-nature accounts of this side first, then the control accounts, each in legacy order. */
function sideNodes(books: Books, roots: Account[], side: Side): AccountNode[] {
  const pure = roots
    .filter((account) => {
      return account.nature === side;
    })
    .map((account) => {
      return accountNode(books, account, null);
    });
  const controls = roots
    .filter((account) => {
      return account.nature === "assetsOrLiabilities";
    })
    .map((account) => {
      return controlNode(books, account, side);
    })
    .filter((node) => {
      return node !== undefined;
    });

  return [...pure, ...controls];
}

/** Costs or revenue: pure accounts first, then the per-person control accounts, in legacy order. */
function natureNodes(books: Books, roots: Account[], nature: "expenses" | "income"): AccountNode[] {
  const ofNature = roots.filter((account) => {
    return account.nature === nature;
  });
  const pure = ofNature
    .filter((account) => {
      return account.type === "regular" || account.type === "grouping";
    })
    .map((account) => {
      return accountNode(books, account, null);
    });
  const controls = ofNature
    .filter((account) => {
      return account.type === "control" || account.type === "controlUnitResident";
    })
    .map((account) => {
      return must(controlNode(books, account, null), `the control account ${account.id}`);
    });

  return [...pure, ...controls];
}

/** A plain account: its own postings plus its children's, in legacy order. */
function accountNode(books: Books, account: Account, side: Side | null): AccountNode {
  const children = ordered(books.childrenOf.get(account.id) ?? []).map((child) => {
    return accountNode(books, child, side);
  });
  const own = sumOf(books.postingsOf.get(account.id) ?? []);
  const sums = children.reduce(addSums, own);
  const key = side === null ? account.id : `${account.id}@${side}`;

  return node({
    key,
    label: account.name,
    accountId: account.id,
    nature: account.nature,
    icon: iconOf(account, children.length > 0),
    sums,
    budget: children.length === 0 ? account.budget : rollUp(children),
    scope: children.length === 0 ? { kind: "account", accountId: account.id } : null,
    children,
  });
}

/**
 * A control account on one side (or on no side, for individual expenses):
 * one row per supplier, or one per person holding one per residency. On a
 * side, only the rows whose balance has that sign; undefined when none has.
 */
function controlNode(books: Books, account: Account, side: Side | null): AccountNode | undefined {
  const key = side === null ? account.id : `${account.id}@${side}`;
  const rows =
    account.type === "control"
      ? supplierRows(books, account, key)
      : personRows(books, account, key);
  const onSide = rows.filter((row) => {
    return side === null || sideOf(row.balance) === side;
  });

  if (side !== null && onSide.length === 0) {
    return undefined;
  }

  return node({
    key,
    label: account.name,
    accountId: account.id,
    nature: account.nature,
    icon: iconOf(account, true),
    sums: onSide.reduce(addSums, zeroSums()),
    budget: account.budget,
    scope: null,
    children: onSide,
  });
}

function supplierRows(books: Books, account: Account, parentKey: string): AccountNode[] {
  const byCounterpart = new Map<string, Posting[]>();

  for (const posting of books.postingsOf.get(account.id) ?? []) {
    listFor(byCounterpart, counterpartId(posting)).push(posting);
  }

  return [...byCounterpart.entries()]
    .map(([supplierId, postings]) => {
      const label = supplierId === NONE ? NO_COUNTERPART : must(books.suppliers.get(supplierId), `the supplier ${supplierId}`).name;

      return node({
        key: `${parentKey}/${supplierId}`,
        label,
        accountId: account.id,
        nature: account.nature,
        icon: "document",
        sums: sumOf(postings),
        budget: null,
        scope: { kind: "supplier", accountId: account.id, supplierId },
        children: [],
      });
    })
    .sort(byLabel);
}

function personRows(books: Books, account: Account, parentKey: string): AccountNode[] {
  const byResidency = new Map<string, Posting[]>();

  for (const posting of books.postingsOf.get(account.id) ?? []) {
    listFor(byResidency, counterpartId(posting)).push(posting);
  }

  const byPerson = new Map<string, AccountNode[]>();
  const personNames = new Map<string, string>();

  for (const [residentId, postings] of byResidency) {
    const owner = residentId === NONE ? undefined : must(books.owners.get(residentId), `the owner ${residentId}`);
    const personId = owner?.personId ?? NONE;
    personNames.set(personId, owner?.name ?? NO_COUNTERPART);
    listFor(byPerson, personId).push(
      node({
        key: `${parentKey}/${personId}/${residentId}`,
        label: owner?.unitCode ?? NO_COUNTERPART,
        accountId: account.id,
        nature: account.nature,
        icon: "document",
        sums: sumOf(postings),
        budget: null,
        scope: { kind: "residency", accountId: account.id, residentId },
        children: [],
      }),
    );
  }

  return [...byPerson.entries()]
    .map(([personId, residencies]) => {
      const children = residencies.slice().sort(byLabel);

      return node({
        key: `${parentKey}/${personId}`,
        label: must(personNames.get(personId), `the person ${personId}`),
        accountId: account.id,
        nature: account.nature,
        icon: "folder",
        sums: children.reduce(addSums, zeroSums()),
        budget: null,
        scope: null,
        children,
      });
    })
    .sort(byLabel);
}

function level(key: string, label: string, nature: AccountNature | null, children: AccountNode[]): AccountNode {
  return node({
    key,
    label,
    accountId: null,
    nature,
    icon: "folder",
    sums: children.reduce(addSums, zeroSums()),
    budget: rollUp(children),
    scope: null,
    children,
  });
}

interface NodeParts {
  key: string;
  label: string;
  accountId: string | null;
  nature: AccountNature | null;
  icon: NodeIcon;
  sums: Sums;
  budget: Cents | null;
  scope: PostingScope | null;
  children: AccountNode[];
}

function node(parts: NodeParts): AccountNode {
  const { sums, ...rest } = parts;

  return { ...rest, debit: sums.debit, credit: sums.credit, balance: subtractCents(sums.debit, sums.credit) };
}

const NONE = "none";
const NO_COUNTERPART = "(no counterpart)";

function counterpartId(posting: Posting): string {
  return posting.counterpart?.id ?? NONE;
}

function iconOf(account: Account, hasChildren: boolean): NodeIcon {
  if (account.role !== null) {
    return account.role;
  }

  return hasChildren ? "folder" : "document";
}

function sideOf(balance: Cents): Side {
  return balance < 0 ? "liabilities" : "assets";
}

function rollUp(children: AccountNode[]): Cents | null {
  const budgets = children
    .map((child) => {
      return child.budget;
    })
    .filter((budget) => {
      return budget !== null;
    });

  return budgets.length === 0 ? null : budgets.reduce(addCents, ZERO_CENTS);
}

function ordered(accounts: Account[]): Account[] {
  return accounts.slice().sort((a, b) => {
    return a.order - b.order;
  });
}

function byLabel(a: AccountNode, b: AccountNode): number {
  return a.label.localeCompare(b.label, "it");
}

function zeroSums(): Sums {
  return { debit: ZERO_CENTS, credit: ZERO_CENTS };
}

function addSums(total: Sums, child: Sums): Sums {
  return { debit: addCents(total.debit, child.debit), credit: addCents(total.credit, child.credit) };
}

function sumOf(postings: Posting[]): Sums {
  return postings.reduce(addSums, zeroSums());
}
```

A posting on a control account with no counterpart lands in a row keyed `…/none` labelled `(no counterpart)`; Task 14's oracle check will show whether the data has any. Export `accountTree.ts` from `index.ts`. If the `arch/newspaper-order` lint reorders helpers, let `pnpm fix` do it.

- [ ] **Step 5: Run the tests until green, then prove one can fail**

Run: `pnpm --filter @cl/domain test -- accountTree` → PASS. Then write `mutants.json` in the scratchpad (not the repo):

```json
[
  { "file": "packages/domain/src/useCases/accountTree.ts", "find": "return balance < 0 ? \"liabilities\" : \"assets\";", "replace": "return balance <= 0 ? \"liabilities\" : \"assets\";", "command": "pnpm --filter @cl/domain test -- accountTree" },
  { "file": "packages/domain/src/useCases/accountTree.ts", "find": "return [...pure, ...controls];", "replace": "return [...controls, ...pure];", "command": "pnpm --filter @cl/domain test -- accountTree" }
]
```

Run: `pnpm mutation-check <path>/mutants.json` → both `KILLED` (the first by Beta's zero balance sitting on the assets side; the second by the side-order test).

- [ ] **Step 6: Fix, gate, commit**

```bash
git add packages/domain
git commit -m "feat(domain): buildAccountTree derives the report's chart of accounts from raw postings"
```

---

### Task 5: `ledgerOf`

**Files:**
- Create: `packages/domain/src/useCases/ledger.ts`, `ledger.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Consumes: `AccountNode`, `findNode`, `PostingScope` (Task 4); `JournalEntry` (Task 3).
- Produces:

```ts
export interface LedgerLine { entryId: string; at: string; number: number; description: string; postingPath: string;
                              debit: Cents; credit: Cents; balance: Cents; }
export interface Ledger { lines: LedgerLine[]; totalDebit: Cents; totalCredit: Cents; balance: Cents; }
export const PATH_SEPARATOR = " › ";
export function ledgerOf(root: AccountNode, key: string, entries: JournalEntry[]): Ledger;   // throws "missing: the node <key>"
export function pathOf(root: AccountNode, key: string): string;                              // labels joined by PATH_SEPARATOR, from "Total"
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";

import { createSmallBooks } from "../testing/createSmallBooks.ts";
import { buildAccountTree } from "./accountTree.ts";
import { ledgerOf, pathOf } from "./ledger.ts";

describe("ledgerOf", () => {
  it("lists a leaf's postings in date and number order with a running debit-minus-credit balance", () => {
    const ledger = ledgerOf(root(), "la4@assets/md2", entries());

    expect(ledger.lines.map((line) => { return [line.number, line.debit, line.credit, line.balance]; })).toEqual([
      [2, 0, 20000, -20000],
      [3, 20000, 0, 0],
    ]);
    expect([ledger.totalDebit, ledger.totalCredit, ledger.balance]).toEqual([20000, 20000, 0]);
  });

  it("gives a grouping the union of its subtree's postings in the same order", () => {
    const ledger = ledgerOf(root(), "la10", entries());

    expect(ledger.lines.map((line) => { return [line.number, line.postingPath]; })).toEqual([
      [9, "Total › Patrimonial › (Assets) › Liquidità › Cassa contanti"],
      [3, "Total › Patrimonial › (Assets) › Liquidità › Banca"],
      [5, "Total › Patrimonial › (Assets) › Liquidità › Cassa contanti"],
      [6, "Total › Patrimonial › (Assets) › Liquidità › Cassa contanti"],
      [8, "Total › Patrimonial › (Assets) › Liquidità › Cassa contanti"],
      [8, "Total › Patrimonial › (Assets) › Liquidità › Banca"],
    ]);
    expect(ledger.balance).toBe(15099);
  });

  it("orders by date before entry number: entry 9 comes first in the cash ledger", () => {
    const ledger = ledgerOf(root(), "la1", entries());

    expect(ledger.lines.map((line) => { return line.number; })).toEqual([9, 5, 6, 8]);
    expect(ledger.lines[0]).toMatchObject({ debit: 100, credit: 0, balance: 100 });
  });

  it("keeps a zero posting as a 0.00 line that leaves the balance unchanged", () => {
    const ledger = ledgerOf(root(), "la1", entries());
    const last = ledger.lines.at(-1);

    expect(last).toMatchObject({ number: 8, debit: 0, credit: 0, balance: 35099 });
  });

  it("carries the entry's description and date-time", () => {
    const [first] = ledgerOf(root(), "la21", entries()).lines;

    expect(first).toMatchObject({ entryId: "tx1", at: "2013-01-10T10:00:00", description: "Fattura Alfa" });
  });

  it("is empty with zero totals for a leaf nothing was posted to", () => {
    expect(ledgerOf(root(), "la3", entries())).toEqual({ lines: [], totalDebit: 0, totalCredit: 0, balance: 0 });
  });

  it("throws for an unknown key", () => {
    expect(() => {
      return ledgerOf(root(), "nope", entries());
    }).toThrow("missing: the node nope");
  });

  it("names a node by its path from Total", () => {
    expect(pathOf(root(), "la21")).toBe("Total › Costs › Spese generali › Ascensore");
    expect(pathOf(root(), "total")).toBe("Total");
  });
});

function root() {
  const books = createSmallBooks();
  return buildAccountTree(books.accounts, books.entries, books.parties);
}

function entries() {
  return createSmallBooks().entries;
}
```

Give `root()` and `entries()` explicit return types (`AccountNode`, `JournalEntry[]`): the lint demands them. Within one entry, postings keep their order in the entry (entry 8 posts la1 then la2).

- [ ] **Step 2: Run to see them fail**

Run: `pnpm --filter @cl/domain test -- ledger`

- [ ] **Step 3: Implement**

```ts
import { addCents, type Cents, subtractCents, ZERO_CENTS } from "../entities/cents.ts";
import type { JournalEntry, Posting } from "../entities/journal.ts";
import { must } from "../support/must.ts";
import { type AccountNode, type PostingScope, ROOT_KEY } from "./accountTree.ts";

export interface LedgerLine {
  entryId: string;
  at: string;
  number: number;
  description: string;
  postingPath: string;
  debit: Cents;
  credit: Cents;
  balance: Cents;
}

export interface Ledger {
  lines: LedgerLine[];
  totalDebit: Cents;
  totalCredit: Cents;
  balance: Cents;
}

export const PATH_SEPARATOR = " › ";

/** A leaf that owns postings, with the path the ledger shows for it. */
interface Owner {
  scope: PostingScope;
  path: string;
}

/**
 * The postings under a node, in the order the journal was written (date, then
 * entry number, then the posting's place in its entry), each with the running
 * balance: the cumulative debit minus credit, whatever the account's nature.
 */
export function ledgerOf(root: AccountNode, key: string, entries: JournalEntry[]): Ledger {
  const owners = ownersUnder(root, key);
  const lines: LedgerLine[] = [];
  let balance = ZERO_CENTS;
  let totalDebit = ZERO_CENTS;
  let totalCredit = ZERO_CENTS;

  for (const entry of chronological(entries)) {
    for (const posting of entry.postings) {
      const owner = owners.find((candidate) => {
        return owns(candidate.scope, posting);
      });

      if (owner === undefined) {
        continue;
      }

      balance = subtractCents(addCents(balance, posting.debit), posting.credit);
      totalDebit = addCents(totalDebit, posting.debit);
      totalCredit = addCents(totalCredit, posting.credit);
      lines.push({
        entryId: entry.id,
        at: entry.at,
        number: entry.number,
        description: entry.description,
        postingPath: owner.path,
        debit: posting.debit,
        credit: posting.credit,
        balance,
      });
    }
  }

  return { lines, totalDebit, totalCredit, balance };
}

/** The node's labels from Total, joined. */
export function pathOf(root: AccountNode, key: string): string {
  return must(trail(root, key, []), `the node ${key}`).join(PATH_SEPARATOR);
}

function ownersUnder(root: AccountNode, key: string): Owner[] {
  const path = pathOf(root, key);
  const start = must(find(root, key), `the node ${key}`);
  const owners: Owner[] = [];

  function collect(node: AccountNode, nodePath: string): void {
    if (node.scope !== null) {
      owners.push({ scope: node.scope, path: nodePath });
    }

    for (const child of node.children) {
      collect(child, `${nodePath}${PATH_SEPARATOR}${child.label}`);
    }
  }

  collect(start, path);

  return owners;
}

function owns(scope: PostingScope, posting: Posting): boolean {
  if (posting.accountId !== scope.accountId) {
    return false;
  }

  switch (scope.kind) {
    case "account":
      return true;
    case "supplier":
      return posting.counterpart?.kind === "supplier" && posting.counterpart.id === scope.supplierId;
    case "residency":
      return posting.counterpart?.kind === "owner" && posting.counterpart.id === scope.residentId;
  }
}

function trail(node: AccountNode, key: string, above: string[]): string[] | undefined {
  const here = [...above, node.label];

  if (node.key === key) {
    return here;
  }

  for (const child of node.children) {
    const found = trail(child, key, here);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

function find(node: AccountNode, key: string): AccountNode | undefined {
  if (node.key === key) {
    return node;
  }

  for (const child of node.children) {
    const found = find(child, key);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

function chronological(entries: JournalEntry[]): JournalEntry[] {
  return entries.slice().sort((a, b) => {
    return a.at.localeCompare(b.at) || a.number - b.number;
  });
}
```

Use `findNode` from `accountTree.ts` instead of the local `find` (delete the local one); `ROOT_KEY` import is unused then: remove it. A posting on a control account with scope `none` (no counterpart) is owned by the `…/none` row: extend `owns` so a `supplier` scope with `supplierId === "none"` matches `posting.counterpart === null`, and likewise `residency` with `residentId === "none"`; add a test with a counterpart-less posting on `la4` to pin it. Export `ledger.ts` from `index.ts`.

- [ ] **Step 4: Run, mutate, gate, commit**

Mutant: swap `a.at.localeCompare(b.at) || a.number - b.number` for `a.number - b.number` → `KILLED` by the "orders by date before entry number" test (entry 9 is dated before the others).

```bash
git add packages/domain
git commit -m "feat(domain): ledgerOf gives a node's postings with a running balance and totals"
```

---

### Task 6: The generator emits the simulator seed module

**Files:**
- Create: `packages/domain/src/simulators/seed/legacySeed.ts`, `legacySeed.test.ts`
- Create (generated): `packages/domain/src/simulators/seed/legacySeed.generated.ts`
- Create: `packages/legacy-import/src/project/legacySeed.ts`, `legacySeed.test.ts`
- Modify: `packages/legacy-import/src/generate-data.ts`, `packages/legacy-import/src/project/units.ts` (export the name helper), `packages/domain/src/index.ts`, `biome.json`, `tools/coverage.config.mts`, `packages/domain/src/testing/createSmallBooks.ts` (add `createSmallSeed`)

**Interfaces:**
- Consumes: Task 3 entities; `Db`, `eur`, `reconcilePeriods` in legacy-import.
- Produces (domain, exported from `@cl/domain`):

```ts
export interface LegacySeed { buildings: Building[]; accounts: Account[]; entries: JournalEntry[]; parties: Party[]; }
export interface AccountData extends Omit<Account, "budget"> { budget: number | null; }
export interface PostingData { accountId: string; debit: number; credit: number; counterpart: Counterpart | null; }
export interface JournalEntryData extends Omit<JournalEntry, "postings"> { postings: PostingData[]; }
export interface LegacySeedData { buildings: Building[]; accounts: AccountData[]; entries: JournalEntryData[]; parties: Party[]; }
export function loadLegacySeed(data: LegacySeedData): LegacySeed;    // every amount through cents(): a fraction in the file fails here, at load
export const legacySeedData: LegacySeedData;                          // legacySeed.generated.ts
export function createSmallSeed(): LegacySeed;                        // testing/createSmallBooks.ts: the small books as one building "Pozzetto" with one period p1 "2013"
```
- Produces (legacy-import): `projectLegacySeed(db: Db): LegacySeedData`, `renderLegacySeedModule(data: LegacySeedData): string`; `masterDataName(db, masterDataId): string` exported from `project/units.ts` (today's non-exported `residentName`, renamed).

- [ ] **Step 1: The domain side: types, loader, and its test**

`packages/domain/src/simulators/seed/legacySeed.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { createSmallSeed } from "../../testing/createSmallBooks.ts";
import { legacySeedData } from "./legacySeed.generated.ts";
import { type LegacySeedData, loadLegacySeed } from "./legacySeed.ts";

describe("loadLegacySeed", () => {
  it("brands every amount and keeps everything else as it is", () => {
    const data = asData(createSmallSeed());

    expect(loadLegacySeed(data)).toEqual(createSmallSeed());
  });

  it("refuses a fractional amount, naming it", () => {
    const data = asData(createSmallSeed());
    data.entries[0]!.postings[0]!.debit = 1.5;

    expect(() => {
      return loadLegacySeed(data);
    }).toThrow("not an integer amount of cents: 1.5");
  });

  it("loads the generated seed: two buildings with books, each with one period", () => {
    const seed = loadLegacySeed(legacySeedData);

    expect(seed.buildings.map((building) => { return [building.name, building.periods.length]; })).toEqual([
      ["Saturno", 1],
      ["Pozzetto", 1],
    ]);
    expect(seed.accounts.filter((account) => { return account.periodId === "p36"; })).toHaveLength(82);
    expect(seed.entries.filter((entry) => { return entry.periodId === "p36"; })).toHaveLength(140);
  });
});

function asData(seed: LegacySeed): LegacySeedData {
  return JSON.parse(JSON.stringify(seed)) as LegacySeedData;
}
```

(the `!` assertions are refused by Biome in the domain: write `must(data.entries[0], "an entry")` with `must` from `#/support/must.ts` instead.)

`legacySeed.ts`:

```ts
import type { Account } from "#/entities/account.ts";
import type { Building } from "#/entities/building.ts";
import { cents } from "#/entities/cents.ts";
import type { Counterpart, JournalEntry } from "#/entities/journal.ts";
import type { Party } from "#/entities/party.ts";

/** What the four M1 simulators answer from: the legacy periods that have books, pseudonymised, as the generator emits them. */
export interface LegacySeed {
  buildings: Building[];
  accounts: Account[];
  entries: JournalEntry[];
  parties: Party[];
}

/** The same, as plain numbers: the shape of the generated module. */
export interface AccountData extends Omit<Account, "budget"> {
  budget: number | null;
}

export interface PostingData {
  accountId: string;
  debit: number;
  credit: number;
  counterpart: Counterpart | null;
}

export interface JournalEntryData extends Omit<JournalEntry, "postings"> {
  postings: PostingData[];
}

export interface LegacySeedData {
  buildings: Building[];
  accounts: AccountData[];
  entries: JournalEntryData[];
  parties: Party[];
}

/** Brands every amount. A fraction in the generated file fails here, once, instead of somewhere in a sum. */
export function loadLegacySeed(data: LegacySeedData): LegacySeed {
  return {
    buildings: data.buildings,
    accounts: data.accounts.map((account) => {
      return { ...account, budget: account.budget === null ? null : cents(account.budget) };
    }),
    entries: data.entries.map((entry) => {
      return {
        ...entry,
        postings: entry.postings.map((posting) => {
          return { ...posting, debit: cents(posting.debit), credit: cents(posting.credit) };
        }),
      };
    }),
    parties: data.parties,
  };
}
```

Until Step 4 generates the real module, create `legacySeed.generated.ts` by hand with `export const legacySeedData: LegacySeedData = { buildings: [], accounts: [], entries: [], parties: [] };` so the package typechecks; the third test fails until then, which is the point.

- [ ] **Step 2: The generator's projection, with its dump test**

`packages/legacy-import/src/project/legacySeed.test.ts`:

```ts
import { readFileSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";

import { buildDb, type Db } from "../db.ts";
import { DUMP_SUITE_TIMEOUT_MS, dumpSuiteName, legacyDumpAvailable, legacyDumpPath } from "../legacyDump.ts";
import { parseTables } from "../loadRows.ts";
import { loadExtraEntries } from "../pseudonymise/leftovers.ts";
import { pseudonymiseTables } from "../pseudonymise/pseudonymise.ts";
import { projectLegacySeed } from "./legacySeed.ts";

describe.skipIf(!legacyDumpAvailable())(
  dumpSuiteName("projectLegacySeed (real dump)"),
  { timeout: DUMP_SUITE_TIMEOUT_MS },
  () => {
    beforeAll(() => {
      db = buildDb(pseudonymiseTables(parseTables(readFileSync(legacyDumpPath(), "utf8")), loadExtraEntries()));
      seed = projectLegacySeed(db);
    }, DUMP_SUITE_TIMEOUT_MS);

    it("keeps only the buildings and periods that have balanced books", () => {
      expect(seed.buildings.map((b) => { return [b.id, b.name, b.periods.map((p) => { return p.id; })]; })).toEqual([
        ["c1", "Saturno", ["p1"]],
        ["c19", "Pozzetto", ["p36"]],
      ]);
    });

    it("emits every account of Pozzetto 2013 with its nature, type and role", () => {
      const accounts = seed.accounts.filter((a) => { return a.periodId === "p36"; });
      const roles = new Map(accounts.filter((a) => { return a.role !== null; }).map((a) => { return [a.role, a.id]; }));

      expect(accounts).toHaveLength(82);
      expect(accounts.filter((a) => { return a.nature === "assetsOrLiabilities"; }).map((a) => { return a.id; })).toEqual(["la157", "la158", "la159"]);
      expect(roles.get("suppliers")).toBe("la157");
      expect(roles.get("owners")).toBe("la158");
      expect(roles.get("roundings")).toBe("la159");
      expect(roles.get("bank")).toBe("la156");
      expect(roles.get("cash")).toBe("la154");
      expect(accounts.filter((a) => { return a.role === "tax"; })).toHaveLength(5);
    });

    it("emits every transaction with its postings and counterparts", () => {
      const entries = seed.entries.filter((e) => { return e.periodId === "p36"; });
      const postings = entries.flatMap((e) => { return e.postings; });
      const onControls = postings.filter((p) => { return ["la157", "la158", "la159"].includes(p.accountId); });

      expect(entries).toHaveLength(140);
      expect(postings).toHaveLength(540);
      expect(entries[1]).toMatchObject({ id: "tx150", number: 2, at: "2013-01-10T15:59:00" });
      expect(onControls.every((p) => { return p.counterpart !== null; })).toBe(true);
    });

    it("names every counterpart in parties, with pseudonymised names", () => {
      const ids = new Set(seed.parties.map((p) => { return `${p.kind}:${p.id}`; }));

      for (const entry of seed.entries) {
        for (const posting of entry.postings) {
          if (posting.counterpart !== null) {
            expect(ids.has(`${posting.counterpart.kind}:${posting.counterpart.id}`)).toBe(true);
          }
        }
      }

      expect(seed.parties.find((p) => { return p.kind === "owner" && p.unitCode === "A01"; })?.name).toBe("Morandini Dina");
    });

    it("is what the committed module holds", () => {
      expect(seed).toEqual(legacySeedData);
    });

    let db: Db;
    let seed: ReturnType<typeof projectLegacySeed>;
  },
);
```

The tax count (5) is one grouping plus four leaves: confirm it from the data when the test first runs and correct the number in the test if the dump says otherwise, stating the actual figure in the commit message. The counterpart assertion on the control accounts may fail if the dump has counterpart-less postings there; if so, change it to report the count and keep the finding for Task 14.

`packages/legacy-import/src/project/legacySeed.ts`:

```ts
import type {
  AccountData,
  AccountNature,
  AccountRole,
  AccountType,
  Building,
  Counterpart,
  JournalEntryData,
  LegacySeedData,
  Party,
  PostingData,
} from "@cl/domain";

import { eur } from "../amounts.ts";
import type { Db } from "../db.ts";
import type { Row } from "../loadRows.ts";
import { reconcilePeriods } from "../reconcile.ts";
import { projectTree } from "./structure.ts";
import { masterDataName } from "./units.ts";

const ROLE_COLUMNS: Record<string, AccountRole> = {
  paymentInCashLedgerAccountId: "cash",
  defaultCheckingAccountLedgerAccountId: "bank",
  supplierAccountsPayableLedgerAccountId: "suppliers",
  flatResidentAccountsReceivableLedgerAccountId: "owners",
  flatResidentRoundingOffLedgerAccountId: "roundings",
};

/** The periods with balanced books, as the M1 simulators read them. */
export function projectLegacySeed(db: Db): LegacySeedData {
  const status = reconcilePeriods(db);
  const buildings: Building[] = projectTree(db)
    .map((node) => {
      return {
        id: node.id,
        name: node.name,
        periods: node.periods
          .filter((period) => {
            const legacyId = period.id.slice(1);
            return status[legacyId]?.hasBooks === true && status[legacyId]?.reconciles === true;
          })
          .map((period) => {
            return {
              id: period.id,
              name: period.name.replace(/ \(.*\)$/, ""),
              type: period.type,
              start: period.start,
              end: period.end,
              closed: period.closed,
            };
          }),
      };
    })
    .filter((building) => {
      return building.periods.length > 0;
    });
  const periodIds = buildings.flatMap((building) => {
    return building.periods.map((period) => {
      return period.id.slice(1);
    });
  });
  const accounts = periodIds.flatMap((periodId) => {
    return projectAccounts(db, periodId);
  });
  const entries = periodIds.flatMap((periodId) => {
    return projectEntries(db, periodId);
  });

  return { buildings, accounts, entries, parties: projectParties(db, entries) };
}

/** The TypeScript module the domain's simulators import. */
export function renderLegacySeedModule(data: LegacySeedData): string {
  return [
    "// GENERATED by packages/legacy-import: `pnpm --filter @cl/legacy-import gen:data`. Do not edit.",
    'import type { LegacySeedData } from "./legacySeed.ts";',
    "",
    `export const legacySeedData: LegacySeedData = ${JSON.stringify(data, null, 2)};`,
    "",
  ].join("\n");
}

function projectAccounts(db: Db, periodId: string): AccountData[] {
  const period = must(db.by("accountingPeriod", "id").get(periodId), `the period ${periodId}`);
  const rows = db.rows("ledgerAccount").filter((row) => {
    return String(row.accountingPeriodId) === periodId;
  });
  const ids = new Set(rows.map((row) => { return String(row.id); }));
  const roles = new Map<string, AccountRole>();

  for (const [column, role] of Object.entries(ROLE_COLUMNS)) {
    const id = text(period[column]);

    if (id !== undefined) {
      roles.set(id, role);
    }
  }

  for (const link of db.rows("withholdingTax2LA")) {
    const id = text(link.ledgerAccountId);
    const account = id === undefined ? undefined : db.by("ledgerAccount", "id").get(id);

    if (id !== undefined && ids.has(id)) {
      roles.set(id, "tax");
      const parent = text(account?.parentLedgerAccountId);

      if (parent !== undefined && ids.has(parent)) {
        roles.set(parent, "tax");
      }
    }
  }

  const estimates = db.by("expenseLedgerAccount", "ledgerAccountId");

  return rows.map((row) => {
    const id = String(row.id);
    const parent = text(row.parentLedgerAccountId);
    const estimate = text(estimates.get(id)?.estimate);

    return {
      id: `la${id}`,
      periodId: `p${periodId}`,
      parentId: parent !== undefined && ids.has(parent) ? `la${parent}` : null,
      name: String(row.name),
      order: Number(row.order ?? 0),
      nature: String(row.kind) as AccountNature,
      type: String(row.type) as AccountType,
      role: roles.get(id) ?? null,
      budget: estimate === undefined ? null : eur(estimate).cents,
    };
  });
}

function projectEntries(db: Db, periodId: string): JournalEntryData[] {
  const byTransaction = db.group("ledgerEntry", "ledgerTransactionId");

  return db
    .rows("ledgerTransaction")
    .filter((row) => {
      return String(row.accountingPeriodId) === periodId;
    })
    .sort((a, b) => {
      return Number(a.code) - Number(b.code);
    })
    .map((row) => {
      const postings: PostingData[] = (byTransaction.get(String(row.id)) ?? [])
        .slice()
        .sort((a, b) => {
          return Number(a.order) - Number(b.order);
        })
        .map((line) => {
          const amount = eur(text(line.amount) ?? null).cents;

          return {
            accountId: `la${String(line.postingAccountId)}`,
            debit: amount > 0 ? amount : 0,
            credit: amount < 0 ? -amount : 0,
            counterpart: counterpartOf(line),
          };
        });

      return {
        id: `tx${String(row.id)}`,
        periodId: `p${periodId}`,
        number: Number(row.code),
        at: String(row.timestamp ?? "").replace(" ", "T"),
        description: String(row.description ?? ""),
        postings,
      };
    });
}

function counterpartOf(line: Row): Counterpart | null {
  const resident = text(line.unitResidentId);

  if (resident !== undefined) {
    return { kind: "owner", id: `r${resident}` };
  }

  const supplier = text(line.masterDataId);

  return supplier === undefined ? null : { kind: "supplier", id: `md${supplier}` };
}

function projectParties(db: Db, entries: JournalEntryData[]): Party[] {
  const suppliers = new Map<string, Party>();
  const owners = new Map<string, Party>();

  for (const entry of entries) {
    for (const posting of entry.postings) {
      const counterpart = posting.counterpart;

      if (counterpart === null) {
        continue;
      }

      if (counterpart.kind === "supplier" && !suppliers.has(counterpart.id)) {
        suppliers.set(counterpart.id, { kind: "supplier", id: counterpart.id, name: masterDataName(db, counterpart.id.slice(2)) });
      }

      if (counterpart.kind === "owner" && !owners.has(counterpart.id)) {
        owners.set(counterpart.id, ownerParty(db, counterpart.id.slice(1)));
      }
    }
  }

  return [...suppliers.values(), ...owners.values()];
}

function ownerParty(db: Db, residentId: string): Party {
  const resident = must(db.by("unitResident", "id").get(residentId), `the resident ${residentId}`);
  const unitPeriod = must(db.by("unitPeriod", "id").get(String(resident.unitPeriodId)), `the unit period of resident ${residentId}`);
  const unit = must(db.by("unit", "id").get(String(unitPeriod.unitId)), `the unit of resident ${residentId}`);
  const personId = String(resident.masterDataId);

  return {
    kind: "owner",
    id: `r${residentId}`,
    personId: `md${personId}`,
    name: masterDataName(db, personId),
    unitCode: text(unit.code) ?? "?",
  };
}

function text(value: unknown): string | undefined {
  return value === null || value === undefined || String(value).trim() === "" ? undefined : String(value).trim();
}

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new Error(`missing: ${what}`);
  }

  return value;
}
```

The `as AccountNature` / `as AccountType` casts are from the dump's enum strings (`packages/db/src/enums.ts` lists exactly these values); Biome's override allows them in this package. In `units.ts`, rename `residentName` to `masterDataName` and export it; update its callers.

- [ ] **Step 3: Wire the generator**

In `generate-data.ts`, after the JSON write:

```ts
const SEED_MODULE_URL = new URL("../../domain/src/simulators/seed/legacySeed.generated.ts", import.meta.url);
writeFileSync(SEED_MODULE_URL, renderLegacySeedModule(projectLegacySeed(db)));
console.log(`Wrote ${SEED_MODULE_URL.pathname}`);
```

- [ ] **Step 4: Generate, exclude the module from Biome and coverage, test**

Run: `pnpm --filter @cl/legacy-import gen:data`. Check `git status`: `seed/data.generated.json` must be unchanged (the pseudonymisation is deterministic) and the new module appears. Add `"!packages/domain/src/simulators/seed/legacySeed.generated.ts"` to `biome.json` `files.includes`; add to `tools/coverage.config.mts` `exclude`: `"packages/domain/src/simulators/seed/legacySeed.generated.ts": "generated data, one constant; its content is held by the generator's freshness test against the dump"`. If `pnpm lint` (ESLint) reports the generated file, add the same path to the `ignores` of `eslint.config.mts` with the same reason as a comment. Export `legacySeed.ts` types and `loadLegacySeed` from the domain index.

Run `pnpm --filter @cl/domain test` and `pnpm --filter @cl/legacy-import test`: all green, the dump suite included.

- [ ] **Step 5: Fix, gate, commit**

```bash
git add -A packages/domain packages/legacy-import biome.json tools/coverage.config.mts eslint.config.mts
git commit -m "feat(legacy-import): emit the M1 simulator seed as a typed module in the domain

Accounts carry their nature, type, role and budget; postings their
counterpart; the parties are named, pseudonymised. The freshness test
proves the committed module is what the dump produces."
```

---

### Task 7: `SessionPort` and `BuildingsPort`, with contracts and simulators

**Files:**
- Create: `packages/domain/src/ports/sessionPort.ts`, `ports/__contracts__/SessionPortContract.ts`, `simulators/sessionSimulator.ts`, `simulators/sessionSimulator.contract.test.ts`, `simulators/sessionSimulator.test.ts`
- Create: `packages/domain/src/ports/buildingsPort.ts`, `ports/__contracts__/BuildingsPortContract.ts`, `simulators/buildingsSimulator.ts`, `simulators/buildingsSimulator.contract.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Produces:

```ts
export interface SessionPort {
  principal(): Observable<Principal>;
  firm(): Observable<Firm>;
  preferences(): Observable<Preferences>;
  setPreference(patch: Partial<Preferences>): Promise<Result>;
}
export interface SessionPortHarness { port: SessionPort; teardown: () => void; }
export function describeSessionPortContract(label: string, createHarness: () => SessionPortHarness): void;
export interface SessionSimulatorOptions { principal: Principal; firm: Firm; preferences?: Preferences; }
export function createSessionSimulator(options: SessionSimulatorOptions): SessionPort;
export const DESIGN_PRINCIPAL: Principal;   // { username: "marco", displayName: "Ferrari Marco", role: "administrator" }
export const DESIGN_FIRM: Firm;             // { name: "Studio Ferrari" }

export interface BuildingsPort { buildings(): Observable<Building[]>; }
export interface BuildingsPortHarness { port: BuildingsPort; expected: Building[]; teardown: () => void; }
export function describeBuildingsPortContract(label: string, createHarness: () => BuildingsPortHarness): void;
export function createBuildingsSimulator(seed: LegacySeed): BuildingsPort;
```

- [ ] **Step 1: Write the two contracts**

`SessionPortContract.ts`:

```ts
import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import type { Preferences } from "#/entities/session.ts";
import type { SessionPort } from "../sessionPort.ts";

/** What an adapter's test supplies so the contract can drive it. */
export interface SessionPortHarness {
  port: SessionPort;
  teardown: () => void;
}

export function describeSessionPortContract(label: string, createHarness: () => SessionPortHarness): void {
  describe(`${label} :: SessionPort contract`, () => {
    it("answers the principal, the firm and the preferences to a new subscriber at once", async () => {
      const { port, teardown } = createHarness();

      try {
        const principal = await firstValueFrom(port.principal());
        const firm = await firstValueFrom(port.firm());
        const preferences = await firstValueFrom(port.preferences());

        expect(principal.username).not.toBe("");
        expect(firm.name).not.toBe("");
        expect(["light", "dark"]).toContain(preferences.mode);
      } finally {
        teardown();
      }
    });

    it("applies a preference patch and tells every subscriber", async () => {
      const { port, teardown } = createHarness();
      const seen: Preferences[] = [];
      const subscription = port.preferences().subscribe((preferences) => {
        seen.push(preferences);
      });

      try {
        const before = seen[0];
        const result = await port.setPreference({ mode: "dark" });

        expect(result).toEqual({ ok: true });
        expect(seen.at(-1)).toEqual({ ...before, mode: "dark" });
        expect(await firstValueFrom(port.preferences())).toEqual({ ...before, mode: "dark" });
      } finally {
        subscription.unsubscribe();
        teardown();
      }
    });
  });
}
```

`BuildingsPortContract.ts`:

```ts
import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import type { Building } from "#/entities/building.ts";
import type { BuildingsPort } from "../buildingsPort.ts";

export interface BuildingsPortHarness {
  port: BuildingsPort;
  /** What the port is expected to answer. */
  expected: Building[];
  teardown: () => void;
}

export function describeBuildingsPortContract(label: string, createHarness: () => BuildingsPortHarness): void {
  describe(`${label} :: BuildingsPort contract`, () => {
    it("answers the buildings with their periods to each subscriber, at once", async () => {
      const { port, expected, teardown } = createHarness();

      try {
        expect(await firstValueFrom(port.buildings())).toEqual(expected);
        expect(await firstValueFrom(port.buildings())).toEqual(expected);
      } finally {
        teardown();
      }
    });

    it("answers at least one building, each with at least one period", async () => {
      const { port, teardown } = createHarness();

      try {
        const buildings = await firstValueFrom(port.buildings());

        expect(buildings.length).toBeGreaterThan(0);
        expect(buildings.every((building) => { return building.periods.length > 0; })).toBe(true);
      } finally {
        teardown();
      }
    });
  });
}
```

- [ ] **Step 2: Write the ports and the contract tests, run them to see them fail**

`ports/sessionPort.ts` and `ports/buildingsPort.ts` hold the interfaces from the **Interfaces** block, each with a doc comment (`SessionPort`: who is signed in and how they like the screen; built once per session for a principal, so no method takes one. `BuildingsPort`: the administrator's buildings with their accounting periods; the selection among them is the application's, not the port's). The contract test files:

```ts
// simulators/sessionSimulator.contract.test.ts
import { describeSessionPortContract } from "../ports/__contracts__/SessionPortContract.ts";
import { createSessionSimulator, DESIGN_FIRM, DESIGN_PRINCIPAL } from "./sessionSimulator.ts";

describeSessionPortContract("session simulator", () => {
  return {
    port: createSessionSimulator({ principal: DESIGN_PRINCIPAL, firm: DESIGN_FIRM }),
    teardown: (): void => {},
  };
});
```

```ts
// simulators/buildingsSimulator.contract.test.ts
import { describeBuildingsPortContract } from "../ports/__contracts__/BuildingsPortContract.ts";
import { createSmallSeed } from "../testing/createSmallBooks.ts";
import { createBuildingsSimulator } from "./buildingsSimulator.ts";

describeBuildingsPortContract("buildings simulator", () => {
  const seed = createSmallSeed();

  return {
    port: createBuildingsSimulator(seed),
    expected: seed.buildings,
    teardown: (): void => {},
  };
});
```

Run: `pnpm --filter @cl/domain test -- Simulator` → FAIL, modules not found.

- [ ] **Step 3: Write the simulators**

`simulators/sessionSimulator.ts`:

```ts
import { BehaviorSubject, type Observable } from "rxjs";

import { ok, type Result } from "#/entities/result.ts";
import { DEFAULT_PREFERENCES, type Firm, type Preferences, type Principal } from "#/entities/session.ts";
import type { SessionPort } from "#/ports/sessionPort.ts";

export interface SessionSimulatorOptions {
  principal: Principal;
  firm: Firm;
  preferences?: Preferences;
}

/** The design's invented administrator: not a real person. */
export const DESIGN_PRINCIPAL: Principal = { username: "marco", displayName: "Ferrari Marco", role: "administrator" };

export const DESIGN_FIRM: Firm = { name: "Studio Ferrari" };

/** A session that needs no server: one principal, preferences kept in memory. Production code: the app runs on it when no server is configured. */
export function createSessionSimulator({ principal, firm, preferences = DEFAULT_PREFERENCES }: SessionSimulatorOptions): SessionPort {
  const principal$ = new BehaviorSubject<Principal>(principal);
  const firm$ = new BehaviorSubject<Firm>(firm);
  const preferences$ = new BehaviorSubject<Preferences>(preferences);

  return {
    principal: (): Observable<Principal> => {
      return principal$.asObservable();
    },
    firm: (): Observable<Firm> => {
      return firm$.asObservable();
    },
    preferences: (): Observable<Preferences> => {
      return preferences$.asObservable();
    },
    setPreference: (patch: Partial<Preferences>): Promise<Result> => {
      preferences$.next({ ...preferences$.getValue(), ...patch });

      return Promise.resolve(ok());
    },
  };
}
```

`simulators/buildingsSimulator.ts`:

```ts
import { type Observable, of } from "rxjs";

import type { Building } from "#/entities/building.ts";
import type { BuildingsPort } from "#/ports/buildingsPort.ts";
import type { LegacySeed } from "./seed/legacySeed.ts";

/** The seed's buildings, answered to anyone who asks. */
export function createBuildingsSimulator(seed: LegacySeed): BuildingsPort {
  return {
    buildings: (): Observable<Building[]> => {
      return of(seed.buildings);
    },
  };
}
```

`sessionSimulator.test.ts` adds what the contract leaves: "starts on the default preferences when none are given" and "keeps the preferences it was given". Export the four ports/simulators and the two design constants from the index.

- [ ] **Step 4: Run, fix, gate, commit**

`pnpm --filter @cl/domain test` → green, including the contracts. `pnpm fix && pnpm gate:full:quiet` → green (the `port-contracts` gate finds both contracts and both simulator contract runs).

```bash
git add packages/domain
git commit -m "feat(domain): SessionPort and BuildingsPort, with contracts and simulators"
```

---

### Task 8: `AccountsPort` and `JournalPort`, with contracts and simulators

**Files:**
- Create: `packages/domain/src/ports/accountsPort.ts`, `ports/__contracts__/AccountsPortContract.ts`, `simulators/accountsSimulator.ts`, `simulators/accountsSimulator.contract.test.ts`, `simulators/accountsSimulator.test.ts`
- Create: `packages/domain/src/ports/journalPort.ts`, `ports/__contracts__/JournalPortContract.ts`, `simulators/journalSimulator.ts`, `simulators/journalSimulator.contract.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Consumes: `validateBudget` (Task 3), `LegacySeed`, `createSmallSeed` (Task 6).
- Produces:

```ts
export interface AccountsPort {
  accounts(periodId: string): Observable<Account[]>;   // errors with "missing: the period <id>" for an unknown period
  parties(periodId: string): Observable<Party[]>;      // the parties the period's postings name
  setBudget(accountId: string, budget: Cents): Promise<Result>;   // rejects (throws) for an unknown account
}
export interface AccountsPortHarness {
  port: AccountsPort; periodId: string; unknownPeriodId: string; costLeafId: string; groupingId: string; teardown: () => void;
}
export function describeAccountsPortContract(label: string, createHarness: () => AccountsPortHarness): void;
export function createAccountsSimulator(seed: LegacySeed): AccountsPort;

export interface JournalPort { entries(periodId: string): Observable<JournalEntry[]>; }   // in number order; errors for an unknown period
export interface JournalPortHarness { port: JournalPort; periodId: string; unknownPeriodId: string; teardown: () => void; }
export function describeJournalPortContract(label: string, createHarness: () => JournalPortHarness): void;
export function createJournalSimulator(seed: LegacySeed): JournalPort;
```

- [ ] **Step 1: Write the contracts**

`AccountsPortContract.ts`:

```ts
import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import { type Account, cents } from "#/index.ts";
import type { AccountsPort } from "../accountsPort.ts";

export interface AccountsPortHarness {
  port: AccountsPort;
  periodId: string;
  unknownPeriodId: string;
  /** A regular account of nature expenses: the one kind a budget may be set on. */
  costLeafId: string;
  groupingId: string;
  teardown: () => void;
}

export function describeAccountsPortContract(label: string, createHarness: () => AccountsPortHarness): void {
  describe(`${label} :: AccountsPort contract`, () => {
    it("answers a period's accounts, all of that period, at once", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        const accounts = await firstValueFrom(port.accounts(periodId));

        expect(accounts.length).toBeGreaterThan(0);
        expect(accounts.every((account) => { return account.periodId === periodId; })).toBe(true);
      } finally {
        teardown();
      }
    });

    it("answers a period's parties", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        expect(Array.isArray(await firstValueFrom(port.parties(periodId)))).toBe(true);
      } finally {
        teardown();
      }
    });

    it("fails, naming the id, for a period it does not have", async () => {
      const { port, unknownPeriodId, teardown } = createHarness();

      try {
        await expect(firstValueFrom(port.accounts(unknownPeriodId))).rejects.toThrow(unknownPeriodId);
        await expect(firstValueFrom(port.parties(unknownPeriodId))).rejects.toThrow(unknownPeriodId);
      } finally {
        teardown();
      }
    });

    it("sets a budget on a cost leaf and tells every subscriber", async () => {
      const { port, periodId, costLeafId, teardown } = createHarness();
      const seen: Account[][] = [];
      const subscription = port.accounts(periodId).subscribe((accounts) => {
        seen.push(accounts);
      });

      try {
        expect(await port.setBudget(costLeafId, cents(123456))).toEqual({ ok: true });
        expect(seen.at(-1)?.find((account) => { return account.id === costLeafId; })?.budget).toBe(123456);
      } finally {
        subscription.unsubscribe();
        teardown();
      }
    });

    it("refuses a budget on a grouping, with the domain's reason, changing nothing", async () => {
      const { port, periodId, groupingId, teardown } = createHarness();

      try {
        const before = await firstValueFrom(port.accounts(periodId));

        expect(await port.setBudget(groupingId, cents(1))).toEqual({ ok: false, reason: "not-a-leaf" });
        expect(await firstValueFrom(port.accounts(periodId))).toEqual(before);
      } finally {
        teardown();
      }
    });

    it("fails for an account it does not have", async () => {
      const { port, teardown } = createHarness();

      try {
        await expect(port.setBudget("nope", cents(1))).rejects.toThrow("nope");
      } finally {
        teardown();
      }
    });
  });
}
```

`JournalPortContract.ts`: "answers a period's entries, all of that period, in number order" and "fails, naming the id, for a period it does not have", in the same shape.

- [ ] **Step 2: Write the ports and the contract tests over `createSmallSeed()`**

The accounts contract test's harness: `{ port: createAccountsSimulator(seed), periodId: "p1", unknownPeriodId: "p99", costLeafId: "la21", groupingId: "la20", teardown }`. The journal one: `{ port: createJournalSimulator(seed), periodId: "p1", unknownPeriodId: "p99", teardown }`. Run them: FAIL, modules not found.

- [ ] **Step 3: Write the simulators**

`simulators/accountsSimulator.ts`:

```ts
import { BehaviorSubject, type Observable, throwError } from "rxjs";

import type { Account } from "#/entities/account.ts";
import type { Cents } from "#/entities/cents.ts";
import type { Party } from "#/entities/party.ts";
import type { Result } from "#/entities/result.ts";
import type { AccountsPort } from "#/ports/accountsPort.ts";
import { must } from "#/support/must.ts";
import { validateBudget } from "#/useCases/validateBudget.ts";
import type { LegacySeed } from "./seed/legacySeed.ts";

/** A period's accounts, kept in memory, and the parties its postings name. */
interface PeriodBooks {
  accounts$: BehaviorSubject<Account[]>;
  parties: Party[];
}

/** The chart of accounts of every seeded period, with the budget edit kept in memory. Throws on an unknown id: it never answers empty for a wrong key. */
export function createAccountsSimulator(seed: LegacySeed): AccountsPort {
  const periods = new Map<string, PeriodBooks>();

  for (const building of seed.buildings) {
    for (const period of building.periods) {
      periods.set(period.id, {
        accounts$: new BehaviorSubject(
          seed.accounts.filter((account) => {
            return account.periodId === period.id;
          }),
        ),
        parties: partiesOf(seed, period.id),
      });
    }
  }

  function booksOf(periodId: string): PeriodBooks | undefined {
    return periods.get(periodId);
  }

  return {
    accounts: (periodId: string): Observable<Account[]> => {
      const books = booksOf(periodId);

      return books === undefined ? missing(`the period ${periodId}`) : books.accounts$.asObservable();
    },
    parties: (periodId: string): Observable<Party[]> => {
      const books = booksOf(periodId);

      return books === undefined ? missing(`the period ${periodId}`) : new BehaviorSubject(books.parties).asObservable();
    },
    setBudget: (accountId: string, budget: Cents): Promise<Result> => {
      const books = must(
        [...periods.values()].find((candidate) => {
          return candidate.accounts$.getValue().some((account) => {
            return account.id === accountId;
          });
        }),
        `the account ${accountId}`,
      );
      const accounts = books.accounts$.getValue();
      const account = must(
        accounts.find((candidate) => {
          return candidate.id === accountId;
        }),
        `the account ${accountId}`,
      );
      const verdict = validateBudget(account, budget);

      if (verdict.ok) {
        books.accounts$.next(
          accounts.map((candidate) => {
            return candidate.id === accountId ? { ...candidate, budget } : candidate;
          }),
        );
      }

      return Promise.resolve(verdict);
    },
  };
}

function partiesOf(seed: LegacySeed, periodId: string): Party[] {
  const named = new Set<string>();

  for (const entry of seed.entries) {
    if (entry.periodId !== periodId) {
      continue;
    }

    for (const posting of entry.postings) {
      if (posting.counterpart !== null) {
        named.add(`${posting.counterpart.kind}:${posting.counterpart.id}`);
      }
    }
  }

  return seed.parties.filter((party) => {
    return named.has(`${party.kind}:${party.id}`);
  });
}

function missing<T>(what: string): Observable<T> {
  return throwError(() => {
    return new Error(`missing: ${what}`);
  });
}
```

`setBudget` must reject, not throw synchronously, for the contract's `rejects.toThrow`: wrap the body in `async` is banned by the lint for a plain function? It is not: a method returning a promise may be `async`. Make `setBudget` an `async` arrow so `must` throwing becomes a rejection; the `no-floating-promises` rule is satisfied since callers await it.

`simulators/journalSimulator.ts`: `entries(periodId)` answers `of(sorted)` when the period exists in `seed.buildings`, else `missing(...)`; sorted by `number`.

`accountsSimulator.test.ts` pins what the contract cannot: "answers only the parties the period's postings name" (over `createSmallSeed()`: suppliers md1, md2 and owners r1, r2, r3 and no other), and "keeps a rejected budget out of the stream".

- [ ] **Step 4: Run, fix, gate, commit**

Export everything from the index. `pnpm fix && pnpm gate:full:quiet` → green.

```bash
git add packages/domain
git commit -m "feat(domain): AccountsPort and JournalPort, with contracts and simulators over the seed"
```

---

### Task 9: The session, buildings and accounts presenters

**Files:**
- Create: `packages/client-core/src/presenters/sessionPresenter.ts`, `sessionPresenter.test.ts`, `buildingsPresenter.ts`, `buildingsPresenter.test.ts`, `accountsPresenter.ts`, `accountsPresenter.test.ts`
- Modify: `packages/client-core/src/index.ts` (add the exports; the price exports stay until Task 13)

**Interfaces:**
- Consumes: the four ports and simulators, `buildAccountTree`, `findNode`, `ledgerOf`, `pathOf`, `ROOT_KEY`, `createSmallSeed` (Tasks 4–8).
- Produces:

```ts
export interface SessionPresenter {
  principal$: DefaultedStateObservable<Principal | null>;
  firm$: DefaultedStateObservable<Firm | null>;
  preferences$: DefaultedStateObservable<Preferences>;
  setMode: (mode: Mode) => Promise<Result>;
  setTheme: (theme: Theme) => Promise<Result>;
  setLanguage: (language: Language) => Promise<Result>;
}
export function createSessionPresenter(port: SessionPort): SessionPresenter;

export interface PeriodSelection { buildingId: string; periodId: string; }
export interface BuildingsPresenter {
  tree$: DefaultedStateObservable<Building[]>;
  selected$: DefaultedStateObservable<PeriodSelection | null>;   // the first building's first period until selectPeriod
  selectPeriod: (periodId: string) => void;                       // an unknown id errors the stream: "missing: the period <id>"
}
export function createBuildingsPresenter(port: BuildingsPort): BuildingsPresenter;

export interface AccountDetails {
  path: string; typeLabel: string; natureLabel: string; isCost: boolean;
  debit: Cents; credit: Cents; balance: Cents; budget: Cents | null; systemId: string;
}
export interface AccountsPresenterPorts { accounts: AccountsPort; journal: JournalPort; }
export interface AccountsPresenter {
  tree$: DefaultedStateObservable<AccountNode | null>;
  selectedKey$: DefaultedStateObservable<string>;          // ROOT_KEY; reset to it when the period changes
  selectedNode$: DefaultedStateObservable<AccountNode | null>;
  ledger$: DefaultedStateObservable<Ledger | null>;
  details$: DefaultedStateObservable<AccountDetails | null>;
  select: (key: string) => void;
  setBudget: (accountId: string, budget: Cents) => Promise<Result>;
}
export function createAccountsPresenter(ports: AccountsPresenterPorts, selected$: Observable<PeriodSelection | null>): AccountsPresenter;
export const NATURE_LABELS: Record<AccountNature, string>;   // assets "Asset", liabilities "Liability", assetsOrLiabilities "Asset/Liability", expenses "Cost", income "Revenue"
```

- [ ] **Step 1: Write the failing tests**

`buildingsPresenter.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { type Building, createBuildingsSimulator } from "@cl/domain";
import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";

import { type BuildingsPresenter, createBuildingsPresenter, type PeriodSelection } from "./buildingsPresenter.ts";

describe("the buildings presenter", () => {
  it("answers the tree and selects the first building's first period until told otherwise", () => {
    const { latest } = createPresented(twoBuildings());

    expect(latest().tree.map((building) => { return building.id; })).toEqual(["c1", "c2"]);
    expect(latest().selected).toEqual({ buildingId: "c1", periodId: "p1" });
  });

  it("selects the period it is told, with its building", () => {
    const { presenter, latest } = createPresented(twoBuildings());

    presenter.selectPeriod("p2");

    expect(latest().selected).toEqual({ buildingId: "c2", periodId: "p2" });
  });

  it("errors, naming the id, for a period no building has", () => {
    const { presenter, errors } = createPresented(twoBuildings());

    presenter.selectPeriod("p9");

    expect(errors()).toEqual(["missing: the period p9"]);
  });

  it("selects nothing while there is no building", () => {
    const { latest } = createPresented([]);

    expect(latest().selected).toBeNull();
  });
});

interface Presented {
  presenter: BuildingsPresenter;
  latest: () => { tree: Building[]; selected: PeriodSelection | null };
  errors: () => string[];
}

function createPresented(buildings: Building[]): Presented {
  const seed = { ...createSmallSeed(), buildings };
  const presenter = createBuildingsPresenter(createBuildingsSimulator(seed));
  let tree: Building[] = [];
  let selected: PeriodSelection | null = null;
  const errors: string[] = [];

  presenter.tree$.subscribe((next) => {
    tree = next;
  });
  presenter.selected$.subscribe({
    next: (next) => {
      selected = next;
    },
    error: (error: Error) => {
      errors.push(error.message);
    },
  });

  return {
    presenter,
    latest: () => {
      return { tree, selected };
    },
    errors: () => {
      return errors;
    },
  };
}

function twoBuildings(): Building[] {
  const period = { type: "ordinary" as const, start: "2013-01-01", end: "2013-12-31", closed: false };

  return [
    { id: "c1", name: "Pozzetto", periods: [{ id: "p1", name: "2013", ...period }] },
    { id: "c2", name: "Saturno", periods: [{ id: "p2", name: "2011", ...period }] },
  ];
}
```

`accountsPresenter.test.ts` (over `createSmallSeed()` with the simulators, `selected$` a `BehaviorSubject<PeriodSelection | null>` the test drives):

- "derives the tree of the selected period": `latest().tree?.children.map(keyOf)` is `["patrimonial", "costs", "revenue"]` and `latest().tree?.debit` is 212619.
- "starts on Total and answers its ledger and details": `selectedKey` is `"total"`, `ledger?.lines` has 20 lines (count every posting in the fixture: 2+2+2+4+2+2+2+2+2 = 20), `details` is `{ path: "Total", typeLabel: "Non-movable / grouping", natureLabel: "—", isCost: false, ..., systemId: "—" }`.
- "selects a node: its ledger and details follow": after `presenter.select("la21")`, `ledger?.lines.map(number)` is `[1]`, `details` matches `{ path: "Total › Costs › Spese generali › Ascensore", typeLabel: "Movable", natureLabel: "Cost", isCost: true, budget: 100000, systemId: "21" }`.
- "labels a supplier row and an owner residency row as subledgers": `la4@assets/md2` → `"Non-movable / subledger"`, `la5@assets/md10/r1` → `"Non-movable / owner subledger"`.
- "resets the selection to Total when the period changes": select `la21`, then `selected$.next({ buildingId: "c1", periodId: "p1" })` again with a different object but same id does nothing (distinct by id); then a seed with two periods is needed: build the presenter over a seed whose second building has period `p2` with no accounts: after `selected$.next({ buildingId: "c2", periodId: "p2" })`, `selectedKey` is `"total"` and `tree?.children.map(keyOf)` is still the five levels with every amount 0 and `ledger` equal to `{ lines: [], totalDebit: 0, totalCredit: 0, balance: 0 }` (Review Focus 3).
- "a budget edit through the presenter shows in the tree": `await presenter.setBudget("la21", cents(120000))` → `{ ok: true }`, then `findNode(tree, "la20")?.budget` is 170000; `await presenter.setBudget("la20", cents(1))` → `{ ok: false, reason: "not-a-leaf" }`.
- "answers null for everything while no period is selected": with `selected$` at `null`, `tree`, `ledger`, `details` are null.

`sessionPresenter.test.ts`: "answers the principal, firm and preferences" (over `createSessionSimulator({ principal: DESIGN_PRINCIPAL, firm: DESIGN_FIRM })`), "setMode, setTheme and setLanguage each patch one preference".

- [ ] **Step 2: Run to see them fail**

Run: `pnpm --filter @cl/client-core test -- Presenter`

- [ ] **Step 3: Implement**

`sessionPresenter.ts`:

```ts
import { type DefaultedStateObservable, state } from "@rx-state/core";

import {
  DEFAULT_PREFERENCES,
  type Firm,
  type Language,
  type Mode,
  type Preferences,
  type Principal,
  type Result,
  type SessionPort,
  type Theme,
} from "@cl/domain";

export interface SessionPresenter {
  principal$: DefaultedStateObservable<Principal | null>;
  firm$: DefaultedStateObservable<Firm | null>;
  preferences$: DefaultedStateObservable<Preferences>;
  setMode: (mode: Mode) => Promise<Result>;
  setTheme: (theme: Theme) => Promise<Result>;
  setLanguage: (language: Language) => Promise<Result>;
}

/** Who is signed in and how they like the screen. Shared: one subscription to the port however many readers. */
export function createSessionPresenter(port: SessionPort): SessionPresenter {
  return {
    principal$: state(port.principal(), null),
    firm$: state(port.firm(), null),
    preferences$: state(port.preferences(), DEFAULT_PREFERENCES),
    setMode: (mode: Mode): Promise<Result> => {
      return port.setPreference({ mode });
    },
    setTheme: (theme: Theme): Promise<Result> => {
      return port.setPreference({ theme });
    },
    setLanguage: (language: Language): Promise<Result> => {
      return port.setPreference({ language });
    },
  };
}
```

`buildingsPresenter.ts`:

```ts
import { type DefaultedStateObservable, state } from "@rx-state/core";
import { BehaviorSubject, combineLatest, map } from "rxjs";

import type { Building, BuildingsPort } from "@cl/domain";

export interface PeriodSelection {
  buildingId: string;
  periodId: string;
}

export interface BuildingsPresenter {
  tree$: DefaultedStateObservable<Building[]>;
  selected$: DefaultedStateObservable<PeriodSelection | null>;
  selectPeriod: (periodId: string) => void;
}

/** The sidebar's tree and the one selection every building-scoped screen reads. */
export function createBuildingsPresenter(port: BuildingsPort): BuildingsPresenter {
  const chosen$ = new BehaviorSubject<string | null>(null);
  const tree$ = state(port.buildings(), []);
  const selected$ = state(
    combineLatest([tree$, chosen$]).pipe(
      map(([tree, chosen]) => {
        return resolve(tree, chosen);
      }),
    ),
    null,
  );

  return {
    tree$,
    selected$,
    selectPeriod: (periodId: string): void => {
      chosen$.next(periodId);
    },
  };
}

/** The chosen period with its building; the first period of the first building when none is chosen. */
function resolve(tree: Building[], chosen: string | null): PeriodSelection | null {
  for (const building of tree) {
    for (const period of building.periods) {
      if (chosen === null || period.id === chosen) {
        return { buildingId: building.id, periodId: period.id };
      }
    }
  }

  if (chosen !== null) {
    throw new Error(`missing: the period ${chosen}`);
  }

  return null;
}
```

`accountsPresenter.ts`:

```ts
import { type DefaultedStateObservable, state } from "@rx-state/core";
import { combineLatest, distinctUntilChanged, map, type Observable, of, startWith, Subject, switchMap } from "rxjs";

import {
  type AccountNature,
  type AccountNode,
  type AccountsPort,
  buildAccountTree,
  type Cents,
  findNode,
  type JournalEntry,
  type JournalPort,
  type Ledger,
  ledgerOf,
  pathOf,
  type Result,
  ROOT_KEY,
} from "@cl/domain";

import type { PeriodSelection } from "./buildingsPresenter.ts";

export interface AccountDetails {
  path: string;
  typeLabel: string;
  natureLabel: string;
  isCost: boolean;
  debit: Cents;
  credit: Cents;
  balance: Cents;
  budget: Cents | null;
  systemId: string;
}

export interface AccountsPresenterPorts {
  accounts: AccountsPort;
  journal: JournalPort;
}

export interface AccountsPresenter {
  tree$: DefaultedStateObservable<AccountNode | null>;
  selectedKey$: DefaultedStateObservable<string>;
  selectedNode$: DefaultedStateObservable<AccountNode | null>;
  ledger$: DefaultedStateObservable<Ledger | null>;
  details$: DefaultedStateObservable<AccountDetails | null>;
  select: (key: string) => void;
  setBudget: (accountId: string, budget: Cents) => Promise<Result>;
}

export const NATURE_LABELS: Record<AccountNature, string> = {
  assets: "Asset",
  liabilities: "Liability",
  assetsOrLiabilities: "Asset/Liability",
  expenses: "Cost",
  income: "Revenue",
};

const NO_VALUE = "—";

/** A period's raw books, read together so the tree is built from one consistent set. */
interface Books {
  tree: AccountNode;
  entries: JournalEntry[];
}

/** The Accounts screen: the tree of the selected period, the selected node, its ledger and its details. */
export function createAccountsPresenter(
  ports: AccountsPresenterPorts,
  selected$: Observable<PeriodSelection | null>,
): AccountsPresenter {
  const chosenKey$ = new Subject<string>();
  const periodId$ = selected$.pipe(
    map((selection) => {
      return selection?.periodId ?? null;
    }),
    distinctUntilChanged(),
  );
  const books$ = state(
    periodId$.pipe(
      switchMap((periodId): Observable<Books | null> => {
        if (periodId === null) {
          return of(null);
        }

        return combineLatest([
          ports.accounts.accounts(periodId),
          ports.journal.entries(periodId),
          ports.accounts.parties(periodId),
        ]).pipe(
          map(([accounts, entries, parties]) => {
            return { tree: buildAccountTree(accounts, entries, parties), entries };
          }),
        );
      }),
    ),
    null,
  );
  const tree$ = state(
    books$.pipe(
      map((books) => {
        return books?.tree ?? null;
      }),
    ),
    null,
  );
  // Every period change starts the selection again at Total.
  const selectedKey$ = state(
    periodId$.pipe(
      switchMap(() => {
        return chosenKey$.pipe(startWith(ROOT_KEY));
      }),
    ),
    ROOT_KEY,
  );
  const selectedNode$ = state(
    combineLatest([tree$, selectedKey$]).pipe(
      map(([tree, key]) => {
        return tree === null ? null : (findNode(tree, key) ?? null);
      }),
    ),
    null,
  );
  const ledger$ = state(
    combineLatest([books$, selectedKey$]).pipe(
      map(([books, key]) => {
        return books === null ? null : ledgerOf(books.tree, key, books.entries);
      }),
    ),
    null,
  );
  const details$ = state(
    combineLatest([tree$, selectedNode$]).pipe(
      map(([tree, node]) => {
        return tree === null || node === null ? null : detailsOf(tree, node);
      }),
    ),
    null,
  );

  return {
    tree$,
    selectedKey$,
    selectedNode$,
    ledger$,
    details$,
    select: (key: string): void => {
      chosenKey$.next(key);
    },
    setBudget: (accountId: string, budget: Cents): Promise<Result> => {
      return ports.accounts.setBudget(accountId, budget);
    },
  };
}

function detailsOf(tree: AccountNode, node: AccountNode): AccountDetails {
  return {
    path: pathOf(tree, node.key),
    typeLabel: typeLabelOf(node),
    natureLabel: node.nature === null ? NO_VALUE : NATURE_LABELS[node.nature],
    isCost: node.nature === "expenses",
    debit: node.debit,
    credit: node.credit,
    balance: node.balance,
    budget: node.budget,
    systemId: node.accountId === null ? NO_VALUE : node.accountId.replace(/^la/, ""),
  };
}

function typeLabelOf(node: AccountNode): string {
  if (node.scope?.kind === "supplier") {
    return "Non-movable / subledger";
  }

  if (node.scope?.kind === "residency") {
    return "Non-movable / owner subledger";
  }

  return node.children.length > 0 || node.scope === null ? "Non-movable / grouping" : "Movable";
}
```

- [ ] **Step 4: Run, prove, gate, commit**

Tests green. Mutant for the reset rule: replace `chosenKey$.pipe(startWith(ROOT_KEY))` with `chosenKey$` → the period-change test must fail (`KILLED`). `pnpm fix && pnpm gate:full:quiet` → green; coverage holds on all three files (the `selectedNode$` null branch and the `NO_VALUE` branches are covered by the tests above).

```bash
git add packages/client-core
git commit -m "feat(core): the session, buildings and accounts presenters"
```

---

### Task 10: The machines and the notices

**Files:**
- Create under `packages/client-core/src/machines/`: `reducerMachine.ts`, `accountsGridMachine.ts` (+ `.test.ts`), `columnsMachine.ts` (+ test), `splitMachine.ts` (+ test), `bottomTabMachine.ts` (+ test), `maximizeMachine.ts` (+ test), `sidebarMachine.ts` (+ test), `navigationMachine.ts` (+ test)
- Create: `packages/client-core/src/notices.ts`, `notices.test.ts`
- Modify: `packages/client-core/src/index.ts`

**Interfaces:**
- Consumes: `Machine<TState, TIntents>` (`machines/machine.ts`, unchanged), `AccountNode`, `ROOT_KEY`.
- Produces:

```ts
// reducerMachine.ts: the shape every machine below is built with
export function createReducerMachine<TState, TAction, TIntents extends object>(
  initial: TState, reduce: (state: TState, action: TAction) => TState, bindIntents: (dispatch: (action: TAction) => void) => TIntents,
): Machine<TState, TIntents>;

// accountsGridMachine.ts
export interface GridRow { key: string; node: AccountNode; depth: number; hasChildren: boolean; expanded: boolean; }
export interface AccountsGridState { rows: GridRow[]; expanded: string[]; search: string; hideEmpty: boolean; }
export interface AccountsGridIntents { toggle: (key: string) => void; expandAll: () => void; collapseAll: () => void; setSearch: (text: string) => void; setHideEmpty: (hide: boolean) => void; }
export const INITIAL_EXPANDED: readonly string[];   // ["total", "patrimonial", "assets", "liabilities", "costs", "revenue"]
export function createAccountsGridMachine(tree$: Observable<AccountNode | null>): Machine<AccountsGridState, AccountsGridIntents>;
export function visibleRows(tree: AccountNode, expanded: ReadonlySet<string>, search: string, hideEmpty: boolean): GridRow[];

// columnsMachine.ts
export interface ColumnSpec { def: number; min: number; max: number; grow: boolean; }
export interface ColumnsState { widths: (number | null)[]; template: string; }     // null = not resized
export interface ColumnsIntents { resize: (index: number, px: number) => void; }
export function createColumnsMachine(spec: readonly ColumnSpec[]): Machine<ColumnsState, ColumnsIntents>;
export function templateOf(spec: readonly ColumnSpec[], widths: readonly (number | null)[]): string;

// splitMachine.ts
export interface SplitState { ratio: number; }                       // 0.5; clamped 0.2..0.8
export interface SplitIntents { setRatio: (ratio: number) => void; }
export function createSplitMachine(): Machine<SplitState, SplitIntents>;

// bottomTabMachine.ts
export interface BottomTabState { active: string; }
export interface BottomTabIntents { activate: (tab: string) => void; }   // a name not in `tabs` is ignored
export function createBottomTabMachine(tabs: readonly string[]): Machine<BottomTabState, BottomTabIntents>;

// maximizeMachine.ts
export type Panel = "top" | "bottom";
export interface MaximizeState { maximized: Panel | null; }
export interface MaximizeIntents { toggle: (panel: Panel) => void; restore: () => void; }
export function createMaximizeMachine(): Machine<MaximizeState, MaximizeIntents>;

// sidebarMachine.ts
export interface SidebarState { width: number; open: boolean; }       // 272, false; width clamped 180..440
export interface SidebarIntents { resize: (px: number) => void; open: () => void; close: () => void; }
export function createSidebarMachine(): Machine<SidebarState, SidebarIntents>;

// navigationMachine.ts
export type Module = "calendar" | "buildings" | "contacts";
export type Menu = "data" | "units" | "thousandths" | "accounts" | "journal" | "installments";
export interface NavigationState { module: Module; menu: Menu; }       // buildings, accounts
export interface NavigationIntents { selectModule: (module: Module) => void; selectMenu: (menu: Menu) => void; }
export function createNavigationMachine(): Machine<NavigationState, NavigationIntents>;

// notices.ts
export interface Notice { id: number; text: string; }
export interface Notices { notices$: DefaultedStateObservable<Notice[]>; stub: (label: string) => void; clear: (id: number) => void; }
export function createNotices(): Notices;                              // stub posts `${label}: not yet available`
```

- [ ] **Step 1: The reducer machine, tested through the split machine**

`reducerMachine.ts`:

```ts
import { state } from "@rx-state/core";
import { scan, Subject } from "rxjs";

import type { Machine } from "./machine.ts";

/** A machine from a pure reducer: actions in, one state stream out, held open for the machine's life so an early intent is not lost. */
export function createReducerMachine<TState, TAction, TIntents extends object>(
  initial: TState,
  reduce: (state: TState, action: TAction) => TState,
  bindIntents: (dispatch: (action: TAction) => void) => TIntents,
): Machine<TState, TIntents> {
  const actions$ = new Subject<TAction>();
  const state$ = state(actions$.pipe(scan(reduce, initial)), initial);
  const subscription = state$.subscribe();

  return {
    state$,
    intents: bindIntents((action: TAction): void => {
      actions$.next(action);
    }),
    dispose: (): void => {
      subscription.unsubscribe();
      actions$.complete();
    },
  };
}
```

`splitMachine.ts`:

```ts
import type { Machine } from "./machine.ts";
import { createReducerMachine } from "./reducerMachine.ts";

export interface SplitState {
  ratio: number;
}

export interface SplitIntents {
  setRatio: (ratio: number) => void;
}

interface SetRatio {
  type: "setRatio";
  ratio: number;
}

const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;
const INITIAL: SplitState = { ratio: 0.5 };

export function reduceSplit(current: SplitState, action: SetRatio): SplitState {
  return { ratio: Math.min(MAX_RATIO, Math.max(MIN_RATIO, action.ratio)) };
}

/** How two stacked panels share their column: the top one's share, never below a fifth or above four fifths. */
export function createSplitMachine(): Machine<SplitState, SplitIntents> {
  return createReducerMachine(INITIAL, reduceSplit, (dispatch) => {
    return {
      setRatio: (ratio: number): void => {
        dispatch({ type: "setRatio", ratio });
      },
    };
  });
}
```

Its test: `reduceSplit` clamps both ends and keeps a value inside; the machine starts at 0.5, follows `setRatio(0.3)`, and after `dispose()` a further intent changes nothing (`state$.getValue()` unchanged).

- [ ] **Step 2: The other reducer machines, same shape, each with reducer tests and one machine test**

- `bottomTabMachine`: initial `{ active: tabs[0] }` (throw `"a tabbed panel needs at least one tab"` on an empty list); `activate` of a name not in `tabs` returns the current state.
- `maximizeMachine`: `toggle(panel)` sets `maximized` to the panel, or to null when it is that panel already; `restore` sets null.
- `sidebarMachine`: `resize` clamps to 180..440; `open`/`close` set the flag.
- `navigationMachine`: `selectModule`, `selectMenu` replace the field.
- `columnsMachine`: initial `widths` all null; `resize(index, px)` clamps to the column's `min..max` and ignores an index outside the spec; `template` recomputed by `templateOf`: a resized column is `${px}px`; a grow column not resized is `minmax(${min}px,1fr)`; any other is `${def}px`; joined by one space.

Tests pin, for `templateOf`, the Accounts default: spec from the prototype's `GBASE.accounts` (`w: [400,100,100,100,90,130,44,170,110,44,210,56,64], g: 0, gmin: 360, gmax: 680`, non-grow columns `min = max(34, round(w*0.6))`, `max = round(w*2.2)`) gives `"minmax(360px,1fr) 100px 100px 100px 90px 130px 44px 170px 110px 44px 210px 56px 64px"`. Export a helper `columnSpecsFrom(widths: number[], grow: number, growMin: number, growMax: number): ColumnSpec[]` that applies the prototype's rule, and test it on that input.

- [ ] **Step 3: The accounts grid machine, with its test**

```ts
import { type DefaultedStateObservable, state } from "@rx-state/core";
import { BehaviorSubject, combineLatest, map, type Observable } from "rxjs";

import { type AccountNode, ROOT_KEY } from "@cl/domain";

import type { Machine } from "./machine.ts";

export interface GridRow {
  key: string;
  node: AccountNode;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

export interface AccountsGridState {
  rows: GridRow[];
  expanded: string[];
  search: string;
  hideEmpty: boolean;
}

export interface AccountsGridIntents {
  toggle: (key: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setSearch: (text: string) => void;
  setHideEmpty: (hide: boolean) => void;
}

export const INITIAL_EXPANDED: readonly string[] = [ROOT_KEY, "patrimonial", "assets", "liabilities", "costs", "revenue"];

interface Preferences {
  expanded: ReadonlySet<string>;
  search: string;
  hideEmpty: boolean;
}

/**
 * What the Accounts grid shows of the presenter's tree: which nodes are open,
 * the search and the hide-empty filter. One per grid on screen; the tree is
 * the presenter's and shared.
 */
export function createAccountsGridMachine(
  tree$: Observable<AccountNode | null>,
): Machine<AccountsGridState, AccountsGridIntents> {
  const preferences$ = new BehaviorSubject<Preferences>({ expanded: new Set(INITIAL_EXPANDED), search: "", hideEmpty: false });
  const latestTree = new BehaviorSubject<AccountNode | null>(null);
  const state$: DefaultedStateObservable<AccountsGridState> = state(
    combineLatest([tree$, preferences$]).pipe(
      map(([tree, preferences]) => {
        latestTree.next(tree);

        return {
          rows: tree === null ? [] : visibleRows(tree, preferences.expanded, preferences.search, preferences.hideEmpty),
          expanded: [...preferences.expanded],
          search: preferences.search,
          hideEmpty: preferences.hideEmpty,
        };
      }),
    ),
    { rows: [], expanded: [...INITIAL_EXPANDED], search: "", hideEmpty: false },
  );
  const subscription = state$.subscribe();

  function update(change: Partial<Preferences>): void {
    preferences$.next({ ...preferences$.getValue(), ...change });
  }

  return {
    state$,
    intents: {
      toggle: (key: string): void => {
        const expanded = new Set(preferences$.getValue().expanded);

        if (!expanded.delete(key)) {
          expanded.add(key);
        }

        update({ expanded });
      },
      expandAll: (): void => {
        const tree = latestTree.getValue();
        update({ expanded: new Set(tree === null ? INITIAL_EXPANDED : allKeys(tree)) });
      },
      collapseAll: (): void => {
        update({ expanded: new Set() });
      },
      setSearch: (text: string): void => {
        update({ search: text });
      },
      setHideEmpty: (hide: boolean): void => {
        update({ hideEmpty: hide });
      },
    },
    dispose: (): void => {
      subscription.unsubscribe();
      preferences$.complete();
    },
  };
}

/** The rows to draw, in order: the open nodes' children, after the filters. A search keeps a match and its ancestors, shown open. */
export function visibleRows(tree: AccountNode, expanded: ReadonlySet<string>, search: string, hideEmpty: boolean): GridRow[] {
  const needle = search.trim().toLocaleLowerCase("it");
  const kept = prune(tree, needle, hideEmpty);

  if (kept === null) {
    return [];
  }

  const rows: GridRow[] = [];

  function walk(node: AccountNode, depth: number): void {
    const hasChildren = node.children.length > 0;
    const open = needle !== "" || expanded.has(node.key);

    rows.push({ key: node.key, node, depth, hasChildren, expanded: hasChildren && open });

    if (hasChildren && open) {
      for (const child of node.children) {
        walk(child, depth + 1);
      }
    }
  }

  walk(kept, 0);

  return rows;
}

/** The subtree with the filtered-out nodes removed; null when the node itself goes. Total stays while anything under it does. */
function prune(node: AccountNode, needle: string, hideEmpty: boolean): AccountNode | null {
  const children = node.children
    .map((child) => {
      return prune(child, needle, hideEmpty);
    })
    .filter((child) => {
      return child !== null;
    });
  const matches = needle === "" || node.label.toLocaleLowerCase("it").includes(needle);
  const empty = hideEmpty && node.debit === 0 && node.credit === 0 && (node.budget === null || node.budget === 0);

  if (children.length === 0 && (!matches || (empty && node.key !== ROOT_KEY))) {
    return null;
  }

  if (children.length === 0 && needle !== "" && !matches) {
    return null;
  }

  return { ...node, children };
}

function allKeys(node: AccountNode): string[] {
  return [node.key, ...node.children.flatMap(allKeys)];
}
```

A match's ancestors survive because a node with surviving children is kept whatever its own label. Simplify `prune`'s two `if`s into one once the tests pass (the second is subsumed by the first: say so in a comment or delete it). Tests (over `createSmallSeed()` → `buildAccountTree`, the tree given through a `BehaviorSubject`):

- "shows Total and the five levels open, and the levels' children closed, at the start": rows' keys begin `["total", "patrimonial", "assets", "la10", "la4@assets", ...]` and `la10`'s row has `expanded: false`.
- "toggle opens and closes a node": after `toggle("la10")` the rows include `la1` and `la2`; again, they are gone.
- "expandAll shows every node, collapseAll only Total": lengths, and `collapseAll` gives `[{ key: "total", expanded: false }]`.
- "a search keeps the matches with their ancestors, open": `setSearch("cassa")` → rows are `total, patrimonial, assets, la10, la1` only; `setSearch("")` restores the previous expansion (la10 closed again).
- "a search that matches nothing shows no rows" (Review Focus 4): `setSearch("zzz")` → `rows` is `[]`; `setSearch("")` restores.
- "hide-empty drops a node with no amounts and no budget": `setHideEmpty(true)` then `expandAll()` → no row for `la3` (funds, never posted to) while `la30` (revenue, posted to) stays; `setHideEmpty(false)` restores `la3`.
- "dispose ends the state": after `dispose()`, `state$.getValue()` is still the last state and an intent changes nothing.

- [ ] **Step 4: The notices**

```ts
import { type DefaultedStateObservable, state } from "@rx-state/core";
import { BehaviorSubject } from "rxjs";

export interface Notice {
  id: number;
  text: string;
}

export interface Notices {
  notices$: DefaultedStateObservable<Notice[]>;
  /** For a control the design shows but M1 does not wire: says so instead of doing nothing. */
  stub: (label: string) => void;
  clear: (id: number) => void;
}

export function createNotices(): Notices {
  const notices$ = new BehaviorSubject<Notice[]>([]);
  let nextId = 1;

  return {
    notices$: state(notices$.asObservable(), []),
    stub: (label: string): void => {
      notices$.next([...notices$.getValue(), { id: nextId, text: `${label}: not yet available` }]);
      nextId += 1;
    },
    clear: (id: number): void => {
      notices$.next(
        notices$.getValue().filter((notice) => {
          return notice.id !== id;
        }),
      );
    },
  };
}
```

Test: two stubs give ids 1 and 2 with the texts; `clear(1)` leaves the second.

- [ ] **Step 5: Run, gate, commit**

Export every machine, its types and `createNotices` from the index. `pnpm fix && pnpm gate:full:quiet` → green.

```bash
git add packages/client-core
git commit -m "feat(core): the grid, columns, split, tab, maximize, sidebar and navigation machines, and the notices"
```

---

### Task 11: Tokens, fonts, and the primitives `Money`, `Panel`, `Toolbar`, `TabbedPanel`, `Scheda`

**Files:**
- Create: `packages/client-react/src/styles/tokens.css` (copied), `src/styles/fonts.css`
- Modify: `packages/client-react/src/index.css`, `packages/client-react/package.json`, `packages/client-react/src/ui/testids.ts`
- Create under `packages/client-react/src/ui/`: `format.ts` (+ `format.test.ts`), `Money.tsx` (+ `.css`, `.page.tsx`, `.test.tsx`), `Panel.tsx` (+ `.css`, `.page.tsx`, `.test.tsx`), `Toolbar.tsx` (+ `.css`, `.page.tsx`, `.test.tsx`), `TabbedPanel.tsx` (+ `.css`, `.page.tsx`, `.test.tsx`), `Scheda.tsx` (+ `.css`, `.test.tsx`)

**Interfaces:**
- Produces:

```ts
// ui/format.ts
export function formatCents(cents: Cents): string;               // en-US "1,234.56", "-607.46", "0.00"
export function parseAmount(text: string): Cents | null;          // "1,234.56" | "1234.56" | "1234" | " 12 " → cents; anything else null; "-5" → -500 (the domain decides)
export function formatDate(iso: string): string;                 // "2013-01-10T15:59:00" → "10/01/2013"
export function formatDateTime(iso: string): string;             // → "10/01/2013 15:59"

// ui/Money.tsx
export interface MoneyProps { cents: Cents | null; variant?: "colored" | "plain"; emphasis?: boolean; }
export function Money(props: MoneyProps): ReactElement;          // <span class="money" data-tone="blank|neg|zero|pos" data-variant data-emphasis>

// ui/Panel.tsx
export interface PanelProps { title: string; meta?: ReactNode; maximized?: boolean; onToggleMaximize?: () => void; children: ReactNode; }
export function Panel(props: PanelProps): ReactElement;

// ui/Toolbar.tsx
export function Toolbar({ children }: ToolbarProps): ReactElement;
export interface ToolbarButtonProps { label: string; icon?: ReactNode; tone?: "ok" | "neg" | "muted" | "plain"; iconOnly?: boolean; disabled?: boolean; onClick: () => void; }
export function ToolbarButton(props: ToolbarButtonProps): ReactElement;   // aria-label = label; shows icon, and the label unless iconOnly
export function ToolbarDivider(): ReactElement;
export interface ToolbarSearchProps { value: string; placeholder: string; onChange: (text: string) => void; }
export function ToolbarSearch(props: ToolbarSearchProps): ReactElement;
export interface ToolbarCheckboxProps { label: string; checked: boolean; onChange: (checked: boolean) => void; }
export function ToolbarCheckbox(props: ToolbarCheckboxProps): ReactElement;

// ui/TabbedPanel.tsx
export interface TabbedPanelProps { tabs: readonly string[]; active: string; onActivate: (tab: string) => void; children: ReactNode; }
export function TabbedPanel(props: TabbedPanelProps): ReactElement;

// ui/Scheda.tsx
export interface SchedaProps { wide?: boolean; children: ReactNode; }           // wide: 300px label column (Accounts), else 170px
export function Scheda(props: SchedaProps): ReactElement;
export interface FieldsetProps { legend: string; children: ReactNode; }
export function Fieldset(props: FieldsetProps): ReactElement;                   // 283px label column inside, via CSS
export interface RowProps { label: string; tone?: "accent" | "mono" | "muted" | "ok" | "num"; children: ReactNode; }
export function Row(props: RowProps): ReactElement;
```

- [ ] **Step 1: Dependencies, tokens, fonts**

```bash
pnpm --filter @cl/client-react add @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono lucide-react
cp docs/design/web/v1/tokens.css packages/client-react/src/styles/tokens.css
```

`src/styles/fonts.css`:

```css
/* IBM Plex, self-hosted: the visual host refuses any request that leaves it, and the app must not depend on a font CDN. */
@import "@fontsource/ibm-plex-sans/400.css";
@import "@fontsource/ibm-plex-sans/500.css";
@import "@fontsource/ibm-plex-sans/600.css";
@import "@fontsource/ibm-plex-sans/700.css";
@import "@fontsource/ibm-plex-mono/400.css";
@import "@fontsource/ibm-plex-mono/500.css";
```

`src/index.css` becomes:

```css
@import "./styles/tokens.css";
@import "./styles/fonts.css";

/* The prototype's global rules (Condomini.dc.html, lines 14–26). */
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body { font-family: var(--font-sans); font-size: 13px; color: var(--tx); background: var(--app); }
::-webkit-scrollbar { width: 11px; height: 11px; }
::-webkit-scrollbar-thumb { background: #c2c8d0; border-radius: 6px; }
@keyframes popIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: none; } }
```

Drop the starter's price rules from `index.css` only in Task 13 (the price list still renders until then); keep them below the new rules for now.

- [ ] **Step 2: `format.ts` with its tests first**

```ts
// format.test.ts
import { describe, expect, it } from "vitest";

import { cents } from "@cl/domain";

import { formatCents, formatDate, formatDateTime, parseAmount } from "./format.ts";

describe("formatCents", () => {
  it("writes en-US style with two decimals", () => {
    expect(formatCents(cents(123456))).toBe("1,234.56");
    expect(formatCents(cents(-60746))).toBe("-607.46");
    expect(formatCents(cents(0))).toBe("0.00");
    expect(formatCents(cents(13788287))).toBe("137,882.87");
  });
});

describe("parseAmount", () => {
  it("reads what formatCents writes, and plain numbers", () => {
    expect(parseAmount("1,234.56")).toBe(123456);
    expect(parseAmount("1234.56")).toBe(123456);
    expect(parseAmount("1234")).toBe(123400);
    expect(parseAmount(" 12 ")).toBe(1200);
    expect(parseAmount("-5")).toBe(-500);
  });

  it("answers null for anything else", () => {
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("1.2.3")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("1,23")).toBeNull();
  });
});

describe("dates", () => {
  it("writes dd/mm/yyyy and dd/mm/yyyy hh:mm", () => {
    expect(formatDate("2013-01-10T15:59:00")).toBe("10/01/2013");
    expect(formatDateTime("2013-01-10T15:59:00")).toBe("10/01/2013 15:59");
  });
});
```

`format.ts`: `formatCents` with `new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)`; `parseAmount` matches `/^-?\d{1,3}(,\d{3})*(\.\d{1,2})?$|^-?\d+(\.\d{1,2})?$/` on the trimmed text, strips the commas, multiplies by 100 and rounds; the dates by slicing the ISO string (no `Date`: the timezone must not move them).

- [ ] **Step 3: `Money`**

```tsx
// Money.tsx
import type { ReactElement } from "react";

import type { Cents } from "@cl/domain";

import { formatCents } from "./format.ts";
import { TESTIDS } from "./testids.ts";
import "./Money.css";

export interface MoneyProps {
  cents: Cents | null;
  /** `plain` is the Journal and Ledger's Debit/Credit: text colour, grey when zero. */
  variant?: "colored" | "plain";
  /** Aggregates: group rows and totals. */
  emphasis?: boolean;
}

/** A money cell: right-aligned, tabular digits, coloured by sign. Formatting only; the number is the core's. */
export function Money({ cents, variant = "colored", emphasis = false }: MoneyProps): ReactElement {
  return (
    <span className="money" data-testid={TESTIDS.money} data-tone={toneOf(cents)} data-variant={variant} data-emphasis={emphasis}>
      {cents === null ? "" : formatCents(cents)}
    </span>
  );
}

function toneOf(cents: Cents | null): "blank" | "neg" | "zero" | "pos" {
  if (cents === null) {
    return "blank";
  }

  if (cents < 0) {
    return "neg";
  }

  return cents === 0 ? "zero" : "pos";
}
```

`Money.css` (README *Money cell*): `.money { display:block; text-align:right; font-variant-numeric: tabular-nums; font-size: 11.5px; padding: 3px 8px; white-space: nowrap; font-weight: 500; }`, `[data-emphasis="true"] { font-weight: 700; }`, `[data-variant="colored"][data-tone="neg"] { color: var(--neg); }`, `[data-variant="colored"][data-tone="zero"] { color: var(--txd); }`, `[data-variant="colored"][data-tone="pos"] { color: var(--num); }`, `[data-variant="plain"] { color: var(--tx); }`, `[data-variant="plain"][data-tone="zero"] { color: var(--txd); }`.

Page object `mountMoney(props): { text(): string; tone(): string }` reading the test id; tests: the four tones, the blank, the plain variant.

- [ ] **Step 4: `Panel`, `Toolbar`, `TabbedPanel`, `Scheda`**

Each in the same shape. The values (README *Panel*, *Tabbed panel*, *Toolbar*, *Scheda*):

- `Panel`: `.panel { background: var(--panel); border: 1px solid var(--bd); border-radius: 7px; overflow: hidden; display: flex; flex-direction: column; min-height: 0; }`; `.panel-header { background: var(--ph); border-bottom: 1px solid var(--bd); padding: 5px 11px; display: flex; align-items: center; gap: 8px; }`; title `12px/600 var(--phf)`; `.panel-meta { margin-left: auto; font-size: 11.5px; color: var(--txd); }`; maximize button `22×20, radius 4, border var(--bd), background var(--ctrl)` with lucide `Maximize2`/`Minimize2`, `aria-label` "Maximize"/"Restore", test id `TESTIDS.panelMaximize`; `.panel-body { flex: 1; min-height: 0; overflow: auto; }`. Page object: `mountPanel(props)` → `title()`, `clickMaximize()`, `maximizeLabel()`.
- `Toolbar`: `.toolbar { display: flex; gap: 6px; padding: 4px 8px; border-bottom: 1px solid var(--bd2); align-items: center; }`; button `height 24px; border-radius 5px; border 1px solid var(--bd); background var(--ctrl); font-size 12px; padding 0 8px` (icon-only: `width 26px; padding 0`), hover `background var(--hover)`, `[data-tone="ok"] { color: var(--ok); font-weight: 700 }`, `neg` likewise, `muted { color: var(--txd) }`; divider `width 1px; height 16px; background var(--bd); margin 0 3px`; search `width 220px; background var(--ctrl); border 1px solid var(--bd); border-radius 5px; padding 4px 8px; font-size 12px` with a lucide `Search` 13px and an `<input aria-label={placeholder}>`; checkbox a `<label>` with a real `<input type="checkbox">`, 12px. Test ids: `toolbarButton`, `toolbarSearch`, `toolbarCheckbox`. Page object: `mountToolbar(children)` → `click(label)`, `type(text)` (user-event into the search), `toggle(label)`.
- `TabbedPanel`: `.tabbed-tabs { display: flex; gap: 3px; }`; tab `padding 6px 16px; border 1px solid var(--bd); border-radius 7px 7px 0 0; font-size 12px; margin-bottom -1px; background var(--ph); color var(--txd); font-weight 500`, `[aria-selected="true"] { background: var(--panel); border-bottom-color: var(--panel); color: var(--tx); font-weight: 600; z-index: 2; }`; the panel below `.tabbed-body` has `border-radius 0 7px 7px 7px` and the `Panel` look (border, background, overflow). `role="tablist"` / `role="tab"`. Page object: `activeTab()`, `activate(name)`.
- `Scheda`: `.scheda { padding: 14px 18px; max-width: 900px; display: grid; gap: 9px; }`; `.scheda-row { display: grid; grid-template-columns: 170px 1fr; font-size: 12.5px; align-items: center; }`, `.scheda[data-wide="true"] .scheda-row { grid-template-columns: 300px 1fr; }`, `.scheda-fieldset .scheda-row { grid-template-columns: 156px 1fr; }` and wide: `283px 1fr`; label `color var(--txd); font-weight 600`; value `color var(--tx)` with tones: `accent → var(--acc)`, `mono → font-family var(--font-mono)`, `muted → var(--txd)`, `ok → var(--ok)`, `num → var(--num); font-weight 600`; fieldset `border 1px solid var(--bd2); border-radius 7px; padding 6px 14px 12px; max-width 760px`, legend `11px/700 uppercase var(--txd); letter-spacing .04em; padding 0 6px`. Test: renders label and value with the tone attribute.

- [ ] **Step 5: Fix, gate, commit**

`pnpm fix && pnpm gate:full:quiet` → green (the `dumb-ui` gate: none of these imports a stream, storage or timer; the React rules lint: no hooks beyond what the compiler allows). Dependency review (CI) sees three new packages: `lucide-react` is ISC, the two fonts are OFL, neither refused.

```bash
git add packages/client-react pnpm-lock.yaml
git commit -m "feat(client): the handoff's tokens, self-hosted IBM Plex, and the Money, Panel, Toolbar, TabbedPanel and Scheda primitives"
```

---

### Task 12: `TreeGrid` and `InlineEditor`

**Files:**
- Create under `packages/client-react/src/ui/`: `TreeGrid.tsx`, `TreeGrid.css`, `TreeGrid.page.tsx`, `TreeGrid.test.tsx`, `InlineEditor.tsx`, `InlineEditor.css`, `InlineEditor.page.tsx`, `InlineEditor.test.tsx`
- Modify: `testids.ts`

**Interfaces:**
- Produces:

```ts
export interface TreeGridColumn { header: string; align?: "left" | "right" | "center"; }
export interface TreeGridRowData {
  key: string; depth: number; hasChildren: boolean; expanded: boolean; selected: boolean;
  emphasis: boolean;          // bold label (a node with children)
  zebra: boolean;             // the root row's background
  icon: ReactNode;            // drawn in the label cell before the text
  label: string;
  cells: ReactNode[];         // one per column after the first
}
export interface TreeGridProps {
  columns: TreeGridColumn[];           // the first is the tree column
  template: string;                    // grid-template-columns, from the columns machine
  rows: TreeGridRowData[];
  footer?: ReactNode[];                // one per column; sticky bottom
  emptyMessage: string;
  onToggle: (key: string) => void;
  onSelect: (key: string) => void;
  onResize: (index: number, px: number) => void;
}
export function TreeGrid(props: TreeGridProps): ReactElement;
export function TreeGridRow(props: TreeGridRowProps): ReactElement;   // the compiled row; listed in compilerTracked in Task 17

export interface InlineEditorProps { value: string; error: string | null; onCommit: (text: string) => void; onCancel: () => void; }
export function InlineEditor(props: InlineEditorProps): ReactElement;  // an <input> focused on mount; Enter and blur commit, Escape cancels; the error under it in --neg
```

- [ ] **Step 1: The page object and tests first**

`TreeGrid.page.tsx` exports `mountTreeGrid(props: Partial<TreeGridProps>): TreeGridPage` with defaults (three columns `Accounts | Debit | Credit`, the template `"minmax(200px,1fr) 100px 100px"`, two rows) and: `rowLabels(): string[]`, `depthOf(label): number` (from `data-depth`), `isExpanded(label): boolean` (`aria-expanded`), `isSelected(label)` (`aria-selected`), `clickCaret(label)`, `clickRow(label)`, `dragBoundary(index, byPx)` (pointer down on the handle, move, up: `fireEvent.pointerDown/pointerMove/pointerUp` with `clientX`), `emptyMessage(): string | null`, `footerTexts(): string[]`, `template(): string` (reads the CSS variable on the grid element). Tests:

- "draws one row per item with its depth, caret and selection state".
- "a click on the caret toggles, a click on the row selects" (spies passed as props).
- "a row without children has no caret, only a spacer".
- "shows the empty message when there are no rows, and the footer when given".
- "dragging a header boundary reports the column and the new width".
- "applies the template it is given" and "applies a new template when it changes" (rerender with another template; read the variable).

`InlineEditor.page.tsx`: `mountInlineEditor(props)` → `type(text)`, `pressEnter()`, `pressEscape()`, `blur()`, `errorText()`, `isFocused()`. Tests: focused on mount; Enter commits the typed text; blur commits; Escape cancels and does not commit; the error shows under the input.

- [ ] **Step 2: Implement `TreeGrid`**

```tsx
import { ChevronDown, ChevronRight } from "lucide-react";
import { type PointerEvent, type ReactElement, type ReactNode, useEffect, useRef } from "react";

import { TESTIDS } from "./testids.ts";
import "./TreeGrid.css";

// (interfaces from the block above)

const INDENT_PX = 16;
const INDENT_BASE_PX = 8;

/**
 * A tree as CSS-grid rows. The column template comes from the columns machine
 * and is written as a CSS variable on the grid element in an effect: a
 * template is data the stylesheet cannot know, and this package writes no
 * inline style.
 */
export function TreeGrid({ columns, template, rows, footer, emptyMessage, onToggle, onSelect, onResize }: TreeGridProps): ReactElement {
  const grid = useRef<HTMLDivElement>(null);

  useEffect(() => {
    grid.current?.style.setProperty("--tree-grid-template", template);
  }, [template]);

  return (
    <div className="tree-grid" role="grid" ref={grid} data-testid={TESTIDS.treeGrid}>
      <div className="tree-grid-header" role="row">
        {columns.map((column, index) => {
          return (
            <div key={column.header} className="tree-grid-head" role="columnheader" data-align={column.align ?? "left"}>
              {column.header}
              {index > 0 ? <ResizeHandle index={index - 1} onResize={onResize} /> : null}
            </div>
          );
        })}
      </div>
      {rows.length === 0 ? <div className="tree-grid-empty">{emptyMessage}</div> : null}
      {rows.map((row) => {
        return <TreeGridRow key={row.key} row={row} columns={columns} onToggle={onToggle} onSelect={onSelect} />;
      })}
      {footer === undefined ? null : (
        <div className="tree-grid-footer" role="row" data-testid={TESTIDS.treeGridFooter}>
          {footer.map((cell, index) => {
            return (
              <div key={columns[index]?.header ?? index} role="gridcell" data-align={columns[index]?.align ?? "left"}>
                {cell}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface TreeGridRowProps {
  row: TreeGridRowData;
  columns: TreeGridColumn[];
  onToggle: (key: string) => void;
  onSelect: (key: string) => void;
}

/** One row. Compiled by the React Compiler: the grid re-renders on every tree change and the rows that did not change are skipped. */
export function TreeGridRow({ row, columns, onToggle, onSelect }: TreeGridRowProps): ReactElement {
  function select(): void {
    onSelect(row.key);
  }

  function toggle(event: { stopPropagation: () => void }): void {
    event.stopPropagation();
    onToggle(row.key);
  }

  return (
    <div
      className="tree-grid-row"
      role="row"
      data-testid={TESTIDS.treeGridRow}
      data-depth={row.depth}
      data-zebra={row.zebra}
      data-emphasis={row.emphasis}
      aria-selected={row.selected}
      aria-expanded={row.hasChildren ? row.expanded : undefined}
      onClick={select}
    >
      <div role="gridcell" className="tree-grid-label" data-depth={row.depth}>
        {row.hasChildren ? (
          <button type="button" className="tree-grid-caret" aria-label={row.expanded ? "Collapse" : "Expand"} onClick={toggle} data-testid={TESTIDS.treeGridCaret}>
            {row.expanded ? <ChevronDown size={13} strokeWidth={3} /> : <ChevronRight size={13} strokeWidth={3} />}
          </button>
        ) : (
          <span className="tree-grid-caret" />
        )}
        <span className="tree-grid-icon">{row.icon}</span>
        <span className="tree-grid-text">{row.label}</span>
      </div>
      {row.cells.map((cell, index) => {
        return (
          <div key={columns[index + 1]?.header ?? index} role="gridcell" data-align={columns[index + 1]?.align ?? "left"}>
            {cell}
          </div>
        );
      })}
    </div>
  );
}

interface ResizeHandleProps {
  index: number;
  onResize: (index: number, px: number) => void;
}

/** The 11px hit area over a header boundary. Pointer capture keeps the drag on the handle, so nothing listens on the document. */
function ResizeHandle({ index, onResize }: ResizeHandleProps): ReactElement {
  const startX = useRef(0);
  const startWidth = useRef(0);

  function down(event: PointerEvent<HTMLSpanElement>): void {
    const cell = event.currentTarget.parentElement;
    startX.current = event.clientX;
    startWidth.current = cell?.getBoundingClientRect().width ?? 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent<HTMLSpanElement>): void {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      onResize(index, Math.round(startWidth.current + event.clientX - startX.current));
    }
  }

  function up(event: PointerEvent<HTMLSpanElement>): void {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return <span className="tree-grid-resize" data-testid={TESTIDS.treeGridResize} onPointerDown={down} onPointerMove={move} onPointerUp={up} />;
}
```

The indent (`8 + depth × 16` px) is drawn with spacer elements, not a per-row style: render `row.depth` times `<span className="tree-grid-indent" />` (16px each) before the caret, and give the label cell `padding-left: 8px`. The `data-depth` attribute stays for the page object.

jsdom has no pointer capture: in `TreeGrid.page.tsx`, polyfill `setPointerCapture`, `releasePointerCapture` and `hasPointerCapture` on `HTMLElement.prototype` (a flag on the element) before mounting; that is test plumbing and lives only in the page object.

`TreeGrid.css` (README *Data grid*): `.tree-grid { display: grid; grid-template-columns: var(--tree-grid-template); align-content: start; min-width: max-content; overflow: auto; height: 100%; }`; header and rows are `display: contents` is not enough for sticky, so each row is `display: grid; grid-template-columns: var(--tree-grid-template); grid-column: 1 / -1;` and the grid itself is a block with `overflow: auto`; header `position: sticky; top: 0; z-index: 1; background: var(--ph); border-bottom: 1px solid var(--bd); font-size: 10.5px; font-weight: 600; color: var(--phf);` cells `padding: 6px 8px; position: relative`; body cells `padding: 4px 8px; font-size: 12px; align-items: center`; row `border-bottom: 1px solid var(--bd2)`; `[data-align="right"] { text-align: right }`, center likewise; `[data-zebra="true"] { background: var(--zebra) }`; `[data-emphasis="true"] .tree-grid-text { font-weight: 700 }`; `[aria-selected="true"] { background: var(--sel); box-shadow: inset 3px 0 0 var(--acc); }` and its text 600; caret `width 17px; color var(--acc); background none; border 0; padding 0; cursor pointer`; `.tree-grid-indent { display: inline-block; width: 16px }`; `.tree-grid-resize { position: absolute; left: -6px; top: 0; bottom: 0; width: 11px; cursor: col-resize; border-left: 1px solid var(--bd); margin-left: 5px }` hover `background: rgba(120,140,170,.22)`; footer `position: sticky; bottom: 0; border-top: 2px solid var(--bd); background: var(--zebra); font-weight: 700`; empty `text-align: center; font-size: 12px; color: var(--txd); padding: 18px`.

- [ ] **Step 3: Implement `InlineEditor`**

An `<input className="inline-editor" autoFocus>` (the `jsx-a11y` autofocus rule, if it fires, is answered with a `useEffect` calling `focus()` on a ref instead) with `defaultValue={value}`, `onKeyDown` (Enter → `onCommit(current)`, Escape → `onCancel()`), `onBlur` → `onCommit`, and `{error === null ? null : <div className="inline-editor-error">{error}</div>}`. A ref flag `cancelled` set on Escape stops the blur that follows from committing. CSS (README *Inline editors*): `width: 100%; text-align: right; border: 1px solid var(--acc); border-radius: 4px; padding: 2px 6px; font-size: 11.5px; background: var(--ctrl); font: inherit`; error `color: var(--neg); font-size: 11px; padding: 2px 6px`.

- [ ] **Step 4: Fix, gate, commit**

```bash
git add packages/client-react
git commit -m "feat(client): TreeGrid with resizable columns, carets and a sticky footer; InlineEditor"
```

---

### Task 13: The composition switch: `createApp`, the harness, the view model; the price sample leaves

**Files:**
- Modify: `packages/client-core/src/composition.ts`, `composition.test.ts`, `testing/appHarness.ts`, `index.ts`
- Delete: `packages/client-core/src/presenters/pricesPresenter.ts` (+ test), `machines/selectionMachine.ts` (+ test)
- Delete: `packages/domain/src/entities/price.ts`, `ports/pricePort.ts`, `ports/__contracts__/PricePortContract.ts`, `simulators/priceSimulator.ts` (+ its two tests), `useCases/trackMovement.ts` (+ test); modify `packages/domain/src/index.ts`
- Modify: `packages/react-bindings/src/createViewModel.ts`, `viewModel.page.tsx`, `viewModel.test.tsx`, `useMachine.page.tsx` and `useMachine.test.tsx` (they use the selection machine as a fixture: switch them to `createSplitMachine`)
- Create: `packages/react-bindings/src/useSharedMachine.ts`
- Modify: `packages/client-react/src/ui/App.tsx`, `src/app/startApp.tsx`, `startApp.page.tsx`, `startApp.test.tsx`, `src/app/buildPorts.ts`, `buildPorts.test.ts`, `src/index.css` (drop the price rules), `src/ui/testids.ts`; delete `src/ui/PriceList.tsx` (+ page, test)
- Modify: `packages/client-react/tests/visual/scenarios.ts`, `seeding.ts`; delete `tests/visual/goldens/**/*.png`
- Modify: `architecture.config.mts` (`compilerTracked: []` until Task 17)

**Interfaces:**
- Produces:

```ts
// client-core composition.ts
export interface AppPorts { session: SessionPort; buildings: BuildingsPort; accounts: AccountsPort; journal: JournalPort; }
export interface AppPresenters { session: SessionPresenter; buildings: BuildingsPresenter; accounts: AccountsPresenter; }
export interface AppMachines {
  createAccountsGrid: () => Machine<AccountsGridState, AccountsGridIntents>;
  createColumns: (spec: readonly ColumnSpec[]) => Machine<ColumnsState, ColumnsIntents>;
  createSplit: () => Machine<SplitState, SplitIntents>;
  createBottomTab: (tabs: readonly string[]) => Machine<BottomTabState, BottomTabIntents>;
  createMaximize: () => Machine<MaximizeState, MaximizeIntents>;
  createSidebar: () => Machine<SidebarState, SidebarIntents>;
}
export interface App { presenters: AppPresenters; navigation: Machine<NavigationState, NavigationIntents>; notices: Notices; machines: AppMachines; }
export function createApp(ports: AppPorts): App;
export function createSimulatorPorts(seed: LegacySeed): AppPorts;   // session (DESIGN_PRINCIPAL, DESIGN_FIRM), buildings, accounts, journal simulators

// client-core testing/appHarness.ts
export interface AppHarness { app: App; ports: AppPorts; seed: LegacySeed; }
export function createAppHarness(seed?: LegacySeed): AppHarness;    // default: loadLegacySeed(legacySeedData), the real books

// react-bindings
export interface SessionView { principal: Principal | null; firm: Firm | null; preferences: Preferences; setMode: …; setTheme: …; setLanguage: …; }
export interface SelectedPeriodView { selected: PeriodSelection | null; selectPeriod: (periodId: string) => void; }
export interface SelectedAccountView { key: string; node: AccountNode | null; select: (key: string) => void; }
export interface NoticesView { notices: Notice[]; stub: (label: string) => void; clear: (id: number) => void; }
export interface ViewModel {
  useSession: () => SessionView;
  useBuildingsTree: () => Building[];
  useSelectedPeriod: () => SelectedPeriodView;
  useAccountsTree: () => AccountNode | null;
  useSelectedAccount: () => SelectedAccountView;
  useLedger: () => Ledger | null;
  useAccountDetails: () => AccountDetails | null;
  useSetBudget: () => (accountId: string, budget: Cents) => Promise<Result>;
  useNavigation: () => MachineView<NavigationState, NavigationIntents>;
  useNotices: () => NoticesView;
  useAccountsGrid: () => MachineView<AccountsGridState, AccountsGridIntents>;
  useColumns: (spec: readonly ColumnSpec[]) => MachineView<ColumnsState, ColumnsIntents>;
  useSplit: () => MachineView<SplitState, SplitIntents>;
  useBottomTab: (tabs: readonly string[]) => MachineView<BottomTabState, BottomTabIntents>;
  useMaximize: () => MachineView<MaximizeState, MaximizeIntents>;
  useSidebar: () => MachineView<SidebarState, SidebarIntents>;
}
export function createViewModel(app: App): ViewModel;
export function useSharedMachine<TState, TIntents extends object>(machine: Machine<TState, TIntents>): MachineView<TState, TIntents>;   // for the app-wide navigation
```

- [ ] **Step 1: Core**

`composition.ts`:

```ts
export function createApp(ports: AppPorts): App {
  const session = createSessionPresenter(ports.session);
  const buildings = createBuildingsPresenter(ports.buildings);
  const accounts = createAccountsPresenter({ accounts: ports.accounts, journal: ports.journal }, buildings.selected$);

  return {
    presenters: { session, buildings, accounts },
    navigation: createNavigationMachine(),
    notices: createNotices(),
    machines: {
      createAccountsGrid: (): Machine<AccountsGridState, AccountsGridIntents> => {
        return createAccountsGridMachine(accounts.tree$);
      },
      createColumns: createColumnsMachine,
      createSplit: createSplitMachine,
      createBottomTab: createBottomTabMachine,
      createMaximize: createMaximizeMachine,
      createSidebar: createSidebarMachine,
    },
  };
}

/** The four simulators over one seed: what `pnpm dev` and the harness run on. */
export function createSimulatorPorts(seed: LegacySeed): AppPorts {
  return {
    session: createSessionSimulator({ principal: DESIGN_PRINCIPAL, firm: DESIGN_FIRM }),
    buildings: createBuildingsSimulator(seed),
    accounts: createAccountsSimulator(seed),
    journal: createJournalSimulator(seed),
  };
}
```

`testing/appHarness.ts`:

```ts
import { type LegacySeed, loadLegacySeed } from "@cl/domain";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";

import { type App, type AppPorts, createApp, createSimulatorPorts } from "../composition.ts";

export interface AppHarness {
  app: App;
  ports: AppPorts;
  seed: LegacySeed;
}

/** The real application on the simulators, over the real seed unless a test brings its own. Only this file calls createApp. */
export function createAppHarness(seed: LegacySeed = loadLegacySeed(legacySeedData)): AppHarness {
  const ports = createSimulatorPorts(seed);

  return { app: createApp(ports), ports, seed };
}
```

`composition.test.ts`: "wires the accounts presenter to the selected period" (over `createSmallSeed()`: subscribe `app.presenters.accounts.tree$`, expect a tree with `debit` 212619), "each grid machine is its own" (two `createAccountsGrid()` calls, toggle on one, the other unchanged), "runs on the real seed by default" (`createAppHarness().seed.buildings` has two). Delete the price code listed in **Files**; remove their exports from both indexes; `index.css` loses the price rules.

- [ ] **Step 2: Bindings**

`useSharedMachine.ts`:

```ts
import { useStateObservable } from "@react-rxjs/core";

import type { Machine } from "@cl/client-core";

import type { MachineView } from "./useMachine.ts";

/** A machine the application owns (one per app, not per component): read its state, hand out its intents. */
export function useSharedMachine<TState, TIntents extends object>(machine: Machine<TState, TIntents>): MachineView<TState, TIntents> {
  return { state: useStateObservable(machine.state$), ...machine.intents };
}
```

`createViewModel.ts`: every hook in the **Interfaces** block; stream hooks are `useStateObservable(app.presenters.….…$)`; `useSession` combines three and the three intents; `useSelectedPeriod` reads `selected$` and gives `selectPeriod`; `useSelectedAccount` reads `selectedKey$` and `selectedNode$`; `useSetBudget` returns `app.presenters.accounts.setBudget`; machine hooks are `useMachine(app.machines.createX)` and, for the ones with an argument, `useMachine(() => { return app.machines.createColumns(spec); })`; `useNavigation` and `useNotices` through `useSharedMachine` / `useStateObservable(app.notices.notices$)`.

`viewModel.page.tsx` mounts a `Reader` that reads `useBuildingsTree`, `useSelectedPeriod`, `useAccountsTree` and `useNavigation` over `createAppHarness(createSmallSeed())`; its test: "reads the buildings and the selected period", "selectPeriod moves the selection", "reads the accounts tree of the selected period" (root debit 212619), "the navigation is shared between two readers". The provider-less test stays. The `useMachine` tests take `createSplitMachine` as their fixture.

- [ ] **Step 3: Client**

`App.tsx` becomes a placeholder until Task 15: `<main className="app-placeholder"><h1>CondoLedger</h1></main>`. `startApp.tsx`: `createViewModel(createApp(buildPorts(import.meta.env.VITE_SERVER_URL)))` unchanged in shape; `buildPorts.ts`:

```ts
export function buildPorts(serverUrl: string | undefined): AppPorts {
  if (serverUrl) {
    throw new Error(`a server URL is set (${serverUrl}) but the server's ports arrive in M3`);
  }

  console.info("[data] composed sim: no VITE_SERVER_URL");

  return createSimulatorPorts(loadLegacySeed(legacySeedData));
}
```

Its test: the simulator branch answers two buildings; the live branch throws. `startApp.test.tsx`: the heading is "CondoLedger"; `stop()` leaves the root blank. Delete `PriceList*` and the price test ids; keep `testids.ts` with the Task 11–12 ids.

Visual: `scenarios.ts` exports `export interface Scenario { mode?: "light" | "dark"; }` and `export const scenarios: Record<string, Scenario> = {};`; `seeding.ts`:

```ts
export function seedScenario(scenario: Scenario, clock: HostClock): Seeded {
  const harness = createAppHarness();

  return {
    app: harness.app,
    deliver: (): void => {
      if (scenario.mode !== undefined) {
        void harness.ports.session.setPreference({ mode: scenario.mode });
      }

      clock.tick(0);
    },
  };
}
```

(`void` on a promise that cannot fail: the simulator resolves synchronously; say so in a comment above, as the strict-lint section requires). Delete every golden under `tests/visual/goldens/`; with no scenario and no golden folder, `pnpm visual` has nothing to compare and the orphan test skips. `architecture.config.mts`: `compilerTracked: []`.

- [ ] **Step 4: Fix, gate, commit**

`pnpm fix && pnpm gate:full:quiet` → green; `pnpm dev` shows the placeholder with the tokens' background and IBM Plex. Commit:

```bash
git add -A packages architecture.config.mts
git commit -m "feat(core,bindings,client): compose the four ports; the price sample leaves every package

createApp wires the session, buildings and accounts presenters, the
app-wide navigation and notices, and the per-component machine
factories; the harness runs the real seed by default. The view model
exposes one hook per stream and per machine. The client renders a
placeholder until the shell lands; the visual tier has no scenario
until the screen does."
```

---

### Task 14: The oracle fixture, proven against the design's file, and the presenter's reconciliation test

**Files:**
- Create: `packages/legacy-import/src/oracle/designOracle.ts` (where the file is, parsing), `packages/legacy-import/src/oracle/writeFixture.ts` (a program), `packages/legacy-import/specs/oracleFixture.test.ts`
- Create (written by the program): `packages/client-core/src/testing/fixtures/pozzetto2013.oracle.ts`
- Create: `packages/client-core/src/presenters/accountsPresenter.oracle.test.ts`
- Modify: `tools/strict-lint/knip.jsonc` (the program is an entry), `packages/legacy-import/package.json` (script `gen:oracle-fixture`)

**Interfaces:**
- Produces:

```ts
// client-core testing/fixtures/pozzetto2013.oracle.ts (generated; a header comment lists the deviations)
export interface OracleNode { key: string; debit: number; credit: number; balance: number; budget: number | null; children: OracleNode[]; }
export const POZZETTO_2013_ORACLE: OracleNode;

// legacy-import src/oracle/designOracle.ts
export function designOraclePath(): string;          // $DESIGN_ORACLE_DIR or <cwd>/../../docs/design/web/v1/reports/pozzetto, plus acc.json
export function designOracleAvailable(): boolean;
export function oracleSuiteName(name: string): string;   // "<name> (SKIPPED: <path> is not on this machine)" when absent
export interface DesignNode { id: string; label: string; debit: number; credit: number; balance: number; budget: number | null; kids: DesignNode[]; }
export function parseDesignOracle(json: string): DesignNode;     // Italian "1.234,56" strings → cents
export interface Deviation { oracleId: string; kind: "oracle-only" | "moved"; fixtureKey?: string; reason: string; }
export const DEVIATIONS: Deviation[];
export function renderOracleFixture(root: AccountNode, deviations: Deviation[]): string;   // the TS module text, header included
```

- [ ] **Step 1: The program that writes the fixture from the derived tree**

`src/oracle/writeFixture.ts` (knip entry, script `"gen:oracle-fixture": "node src/oracle/writeFixture.ts"`): loads `legacySeedData` through `loadLegacySeed`, filters Pozzetto 2013 (`p36`), builds the tree with `buildAccountTree`, and writes `renderOracleFixture(tree, DEVIATIONS)` to `../../../client-core/src/testing/fixtures/pozzetto2013.oracle.ts` (resolved from `import.meta.url`). `renderOracleFixture` maps each node to `{ key, debit, credit, balance, budget, children }` (plain numbers) and prefixes:

```
// GENERATED by `pnpm --filter @cl/legacy-import gen:oracle-fixture` from the derived tree of Pozzetto 2013.
// Proven against docs/design/web/v1/reports/pozzetto/acc.json by packages/legacy-import/specs/oracleFixture.test.ts
// (local only: that file holds real names and is not in git). Where the oracle and the dump disagree, the dump wins:
//   - <oracleId> <kind>: <reason>        (one line per DEVIATIONS entry)
```

Start `DEVIATIONS` empty. Run the program; the fixture appears.

- [ ] **Step 2: The local check against `acc.json`**

`specs/oracleFixture.test.ts`:

```ts
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { POZZETTO_2013_ORACLE, type OracleNode } from "@cl/client-core/testing/fixtures/pozzetto2013.oracle.ts";

import { type DesignNode, designOracleAvailable, designOraclePath, DEVIATIONS, oracleSuiteName, parseDesignOracle } from "#/oracle/designOracle.ts";

describe.skipIf(!designOracleAvailable())(oracleSuiteName("the committed fixture against the design's acc.json"), () => {
  it("has the same amounts on every node, walked in the report's order", () => {
    const design = parseDesignOracle(readFileSync(designOraclePath(), "utf8"));
    const mismatches: string[] = [];

    compare(design, POZZETTO_2013_ORACLE, mismatches);

    expect(mismatches).toEqual([]);
  });
});

/** Walks both trees together. An oracle-only node is skipped; a moved one is compared by its named key; the rest pair up by position. */
function compare(design: DesignNode, fixture: OracleNode, mismatches: string[]): void {
  const amounts = [design.debit, design.credit, design.balance];
  const ours = [fixture.debit, fixture.credit, fixture.balance];

  if (amounts.join() !== ours.join() || (design.budget !== null && design.budget !== fixture.budget)) {
    mismatches.push(`${design.id} "${design.label}" ${amounts.join("/")} budget ${design.budget} vs ${fixture.key} ${ours.join("/")} budget ${fixture.budget}`);
  }

  const kids = design.kids.filter((kid) => {
    return !DEVIATIONS.some((deviation) => {
      return deviation.oracleId === kid.id && deviation.kind === "oracle-only";
    });
  });
  const moved = new Map(
    DEVIATIONS.filter((deviation) => {
      return deviation.kind === "moved";
    }).map((deviation) => {
      return [deviation.oracleId, deviation.fixtureKey];
    }),
  );
  const ownKids = kids.filter((kid) => {
    return !moved.has(kid.id);
  });

  if (ownKids.length !== fixture.children.length) {
    mismatches.push(`${design.id} "${design.label}" has ${ownKids.length} children, ${fixture.key} has ${fixture.children.length}: [${fixture.children.map((child) => { return child.key; }).join(", ")}]`);
    return;
  }

  ownKids.forEach((kid, index) => {
    compare(kid, fixture.children[index] as OracleNode, mismatches);
  });

  for (const kid of kids) {
    const key = moved.get(kid.id);

    if (key !== undefined) {
      const target = findKey(POZZETTO_2013_ORACLE, key);

      if (target === undefined) {
        mismatches.push(`moved ${kid.id} names an unknown fixture key ${key}`);
      } else {
        compare(kid, target, mismatches);
      }
    }
  }
}

function findKey(node: OracleNode, key: string): OracleNode | undefined {
  if (node.key === key) {
    return node;
  }

  for (const child of node.children) {
    const found = findKey(child, key);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}
```

`parseDesignOracle`: JSON of `{ id, label, icon, m: string[], kids?: [] }`; `m[0..2]` → cents by `Number(s.replace(/\./g, "").replace(",", "."))` rounded to cents; `m[3]` → budget or null.

- [ ] **Step 3: Run the check and settle every mismatch**

Run: `pnpm --filter @cl/legacy-import test -- oracleFixture`. The first run lists mismatches. For each, decide with the data in front of you, in this order:

1. The derivation rule is wrong (an order, a side, a grouping the report does differently): fix `buildAccountTree` (Task 4) with a test for the rule, regenerate the fixture, run again.
2. The oracle differs from the dump (a parent not summing its children, a leaf the dump does not have, an account placed under another in the mock): add a `DEVIATIONS` entry with the reason, regenerate (the header lists it), run again. Known from the survey: `acc-costi`'s own debit (36.466,90 vs its children's 34.412,72), `acc-p132` Elevator under "Water fixed quota (tenants)" (the dump has it at the root: `moved` to `la219`), `acc-p184` and `acc-p188` zero leaves the dump has not (`oracle-only`); the Costs node's missing budget (the oracle has none, the fixture rolls one up: the comparison only checks a budget the oracle has, so no entry is needed).
3. Postings with no counterpart on a control account (`…/none` rows) show up here as extra children: if the dump has them, the report must have put them somewhere; find where (the PDF `piano-conti.pdf` beside `acc.json` shows the printed tree) and either fix the rule or record the deviation.

End with the check green and `DEVIATIONS` documented. Put the list of what you found, mismatch by mismatch, in the commit message.

- [ ] **Step 4: The presenter's reconciliation test, which runs everywhere**

`packages/client-core/src/presenters/accountsPresenter.oracle.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { AccountNode } from "@cl/domain";

import { createAppHarness } from "../testing/appHarness.ts";
import { type OracleNode, POZZETTO_2013_ORACLE } from "../testing/fixtures/pozzetto2013.oracle.ts";

describe("the Accounts screen on Pozzetto 2013", () => {
  it("reconciles every node of the chart of accounts to the oracle: keys, amounts, budgets, children", () => {
    const { app } = createAppHarness();
    let tree: AccountNode | null = null;
    app.presenters.accounts.tree$.subscribe((next) => {
      tree = next;
    });

    app.presenters.buildings.selectPeriod("p36");

    const mismatches: string[] = [];
    compare(POZZETTO_2013_ORACLE, tree, mismatches);
    expect(mismatches).toEqual([]);
    expect(tree).toMatchObject({ debit: 13788287, credit: 13788287, balance: 0 });
  });
});

function compare(expected: OracleNode, actual: AccountNode | null, mismatches: string[]): void {
  if (actual === null) {
    mismatches.push("no tree");
    return;
  }

  if (expected.key !== actual.key || expected.debit !== actual.debit || expected.credit !== actual.credit || expected.balance !== actual.balance || expected.budget !== actual.budget) {
    mismatches.push(`${expected.key} ${expected.debit}/${expected.credit}/${expected.balance}/${expected.budget} vs ${actual.key} ${actual.debit}/${actual.credit}/${actual.balance}/${actual.budget}`);
  }

  if (expected.children.length !== actual.children.length) {
    mismatches.push(`${expected.key}: ${expected.children.length} children expected, ${actual.children.length} found`);
    return;
  }

  expected.children.forEach((child, index) => {
    compare(child, actual.children[index] ?? null, mismatches);
  });
}
```

- [ ] **Step 5: Fix, gate, commit**

knip: add `"src/oracle/writeFixture.ts"` to the legacy-import `entry` list with the comment "writes the oracle fixture into client-core; run by the gen:oracle-fixture script". The fixture file is test code (`testing/`), so coverage leaves it out. `pnpm fix && pnpm gate:full:quiet` → green; the legacy-import suite prints `SKIP` for the oracle check only where `acc.json` is absent (CI).

```bash
git add -A packages/legacy-import packages/client-core tools/strict-lint/knip.jsonc
git commit -m "test(core): Pozzetto 2013 reconciles node by node to the design's oracle

The fixture holds keys and cents only; the local check proves it
against acc.json where that file exists. Deviations found and ruled:
<list>"
```

---

### Task 15: The shell

**Files:**
- Create under `packages/client-react/src/ui/shell/`: `AppRoot.tsx` (+ `.css`), `TopBar.tsx` (+ `.css`, `.page.tsx`, `.test.tsx`), `Popover.tsx` (+ `.css`), `ModuleTabs.tsx`, `Breadcrumb.tsx` (+ `.css`, `.test.tsx`), `Sidebar.tsx` (+ `.css`, `.page.tsx`, `.test.tsx`), `BuildingsTree.tsx`, `ManagementMenu.tsx`, `Rail.tsx`, `Splitter.tsx` (+ `.css`, `.page.tsx`, `.test.tsx`), `ToastHost.tsx` (+ `.css`, `.page.tsx`, `.test.tsx`), `Placeholder.tsx` (+ `.css`), `Logo.tsx`, `icons.tsx` (PDF/XLS glyphs, flags)
- Modify: `packages/client-react/src/ui/App.tsx`, `testids.ts`, `src/app/startApp.test.tsx`

**Interfaces:**
- Consumes: the view model hooks (Task 13), `Panel` (Task 11).
- Produces: `App` renders `<AppRoot />`; `MENU_ITEMS: { id: Menu; label: string; icon: ReactNode }[]` (the six, in the README's order) and `MODULE_TABS: { id: Module; label: string; color: string }[]` in `ManagementMenu.tsx` / `ModuleTabs.tsx`; `periodLabel(period: Period): string` → `"2013 (Ordinary)"` (`extra` → "Extraordinary", `auxiliary` → "Auxiliary") in `BuildingsTree.tsx`; `Splitter` with `{ direction: "vertical" | "horizontal"; onDrag: (deltaPx: number) => void }` and the page object `dragSplitter(by)`.

- [ ] **Step 1: `AppRoot` (thin) and the layout**

```tsx
export function AppRoot(): ReactElement {
  const { useSession, useNavigation, useSidebar, useMaximize } = useViewModel();
  const { preferences } = useSession();
  const navigation = useNavigation();
  const sidebar = useSidebar();

  return (
    <div className="app-root" data-theme={preferences.theme} data-mode={preferences.mode} data-testid={TESTIDS.appRoot}>
      <TopBar />
      <Breadcrumb />
      <div className="app-body">
        {navigation.state.module === "buildings" ? <Sidebar /> : null}
        <main className="app-main" data-testid={TESTIDS.appMain}>
          <Screen module={navigation.state.module} menu={navigation.state.menu} />
        </main>
      </div>
      <ToastHost />
    </div>
  );
}
```

`Screen` renders `<AccountsScreen />` (Task 16; until then `Placeholder`) for `buildings`/`accounts`, and `<Placeholder title=… />` for every other module and menu item ("Calendar", "Contacts", "Building Data & Suppliers", …: the label of the tab or item). `AppRoot.css` (README *Global layout*, *Body*): `.app-root { height: 100vh; display: flex; flex-direction: column; overflow: hidden; font-family: var(--font-sans); font-size: 13px; color: var(--tx); background: var(--app); }`, `.app-body { flex: 1; display: flex; min-height: 0; position: relative; }`, `.app-main { flex: 1; display: flex; flex-direction: column; gap: 6px; padding: 6px; min-width: 0; min-height: 0; background: var(--app); }`.

- [ ] **Step 2: `TopBar`, `Popover`, `ModuleTabs`, `Logo`**

`TopBar` (thin: reads `useSession` and `useNavigation`) renders the README's *Top bar*: the logo tile and wordmark (`Logo.tsx` is the SVG from `Condomini.dc.html` line 31–40, copied), the account line `Account **{username}** · {displayName} | Profile **Administrator** | Firm **{firm}**`, the mode button (lucide `Sun`/`Moon`, `aria-label` "Switch to dark mode"/"Switch to light mode", test id `modeToggle`, calls `setMode`), the theme button (swatch + name + `ChevronDown`) opening a `Popover` with the three themes (check mark on the current, click calls `setTheme`), the language button (flag glyph + `ChevronDown`) opening a `Popover` with the five languages, "✕ Log out" (calls `notices.stub("Log out")`), and `ModuleTabs` (three buttons, `aria-selected`, the dot colour per tab from `MODULE_TABS`, click calls `selectModule`). `Popover` takes `{ open; onClose; label: string; children }` and renders a scrim (`position: fixed; inset: 0`, click → `onClose`) plus the panel; Escape on the panel calls `onClose`. CSS values: README *Top bar* and *Popovers* verbatim (height 28 chrome buttons, radius 7, `rgba(255,255,255,.07)` background, `rgba(255,255,255,.12)` border; popover width 172/184, radius 9, `--shadow-pop`, rows `7px 9px`).

Page object `mountTopBar()` mounts `AppRoot` (the root element carries the mode and theme the top bar changes) over `createAppHarness(createSmallSeed())`: `accountLine()`, `toggleMode()`, `openThemes()`, `pickTheme(name)`, `themeLabel()`, `activeTab()`, `clickTab(label)`, `rootMode()` and `rootTheme()` (the attributes on the root). Tests: "shows the account line"; "toggles the mode on the root"; "picks a theme" (`data-theme` becomes `carbon`); "switches module tabs" (the sidebar disappears on Calendar, a placeholder titled Calendar shows).

- [ ] **Step 3: `Breadcrumb`**

Reads `useNavigation`, `useBuildingsTree`, `useSelectedPeriod`: `Buildings › {building.name} › {periodLabel(period)} › {menu label}`; `Calendar`; `Contacts`. Home chip ⌂ 18×18. CSS per README *Breadcrumb bar*. Test: "names the building, period and screen for the Accounts screen" (`Buildings › Pozzetto › 2013 (Ordinary) › Accounts, Ledgers & Balance`), "is the module's name elsewhere".

- [ ] **Step 4: `Sidebar`, `BuildingsTree`, `ManagementMenu`, `Rail`, `Splitter`**

`Sidebar` (thin) reads `useSidebar`, `useBuildingsTree`, `useSelectedPeriod`, `useNavigation`, `useMaximize` and renders: when a panel is maximized (`useMaximize().state.maximized !== null`), the `Rail` (vertical "MANAGEMENT", `›` in `--acc`; click → `restore()`); else the two cards (`Select Management`: header strip, toolbar row `+ ✎ − … ⟳` as `notices.stub` buttons, `BuildingsTree`; `Management Menu`: `ManagementMenu`) and the vertical `Splitter` (drag → `resize(width + delta)`). The sidebar's width is a CSS variable set the way `TreeGrid` sets its template (one effect on the aside: `--sidebar-width`). `BuildingsTree` takes `{ buildings; selectedPeriodId; onSelectPeriod }`: building rows (`Building2` icon, `"{name} (Building)"`, 13px/500, a caret that collapses the building's periods: local state per building via `useState`, allowed in a dumb component as it is view-only) and period rows (`Folder` icon, `periodLabel`, indent 18px, `aria-selected` on the selected one with the `--sel` background and the inset bar). `ManagementMenu` takes `{ active; onSelect }`: six items with their lucide icons (`Building2`, `ClipboardList`, `Calculator`, `BarChart3`, `BookOpen`, `Receipt`), `▸` visible on the active one. `Splitter`: a 12px hit area with the 4×42 pill, `cursor: col-resize` (or `row-resize`), pointer capture as in `TreeGrid`'s handle, reporting the delta since pointer-down on every move. Compact mode is CSS in `Sidebar.css`:

```css
.sidebar { width: var(--sidebar-width, 272px); flex: none; display: flex; flex-direction: column; gap: 8px; padding: 6px 0 6px 8px; min-height: 0; }
@media (max-width: 1179px) {
  .sidebar { position: absolute; left: 0; top: 0; bottom: 0; z-index: 60; background: var(--app); box-shadow: 8px 0 30px rgba(15, 20, 30, 0.24); border-right: 1px solid var(--bd); }
  .sidebar[data-open="false"] { display: none; }
  .sidebar-splitter { display: none; }
  .rail { display: flex; }
  .drawer-scrim[data-open="true"] { display: block; }
}
.rail { display: none; }
.drawer-scrim { display: none; position: absolute; inset: 0; background: var(--scrim-drawer); z-index: 55; }
```

Below 1180px the `Rail` is always drawn (48px wide), the sidebar is the drawer (`data-open` from `useSidebar().state.open`), the rail's click calls `open()` and the scrim's `close()`. Above, the rail shows only when maximized (a `data-maximized` attribute on the body container toggles `.rail { display: flex }` and hides the sidebar). Page object `mountSidebar()`: `periodLabels()`, `selectedPeriod()`, `clickPeriod(label)`, `activeMenu()`, `clickMenu(label)`, `dragSplitter(by)`, `clickRail()`, `isDrawerOpen()`. Tests: "lists the buildings' periods and marks the selected", "selecting a period changes the app-wide selection" (read it back through `useSelectedPeriod` in the page object's reader), "selecting a menu item changes the navigation", "dragging the splitter changes the width within 180–440", "the rail opens the drawer and the scrim closes it".

- [ ] **Step 5: `ToastHost` and `Placeholder`**

`ToastHost` reads `useNotices` and draws each notice bottom-right (`position: fixed; right: 16px; bottom: 16px`, card `background: var(--panel); border: 1px solid var(--bd); border-radius: 9px; box-shadow: var(--shadow-pop); padding: 9px 12px; font-size: 12px`) with a ✕ button calling `clear(id)`. Page object: `toasts(): string[]`, `dismiss(index)`. Test over the harness: `app.notices.stub("Print balances")` shows "Print balances: not yet available"; dismiss clears it. `Placeholder` takes `{ title }` and renders a `Panel` with the title and the body text "This screen arrives in M2." centred 12px `--txd`.

- [ ] **Step 6: Wire `App`, update the start-up test, fix, gate, commit**

`App.tsx` renders `<AppRoot />`. `startApp.test.tsx`: after start, the account line reads "marco" and the breadcrumb ends with "Accounts, Ledgers & Balance". `pnpm fix && pnpm gate:full:quiet` → green; `pnpm dev` shows the shell with the placeholder in the main area.

```bash
git add -A packages/client-react
git commit -m "feat(client): the shell: top bar, module tabs, breadcrumb, Buildings sidebar, splitter, drawer, toasts"
```

---

### Task 16: The Accounts screen

**Files:**
- Create under `packages/client-react/src/ui/accounts/`: `AccountsScreen.tsx` (+ `.css`), `AccountsToolbar.tsx`, `AccountsGrid.tsx` (+ `.page.tsx`, `.test.tsx`), `accountIcons.tsx` (+ `.css`), `AccountDetails.tsx` (+ `.test.tsx`), `LedgerTab.tsx` (+ `.page.tsx`, `.test.tsx`), `columns.ts`
- Modify: `packages/client-react/src/ui/shell/AppRoot.tsx` (`Screen` renders `AccountsScreen`), `testids.ts`

**Interfaces:**
- Consumes: `TreeGrid`, `Money`, `Panel`, `TabbedPanel`, `Toolbar*`, `Scheda`, `Fieldset`, `Row`, `Splitter`, `formatDate`, the view model.
- Produces: `ACCOUNTS_COLUMNS: TreeGridColumn[]` (13) and `ACCOUNTS_COLUMN_SPECS: ColumnSpec[]` from `columnSpecsFrom([400,100,100,100,90,130,44,170,110,44,210,56,64], 0, 360, 680)`; `LEDGER_COLUMNS` (7) and `LEDGER_COLUMN_SPECS` from `columnSpecsFrom([140,48,240,180,100,100,100], 2, 200, 640)`; `AccountIcon({ icon, nature, open })`.

- [ ] **Step 1: The screen (thin) and its layout**

```tsx
const BOTTOM_TABS = ["Account Details", "Ledger"] as const;

export function AccountsScreen(): ReactElement {
  const { useAccountsGrid, useColumns, useSelectedAccount, useSplit, useBottomTab, useMaximize, useNotices } = useViewModel();
  const grid = useAccountsGrid();
  const columns = useColumns(ACCOUNTS_COLUMN_SPECS);
  const selection = useSelectedAccount();
  const split = useSplit();
  const tabs = useBottomTab(BOTTOM_TABS);
  const maximize = useMaximize();
  const notices = useNotices();

  return (
    <div className="accounts-screen" data-maximized={maximize.state.maximized ?? "none"}>
      <AccountsTop … />        // Panel "Accounts, Ledgers & Balance" with AccountsToolbar and AccountsGrid; flex from split.state.ratio
      <Splitter direction="horizontal" onDrag={…} />
      <AccountsBottom … />     // TabbedPanel with AccountDetails or LedgerTab
    </div>
  );
}
```

The split ratio reaches CSS as `--split-ratio` (one effect on the screen element, as in `TreeGrid`): `.accounts-top { flex: calc(var(--split-ratio) * 100) 1 0 }`, `.accounts-bottom { flex: calc((1 - var(--split-ratio)) * 100) 1 0 }`; `[data-maximized="top"] .accounts-bottom { flex: 0 0 auto; max-height: 34px }` and the mirror for `bottom`; `[data-maximized]:not([data-maximized="none"]) .accounts-splitter { display: none }`; transition `max-height .26s ease, flex-basis .26s ease`. The horizontal `Splitter`'s delta is turned into a ratio with the screen's height (`getBoundingClientRect` on the element from a ref, inside the drag handler: a DOM read in an event handler is allowed).

- [ ] **Step 2: `AccountsToolbar`**

`ToolbarSearch` (placeholder "Search account…", value `grid.state.search`, `setSearch`), `ToolbarCheckbox` "Hide empty accounts", divider, ⚙ (`Settings`, "Configure functional accounts" → `stub`), divider, `+` (`ok`), `✎` (`muted`), `−` (`neg`) → `stub("Add account")` etc., divider, `⊞ ⊟` (`expandAll` / `collapseAll`, lucide `Rows3`/`Rows2` or the text glyphs), divider, three dropdown stubs (print, PDF, XLS; the PDF/XLS glyphs from `shell/icons.tsx`) → `stub("Print balances")`, spacer. No ⟳ (the prototype's Accounts toolbar has none).

- [ ] **Step 3: `AccountsGrid`**

Maps `grid.state.rows` to `TreeGridRowData`: `label` the node's label; `icon` `<AccountIcon icon={node.icon} nature={node.nature} open={row.expanded} />`; `emphasis` `row.hasChildren`; `zebra` `row.key === "total"`; `selected` `selection.key === row.key`; `cells`: `<Money cents={debit} variant="plain" emphasis>`, `<Money cents={credit} variant="plain" emphasis>`, `<Money cents={balance} emphasis>`, `<Money cents={budget} emphasis>` (made editable in Task 17), then eight empty cells (`null`). `onToggle` → `grid.toggle`, `onSelect` → `selection.select`, `onResize` → `columns.resize`, `template` → `columns.state.template`, `emptyMessage` "No account matches." `AccountIcon`: `folder` → lucide `Folder`/`FolderOpen` tinted by nature through `data-nature` (`accountIcons.css`: assets `#d6453f`, liabilities `#2f78c4`, expenses `#d99a1f`, income `#5aa130`, patrimonial (nature null, not root) `#7d4fb3`, fallback `#caa24a`), `document` → `FileText` grey, `cash` → `Banknote`, `bank` → `Landmark`, `suppliers` → `Truck`, `owners` → `Users`, `roundings` → `Hash`, `tax` → `Landmark` (the README maps 🏛️ to Landmark too; give it `data-icon="tax"` so a later stylesheet can tell them apart), the root → `Sigma`. 13–14px.

Page object `mountAccountsGrid()` over `createAppHarness(createSmallSeed())`: `labels()`, `cellsOf(label): string[]`, `clickRow(label)`, `clickCaret(label)`, `search(text)`, `toggleHideEmpty()`, `expandAll()`, `collapseAll()`, `selectedLabel()`. Tests: "starts with Total and the five levels open, amounts formatted" (`cellsOf("Total")` is `["212,619.00", "212,619.00", "0.00", "1,500.00", "", …]`: the Total's budget rolls up 150000 = `"1,500.00"`), "selecting a row selects the account app-wide", "search narrows to the matches with their ancestors", "hide-empty removes Fondi", "expand all shows every row, collapse all only Total".

- [ ] **Step 4: `AccountDetails` and `LedgerTab`**

`AccountDetails` (thin: `useAccountDetails`) renders the wide `Scheda` with (README *Account Details*, prototype values): Account (path, `accent`), Account type, Account nature, Default contra-account "-None- (uses parent account settings)", Period restriction "-None- (uses parent account settings)"; when `isCost`: `Fieldset` COST ACCOUNT ATTRIBUTES with Allocation restriction on a group "-None- (uses parent account settings)", Allocation on ownership change "By accrual days (uses parent account settings)", Default tax deduction "- uses parent account settings -", Next-period budget calculation "110% of budget (uses parent account settings)"; a row "Separate tables for budget & final balance" with a disabled unchecked checkbox; `Fieldset` "ALLOCATION TABLES (USES PARENT ACCOUNT SETTINGS)" with the text "No tables linked — uses parent account settings." (the mini-grid arrives in M2 with the tables port); `Fieldset` ACCOUNT BALANCES: Debit, Credit (formatted, `mono`), Balance (`num`), Budget (or `---` `muted`); `Fieldset` OTHER: System ID (`mono`), Created on `---`. Test over the harness with `la21` selected: the path row and the cost fieldsets; with `total`: no cost fieldsets, system id `—`.

`LedgerTab` (thin: `useLedger`, `useColumns(LEDGER_COLUMN_SPECS)`) renders a `TreeGrid` with `LEDGER_COLUMNS` (`Date | P.N. | Entry description | Posting | Debit | Credit | Balance`), one flat row per line (`depth 0`, no children, `label` the date via `formatDateTime`, cells: number, description, `postingPath` in 11px `--txd` ellipsis, `Money plain`, `Money plain`, `Money`), and the footer `["", "", "", "Total:", Money(totalDebit, plain, emphasis), Money(totalCredit, plain, emphasis), Money(balance, emphasis)]`; `emptyMessage` "No posting on this account." Rows are not selectable here (`onSelect` is a no-op function `selectNothing`). Page object: `rows(): string[][]`, `footer(): string[]`. Tests: with `la21` selected: one row `["10/01/2013 10:00", "1", "Fattura Alfa", "Total › Costs › Spese generali › Ascensore", "360.18", "0.00", "360.18"]` and the footer totals; with `total`: 20 rows and a `0.00` balance; the empty message for `la3`.

- [ ] **Step 5: Fix, gate, commit**

`pnpm fix && pnpm gate:full:quiet` → green; `pnpm dev` shows Pozzetto 2013 (the first building is Saturno: click Pozzetto › 2013 in the sidebar) with the full tree and the ledger.

```bash
git add -A packages/client-react
git commit -m "feat(client): the Accounts, Ledgers & Balance screen: grid, toolbar, details and ledger"
```

---

### Task 17: The budget edit, the goldens, the compiler entry, the docs

**Files:**
- Modify: `packages/client-react/src/ui/accounts/AccountsGrid.tsx` (+ page, test), `AccountsScreen.css`
- Modify: `packages/client-react/tests/visual/scenarios.ts`, `seeding.ts`, `visual.pw.ts`
- Create: goldens under `tests/visual/goldens/darwin-arm64/` (local) and `linux-x64/` (CI workflow)
- Modify: `architecture.config.mts` (`compilerTracked`), `AGENTS.md`, `docs/superpowers/specs/2026-10-12-m1-accounts-slice-design.md` (status line)

- [ ] **Step 1: The budget edit**

In `AccountsGrid`, the Budget cell of a row whose node is an expense leaf with a scope of kind `account` (`node.nature === "expenses" && node.scope?.kind === "account"`) is a button-like cell (`role="button"`, test id `budgetCell`) that, on click, sets a local `editing: string | null` state (`useState`, the key being edited) and renders `InlineEditor` with `value={formatCents(budget ?? 0)}`. Commit: `parseAmount(text)`; `null` → error "not an amount"; else `await setBudget(accountId, cents)`; a `Rejected` → error from a small map (`negative` → "a budget cannot be negative", the others as they are); `Ok` → editing ends. Cancel ends editing. The error lives in the same local state (`error: string | null`). Page object additions: `clickBudget(label)`, `typeBudget(text)`, `pressEnter()`, `pressEscape()`, `budgetError(): string | null`. Tests: "commits a budget and the tree shows it, rolled up" (`cellsOf("Spese generali")[3]` becomes `"1,700.00"` after `la21` → `1,200.00`), "shows the rejection for text that is not an amount and writes nothing" (Review Focus 2: `abc` → "not an amount", the cell unchanged), "shows the domain's reason for a negative budget", "Escape cancels". Also pin the Review Focus 1 path end to end? It is a data invariant, already pinned in the domain; nothing to add here.

- [ ] **Step 2: The visual scenarios and the four goldens**

`scenarios.ts`:

```ts
export interface Scenario {
  width: number;
  mode: "light" | "dark";
  periodId: string;
  selectedKey?: string;
  expanded?: string[];
  drawerOpen?: boolean;
}

export const scenarios: Record<string, Scenario> = {
  "accounts-1280-light": { width: 1280, mode: "light", periodId: "p36", selectedKey: "la154", expanded: OPEN_TO_CASH },
  "accounts-1280-dark": { width: 1280, mode: "dark", periodId: "p36", selectedKey: "la154", expanded: OPEN_TO_CASH },
  "accounts-1100-light": { width: 1100, mode: "light", periodId: "p36", selectedKey: "la154", expanded: OPEN_TO_CASH },
  "accounts-1100-drawer": { width: 1100, mode: "light", periodId: "p36", selectedKey: "la154", expanded: OPEN_TO_CASH, drawerOpen: true },
};

const OPEN_TO_CASH = ["total", "patrimonial", "assets", "liabilities", "costs", "revenue", "la153"];
```

`seeding.ts`: `createAppHarness()` (the real seed); `app` is the harness's app with `machines.createAccountsGrid` wrapped so each machine built starts with the scenario's expansion (toggle the keys not in `INITIAL_EXPANDED` through its own intent, as the starter's `selectFromTheStart` did) and `createSidebar` wrapped to `open()` when `drawerOpen`; `deliver` calls `selectPeriod(periodId)`, `select(selectedKey)` and `setPreference({ mode })`, then `clock.tick(0)`. In `visual.pw.ts`, before `page.goto`: `await page.setViewportSize({ width: scenarios[name].width, height: 720 });` (the type: `scenarios[name]` is possibly undefined under `noUncheckedIndexedAccess`; the loop iterates `Object.entries(scenarios)` instead). Run `pnpm visual:update`, open the four images, check each shows what its name says (the dark one on `data-mode="dark"`, the 1100 ones with the rail and no sidebar, the drawer one with the overlay and the scrim), then `pnpm visual` → pass. Commit the darwin-arm64 goldens with the scenarios.

- [ ] **Step 3: Compiler tracking, docs, spec status**

`architecture.config.mts`: `compilerTracked: [{ file: "src/ui/TreeGrid.tsx", fn: "TreeGridRow" }]`; `pnpm check:compiler` passes (if it reports the function is not memoized, the cause is a value read from a ref or a non-plain prop; fix the component, do not drop the entry). `AGENTS.md`, section *Packages of this project beyond the starter's*: add to the `packages/domain` line that its `simulators/seed/legacySeed.generated.ts` is written by the generator (`pnpm --filter @cl/legacy-import gen:data`) and never edited, and to the `legacy-import` line the `gen:oracle-fixture` script and the local oracle check. The spec's status line: `Status: implemented on feat/m1-accounts`, with the day's date.

- [ ] **Step 4: Fix, gate, commit, then the linux goldens**

`pnpm fix && pnpm gate:full:quiet` → green; `pnpm visual` → pass.

```bash
git add -A
git commit -m "feat(client): the budget edit end to end; the screen's goldens at 1280 and 1100, light and dark"
```

Then push the branch and run the `Update visual goldens` workflow on it (its summary gives the commands: `gh workflow run update-visual-goldens.yml --ref feat/m1-accounts`, then pull the commit it pushes). The `Visual goldens` check is required on the PR, so the PR cannot merge before that set exists.

---

## Finishing

After the final review, use `superpowers:finishing-a-development-branch`: push `feat/m1-accounts`, `gh pr create` against `main`, then `gh pr merge --auto --merge`; the six required checks gate the merge. Delete `.superpowers/sdd/<plan>/` when the review is clean.

## Self-review notes (written with the spec open)

- Spec coverage: Goal → Tasks 14, 17; Seed → Task 6; Domain entities and use cases → Tasks 2–5; Ports → Tasks 7–8; Core → Tasks 9, 10, 13; Shared and server → Task 1; Bindings → Task 13; Client styling and components → Tasks 11, 12, 15, 16; Oracle fixture and tests → Task 14; goldens → Task 17; Housekeeping → Task 2 (`must`, `subtree`, Turbo; the timeout item was done before the plan); Out of scope respected. The "one golden per primitive" line of the spec is dropped (header).
- Type consistency checked across tasks: `PeriodSelection`, `AccountNode.scope`, `GridRow`, `ColumnSpec`, `MachineView`, `AppPorts`, `AppHarness`, the `Result` shape and the reason strings, `DUMP_SUITE_TIMEOUT_MS`.
- Review Focus pins: 1 → Task 4 ("throws, naming the id, for a posting whose counterpart is not a party"); 2 → Task 17 ("shows the rejection for text that is not an amount"); 3 → Task 9 ("resets the selection… every amount 0… ledger empty"); 4 → Task 10 ("a search that matches nothing shows no rows"); 5 → Task 5 ("keeps a zero posting as a 0.00 line").

