import { isSqlSnapshotEnabled } from "./db/config.js";
import { mergePasswordHashesFile, readSnapshotFile, writeSnapshotFile } from "./snapshotFile.js";
import { mergePasswordHashesSql, readSnapshotSql, writeSnapshotSql } from "./snapshotSql.js";

export type SnapshotStoreMode = "sql" | "file";

export function getSnapshotStoreMode(): SnapshotStoreMode {
  return isSqlSnapshotEnabled() ? "sql" : "file";
}

export async function readSnapshot(): Promise<unknown> {
  if (!isSqlSnapshotEnabled()) return readSnapshotFile();
  try {
    return await readSnapshotSql();
  } catch (e) {
    console.warn("[snapshot] SQL read failed, falling back to file:", e);
    return readSnapshotFile();
  }
}

export async function writeSnapshot(body: unknown): Promise<void> {
  if (!isSqlSnapshotEnabled()) return writeSnapshotFile(body);
  try {
    await writeSnapshotSql(body);
  } catch (e) {
    console.warn("[snapshot] SQL write failed, falling back to file:", e);
    return writeSnapshotFile(body);
  }
}

export async function mergePasswordHashes(incoming: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!isSqlSnapshotEnabled()) return mergePasswordHashesFile(incoming);
  try {
    return await mergePasswordHashesSql(incoming);
  } catch (e) {
    console.warn("[snapshot] SQL merge read failed, using file merge:", e);
    return mergePasswordHashesFile(incoming);
  }
}
