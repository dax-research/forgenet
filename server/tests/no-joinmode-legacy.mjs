/**
 * Communities created BEFORE joinMode was added: the field is absent, so the
 * schema default applies. Does the UI then show "Join" and silently let people
 * in with no request reaching the owner?
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
const pw = "TestPass123!";
const mkuser = async (name) => {
  const email = `${name.toLowerCase()}.${sfx}@t.dev`;
  await api("/auth/register", { method: "POST", body: { name, email, password: pw } });
  const r = await api("/auth/login", { method: "POST", body: { email, password: pw } });
  return { token: r.data.data.token, id: r.data.data.user._id };
};

const owner = await mkuser("NoModeOwner");
const joiner = await mkuser("NoModeJoiner");

const created = await api("/communities", {
  method: "POST", token: owner.token,
  body: { name: `NoModeComm ${sfx}`, description: "no mode field", joinMode: "APPROVAL_REQUIRED" },
});
const c = created.data.data.community;
console.log("created with joinMode:", c.joinMode);

const { connectDatabase } = await import("../src/config/database.js");
const { default: Community } = await import("../src/features/communities/community.model.js");
await connectDatabase();

// Emulate a document written before joinMode existed.
await Community.updateOne({ _id: c._id }, { $unset: { joinMode: "" } });
const raw = await Community.findById(c._id).lean();
console.log("raw joinMode in DB:", raw.joinMode === undefined ? "undefined  <-- pre-migration doc" : raw.joinMode);

const list = await api("/communities?limit=50", { token: owner.token });
const entry = (list.data?.data?.communities || []).find((x) => x._id === c._id);
const detail = await api(`/communities/${c._id}`, { token: joiner.token });
const dc = detail.data?.data?.community;
console.log("\nAPI reports joinMode =", JSON.stringify(dc?.joinMode), "(list:", JSON.stringify(entry?.joinMode) + ")");

if (dc?.joinMode === "OPEN") {
  console.log("\n>>> BUG CONFIRMED: this community behaves as OPEN even though it was created");
  console.log(">>> as approval-required. Clicking Join adds the user as a MEMBER immediately,");
  console.log(">>> so NO request is created and the owner is never notified.");

  const join = await api(`/communities/${c._id}/join`, { method: "POST", token: joiner.token });
  console.log("\nPOST /join ->", join.status, JSON.stringify(join.data?.data?.membership));
  const stored = await Community.findById(c._id).lean();
  console.log("joinRequests stored:", JSON.stringify(stored.joinRequests ?? []));
  console.log("hasPendingRequest:", join.data?.data?.membership?.hasPendingRequest);
  console.log("\nAdmin list would be EMPTY because nobody ever queued a request.");
} else {
  console.log("\njoinMode preserved correctly; not the cause.");
}

await mongoose.disconnect();
