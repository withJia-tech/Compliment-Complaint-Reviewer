import fs from "node:fs";
import path from "node:path";

const STORE_DIR = path.join(process.cwd(), "data", "store");

function ensureStoreDir(): void {
  fs.mkdirSync(STORE_DIR, { recursive: true });
}

/** Reads a JSON file from the runtime store, returning `fallback` if it doesn't exist yet. */
export function readJson<T>(fileName: string, fallback: T): T {
  ensureStoreDir();
  const filePath = path.join(STORE_DIR, fileName);
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
  const filePath = path.join(STORE_DIR, fileName);
  const tmpPath = path.join(STORE_DIR, `.${fileName}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmpPath, filePath);
}
