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
      res.on('data', (chunk) => { data += chunk; });
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
    if (res.status === 409) {
        // Try to login instead
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
    console.log('--- STARTING TESTS ---');
    
    const tokenA = await register("User A", "usera@test.com", "password123");
    const tokenB = await register("User B", "userb@test.com", "password123");
    
    const idA = await getMe(tokenA);
    const idB = await getMe(tokenB);

    // USER
    let res = await request('PUT', `/api/v1/users/${idA}`, { bio: "updated" }, { Authorization: `Bearer ${tokenA}` });
    console.log(`User A updates own profile -> expected 200, actual ${res.status} [${res.status === 200 ? 'PASS' : 'FAIL'}]`);

    res = await request('PUT', `/api/v1/users/${idB}`, { bio: "hacked" }, { Authorization: `Bearer ${tokenA}` });
    console.log(`User A attempts to update User B -> expected 403, actual ${res.status} [${res.status === 403 ? 'PASS' : 'FAIL'}]`);
    
    res = await request('POST', `/api/v1/users/${idB}/follow`, null, { Authorization: `Bearer ${tokenA}` });
    console.log(`User A follows User B -> expected 200, actual ${res.status} [${res.status === 200 ? 'PASS' : 'FAIL'}]`);
    
    res = await request('POST', `/api/v1/users/${idA}/follow`, null, { Authorization: `Bearer ${tokenA}` });
    console.log(`User A attempts to follow themselves -> expected 400, actual ${res.status} [${res.status === 400 ? 'PASS' : 'FAIL'}]`);

    // POSTS
    res = await request('POST', `/api/v1/posts`, { content: "hello world" }, { Authorization: `Bearer ${tokenA}` });
    console.log(`User A creates post -> expected 201, actual ${res.status} [${res.status === 201 ? 'PASS' : 'FAIL'}]`);
    const postId = res.data.data.post._id;

    res = await request('PUT', `/api/v1/posts/${postId}`, { content: "updated" }, { Authorization: `Bearer ${tokenA}` });
    console.log(`User A updates own post -> expected 200, actual ${res.status} [${res.status === 200 ? 'PASS' : 'FAIL'}]`);
    
    res = await request('PUT', `/api/v1/posts/${postId}`, { content: "hacked" }, { Authorization: `Bearer ${tokenB}` });
    console.log(`User B attempts to update User A's post -> expected 403, actual ${res.status} [${res.status === 403 ? 'PASS' : 'FAIL'}]`);
    
    res = await request('DELETE', `/api/v1/posts/${postId}`, null, { Authorization: `Bearer ${tokenB}` });
    console.log(`User B attempts to delete User A's post -> expected 403, actual ${res.status} [${res.status === 403 ? 'PASS' : 'FAIL'}]`);

    res = await request('POST', `/api/v1/posts`, { content: "hello world" });
    console.log(`Unauthenticated user attempts to create post -> expected 401, actual ${res.status} [${res.status === 401 ? 'PASS' : 'FAIL'}]`);

    // Delete post so it's clean
    await request('DELETE', `/api/v1/posts/${postId}`, null, { Authorization: `Bearer ${tokenA}` });

    console.log('--- ALL TESTS COMPLETE ---');
    process.exit(0);
};

run().catch(console.error);
