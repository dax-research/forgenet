/**
 * The exact sequence behind "I click Request and it stays on Request":
 * request -> list state -> repeated click (409) -> cancel -> request again.
 */
const BASE = process.env.API_BASE || "http://localhost:5064/api/v1";

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
const pw = "TestPass123!";
const mkuser = async (name) => {
  const email = `${name.toLowerCase()}.${sfx}@t.dev`;
  await api("/auth/register", { method: "POST", body: { name, email, password: pw } });
  const r = await api("/auth/login", { method: "POST", body: { email, password: pw } });
  return { name, token: r.data.data.token, id: r.data.data.user._id };
};

const owner = await mkuser("BtnOwner");
const joiner = await mkuser("BtnJoiner");

const c = (await api("/communities", {
  method: "POST", token: owner.token,
  body: { name: `BtnComm ${sfx}`, description: "button state", joinMode: "APPROVAL_REQUIRED" },
})).data.data.community;

const cardState = async (token) => {
  const list = await api("/communities?limit=50", { token });
  return (list.data.data.communities || []).find((x) => x._id === c._id)?.membership;
};

console.log("\n=== Initial card state ===");
let s = await cardState(joiner.token);
console.log("   ", JSON.stringify(s));
check("card offers Request (no pending)", s.hasPendingRequest === false && s.role === "NONE");

console.log("\n=== Click 'Request' ===");
const r1 = await api(`/communities/${c._id}/join`, { method: "POST", token: joiner.token });
check("200 with pending membership", r1.status === 200 && r1.data.data.membership.hasPendingRequest === true, JSON.stringify(r1.data));
check("response includes pendingRequestId (so the UI can cancel)", !!r1.data.data.membership.pendingRequestId, JSON.stringify(r1.data.data.membership));

s = await cardState(joiner.token);
console.log("   ", JSON.stringify(s));
check("list state now shows pending -> card renders 'Request Pending'", s.hasPendingRequest === true);
check("pendingRequestId present in list membership", !!s.pendingRequestId);

console.log("\n=== Click again (the reported symptom) ===");
const r2 = await api(`/communities/${c._id}/join`, { method: "POST", token: joiner.token });
check("second click is 409 (already pending)", r2.status === 409, String(r2.status));
check("409 has no membership body (UI must refetch)", !r2.data.data?.membership, JSON.stringify(r2.data.data));

// This is what the card now does: recover the real state instead of a dead button.
const recovered = await api(`/communities/${c._id}`, { token: joiner.token });
check("recovery path (GET detail) reports pending", recovered.data.data.community.membership.hasPendingRequest === true);
check("recovery path exposes the request id", !!recovered.data.data.community.membership.pendingRequestId);

console.log("\n=== Cancel the request ===");
const rid = s.pendingRequestId;
const cancel = await api(`/communities/${c._id}/join-requests/${rid}`, { method: "DELETE", token: joiner.token });
check("cancel succeeds", cancel.status === 200, JSON.stringify(cancel.data));

s = await cardState(joiner.token);
check("state back to no pending -> button is Request again", s.hasPendingRequest === false, JSON.stringify(s));

console.log("\n=== Cancel without an id (UI convenience) ===");
await api(`/communities/${c._id}/join`, { method: "POST", token: joiner.token });
const cancelNoId = await api(`/communities/${c._id}/join-requests`, { method: "DELETE", token: joiner.token });
check("cancel without id works for the requester", cancelNoId.status === 200, JSON.stringify(cancelNoId.data));

console.log("\n=== Someone else cannot cancel your request ===");
const other = await mkuser("BtnOther");
await api(`/communities/${c._id}/join`, { method: "POST", token: joiner.token });
const s2 = await cardState(joiner.token);
const steal = await api(`/communities/${c._id}/join-requests/${s2.pendingRequestId}`, { method: "DELETE", token: other.token });
check("non-owner cannot cancel another user's request (403)", steal.status === 403, String(steal.status));

console.log("\n=== Full loop, then approve ===");
const loop = await api(`/communities/${c._id}/join`, { method: "POST", token: joiner.token });
check("user can re-request after cancelling", loop.status === 409 || loop.status === 200, String(loop.status));
const queue = await api(`/communities/${c._id}/join-requests`, { token: owner.token });
check("owner queue has exactly 1 request", (queue.data.data.requests || []).length === 1, `len=${queue.data.data.requests?.length}`);
const approve = await api(`/communities/${c._id}/join-requests/${queue.data.data.requests[0]._id}`, { method: "PATCH", token: owner.token, body: { decision: "approve" } });
check("approve works after the cancel/re-request loop", approve.status === 200, String(approve.status));
s = await cardState(joiner.token);
check("card now shows member/Leave", s.isMember === true && s.role === "MEMBER", JSON.stringify(s));

console.log(`\n${"=".repeat(46)}\nPASSED: ${passed}   FAILED: ${failed}\n${"=".repeat(46)}`);
process.exit(failed === 0 ? 0 : 1);
