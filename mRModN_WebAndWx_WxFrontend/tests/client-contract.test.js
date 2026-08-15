const test = require('node:test');
const assert = require('node:assert/strict');

const storage = new Map();
let responses = [];
let requests = [];

global.wx = {
  getStorageSync(key) { return storage.get(key); },
  setStorageSync(key, value) { storage.set(key, value); },
  removeStorageSync(key) { storage.delete(key); },
  request(options) {
    requests.push(options);
    const response = responses.shift();
    queueMicrotask(() => {
      if (response.fail) options.fail(response.fail);
      else options.success(response);
    });
    return { abort() { options.fail({ errMsg: 'request:fail abort' }); } };
  },
};

const api = require('../utils/config/api');
const { requestWithFallback, resetServer } = require('../utils/request');
const { validateSequence } = require('../utils/sequence');
const { normalizeGraph } = require('../utils/graph');

function reset(responsesForTest) {
  storage.clear();
  resetServer();
  responses = responsesForTest.slice();
  requests = [];
}

test('sample sequence endpoint is provided by the backend API', () => {
  assert.equal(api.ENDPOINTS.SAMPLE_SEQUENCE, '/sample-sequence');
  assert.equal(
    api.buildApiUrl(api.ENDPOINTS.SAMPLE_SEQUENCE),
    'http://100.74.161.109:9005/api/v1/sample-sequence',
  );
});


test('technical Web addresses use rgcnformer while the product brand remains mRModN', () => {
  assert.equal(
    api.getWebBaseUrl(),
    'http://100.74.161.109:9006/rgcnformer',
  );
  assert.equal(
    api.buildWebUrl('/embed/results/job-1?tab=gcn&source=wx'),
    'http://100.74.161.109:9006/rgcnformer/embed/results/job-1?tab=gcn&source=wx',
  );
});

test('business errors do not switch to the backup API origin', async () => {
  reset([{ statusCode: 400, data: { code: 'INVALID_SEQUENCE', message: 'bad sequence' } }]);
  await assert.rejects(
    requestWithFallback('/submit-task', { method: 'POST' }),
    (error) => error.statusCode === 400 && error.retryable === false && error.code === 'INVALID_SEQUENCE',
  );
  assert.equal(requests.length, 1);
});

test('gateway failures retry on a configured backup origin and preserve auth', async () => {
  const temporaryBackup = 'https://backup.test';
  api.API_SERVERS.push(temporaryBackup);
  try {
    reset([
      { statusCode: 503, data: { message: 'unavailable' } },
      { statusCode: 200, data: { ok: true } },
    ]);
    storage.set('sessionToken', 'signed-token');
    const result = await requestWithFallback('/results/job-1', { method: 'GET' });
    assert.equal(requests.length, 2);
    assert.match(requests[0].url, /^http:\/\/100\.74\.161\.109:9005\/api\/v1/);
    assert.match(requests[1].url, /^https:\/\/backup\.test\/api\/v1/);
    assert.equal(requests[1].header.Authorization, 'Bearer signed-token');
    assert.equal(result.serverIndex, 1);
  } finally {
    api.API_SERVERS.pop();
    resetServer();
  }
});

test('sequence validation enforces the 51..1001 nt product boundary', () => {
  assert.equal(validateSequence('A'.repeat(50)).valid, false);
  assert.equal(validateSequence('A'.repeat(51)).valid, true);
  assert.equal(validateSequence('ACGUTN'.repeat(166) + 'ACGUT').valid, true);
  assert.equal(validateSequence('A'.repeat(1002)).valid, false);
});

test('graph normalization deduplicates reverse edges and infers edge types', () => {
  const graph = normalizeGraph({
    nodes: [
      { id: 'A0', index: 0, base: 'A' },
      { id: 'C1', index: 1, base: 'C' },
      { id: 'U2', index: 2, base: 'U' },
    ],
    edges: [
      { source: 'A0', target: 'C1' },
      { source: 'C1', target: 'A0' },
      { source: 'A0', target: 'U2' },
    ],
  }, 'ACU');
  assert.deepEqual(graph.edges.map((edge) => edge.type), ['backbone', 'base_pair']);
});
