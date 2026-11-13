# Client demo — Maple & Vine Cafe

## Run locally

With Node >=22.13.0 and dependencies installed (`npm ci`):

```sh
npm run demo
```

Open http://127.0.0.1:3000/demo. The launcher binds to loopback only and creates a new
synthetic session under `data/demo-sessions/`. Stop with Ctrl-C and run again for a fresh
11-review queue. Existing `data/store` content and earlier demo sessions are not reset or deleted.
Port 3000 must be free. If occupied, stop the conflicting server first.
`npm run demo:prepare` seeds without starting a server. It prints the session directory;
ordinary `npm run dev` does not automatically use that directory.

The demo has no authentication and must not be exposed publicly. No live credentials are needed.
All names, reviews and business facts are synthetic. The guide is an addition to the existing app,
not a separate mock UI; it uses the same send validation and approval path.

## Five-minute presenter script

- **0:00–0:45:** “This is a fictional cafe. Nothing here sends to Google. The owner reviews every reply.”
  Show the demo guide, then the queue: sensitive concerns are prioritised.
- **0:45–2:00:** Open Grace (`rev_007`). “This is an allegation to investigate, not proof of cause or
  staff misconduct.” Show the review, matched evidence and approved contact fact.
- **2:00–3:00:** Open Priya (`rev_001`). Read the draft, confirm the factual-review checkbox and
  simulate sending. Show the status and audit trail. Do not call the simulated receipt Google proof.
- **3:00–4:15:** Open Elena (`rev_003`). Replace the reply with `We will refund you $50.` Confirm
  and attempt to send. Show the rejection. Restore a supported response, reconfirm and send.
  Explain that bounded wording checks are safeguards, not a semantic truth detector.
- **4:15–5:00:** “For a live business, the remaining work is authenticated access, authorised source
  integration and tested delivery recovery. Feedback can improve future evaluations, but changes
  to production behaviour require validation and explicit promotion.”

For a repeat presentation, stop and relaunch. Previously approved examples cannot be sent again
in the same session. The demo guide deliberately does not bypass that control.

## Scope and verification

This slice adds fresh-session startup, a linked guide and explicit simulation wording in the shared
header. Existing regression tests cover stale inputs, unknown sends and reconciliation; those
failure states are not new interactive scenario controls in this slice.

Validation for this change: 133 existing tests passed; TypeScript checks passed; production build passed. The built guide, queue and three linked review pages returned HTTP 200. Two preparation runs produced separate queues
with 11 pending reviews each and left the working store byte-for-byte unchanged, even when an
inherited CCR_STORE_DIR pointed to it. Browser click-through and hosted delivery remain separate
checks; do not present this as a completed client acceptance test.

See SINGLE_BUSINESS_DELIVERY.md for live release requirements and CONTROLLED_LEARNING_PLAN.md
for the later shadow/feedback/promotion track.
