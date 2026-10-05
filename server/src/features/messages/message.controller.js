import mongoose from "mongoose";
import Conversation from "../chat/conversation.model.js";
import Message from "./message.model.js";
import User from "../users/user.model.js"; // for potential future checks
import { emitToUser, emitToConversation as emitToRoom } from "../../services/realtime.service.js";
import {
  validateScheduledAt,
  isParticipant as assertParticipant,
  listPendingForSender,
} from "./message.scheduler.js";

const valid = (id) => mongoose.isValidObjectId(id);

/**
 * Matches messages that have actually been delivered.
 *
 * Messages created before scheduling existed have no `status` field, so a
 * missing value must count as delivered — otherwise historical messages would
 * vanish from history and unread counts.
 */
const DELIVERED = { $in: ["sent", null] };

/**
 * Broadcasts an already-persisted message to the conversation room using the
 * existing "new_message" event. Shared by the scheduler and instant sending so
 * scheduled messages travel exactly the same path as normal ones.
 */
export const emitToConversation = async (message) => {
  const conversation = await Conversation.findById(
    message.conversation?._id ?? message.conversation
  ).select("participants");

  const populated =
    typeof message.populate === "function"
      ? await message.populate("sender", "name profileImage")
      : message;

  const payload =
    typeof populated.toJSON === "function" ? populated.toJSON() : { ...populated };

  // The conversation reference must be a raw id here: a populated object would
  // target a room name that nobody has joined.
  const conversationId =
    conversation?._id ?? populated.conversation?._id ?? populated.conversation;

  // Deliver to the conversation room AND each participant's personal room.
  // Room-only delivery would drop the message for a client that has not joined
  // that conversation yet.
  emitToRoom(
    conversationId,
    "new_message",
    payload,
    conversation?.participants ?? []
  );

  return payload;
};

/**
 * POST /api/v1/messages/schedule
 *
 * Creates a message that the backend scheduler will deliver later. All
 * scheduling rules are re-validated here against the server clock, regardless
 * of what the client checked.
 */
export const scheduleMessage = async (req, res) => {
  const { conversationId, content } = req.body ?? {};
  const senderId = req.user._id;

  if (!valid(conversationId)) {
    return res.status(400).json({ success: false, message: "Invalid conversation ID" });
  }

  const membership = await assertParticipant(conversationId, senderId);
  if (!membership.ok) {
    return res.status(membership.status).json({ success: false, message: membership.message });
  }

  if (!content || !String(content).trim()) {
    return res.status(400).json({ success: false, message: "Message content is required" });
  }
  if (String(content).length > 5000) {
    return res.status(400).json({ success: false, message: "Message content is too long" });
  }

  const check = validateScheduledAt(req.body?.scheduledAt);
  if (!check.valid) {
    return res.status(400).json({ success: false, message: check.message });
  }

  const message = await Message.create({
    sender: senderId,
    conversation: conversationId,
    content: String(content).trim(),
    scheduledAt: check.date,
    scheduledBy: senderId,
    status: "scheduled",
    sentAt: null,
    deliveredAt: null,
    readAt: null,
  });

  await message.populate("sender", "name profileImage");

  return res.status(201).json({ success: true, data: { message } });
};

/**
 * GET /api/v1/messages/conversation/:conversationId/scheduled
 * The sender's own pending scheduled messages for a conversation.
 */
export const getScheduledMessages = async (req, res) => {
  const { conversationId } = req.params;
  if (!valid(conversationId)) {
    return res.status(400).json({ success: false, message: "Invalid conversation ID" });
  }

  const membership = await assertParticipant(conversationId, req.user._id);
  if (!membership.ok) {
    return res.status(membership.status).json({ success: false, message: membership.message });
  }

  const messages = await listPendingForSender(conversationId, req.user._id);
  await Promise.all(
    messages.map((m) => m.populate("sender", "name profileImage"))
  );

  return res.json({ success: true, data: { messages } });
};

/**
 * DELETE /api/v1/messages/:id/schedule
 * Only the original sender can cancel, and only while still "scheduled".
 */
export const cancelScheduledMessage = async (req, res) => {
  if (!valid(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid message ID" });
  }

  const message = await Message.findById(req.params.id);
  if (!message) {
    return res.status(404).json({ success: false, message: "Message not found" });
  }
  if (message.sender.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: "You can only cancel your own scheduled messages",
    });
  }
  if (message.status !== "scheduled") {
    return res.status(409).json({
      success: false,
      message: "This message has already been sent or cancelled",
    });
  }

  // Conditional update: if the scheduler claimed it first, nothing matches.
  const cancelled = await Message.findOneAndUpdate(
    { _id: message._id, status: "scheduled" },
    { $set: { status: "cancelled" } },
    { new: true }
  );

  if (!cancelled) {
    return res.status(409).json({
      success: false,
      message: "This message was already sent",
    });
  }

  return res.json({ success: true, data: { message: cancelled } });
};

/**
 * PATCH /api/v1/messages/:id/schedule
 * Edit content and/or the scheduled time, only while still "scheduled".
 */
export const updateScheduledMessage = async (req, res) => {
  if (!valid(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid message ID" });
  }

  const message = await Message.findById(req.params.id);
  if (!message) {
    return res.status(404).json({ success: false, message: "Message not found" });
  }
  if (message.sender.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: "You can only edit your own scheduled messages",
    });
  }
  if (message.status !== "scheduled") {
    return res.status(409).json({
      success: false,
      message: "Only scheduled messages can be edited this way",
    });
  }

  const { content, scheduledAt } = req.body ?? {};

  if (content !== undefined) {
    if (!String(content).trim()) {
      return res.status(400).json({ success: false, message: "Message content is required" });
    }
    message.content = String(content).trim();
  }

  if (scheduledAt !== undefined) {
    const check = validateScheduledAt(scheduledAt);
    if (!check.valid) {
      return res.status(400).json({ success: false, message: check.message });
    }
    message.scheduledAt = check.date;
  }

  await message.save();
  await message.populate("sender", "name profileImage");

  return res.json({ success: true, data: { message } });
};

// Helper to verify user is participant
const isParticipant = async (conversationId, userId) => {
  const convo = await Conversation.findById(conversationId);
  if (!convo) return null;
  const member = convo.participants.some((pid) => pid.toString() === userId.toString());
  return member ? convo : null;
};

/**
 * Total unread messages for a user across every conversation they participate
 * in. A message is unread for a given user when it was sent by someone else
 * and its readAt is still null — readAt on the document is the source of truth.
 */
export const countUnread = async (userId) => {
  const conversations = await Conversation.find({ participants: userId }).select("_id");
  const conversationIds = conversations.map((c) => c._id);

  if (conversationIds.length === 0) return 0;

  return Message.countDocuments({
    conversation: { $in: conversationIds },
    sender: { $ne: userId },
    readAt: null,
    // A message that has not been delivered yet is not unread.
    status: DELIVERED,
  });
};

// GET /api/v1/messages/unread-count
export const getUnreadCount = async (req, res) => {
  const unreadCount = await countUnread(req.user._id);
  return res.json({ success: true, data: { unreadCount } });
};

// PUT /api/v1/messages/conversation/:conversationId/read
// Marks every message in the conversation as read for the requesting participant.
export const markConversationRead = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id;

  if (!valid(conversationId)) {
    return res.status(400).json({ success: false, message: "Invalid conversation ID" });
  }

  const conversation = await isParticipant(conversationId, userId);
  if (!conversation) {
    const exists = await Conversation.findById(conversationId);
    if (!exists) return res.status(404).json({ success: false, message: "Conversation not found" });
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  const result = await Message.updateMany(
    { conversation: conversation._id, sender: { $ne: userId }, readAt: null, status: DELIVERED },
    { $set: { readAt: new Date() } }
  );

  const unreadCount = await countUnread(userId);
  emitToUser(userId, "messages:unread_count", { unreadCount });

  return res.json({ success: true, data: { updatedCount: result.modifiedCount, unreadCount } });
};

/**
 * POST /api/v1/messages
 * Create a new message in a conversation.
 */
export const createMessage = async (req, res) => {
  const { conversationId, content } = req.body;
  const senderId = req.user._id;

  // Validate required fields
  if (!conversationId) {
    return res.status(400).json({ success: false, message: "conversationId is required" });
  }
  if (!valid(conversationId)) {
    return res.status(400).json({ success: false, message: "Invalid conversation ID" });
  }
  if (!content || !content.trim()) {
    return res.status(400).json({ success: false, message: "Message content is required" });
  }

  // Verify conversation exists and user participates
  const conversation = await isParticipant(conversationId, senderId);
  if (!conversation) {
    // Distinguish between not found and forbidden
    const exists = await Conversation.findById(conversationId);
    if (!exists) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  const message = await Message.create({
    conversation: conversationId,
    sender: senderId,
    content: content.trim(),
    // Instant send: delivered immediately, never scheduled.
    status: "sent",
    sentAt: new Date()
  });

  // Update conversation's updatedAt for ordering (optional, mirrors chat controller)
  await Conversation.findByIdAndUpdate(conversationId, { updatedAt: new Date() });

  const populated = await message.populate("sender", "name profileImage");
  return res.status(201).json({ success: true, data: { message: populated } });
};

/**
 * GET /api/v1/messages/conversation/:conversationId
 * Retrieve all messages for a conversation (chronological order).
 */
export const getMessages = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id;

  if (!valid(conversationId)) {
    return res.status(400).json({ success: false, message: "Invalid conversation ID" });
  }

  const conversation = await isParticipant(conversationId, userId);
  if (!conversation) {
    const exists = await Conversation.findById(conversationId);
    if (!exists) return res.status(404).json({ success: false, message: "Conversation not found" });
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  // Only delivered messages appear here; pending scheduled messages are
  // visible to their sender through /scheduled, never to the recipient.
  const messages = await Message.find({ conversation: conversationId, status: DELIVERED })
    .populate("sender", "name profileImage")
    .sort({ createdAt: 1 });

  return res.json({ success: true, data: { messages } });
};

/**
 * GET /api/v1/messages/:id
 * Retrieve a single message (must belong to a conversation the user participates in).
 */
export const getMessage = async (req, res) => {
  const { id } = req.params;
  if (!valid(id)) {
    return res.status(400).json({ success: false, message: "Invalid message ID" });
  }

  const message = await Message.findById(id).populate("sender", "name profileImage");
  if (!message) return res.status(404).json({ success: false, message: "Message not found" });

  // Verify user is part of the conversation
  const isMember = message.conversation && (await isParticipant(message.conversation, req.user._id));
  if (!isMember) return res.status(403).json({ success: false, message: "Forbidden" });

  // A message that has not been delivered yet is invisible to its recipient.
  if (message.status && message.status !== "sent") return res.status(404).json({ success: false, message: "Message not found" });

  return res.json({ success: true, data: { message } });
};

/**
 * PUT /api/v1/messages/:id
 * Update a message (only the sender can update).
 */
export const updateMessage = async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const senderId = req.user._id;

  if (!valid(id)) {
    return res.status(400).json({ success: false, message: "Invalid message ID" });
  }
  if (!content || !content.trim()) {
    return res.status(400).json({ success: false, message: "Message content is required" });
  }

  // Ensure the message belongs to the sender
  const message = await Message.findOneAndUpdate(
    { _id: id, sender: senderId },
    { content: content.trim() },
    { new: true, runValidators: true }
  ).populate("sender", "name profileImage");

  if (!message) return res.status(404).json({ success: false, message: "Message not found or not authorized" });

  return res.json({ success: true, data: { message } });
};

/**
 * DELETE /api/v1/messages/:id
 * Delete a message (only the sender can delete).
 */
export const deleteMessage = async (req, res) => {
  const { id } = req.params;
  const senderId = req.user._id;

  if (!valid(id)) {
    return res.status(400).json({ success: false, message: "Invalid message ID" });
  }

  const message = await Message.findOneAndDelete({ _id: id, sender: senderId });
  if (!message) return res.status(404).json({ success: false, message: "Message not found or not authorized" });

  return res.json({ success: true, message: "Message deleted successfully" });
};
