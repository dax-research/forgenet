/**
 * Bodyless requests must not crash a handler.
 *
 * Express 5 leaves req.body undefined when a request carries no body, so any
 * `req.body.x` throws TypeError and surfaces as a 500. These are the exact
 * shapes the React client sends.
 */
const BASE = process.env.API_BASE || "http://localhost:5065/api/v1";
const RAW = process.env.API_RAW || "http://localhost:5065";

let passed = 0, failed = 0;
const check = (l, c, e = "") => { if (c) { passed++; console.log(`  PASS  ${l}`); } else { failed++; console.log(`  FAIL  ${l} ${e}`); } };

// Sends a request with NO body at all (no Content-Type, no payload).
const noBody = async (path, method = "POST", token) => {
  const res = await fetch(`${RAW}${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
};

const api = async (path, { method = "GET", token, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
};

const sfx = Date.now();
const pw = "TestPass123!";
const mkuser = async (name) => {
  const email = `${name.toLowerCase()}.${sfx}@t.dev`;
  await api("/auth/register", { method: "POST", body: { name, email, password: pw } });
  const r = await api("/auth/login", { method: "POST", body: { email, password: pw } });
  return { name, token: r.data.data.token, id: r.data.data.user._id };
};

const owner = await mkuser("BodyOwner");
const joiner = await mkuser("BodyJoiner");

const comm = (await api("/communities", {
  method: "POST", token: owner.token,
  body: { name: `BodyComm ${sfx}`, description: "bodyless", joinMode: "APPROVAL_REQUIRED" },
})).data.data.community;

console.log("\n=== POST /join with NO body (the reported 500) ===");
const j = await noBody(`/api/v1/communities/${comm._id}/join`, "POST", joiner.token);
console.log("   ->", j.status, JSON.stringify(j.data).slice(0, 160));
check("no 500 on bodyless join", j.status !== 500, `status=${j.status}`);
check("join succeeded (200)", j.status === 200, `status=${j.status}`);
check("request is pending", j.data?.data?.membership?.hasPendingRequest === true, JSON.stringify(j.data?.data?.membership));
check("pendingRequestId returned", !!j.data?.data?.membership?.pendingRequestId);

console.log("\n=== POST /join with an EMPTY json object ===");
const other = await mkuser("BodyOther");
const j2 = await noBody(`/api/v1/communities/${comm._id}/join`, "POST", other.token);
check("still fine with empty payload", j2.status === 200 || j2.status === 409, `status=${j2.status}`);

console.log("\n=== PATCH join-requests with NO body ===");
const q = await api(`/communities/${comm._id}/join-requests`, { token: owner.token });
const rid = q.data.data.requests[0]._id;
const bad = await noBody(`/api/v1/communities/${comm._id}/join-requests/${rid}`, "PATCH", owner.token);
check("no 500 on bodyless approve", bad.status !== 500, `status=${bad.status}`);
check("returns 400 (missing decision) instead of crashing", bad.status === 400, `status=${bad.status} ${JSON.stringify(bad.data)}`);

console.log("\n=== POST /communities with NO body ===");
const cb = await noBody("/api/v1/communities", "POST", owner.token);
check("no 500 on bodyless create", cb.status !== 500, `status=${cb.status}`);
check("returns 400/409, not a crash", [400, 409].includes(cb.status), `status=${cb.status}`);

console.log("\n=== PATCH community with NO body ===");
const ub = await noBody(`/api/v1/communities/${comm._id}`, "PATCH", owner.token);
check("no 500 on bodyless update", ub.status !== 500, `status=${ub.status}`);
check("returns 200 (nothing to change)", ub.status === 200, `status=${ub.status}`);

console.log("\n=== POST community post with NO body ===");
await api(`/api/v1/communities/${comm._id}/join`, { method: "POST", token: owner.token });
const pb = await noBody(`/api/v1/communities/${comm._id}/posts`, "POST", owner.token);
check("no 500 on bodyless post", pb.status !== 500, `status=${pb.status}`);
check("returns 400 (content required)", pb.status === 400, `status=${pb.status}`);

console.log("\n=== POST /auth/forgot-password and /reset-password with NO body ===");
const fb = await noBody("/api/v1/auth/forgot-password", "POST");
check("forgot-password: no 500", fb.status !== 500, `status=${fb.status}`);
check("forgot-password: 400 (email required)", fb.status === 400, `status=${fb.status}`);
const rb = await noBody("/api/v1/auth/reset-password", "POST");
check("reset-password: no 500", rb.status !== 500, `status=${rb.status}`);
check("reset-password: 400 (token required)", rb.status === 400, `status=${rb.status}`);

console.log("\n=== PUT /notifications/:id with NO body ===");
await api(`/users/${owner.id}/follow`, { method: "POST", token: joiner.token });
const notes = await api("/notifications?limit=5", { token: owner.token });
const nid = notes.data.data.notifications[0]._id;
const nb = await noBody(`/api/v1/notifications/${nid}`, "PUT", owner.token);
check("no 500 on bodyless notification update", nb.status !== 500, `status=${nb.status}`);
check("defaults to marking read", nb.data?.data?.notification?.read === true, JSON.stringify(nb.data?.data?.notification?.read));

console.log("\n=== POST /conversations with NO body ===");
const convb = await noBody("/api/v1/conversations", "POST", owner.token);
check("no 500 on bodyless conversation create", convb.status !== 500, `status=${convb.status}`);
check("returns 400 (participantId required)", convb.status === 400, `status=${convb.status}`);

console.log(`\n${"=".repeat(46)}\nPASSED: ${passed}   FAILED: ${failed}\n${"=".repeat(46)}`);
process.exit(failed === 0 ? 0 : 1);
