import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:5000';

const postJson = async (path, payload) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  return { status: response.status, body: JSON.parse(text) };
};

const getJson = async (path) => {
  const response = await fetch(`${BASE_URL}${path}`);
  const text = await response.text();
  return { status: response.status, body: JSON.parse(text) };
};

test('GET /api/v1/users rejects invalid pagination values', async () => {
  const result = await getJson('/api/v1/users?limit=abc&skip=-1');

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
  assert.match(result.body.message, /limit|skip/i);
});

test('POST /api/v1/users rejects weak signup data', async () => {
  const result = await postJson('/api/v1/users', {
    name: 'A',
    email: 'not-an-email',
    password: 'short',
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
  assert.match(result.body.message, /valid|password|email/i);
});
