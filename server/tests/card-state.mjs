/**
 * CommunityCard state handling: what happens when the user ALREADY has a
 * pending request and clicks "Request" again (server returns 409).
 */
import mongoose from "mongoose";
const BASE = process.env.API_BASE || "http://localhost:5063/api/v1";

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

const owner = await mkuser("CardOwner");
const joiner = await mkuser("CardJoiner");

const c = (await api("/communities", {
  method: "POST", token: owner.token,
  body: { name: `CardComm ${sfx}`, description: "card state", joinMode: "APPROVAL_REQUIRED" },
})).data.data.community;

console.log("\n=== what the LIST endpoint tells the card before any click ===");
const list = await api("/communities?limit=50", { token: joiner.token });
const card = (list.data.data.communities || []).find((x) => x._id === c._id);
console.log("card.membership =", JSON.stringify(card.membership));
console.log("card.joinMode   =", JSON.stringify(card.joinMode));

console.log("\n=== first click: Request ===");
const first = await api(`/communities/${c._id}/join`, { method: "POST", token: joiner.token });
console.log("->", first.status, JSON.stringify(first.data?.data?.membership));

console.log("\n=== what the LIST endpoint says AFTER the request exists ===");
const list2 = await api("/communities?limit=50", { token: joiner.token });
const card2 = (list2.data.data.communities || []).find((x) => x._id === c._id);
console.log("card.membership =", JSON.stringify(card2.membership));
console.log(
  card2.membership?.hasPendingRequest === true
    ? "-> card would render 'Pending' IF it re-fetched"
    : "-> *** BUG: hasPendingRequest is false, card keeps showing 'Request' ***"
);

console.log("\n=== second click on a request that already exists ===");
const second = await api(`/communities/${c._id}/join`, { method: "POST", token: joiner.token });
console.log("-> status", second.status, "| message:", JSON.stringify(second.data?.message));
console.log("body has membership?", !!second.data?.data?.membership, "| error:", second.data?.success);
if (second.status === 409) {
  console.log("\n>>> The card's catch block only does console.warn and leaves state");
  console.log(">>> untouched, so the button stays 'Request' with no explanation.");
}

console.log("\n=== the detail endpoint DOES report it correctly ===");
const detail = await api(`/communities/${c._id}`, { token: joiner.token });
console.log("detail.membership =", JSON.stringify(detail.data?.data?.community?.membership));

await mongoose.disconnect();
