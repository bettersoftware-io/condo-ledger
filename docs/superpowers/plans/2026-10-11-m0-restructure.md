# M0 — Restructure condo-ledger around the starter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn this repo into a project the bettersoftware-skills gates pass — the starter's seven packages in, `@cl/domain` merged, `packages/db` as a `leaf`, the generator as `packages/legacy-import`, `apps/web` archived — with `pnpm gate:full:quiet` green and the five chosen add-ons installed.

**Architecture:** The starter is created by `create-project.mts` in a scratch folder (the script refuses a non-empty one), proven green there, and merged into this repo by hand on branch `feat/app-v2`. Every file merged and every collision is written to a merge log, which later becomes the fixture for a `starter` unit of `add-to-project.mts`. The starter's price-list sample **stays through M0** (it is what proves the scaffolding and what `AGENTS.md` points at); M1 replaces it pattern by pattern.

**Tech Stack:** Node 26, pnpm 12.6.0 (Corepack), TypeScript 6 native, Vite 8, React 19 + Compiler, Vitest 5, Turbo 2, ESLint 10, Biome 2, dependency-cruiser; plugin `bettersoftware-skills@bettersoftware` at `~/.claude/plugins/cache/bettersoftware/bettersoftware-skills/bb28b9341029` (called `$PLUGIN` below).

**Spec:** `docs/superpowers/specs/2026-10-11-app-v2-design.md` — section 1 and the add-on list. One amendment this plan makes to the spec: the sample feature is deleted in M1, not after M0's first green commit (Task 13 edits the spec line).

## Global Constraints

- Node `>=26` as `devEngines.runtime` (never `engines.node`); pnpm pinned as `packageManager` with `+sha512.` hash (the starter's: `pnpm@12.6.0+sha512.3ef68f951cb111ac204b4a5a16f0b2ddf0da56a96e0413e81d855d9f0b55ef926714709028e1cd00c405c2c5fb7b9e8ec4dc46777c805d0373c2f2ff00fd20ec`).
- Package scope stays `@cl`; project name `condo-ledger`.
- No `.js/.mjs/.cjs` source outside `javascriptAllowed`; scripts are `.mts` run by plain `node`.
- Installed kit/add-on files under `tools/` are **never edited**; only the project's own files are (root configs, `architecture.config.mts`, `biome.json`, `tools/coverage.config.mts`, `tools/strict-lint/knip.jsonc`, `tools/strict-lint/eslint.config.mts`, `AGENTS.md`).
- Roles: `packages/domain` domain · `packages/shared` shared · `packages/client-core` core · `packages/react-bindings` bindings · `packages/client-react` client · `packages/server` server · `packages/integration` integration · `packages/db` **leaf** · `packages/legacy-import` **server**.
- `apps/web` → `old/prototype-web/` (out of the workspace). `packages/application` deleted; its `types.ts` lives on as `packages/legacy-import/src/seedTypes.ts`.
- The before-stop hook is registered only when the gate is green (Task 11), because it refuses to end a turn on a red gate.
- Every task appends to `docs/superpowers/notes/2026-10-11-m0-merge-log.md`: what was copied, what collided, what was done.
- Commit messages end with the session's attribution lines (see the system reminder of the executing session).

## Review Focus

1. A `.js` file added under `old/` *after* M0 must not turn `typescript-only` red — `architecture.config.mts` lists the archive dynamically (Task 4 proves the config loads; Task 8 Step 2 adds and removes a probe file against the gate).
2. `pnpm test` must terminate: `packages/db` currently runs `vitest` in watch mode (Task 6 changes it to `vitest run` and proves exit).
3. The generator's dump path after the move: tests read `../../old/db/…` from the package's cwd and `generate-data.ts` resolves from `import.meta.url` (Task 7 proves the regenerated seed is byte-identical).
4. The ETL must run on plain Node 26 without `tsx` (Task 6 proves `reset.mts` loads and fails only on the missing `DATABASE_URL`).
5. `AGENTS.md` paths must all exist (`agent-docs` gate): the sample is kept so the pattern table stays true; Task 4 adds only paths that exist.

---

### Task 0: Toolchain

**Files:** none in the repo.

- [ ] **Step 1: Check Node and Corepack**

Run: `node --version && (corepack --version || echo "no corepack")`
Expected: `v26.x` and `no corepack` (Node 26 ships without it).

- [ ] **Step 2: Install Corepack globally** — a change outside the repo; ask the user before running it.

Run: `npm install -g corepack@latest && corepack enable && corepack --version`
Expected: a version prints. (`pnpm` outside a project keeps resolving to the global 9.7.0 until a project's `packageManager` field says otherwise.)

- [ ] **Step 3: Confirm the plugin path**

Run: `ls $PLUGIN/scripts/create-project.mts $PLUGIN/scripts/add-to-project.mts`
Expected: both exist.

---

### Task 1: Branch, merge log, scratch starter proven green

**Files:**
- Create: `docs/superpowers/notes/2026-10-11-m0-merge-log.md`
- Create (outside the repo): `/private/tmp/claude-501/.../scratchpad/starter-cl/` — the scratch starter (`$SCRATCH` below)

- [ ] **Step 1: Branch from a clean main**

Run: `git status --short` → empty. Then `git switch -c feat/app-v2`.

- [ ] **Step 2: Start the merge log**

```markdown
# M0 merge log — starter into condo-ledger

Plugin: bettersoftware-skills@bb28b9341029. Scratch starter: created with
`create-project.mts <scratch> --scope @cl --name condo-ledger`.

Format of an entry: `path` — source (starter | repo | new) — what happened
(copied | replaced ours | merged: <how> | collision: <what> → <decision>).

## Root files
## Packages
## Collisions
## Still to do by hand (what a `starter` unit of add-to-project.mts must handle)
```

Commit: `git add docs/superpowers/notes && git commit -m "docs: start the M0 merge log"`.

- [ ] **Step 3: Create the scratch starter**

Run:
```bash
node $PLUGIN/scripts/create-project.mts $SCRATCH --scope @cl --name condo-ledger
cd $SCRATCH && git init -q && pnpm --version && pnpm install && pnpm gate:full:quiet
```
Expected: `pnpm --version` prints `12.6.0` (Corepack honoured `packageManager`); `gate:full:quiet` prints one line per stage, exit 0. If red: stop and report the output — the starter is at fault.

- [ ] **Step 4: Record the baseline in the log**

Append under "Root files": the versions printed (`node`, `pnpm`), and the line "scratch gate:full green on <date>". Commit the log.

---

### Task 2: Archive the prototype

**Files:**
- Move: `apps/web` → `old/prototype-web`
- Delete: `packages/application` (its `src/types.ts` is copied in Task 7 first — see Step 2)

- [ ] **Step 1: Drop build outputs and installed files of the prototype**

Run: `rm -rf apps/web/node_modules apps/web/dist packages/application/node_modules`

- [ ] **Step 2: Keep the one file the generator needs**

Run: `mkdir -p docs/superpowers/notes/tmp && cp packages/application/src/types.ts docs/superpowers/notes/tmp/seedTypes.ts`
(Task 7 moves it into `packages/legacy-import/src/seedTypes.ts` and deletes the tmp copy.)

- [ ] **Step 3: Move and delete with git**

Run:
```bash
git mv apps/web old/prototype-web
rmdir apps
git rm -rq packages/application
git status --short | head
```
Expected: renames listed as `R`, `packages/application/*` as `D`. No `apps/` folder remains.

- [ ] **Step 4: Log and commit**

Append under "Packages": `apps/web → old/prototype-web — repo — archived (reference only; out of the workspace)`; `packages/application — repo — deleted; src/types.ts carried to legacy-import (Task 7)`.

Commit: `git add -A && git commit -m "chore: archive the prototype web app and drop @cl/application"`.

---

### Task 3: Root files from the starter

**Files:**
- Replace: `package.json`, `tsconfig.base.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`
- Create: `tsconfig.tooling.json`, `turbo.json`, `eslint.config.mts`, `AGENTS.md`, `CLAUDE.md`, `.nvmrc`, `.codex/hooks.json`, `tools/` (the kit), `.github/workflows/ci.yml`
- Modify: `.gitignore`, `README.md`
- Not yet: `architecture.config.mts` (Task 4), `.claude/settings.json` hooks (Task 11)

- [ ] **Step 1: Copy the root**

Run:
```bash
cd <repo>
for f in tsconfig.base.json tsconfig.tooling.json turbo.json eslint.config.mts AGENTS.md CLAUDE.md .nvmrc pnpm-lock.yaml; do cp $SCRATCH/$f ./$f; done
mkdir -p .codex .github/workflows && cp $SCRATCH/.codex/hooks.json .codex/ && cp $SCRATCH/.github/workflows/ci.yml .github/workflows/
cp -R $SCRATCH/tools ./tools
```

- [ ] **Step 2: Write `pnpm-workspace.yaml`** — the starter's, which has only `packages/*` (ours had `apps/*` too):

Run: `cp $SCRATCH/pnpm-workspace.yaml ./pnpm-workspace.yaml`

- [ ] **Step 3: Write `package.json`** — the starter's, renamed:

```json
{
  "name": "condo-ledger",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.6.0+sha512.3ef68f951cb111ac204b4a5a16f0b2ddf0da56a96e0413e81d855d9f0b55ef926714709028e1cd00c405c2c5fb7b9e8ec4dc46777c805d0373c2f2ff00fd20ec",
  "devEngines": {
    "runtime": { "name": "node", "version": ">=26", "onFail": "error" }
  },
  "scripts": {
    "dev": "pnpm --filter @cl/client-react dev",
    "dev:server": "pnpm --filter @cl/server dev",
    "dev:fs": "VITE_SERVER_URL=ws://localhost:4000/ws turbo run dev",
    "build": "turbo run build",
    "typecheck": "turbo run typecheck && tsc --noEmit -p tsconfig.tooling.json",
    "test": "turbo run test",
    "lint": "eslint --flag unstable_native_nodejs_ts_config --max-warnings 0 .",
    "gates": "node tools/arch/gates/run.mts",
    "check:react-policies": "node tools/arch/check-react-policies.mts",
    "check:compiler": "node tools/arch/check-compiler.mts",
    "gate:fast": "pnpm gates && pnpm check:react-policies && pnpm check:compiler && pnpm lint && pnpm typecheck",
    "gate:full": "pnpm gate:fast && pnpm test && pnpm build",
    "gate:fast:quiet": "node tools/arch/gates/quiet.mts gate:fast",
    "gate:full:quiet": "node tools/arch/gates/quiet.mts gate:full"
  },
  "devDependencies": {
    "@types/node": "^26.2.0",
    "@typescript-eslint/utils": "^8.70.1",
    "@typescript/native": "npm:typescript@^7.0.2",
    "dependency-cruiser": "^18.0.0",
    "eslint": "^10.5.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "turbo": "^2.4",
    "typescript": "npm:@typescript/typescript6@^6.0.2",
    "typescript-eslint": "^8.61.1",
    "vitest": "^5.0.3"
  }
}
```
Verify the block matches the scratch starter's (its versions win if they differ — the lockfile copied in Step 1 was built against them): `diff <(jq .devDependencies $SCRATCH/package.json) <(jq .devDependencies package.json)` → empty.

- [ ] **Step 4: Merge `.gitignore`** — ours plus the starter's; `reports/` is anchored so `docs/design/web/v1/reports/` stays tracked:

```gitignore
.idea/*
**/.svn/
node_modules/
dist/
*.tsbuildinfo
.DS_Store
.pnpm-store/

# Caches
.turbo/
.vite/
.vitest/
.eslintcache

# Reports of a run (anchored: docs/design/**/reports is committed design data)
coverage/
/reports/
packages/*/reports/
playwright-report/
test-results/

# Claude Code: share project settings (enabled plugins, hooks), keep everything else local
.claude/*
!.claude/settings.json

# Local env files (e.g. packages/db/.env holds the dev DATABASE_URL). Keep .env.example tracked.
.env
.env.*
!.env.example

# Editors, hosting CLI, logs
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
*.swp
.vercel/
*.log

# Pasted render screenshots in domain docs (throwaway; Mermaid renders inline)
docs/domain/img*.png
```

- [ ] **Step 5: Root `eslint.config.mts`** — the starter's line plus the two folders that are not the project's code:

```ts
import { architectureLint } from "./tools/arch/eslint.config.mts";

// `old/` is the archived legacy application and the first prototype; `docs/`
// holds the design prototype. Neither is code of this project.
export default [{ ignores: ["tools/**", "old/**", "docs/**"] }, ...architectureLint()];
```

- [ ] **Step 6: `README.md`** — keep ours; insert after the title the starter's command block:

```markdown
## Working on it

Node 26 or later and pnpm via Corepack (`packageManager` in `package.json`).

    pnpm install
    pnpm dev              # the React client on the in-browser simulator
    pnpm dev:fs           # the server and the client together
    pnpm gate:fast        # architecture gates, lint, typecheck: seconds
    pnpm gate:full        # the same, then tests and the build: what CI runs
    pnpm gate:full:quiet  # the same, printing only the stage that failed

`AGENTS.md` says where each kind of code goes. `old/` is the archived legacy
application and the first prototype; `docs/design/web/v1` is the design the
app is built to.
```

- [ ] **Step 7: Log and commit**

Append under "Root files" one line per file: `copied from starter` or `collision: ours → starter's (ours had: <one line>)`; for `.gitignore`, `eslint.config.mts`, `README.md`: `merged`. Under "Still to do by hand": "root package.json: scripts and devDependencies replaced; a unit must merge them, not overwrite (ours had `dev`, `build`, `test`, `typecheck` and `typescript` only)".

Commit: `git add -A && git commit -m "chore(m0): starter root configs, kit under tools/, CI workflow"`.

---

### Task 4: `architecture.config.mts` for this repo

**Files:**
- Create: `architecture.config.mts`
- Modify: `AGENTS.md` (one section appended)

**Interfaces:**
- Produces: the declared roles every later task relies on; `archivedJavascript(folder)` helper (local to the config file).

- [ ] **Step 1: Write the config**

```ts
import { readdirSync } from "node:fs";
import { join } from "node:path";

import type { ArchitectureConfig } from "./tools/arch/gates/lib/config.mts";

// Every workspace package appears here with the role it plays. A package that
// is not listed fails the structure gate, so a new one cannot slip in without
// its rules.
//
// Role       May import
// domain     nothing
// leaf       nothing
// shared     domain, leaf
// core       domain, shared, leaf
// bindings   core, domain, leaf
// client     bindings, core, domain, leaf
// server     domain, shared, leaf
// integration  every role above; nothing may import it, and it holds only tests
const config: ArchitectureConfig = {
  packages: {
    "packages/domain": { role: "domain", npm: ["rxjs"] },
    "packages/shared": { role: "shared", noNodeBuiltins: true },
    "packages/client-core": { role: "core", noNodeBuiltins: true },
    "packages/react-bindings": { role: "bindings", noNodeBuiltins: true },
    "packages/client-react": {
      role: "client",
      entry: ["main.tsx", "index.css", "*.d.ts"],
      noNodeBuiltins: true,
      reactCompiler: true,
      compilerTracked: [{ file: "src/ui/PriceList.tsx", fn: "PriceRowView" }],
    },
    "packages/server": { role: "server" },
    "packages/integration": { role: "integration" },
    // The legacy schema in Drizzle and the ETL that seeds Postgres from the
    // dumps. Imports no workspace package; the server imports it (M3).
    "packages/db": { role: "leaf" },
    // The offline generator: parses the legacy dump, projects it through the
    // domain engine, emits the simulator seed and runs the parity specs.
    // Node-side, so `server`: it may import the domain and the db leaf.
    "packages/legacy-import": { role: "server" },
  },

  adapters: ["packages/domain/src/simulators", "packages/client-core/src/adapters"],

  vendorOnlyIn: {
    react: ["packages/react-bindings", "packages/client-react"],
    "react-dom": ["packages/react-bindings", "packages/client-react"],
    ws: ["packages/server"],
  },

  // The typescript-only gate walks the whole repository. These are not code
  // of the project: the archived legacy application (old/flex, old/prototype-web)
  // and the design prototype's own script.
  javascriptAllowed: {
    "docs/design/web/v1/support.js": "the design prototype's own script; a reference, not code of the project",
    ...archivedJavascript("old"),
  },
};

/** Every JavaScript file under an archive folder, each with the same reason. */
function archivedJavascript(folder: string): Record<string, string> {
  const files: string[] = [];

  function walk(relative: string): void {
    for (const entry of readdirSync(join(import.meta.dirname, relative), { withFileTypes: true })) {
      const path = `${relative}/${entry.name}`;

      if (entry.isDirectory() && entry.name !== "node_modules") {
        walk(path);
      } else if (/\.(js|jsx|mjs|cjs)$/.test(entry.name)) {
        files.push(path);
      }
    }
  }

  walk(folder);

  return Object.fromEntries(files.map((file) => {
    return [file, `archived under ${folder}/: the legacy application and the first prototype, kept for reference`];
  }));
}

export default config;
```

- [ ] **Step 2: Prove the config loads and lists the archive**

Run: `node -e "import('./architecture.config.mts').then((m) => console.log(Object.keys(m.default.javascriptAllowed).length))"`
Expected: `42` — the 41 files under `old/flex` plus `support.js`. (The gate itself is run in Task 8, after `pnpm install`.)

- [ ] **Step 3: Append to `AGENTS.md`**, before the `<!-- BEGIN:turborepo-agent-rules -->` block:

```markdown
## Packages of this project beyond the starter's

| Package | Role | Holds |
|---|---|---|
| `packages/db` | leaf | The legacy schema in Drizzle (94 tables), migrations, and the ETL that seeds Postgres from the dumps in `old/db`. Imports no workspace package |
| `packages/legacy-import` | server | The offline generator: parses the dump, projects it through the domain engine, writes `packages/legacy-import/seed/data.generated.json` and runs the Gherkin parity specs in `packages/legacy-import/specs` |

`old/` is the archived legacy application and the first prototype
(`old/prototype-web`): reference only, outside the workspace, ignored by lint.
The design the app is built to is `docs/design/web/v1/README.md`.
```
(Every backticked path here exists by the end of Task 7; the `agent-docs` gate is first run green in Task 8.)

- [ ] **Step 4: Log and commit**

Append under "Still to do by hand": "architecture.config.mts: a unit must add `packages` entries for the project's existing packages and leave the rest; `javascriptAllowed` needed a folder rule — skill follow-up". Commit: `git add -A && git commit -m "chore(m0): declare the layers; archive folders allowed as JavaScript"`.

---

### Task 5: Starter packages in; `@cl/domain` merged

**Files:**
- Create: `packages/shared`, `packages/client-core`, `packages/react-bindings`, `packages/client-react`, `packages/server`, `packages/integration` (copied whole from `$SCRATCH/packages/…`)
- Modify: `packages/domain/package.json`, `packages/domain/src/index.ts`
- Move: `packages/domain/src/money.ts` (+test) → `src/entities/`; `src/allocate.ts` (+test) → `src/useCases/`; `src/riparto/*` → `src/useCases/riparto/*`
- Create from starter: `packages/domain/src/{entities/price.ts, ports/**, simulators/**, useCases/trackMovement*.ts}`

- [ ] **Step 1: Copy the six new packages**

Run: `for p in shared client-core react-bindings client-react server integration; do cp -R $SCRATCH/packages/$p packages/$p; done` then `ls packages` → nine folders (`db`, `domain`, `legacy-import` not yet).

- [ ] **Step 2: Move our domain files into the starter's layout**

Run:
```bash
cd packages/domain
mkdir -p src/entities src/useCases
git mv src/money.ts src/entities/money.ts && git mv src/money.test.ts src/entities/money.test.ts
git mv src/allocate.ts src/useCases/allocate.ts && git mv src/allocate.test.ts src/useCases/allocate.test.ts
git mv src/riparto src/useCases/riparto
cp -R $SCRATCH/packages/domain/src/entities/price.ts src/entities/
cp -R $SCRATCH/packages/domain/src/ports src/ports
cp -R $SCRATCH/packages/domain/src/simulators src/simulators
cp $SCRATCH/packages/domain/src/useCases/trackMovement.ts $SCRATCH/packages/domain/src/useCases/trackMovement.test.ts src/useCases/
```

- [ ] **Step 3: `packages/domain/package.json`** — the starter's shape, our name:

```json
{
  "name": "@cl/domain",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts", "./*": "./src/*" },
  "imports": { "#/*": "./src/*" },
  "scripts": { "typecheck": "tsc --noEmit -p tsconfig.json", "test": "vitest run" },
  "dependencies": { "rxjs": "^7.8.2" }
}
```
`packages/domain/tsconfig.json` is already identical to the starter's (`extends ../../tsconfig.base.json`, `include: ["src"]`) — leave it.

- [ ] **Step 4: `packages/domain/src/index.ts`** — both export sets, with extensions:

```ts
export * from "./entities/money.ts";
export * from "./useCases/allocate.ts";
export * from "./useCases/riparto/types.ts";
export * from "./useCases/riparto/computeRiparto.ts";
export * from "./useCases/riparto/periodTypes.ts";
export * from "./useCases/riparto/computeInstallments.ts";
export * from "./useCases/riparto/computeBalances.ts";
export * from "./useCases/riparto/recomputePeriod.ts";
```
followed by the starter's own export lines, copied verbatim from `$SCRATCH/packages/domain/src/index.ts`.

- [ ] **Step 5: Fix the moved files' imports** — add `.ts` to every relative import and climb at most one folder:

In `src/useCases/riparto/*.ts`: `from "../allocate"` → `from "../allocate.ts"`; `from "./types"` → `from "./types.ts"`; same for `computeRiparto`, `computeBalances`, `computeInstallments`, `periodTypes`, `recomputePeriod`. In `src/useCases/allocate.ts` and the riparto files, any import of money: `from "../money"` → `from "#/entities/money.ts"`. Check with: `grep -rnE "from \"\.{1,2}/[^\"]+\"" packages/domain/src | grep -vE "\.ts\";?$"` → empty.

- [ ] **Step 6: Log and commit**

Append under "Packages": one line per copied package `copied from starter (scope already @cl)`; for domain: `merged: ours moved to entities/ and useCases/; starter's price-list sample kept until M1`. Under "Collisions": `packages/domain/package.json: ours (main/types, vitest devDep) → starter's (exports/imports maps, rxjs)`; `packages/domain/src/index.ts: both export lists`.

Commit: `git add -A && git commit -m "chore(m0): starter packages in; @cl/domain on the starter layout"`.

---

### Task 6: `packages/db` as a leaf

**Files:**
- Modify: `packages/db/package.json`, `packages/db/tsconfig.json`
- Move: `packages/db/scripts/reset.mjs` → `packages/db/scripts/reset.mts`

- [ ] **Step 1: `packages/db/package.json`**

```json
{
  "name": "@cl/db",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/db.ts",
    "./schema": "./src/schema/index.ts",
    "./etl/*": "./etl/*"
  },
  "imports": { "#/*": "./src/*" },
  "scripts": {
    "db:up": "docker compose up -d",
    "db:down": "docker compose down -v",
    "migrate": "drizzle-kit migrate",
    "generate": "drizzle-kit generate",
    "seed": "node etl/index.ts",
    "reset": "node scripts/reset.mts",
    "rebuild": "pnpm reset && pnpm migrate && pnpm seed",
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": { "drizzle-orm": "^0.36.0", "pg": "^8.13.0" },
  "devDependencies": { "@types/pg": "^8.11.0", "drizzle-kit": "^0.28.0" }
}
```
Dropped: `tsx` (Node runs TypeScript), `vitest`, `typescript`, `@types/node` (all from the root). `version` dropped like the starter's packages.

- [ ] **Step 2: `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node", "vitest/globals"] },
  "include": ["src", "etl", "test", "scripts", "drizzle.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: `reset.mjs` → `reset.mts`**

Run: `git mv packages/db/scripts/reset.mjs packages/db/scripts/reset.mts`. Then edit the catch: `err.message` is `unknown` under strict TypeScript — replace the catch block with:

```ts
} catch (error) {
  console.error("reset failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
```

- [ ] **Step 4: Prove Node loads it and the test script exits** (needs Task 8's install for vitest; the `reset` check works now)

Run: `cd packages/db && unset DATABASE_URL; node scripts/reset.mts; echo "exit=$?"`
Expected: `DATABASE_URL is not set` and `exit=1` — Node stripped the types and ran the file.

- [ ] **Step 5: Log and commit**

Append under "Packages": `packages/db — repo — kept as leaf; scripts to plain node; devDeps tsx/vitest/typescript dropped; exports map added for etl/`. Commit: `git add -A && git commit -m "chore(m0): @cl/db as a leaf package run by plain node"`.

---

### Task 7: `packages/legacy-import`

**Files:**
- Create: `packages/legacy-import/package.json`, `tsconfig.json`, `vitest.config.ts`
- Move: `old/prototype-web/tools/gen/**` (all but `specs/`) → `packages/legacy-import/src/`; `old/prototype-web/tools/gen/specs/**` → `packages/legacy-import/specs/`; `old/prototype-web/src/mock/data.generated.json` → `packages/legacy-import/seed/data.generated.json`; `docs/superpowers/notes/tmp/seedTypes.ts` → `packages/legacy-import/src/seedTypes.ts`

**Interfaces:**
- Produces: `pnpm --filter @cl/legacy-import gen:data` writing `seed/data.generated.json`; `pnpm --filter @cl/legacy-import test` running unit tests and the parity specs.

- [ ] **Step 1: Move the files**

```bash
mkdir -p packages/legacy-import/src packages/legacy-import/seed
git mv old/prototype-web/tools/gen/specs packages/legacy-import/specs
git mv old/prototype-web/tools/gen/* packages/legacy-import/src/
git mv old/prototype-web/src/mock/data.generated.json packages/legacy-import/seed/data.generated.json
git mv docs/superpowers/notes/tmp/seedTypes.ts packages/legacy-import/src/seedTypes.ts && rmdir docs/superpowers/notes/tmp
```

- [ ] **Step 2: `package.json`**

```json
{
  "name": "@cl/legacy-import",
  "private": true,
  "type": "module",
  "exports": { "./*": "./src/*" },
  "imports": { "#/*": "./src/*" },
  "scripts": {
    "gen:data": "node src/generate-data.ts",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": { "@cl/db": "workspace:*", "@cl/domain": "workspace:*" }
}
```

- [ ] **Step 3: `tsconfig.json` and `vitest.config.ts`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "specs", "vitest.config.ts"]
}
```
```ts
import { defineConfig } from "vitest/config";

// Unit tests beside the source, and the parity specs (Gherkin over the legacy
// dump) under specs/. Both read old/db/… relative to this package's folder.
export default defineConfig({
  test: { include: ["src/**/*.test.ts", "specs/**/*.test.ts"] },
});
```

- [ ] **Step 4: Rewrite imports** — three kinds, all mechanical:

1. `from "@cl/application"` (10 sites: `src/assemble.ts`, `specs/steps.ts`, and the others `grep -rl "@cl/application" packages/legacy-import` lists) → `from "#/seedTypes.ts"`.
2. `from "../../../../packages/db/etl/ddl.ts"` / `parse.ts` / `transform.ts` (in `src/loadRows.ts`) → `from "@cl/db/etl/ddl.ts"` etc.
3. In `specs/**`: imports that reach `../x.ts` into what is now `src/` → `#/x.ts` (e.g. `../assemble.ts` → `#/assemble.ts`, `../project/units.ts` → `#/project/units.ts`). Imports within `specs/` stay relative.
4. `src/generate-data.ts`: `DUMP_URL = new URL("../../../old/db/it-jtime-condominium.all.sql", import.meta.url)`; `OUT_URL = new URL("../seed/data.generated.json", import.meta.url)`.
5. `src/seedTypes.ts` keeps `import type { Money } from "@cl/domain"`.

Check: `grep -rn "@cl/application\|packages/db/etl\|src/mock" packages/legacy-import` → empty.

- [ ] **Step 5: Fix the two test files and `world.ts` that read the dump** — they use `resolve(process.cwd(), "../../old/db/…")`: from `packages/legacy-import` that path is unchanged (same depth as `apps/web`). Verify: `ls old/db/it-jtime-condominium.all.sql`.

- [ ] **Step 6: Log and commit**

Append under "Packages": `packages/legacy-import — new — from apps/web/tools/gen; @cl/application types → src/seedTypes.ts; db etl via @cl/db/etl/*; seed moved`. Commit: `git add -A && git commit -m "chore(m0): the generator and parity specs as @cl/legacy-import"`.

---

### Task 8: Install, then make `gate:full` green

**Files:** whatever the gate names. Expected classes of change, in order: lockfile, typecheck under `verbatimModuleSyntax`/`erasableSyntaxOnly`, lint (`import type` inline, `.ts` extensions, function declarations, named object types), knip-like unused exports are *not* judged yet (Task 10).

- [ ] **Step 1: Install**

Run: `rm -rf node_modules packages/*/node_modules && pnpm install`
Expected: resolves; lockfile updated with `@cl/db` and `@cl/legacy-import` deps. If pnpm refuses a dependency's install script, add it under `allowBuilds` in `pnpm-workspace.yaml` with a comment saying what the script does — only after reading it.

- [ ] **Step 2: Gates**

Run: `pnpm gates`
Expected findings to resolve: none from `structure` (every package declared); `agent-docs` on any `AGENTS.md` path that is wrong — fix the path, never the gate; `package-scripts` → all packages have `typecheck` and `test`. Re-run until exit 0. Record every finding and its fix in the log under "Collisions".

Then prove the archive rule holds for a file added later (Review Focus 1):
```bash
touch old/flex/probe.js && node tools/arch/gates/run.mts --json | jq '[.findings[] | select(.gate=="typescript-only")] | length'; rm old/flex/probe.js
```
Expected: `0`.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected errors to fix: `import { X }` of a type under `verbatimModuleSyntax` → `import { type X }`; a relative import without `.ts`; `noUncheckedIndexedAccess` was *on* in our old base and is off in the starter's — nothing to do. Do not loosen `tsconfig.base.json`.

- [ ] **Step 4: Lint with the fixer, then by hand**

Run: `pnpm lint --fix; pnpm lint`
Fix what remains by the rule's message. The two that are not auto-fixable and will dominate: `func-style` (a `const f = () => …` at module level → `function f() { … }`, helpers below their caller) and `arch/newspaper-order`. Record the count before and after in the log — it is the number a `starter` unit's README must warn about.

- [ ] **Step 5: Tests and build**

Run: `pnpm test && pnpm build`
`@cl/db`'s integration suites skip without `DATABASE_URL` (by design). `@cl/legacy-import` runs 22 unit test files and the parity specs. Expected: all green; `vite build` of `client-react` succeeds.

- [ ] **Step 6: Seed byte-identical after the move**

Run: `pnpm --filter @cl/legacy-import gen:data && git status --short packages/legacy-import/seed`
Expected: empty (the regenerated JSON equals the committed one).

- [ ] **Step 7: The whole gate**

Run: `pnpm gate:full:quiet`
Expected: one line per stage, exit 0.

- [ ] **Step 8: Commit**

`git add -A && git commit -m "chore(m0): gate:full green on the merged starter"`.

---

### Task 9: Add-on `format-lint`

**Files:**
- Created by the script: `tools/format-lint/**`, `biome.json` (starting file — yours)
- Modify: `biome.json` (exclude the archive and the docs)

- [ ] **Step 1: Add it**

Run: `node $PLUGIN/scripts/add-to-project.mts . format-lint && pnpm install`

- [ ] **Step 2: `biome.json`** — the base's includes plus the two folders:

```json
{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "extends": ["./tools/format-lint/biome.base.json"],
  "files": {
    "includes": [
      "**",
      "!tools",
      "!.*/**",
      "!.claude",
      "!.codex",
      "!**/dist",
      "!**/coverage",
      "!**/reports",
      "!**/.turbo",
      "!old",
      "!docs",
      "!packages/legacy-import/seed"
    ]
  }
}
```

- [ ] **Step 3: First run, verify, gate**

Run: `pnpm fix && pnpm biome:check && pnpm gate:full:quiet`
`pnpm fix` reformats every package (expect a large diff — that is the point). If `biome:check` still fails on `useImportExtensions` or `useImportType`, run `pnpm exec biome check --write --unsafe packages` once, then `pnpm biome:check` again. Anything left is fixed by hand per the message.

- [ ] **Step 4: Log and commit**

Append under "Packages": `add-on format-lint: biome.json excludes old/, docs/, the seed JSON`. Commit: `git add -A && git commit -m "chore(m0): format-lint add-on; repository formatted"`.

---

### Task 10: Add-on `strict-lint`

**Files:**
- Created: `tools/strict-lint/**`; starting files `tools/strict-lint/knip.jsonc`, `tools/strict-lint/eslint.config.mts`
- Modify: `tools/strict-lint/knip.jsonc`

- [ ] **Step 1: Add it**

Run: `node $PLUGIN/scripts/add-to-project.mts . strict-lint && pnpm install && pnpm lint:types; pnpm lint:dead`

- [ ] **Step 2: Resolve `lint:types`** findings in code (a floating promise gets `await` or `void` with a comment; a `switch` gains its missing case). Never switch a rule off.

- [ ] **Step 3: Resolve `lint:dead`** — for each finding, one of: delete the unused export/file; or name it in `knip.jsonc` with the reason. Known ones to expect, with their entries:

```jsonc
// inside "workspaces":
"packages/db": {
  // drizzle-kit reads drizzle.config.ts; the ETL and reset are run as programs
  // by package.json scripts (`node etl/index.ts`, `node scripts/reset.mts`).
  "entry": ["etl/index.ts", "scripts/reset.mts", "drizzle.config.ts"],
  "project": ["src/**/*.ts", "etl/**/*.ts", "scripts/**/*.ts", "test/**/*.ts"]
},
"packages/legacy-import": {
  // The generator is run as a program (`node src/generate-data.ts`); the
  // parity specs live outside src/.
  "entry": ["src/generate-data.ts", "specs/**/*.test.ts"],
  "project": ["src/**/*.ts", "specs/**/*.ts"]
}
```
Exports of `seedTypes.ts` that nothing imports after the rename: delete them (they were the prototype's).

- [ ] **Step 4: Gate, log, commit**

Run: `pnpm gate:full:quiet`. Append the knip entries added and why. Commit: `git add -A && git commit -m "chore(m0): strict-lint add-on; dead code removed or declared"`.

---

### Task 11: Add-on `coverage`, then the hooks

**Files:**
- Created: `tools/coverage/**`, `.github/workflows/coverage.yml`; starting file `tools/coverage.config.mts`
- Modify: `tools/coverage.config.mts`, `.claude/settings.json`

- [ ] **Step 1: Add it**

Run: `node $PLUGIN/scripts/add-to-project.mts . coverage && pnpm install && pnpm coverage; pnpm coverage:gaps`

- [ ] **Step 2: `tools/coverage.config.mts`** — the starter's two exclusions plus the two legacy packages, measured again when M3 touches them:

```ts
import type { ProjectCoverageConfig } from "./coverage/lib/config.mts";

// What this project leaves out of the coverage measurement, and why. Every
// entry needs its reason. The bar and the default exclusions (test code) are
// in tools/coverage/lib/config.mts, which belongs to the add-on.
const config: ProjectCoverageConfig = {
  exclude: {
    "packages/client-react/src/main.tsx":
      "the browser's entry point: it only calls startApp(), which is tested; importing it in a test would start the app",
    "packages/server/src/index.ts":
      "the server's entry point: it only reads the port and calls startServer(), which is tested; importing it in a test would start a server",
    "packages/db/src/**":
      "the legacy schema and its connection, carried over from the DB migration; its ETL suites need a live Postgres and skip without one. Measured from M3, when the server adapters are written over it",
    "packages/legacy-import/src/**":
      "the offline generator carried over from the prototype; its correctness is held by the parity specs against the dump, not by per-file coverage. Measured from M3, when it becomes the import path",
  },
};

export default config;
```

- [ ] **Step 3: Verify and gate**

Run: `pnpm coverage && pnpm gate:full:quiet` → green (the starter's packages meet the bar on their own).

- [ ] **Step 4: Register the hooks — the gate is green now.** Merge the starter's `hooks` block into `.claude/settings.json`, keeping our keys:

```json
{
  "extraKnownMarketplaces": {
    "bettersoftware": { "source": { "source": "github", "repo": "bettersoftware-io/skills" } }
  },
  "enabledPlugins": { "bettersoftware-skills@bettersoftware": true },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/tools/arch/hooks/after-edit.mts\"", "timeout": 20 }]
      }
    ],
    "Stop": [
      { "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/tools/arch/hooks/before-stop.mts\"", "timeout": 600 }] }
    ]
  }
}
```
Check: `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"` → no error.

- [ ] **Step 5: Log and commit**

Append: coverage exclusions and the reason; "hooks registered last, after green". Commit: `git add -A && git commit -m "chore(m0): coverage add-on; architecture hooks registered"`.

---

### Task 12: Add-ons `ci-security:dependabot` and `visual`

**Files:**
- Created: `tools/ci-security/**`, `.github/workflows/{ci-security,dependency-review,scorecard}.yml`, `.github/dependabot.yml`, `SECURITY.md`; `tools/visual/**`, `packages/client-react/tests/visual/**`, `.github/workflows/{visual,update-visual-goldens}.yml`
- Modify: `SECURITY.md` (starting file: name the contact)

- [ ] **Step 1: ci-security**

Run: `node $PLUGIN/scripts/add-to-project.mts . ci-security:dependabot && pnpm install && pnpm lint:workflows && pnpm check:dockerfiles`
`lint:workflows` installs actionlint and zizmor on first run; if the machine is offline, record `SKIP` in the log and move on — CI runs it. Edit `SECURITY.md`: replace the placeholder contact with the repository's GitHub Security Advisories link (`https://github.com/bettersoftware-io/condo-ledger/security/advisories/new`).

- [ ] **Step 2: visual**

Run: `node $PLUGIN/scripts/add-to-project.mts . visual && pnpm install && pnpm --dir packages/client-react exec playwright install chromium && pnpm visual`
Expected: the four sample scenarios match the shipped `darwin-arm64` goldens. If a golden differs by more than the tolerance on this machine, run `pnpm visual:jitter` and report the numbers; do not update goldens to pass.

- [ ] **Step 3: Gate, log, commit**

Run: `pnpm gate:full:quiet` → green. Append both add-ons to the log. Commit: `git add -A && git commit -m "chore(m0): ci-security (dependabot) and visual add-ons"`.

---

### Task 13: Close M0

**Files:**
- Modify: `docs/superpowers/specs/2026-10-11-app-v2-design.md` (one line), `docs/superpowers/notes/2026-10-11-m0-merge-log.md` (final section)

- [ ] **Step 1: Amend the spec** — in Section 1's table, the row for the six starter packages: replace "The sample feature is deleted after the first green commit; the scaffolding stays" with "The price-list sample stays through M0 (it proves the scaffolding and is what `AGENTS.md` points at); M1 replaces it pattern by pattern".

- [ ] **Step 2: Finish the merge log** — under "Still to do by hand", the complete list a `starter` unit must handle, as found: root `package.json` merge; `pnpm-workspace.yaml` patterns; `.gitignore` merge; `eslint.config.mts` ignores; an existing `packages/domain`; `architecture.config.mts` entries for pre-existing packages; `javascriptAllowed` for an archive folder; `.claude/settings.json` hooks merged after green; `AGENTS.md` section for extra packages. Plus the lint counts from Task 8 Step 4.

- [ ] **Step 3: Last full run and commit**

Run: `pnpm gate:full:quiet && git status --short` → green and clean after:
`git add -A && git commit -m "docs(m0): merge log complete; spec amended (sample kept until M1)"`.

- [ ] **Step 4: Report** — what is green, the commands (`pnpm dev`, `pnpm gate:fast`, `pnpm gate:full:quiet`, `pnpm --filter @cl/legacy-import gen:data`), which add-ons are in (`format-lint`, `strict-lint`, `coverage`, `ci-security:dependabot`, `visual`) and which are not (`e2e`, `performance`, `repo-hygiene`, `agent-workflow`) with `node $PLUGIN/scripts/add-to-project.mts . <name>` to add one, and that the hooks now run for everyone on the project. The branch is not merged; M1 planning follows.
