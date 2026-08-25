import { readJson, writeJson } from "@/lib/store/jsonStore";
import type { AuditRecord } from "@/lib/types";

const FILE = "audit.json";

export const auditRepo = {
  list(): AuditRecord[] {
    return readJson<AuditRecord[]>(FILE, []);
  },
  listByReviewId(reviewId: string): AuditRecord[] {
    return auditRepo.list().filter((record) => record.reviewId === reviewId);
  },
  append(record: AuditRecord): void {
    const records = auditRepo.list();
    records.push(record);
    writeJson(FILE, records);
  },
};
