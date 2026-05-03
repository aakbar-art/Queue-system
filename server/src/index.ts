import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import bcrypt from "bcryptjs";
import { createServer } from "node:http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
import { isSqlSnapshotEnabled } from "./db/config.js";
import { getSqlPool } from "./db/pool.js";
import { getSnapshotStoreMode, mergePasswordHashes, readSnapshot, writeSnapshot } from "./snapshotStore.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: "50mb" }));

app.get("/api/health", async (_req, res) => {
  const mode = getSnapshotStoreMode();
  let db: boolean | "skipped" | "error" = "skipped";
  if (isSqlSnapshotEnabled()) {
    try {
      const pool = await getSqlPool();
      if (pool) {
        await pool.request().query("SELECT 1 AS ok");
        db = true;
      }
    } catch {
      db = "error";
    }
  }
  res.json({
    ok: true,
    service: "arcedge-queue-api",
    snapshotStore: mode,
    sqlConfigured: isSqlSnapshotEnabled(),
    db,
  });
});

app.get("/api/queue/state", async (_req, res) => {
  try {
    const state = await readSnapshot();
    res.json({ state });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post("/api/queue/state", async (req, res) => {
  try {
    const merged = await mergePasswordHashes(req.body as Record<string, unknown>);
    await writeSnapshot(merged);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "username and password required" });
    return;
  }
  try {
    const snap = (await readSnapshot()) as {
      users?: { id: string; username: string; fullName: string; roles: string[]; password?: string; passwordHash?: string; active?: boolean }[];
    };
    const u = snap.users?.find((x) => x.username === username && x.active !== false);
    if (!u) {
      res.status(401).json({ error: "invalid" });
      return;
    }
    let ok = false;
    if (u.passwordHash) {
      ok = bcrypt.compareSync(password, u.passwordHash);
    } else if (u.password) {
      ok = u.password === password;
    }
    if (!ok) {
      res.status(401).json({ error: "invalid" });
      return;
    }
    res.json({
      user: { id: u.id, username: u.username, fullName: u.fullName, roles: u.roles },
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

const httpServer = createServer(app);
httpServer.listen(port, () => {
  console.log(`ArcEdge Queue API listening on http://localhost:${port}`);
  console.log(
    `Snapshot store: ${getSnapshotStoreMode()}${isSqlSnapshotEnabled() ? ` (${process.env.SQL_SERVER}/${process.env.SQL_DATABASE})` : ""}`,
  );
});
httpServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `[ArcEdge] Port ${port} is already in use. Stop the other process or set PORT=3002 in server/.env (and match Vite proxy).`,
    );
  } else {
    console.error("[ArcEdge] HTTP server error:", err);
  }
  process.exit(1);
});
