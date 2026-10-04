/**
 * Runtime verification of the unread-message read-state transitions that the
 * sidebar badge and Chat page depend on. Run against a live server.
 */
const BASE = process.env.API_BASE || "http://localhost:5057/api/v1";

let passed = 0;
let failed = 0;
const check = (label, cond, extra = "") => {
  if (cond) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label} ${extra}`); }
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

const fmt = (c) => (!c || c <= 0 ? null : c > 10 ? "10+" : String(c));

const sfx = Date.now();
const mkuser = async (name) => {
  const email = `${name.toLowerCase()}.${sfx}@test.dev`;
  const pw = "TestPass123!";
  await api("/auth/register", { method: "POST", body: { name, email, password: pw } });
  const r = await api("/auth/login", { method: "POST", body: { email, password: pw } });
  return { token: r.data.data.token, id: r.data.data.user._id, email };
};

const alice = await mkuser("FlowAlice");
const bob = await mkuser("FlowBob");

console.log("\n=== Unread badge / read-state flow ===");

const cid = (await api("/conversations", { method: "POST", token: bob.token, body: { participantId: alice.id } })).data.data.conversation._id;

// 0 unread -> no badge
check("0 unread -> no badge", fmt((await api("/messages/unread-count", { token: alice.token })).data.data.unreadCount) === null);

// 9 unread -> "9"
for (let i = 0; i < 9; i++) await api(`/conversations/${cid}/messages`, { method: "POST", token: bob.token, body: { content: `m${i}` } });
const c9 = (await api("/messages/unread-count", { token: alice.token })).data.data.unreadCount;
check(`9 unread -> "9"`, c9 === 9 && fmt(c9) === "9", `count=${c9}`);

// 11 unread -> "10+"
for (let i = 0; i < 2; i++) await api(`/conversations/${cid}/messages`, { method: "POST", token: bob.token, body: { content: `m${i}` } });
const c11 = (await api("/messages/unread-count", { token: alice.token })).data.data.unreadCount;
check(`11 unread -> "10+"`, c11 === 11 && fmt(c11) === "10+", `count=${c11}`);

// Conversation list carries per-thread counts for the pills
const list = (await api("/conversations", { token: alice.token })).data.data.conversations;
check("conversation list exposes unreadCount=11", list[0]?.unreadCount === 11, JSON.stringify(list.map((c) => c.unreadCount)));

// Opening the conversation marks it read
const read = await api(`/messages/conversation/${cid}/read`, { method: "PUT", token: alice.token });
check("mark read returns unreadCount 0", read.data.data.unreadCount === 0, JSON.stringify(read.data.data));
check("badge disappears after reading", fmt(read.data.data.unreadCount) === null);

// Persistence across reload (fresh request, same DB)
const afterReload = (await api("/messages/unread-count", { token: alice.token })).data.data.unreadCount;
check("count persists as 0 after refresh", afterReload === 0);

const listAfter = (await api("/conversations", { token: alice.token })).data.data.conversations;
check("conversation pill cleared after reading", listAfter[0]?.unreadCount === 0);

// Sender never sees their own messages as unread
const senderCount = (await api("/messages/unread-count", { token: bob.token })).data.data.unreadCount;
check("sender has 0 unread", senderCount === 0);

// New incoming message raises it again (realtime source)
await api(`/conversations/${cid}/messages`, { method: "POST", token: bob.token, body: { content: "new one" } });
const raised = (await api("/messages/unread-count", { token: alice.token })).data.data.unreadCount;
check("new message raises unread to 1", raised === 1, `count=${raised}`);

console.log(`\nPASSED: ${passed}  FAILED: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
