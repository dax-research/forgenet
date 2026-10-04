/**
 * Replays the exact request sequence the community UI issues, to find why a
 * join request is not visible/actionable for the owner.
 */
const BASE = process.env.API_BASE || "http://localhost:5059/api/v1";

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

const owner = await mkuser("UiOwner");
const joiner = await mkuser("UiJoiner");

// --- Owner creates the community (UI: createCommunity modal, APPROVAL_REQUIRED)
const created = await api("/communities", {
  method: "POST",
  token: owner.token,
  body: { name: `UiComm ${sfx}`, description: "ui check", joinMode: "APPROVAL_REQUIRED" },
});
const c = created.data.data.community;
console.log("CREATE ->", created.status, "joinMode:", c.joinMode, "id:", c._id);
console.log("  membership present on create response?", !!c.membership, JSON.stringify(c.membership));

// --- Joiner requests to join
const req = await api(`/communities/${c._id}/join`, { method: "POST", token: joiner.token });
console.log("\nJOIN REQUEST ->", req.status, JSON.stringify(req.data.data?.membership));

// --- Owner notifications (UI: GET /notifications?limit=50)
const notes = await api("/notifications?limit=50", { token: owner.token });
const joinNote = (notes.data.data.notifications || []).find((n) => n.message?.includes("requested to join"));
console.log("\nOWNER NOTIFICATIONS -> count:", notes.data.data.notifications?.length, "| join request note:", !!joinNote);
if (joinNote) console.log("  message:", joinNote.message, "| sender:", joinNote.sender?.name);
else console.log("  !! NO join-request notification for owner");

// --- The four calls Communities.jsx makes when the owner opens the detail view
console.log("\n--- owner opens community detail (UI sequence) ---");

const list = await api("/communities?limit=50", { token: owner.token });
const fromList = (list.data.data.communities || []).find((x) => x._id === c._id);
console.log("GET /communities -> membership:", JSON.stringify(fromList?.membership));

const detail = await api(`/communities/${c._id}`, { token: owner.token });
const m = detail.data.data.community?.membership;
console.log("GET /communities/:id -> status", detail.status, "| membership:", JSON.stringify(m));
console.log("  isAdmin:", m?.isAdmin, "| joinRequestCount:", detail.data.data.community?.joinRequestCount);

const members = await api(`/communities/${c._id}/members?limit=12`, { token: owner.token });
console.log("GET /members -> status", members.status, "| memberCount:", members.data.data?.memberCount, "| owner:", members.data.data?.owner?.name);

const reqs = await api(`/communities/${c._id}/join-requests`, { token: owner.token });
console.log("GET /join-requests -> status", reqs.status, "| requests:", JSON.stringify(reqs.data.data?.requests?.map(r => r.user?.name)));

// Does the UI condition hold?
const showPanel = m?.isAdmin && (reqs.data.data?.requests?.length ?? 0) > 0;
console.log("\nUI SHOWS PENDING PANEL?", showPanel);

if (!showPanel) {
  console.log("\n>>> ROOT CAUSE CANDIDATES <<<");
  if (!m?.isAdmin) console.log("  - membership.isAdmin is falsy, so the panel is skipped entirely");
  if ((reqs.data.data?.requests?.length ?? 0) === 0) console.log("  - join-requests list is empty");
}
