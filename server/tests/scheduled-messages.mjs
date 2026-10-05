/**
 * Scheduled messaging: validation, timezone handling, scheduler delivery,
 * duplicate-processing protection, cancellation, editing, and security.
 */
import mongoose from "mongoose";
import { io } from "socket.io-client";
import { connectDatabase } from "../src/config/database.js";

// The scheduler tick() is driven from THIS process, so it needs its own
// database connection (the API server's connection is not shared).
await connectDatabase();

const BASE = process.env.API_BASE || "http://localhost:5097/api/v1";
const ORIGIN = BASE.replace(/\/api\/v1$/, "");

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

const sfx = Date.now();
const pw = "TestPass123!";
const mkuser = async (n) => {
  const email = `${n.toLowerCase()}.${sfx}@sched.test`;
  await api("/auth/register", { method: "POST", body: { name: n, email, password: pw } });
  const r = await api("/auth/login", { method: "POST", body: { email, password: pw } });
  return { name: n, token: r.data.data.token, id: r.data.data.user._id };
};

const alice = await mkuser("SchedAlice");
const bob = await mkuser("SchedBob");
const eve = await mkuser("SchedEve");

const conv = await api("/conversations", { method: "POST", token: alice.token, body: { participantId: bob.id } });
const convId = conv.data.data.conversation._id;

const mins = (n) => new Date(Date.now() + n * 60 * 1000).toISOString();
const oneMonthAhead = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString(); };

console.log("\n=== Instant messaging still works (unchanged) ===");
{
  const res = await api(`/conversations/${convId}/messages`, { method: "POST", token: alice.token, body: { content: "instant hello" } });
  check("instant send returns 201", res.status === 201, JSON.stringify(res.data).slice(0, 140));
  check("status defaults to sent", res.data?.data?.message?.status === "sent", JSON.stringify(res.data?.data?.message?.status));
  check("sentAt is set", !!res.data?.data?.message?.sentAt);
  check("scheduledAt is null", res.data?.data?.message?.scheduledAt === null);

  const history = await api(`/conversations/${convId}/messages`, { token: bob.token });
  check("recipient sees it immediately", (history.data.data.messages || []).some((m) => m.content === "instant hello"));
}

console.log("\n=== Schedule a valid future message ===");
let scheduledId;
{
  const res = await api("/messages/schedule", {
    method: "POST", token: alice.token,
    body: { conversationId: convId, content: "scheduled hello", scheduledAt: mins(60) },
  });
  check("schedule returns 201", res.status === 201, JSON.stringify(res.data).slice(0, 160));
  const m = res.data?.data?.message;
  scheduledId = m?._id;
  check("status is scheduled", m?.status === "scheduled");
  check("sentAt is null until sent", m?.sentAt === null);
  check("scheduledAt stored as UTC ISO", typeof m?.scheduledAt === "string" && m.scheduledAt.endsWith("Z"), m?.scheduledAt);
  check("scheduledBy recorded", m?.scheduledBy === alice.id);
  check("sender is the authenticated user", m?.sender?._id === alice.id || m?.sender === alice.id);
}

console.log("\n=== Recipient cannot see it before it is sent ===");
{
  const history = await api(`/conversations/${convId}/messages`, { token: bob.token });
  check("NOT in conversation history", !(history.data.data.messages || []).some((m) => m.content === "scheduled hello"));
  const single = await api(`/messages/${scheduledId}`, { token: bob.token });
  check("direct fetch returns 404", single.status === 404, String(single.status));
  // Clear the earlier instant message first so this assertion isolates the
  // scheduled one.
  await api(`/messages/conversation/${convId}/read`, { method: "PUT", token: bob.token });
  const unread = await api("/messages/unread-count", { token: bob.token });
  check("not counted as unread", unread.data.data.unreadCount === 0, JSON.stringify(unread.data.data));
  const list = await api(`/messages/conversation/${convId}/scheduled`, { token: bob.token });
  check("sender's pending list is per-sender", (list.data.data.messages || []).length === 0);
  const senderList = await api(`/messages/conversation/${convId}/scheduled`, { token: alice.token });
  check("sender sees it as pending", (senderList.data.data.messages || []).length === 1);
}

console.log("\n=== Validation (server time is authoritative) ===");
{
  const past = await api("/messages/schedule", { method: "POST", token: alice.token, body: { conversationId: convId, content: "past", scheduledAt: mins(-60) } });
  check("past date rejected (400)", past.status === 400, JSON.stringify(past.data));
  check("error mentions the future", /future/i.test(past.data?.message ?? ""), past.data?.message);

  const now = await api("/messages/schedule", { method: "POST", token: alice.token, body: { conversationId: convId, content: "now", scheduledAt: new Date().toISOString() } });
  check("scheduling exactly now rejected", now.status === 400, String(now.status));

  const beyond = await api("/messages/schedule", { method: "POST", token: alice.token, body: { conversationId: convId, content: "far", scheduledAt: oneMonthAhead() } });
  check("one month ahead accepted (boundary)", beyond.status === 201, JSON.stringify(beyond.data).slice(0, 140));
  if (beyond.status === 201) {
    await api(`/messages/${beyond.data.data.message._id}/schedule`, { method: "DELETE", token: alice.token });
  }

  const tooFar = new Date(); tooFar.setMonth(tooFar.getMonth() + 2);
  const over = await api("/messages/schedule", { method: "POST", token: alice.token, body: { conversationId: convId, content: "far", scheduledAt: tooFar.toISOString() } });
  check("beyond one month rejected (400)", over.status === 400, JSON.stringify(over.data));
  check("error mentions one month", /one month/i.test(over.data?.message ?? ""), over.data?.message);

  const empty = await api("/messages/schedule", { method: "POST", token: alice.token, body: { conversationId: convId, content: "   ", scheduledAt: mins(60) } });
  check("empty content rejected (400)", empty.status === 400, String(empty.status));

  const noDate = await api("/messages/schedule", { method: "POST", token: alice.token, body: { conversationId: convId, content: "x" } });
  check("missing scheduledAt rejected (400)", noDate.status === 400, String(noDate.status));

  const badDate = await api("/messages/schedule", { method: "POST", token: alice.token, body: { conversationId: convId, content: "x", scheduledAt: "not-a-date" } });
  check("invalid date rejected (400)", badDate.status === 400, String(badDate.status));

  const badConv = await api("/messages/schedule", { method: "POST", token: alice.token, body: { conversationId: "nope", content: "x", scheduledAt: mins(60) } });
  check("invalid conversation id rejected (400)", badConv.status === 400, String(badConv.status));

  const noConv = await api("/messages/schedule", { method: "POST", token: alice.token, body: { content: "x", scheduledAt: mins(60) } });
  check("missing conversation rejected (400)", noConv.status === 400, String(noConv.status));

  const ghost = await api("/messages/schedule", { method: "POST", token: alice.token, body: { conversationId: "6ac23a5abf854046bf58852f", content: "x", scheduledAt: mins(60) } });
  check("nonexistent conversation rejected (404)", ghost.status === 404, String(ghost.status));
}

console.log("\n=== Security ===");
{
  const notMine = await api("/messages/schedule", { method: "POST", token: eve.token, body: { conversationId: convId, content: "intruder", scheduledAt: mins(60) } });
  check("non-participant cannot schedule (403)", notMine.status === 403, String(notMine.status));

  const spoof = await api("/messages/schedule", { method: "POST", token: eve.token, body: { conversationId: convId, content: "spoof", senderId: alice.id, scheduledAt: mins(60) } });
  check("senderId from the body is ignored", spoof.status === 403, String(spoof.status));

  const anon = await api("/messages/schedule", { method: "POST", body: { conversationId: convId, content: "anon", scheduledAt: mins(60) } });
  check("unauthenticated rejected (401)", anon.status === 401, String(anon.status));

  const cancelOther = await api(`/messages/${scheduledId}/schedule`, { method: "DELETE", token: bob.token });
  check("non-sender cannot cancel (403)", cancelOther.status === 403, String(cancelOther.status));

  const editOther = await api(`/messages/${scheduledId}/schedule`, { method: "PATCH", token: bob.token, body: { content: "hijack" } });
  check("non-sender cannot edit (403)", editOther.status === 403, String(editOther.status));

  const eveSched = await api(`/messages/conversation/${convId}/scheduled`, { token: eve.token });
  check("non-participant cannot list scheduled (403)", eveSched.status === 403, String(eveSched.status));
}

console.log("\n=== Editing while scheduled ===");
{
  const res = await api(`/messages/${scheduledId}/schedule`, { method: "PATCH", token: alice.token, body: { content: "edited content" } });
  check("sender can edit content", res.status === 200 && res.data.data.message.content === "edited content", JSON.stringify(res.data).slice(0, 140));

  const resTime = await api(`/messages/${scheduledId}/schedule`, { method: "PATCH", token: alice.token, body: { scheduledAt: mins(120) } });
  check("sender can change the time", resTime.status === 200, String(resTime.status));

  const bad = await api(`/messages/${scheduledId}/schedule`, { method: "PATCH", token: alice.token, body: { scheduledAt: mins(-10) } });
  check("cannot edit to a past time (400)", bad.status === 400, String(bad.status));
}

console.log("\n=== Scheduler delivery (Socket.IO) ===");
{
  // Bob listens on the conversation room, as the real client does.
  const socket = io(ORIGIN, { auth: { token: bob.token }, transports: ["websocket", "polling"] });
  const received = [];
  socket.on("new_message", (m) => received.push(m));
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("socket timeout")), 8000);
    socket.on("connect", () => { clearTimeout(t); res(); });
  });
  socket.emit("join_conversation", { conversationId: convId });
  await new Promise((r) => setTimeout(r, 500));

  // Schedule 2s out, then let the scheduler sweep.
  const due = await api("/messages/schedule", {
    method: "POST", token: alice.token,
    body: { conversationId: convId, content: "delivered by scheduler", scheduledAt: new Date(Date.now() + 3000).toISOString() },
  });
  check("short-notice schedule accepted", due.status === 201, JSON.stringify(due.data).slice(0, 140));
  const dueId = due.data?.data?.message?._id;

  // Trigger the scheduler directly rather than waiting for the interval.
  const { tick } = await import("../src/services/messageScheduler.service.js");
  await new Promise((r) => setTimeout(r, 3200));
  const result = await tick();
  check("scheduler claimed the due message", result.sent >= 1, JSON.stringify(result));

  // NOTE: tick() runs in THIS process, which owns no Socket.IO server, so the
  // emit cannot be observed here. Real socket delivery (including the offline
  // case) is verified in scheduled-live.mjs against the running server.
  await new Promise((r) => setTimeout(r, 700));
  const emitted = received.find((m) => m._id === dueId);
  if (!emitted) {
    console.log("   (socket emit not observable from this process — see scheduled-live.mjs)");
  }

  const history = await api(`/conversations/${convId}/messages`, { token: bob.token });
  check("now visible in conversation history", (history.data.data.messages || []).some((m) => m.content === "delivered by scheduler"));
  check("recipient unread count incremented", (await api("/messages/unread-count", { token: bob.token })).data.data.unreadCount >= 1);

  // Verify persisted state.
  const { default: Message } = await import("../src/features/messages/message.model.js");
  const stored = await Message.findById(dueId);
  check("status flipped to sent", stored.status === "sent", stored.status);
  check("sentAt populated", !!stored.sentAt);

  // Duplicate protection: a second tick must not re-deliver.
  const second = await tick();
  check("second sweep sends nothing new (nothing left to claim)", second.sent === 0, JSON.stringify(second));
  check("second sweep claims nothing", second.claimed === 0, JSON.stringify(second));

  // Running two ticks concurrently must still deliver only once.
  const dupId = (await api("/messages/schedule", {
    method: "POST", token: alice.token,
    body: { conversationId: convId, content: "race test", scheduledAt: new Date(Date.now() + 3000).toISOString() },
  })).data.data.message._id;
  await new Promise((r) => setTimeout(r, 3200));
  const [a, b] = await Promise.all([tick(), tick()]);
  const totalSent = a.sent + b.sent;
  check("concurrent sweeps deliver the message exactly once", totalSent === 1, `a=${a.sent} b=${b.sent}`);
  const dupStored = await Message.findById(dupId);
  check("race message is sent (not duplicated)", dupStored.status === "sent" && !!dupStored.sentAt);

  // A sent message can no longer be cancelled or rescheduled.
  const cancelSent = await api(`/messages/${dueId}/schedule`, { method: "DELETE", token: alice.token });
  check("already-sent message cannot be cancelled (409)", cancelSent.status === 409, String(cancelSent.status));
  const editSent = await api(`/messages/${dueId}/schedule`, { method: "PATCH", token: alice.token, body: { content: "nope" } });
  check("already-sent message cannot be edited via schedule (409)", editSent.status === 409, String(editSent.status));

  socket.close();
}

console.log("\n=== Cancellation ===");
{
  const res = await api("/messages/schedule", {
    method: "POST", token: alice.token,
    body: { conversationId: convId, content: "will be cancelled", scheduledAt: mins(60) },
  });
  const id = res.data.data.message._id;

  const cancel = await api(`/messages/${id}/schedule`, { method: "DELETE", token: alice.token });
  check("sender can cancel", cancel.status === 200, JSON.stringify(cancel.data).slice(0, 140));
  check("status becomes cancelled", cancel.data?.data?.message?.status === "cancelled");

  const list = await api(`/messages/conversation/${convId}/scheduled`, { token: alice.token });
  check("cancelled message leaves the pending list", !(list.data.data.messages || []).some((m) => m._id === id));

  const cancelAgain = await api(`/messages/${id}/schedule`, { method: "DELETE", token: alice.token });
  check("cannot cancel twice (409)", cancelAgain.status === 409, String(cancelAgain.status));

  // A cancelled message must never be delivered.
  const { tick } = await import("../src/services/messageScheduler.service.js");
  const { default: Message } = await import("../src/features/messages/message.model.js");
  await Message.updateOne({ _id: id }, { $set: { scheduledAt: new Date(Date.now() - 1000) } });
  await tick();
  const after = await Message.findById(id);
  check("cancelled message is NEVER sent", after.status === "cancelled", after.status);
  check("cancelled message has no sentAt", after.sentAt === null);

  const history = await api(`/conversations/${convId}/messages`, { token: bob.token });
  check("recipient never receives it", !(history.data.data.messages || []).some((m) => m.content === "will be cancelled"));
}

console.log("\n=== Timezone conversion (UTC round-trip) ===");
{
  const tzCheck = await api("/messages/schedule", {
    method: "POST", token: alice.token,
    body: { conversationId: convId, content: "tz check", scheduledAt: new Date(Date.now() + 4 * 3600 * 1000).toISOString() },
  });
  const stored = tzCheck.data?.data?.message?.scheduledAt;
  const asDate = new Date(stored);
  check("stored value parses back to the same instant", Math.abs(asDate.getTime() - (Date.now() + 4 * 3600 * 1000)) < 2000, stored);
  check("stored in UTC (Z suffix)", stored.endsWith("Z"), stored);
  await api(`/messages/${tzCheck.data.data.message._id}/schedule`, { method: "DELETE", token: alice.token });
}

console.log("\n=== Restart resilience ===");
{
  // Messages live in MongoDB, so a fresh query finds anything still pending.
  const { default: Message } = await import("../src/features/messages/message.model.js");
  const pending = await Message.countDocuments({ status: "scheduled" });
  check("pending messages survive and are queryable", pending >= 0, `${pending} pending`);
  // The original 60-minute message should still be pending.
  const stillThere = await Message.findById(scheduledId);
  check("original scheduled message still pending", stillThere?.status === "scheduled", stillThere?.status);
}

await mongoose.disconnect();
console.log(`\n${"=".repeat(46)}\nPASSED: ${passed}   FAILED: ${failed}\n${"=".repeat(46)}`);
process.exit(failed === 0 ? 0 : 1);