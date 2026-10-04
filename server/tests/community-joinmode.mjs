/**
 * Owner-only membership-mode switching: OPEN <-> APPROVAL_REQUIRED.
 * Run against a live server: node tests/community-joinmode.mjs
 */
const BASE = process.env.API_BASE || "http://localhost:5058/api/v1";

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

const sfx = Date.now();
const mkuser = async (name) => {
  const email = `${name.toLowerCase()}.${sfx}@test.dev`;
  const pw = "TestPass123!";
  await api("/auth/register", { method: "POST", body: { name, email, password: pw } });
  const r = await api("/auth/login", { method: "POST", body: { email, password: pw } });
  return { name, token: r.data.data.token, id: r.data.data.user._id };
};

const owner = await mkuser("ModeOwner");
const alice = await mkuser("ModeAlice");
const bob = await mkuser("ModeBob");
const mallory = await mkuser("ModeMallory");

const mkCommunity = async (name, joinMode) =>
  (await api("/communities", {
    method: "POST",
    token: owner.token,
    body: { name: `${name} ${sfx}`, description: "mode switching", joinMode },
  })).data.data.community;

console.log("\n=== Authorization: only the owner can switch modes ===");

const open1 = await mkCommunity("SwitchOpen", "OPEN");
const approval1 = await mkCommunity("SwitchApproval", "APPROVAL_REQUIRED");

// A member tries to switch.
await api(`/communities/${open1._id}/join`, { method: "POST", token: alice.token });
const memberSwitch = await api(`/communities/${open1._id}`, {
  method: "PATCH",
  token: alice.token,
  body: { joinMode: "APPROVAL_REQUIRED" },
});
check("plain member CANNOT change joinMode (403)", memberSwitch.status === 403, JSON.stringify(memberSwitch.data));
const stillOpen = await api(`/communities/${open1._id}`, {});
check("joinMode unchanged after member attempt", stillOpen.data.data.community.joinMode === "OPEN");

const outsiderSwitch = await api(`/communities/${open1._id}`, {
  method: "PATCH",
  token: mallory.token,
  body: { joinMode: "APPROVAL_REQUIRED" },
});
check("non-member CANNOT change joinMode (403)", outsiderSwitch.status === 403, JSON.stringify(outsiderSwitch.data));

const anonSwitch = await api(`/communities/${open1._id}`, { method: "PATCH", body: { joinMode: "APPROVAL_REQUIRED" } });
check("anonymous CANNOT change joinMode (401)", anonSwitch.status === 401, String(anonSwitch.status));

console.log("\n=== OPEN -> APPROVAL_REQUIRED ===");

const toApproval = await api(`/communities/${open1._id}`, {
  method: "PATCH",
  token: owner.token,
  body: { joinMode: "APPROVAL_REQUIRED" },
});
check("owner switches OPEN -> APPROVAL_REQUIRED", toApproval.status === 200, JSON.stringify(toApproval.data));
check("response reflects new mode", toApproval.data.data.community.joinMode === "APPROVAL_REQUIRED");

const detail1 = await api(`/communities/${open1._id}`, {});
check("detail reflects APPROVAL_REQUIRED", detail1.data.data.community.joinMode === "APPROVAL_REQUIRED");

// Existing members keep their membership.
const membersAfterSwitch = await api(`/communities/${open1._id}/members`, {});
check("existing member retained after switch", (membersAfterSwitch.data.data.members || []).some((m) => m._id === alice.id));

// A new joiner must now go through approval.
const bobReq = await api(`/communities/${open1._id}/join`, { method: "POST", token: bob.token });
check("new joiner gets a pending request, not membership", bobReq.data.data.membership.hasPendingRequest === true, JSON.stringify(bobReq.data.data.membership));
check("new joiner is NOT a member", bobReq.data.data.membership.isMember === false);
const bobPost = await api(`/communities/${open1._id}/posts`, { method: "POST", token: bob.token, body: { content: "should fail" } });
check("pending joiner CANNOT post (403)", bobPost.status === 403, JSON.stringify(bobPost.data));

console.log("\n=== Switching back grants the pending backlog ===");

const pendingBefore = await api(`/communities/${open1._id}/join-requests`, { token: owner.token });
check("owner sees 1 pending request before switch", (pendingBefore.data.data.requests || []).length === 1, String(pendingBefore.data.data.requests?.length));

const toOpen = await api(`/communities/${open1._id}`, {
  method: "PATCH",
  token: owner.token,
  body: { joinMode: "OPEN" },
});
check("owner switches APPROVAL_REQUIRED -> OPEN", toOpen.status === 200, JSON.stringify(toOpen.data));
check("response reports granted requests", toOpen.data.data.approvedFromPending === 1, JSON.stringify(toOpen.data.data.approvedFromPending));
check("response reflects OPEN", toOpen.data.data.community.joinMode === "OPEN");

const pendingAfter = await api(`/communities/${open1._id}/join-requests`, { token: owner.token });
check("pending queue is empty after switch", (pendingAfter.data.data.requests || []).length === 0);

const membersAfter = await api(`/communities/${open1._id}/members`, {});
check("pending requester is now a member", (membersAfter.data.data.members || []).some((m) => m._id === bob.id), JSON.stringify(membersAfter.data.data.members?.map((m) => m._id)));

const bobPostNow = await api(`/communities/${open1._id}/posts`, { method: "POST", token: bob.token, body: { content: "now allowed" } });
check("granted member CAN post (201)", bobPostNow.status === 201, JSON.stringify(bobPostNow.data));

const bobNotes = await api("/notifications?limit=50", { token: bob.token });
check("granted user notified", (bobNotes.data.data.notifications || []).some((n) => n.message?.includes("was approved")));

// No duplicate notification from the grant path.
const bobApprovals = (bobNotes.data.data.notifications || []).filter((n) => n.message?.includes("was approved"));
check("exactly one approval notification", bobApprovals.length === 1, `count=${bobApprovals.length}`);

console.log("\n=== New joiners now join instantly ===");
const malloryJoin = await api(`/communities/${open1._id}/join`, { method: "POST", token: mallory.token });
check("joiner gets immediate membership in OPEN mode", malloryJoin.data.data.membership.role === "MEMBER", JSON.stringify(malloryJoin.data.data.membership));
check("no pending request in OPEN mode", malloryJoin.data.data.membership.hasPendingRequest === false);

console.log("\n=== Idempotency and validation ===");
const sameMode = await api(`/communities/${open1._id}`, { method: "PATCH", token: owner.token, body: { joinMode: "OPEN" } });
check("re-applying the same mode succeeds", sameMode.status === 200);
check("same-mode switch grants nobody", sameMode.data.data.approvedFromPending === 0, JSON.stringify(sameMode.data.data.approvedFromPending));

const badMode = await api(`/communities/${open1._id}`, { method: "PATCH", token: owner.token, body: { joinMode: "NONSENSE" } });
check("invalid joinMode rejected (400)", badMode.status === 400, JSON.stringify(badMode.data));
const afterBad = await api(`/communities/${open1._id}`, {});
check("invalid mode left joinMode untouched", afterBad.data.data.community.joinMode === "OPEN");

// Round trip back to APPROVAL_REQUIRED to confirm both directions work repeatedly.
const roundTrip = await api(`/communities/${open1._id}`, { method: "PATCH", token: owner.token, body: { joinMode: "APPROVAL_REQUIRED" } });
check("OPEN -> APPROVAL_REQUIRED again", roundTrip.data.data.community.joinMode === "APPROVAL_REQUIRED");
const erin = await mkuser("ModeErin");
const erinReq = await api(`/communities/${open1._id}/join`, { method: "POST", token: erin.token });
check("new joiner must request again after 2nd switch", erinReq.data.data.membership.hasPendingRequest === true);
const backToOpen = await api(`/communities/${open1._id}`, { method: "PATCH", token: owner.token, body: { joinMode: "OPEN" } });
check("switch back grants the new request", backToOpen.data.data.approvedFromPending === 1, JSON.stringify(backToOpen.data.data.approvedFromPending));

console.log(`\n${"=".repeat(46)}\nPASSED: ${passed}   FAILED: ${failed}\n${"=".repeat(46)}`);
process.exit(failed === 0 ? 0 : 1);
