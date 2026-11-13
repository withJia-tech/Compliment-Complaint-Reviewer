import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readJson, StoreIntegrityError, writeJson } from "@/lib/store/jsonStore";
import { approvalRepo } from "@/lib/store/approvalRepo";
import { auditRepo } from "@/lib/store/auditRepo";
import { reviewRepo } from "@/lib/store/reviewRepo";
import type { Check } from "@/lib/store/schema";

/** Round-trip tests are about the file mechanics, not shapes. */
const anyShape: Check = () => null;

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
    expect(readJson(TEST_FILE, { hello: "fallback" }, anyShape)).toEqual({ hello: "fallback" });
  });

  it("round-trips written data", () => {
    const data = { a: 1, b: ["x", "y"], c: { nested: true } };
    writeJson(TEST_FILE, data);
    expect(readJson(TEST_FILE, null, anyShape)).toEqual(data);
  });

  it("overwrites cleanly on a second write, leaving no temp files behind", () => {
    writeJson(TEST_FILE, { version: 1 });
    writeJson(TEST_FILE, { version: 2 });
    expect(readJson(TEST_FILE, null, anyShape)).toEqual({ version: 2 });
    expect(fs.readdirSync(tmpDir).filter((name) => name.endsWith(".tmp"))).toHaveLength(0);
  });

  it("treats an empty file as absent rather than throwing", () => {
    fs.writeFileSync(path.join(tmpDir, TEST_FILE), "   ");
    expect(readJson(TEST_FILE, { fallback: true }, anyShape)).toEqual({ fallback: true });
  });

  it("writes into CCR_STORE_DIR, never the project store", () => {
    writeJson(TEST_FILE, { isolated: true });
    expect(fs.existsSync(path.join(tmpDir, TEST_FILE))).toBe(true);
  });
});

describe("store integrity (reads fail closed)", () => {
  const write = (file: string, raw: string) => fs.writeFileSync(path.join(tmpDir, file), raw);

  it("refuses unparseable JSON with a named error instead of a raw SyntaxError", () => {
    write("reviews.json", "{ not json");
    expect(() => reviewRepo.list()).toThrow("reviews.json failed its integrity check (not valid JSON)");
  });

  it("refuses a record with a mistyped field and names the path", () => {
    write("reviews.json", JSON.stringify({ r1: { id: "r1", locationId: "loc_001", author: "A", stars: 7, text: "", createTime: "x", updateTime: "x" } }));
    expect(() => reviewRepo.getById("r1")).toThrow("$.r1.stars");
  });

  it("refuses an approval status the code does not know", () => {
    write("approvals.json", JSON.stringify({ r1: { reviewId: "r1", status: "auto_sent", actor: "x" } }));
    let error: unknown;
    try {
      approvalRepo.getByReviewId("r1");
    } catch (caught) {
      error = caught;
    }
    expect(error instanceof StoreIntegrityError).toBe(true);
  });

  it("refuses a map whose key disagrees with the record id", () => {
    write("reviews.json", JSON.stringify({ r1: { id: "r2", locationId: "l", author: "A", stars: 5, text: "", createTime: "x", updateTime: "x" } }));
    expect(() => reviewRepo.list()).toThrow("does not match its key");
  });

  it("does not let a failed read be overwritten by a later write", () => {
    write("audit.json", JSON.stringify([{ id: "broken" }]));
    expect(() => auditRepo.list()).toThrow("audit.json");
    // append reads first, so it fails closed and the evidence is left untouched.
    expect(() => auditRepo.append({} as never)).toThrow("audit.json");
    expect(fs.readFileSync(path.join(tmpDir, "audit.json"), "utf-8")).toBe(JSON.stringify([{ id: "broken" }]));
  });

  it("accepts extra keys, because the audit schema grows additively", () => {
    write("reviews.json", JSON.stringify({ r1: { id: "r1", locationId: "l", author: "A", stars: 5, text: "", createTime: "x", updateTime: "x", futureField: 1 } }));
    expect(reviewRepo.getById("r1")?.id).toBe("r1");
  });
});
