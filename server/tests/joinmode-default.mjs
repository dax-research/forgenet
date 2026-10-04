/**
 * Regression: a community with NO joinMode on the document must not silently
 * admit members. It must require approval and notify the owner.
 */
import mongoose from "mongoose";
const BASE = process.env.API_BASE || "http://localhost:5060/api/v1";

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

const { connectDatabase } = await import("../src/config/database.js");
const { default: Community } = await import("../src/features/communities/community.model.js");
await connectDatabase();

console.log("\n=== Document with no joinMode must NOT be treated as OPEN ===");

const owner = await mkuser("FixOwner");
const joiner = await mkuser("FixJoiner");

// Create via a path that omits joinMode entirely.
const created = await api("/communities", {
  method: "POST", token: owner.token,
  body: { name: `FixComm ${sfx}`, description: "no explicit mode" },
});
const c = created.data.data.community;
console.log("   created without joinMode -> API reports:", JSON.stringify(c.joinMode));
check("server defaults to APPROVAL_REQUIRED", c.joinMode === "APPROVAL_REQUIRED", JSON.stringify(c.joinMode));

// Now the true legacy shape: field absent from the stored document.
const legacy = created.data.data.community._id;
await Community.updateOne({ _id: legacy }, { $unset: { joinMode: "" } });
const raw = await Community.findById(legacy).lean();
check("test fixture really has no joinMode", raw.joinMode === undefined);

const detail = await api(`/communities/${legacy}`, { token: joiner.token });
check("API reports APPROVAL_REQUIRED for a legacy doc", detail.data?.data?.community?.joinMode === "APPROVAL_REQUIRED", JSON.stringify(detail.data?.data?.community?.joinMode));

const join = await api(`/communities/${legacy}/join`, { method: "POST", token: joiner.token });
console.log("   POST /join ->", JSON.stringify(join.data?.data?.membership));
check("legacy community creates a PENDING request", join.data?.data?.membership?.hasPendingRequest === true);
check("legacy community does NOT add them as a member", join.data?.data?.membership?.isMember === false);

const post = await api(`/communities/${legacy}/posts`, { method: "POST", token: joiner.token, body: { content: "should fail" } });
check("legacy community blocks posting until approved (403)", post.status === 403, String(post.status));

const notes = await api("/notifications?limit=50", { token: owner.token });
check("owner is notified of the request", (notes.data?.data?.notifications || []).some((n) => n.message?.includes("requested to join")));

const queue = await api(`/communities/${legacy}/join-requests`, { token: owner.token });
check("admin list is populated", (queue.data?.data?.requests || []).length === 1, `len=${queue.data?.data?.requests?.length}`);

const approve = await api(`/communities/${legacy}/join-requests/${queue.data.data.requests[0]._id}`, { method: "PATCH", token: owner.token, body: { decision: "approve" } });
check("owner can approve the legacy request", approve.status === 200, String(approve.status));
const postNow = await api(`/communities/${legacy}/posts`, { method: "POST", token: joiner.token, body: { content: "now allowed" } });
check("approved member can post", postNow.status === 201, String(postNow.status));

console.log("\n=== Owner can still opt the legacy community into OPEN ===");
const toOpen = await api(`/communities/${legacy}`, { method: "PATCH", token: owner.token, body: { joinMode: "OPEN" } });
check("owner switches to OPEN", toOpen.data?.data?.community?.joinMode === "OPEN", JSON.stringify(toOpen.data?.data?.community?.joinMode));
const third = await mkuser("FixThird");
const j3 = await api(`/communities/${legacy}/join`, { method: "POST", token: third.token });
check("in OPEN mode a joiner becomes a member instantly", j3.data?.data?.membership?.role === "MEMBER", JSON.stringify(j3.data?.data?.membership));

console.log(`\nPASSED: ${passed}   FAILED: ${failed}`);
await mongoose.disconnect();
process.exit(failed === 0 ? 0 : 1);
