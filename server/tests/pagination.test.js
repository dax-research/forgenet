import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:5000';

const getJson = async (path) => {
  const response = await fetch(`${BASE_URL}${path}`);
  const text = await response.text();
  assert.ok(response.ok, `Request failed for ${path}: ${text}`);
  return JSON.parse(text);
};

test('GET /api/v1/users supports pagination metadata', async () => {
  const payload = await getJson('/api/v1/users?limit=2&skip=0');

  assert.equal(payload.success, true);
  assert.ok(Array.isArray(payload.data.users));
  assert.equal(typeof payload.data.total, 'number');
  assert.equal(payload.data.limit, 2);
  assert.equal(payload.data.skip, 0);
});

test('GET /api/v1/posts supports pagination metadata', async () => {
  const payload = await getJson('/api/v1/posts?limit=2&skip=0');

  assert.equal(payload.success, true);
  assert.ok(Array.isArray(payload.data.posts));
  assert.equal(typeof payload.data.total, 'number');
  assert.equal(payload.data.limit, 2);
  assert.equal(payload.data.skip, 0);
});

test('GET /api/v1/communities supports pagination metadata', async () => {
  const payload = await getJson('/api/v1/communities?limit=2&skip=0');

  assert.equal(payload.success, true);
  assert.ok(Array.isArray(payload.data.communities));
  assert.equal(typeof payload.data.total, 'number');
  assert.equal(payload.data.limit, 2);
  assert.equal(payload.data.skip, 0);
});
