import fs from "node:fs";
import path from "node:path";

/**
 * Where the runtime store lives. `CCR_STORE_DIR` lets tests point at a
 * throwaway directory so they never touch the working store; unset, it is
 * `data/store` under the project root as normal.
 */
function storeDir(): string {
  return process.env.CCR_STORE_DIR ?? path.join(process.cwd(), "data", "store");
}

function ensureStoreDir(): void {
  fs.mkdirSync(storeDir(), { recursive: true });
}

/** Reads a JSON file from the runtime store, returning `fallback` if it doesn't exist yet. */
export function readJson<T>(fileName: string, fallback: T): T {
  ensureStoreDir();
  const filePath = path.join(storeDir(), fileName);
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  if (raw.trim().length === 0) {
    return fallback;
  }
  return JSON.parse(raw) as T;
}

/** Writes a JSON file atomically (write to a temp file, then rename) to avoid partial writes. */
export function writeJson<T>(fileName: string, data: T): void {
  ensureStoreDir();
  const filePath = path.join(storeDir(), fileName);
  const tmpPath = path.join(
    storeDir(),
    `.${fileName}.${process.pid}.${Date.now()}.tmp`,
  );
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmpPath, filePath);
}

/** Cross-process single-writer guard for this local fixture store. Never expires automatically:
 * after a crash, an operator must verify the process stopped before removing the directory.
 * This is not a distributed lock or a database transaction. */
export function acquireStoreLock(): (() => void) | null {
  ensureStoreDir();
  const lock = path.join(storeDir(), ".writer-lock");
  try {
    fs.mkdirSync(lock);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return null;
    throw error;
  }
  return () => fs.rmdirSync(lock);
}
