import { spawnSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, lstatSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Every launch gets fresh synthetic state. Never delete/reset the normal store.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const parent = path.join(root, "data", "demo-sessions");
mkdirSync(parent, { recursive: true });
if (lstatSync(parent).isSymbolicLink()) throw new Error("Demo directory must not be a symlink.");
const store = mkdtempSync(path.join(parent, "session-"));
const commit = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" });
const env = { ...process.env, CCR_STORE_DIR: store, CCR_DEMO_MODE: "1" };
writeFileSync(path.join(store, "demo-session.json"), JSON.stringify({
  synthetic: true, baseCommit: commit.stdout?.trim() || "unknown", createdAt: new Date().toISOString(),
}, null, 2));
const seed = spawnSync(process.execPath, ["--import", "tsx", "scripts/dailyScan.ts"], {
  cwd: root, env, stdio: "inherit",
});
if (seed.status !== 0) process.exit(seed.status ?? 1);
console.log("\nSynthetic demo ready. Open http://127.0.0.1:3000/demo");
console.log("All sends are simulated. Stop and rerun npm run demo for a fresh queue.");
console.log(`Session state: ${store}`);
if (process.argv.includes("--prepare-only")) process.exit(0);
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3000"], {
  cwd: root, env, stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("error", error => { console.error(error.message); process.exitCode = 1; });
server.on("exit", code => { process.exitCode = code ?? 1; });
