/**
 * Does the owner actually RECEIVE the join-request notification in real time?
 * Uses a real Socket.IO client as the owner, then triggers a join request
 * from another user and checks whether the event lands.
 */
import { io } from "socket.io-client";
import { createHash } from "node:crypto";

const BASE = process.env.API_BASE || "http://localhost:5059/api/v1";
const ORIGIN = BASE.replace(/\/api\/v1$/, "");

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

const owner = await mkuser("RtOwner");
const joiner = await mkuser("RtJoiner");

const comm = (
  await api("/communities", {
    method: "POST",
    token: owner.token,
    body: { name: `RtComm ${sfx}`, description: "realtime", joinMode: "APPROVAL_REQUIRED" },
  })
).data.data.community;

console.log("Owner socket connecting as a logged-in client...");
const socket = io(ORIGIN, { auth: { token: owner.token }, transports: ["websocket", "polling"] });

const received = [];
socket.on("notification:new", (n) => {
  received.push({ event: "notification:new", message: n.message, type: n.type });
  console.log("  >> owner received notification:new —", n.message);
});
socket.on("connect", () => console.log("  socket connected, id:", socket.id));

await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("socket connect timeout")), 8000);
  socket.on("connect", () => { clearTimeout(t); resolve(); });
});
await new Promise((r) => setTimeout(r, 500));

console.log("\nJoiner now sends a join request...");
await api(`/communities/${comm._id}/join`, { method: "POST", token: joiner.token });

await new Promise((r) => setTimeout(r, 1500));

console.log("\n--- RESULT ---");
console.log("events received by owner:", received.length);
const gotJoin = received.find((e) => e.message?.includes("requested to join"));
console.log("join-request notification reached owner in real time?", gotJoin ? "YES" : "NO");

if (!gotJoin) {
  console.log("\n>>> The socket did not deliver it. Owner would only see it after a manual refresh.");
}

socket.close();
process.exit(gotJoin ? 0 : 1);
