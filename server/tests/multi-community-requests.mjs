/**
 * Regression: a unique index over an embedded array path is enforced across the
 * WHOLE collection, so `{ joinRequests.user, joinRequests.status }` allowed only
 * ONE pending request per user across ALL communities. This suite proves that is
 * no longer the case, using a SINGLE user across MANY communities (the case all
 * earlier tests missed because they used fresh users every time).
 */
const BASE = process.env.API_BASE || "http://localhost:5067/api/v1";

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

// ONE user, several distinct owners/communities.
const joiner = await mkuser("MultiJoiner");
const owners = [await mkuser("MO1"), await mkuser("MO2"), await mkuser("MO3"), await mkuser("MO4")];

const comms = [];
for (const [i, o] of owners.entries()) {
  comms.push(
    (await api("/communities", {
      method: "POST", token: o.token,
      body: { name: `MultiComm${i} ${sfx}`, description: "multi", joinMode: "APPROVAL_REQUIRED" },
    })).data.data.community
  );
}

console.log("\n=== The SAME user requests to join 4 different communities ===");
for (const [i, c] of comms.entries()) {
  const r = await api(`/communities/${c._id}/join`, { method: "POST", token: joiner.token });
  console.log(`   community ${i}: ${r.status} ${JSON.stringify(r.data?.data?.membership?.hasPendingRequest ?? r.data?.message)}`);
  check(`request to community ${i} succeeded (no 11000)`, r.status === 200, `${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
  check(`community ${i} shows pending`, r.data?.data?.membership?.hasPendingRequest === true);
}

console.log("\n=== Repeat click on the SAME community is still rejected ===");
const again = await api(`/communities/${comms[0]._id}/join`, { method: "POST", token: joiner.token });
check("duplicate in the same community -> 409", again.status === 409, `${again.status} ${JSON.stringify(again.data)}`);

console.log("\n=== Only ONE pending request per community ===");
for (const [i, c] of comms.entries()) {
  const q = await api(`/communities/${c._id}/join-requests`, { token: owners[i].token });
  check(`community ${i} has exactly 1 pending request`, (q.data.data.requests || []).length === 1, `len=${q.data.data.requests?.length}`);
}

console.log("\n=== Each owner can approve independently ===");
for (const [i, c] of comms.entries()) {
  const q = await api(`/communities/${c._id}/join-requests`, { token: owners[i].token });
  const rid = q.data.data.requests[0]._id;
  const a = await api(`/communities/${c._id}/join-requests/${rid}`, { method: "PATCH", token: owners[i].token, body: { decision: "approve" } });
  check(`owner ${i} approved`, a.status === 200, `${a.status} ${JSON.stringify(a.data).slice(0, 120)}`);
}

const members = await api(`/communities/${comms[0]._id}/members`, {});
check("user is a member of the first community", (members.data.data.members || []).some((m) => m._id === joiner.id));

console.log("\n=== Approving one does not disturb the others ===");
const otherStill = await api(`/communities/${comms[1]._id}/members`, {});
check("second community shows the joiner as an approved member", (otherStill.data.data.members || []).some((m) => m._id === joiner.id));

console.log("\n=== Re-request after being approved elsewhere still works ===");
const third = await mkuser("MultiOther");
const fresh = (await api("/communities", {
  method: "POST", token: owners[3].token,
  body: { name: `MultiFresh ${sfx}`, description: "fresh", joinMode: "APPROVAL_REQUIRED" },
})).data.data.community;
const r1 = await api(`/communities/${fresh._id}/join`, { method: "POST", token: third.token });
check("new user can request into a new community", r1.status === 200, String(r1.status));

console.log("\n=== Cancel then re-request in the same community ===");
const q2 = await api(`/communities/${fresh._id}/join-requests`, { token: owners[3].token });
const rid2 = q2.data.data.requests[0]._id;
const cancel = await api(`/communities/${fresh._id}/join-requests/${rid2}`, { method: "DELETE", token: third.token });
check("cancel succeeds", cancel.status === 200, String(cancel.status));
const r2 = await api(`/communities/${fresh._id}/join`, { method: "POST", token: third.token });
check("can request again after cancelling", r2.status === 200, `${r2.status} ${JSON.stringify(r2.data).slice(0, 140)}`);
const q3 = await api(`/communities/${fresh._id}/join-requests`, { token: owners[3].token });
check("exactly 1 pending after cancel + re-request", (q3.data.data.requests || []).length === 1, `len=${q3.data.data.requests?.length}`);

console.log(`\n${"=".repeat(46)}\nPASSED: ${passed}   FAILED: ${failed}\n${"=".repeat(46)}`);
process.exit(failed === 0 ? 0 : 1);
