# Dataset 2 — supplied real review examples

The default hosted demo now uses five customer reviews and five existing owner replies
from the ten screenshots supplied on 13 November 2026. All five cases name Tiong Bahru
Bakery; this is an independent demonstration, not an affiliated or authorised owner account.
Dataset 1 remains available through the dataset selector.

## Source and trust boundaries

`data/demo/dataset2.json` contains transcribed text, displayed ratings and age labels,
paired source filenames and SHA-256 hashes. Whitespace and line wrapping are normalised.
Screenshots, profile photographs, receipt details, reviewer history and Local Guide status
are not shipped with the demo. No reviews are fetched from Google in this change.

Customer accounts, existing owner replies and new demonstration drafts remain separate.
An owner reply is neither an approved business policy nor proof that an investigation,
remedy or operational fix happened. Its historical contact information is plain reference
text; it is not copied into the new drafts or turned into a live recovery link. The demo
has no approved facts or publishing authority for this business. New drafts are authored
examples, not output from a connected language model. Up to three internal discovery
checks retain disputed claims and missing evidence.

## Time window

| Case | Age visible in screenshot | Demo placement |
| --- | --- | --- |
| Da**** F** | a month ago | Active practice case |
| N** E** S*** (O***) | 2 months ago | Active practice case |
| ** * | a year ago | Historical, read only |
| Li** V** | Edited a year ago | Historical, read only |
| Dw**** L**** | 2 years ago | Historical, read only |

The screenshot capture date and exact original publication dates are unknown. Relative
age labels are preserved verbatim; no fabricated ISO creation times are assigned. The two
recent examples form a practice cohort based on the displayed ages, not a claim that they
are currently pending or within six months today. Existing replies are included for each.
Edited dates alone cannot establish recent original publication. The operational intake
continues to require the original date and enforce its existing rolling six-month cutoff.

## Classifier finding and controlled candidate

The production keyword classifier misses “broken glass” as a sensitive safety signal.
Dataset 2 retains the separate broken-glass safety trigger. Its current identity is
`demo-broken-glass-v1+policy-v1.0.1-owner-attention.1`, explicitly including the updated
base attention policy. The broken-glass rule itself is unchanged and has not been
promoted into the baseline policy. See [the attention change](OWNER_ATTENTION_CHANGE.md). The classifier
interface now accepts only id, stars and review text: absent dates need not be invented,
and owner replies, names, profile status and metadata are not classification evidence.

Targeted regression cases verify the safety phrase even at five stars, the missing-items
refund request, separation from owner-reply content, source/date provenance, historical
exclusion, dataset isolation and wording validation. This small demonstration set is not
a representative evaluation dataset or sufficient evidence to promote the candidate.
A production promotion still requires the frozen evaluation gates and explicit decision.

## Workflow

The default active queue contains cases 001 and 002, with the reported safety issue first.
Open the original owner reply to compare it with the demonstration draft. Review discovery
checks, then approve the draft or choose No response required. Either deliberate decision
moves the case into Completed for this browser session. Historical cases remain read only.
Switching datasets preserves independent session decisions; Start over resets both.

## Historical validation and delivery (unmasked v1)

152 tests pass, including seven Dataset 2 boundary and classification cases. TypeScript,
the comparison bundle and the Next.js production build pass. Browser checks covered the
original-owner-reply display, discovery confirmation, no-response closure, read-only
historical cases and independent decisions when switching datasets. The Vercel deployment
`dpl_GDqbnC2wNLxNGhumujTeGHEauG4i` was browser-verified with Dataset 2 selected by default.

Public GitHub publication initially paused for confirmation to include the supplied
customer names, review text and owner replies. The user confirmed that concrete disclosure
request by asking to resume. The same GitHub connector then accepted the update.
The Pages artifact is commit `c75f0c53ffdb51fcf07365a9cce700ad8ce2942e`; its deployment
completed successfully and the live page was browser-verified, including no-response
closure and automatic selection of the next case. The source changes are tracked in PR #5.

The earlier unmasked Dataset 2 screenshot is omitted from this branch. A new screenshot has not been captured; historical deployment evidence does not verify the masked dataset.

## Name masking — 18 November 2026

The user requested reviewer-name masking. `dataset2-v2-name-masked` is a derivative
of the existing five cases. Author labels, personal salutations in quoted replies,
personal references in proposed replies and the identity-mismatch discovery note
are masked or minimised. Case ids are now opaque `dataset2_case_001` through
`dataset2_case_005`. Their order still corresponds to the original five cases.

Review wording, star ratings, subratings, age labels, active/historical membership,
source-image hashes and routing expectations are unchanged. Hashes identify the
original supplied images, not the masked derivative text. The mismatched salutation
remains a mismatch; the masking does not establish that the names identify one person.

This is pseudonymisation, not guaranteed anonymity: verbatim review wording and the
business name can still identify a public source. Business contact information in
quoted historical replies is retained under the existing reference-only boundary.
Original uploads and git history are unchanged. Earlier unmasked demo screenshots
are omitted from this branch rather than presented as evidence for the new dataset.

No deployed host was changed. This branch does not remove names already present
on previously deployed versions. Deployment is a separate instruction. At the masking-only
checkpoint, routing and language interpretation/learning were unchanged. The subsequent
below-five-star rule is included in this draft; interpretation and learning remain unimplemented.

### Historical local verification of the masked derivative, before the attention change

Three new privacy tests failed against the original dataset, then passed after masking.
The focused dataset/privacy/desk suite passed 21 tests; the full PR-head suite passed
170 tests in 14 files. Typecheck, static comparison generation and the Next.js
production build passed. Thirty comparisons confirmed that all five cases retain
their review text, rating, subratings, dates, source-file references and business name.
A known-name/id scan found no residual reviewer identifiers in current tracked text
or the static bundle; two generic `foo*` matcher-comment hits were inspected and
excluded. This is a bounded known-identifier check, not a universal anonymity claim.
At that masking-only checkpoint, routing code, its four-star test and golden expectations were unchanged.
Browser/mobile rendering of this masked version has not been verified.

The subsequent owner-attention implementation is documented separately in [OWNER_ATTENTION_CHANGE.md](OWNER_ATTENTION_CHANGE.md). The earlier 170-test masking checkpoint above is not the result for that later code.
