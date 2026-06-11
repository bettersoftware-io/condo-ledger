# Postgres Is Live — Operator Playbook & DB-Migration Resume Plan

> **Written:** 2026-06-10. **Branch:** `feat/db-migration`.
>
> **Purpose:** (1) record that the sibling PostgreSQL 16 container now exists and is verified, (2) give
> the **recurring** steps you run each time to bring it up and re-link a sandbox, and (3) be the resume
> point for the DB-migration work (Tasks 9–18) once a Claude session is running **inside the
> claude-sandbox**.
>
> Companion docs (read only if you need the full reasoning):
> - Setup detail / troubleshooting: `docs/superpowers/plans/2026-06-09-sibling-postgres-container.md`
> - The migration plan being executed: `docs/superpowers/plans/2026-06-08-db-migration.md`

---

## 0. The architecture in one picture

```
 macOS host (csx-mbp-16-m2.local, Apple Silicon)
 └─ Docker Desktop ── one daemon ─────────────────────────────────────────────┐
     │                                                                         │
     │   container: claude-sandbox-…   (where the DB-migration Claude runs)    │
     │        env: DATABASE_URL = postgres://condo:condo@condo-postgres:5432/condo
     │                         │                                               │
     │      user-defined bridge│ network  "condo-net"  (embedded DNS)          │
     │                         ▼                                               │
     │   container: condo-postgres   postgres:16-alpine (16.14, aarch64)       │
     │        listens 0.0.0.0:5432 · volume condo_pg · superuser role "condo"  │
     │        host port 5432 published (optional, GUI inspection only)         │
     └─────────────────────────────────────────────────────────────────────────┘
```

**Key fact that trips people up:** the DB client is the **sandboxed** Claude, which has its own network
namespace. It reaches Postgres by the sibling's **container name** `condo-postgres`, *not* `localhost`.
The `localhost:5432` URL in `packages/db/docker-compose.yml` / `.env.example` is only valid for a client
running on the host — do **not** use it from inside the sandbox.

**Why a host session created this:** a sandboxed Claude has no Docker socket, so it cannot `docker run`.
Creating the container is a one-time bootstrap done from a host-run Claude session (or your Terminal).

---

## 1. Current status (verified 2026-06-10)

| Thing | Value | State |
|---|---|---|
| Network | `condo-net` (user-defined bridge) | ✅ created |
| Postgres container | `condo-postgres` — `postgres:16-alpine` → **16.14 aarch64** | ✅ running, `--restart unless-stopped` |
| Role / DB | `condo` / `condo` (role is a cluster **superuser** — required for Task 15 replica-mode load) | ✅ |
| Data volume | `condo_pg` (survives restarts/removal) | ✅ created, **empty** (no schema yet) |
| Host port | `5432` published | ✅ (optional; for TablePlus/DBeaver/psql) |
| Sandbox link | both running sandboxes attached to `condo-net`; DNS+TCP to `condo-postgres:5432` green | ✅ verified |
| `DATABASE_URL` in sandbox | not set; `/workspace` empty (repo not mounted there yet) | ⏳ **TODO in sandbox** |

The migration itself (schema → ETL → verification) has **not** run yet — the DB is an empty cluster.

---

## 2. Recurring playbook — what you do each time

There are three actors: the **host** (Docker control), and the **sandbox** (DB client). Most days you do
almost nothing because the container auto-restarts and a persistent sandbox keeps its network link.

### 2A. Each time: ensure the Postgres container is up — **on the host**

The container was created with `--restart unless-stopped`, so when Docker Desktop starts it comes back
on its own. You only act if it's stopped.

```bash
# Is it running?
docker ps --filter name=condo-postgres --format '{{.Names}} {{.Status}}'

# If it exists but is stopped, start it (data is intact in volume condo_pg):
docker start condo-postgres

# Confirm it accepts connections:
docker exec condo-postgres pg_isready -U condo -d condo
```

> **First time only / after a wipe** — if `docker ps -a` shows no `condo-postgres` at all, recreate it
> (this is the one-time bootstrap, also in the companion runbook Part A):
> ```bash
> docker network create condo-net 2>/dev/null || true
> docker run -d --name condo-postgres --network condo-net --restart unless-stopped \
>   -e POSTGRES_USER=condo -e POSTGRES_PASSWORD=condo -e POSTGRES_DB=condo \
>   -v condo_pg:/var/lib/postgresql/data -p 5432:5432 postgres:16-alpine
> until docker exec condo-postgres pg_isready -U condo -d condo >/dev/null 2>&1; do sleep 1; done
> ```

### 2B. Each time you (re)create a sandbox: attach it to `condo-net` — **on the host**

A **persistent** sandbox keeps its `condo-net` membership across stop/start — nothing to do. You only
re-attach when the sandbox is **recreated** (new container id), which drops the membership.

```bash
# Find the sandbox container id (works even with several sandboxes running):
docker ps --filter name=claude-sandbox --format '{{.ID}}  {{.Names}}  {{.Status}}'
#   …or, from INSIDE the sandbox: `hostname` prints its own id.

# Attach it (additive, safe on a running container; repeat per sandbox id):
docker network connect condo-net <SANDBOX_ID>

# Confirm both are on the network:
docker network inspect condo-net --format '{{range .Containers}}{{.Name}} {{end}}'
#   expect: …condo-postgres  claude-sandbox-…
```

### 2C. Each time a fresh sandbox session starts work: point it at the DB — **inside the sandbox**

A recreated sandbox also loses its env. Set the connection string (container **name**, not localhost):

```bash
# from the repo root inside the sandbox:
echo 'DATABASE_URL=postgres://condo:condo@condo-postgres:5432/condo' > packages/db/.env
export DATABASE_URL=postgres://condo:condo@condo-postgres:5432/condo
```

Then verify end-to-end before doing any DB work:

```bash
# DNS + TCP (no client needed):
getent hosts condo-postgres || echo "NOT on condo-net → redo 2B on the host"
node -e "require('net').connect(5432,'condo-postgres').on('connect',()=>{console.log('tcp ok');process.exit(0)}).on('error',e=>{console.error(e.message);process.exit(1)})"

# Real authenticated query via the vendored pg driver:
cd packages/db && node --input-type=module -e \
"import pg from 'pg'; const c=new pg.Client(process.env.DATABASE_URL); await c.connect(); console.log((await c.query('select version()')).rows[0].version); await c.end();"
# expect: PostgreSQL 16.x … aarch64
```

### Quick decision table

| Situation | Do |
|---|---|
| Mac rebooted / Docker Desktop restarted | Nothing — container auto-restarts (2A only if `docker ps` is empty). |
| `condo-postgres` shows stopped | `docker start condo-postgres` (2A). |
| Same sandbox, new session | Just 2C (set/confirm `DATABASE_URL`). Network link persisted. |
| **Sandbox was recreated** (new id) | 2B (re-attach) **then** 2C (re-set env). |
| `could not translate host name "condo-postgres"` in sandbox | Sandbox not on `condo-net` → 2B. |
| `password authentication failed` | Volume has old creds → wipe & recreate (see §4). |

---

## 3. Resume the DB migration — for the Claude session **inside the sandbox**

**Preconditions:** §2C verification passed (you got a `PostgreSQL 16.x` version line). The cluster is
empty — no schema, no data.

Execute the remaining tasks of `docs/superpowers/plans/2026-06-08-db-migration.md`
**subagent-driven** (`superpowers:subagent-driven-development`), continuing from **Task 9**. Remaining:

- [ ] **Task 9** — shared `set_timestamps()` trigger (operates on `created`/`updated`).
- [ ] **Task 10** — generate migrations with drizzle-kit; wire trigger & the 6 views migrations; prove they apply against `condo-postgres`.
- [ ] **Task 11** — schema-drift guard (drizzle-kit reports no drift after migrate).
- [ ] **Task 12** — ETL parser: read the MySQL extended `INSERT`s from `old/db/`.
- [ ] **Task 13** — ETL transforms: `tinyint(1)`→bool, `datetime`→`timestamptz` (Europe/Rome→UTC; **not** for `date` cols), `default`→`is_default`, plus `camelCase→snake_case` column-name mapping via `naming.ts`.
- [ ] **Task 14** — bank FK-closure (extract only referenced `bankBranch`/`bank` rows; avoid the 44M-row registry).
- [ ] **Task 15** — the loader: bulk insert under `session_replication_role='replica'` (suspends FK + triggers, preserves legacy timestamps), then resync identity sequences. **Needs the superuser `condo` role** — already in place.
- [ ] **Task 16** — seed orchestrator: Tier A (reference) → B (`masterData`) → C (operational).
- [ ] **Task 17** — verification suite: row-count parity, FK integrity, enum domains, sequence health, schema-drift-free.
- [ ] **Task 18** — README + one-command rebuild + full green run.

**Watch-outs carried from Tasks 1–8** (see the plan's "⚠️ Plan Corrections" block — it supersedes any
conflicting task text): source timestamp col is legacy `lastModified` → schema `updated`; self-ref cols
are entity-specific (`parent_condominium_id`, etc.); `masterData` audit self-FKs
`created_master_data_id`/`last_modified_master_data_id` are **not** the `updated` column; `default` →
`is_default` lives on `masterDataTaxTreatment`; `date` columns are calendar-only (no TZ conversion).
`toSnake` already reproduces the authored names exactly (guarded by `test/namingConvergence.test.ts`).

When done, follow `superpowers:finishing-a-development-branch`.

---

## 4. Lifecycle & data (host)

| Action | Command |
|---|---|
| Stop (keep data) | `docker stop condo-postgres` |
| Start again | `docker start condo-postgres` |
| Logs | `docker logs -f condo-postgres` |
| Inspect with GUI | connect to `localhost:5432`, db/user/pass `condo` (host port publish) |
| Remove container (keep data) | `docker rm -f condo-postgres` (volume `condo_pg` survives) |
| **Wipe data** (clean reload) | `docker rm -f condo-postgres && docker volume rm condo_pg` then re-run §2A bootstrap |
| Remove network (after container gone) | `docker network rm condo-net` |

> ⚠️ **Credential gotcha:** `POSTGRES_USER/PASSWORD/DB` apply **only on first init of an empty volume**.
> Changing them while reusing `condo_pg` keeps the old creds (→ `password authentication failed`). To
> change creds, wipe the volume first. The ETL (Task 15/16) is re-runnable, so wiping for a clean reload
> is the normal reset path.

---

## 5. Identifiers reference

| Name | Value |
|---|---|
| Network | `condo-net` |
| Postgres container | `condo-postgres` |
| Image | `postgres:16-alpine` (16.14, arm64) |
| Data volume | `condo_pg` |
| Role / password / db | `condo` / `condo` / `condo` |
| Sandbox URL | `postgres://condo:condo@condo-postgres:5432/condo` |
| Host URL (GUI only) | `postgres://condo:condo@localhost:5432/condo` |
| Sandboxes seen 2026-06-10 | `claude-sandbox-1781053123-7637`, `claude-sandbox-1781053103-7158` (ids change on recreation — always reconfirm) |
