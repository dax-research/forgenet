/**
 * Replays the EXACT flow against the server the browser actually uses (:5000),
 * including what the owner sees. Targets the two reported symptoms:
 *   1. "clicking does not send the request"
 *   2. "admin list shows empty"
 */
const BASE = process.env.API_BASE || "http://127.0.0.1:5000/api/v1";

let passed = 0, failed = 0;
const check = (l, c, e = "") => { if (c) { passed++; console.log(`  PASS  ${l}`); } else { failed++; console.log(`  FAIL  ${l} ${e}`); } };

const api = async (path, { method = "GET", token, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = {};
  try { data = await res.json(); } catch { data = { _parseError: await res.text().catch(() => "") }; }
  return { status: res.status, data };
};

const sfx = Date.now();
const mkuser = async (name) => {
  const email = `${name.toLowerCase()}.${sfx}@t.dev`;
  const pw = "TestPass123!";
  const reg = await api("/auth/register", { method: "POST", body: { name, email, password: pw } });
  if (reg.status !== 201) console.log(`   (register ${name} -> ${reg.status} ${JSON.stringify(reg.data).slice(0,120)})`);
  const r = await api("/auth/login", { method: "POST", body: { email, password: pw } });
  return { name, token: r.data?.data?.token, id: r.data?.data?.user?._id };
};

const owner = await mkuser("RealOwner");
const joiner = await mkuser("RealJoiner");

console.log("\n=== owner creates APPROVAL_REQUIRED community ===");
const created = await api("/communities", {
  method: "POST", token: owner.token,
  body: { name: `RealComm ${sfx}`, description: "real", joinMode: "APPROVAL_REQUIRED" },
});
check("community created", created.status === 201, JSON.stringify(created.data).slice(0, 200));
const c = created.data.data.community;
console.log("   id:", c._id, "| joinMode:", c.joinMode);

console.log("\n=== joiner clicks 'Request to Join' ===");
const join = await api(`/communities/${c._id}/join`, { method: "POST", token: joiner.token });
console.log("   ->", join.status, JSON.stringify(join.data));
check("join POST succeeded", join.status === 200);
check("server says request is PENDING", join.data?.data?.membership?.hasPendingRequest === true);
check("joiner is NOT a member yet", join.data?.data?.membership?.isMember === false);

console.log("\n=== did the request land in the database? ===");
const comm = await api(`/communities/${c._id}`, { token: owner.token });
const rawReqs = comm.data?.data?.community?.joinRequests;
console.log("   raw joinRequests on the doc:", JSON.stringify(rawReqs));
check("request is persisted on the community document", Array.isArray(rawReqs) && rawReqs.length === 1);
check("persisted status is pending", rawReqs?.[0]?.status === "pending");

console.log("\n=== owner notification ===");
const notes = await api("/notifications?limit=50", { token: owner.token });
const n = (notes.data?.data?.notifications || []).find((x) => x.message?.includes("requested to join"));
console.log("   owner notification:", n ? n.message : "NONE");
check("owner was notified", !!n);

console.log("\n=== owner's pending list (the 'admin list' that shows empty) ===");
const queue = await api(`/communities/${c._id}/join-requests`, { token: owner.token });
console.log("   ->", queue.status, JSON.stringify(queue.data?.data));
check("join-requests returns 200 for owner", queue.status === 200, JSON.stringify(queue.data).slice(0, 200));
check("queue has 1 actionable request", (queue.data?.data?.requests || []).length === 1, `len=${queue.data?.data?.requests?.length}`);

console.log("\n=== can the owner actually approve? ===");
const reqId = queue.data?.data?.requests?.[0]?._id;
check("request exposes an _id", !!reqId);
const approve = await api(`/communities/${c._id}/join-requests/${reqId}`, { method: "PATCH", token: owner.token, body: { decision: "approve" } });
console.log("   approve ->", approve.status, JSON.stringify(approve.data).slice(0, 200));
check("approve succeeded", approve.status === 200);
const post = await api(`/communities/${c._id}/posts`, { method: "POST", token: joiner.token, body: { content: "now allowed" } });
check("newly approved member can post", post.status === 201, JSON.stringify(post.data).slice(0, 150));

console.log(`\nPASSED: ${passed}   FAILED: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
