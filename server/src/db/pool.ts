import { createRequire } from "node:module";
import sql from "mssql";
import { isSqlSnapshotEnabled, sqlConnectionOptions } from "./config.js";

const require = createRequire(import.meta.url);
const sqlWindows: typeof sql = require("mssql/msnodesqlv8");

let pool: sql.ConnectionPool | null = null;

function odbcWindowsConnectionString(): string {
  const opts = sqlConnectionOptions();
  const driver =
    process.env.SQL_ODBC_DRIVER?.trim() || "ODBC Driver 18 for SQL Server";
  const encrypt = opts.options.encrypt ? "yes" : "no";
  const trust = opts.options.trustServerCertificate ? "yes" : "no";
  return [
    `Driver={${driver}}`,
    `Server=${opts.server}`,
    `Database=${opts.database}`,
    "Trusted_Connection=yes",
    `Encrypt=${encrypt}`,
    `TrustServerCertificate=${trust}`,
  ].join(";");
}

export async function getSqlPool(): Promise<sql.ConnectionPool | null> {
  if (!isSqlSnapshotEnabled()) return null;
  if (pool) return pool;

  const opts = sqlConnectionOptions();
  const useWindows = !opts.user;

  const p = useWindows
    ? new sqlWindows.ConnectionPool({
        server: opts.server,
        database: opts.database,
        connectionString: odbcWindowsConnectionString(),
        options: {
          trustedConnection: true,
          encrypt: opts.options.encrypt,
          trustServerCertificate: opts.options.trustServerCertificate,
        },
        pool: opts.pool,
      } as sql.config)
    : new sql.ConnectionPool({
        server: opts.server,
        database: opts.database,
        user: opts.user,
        password: opts.password,
        options: opts.options,
        pool: opts.pool,
      });

  await p.connect();
  pool = p;
  return pool;
}

export async function closeSqlPool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}
