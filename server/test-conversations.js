import http from 'http';

const BASE_URL = 'http://127.0.0.1:5000';

const request = (method, path, body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

const register = async (name, email, password) => {
  const res = await request('POST', '/api/v1/auth/register', { name, email, password });
  // if already exists, login instead
  if (res.status === 409) {
    const loginRes = await request('POST', '/api/v1/auth/login', { email, password });
    return loginRes.data.data.token;
  }
  const loginRes = await request('POST', '/api/v1/auth/login', { email, password });
  return loginRes.data.data.token;
};

const getMe = async (token) => {
  const res = await request('GET', '/api/v1/auth/me', null, { Authorization: `Bearer ${token}` });
  return res.data.data.user._id;
};

const run = async () => {
  console.log('--- CONVERSATION TESTS START ---');
  const tokenA = await register('User A', 'a@test.com', 'password123');
  const tokenB = await register('User B', 'b@test.com', 'password123');
  const tokenC = await register('User C', 'c@test.com', 'password123');
  const idA = await getMe(tokenA);
  const idB = await getMe(tokenB);
  const idC = await getMe(tokenC);

  // 1. Create conversation A -> B (should be 201)
  let res = await request('POST', '/api/v1/conversations', { participantId: idB }, { Authorization: `Bearer ${tokenA}` });
  console.log('Create A->B:', res.status === 201 ? 'PASS' : 'FAIL', res.status);
  const convId = res.data.data.conversation._id;

  // 2. Duplicate create A->B (should be 200, same ID)
  res = await request('POST', '/api/v1/conversations', { participantId: idB }, { Authorization: `Bearer ${tokenA}` });
  console.log('Duplicate A->B:', res.status === 200 && res.data.data.conversation._id === convId ? 'PASS' : 'FAIL', res.status);

  // 3. Create B->A (should be 200, same ID)
  res = await request('POST', '/api/v1/conversations', { participantId: idA }, { Authorization: `Bearer ${tokenB}` });
  console.log('Create B->A:', res.status === 200 && res.data.data.conversation._id === convId ? 'PASS' : 'FAIL', res.status);

  // 4. GET my conversations for A (should include convId)
  res = await request('GET', '/api/v1/conversations', null, { Authorization: `Bearer ${tokenA}` });
  const foundA = res.data.data.conversations.some((c) => c._id === convId);
  console.log('GET A conversations:', foundA ? 'PASS' : 'FAIL', res.status);

  // 5. GET my conversations for B (should include convId)
  res = await request('GET', '/api/v1/conversations', null, { Authorization: `Bearer ${tokenB}` });
  const foundB = res.data.data.conversations.some((c) => c._id === convId);
  console.log('GET B conversations:', foundB ? 'PASS' : 'FAIL', res.status);

  // 6. C attempts to access conversation -> 403
  res = await request('GET', `/api/v1/conversations/${convId}`, null, { Authorization: `Bearer ${tokenC}` });
  console.log('C GET conversation (403):', res.status === 403 ? 'PASS' : 'FAIL', res.status);

  // 7. Self conversation attempt -> 400
  res = await request('POST', '/api/v1/conversations', { participantId: idA }, { Authorization: `Bearer ${tokenA}` });
  console.log('Self conversation (400):', res.status === 400 ? 'PASS' : 'FAIL', res.status);

  // 8. Invalid participantId format -> 400
  res = await request('POST', '/api/v1/conversations', { participantId: 'invalid-id' }, { Authorization: `Bearer ${tokenA}` });
  console.log('Invalid participantId (400):', res.status === 400 ? 'PASS' : 'FAIL', res.status);

  // 9. Nonexistent participantId -> 404
  const fakeId = '507f1f77bcf86cd799439011'; // valid ObjectId not in DB
  res = await request('POST', '/api/v1/conversations', { participantId: fakeId }, { Authorization: `Bearer ${tokenA}` });
  console.log('Nonexistent participant (404):', res.status === 404 ? 'PASS' : 'FAIL', res.status);

  // 10. Missing JWT -> 401
  res = await request('GET', '/api/v1/conversations');
  console.log('Missing JWT (401):', res.status === 401 ? 'PASS' : 'FAIL', res.status);

  // 11. Invalid JWT -> 401
  res = await request('GET', '/api/v1/conversations', null, { Authorization: 'Bearer invalidtoken' });
  console.log('Invalid JWT (401):', res.status === 401 ? 'PASS' : 'FAIL', res.status);

  // 12. Ensure no password in participant data
  res = await request('GET', `/api/v1/conversations/${convId}`, null, { Authorization: `Bearer ${tokenA}` });
  const participants = res.data.data.conversation.participants;
  const hasPassword = participants.some(p => p.password);
  console.log('No password exposed:', !hasPassword ? 'PASS' : 'FAIL');

  console.log('--- CONVERSATION TESTS END ---');
  process.exit(0);
};

run().catch(console.error);
