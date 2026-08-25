import { EmailApprovalChannel } from "@/lib/approval/emailApprovalChannel";
import { TemplateReplyDrafter } from "@/lib/drafter/replyDrafter";
import { FixtureReviewProvider } from "@/lib/providers/fixtureReviewProvider";
import type { DailyScanDeps } from "@/lib/scan/runDailyScan";
import { DefaultTriagePolicy } from "@/lib/triage/policy";
import type { ApprovedBusinessFacts } from "@/lib/types";
import businessFacts from "@/data/fixtures/businessFacts.json";

/** The one fixture/stub wiring used by the CLI script, the API route, and the queue's "run scan now" action. */
export function buildDefaultScanDeps(): DailyScanDeps {
  return {
    provider: new FixtureReviewProvider(),
    policy: new DefaultTriagePolicy(),
    drafter: new TemplateReplyDrafter(),
    approvalChannel: new EmailApprovalChannel(),
    facts: businessFacts as ApprovedBusinessFacts,
  };
}
