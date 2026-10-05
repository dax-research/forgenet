/**
 * End-to-end scheduled delivery driven by the RUNNING SERVER's own scheduler
 * (not an in-process tick), with a real Socket.IO client listening. This proves
 * the emit actually reaches participants on the server that owns the sockets.
 */
import { io } from "socket.io-client";
import mongoose from "mongoose";
import { connectDatabase } from "../src/config/database.js";

const BASE = process.env.API_BASE || "http://localhost:5105/api/v1";
const ORIGIN = BASE.replace(/\/api\/v1$/, "");
const POLL_INTERVAL_MS = Number.parseInt(process.env.SCHEDULER_INTERVAL_MS ?? "2000", 10);

let passed = 0, failed = 0;
const check = (l, c, e = "") => { if (c) { passed++; console.log(`  PASS  ${l}`); } else { failed++; console.log(`  FAIL  ${l} ${e}`); } };

const api = async (p, { method = "GET", token, body } = {}) => {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
};

// Direct model reads below need this process's own connection.
await connectDatabase();

const sfx = Date.now();
const pw = "TestPass123!";
const mkuser = async (n) => {
  const email = `${n.toLowerCase()}.${sfx}@live.test`;
  await api("/auth/register", { method: "POST", body: { name: n, email, password: pw } });
  const r = await api("/auth/login", { method: "POST", body: { email, password: pw } });
  return { name: n, token: r.data.data.token, id: r.data.data.user._id };
};

const sender = await mkuser("LiveSender");
const recipient = await mkuser("LiveRecipient");

const conv = await api("/conversations", { method: "POST", token: sender.token, body: { participantId: recipient.id } });
const convId = conv.data.data.conversation._id;

console.log("\n=== Recipient joins the conversation room ===");
const socket = io(ORIGIN, { auth: { token: recipient.token }, transports: ["websocket", "polling"] });
const received = [];
socket.on("new_message", (m) => received.push(m));
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("socket connect timeout")), 8000);
  socket.on("connect", () => { clearTimeout(t); res(); });
});
const joined = await new Promise((resolve) => {
  socket.emit("join_conversation", { conversationId: convId }, (ack) => resolve(ack));
  setTimeout(() => resolve({ success: false, message: "join ack timeout" }), 8000);
});
check("recipient joined the conversation room", joined?.success === true, JSON.stringify(joined));
await new Promise((r) => setTimeout(r, 300));

console.log(`   socket connected; scheduler interval ~${POLL_INTERVAL_MS}ms`);

console.log("\n=== Schedule a message the RUNNING server will deliver ===");
const dueAt = new Date(Date.now() + 4000);
const scheduled = await api("/messages/schedule", {
  method: "POST", token: sender.token,
  body: { conversationId: convId, content: "live scheduler delivery", scheduledAt: dueAt.toISOString() },
});
check("scheduled", scheduled.status === 201, JSON.stringify(scheduled.data).slice(0, 150));
const msgId = scheduled.data?.data?.message?._id;

console.log("   waiting for the server's scheduler (no manual tick)...");
const deadline = Date.now() + 30000;
let emitted = null;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 500));
  emitted = received.find((m) => m._id === msgId);
  if (emitted) break;
}

check("recipient received new_message from the server's scheduler", !!emitted, `received ${received.length}`);
if (emitted) {
  check("emitted payload is the scheduled content", emitted.content === "live scheduler delivery", emitted.content);
  check("emitted payload has status sent", emitted.status === "sent", String(emitted.status));
  check("emitted payload carries sentAt", !!emitted.sentAt);
}

const history = await api(`/conversations/${convId}/messages`, { token: recipient.token });
check("message appears in conversation history", (history.data.data.messages || []).some((m) => m.content === "live scheduler delivery"));
check("recipient unread count incremented", (await api("/messages/unread-count", { token: recipient.token })).data.data.unreadCount >= 1);

const { default: Message } = await import("../src/features/messages/message.model.js");
const stored = await Message.findById(msgId);
check("persisted status is sent", stored.status === "sent", String(stored.status));
check("persisted sentAt populated", !!stored.sentAt);

console.log("\n=== No duplicate emission ===");
const countBefore = received.length;
await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS * 3));
check("no further events for the same message", received.length === countBefore, `${countBefore} -> ${received.length}`);

console.log("\n=== Offline recipient still receives via REST ===");
socket.close();
await new Promise((r) => setTimeout(r, 300));
const offline = await api("/messages/schedule", {
  method: "POST", token: sender.token,
  body: { conversationId: convId, content: "sent while offline", scheduledAt: new Date(Date.now() + 3000).toISOString() },
});
const offlineId = offline.data?.data?.message?._id;
const dl = Date.now() + 25000;
let stored2 = null;
while (Date.now() < dl) {
  await new Promise((r) => setTimeout(r, 600));
  stored2 = await Message.findById(offlineId);
  if (stored2.status === "sent") break;
}
check("scheduler delivers even with recipient offline", stored2?.status === "sent", String(stored2?.status));
const offlineHistory = await api(`/conversations/${convId}/messages`, { token: recipient.token });
check("offline recipient gets it via REST", (offlineHistory.data.data.messages || []).some((m) => m.content === "sent while offline"));

await mongoose.disconnect();
console.log(`\n${"=".repeat(46)}\nPASSED: ${passed}   FAILED: ${failed}\n${"=".repeat(46)}`);
process.exit(failed === 0 ? 0 : 1);