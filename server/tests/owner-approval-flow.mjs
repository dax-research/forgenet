/**
 * The owner's approval path end to end: a join request must reach the owner,
 * stay visible, and be actionable (approve adds the member, reject does not).
 */
const BASE = process.env.API_BASE || "http://localhost:5059/api/v1";

let passed = 0, failed = 0;
const check = (l, c, e = "") => { if (c) { passed++; console.log(`  PASS  ${l}`); } else { failed++; console.log(`  FAIL  ${l} ${e}`); } };

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
const mkuser = async (name) => {
  const email = `${name.toLowerCase()}.${sfx}@test.dev`;
  const pw = "TestPass123!";
  await api("/auth/register", { method: "POST", body: { name, email, password: pw } });
  const r = await api("/auth/login", { method: "POST", body: { email, password: pw } });
  return { name, token: r.data.data.token, id: r.data.data.user._id };
};

const owner = await mkuser("FlowOwner");
const a = await mkuser("FlowA");
const b = await mkuser("FlowB");
const c = await mkuser("FlowC");

const comm = (await api("/communities", {
  method: "POST", token: owner.token,
  body: { name: `FlowComm ${sfx}`, description: "flow", joinMode: "APPROVAL_REQUIRED" },
})).data.data.community;

console.log("\n=== Requests from three people ===");
for (const person of [a, b, c]) {
  const r = await api(`/communities/${comm._id}/join`, { method: "POST", token: person.token });
  check(`${person.name} submitted a request`, r.status === 200 && r.data.data.membership.hasPendingRequest === true, JSON.stringify(r.data));
}

// Owner notification carries the community id the UI needs to refresh
const notes = await api("/notifications?limit=50", { token: owner.token });
const joinNotes = (notes.data.data.notifications || []).filter((n) => n.data?.action === "join_request");
check("owner got one notification per request", joinNotes.length === 3, `count=${joinNotes.length}`);
check("notification carries communityId", joinNotes.every((n) => n.data?.communityId === comm._id), JSON.stringify(joinNotes[0]?.data));
check("notification carries requester as sender", joinNotes.every((n) => n.sender?._id), JSON.stringify(joinNotes.map((n) => n.sender?.name)));

console.log("\n=== Owner sees the queue ===");
const queue = await api(`/communities/${comm._id}/join-requests`, { token: owner.token });
check("queue returns all 3 pending", (queue.data.data.requests || []).length === 3, `len=${queue.data.data.requests?.length}`);
check("each entry has an id to act on", (queue.data.data.requests || []).every((r) => !!r._id));
check("each entry has a populated user", (queue.data.data.requests || []).every((r) => !!r.user?.name));

const detail = await api(`/communities/${comm._id}`, { token: owner.token });
check("owner detail reports pending count 3", detail.data.data.community.joinRequestCount === 3, String(detail.data.data.community.joinRequestCount));

console.log("\n=== Approve one ===");
const targetA = queue.data.data.requests.find((r) => r.user._id === a.id);
const approve = await api(`/communities/${comm._id}/join-requests/${targetA._id}`, { method: "PATCH", token: owner.token, body: { decision: "approve" } });
check("approve succeeded", approve.status === 200, JSON.stringify(approve.data));
const queue2 = await api(`/communities/${comm._id}/join-requests`, { token: owner.token });
check("queue drops to 2", (queue2.data.data.requests || []).length === 2, `len=${queue2.data.data.requests?.length}`);
check("approved user gone from queue", !(queue2.data.data.requests || []).some((r) => r.user._id === a.id));
const members = await api(`/communities/${comm._id}/members`, {});
check("approved user is a member", (members.data.data.members || []).some((m) => m._id === a.id));
const aPost = await api(`/communities/${comm._id}/posts`, { method: "POST", token: a.token, body: { content: "hi" } });
check("approved user can post", aPost.status === 201, JSON.stringify(aPost.data));

console.log("\n=== Reject one ===");
const targetB = queue2.data.data.requests.find((r) => r.user._id === b.id);
const reject = await api(`/communities/${comm._id}/join-requests/${targetB._id}`, { method: "PATCH", token: owner.token, body: { decision: "reject" } });
check("reject succeeded", reject.status === 200);
const queue3 = await api(`/communities/${comm._id}/join-requests`, { token: owner.token });
check("queue drops to 1", (queue3.data.data.requests || []).length === 1, `len=${queue3.data.data.requests?.length}`);
const members2 = await api(`/communities/${comm._id}/members`, {});
check("rejected user is NOT a member", !(members2.data.data.members || []).some((m) => m._id === b.id));
const bPost = await api(`/communities/${comm._id}/posts`, { method: "POST", token: b.token, body: { content: "no" } });
check("rejected user cannot post", bPost.status === 403);

console.log("\n=== Queue empties cleanly ===");
const targetC = queue3.data.data.requests.find((r) => r.user._id === c.id);
await api(`/communities/${comm._id}/join-requests/${targetC._id}`, { method: "PATCH", token: owner.token, body: { decision: "approve" } });
const queueEmpty = await api(`/communities/${comm._id}/join-requests`, { token: owner.token });
check("queue is empty", (queueEmpty.data.data.requests || []).length === 0, `len=${queueEmpty.data.data.requests?.length}`);
const detailEmpty = await api(`/communities/${comm._id}`, { token: owner.token });
check("detail pending count is 0", detailEmpty.data.data.community.joinRequestCount === 0);

console.log(`\n${"=".repeat(46)}\nPASSED: ${passed}   FAILED: ${failed}\n${"=".repeat(46)}`);
process.exit(failed === 0 ? 0 : 1);
