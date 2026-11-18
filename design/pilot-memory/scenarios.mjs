import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MemoryDesignModel, saveRequest } from './model.mjs';

const scope = { workspaceId: 'owner-workspace', businessId: 'example-cafe', datasetId: 'synthetic', caseId: 'same-id' };
const other = { ...scope, businessId: 'case-study-business', datasetId: 'masked' };
const domain = s => JSON.stringify([s.workspaceId, s.businessId, s.datasetId]);
const session = { subject: 'owner-1', role: 'owner', domains: [domain(scope), domain(other)], expiresAt: 5000 };
function setup() {
  return new MemoryDesignModel({ sessions: { phone: session, desktop: session,
    outsider: { ...session, subject: 'owner-2', domains: [] }, model: { ...session, role: 'model' } },
    cases: [scope, other].map(s => ({ scope: s, text: 'Original owner-supplied draft', sourceVersion: 'source-1', policyVersion: 'policy-1' })),
    facts: [{ id: 'contact', version: 'f1', scope, status: 'approved', validFrom: 0, expiresAt: 4000 }] });
}

test('PM-01: phone save is loaded exactly on desktop, original remains', () => {
  const m = setup(); m.save('phone', saveRequest(m, 'phone', scope, 'My specific wording.'));
  assert.equal(m.load('desktop', scope).text, 'My specific wording.');
  assert.equal(m.load('desktop', scope).original, 'Original owner-supplied draft');
});
test('PM-02: competing phone/desktop edits cannot silently overwrite', () => {
  const m = setup(), phone = saveRequest(m, 'phone', scope, 'Phone edit'), desktop = saveRequest(m, 'desktop', scope, 'Desktop edit');
  m.save('phone', phone);
  assert.throws(() => m.save('desktop', desktop), /version_conflict/);
  assert.equal(m.load('desktop', scope).text, 'Phone edit');
  assert.equal(desktop.text, 'Desktop edit');
  assert.equal(m.snapshot().events.length, 1);
});
test('PM-03: failure before commit leaves all state unchanged and request intact', () => {
  const m = setup(), r = saveRequest(m, 'phone', scope, 'Retained client edit'), before = m.snapshot();
  assert.throws(() => m.save('phone', r, 'before_commit'), /commit_failed/);
  assert.deepEqual(m.snapshot(), before); assert.equal(r.text, 'Retained client edit');
});
test('PM-03/04: lost acknowledgement retries the same request once without duplicate event', () => {
  const m = setup(), r = saveRequest(m, 'phone', scope, 'Saved despite lost response');
  assert.throws(() => m.save('phone', r, 'after_commit'), /outcome_unknown/);
  const replay = m.save('phone', r);
  assert.equal(replay.replayed, true); assert.equal(replay.outcome, 'saved');
  assert.equal(m.snapshot().events.length, 1); assert.equal(m.load('desktop', scope).revision, 1);
});
test('PM-04: same request key with different text is rejected', () => {
  const m = setup(), r = saveRequest(m, 'phone', scope, 'First'); m.save('phone', r);
  assert.throws(() => m.save('phone', { ...r, text: 'Different' }), /idempotency_key_reused/);
  assert.equal(m.load('phone', scope).text, 'First');
});
test('PM-03: replay of an earlier receipt identifies the newer head', () => {
  const m = setup(), first = saveRequest(m, 'phone', scope, 'First'); m.save('phone', first);
  const latest = m.save('desktop', saveRequest(m, 'desktop', scope, 'Newer'));
  const replay = m.save('phone', first);
  assert.notEqual(replay.committedVersion, replay.currentVersion);
  assert.equal(replay.currentVersion, latest.committedVersion);
  assert.equal(m.load('phone', scope).text, 'Newer');
});
test('PM-05: authorised owner cannot access a different workspace', () => {
  const m = setup();
  assert.throws(() => m.load('phone', { ...scope, workspaceId: 'another' }), /not_found/);
  assert.throws(() => m.load('outsider', scope), /not_found/);
});
test('PM-05: identical case IDs in the two datasets stay separate', () => {
  const m = setup(); m.save('phone', saveRequest(m, 'phone', scope, 'Only synthetic'));
  assert.equal(m.load('phone', other).text, 'Original owner-supplied draft');
  assert.equal(m.load('phone', other).revision, 0);
});
test('PM-05: revoked session cannot read or replay a committed save', () => {
  const m = setup(), r = saveRequest(m, 'phone', scope, 'Private'); m.save('phone', r);
  m.state.sessions.phone.revoked = true;
  assert.throws(() => m.load('phone', scope), /unauthenticated/);
  assert.throws(() => m.save('phone', r), /unauthenticated/);
  assert.equal(m.load('desktop', scope).text, 'Private');
});
test('PM-05: expired session preserves unsent input without a write', () => {
  const m = setup(), r = saveRequest(m, 'phone', scope, 'Unsent'); m.now = 5000;
  assert.throws(() => m.save('phone', r), /unauthenticated/);
  assert.equal(r.text, 'Unsent'); assert.equal(m.snapshot().events.length, 0);
});
test('PM-06: facts must be approved, applicable and within their valid dates', () => {
  const m = setup();
  for (const [id, extra] of [['withdrawn', { status: 'withdrawn' }], ['future', { validFrom: 2000 }],
    ['expired', { expiresAt: 1000 }], ['other', { scope: other }], ['unapproved', { status: 'candidate' }]])
    m.state.facts.push({ ...m.state.facts[0], id, ...extra });
  assert.deepEqual(m.applicableFacts(scope).map(f => f.id), ['contact']);
});
test('PM-07: editing invalidates current approval but preserves its historical record', () => {
  const m = setup(); m.seedHistoricalApproval('phone', scope);
  assert.equal(m.load('desktop', scope).approvalCurrent, true);
  const before = Object.values(m.snapshot().cases)[0].approval;
  m.save('desktop', saveRequest(m, 'desktop', scope, 'Changed draft'));
  assert.equal(m.load('phone', scope).approvalCurrent, false);
  assert.deepEqual(Object.values(m.snapshot().cases)[0].approval, before);
});
test('PM-07: source or policy change blocks saving under obsolete context', () => {
  for (const field of ['sourceVersion', 'policyVersion']) {
    const m = setup(), r = saveRequest(m, 'phone', scope, 'Based on old evidence');
    m.seedHistoricalApproval('phone', scope); Object.values(m.state.cases)[0][field] = 'changed';
    assert.throws(() => m.save('phone', r), /context_changed/);
    assert.equal(m.load('phone', scope).approvalCurrent, false);
  }
});
test('PM-07: fact expiry invalidates approval without a new draft or fact write', () => {
  const m = setup(); m.seedHistoricalApproval('phone', scope); m.now = 4000;
  assert.equal(m.load('phone', scope).approvalCurrent, false);
});
test('PM-08: owner interpretation correction changes neither policy nor approved facts', () => {
  const m = setup(), before = m.snapshot();
  m.recordCorrection('phone', scope, { phrase: 'dope', interpretation: 'Food praise in this case', uncertainty: 'Case-specific' });
  assert.deepEqual(m.snapshot().cases, before.cases); assert.deepEqual(m.snapshot().facts, before.facts);
  assert.equal(m.snapshot().corrections[0].status, 'candidate');
});
test('PM-10: save cannot accept a caller-supplied actor or approval authority', () => {
  const m = setup(), r = saveRequest(m, 'phone', scope, 'Draft');
  for (const field of ['actor', 'approved', 'externalAction'])
    assert.throws(() => m.save('phone', { ...r, [field]: 'forged' }), /invalid_request/);
  assert.equal(m.snapshot().events.length, 0);
});
test('PM-10: a model principal cannot save; owner draft saving never publishes or approves', () => {
  const m = setup(), r = saveRequest(m, 'phone', scope, 'We will refund you tomorrow.');
  assert.throws(() => m.save('model', r), /not_found/);
  assert.equal(m.save('phone', r).externalAction, 'none');
  assert.equal(m.load('phone', scope).approvalCurrent, false);
  assert.deepEqual(m.snapshot().events.map(e => e.kind), ['draft_saved']);
  // Saving unfinished wording is separate from validating a public reply.
});
test('Recovery: a restore changes epoch and rejects old requests and approvals', () => {
  const m = setup(); m.seedHistoricalApproval('phone', scope);
  const old = saveRequest(m, 'phone', scope, 'Old browser work'); m.simulateRestore();
  assert.throws(() => m.save('phone', old), /restore_epoch_changed/);
  assert.equal(m.load('phone', scope).approvalCurrent, false);
  assert.equal(old.text, 'Old browser work');
});
