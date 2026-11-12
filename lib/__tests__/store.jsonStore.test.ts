import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readJson, writeJson } from "@/lib/store/jsonStore";

const TEST_FILE = "roundtrip.json";
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ccr-store-"));
  process.env.CCR_STORE_DIR = tmpDir;
});

afterEach(() => {
  delete process.env.CCR_STORE_DIR;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("jsonStore", () => {
  it("returns the fallback when the file does not exist yet", () => {
    expect(readJson(TEST_FILE, { hello: "fallback" })).toEqual({ hello: "fallback" });
  });

  it("round-trips written data", () => {
    const data = { a: 1, b: ["x", "y"], c: { nested: true } };
    writeJson(TEST_FILE, data);
    expect(readJson(TEST_FILE, null)).toEqual(data);
  });

  it("overwrites cleanly on a second write, leaving no temp files behind", () => {
    writeJson(TEST_FILE, { version: 1 });
    writeJson(TEST_FILE, { version: 2 });
    expect(readJson(TEST_FILE, null)).toEqual({ version: 2 });
    expect(fs.readdirSync(tmpDir).filter((name) => name.endsWith(".tmp"))).toHaveLength(0);
  });

  it("treats an empty file as absent rather than throwing", () => {
    fs.writeFileSync(path.join(tmpDir, TEST_FILE), "   ");
    expect(readJson(TEST_FILE, { fallback: true })).toEqual({ fallback: true });
  });

  it("writes into CCR_STORE_DIR, never the project store", () => {
    writeJson(TEST_FILE, { isolated: true });
    expect(fs.existsSync(path.join(tmpDir, TEST_FILE))).toBe(true);
  });
});
