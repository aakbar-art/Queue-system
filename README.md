# ArcEdge Queue (demo monorepo)

Single-tenant **clinic queue** demo: staff admin, simulated WhatsApp intake, wall display, patient status, **local-first** state (`localStorage` + `BroadcastChannel`) with optional **Express** snapshot API and **SQL Server** DDL scripts (normalized starter — not full portal sync).

**Not HIPAA compliant.** For evaluation and local demos only.

## URLs (web, default `http://localhost:5173`)

| Path         | Purpose                                      |
| ------------ | -------------------------------------------- |
| `/`          | Marketing / entry links                    |
| `/login`     | Staff login + demo quick-fill               |
| `/admin`     | Control room (queue, approvals, tabs)     |
| `/whatsapp`  | Simulated intake chat                       |
| `/display`   | Full-screen wall (hides main nav)          |
| `/patient`   | Status lookup by phone or ticket code       |

## Default credentials (local demo mode)

Stored in client `QueueState` seed (`apps/web`):

- `admin` / `admin123`
- `front` / `front123`
- `doctor` / `doctor123`

API mode: run `npm run seed` then start server; same usernames with bcrypt-verified passwords in `server/data/snapshot.json`.

## Run locally

```bash
cd arcedge-queue
npm install
npm run dev
```

- Web: http://localhost:5173 (proxies `/api` → :3001)
- API: http://localhost:3001

### Optional API sync (web)

Create `apps/web/.env`:

```env
VITE_QUEUE_BACKEND=1
VITE_API_BASE_URL=/api
```

### API snapshot + login

```bash
npm run seed
npm run dev:server
```

`GET /api/queue/state` returns `{ state }` from the active snapshot store (see below).

`POST /api/queue/state` saves JSON (50mb limit). Password hashes are preserved when client sends users with empty `password` fields (merged with the **previous** snapshot — file or SQL row).

`POST /api/auth/login` JSON `{ username, password }` → `{ user: { id, username, fullName, roles } }`.

## SQL Server (optional)

1. Start Docker SQL:

   ```bash
   docker compose up -d
   ```

   SA password in `docker-compose.yml` (change for real use).

2. Apply scripts in order:

   ```text
   database/sqlserver/00_create_database.sql
   database/sqlserver/01_schemas.sql
   database/sqlserver/02_tables_core.sql
   database/sqlserver/03_tables_visit.sql
   database/sqlserver/04_functions_procedures.sql
   database/sqlserver/05_bootstrap.sql
   database/sqlserver/06_queue_snapshot.sql
   ```

   Example:

   ```bash
   sqlcmd -S localhost,1433 -U sa -P "ArcEdge_Dev_1!" -i database/sqlserver/00_create_database.sql
   ```

### SQL snapshot sync (optional)

If **`SQL_SERVER`** and **`SQL_DATABASE`** are set in `server/.env`, the API stores the full `QueueState` JSON in **`[ops].[QueueSnapshot]`** (single row `SingletonKey = 'X'`, column `PayloadJson`).

- **`GET /api/health`** reports `snapshotStore: "sql"` | `"file"` and whether the DB ping succeeded.
- If SQL is configured but unreachable or the query fails, **read/write falls back to file** (`server/data/snapshot.json`) with a console warning.
- Windows Integrated Auth (`SQL_USE_WINDOWS_AUTH`) is listed in `.env.example` for future use; the current pool uses **SQL authentication** (`SQL_USER` / `SQL_PASSWORD`).

After enabling SQL, run `npm run seed` (or POST once from the UI with backend on) so a snapshot exists, or rely on the first client hydration POST.

## Structure

```text
apps/web     — Vite 7 + React 19 + TanStack Router + Tailwind v4
server       — Express API
database/    — SQL Server ordered scripts
scripts/     — `seed-demo-state.mjs`
```

## Scripts

| Command            | Description                    |
| ------------------ | ------------------------------ |
| `npm run dev` / `npm start` | Web + API together (`npm start` alias) |
| `npm run build`    | Production builds              |
| `npm run seed`     | Write `server/data/snapshot.json` |
| `npm run lint`     | ESLint in workspaces           |

### Troubleshooting (Windows)

1. **`npm` / `npm run dev` fails or nothing listens**
   - Run from the **`arcedge-queue` folder** (where `package.json` is): `npm install` then `npm run dev`.
   - Use **`powershell -ExecutionPolicy Bypass -File .\scripts\dev-windows.ps1`** to stop stray Node processes on ports **3001** and **5173**, then start dev.

2. **`Port 3001 already in use`**
   - Stop the other process or set **`PORT=3002`** in **`server/.env`** and set **`VITE_DEV_API_PROXY=http://localhost:3002`** in **`apps/web/.env`**.

3. **Blank page or routes 404 in production**
   - Serve the **`apps/web/dist`** folder with an SPA fallback to **`index.html`** (not `file://`).

4. **Database**
   - **No SQL Server required** for local demo: leave **`SQL_SERVER`** empty in **`server/.env`** (copy from **`server/.env.example`**). The API uses **`server/data/snapshot.json`**.
   - **Docker SQL Server**: install [Docker Desktop](https://www.docker.com/products/docker-desktop/), then from repo root run **`powershell -ExecutionPolicy Bypass -File .\scripts\setup-sql-docker.ps1`**. Install **`sqlcmd`** (SQL Server Command Line Utilities) if you want the script to apply `.sql` files automatically; otherwise run them in SSMS.
   - This machine may not have **Docker** or **`sqlcmd`**; the scripts print next steps if they are missing.
