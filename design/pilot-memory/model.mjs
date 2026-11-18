// Executable DESIGN MODEL only. No database, identity verification, HTTP or UI.
// Sessions and memberships are supplied synthetic fixtures, not trusted input handling.
import { createHash, randomUUID } from 'node:crypto';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const key = scope => JSON.stringify([scope.workspaceId, scope.businessId, scope.datasetId, scope.caseId]);
const domain = scope => JSON.stringify([scope.workspaceId, scope.businessId, scope.datasetId]);
const fail = code => { throw new Error(code); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export class MemoryDesignModel {
  constructor({ sessions, cases, facts = [], now = 1000 }) {
    this.now = now;
    this.state = { epoch: randomUUID(),
      sessions: Object.fromEntries(Object.entries(sessions).map(([id, s]) => [id, structuredClone(s)])),
      facts: structuredClone(facts),
      cases: Object.fromEntries(cases.map(c => [key(c.scope), { ...structuredClone(c), version: randomUUID(), revision: 0,
        original: c.text, history: [], approval: null }])), receipts: {}, events: [], corrections: [] };
  }
  snapshot() { return structuredClone(this.state); }
  authorise(sessionId, scope) {
    const session = this.state.sessions[sessionId];
    if (!session || session.revoked || session.expiresAt <= this.now) fail('unauthenticated');
    if (session.role !== 'owner' || !session.domains.includes(domain(scope))) fail('not_found');
    const item = this.state.cases[key(scope)];
    if (!item) fail('not_found');
    return { session, item };
  }
  applicableFacts(scope) {
    return this.state.facts.filter(f => domain(f.scope) === domain(scope) && f.status === 'approved' &&
      f.validFrom <= this.now && (f.expiresAt === null || f.expiresAt > this.now));
  }
  context(scope) {
    const item = this.state.cases[key(scope)];
    return digest([item.sourceVersion, item.policyVersion,
      this.applicableFacts(scope).map(f => [f.id, f.version]).sort((a, b) => a[0].localeCompare(b[0]))]);
  }
  load(sessionId, scope) {
    const { item } = this.authorise(sessionId, scope);
    return structuredClone({ epoch: this.state.epoch, version: item.version, revision: item.revision,
      text: item.text, original: item.original, contextVersion: this.context(scope),
      approvalCurrent: !!item.approval && item.approval.epoch === this.state.epoch &&
        item.approval.version === item.version && item.approval.contextVersion === this.context(scope) });
  }
  save(sessionId, request, fault) {
    // In production these checks belong to a strict HTTP schema and a transaction.
    if (!same(Object.keys(request).sort(), ['contextVersion', 'epoch', 'expectedVersion', 'requestId', 'scope', 'text'].sort())) fail('invalid_request');
    if (typeof request.text !== 'string' || request.text.length > 4000 || typeof request.requestId !== 'string' || !request.requestId) fail('invalid_request');
    const { session, item } = this.authorise(sessionId, request.scope);
    if (request.epoch !== this.state.epoch) fail('restore_epoch_changed');
    const receiptKey = JSON.stringify([session.subject, domain(request.scope), request.requestId]);
    const requestHash = digest([key(request.scope), request.epoch, request.expectedVersion, request.contextVersion, request.text]);
    const old = this.state.receipts[receiptKey];
    if (old) {
      if (old.requestHash !== requestHash) fail('idempotency_key_reused');
      return { ...structuredClone(old.receipt), replayed: true, currentVersion: item.version };
    }
    if (item.version !== request.expectedVersion) fail('version_conflict');
    if (this.context(request.scope) !== request.contextVersion) fail('context_changed');
    const next = structuredClone(this.state);
    const head = next.cases[key(request.scope)];
    head.version = randomUUID(); head.revision++; head.text = request.text;
    head.history.push({ version: head.version, revision: head.revision, text: head.text, actor: session.subject });
    const event = { kind: 'draft_saved', actor: session.subject, scope: request.scope, version: head.version };
    next.events.push(event);
    const receipt = { epoch: next.epoch, committedVersion: head.version, revision: head.revision,
      externalAction: 'none', outcome: 'saved' };
    next.receipts[receiptKey] = { requestHash, receipt };
    if (fault === 'before_commit') fail('commit_failed');
    this.state = next; // Atomic in-memory replacement is NOT evidence of database atomicity.
    if (fault === 'after_commit') fail('outcome_unknown');
    return { ...receipt, replayed: false, currentVersion: head.version };
  }
  recordCorrection(sessionId, scope, candidate) {
    const { session } = this.authorise(sessionId, scope);
    this.state.corrections.push({ scope: structuredClone(scope), proposal: structuredClone(candidate),
      status: 'candidate', actor: session.subject });
  }
  // The following operations simulate external changes, not production endpoints.
  seedHistoricalApproval(sessionId, scope) {
    const { item } = this.authorise(sessionId, scope);
    item.approval = { epoch: this.state.epoch, version: item.version, contextVersion: this.context(scope) };
  }
  simulateRestore() { this.state.epoch = randomUUID(); }
}

export function saveRequest(model, sessionId, scope, text, requestId = randomUUID()) {
  const head = model.load(sessionId, scope);
  return { scope, requestId, epoch: head.epoch, expectedVersion: head.version, contextVersion: head.contextVersion, text };
}
