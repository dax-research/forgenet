import Message from "./message.model.js";
import Conversation from "../chat/conversation.model.js";

/**
 * Scheduled-message rules.
 *
 * The server clock is authoritative for every check here — the client may
 * pre-validate for UX, but nothing is trusted.
 */

/** One month from now, computed dynamically from the current server time. */
export const MAX_SCHEDULE_AHEAD_MS = () => {
  const now = Date.now();
  const ahead = new Date(now);
  ahead.setMonth(ahead.getMonth() + 1);
  return ahead.getTime();
};

// A small lead time stops a message being due in the same instant it is
// created, which would make the "is it in the future" check ambiguous.
export const SCHEDULE_MIN_LEAD_MS = Number.parseInt(process.env.SCHEDULE_MIN_LEAD_MS ?? "1000", 10);

/**
 * Validates a requested scheduled time against server time.
 * @returns {{valid:true, date:Date} | {valid:false, message:string}}
 */
export const validateScheduledAt = (rawValue, { now = Date.now() } = {}) => {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return { valid: false, message: "A scheduled time is required." };
  }

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) {
    return { valid: false, message: "scheduledAt is not a valid date." };
  }

  // Reject anything that is not strictly in the future.
  if (date.getTime() <= now) {
    return { valid: false, message: "Scheduled time must be in the future." };
  }

  // A small lead time avoids messages due in the same second as scheduling.
  if (date.getTime() < now + SCHEDULE_MIN_LEAD_MS) {
    const seconds = Math.round(SCHEDULE_MIN_LEAD_MS / 1000);
    return {
      valid: false,
      message: `Scheduled time must be at least ${seconds} second(s) in the future.`,
    };
  }

  // One month ahead, calculated from the current server time.
  if (date.getTime() > MAX_SCHEDULE_AHEAD_MS()) {
    return { valid: false, message: "Scheduled time cannot be more than one month ahead." };
  }

  return { valid: true, date };
};

/** Verifies the user is a participant of the conversation. */
export const isParticipant = async (conversationId, userId) => {
  if (!conversationId) return { ok: false, status: 400, message: "conversationId is required." };

  const exists = await Conversation.exists({ _id: conversationId });
  if (!exists) return { ok: false, status: 404, message: "Conversation not found." };

  const conversation = await Conversation.findById(conversationId).select("participants");
  const member = conversation.participants.some(
    (id) => id.toString() === userId.toString()
  );
  if (!member) return { ok: false, status: 403, message: "Forbidden" };

  return { ok: true, conversation };
};

/**
 * Claims due messages atomically and returns them for delivery.
 *
 * Uses findOneAndUpdate with status:"scheduled" still required, so two
 * concurrent scheduler cycles can never claim the same document.
 */
export const claimDueMessages = async ({ now = new Date(), limit = 50 } = {}) => {
  const claimed = [];

  for (let i = 0; i < limit; i++) {
    const message = await Message.findOneAndUpdate(
      { status: "scheduled", scheduledAt: { $lte: now } },
      { $set: { status: "sent", sentAt: now, deliveredAt: now } },
      { new: true, sort: { scheduledAt: 1 } }
    );
    if (!message) break;
    claimed.push(message);
  }

  return claimed;
};

/** Messages that are scheduled but not yet due. */
export const listPendingForSender = async (conversationId, senderId) =>
  Message.find({
    conversation: conversationId,
    sender: senderId,
    status: "scheduled",
  }).sort({ scheduledAt: 1 });