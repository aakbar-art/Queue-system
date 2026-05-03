import sql from "mssql";
import { getSqlPool } from "./db/pool.js";
import { mergeUserPasswordHashes } from "./mergeUsers.js";
import { readSnapshotFile } from "./snapshotFile.js";

const SINGLETON_KEY = "X";

export async function readSnapshotSql(): Promise<unknown> {
  const pool = await getSqlPool();
  if (!pool) throw new Error("SQL pool unavailable");

  const result = await pool.request().input("k", sql.Char(1), SINGLETON_KEY).query(`
    SELECT TOP (1) [PayloadJson], [Rev], [UpdatedAt]
    FROM [ops].[QueueSnapshot]
    WHERE [SingletonKey] = @k
  `);

  const row = result.recordset?.[0] as { PayloadJson?: string } | undefined;
  if (!row?.PayloadJson) {
    return readSnapshotFile();
  }
  return JSON.parse(row.PayloadJson) as unknown;
}

export async function writeSnapshotSql(body: unknown): Promise<void> {
  const pool = await getSqlPool();
  if (!pool) throw new Error("SQL pool unavailable");

  const payload = JSON.stringify(body);
  const rev = Math.max(0, Math.floor(Number((body as { rev?: number }).rev ?? 0)));

  const req = pool.request();
  req.input("payload", sql.NVarChar(sql.MAX), payload);
  req.input("rev", sql.BigInt, BigInt(rev));
  req.input("k", sql.Char(1), SINGLETON_KEY);

  await req.query(`
    IF EXISTS (SELECT 1 FROM [ops].[QueueSnapshot] WHERE [SingletonKey] = @k)
      UPDATE [ops].[QueueSnapshot]
      SET [PayloadJson] = @payload, [Rev] = @rev, [UpdatedAt] = SYSUTCDATETIME()
      WHERE [SingletonKey] = @k;
    ELSE
      INSERT INTO [ops].[QueueSnapshot] ([SingletonKey], [PayloadJson], [Rev])
      VALUES (@k, @payload, @rev);
  `);
}

export async function mergePasswordHashesSql(incoming: Record<string, unknown>): Promise<Record<string, unknown>> {
  let prev: Record<string, unknown> | null = null;
  try {
    const raw = await readSnapshotSql();
    prev = raw as Record<string, unknown>;
  } catch {
    prev = null;
  }
  return mergeUserPasswordHashes(incoming, prev) as Record<string, unknown>;
}
