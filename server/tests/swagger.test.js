import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:5000';

test('GET /api/docs.json exposes OpenAPI schema', async () => {
  const response = await fetch(`${BASE_URL}/api/docs.json`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.openapi, '3.0.0');
  assert.ok(body.info);
  assert.ok(body.paths['/api/v1/auth/login']);
  assert.ok(body.paths['/api/v1/users']);
});
