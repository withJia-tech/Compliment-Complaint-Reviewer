import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readJson, writeJson } from "@/lib/store/jsonStore";

const TEST_FILE = "vitest-roundtrip.json";
const TEST_FILE_PATH = path.join(process.cwd(), "data", "store", TEST_FILE);

afterEach(() => {
  if (fs.existsSync(TEST_FILE_PATH)) {
    fs.unlinkSync(TEST_FILE_PATH);
  }
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

  it("overwrites cleanly on a second write (no leftover temp files)", () => {
    writeJson(TEST_FILE, { version: 1 });
    writeJson(TEST_FILE, { version: 2 });
    expect(readJson(TEST_FILE, null)).toEqual({ version: 2 });

    const leftoverTmp = fs
      .readdirSync(path.join(process.cwd(), "data", "store"))
      .filter((name) => name.includes(TEST_FILE) && name.endsWith(".tmp"));
    expect(leftoverTmp).toHaveLength(0);
  });
});
