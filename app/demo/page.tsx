import Link from "next/link";
import { AppHeader } from "@/app/components/AppHeader";
import { loadHeaderData, loadQueueRows } from "@/lib/queueData";

export const dynamic = "force-dynamic";

export default function DemoPage() {
  const rows = loadQueueRows();
  return (
    <>
      <AppHeader {...loadHeaderData(rows)} currentPath="/demo" />
      <main>
        <div className="page-head">
          <p className="page-sub">A fictional business · Maple &amp; Vine Cafe</p>
          <h1>A considered reply. A clear next step.</h1>
          <p>See what needs your attention, check the facts and approve the words your guest will read.</p>
        </div>
        <section className="demo-notice" aria-label="Demo boundary">
          <strong>Sample reviews. Simulated sends.</strong>
          <p>This demonstration uses rules and templates. It is not connected to Google.
            Every reply needs your confirmation; no message leaves this application.</p>
        </section>
        {rows.length === 0 && <p>Run a scan to load the sample reviews before starting.</p>}
        <div className="demo-steps">
          <section className="demo-step">
            <span className="page-sub">01 · Prioritise</span>
            <h2>Notice what needs care</h2>
            <p>Grace reports an injury. Read it as a guest account requiring investigation,
              not a verified finding or a judgment about an employee.</p>
            <Link href="/review/rev_007">Inspect the safety concern →</Link>
          </section>
          <section className="demo-step">
            <span className="page-sub">02 · Review and approve</span>
            <h2>Keep the owner in control</h2>
            <p>Open Priya’s positive review. Check the proposed reply, edit it if needed,
              confirm your review and simulate sending. Inspect the audit trail afterwards.</p>
            <Link href="/review/rev_001">Review a positive experience →</Link>
          </section>
          <section className="demo-step">
            <span className="page-sub">03 · Check a safeguard</span>
            <h2>Promises need authority</h2>
            <p>On Elena’s review, try “We will refund you $50.” Confirm and attempt the
              simulated send. The application should refuse the promise. Restore a supported
              reply and confirm again before sending.</p>
            <Link href="/review/rev_003">Try the unsupported-promise check →</Link>
          </section>
        </div>
        <section className="demo-notice">
          <h2>One business, one daily review desk</h2>
          <p>The live pilot will need authenticated owner access, an authorised review source,
            reliable delivery reconciliation and operational support. These are release requirements,
            not capabilities demonstrated by this sample session.</p>
          <Link href="/queue">Open the full review queue →</Link>
        </section>
      </main>
    </>
  );
}
