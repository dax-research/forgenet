/**
 * Legacy communities: documents created BEFORE joinRequests existed on the
 * schema. Their joinRequests field is undefined, which can break .filter().
 */
import mongoose from "mongoose";
const BASE = process.env.API_BASE || "http://127.0.0.1:5000/api/v1";

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
const email = `legacy.${sfx}@t.dev`;
const pw = "TestPass123!";
await api("/auth/register", { method: "POST", body: { name: "LegacyOwner", email, password: pw } });
const login = await api("/auth/login", { method: "POST", body: { email, password: pw } });
const owner = { token: login.data.data.token, id: login.data.data.user._id };

// Create a community the supported way, then strip joinRequests to emulate a
// document written before the field existed.
const created = await api("/communities", {
  method: "POST", token: owner.token,
  body: { name: `LegacyComm ${sfx}`, description: "legacy", joinMode: "APPROVAL_REQUIRED" },
});
const c = created.data.data.community;
console.log("created:", c._id);

const { env } = await import("../src/config/env.js");
const { connectDatabase } = await import("../src/config/database.js");
const { default: Community } = await import("../src/features/communities/community.model.js");
await connectDatabase();

await Community.updateOne({ _id: c._id }, { $unset: { joinRequests: "" } });
const doc = await Community.findById(c._id).lean();
console.log("joinRequests on legacy doc:", doc.joinRequests === undefined ? "undefined  <-- legacy shape" : JSON.stringify(doc.joinRequests));

console.log("\n--- hitting the endpoints the UI calls on a legacy community ---");

const detail = await api(`/communities/${c._id}`, { token: owner.token });
console.log("GET /communities/:id      ->", detail.status, JSON.stringify(detail.data).slice(0, 160));
console.log("GET /communities/:id      ->", detail.status === 200 ? "OK" : "*** BROKEN ***");

const reqs = await api(`/communities/${c._id}/join-requests`, { token: owner.token });
console.log("GET /join-requests        ->", reqs.status, JSON.stringify(reqs.data).slice(0, 160));
console.log("GET /join-requests        ->", reqs.status === 200 ? "OK" : "*** BROKEN ***");

const members = await api(`/communities/${c._id}/members`, { token: owner.token });
console.log("GET /members              ->", members.status);

const list = await api("/communities?limit=50", { token: owner.token });
const entry = (list.data?.data?.communities || []).find((x) => x._id === c._id);
console.log("GET /communities (list)   -> list status", list.status, "| membership:", JSON.stringify(entry?.membership));

console.log("\n--- can a request be submitted against a legacy community? ---");
const email2 = `joiner.${sfx}@t.dev`;
await api("/auth/register", { method: "POST", body: { name: "LegacyJoiner", email: email2, password: pw } });
const j = await api("/auth/login", { method: "POST", body: { email: email2, password: pw } });
const join = await api(`/communities/${c._id}/join`, { method: "POST", token: j.data.data.token });
console.log("POST /join                ->", join.status, JSON.stringify(join.data).slice(0, 200));
console.log("POST /join                ->", join.status === 200 ? "OK" : "*** BROKEN: request cannot even be submitted ***");

const stored = await Community.findById(c._id).lean();
console.log("requests stored on doc    ->", JSON.stringify(stored.joinRequests?.map((r) => ({ user: r.user, status: r.status }))));

await mongoose.disconnect();
