import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeUserPasswordHashes } from "./mergeUsers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
export const snapshotPath = path.join(dataDir, "snapshot.json");
const defaultPath = path.join(__dirname, "defaultSnapshot.json");

export async function readSnapshotFile(): Promise<unknown> {
  try {
    const raw = await fs.readFile(snapshotPath, "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    const raw = await fs.readFile(defaultPath, "utf8");
    return JSON.parse(raw) as unknown;
  }
}

export async function writeSnapshotFile(body: unknown): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(snapshotPath, JSON.stringify(body, null, 2), "utf8");
}

export async function mergePasswordHashesFile(incoming: Record<string, unknown>): Promise<Record<string, unknown>> {
  let prev: Record<string, unknown> | null = null;
  try {
    const raw = await fs.readFile(snapshotPath, "utf8");
    prev = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    /* no previous file */
  }
  return mergeUserPasswordHashes(incoming, prev) as Record<string, unknown>;
}
