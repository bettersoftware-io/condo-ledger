# condo-ledger

## Working on it

Node 26 or later, and pnpm 12.6.0: either via Corepack or from any global pnpm 9.7 or later, which switches itself to the version pinned by `packageManager` in `package.json` (`.npmrc` turns that on).

    pnpm install
    pnpm dev              # the React client on the in-browser simulator
    pnpm dev:fs           # the server and the client together
    pnpm gate:fast        # architecture gates, lint, typecheck: seconds
    pnpm gate:full        # the same, then tests and the build: what CI runs
    pnpm gate:full:quiet  # the same, printing only the stage that failed
    pnpm --filter @cl/legacy-import gen:data   # regenerate the simulator seed from the legacy dump
    pnpm --filter @cl/db rebuild                # reset, migrate and seed a local Postgres (needs DATABASE_URL)

`AGENTS.md` says where each kind of code goes. `old/` is the archived legacy
application and the first prototype; `docs/design/web/v1` is the design the
app is built to.

Opening this repository in Claude Code or Codex registers the kit's hooks from `.claude/settings.json` and `.codex/hooks.json`: the after-edit check runs on every edit and `gate:full` runs before a turn ends.
