# Sibling PostgreSQL Container — Setup Runbook

> **Audience:** An operator (you, or a Claude session **with host Docker access**) working on the
> **macOS host**, plus a short follow-up inside the Claude Code sandbox container.
> **Goal:** Stand up a PostgreSQL 16 server as a *sibling* container next to the Claude Code sandbox,
> on a shared Docker network, so `@cl/db` (this repo) can reach it and Tasks 9–18 of
> `docs/superpowers/plans/2026-06-08-db-migration.md` can run.
>
> This runbook is **self-contained** — every command is inline; you do not need to read other repo
> files to execute it.

---

## 0. The model (read this first — 60 seconds)

We are **not** nesting Docker. We run two **sibling** containers under the *one* Docker Desktop
daemon, attached to a shared user-defined network. The sandbox reaches Postgres by **container name**
(Docker's embedded DNS resolves it), not by `localhost`.

```
 macOS host (Apple Silicon)
 └─ Docker Desktop  ── one Linux VM, one daemon ──────────────────────────────┐
     │                                                                         │
     │   container: claude-sandbox   (id e58857fd7c92 — where Claude runs)     │
     │        env: DATABASE_URL = postgres://condo:condo@condo-postgres:5432/condo
     │                         │                                               │
     │      user-defined bridge│ network  "condo-net"  (embedded DNS)          │
     │                         ▼                                               │
     │   container: condo-postgres   image postgres:16-alpine                  │
     │        listens 0.0.0.0:5432 · volume condo_pg · superuser role "condo"  │
     └─────────────────────────────────────────────────────────────────────────┘
```

**Why container name, not `localhost`:** each container has its own network namespace, so a sibling
is never on the sandbox's `localhost`. On a *user-defined* network (not the default bridge), Docker's
DNS resolves sibling container names. So the sandbox connects to `condo-postgres:5432`. Nothing in the
`@cl/db` code hardcodes the host — `makePool()`, `drizzle.config.ts`, and the tests all read
`process.env.DATABASE_URL` — so the only thing that "changes" from the documented default is the host
token in that one env var.

**Why the container (not a native macOS Postgres):** the official `postgres` image already sets
`listen_addresses='*'` and ships a `pg_hba.conf` that accepts password auth from any host on its
networks. So there is **no `postgresql.conf` / `pg_hba.conf` surgery and no macOS firewall prompt** —
those gotchas only apply to a host-native install.

---

## Prerequisites

- Docker Desktop running on the Mac (provides the daemon + the Linux VM).
- The Claude Code sandbox container is **running** (we attach to it live; we do **not** recreate it).
- `postgres:16-alpine` is multi-arch and runs natively on Apple Silicon (arm64). No special flags.

---

## Part A — Create the sibling Postgres container (on the macOS host)

Run these on the **host** (Terminal on the Mac, or a Claude session with host Docker access).
The primary path uses explicit `docker` commands so every name is deterministic and verifiable.

```bash
# A1. Create the shared user-defined network (idempotent — ignore "already exists").
docker network create condo-net 2>/dev/null || true

# A2. Start PostgreSQL 16 as a named sibling on that network, with a persistent named volume.
#     POSTGRES_USER "condo" is created as a SUPERUSER of the cluster — required later for the
#     ETL's `SET session_replication_role = 'replica'` (Task 14).
docker run -d \
  --name condo-postgres \
  --network condo-net \
  --restart unless-stopped \
  -e POSTGRES_USER=condo \
  -e POSTGRES_PASSWORD=condo \
  -e POSTGRES_DB=condo \
  -v condo_pg:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:16-alpine

# A3. Wait until it is accepting connections.
until docker exec condo-postgres pg_isready -U condo -d condo >/dev/null 2>&1; do
  echo "waiting for postgres..."; sleep 1;
done
echo "postgres is ready"
```

**About `-p 5432:5432` (host port publish):** this is **optional** and only lets you inspect the DB
from a Mac GUI (TablePlus, DBeaver, `psql`). The **sandbox↔Postgres link does not depend on it** —
that goes over `condo-net`. If port 5432 is already taken on the Mac (e.g. you also have a native
Postgres), change the *left* number only, e.g. `-p 55432:5432`, or drop `-p` entirely.

Verify from the host:

```bash
docker ps --filter name=condo-postgres
docker exec -it condo-postgres psql -U condo -d condo -c '\conninfo'
docker exec -it condo-postgres psql -U condo -d condo -c 'show listen_addresses;'   # -> *
```

---

## Part B — Attach the Claude sandbox to the same network (on the host)

The sandbox keeps its **existing** network (it needs that for outbound internet, e.g. the npm
registry). We **add** `condo-net` to it — this is additive (multi-homing) and live; the sandbox is
**not** recreated and its current work is untouched.

```bash
# B1. Find the sandbox's container id. Inside the sandbox, `hostname` prints it.
#     At the time this runbook was written it was: e58857fd7c92
#     ALWAYS re-confirm, because the id changes if the sandbox is ever recreated:
#       (run inside the sandbox)  hostname
SANDBOX=e58857fd7c92   # <-- replace with the current value from `hostname`

# B2. Attach it to condo-net (additive; safe on a running container).
docker network connect condo-net "$SANDBOX"

# B3. Confirm both containers are on condo-net.
docker network inspect condo-net --format '{{range .Containers}}{{.Name}} {{end}}'
#   expected output contains:  condo-postgres   <sandbox-name-or-id>
```

---

## Part C — Point the sandbox at Postgres (the `DATABASE_URL`)

The connection string the sandbox must expose:

```
DATABASE_URL=postgres://condo:condo@condo-postgres:5432/condo
```

Choose **one** of these (durable is preferred):

**C-durable (recommended) — bake it into the sandbox launch.**
If you control how the sandbox is started, add this to its `docker run` (env only — does not affect
networking, so it won't disturb the sandbox's internet access):

```
-e DATABASE_URL=postgres://condo:condo@condo-postgres:5432/condo
```

> Note: `--network condo-net` at *launch* requires the network to pre-exist and would replace the
> sandbox's default network (breaking internet). So do the network attach **live** via Part B, and
> use `-e` only for the env var. That combination is the clean durable setup.

**C-live (no relaunch) — set it inside the running sandbox.**
Write it to the package's env file (read by tooling) and/or export it for the session. Run **inside
the sandbox**:

```bash
echo 'DATABASE_URL=postgres://condo:condo@condo-postgres:5432/condo' > packages/db/.env
export DATABASE_URL=postgres://condo:condo@condo-postgres:5432/condo
```

---

## Part D — Verify connectivity from inside the sandbox

Run **inside the sandbox**. First, DNS + TCP reachability (no DB client needed):

```bash
getent hosts condo-postgres || echo "name does not resolve -> sandbox not on condo-net (redo Part B)"
node -e "require('net').connect(5432,'condo-postgres').on('connect',()=>{console.log('tcp ok');process.exit(0)}).on('error',e=>{console.error(e.message);process.exit(1)})"
```

Then a real authenticated query using the `pg` driver already vendored in `@cl/db`
(run from the package dir so `pg` resolves):

```bash
cd packages/db
node --input-type=module -e "import pg from 'pg'; const c=new pg.Client(process.env.DATABASE_URL); await c.connect(); console.log((await c.query('select version()')).rows[0].version); await c.end();"
```

Expected: a line like `PostgreSQL 16.x ... aarch64`. That confirms name resolution, TCP, auth, and
the database are all good — Tasks 9–18 can proceed.

---

## Lifecycle & data

| Action | Command (host) |
|---|---|
| Stop (keep data) | `docker stop condo-postgres` |
| Start again | `docker start condo-postgres` |
| Logs | `docker logs -f condo-postgres` |
| Remove container (keep data) | `docker rm -f condo-postgres` (volume `condo_pg` survives) |
| **Wipe data** (clean reload) | `docker rm -f condo-postgres && docker volume rm condo_pg` |
| Remove network (after container gone) | `docker network rm condo-net` |

Data lives in the named volume `condo_pg`, so it **survives** container restarts/removal. The ETL is
re-runnable; to start from an empty DB, wipe the volume as above and re-run Part A.

> ⚠️ **Credential gotcha:** `POSTGRES_USER/PASSWORD/DB` are applied **only on first initialization of
> an empty volume**. If you later change them but reuse an existing `condo_pg` volume, the old
> credentials remain and you'll get `password authentication failed`. To change creds, wipe the
> volume first.

---

## Troubleshooting

| Symptom (in the sandbox) | Cause | Fix |
|---|---|---|
| `could not translate host name "condo-postgres"` | Sandbox not on `condo-net`, or on the default bridge (no name DNS) | Redo **Part B**; confirm with `docker network inspect condo-net` |
| `connection refused` | Postgres not started / still initializing / wrong port | `docker ps`, `docker logs condo-postgres`; wait for `pg_isready` |
| `password authentication failed` | Volume initialized with different creds | Wipe volume (`docker volume rm condo_pg`) and recreate (Part A) |
| Host `-p 5432` fails to bind | A native macOS Postgres already owns 5432 | Use `-p 55432:5432` or drop `-p`; sandbox link is unaffected |
| Works, then breaks after a sandbox rebuild | Recreating the sandbox drops its `condo-net` attachment and env | Re-run **Part B** + **Part C** (new container id from `hostname`) |

---

## Hand-back to the resuming Claude session

Once Part D passes, the next Claude Code session in this repo should be told:

> Postgres 16 is live as sibling container `condo-postgres` on network `condo-net`.
> `DATABASE_URL=postgres://condo:condo@condo-postgres:5432/condo` (role `condo` is superuser).
> Confirm reachability with the Part D query, then resume the DB-migration plan
> (`docs/superpowers/plans/2026-06-08-db-migration.md`) subagent-driven from **Task 9**.

---

## Appendix — alternatives (optional, not recommended)

**A. Reuse the committed compose file** (`packages/db/docker-compose.yml`). Running it *on the host*
also works, but Compose auto-derives the network name (`<project>_default`) and project-prefixes the
volume (`<project>_condo_pg`), which makes the Part B attach and data identity less predictable. If
you prefer Compose, pin names explicitly:

```yaml
# docker-compose.host.yml (on the Mac host)
name: condo
services:
  postgres:
    image: postgres:16-alpine
    container_name: condo-postgres
    environment: { POSTGRES_USER: condo, POSTGRES_PASSWORD: condo, POSTGRES_DB: condo }
    ports: ["5432:5432"]
    volumes: ["condo_pg:/var/lib/postgresql/data"]
    networks: [condo-net]
volumes:
  condo_pg:
networks:
  condo-net:
    name: condo-net
volumes_note: "then `docker compose -f docker-compose.host.yml up -d` and still do Part B/C/D."
```

**B. Preserve a literal `localhost:5432` in `DATABASE_URL`** via a forwarder inside the sandbox
(`socat TCP-LISTEN:5432,fork,reuseaddr TCP:condo-postgres:5432 &`). This adds a process + a `socat`
dependency for no real benefit now that we know the URL is just an env var — **prefer the container
name** (`condo-postgres`) and skip this.
