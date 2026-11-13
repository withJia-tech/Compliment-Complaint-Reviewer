# Risk classifier golden datasets

Versioned, immutable statements of what the risk classifier **should** decide.

- One file per version: `risk_classifier_v<N>.jsonl`, one fixture per line.
- `MANIFEST.json` pins each file's sha256, fixture count and status (`draft` or `approved`).
  `lib/__tests__/golden.riskClassifier.test.ts` fails if the file and checksum disagree.
- **Once a version is `approved` it is never edited.** A change means a new file, a new version
  and a new evaluation run. While a version is `draft`, edits must update the checksum.

## Fields

| Field | Asserted | Meaning |
|---|---|---|
| `fixture_id`, `version`, `family` | integrity | Unique id; dataset version; one of baseline, routine_complaint, sensitive, mixed_signal, pii, adversarial, multilingual, edge_case |
| `stars`, `review_text` | input | What the classifier sees. The policy routes on both. |
| `language`, `business_context`, `notes` | no | Context for the reader |
| `expected_primary_action` | yes | `quick_approve` or `needs_review`. Nothing is ever sent automatically, so there is no auto-publish or block action. |
| `expected_risk_level` | yes | `low`, `medium`, `high` |
| `expected_sensitive` | yes | The `sensitive` flag (this product has no escalation tier) |
| `expected_categories` | when sensitive | The classifier's leading sensitive category must be one of these. `pii` and `prompt_injection` are listed for coverage; the classifier has no reason code for them yet. |

Reply wording (constraints, evidence) is not part of this dataset: replies come from fixed
templates and are tested in `lib/drafter/`.
